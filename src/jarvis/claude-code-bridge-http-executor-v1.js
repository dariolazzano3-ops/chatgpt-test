/* JARVIS — Bridge HTTP executor V1.

   The ONE adapter that lets the existing claude_bridge contract
   (claude-code-bridge-v1.js's executor seam) delegate real Claude Code
   execution to the EXISTING jarvis-claude Bridge service over its private
   HTTP interface (POST /v1/run), instead of spawning a local `claude` CLI
   process. This is a drop-in replacement for createChildProcessExecutorV1
   at exactly one call site — there is still exactly one implementation-
   worker path; this file never runs Claude itself.

   Bridge performs independent PRE/POST git + filesystem evidence and
   Claude tool auditing itself (its own /v1/run contract) — that raw
   evidence (git_evidence / filesystem_evidence / tool_audit) is always
   preserved verbatim, never discarded or reinterpreted. But Bridge's own
   response has no internally-specified schema for those fields beyond
   their names, and it never reports the canonical
   `aurentara.jarvis.repo-bound-verification.v1` shape (branch /
   branch_drift / files_changed / syntax_check) engineering-mission-
   acceptance-v1.js requires — in particular, Bridge does not run a syntax
   check.
   When `config.repo_dir` is provided (the remote operator always has
   this: it already resolves JARVIS_CLAUDE_REPO_DIR for git-branch truth,
   and that repo is the SAME shared checkout Bridge just modified), this
   file computes that canonical evidence itself, independently, via the
   ONE shared, trusted computation (repo-bound-verification-v1.js) the
   local-CLI executor (claude-code-repo-bound-executor-v1.js) also uses —
   real git status before/after, content-diffed, plus a real `node --check`
   on every changed .js/.mjs file. This is never Claude's or Bridge's
   self-report; it is this process's own direct, independent read of the
   same shared repo. Bridge's raw fields are merged onto that same object
   (never nested under a second schema) so ONE verification object works
   for both Independent Acceptance (needs branch/files_changed/
   syntax_check) and Astra POST (also reads git_evidence/filesystem_evidence/
   tool_audit) without either needing to know which path produced it.
   Without `repo_dir` (e.g. a caller with no local filesystem access to the
   repo), this falls back to Bridge's own bridge-http-verification.v1
   shape only — unchanged from before.

   Fails closed, never falls back to a local CLI:
     - the Bridge URL and token come only from server-side config passed
       into createJarvisBridgeHttpExecutorV1 — never a request/task/prompt
       value, never printed, never interpolated into any log or error
       string this file produces;
     - a non-2xx HTTP response, unreachable Bridge, timeout/abort, or
       malformed JSON all resolve to a normal (returned, not thrown where
       avoidable) executor result with a non-zero exit_code, so the outer
       bridge (claude-code-bridge-v1.js) classifies it exactly the way a
       failed local process would be classified — no special-casing needed
       there;
     - request and response bodies are bounded (MAX_PROMPT_CHARS,
       MAX_RESPONSE_BYTES); an oversized response is refused via a
       streamed, byte-counted read rather than buffered without limit;
     - `signal` (the AbortSignal claude-code-bridge-v1.js's own submit()
       already manages timeout/cancellation through) is passed straight to
       fetch — this file does not implement a second, competing timeout. */

import {
  beginJarvisRepoBoundVerificationV1,
  finishJarvisRepoBoundVerificationV1,
  trustedRepoReviewMetadataV1
} from './repo-bound-verification-v1.js';

const MAX_RESPONSE_BYTES = 2_000_000; // matches claude-code-bridge-v1.js's own clampOutput ceiling
const MAX_PROMPT_CHARS = 8000; // matches validateJarvisClaudeCodeRequestV1's own task cap — defensive, not a new limit

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function isNonEmptyEvidence(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

/** Reads a fetch Response body as JSON, refusing anything over `maxBytes`
 *  via a streamed, counted read rather than an unbounded buffer. Falls back
 *  to a single bounded .text() read if the runtime's Response has no
 *  streaming body reader. Throws BRIDGE_RESPONSE_TOO_LARGE /
 *  BRIDGE_RESPONSE_NOT_JSON — never returns a partial/truncated JSON value
 *  silently. */
export async function readBoundedJsonResponseV1(response, maxBytes = MAX_RESPONSE_BYTES) {
  const reader = response.body && typeof response.body.getReader === 'function' ? response.body.getReader() : null;
  let text;
  if (!reader) {
    text = await response.text();
    if (text.length > maxBytes) throw new Error('BRIDGE_RESPONSE_TOO_LARGE');
  } else {
    let received = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        try { await reader.cancel(); } catch { /* best effort */ }
        throw new Error('BRIDGE_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('BRIDGE_RESPONSE_NOT_JSON');
  }
}

/** Normalizes Bridge's own POST /v1/run response body into raw fields to
 *  merge onto a verification object. Deliberately passes git_evidence /
 *  filesystem_evidence / tool_audit through as opaque values — this file
 *  does not know or assume their internal shape beyond "present or not",
 *  so it never mis-parses a field it was only told the NAME of. */
function bridgeRawFieldsV1(body) {
  return {
    bridge_service: clean(body?.service, 200) || null,
    bridge_version: body?.version ?? null,
    mode: clean(body?.mode, 40) || null,
    project: clean(body?.project, 200) || null,
    git_evidence: body?.git_evidence ?? null,
    filesystem_evidence: body?.filesystem_evidence ?? null,
    tool_audit: body?.tool_audit ?? null,
    native_session: body?.native_session ?? null
  };
}

/** The verification this executor returns when no `repo_dir` was
 *  configured — Bridge's own raw evidence only, no canonical
 *  branch/files_changed/syntax_check (nothing here can compute those
 *  without direct filesystem access to the repo). */
function bridgeOnlyVerificationV1(body) {
  return {
    schema: 'aurentara.jarvis.bridge-http-verification.v1',
    ...bridgeRawFieldsV1(body),
    at: new Date().toISOString()
  };
}
function safeReadOnlyGitIndexEvidenceFallbackV1(body, executionMode) {
  if (executionMode !== 'review' || !body || typeof body !== 'object') return false;
  const audit = body.tool_audit || {};
  const fs = body.filesystem_evidence || {};
  const git = body.git_evidence || {};
  const pre = git.pre || {};
  const post = git.post || {};
  const changes = git.changes || {};
  const native = body.native_session || {};
  const permissionPattern = /\.git\/index: index file open failed: Permission denied/i;
  const zeroDelta = Number(fs.added_count || 0) === 0
    && Number(fs.changed_count || 0) === 0
    && Number(fs.removed_count || 0) === 0
    && Array.isArray(fs.added) && fs.added.length === 0
    && Array.isArray(fs.changed) && fs.changed.length === 0
    && Array.isArray(fs.removed) && fs.removed.length === 0;
  return body.exit_code === 0
    && audit.complete === true
    && audit.compliant === true
    && fs.complete === true
    && fs.unchanged === true
    && zeroDelta
    && git.head_unchanged === true
    && Boolean(pre.head)
    && pre.head === post.head
    && Boolean(pre.branch)
    && pre.branch === post.branch
    && permissionPattern.test(String(pre.error || ''))
    && permissionPattern.test(String(post.error || ''))
    && changes.error === 'git change evidence incomplete'
    && (native.enabled !== true || native.binding_verified === true);
}


/** Builds a Node-only executor for claude-code-bridge-v1.js bound to a real,
 *  already-running Bridge HTTP service. `bridge_token` is held only in this
 *  closure and used solely as a per-call Authorization header value — it is
 *  never logged, never echoed into a returned stdout/stderr string, and
 *  never reaches the constructed `prompt`. Throws synchronously (fail fast)
 *  if url/token/project/fetch are not all provided — the caller
 *  (claude-code-bridge-http-runtime-binding-v1.js) is expected to catch this
 *  and report `bound: false`, never to retry with a guessed default.
 *  `config.repo_dir` is optional; when given, this executor computes the
 *  canonical repo-bound-verification-v1.js evidence itself (see file
 *  header) and merges Bridge's own raw fields onto it. */
export function createJarvisBridgeHttpExecutorV1(config = {}) {
  const baseUrl = clean(config.bridge_url, 400).replace(/\/+$/, '');
  const token = typeof config.bridge_token === 'string' ? config.bridge_token : '';
  const project = clean(config.project, 200);
  const fetchImpl = typeof config.fetch_impl === 'function' ? config.fetch_impl : globalThis.fetch;
  const repoDir = clean(config.repo_dir, 400) || null;

  if (!baseUrl) throw new Error('BRIDGE_HTTP_EXECUTOR_URL_REQUIRED');
  if (!token) throw new Error('BRIDGE_HTTP_EXECUTOR_TOKEN_REQUIRED');
  if (!project) throw new Error('BRIDGE_HTTP_EXECUTOR_PROJECT_REQUIRED');
  if (typeof fetchImpl !== 'function') throw new Error('BRIDGE_HTTP_EXECUTOR_FETCH_REQUIRED');

  /** Builds the final verification for this one call: the canonical,
   *  independently-computed object (when repoDir is configured) with
   *  Bridge's own raw fields merged on top — never the reverse, so a
   *  malformed/missing Bridge body can never clobber `branch`,
   *  `files_changed`, or `syntax_check`. Falls back to Bridge-only
   *  evidence when repoDir isn't configured. */
  function buildVerificationV1(body, snapshot, trustedReviewMetadata = null) {
    const bridgeOnly = bridgeOnlyVerificationV1(body);
    if (!snapshot) return bridgeOnly;
    const canonical = finishJarvisRepoBoundVerificationV1(snapshot);
    return {
      ...canonical,
      ...bridgeRawFieldsV1(body),
      ...(trustedReviewMetadata ? {
        trusted_review_repository_metadata: trustedReviewMetadata
      } : {})
    };
  }

  return async ({ task, signal, correlation_id, request_id, execution_mode }) => {
    const prompt = clean(task, MAX_PROMPT_CHARS);
    const correlationId = clean(correlation_id, 80).toLowerCase();
    const requestId = clean(request_id, 200);
    const executionMode = clean(execution_mode || 'implement', 20).toLowerCase();
    if (!['implement', 'review'].includes(executionMode)) {
      throw new Error('BRIDGE_HTTP_EXECUTOR_EXECUTION_MODE_INVALID');
    }
    const snapshot = repoDir ? beginJarvisRepoBoundVerificationV1(repoDir) : null;
    const trustedReviewMetadata = executionMode === 'review' && repoDir
      ? trustedRepoReviewMetadataV1(repoDir)
      : null;
    const metadataBudget = Math.max(0, Math.min(2800, MAX_PROMPT_CHARS - prompt.length - 2));
    const trustedRepoMetadata = executionMode === 'review' && snapshot && metadataBudget >= 300
      ? clean([
          '[TRUSTED SERVER REPOSITORY METADATA - READ ONLY]',
          'Current branch: ' + (clean(snapshot.branch, 200) || '(unavailable)'),
          'Current HEAD commit: ' + (clean(snapshot.head, 80) || '(unavailable)'),
          'Porcelain status readable by host verifier: ' + (snapshot.porcelain_status_readable_before === true ? 'yes' : 'no'),
          'Local branch refs (short SHA, date):',
          ...((trustedReviewMetadata?.branches || []).slice(0, 16).map((line) => '- ' + clean(line, 220))),
          'Relevant commit history across local refs:',
          ...((trustedReviewMetadata?.relevant_commits || []).slice(0, 14).map((line) => '- ' + clean(line, 260))),
          'This metadata is collected by the trusted host verifier with read-only git commands before Claude runs. It does not authorize git, shell, writes, network access, or external actions.'
        ].join('\n'), metadataBudget)
      : '';
    const bridgePrompt = trustedRepoMetadata
      ? [trustedRepoMetadata, '', prompt].join('\n')
      : prompt;

    let response;
    try {
      response = await fetchImpl(`${baseUrl}/v1/run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Held only here, for this one call — never returned, logged, or
          // included in any thrown Error's message.
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: bridgePrompt,
          project,
          mode: executionMode,
          correlation_id: correlationId || undefined,
          request_id: requestId || undefined,
          native_session: true
        }),
        signal
      });
    } catch (error) {
      // fetch's own rejection message (network refused/DNS/abort) never
      // includes request headers, so this stays safe to include verbatim
      // (bounded) — but never build a NEW string that could accidentally
      // concatenate the token in from elsewhere.
      throw new Error('BRIDGE_HTTP_UNREACHABLE: ' + clean(error?.message || error, 200));
    }

    if (!response.ok) {
      let bodyPreview = '';
      try { bodyPreview = clean(await response.text(), 300); } catch { /* best effort */ }
      return {
        exit_code: 1,
        stdout: '',
        stderr: clean(`BRIDGE_HTTP_${response.status}: ${bodyPreview}`, 2000),
        verification: snapshot ? finishJarvisRepoBoundVerificationV1(snapshot) : null
      };
    }

    let body;
    try {
      body = await readBoundedJsonResponseV1(response, MAX_RESPONSE_BYTES);
    } catch (error) {
      return {
        exit_code: 1, stdout: '', stderr: 'BRIDGE_' + clean(error?.message || error, 100),
        verification: snapshot ? finishJarvisRepoBoundVerificationV1(snapshot) : null
      };
    }

    if (!body || typeof body !== 'object') {
      return {
        exit_code: 1, stdout: '', stderr: 'BRIDGE_RESPONSE_MALFORMED',
        verification: snapshot ? finishJarvisRepoBoundVerificationV1(snapshot) : null
      };
    }

    const safeReadOnlyEvidenceFallback = body.ok !== true
      && safeReadOnlyGitIndexEvidenceFallbackV1(body, executionMode);
    if (body.ok !== true && !safeReadOnlyEvidenceFallback) {
      // A completed-but-failed Bridge run: still real, bridge-computed
      // evidence — preserved, never discarded, even on failure.
      return {
        exit_code: Number.isInteger(body.exit_code) && body.exit_code !== 0 ? body.exit_code : 1,
        stdout: '',
        stderr: clean(body.stderr, 4000) || 'BRIDGE_EXECUTION_FAILED',
        verification: buildVerificationV1(body, snapshot, trustedReviewMetadata)
      };
    }

    const verification = buildVerificationV1(body, snapshot, trustedReviewMetadata);
    return {
      exit_code: Number.isInteger(body.exit_code) ? body.exit_code : 0,
      stdout: clean(JSON.stringify({ service: body.service, mode: body.mode, project: body.project }), 4000),
      stderr: clean(body.stderr, 4000),
      // With repo_dir configured, external_effect is this process's own
      // independent files_changed/branch_drift computation (the same rule
      // the local-CLI executor uses) — never inferred from Bridge's
      // self-reported evidence alone. Without repo_dir, it falls back to
      // treating Bridge's own git/filesystem evidence as non-empty —
      // unchanged prior behavior for a caller with no filesystem access.
      external_effect: safeReadOnlyEvidenceFallback
        ? false
        : snapshot
          ? (verification.files_changed.length > 0 && !verification.branch_drift)
          : (isNonEmptyEvidence(body.git_evidence) || isNonEmptyEvidence(body.filesystem_evidence)),
      verification
    };
  };
}

export function jarvisBridgeHttpExecutorManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-bridge-http-executor.v1',
    transport: 'PRIVATE_HTTP',
    endpoint: '/v1/run',
    verification_computed_by: 'CANONICAL_REPO_BOUND_VERIFICATION_WHEN_REPO_DIR_CONFIGURED_ELSE_BRIDGE_RAW_ONLY',
    canonical_verification_schema: 'aurentara.jarvis.repo-bound-verification.v1',
    syntax_check_mandatory_when_repo_dir_configured: true,
    shares_verification_computation_with_local_cli_executor: true,
    token_source: 'SERVER_SIDE_CONFIG_ONLY',
    token_ever_in_request_body: false,
    token_ever_in_prompt: false,
    token_ever_logged: false,
    bounded_request: true,
    bounded_response: true,
    local_cli_fallback: false,
    execution_modes: ['implement', 'review'],
    review_mode_read_only: true,
    review_git_index_permission_fallback_requires_unchanged_full_snapshot: true,
    review_trusted_branch_head_context_injected: true,
    review_trusted_branch_refs_context_injected: true,
    review_trusted_relevant_commit_context_injected: true,
    review_trusted_repository_metadata_attached_to_verification: true,
    review_trusted_metadata_prompt_budget_max_chars: 2800,
    owner_prompt_preserved_before_metadata_truncation: true,
    can_commit: false,
    can_push: false,
    can_merge: false,
    can_deploy: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
