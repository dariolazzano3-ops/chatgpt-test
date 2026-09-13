/* JARVIS — Bridge HTTP executor V1.

   The ONE adapter that lets the existing claude_bridge contract
   (claude-code-bridge-v1.js's executor seam) delegate real Claude Code
   execution to the EXISTING jarvis-claude Bridge service over its private
   HTTP interface (POST /v1/run), instead of spawning a local `claude` CLI
   process. This is a drop-in replacement for createChildProcessExecutorV1
   at exactly one call site — there is still exactly one implementation-
   worker path; this file never runs Claude itself.

   Bridge performs independent PRE/POST git + filesystem evidence and
   Claude tool auditing itself (its own /v1/run contract). This file NEVER
   recomputes or duplicates that verification — Bridge's own evidence is
   authoritative and is passed through into `verification` untouched, the
   same trust role branch-manager-v1.js/claude-code-repo-bound-executor-v1.js
   play for the local-CLI path, just computed by Bridge instead of by this
   process (it has direct access to the same shared repo checkout).

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

/** Normalizes Bridge's own POST /v1/run response body into the
 *  `verification` shape the rest of V2 (engineering-mission-acceptance-v1.js
 *  etc.) can read from. Deliberately passes git_evidence / filesystem_evidence
 *  / tool_audit through as opaque values — this file does not know or
 *  assume their internal shape beyond "present or not", so it never
 *  mis-parses a field it was only told the NAME of. */
function buildBridgeVerificationV1(body) {
  return {
    schema: 'aurentara.jarvis.bridge-http-verification.v1',
    bridge_service: clean(body?.service, 200) || null,
    bridge_version: body?.version ?? null,
    mode: clean(body?.mode, 40) || null,
    project: clean(body?.project, 200) || null,
    git_evidence: body?.git_evidence ?? null,
    filesystem_evidence: body?.filesystem_evidence ?? null,
    tool_audit: body?.tool_audit ?? null,
    at: new Date().toISOString()
  };
}

/** Builds a Node-only executor for claude-code-bridge-v1.js bound to a real,
 *  already-running Bridge HTTP service. `bridge_token` is held only in this
 *  closure and used solely as a per-call Authorization header value — it is
 *  never logged, never echoed into a returned stdout/stderr string, and
 *  never reaches the constructed `prompt`. Throws synchronously (fail fast)
 *  if url/token/project/fetch are not all provided — the caller
 *  (claude-code-bridge-http-runtime-binding-v1.js) is expected to catch this
 *  and report `bound: false`, never to retry with a guessed default. */
export function createJarvisBridgeHttpExecutorV1(config = {}) {
  const baseUrl = clean(config.bridge_url, 400).replace(/\/+$/, '');
  const token = typeof config.bridge_token === 'string' ? config.bridge_token : '';
  const project = clean(config.project, 200);
  const fetchImpl = typeof config.fetch_impl === 'function' ? config.fetch_impl : globalThis.fetch;

  if (!baseUrl) throw new Error('BRIDGE_HTTP_EXECUTOR_URL_REQUIRED');
  if (!token) throw new Error('BRIDGE_HTTP_EXECUTOR_TOKEN_REQUIRED');
  if (!project) throw new Error('BRIDGE_HTTP_EXECUTOR_PROJECT_REQUIRED');
  if (typeof fetchImpl !== 'function') throw new Error('BRIDGE_HTTP_EXECUTOR_FETCH_REQUIRED');

  return async ({ task, signal }) => {
    const prompt = clean(task, MAX_PROMPT_CHARS);

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
        body: JSON.stringify({ prompt, project, mode: 'implement' }),
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
        stderr: clean(`BRIDGE_HTTP_${response.status}: ${bodyPreview}`, 2000)
      };
    }

    let body;
    try {
      body = await readBoundedJsonResponseV1(response, MAX_RESPONSE_BYTES);
    } catch (error) {
      return { exit_code: 1, stdout: '', stderr: 'BRIDGE_' + clean(error?.message || error, 100) };
    }

    if (!body || typeof body !== 'object') {
      return { exit_code: 1, stdout: '', stderr: 'BRIDGE_RESPONSE_MALFORMED' };
    }

    if (body.ok !== true) {
      // A completed-but-failed Bridge run: still real, bridge-computed
      // evidence — preserved, never discarded, even on failure.
      return {
        exit_code: Number.isInteger(body.exit_code) && body.exit_code !== 0 ? body.exit_code : 1,
        stdout: '',
        stderr: clean(body.stderr, 4000) || 'BRIDGE_EXECUTION_FAILED',
        verification: buildBridgeVerificationV1(body)
      };
    }

    return {
      exit_code: Number.isInteger(body.exit_code) ? body.exit_code : 0,
      stdout: clean(JSON.stringify({ service: body.service, mode: body.mode, project: body.project }), 4000),
      stderr: clean(body.stderr, 4000),
      // Bridge is the trusted, independent evidence source here — an
      // external effect is only ever claimed when Bridge's own git/
      // filesystem evidence is genuinely non-empty, never inferred from
      // exit_code alone.
      external_effect: isNonEmptyEvidence(body.git_evidence) || isNonEmptyEvidence(body.filesystem_evidence),
      verification: buildBridgeVerificationV1(body)
    };
  };
}

export function jarvisBridgeHttpExecutorManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-bridge-http-executor.v1',
    transport: 'PRIVATE_HTTP',
    endpoint: '/v1/run',
    verification_computed_by: 'EXISTING_BRIDGE_SERVICE_NOT_DUPLICATED_HERE',
    token_source: 'SERVER_SIDE_CONFIG_ONLY',
    token_ever_in_request_body: false,
    token_ever_in_prompt: false,
    token_ever_logged: false,
    bounded_request: true,
    bounded_response: true,
    local_cli_fallback: false,
    can_commit: false,
    can_push: false,
    can_merge: false,
    can_deploy: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
