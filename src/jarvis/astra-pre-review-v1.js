/* JARVIS — Astra PRE Review V1.

   The smallest real PRE-dispatch reasoning gate: given one proposed
   mission request, Astra PRE frames it into GOAL / TASK /
   ACCEPTANCE_CRITERIA / SAFETY_BOUNDARY and decides APPROVE / REJECT
   before any Claude implementation may begin. It does NOT decide wave
   sequencing, dependency satisfaction, dispatch timing, or branch
   preparation — those remain exactly the Program Controller's job
   (program-controller-v1.js) and are never duplicated here. Astra PRE
   only ever evaluates the CONTENT of one proposed mission, once, before
   it is handed to the controller as an operator-supplied task (the same
   "operator task always wins over the registry" seam
   wave-task-planner-v1.js already established — this is just a new,
   reviewable SOURCE for that task text, not a new dispatch path).

   Honesty note: this is deterministic, pure, reviewable code — not a live
   call to a separate "Astra" reasoning service. No such service interface
   was ever discovered to exist on the VPS (see the Bridge V5 discovery
   history); claiming to call one that isn't real would be exactly the
   kind of fabricated capability this project's own contract refuses
   elsewhere (http-v1.js / command-center-read-bindings-v1.js's "never
   fabricate" rule). "Reasoning" here means: a fixed, reviewable
   safety-boundary check (the same constitution already in
   docs/jarvis/v2/JARVIS_MASTERARCHITECTURE_V2_CONTRACT.md §10) plus
   mechanical framing of the request into the four required fields. */

const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);
const PROTECTED_BRANCHES = ['main', 'master'];
const DEPLOY_INTENT = /\bdeploy(s|ed|ing|ment)?\b/i;
const PRIVATE_DEPLOY_QUALIFIER = /\b(private|internal|internally|staging|preview)\b/i;
const PUBLIC_DEPLOY_QUALIFIER = /\b(public|publicly|production|prod)\b/i;
const PUBLIC_ACCESS_DISABLED = /\bpublic\s+access\s+(disabled|off|false|blocked|denied)\b/i;

// Mirrors the V2 safety constitution (contract §10) — a request whose own
// text asks for one of these is rejected before it ever reaches a worker.
const FORBIDDEN_INTENT_PATTERNS = [
  { pattern: /\bmerg(e|ed|ing)\b/i, reason: 'NO_MERGE' },
  { pattern: /\b(main|master)\s*branch\b|\bto\s+(main|master)\b/i, reason: 'NO_MAIN_MASTER' },
  { pattern: /\bproduction\b/i, reason: 'NO_PRODUCTION_ACTIVATION' },
  { pattern: /\bdns\b/i, reason: 'NO_DNS_CHANGES' },
  { pattern: /\bbilling\b|\bpayment\b/i, reason: 'NO_BILLING_CHANGES' },
  { pattern: /\bpassword\b|\bapi[- ]?key\b|\bsecret\s+(value|content|token)\b/i, reason: 'NO_SECRET_OUTPUT' },
  { pattern: /\bhamyren\b/i, reason: 'NO_HAMYREN_DATA_FLOW' },
  { pattern: /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i, reason: 'NO_DESTRUCTIVE_DB' },
  { pattern: /--force\b|force[- ]?push/i, reason: 'NO_FORCE_PUSH' },
  { pattern: /\bpublic(ly)?\s+release\b|\bpublish\b/i, reason: 'NO_PUBLIC_RELEASE' }
];

/** Pure. `expected_files`, if the caller already knows a fixed scope
 *  (e.g. a registry-bootstrapped wave), pins acceptance to exactly that
 *  set; otherwise files_within_scope stays null and Astra POST falls back
 *  to structural checks only (no fabricated scope). */
export function reviewJarvisAstraPreV1({
  title, request_text, program, repo_dir, target_branch, expected_files
} = {}) {
  const requestText = clean(request_text, 8000);
  const titleText = clean(title, 300);
  if (!requestText || !titleText) {
    return { ok: false, decision: 'REJECT', reason: 'ASTRA_PRE_MISSION_TEXT_REQUIRED' };
  }
  if (!clean(program, 80) || !clean(repo_dir, 400) || !clean(target_branch, 200)) {
    return { ok: false, decision: 'REJECT', reason: 'ASTRA_PRE_PROGRAM_SCOPE_REQUIRED' };
  }
  if (PROTECTED_BRANCHES.includes(String(target_branch).toLowerCase())) {
    return { ok: false, decision: 'REJECT', reason: 'ASTRA_PRE_PROTECTED_BRANCH_REFUSED' };
  }

  const combinedText = `${titleText}\n${requestText}`;
  if (DEPLOY_INTENT.test(combinedText)) {
    if (PUBLIC_DEPLOY_QUALIFIER.test(combinedText) && !PUBLIC_ACCESS_DISABLED.test(combinedText)) {
      return { ok: false, decision: 'REJECT', reason: 'ASTRA_PRE_FORBIDDEN_INTENT:NO_PUBLIC_OR_PRODUCTION_DEPLOY' };
    }
    if (!PRIVATE_DEPLOY_QUALIFIER.test(combinedText)) {
      return { ok: false, decision: 'REJECT', reason: 'ASTRA_PRE_DEPLOY_TARGET_MUST_BE_EXPLICITLY_PRIVATE' };
    }
  }

  for (const { pattern, reason } of FORBIDDEN_INTENT_PATTERNS) {
    if (pattern.test(requestText) || pattern.test(titleText)) {
      return { ok: false, decision: 'REJECT', reason: `ASTRA_PRE_FORBIDDEN_INTENT:${reason}` };
    }
  }

  return {
    ok: true,
    decision: 'APPROVE',
    reason: null,
    goal: titleText,
    task: requestText,
    acceptance_criteria: {
      exit_code_zero: true,
      real_change_required: true, // Bridge's own evidence must show a genuine change, never inferred
      files_within_scope: Array.isArray(expected_files) && expected_files.length ? [...expected_files] : null,
      no_forbidden_effect: true,
      allowed_tools_only: ['Read', 'Glob', 'Grep', 'Edit', 'Write']
    },
    safety_boundary: {
      program: clean(program, 80).toUpperCase(),
      repo_dir: clean(repo_dir, 400),
      target_branch: clean(target_branch, 200),
      protected_branches_refused: [...PROTECTED_BRANCHES],
      network_access_by_worker: false,
      commit_by_worker: false,
      push_by_worker: false,
      merge_by_worker: false
    }
  };
}

export function jarvisAstraPreManifestV1() {
  return {
    schema: 'aurentara.jarvis.astra-pre-review.v1',
    reasoning_mode: 'DETERMINISTIC_CODE_NOT_LIVE_MODEL_CALL',
    duplicates_program_controller: false,
    decides_wave_sequencing: false,
    decides_dispatch_timing: false,
    fabricates_capability: false,
    decisions: ['APPROVE', 'REJECT'],
    production_deploy: false,
    hamyren_data_flow: false
  };
}
