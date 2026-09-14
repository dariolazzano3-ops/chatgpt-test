/* JARVIS — Legacy Bridge HTTP evidence reverification V1.

   A NARROW, one-time compatibility bridge, not a permanent second
   evidence path: some missions were dispatched through the private
   Bridge HTTP executor before it computed canonical
   repo-bound-verification-v1.js evidence (commit 5d5569844a) and so
   persisted only the older `aurentara.jarvis.bridge-http-verification.v1`
   shape (git_evidence / filesystem_evidence / tool_audit — no
   branch / files_changed / syntax_check). This module lets such an
   ALREADY-PERSISTED mission still be independently reverified by trusted
   code before Independent Acceptance, instead of being permanently
   unacceptable — never by trusting the persisted evidence's claims on
   their own, and never by trusting anything the caller of Independent
   Acceptance asserts about the repo.

   Every NEW dispatch continues through the canonical path
   (claude-code-bridge-http-executor-v1.js / claude-code-repo-bound-
   executor-v1.js) completely unchanged — this module is only ever
   consulted as a fallback for an already-persisted LEGACY-shaped
   verification, and only when a trusted caller (never the acceptance
   request body) supplies real repo_dir/target_branch.

   What this DOES prove, right now, in trusted code, via real git:
     - the exact file set Bridge's own persisted evidence claims it
       changed, cross-checked between git_evidence and filesystem_evidence
       — any disagreement, or either being unparseable/empty, fails closed
       rather than guessing which one to trust;
     - the CURRENT repo is dirty in EXACTLY that file set — no fewer (the
       claimed work must still genuinely be present, uncommitted) and no
       more (no unrelated or accidental extra change leaks into
       acceptance);
     - the current branch is still the wave's own real, non-protected
       target branch;
     - every changed .js/.mjs file still passes a real `node --check`,
       right now — never a worker's or Bridge's self-report.

   If Bridge's persisted `git_evidence` additionally carries a `diff`
   (string, unified-diff-shaped) field, this module goes further: it
   computes the CURRENT working-tree diff of exactly the claimed files,
   right now, via real git, and requires it to match the persisted diff
   text exactly. This is what catches a later/manual edit that keeps a
   claimed file dirty (so the path-set check alone would miss it) but
   changes its actual content — the file is still "changed", just not
   changed the way the original evidence claims. Without a `diff` field
   in the legacy evidence (older/sparser Bridge responses), this
   content-level check is skipped and the guarantee narrows to exactly
   what the header above already states honestly: proven scope, not
   proven content. */

import { execFileSync } from 'node:child_process';
import {
  porcelainPathsV1,
  currentBranchOrNullV1,
  syntaxCheckFilesV1
} from './repo-bound-verification-v1.js';
import { JARVIS_REPO_BOUND_PROTECTED_BRANCHES } from './claude-code-repo-bound-executor-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
export const JARVIS_LEGACY_BRIDGE_HTTP_VERIFICATION_SCHEMA = 'aurentara.jarvis.bridge-http-verification.v1';

/** Real, right-now `git diff` of exactly these paths (working tree vs
 *  HEAD) — never the worker's or Bridge's own claim about what changed.
 *  Returns null (not a thrown error) if git itself fails, so the caller
 *  can fail closed rather than crash. */
function currentWorkingTreeDiffV1(repoDir, files) {
  if (!Array.isArray(files) || files.length === 0) return '';
  try {
    return execFileSync('git', ['diff', '--', ...files], { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }).toString('utf8').trim();
  } catch {
    return null;
  }
}

/** True only for the exact legacy shape this module exists to bridge —
 *  never for the canonical shape (that path is never touched by this
 *  file) and never for anything else. */
export function isLegacyBridgeHttpEvidenceV1(verification) {
  return Boolean(verification) && typeof verification === 'object'
    && verification.schema === JARVIS_LEGACY_BRIDGE_HTTP_VERIFICATION_SCHEMA;
}

/** Best-effort array extraction — the SAME shape-tolerance
 *  astra-post-review-v1.js already uses for these same fields, since
 *  Bridge's evidence has no internally-specified schema beyond field
 *  names. Returns `{ ok: false }` (never a guessed array) for anything it
 *  cannot confidently read as a list of paths. */
function extractClaimedFilesV1(evidenceField) {
  if (Array.isArray(evidenceField)) return { ok: true, files: evidenceField.map((f) => clean(f, 400)).filter(Boolean) };
  if (evidenceField && Array.isArray(evidenceField.files_changed)) return { ok: true, files: evidenceField.files_changed.map((f) => clean(f, 400)).filter(Boolean) };
  if (evidenceField && Array.isArray(evidenceField.changed)) return { ok: true, files: evidenceField.changed.map((f) => clean(f, 400)).filter(Boolean) };
  return { ok: false, files: [] };
}

function normalizedSortedV1(files) {
  return [...new Set(files)].sort();
}

function sameSetV1(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** The one entry point. Returns `{ sufficient: false, reason }` on any
 *  fail-closed condition, or `{ sufficient: true, verification }` with a
 *  freshly-constructed CANONICAL aurentara.jarvis.repo-bound-verification.v1
 *  object once every check above has genuinely passed. `repo_dir` and
 *  `target_branch` must come from a trusted caller (server-side
 *  dependency injection) — this function does not know or care where its
 *  caller got them from, but never reads them from `verification` itself
 *  (the persisted, worker-adjacent evidence is never trusted for its own
 *  scope boundaries). */
export function reverifyLegacyBridgeHttpEvidenceV1({ verification, repo_dir, target_branch } = {}) {
  if (!isLegacyBridgeHttpEvidenceV1(verification)) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_NOT_APPLICABLE' };
  }
  const repoDir = clean(repo_dir, 400);
  const expectedBranch = clean(target_branch, 200);
  if (!repoDir || !expectedBranch) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_TRUSTED_REPO_SCOPE_REQUIRED' };
  }

  // 1-2. The immutable claimed mission scope, cross-checked between the
  // two independent evidence fields Bridge itself persisted. Disagreement
  // or ambiguity fails closed — never guessed, never merged optimistically.
  const gitClaim = extractClaimedFilesV1(verification.git_evidence);
  const fsClaim = extractClaimedFilesV1(verification.filesystem_evidence);
  if (!gitClaim.ok || !fsClaim.ok) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_AMBIGUOUS_CHANGED_FILE_EVIDENCE' };
  }
  const claimedGit = normalizedSortedV1(gitClaim.files);
  const claimedFs = normalizedSortedV1(fsClaim.files);
  if (claimedGit.length === 0 || !sameSetV1(claimedGit, claimedFs)) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_EVIDENCE_DISAGREEMENT', git_claim: claimedGit, filesystem_claim: claimedFs };
  }
  const claimedFiles = claimedGit;

  // 7. Branch must be the real, current, non-protected target — read
  // fresh via git, never cached or assumed.
  const branchNow = currentBranchOrNullV1(repoDir);
  if (!branchNow || JARVIS_REPO_BOUND_PROTECTED_BRANCHES.includes(branchNow.toLowerCase())) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_PROTECTED_OR_MISSING_BRANCH' };
  }
  if (branchNow !== expectedBranch) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_BRANCH_MISMATCH', expected_branch: expectedBranch, actual_branch: branchNow };
  }

  // 3-4. Read the real current repo directly, fresh, via trusted git —
  // never the worker's or Bridge's own claim about what is dirty now.
  const dirtyNow = porcelainPathsV1(repoDir);
  if (dirtyNow === null) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_REPO_UNAVAILABLE' };
  }
  const dirtyNowSet = normalizedSortedV1(dirtyNow);

  // 5. Exact-set comparison: the claimed work must still genuinely be
  // present (nothing missing) and nothing unrelated may have joined it
  // (nothing extra) — the strongest scope check available given Bridge's
  // legacy evidence carries no content fingerprint to diff against (see
  // file header for what this does and does not prove).
  if (!sameSetV1(dirtyNowSet, claimedFiles)) {
    const hasUnexpectedExtra = dirtyNowSet.some((f) => !claimedFiles.includes(f));
    return {
      sufficient: false,
      reason: hasUnexpectedExtra ? 'LEGACY_REVERIFY_UNEXPECTED_DIRTY_FILES' : 'LEGACY_REVERIFY_DIFF_MISMATCH',
      expected_files: claimedFiles,
      actual_dirty_files: dirtyNowSet
    };
  }

  // 5 (continued). When the legacy evidence additionally carries a
  // unified-diff-shaped `git_evidence.diff` string, go further than the
  // path-set check above: a later/manual edit that keeps a claimed file
  // dirty but changes its actual content must still be caught. The
  // CURRENT working-tree diff of exactly the claimed files, computed
  // fresh via real git, must match the persisted diff text exactly.
  const persistedDiff = typeof verification.git_evidence?.diff === 'string' ? verification.git_evidence.diff.trim() : null;
  if (persistedDiff !== null) {
    const currentDiff = currentWorkingTreeDiffV1(repoDir, claimedFiles);
    if (currentDiff === null) {
      return { sufficient: false, reason: 'LEGACY_REVERIFY_REPO_UNAVAILABLE' };
    }
    if (currentDiff !== persistedDiff) {
      return { sufficient: false, reason: 'LEGACY_REVERIFY_DIFF_MISMATCH' };
    }
  }

  // 6. Mandatory, real, right-now syntax check — never bypassed, never a
  // worker/Bridge self-report.
  const syntaxCheck = syntaxCheckFilesV1(repoDir, claimedFiles);
  if (!syntaxCheck.passed) {
    return { sufficient: false, reason: 'LEGACY_REVERIFY_SYNTAX_CHECK_FAILED', syntax_check: syntaxCheck };
  }

  // 8. The canonical object, constructed only now that every check above
  // has genuinely passed.
  return {
    sufficient: true,
    reason: null,
    verification: {
      schema: 'aurentara.jarvis.repo-bound-verification.v1',
      repo_dir: repoDir,
      branch: branchNow,
      branch_drift: false,
      files_changed: claimedFiles,
      pre_existing_dirty_files: [], // reverification has no "before this run" snapshot to report — never fabricated
      syntax_check: syntaxCheck,
      at: new Date().toISOString(),
      reverified_from_legacy_evidence: true,
      legacy_evidence: {
        bridge_service: verification.bridge_service ?? null,
        bridge_version: verification.bridge_version ?? null,
        mode: verification.mode ?? null,
        project: verification.project ?? null,
        git_evidence: verification.git_evidence ?? null,
        filesystem_evidence: verification.filesystem_evidence ?? null,
        tool_audit: verification.tool_audit ?? null
      }
    }
  };
}

export function jarvisLegacyBridgeEvidenceReverificationManifestV1() {
  return {
    schema: 'aurentara.jarvis.legacy-bridge-evidence-reverification.v1',
    applies_only_to_legacy_bridge_http_shape: true,
    canonical_path_untouched: true,
    trusts_worker_self_report: false,
    trusts_request_supplied_repo_scope: false,
    repo_scope_source: 'TRUSTED_DEPENDENCY_INJECTION_ONLY',
    content_diff_check_when_evidence_provides_diff_text: true,
    proves_exact_scope_always_content_only_when_diff_text_available: true,
    syntax_check_mandatory: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
