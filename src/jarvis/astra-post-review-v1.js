/* JARVIS — Astra POST Review V1.

   The smallest real POST-execution reasoning gate: given the Astra PRE
   frame's acceptance_criteria / safety_boundary and Bridge's OWN,
   independently-computed evidence (git_evidence / filesystem_evidence /
   tool_audit / exit_code / external_effect — see
   claude-code-bridge-http-executor-v1.js's `verification`), Astra POST
   decides exactly one of PASS / REPAIR / BLOCK.

   This NEVER recomputes or duplicates Bridge's evidence — Bridge's
   evidence is the only source of truth about what actually happened
   (same authoritative role established in
   claude-code-bridge-http-executor-v1.js's header). Astra POST only
   evaluates whether that evidence satisfies the mission's own stated
   acceptance criteria and stays inside its safety boundary. Same
   "deterministic code, not a simulated model call" honesty as
   astra-pre-review-v1.js — see that file's header for why.

   A worker's own exit code / self-report is never trusted on its own —
   only Bridge-computed evidence fields are read here. */

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const FORBIDDEN_TOOL_NAMES = ['Bash', 'WebFetch', 'WebSearch', 'NotebookEdit'];

function toolsUsed(toolAudit) {
  if (!Array.isArray(toolAudit)) return [];
  return toolAudit.map((entry) => clean(entry?.tool, 80)).filter(Boolean);
}

/** Best-effort extraction of changed file paths from Bridge's evidence.
 *  Bridge's exact filesystem_evidence/git_evidence internal shape was
 *  never fully specified beyond field names (see
 *  claude-code-bridge-http-executor-v1.js's own header) — this checks the
 *  shapes that are plausible from those names and returns [] rather than
 *  guessing further, so an unrecognized shape fails a files_within_scope
 *  check closed (no files "in scope") rather than silently passing it. */
function filesChangedFromEvidenceV1(verification) {
  const fsEv = verification?.filesystem_evidence;
  if (Array.isArray(fsEv)) return fsEv;
  if (fsEv && Array.isArray(fsEv.files_changed)) return fsEv.files_changed;
  if (fsEv && Array.isArray(fsEv.changed)) return fsEv.changed;
  const gitEv = verification?.git_evidence;
  if (Array.isArray(gitEv)) return gitEv;
  if (gitEv && Array.isArray(gitEv.files_changed)) return gitEv.files_changed;
  return [];
}

export function reviewJarvisAstraPostV1({
  acceptance_criteria, safety_boundary, exit_code, external_effect, verification
} = {}) {
  if (!acceptance_criteria || !safety_boundary) {
    return { decision: 'BLOCK', reason: 'ASTRA_POST_MISSION_FRAME_REQUIRED', acceptance_criteria: null, evidence: null };
  }
  if (!verification || typeof verification !== 'object') {
    return { decision: 'BLOCK', reason: 'ASTRA_POST_NO_BRIDGE_EVIDENCE', acceptance_criteria, evidence: null };
  }

  const usedTools = toolsUsed(verification.tool_audit);
  const allowed = Array.isArray(acceptance_criteria.allowed_tools_only) ? acceptance_criteria.allowed_tools_only : [];
  const disallowedUsed = usedTools.filter((tool) => !allowed.includes(tool) || FORBIDDEN_TOOL_NAMES.includes(tool));
  if (disallowedUsed.length) {
    return {
      decision: 'BLOCK', reason: 'ASTRA_POST_DISALLOWED_TOOL_USED',
      acceptance_criteria, evidence: verification, disallowed_tools: disallowedUsed
    };
  }

  const evidenceBranch = clean(verification.branch, 200).toLowerCase();
  if (evidenceBranch && safety_boundary.protected_branches_refused?.includes(evidenceBranch)) {
    return { decision: 'BLOCK', reason: 'ASTRA_POST_PROTECTED_BRANCH_EVIDENCE', acceptance_criteria, evidence: verification };
  }
  const expectedBranch = clean(safety_boundary.target_branch, 200).toLowerCase();
  if (evidenceBranch && expectedBranch && evidenceBranch !== expectedBranch) {
    return { decision: 'BLOCK', reason: 'ASTRA_POST_BRANCH_MISMATCH', acceptance_criteria, evidence: verification };
  }

  if (acceptance_criteria.exit_code_zero && exit_code !== 0) {
    return { decision: 'REPAIR', reason: 'ASTRA_POST_NONZERO_EXIT_CODE', acceptance_criteria, evidence: verification, exit_code };
  }

  if (acceptance_criteria.real_change_required && external_effect !== true) {
    return { decision: 'REPAIR', reason: 'ASTRA_POST_NO_REAL_CHANGE_EVIDENCE', acceptance_criteria, evidence: verification };
  }

  if (Array.isArray(acceptance_criteria.files_within_scope) && acceptance_criteria.files_within_scope.length) {
    const changedFiles = filesChangedFromEvidenceV1(verification);
    const outOfScope = changedFiles.filter((file) => !acceptance_criteria.files_within_scope.includes(file));
    if (outOfScope.length) {
      return {
        decision: 'BLOCK', reason: 'ASTRA_POST_FILES_OUT_OF_SCOPE',
        acceptance_criteria, evidence: verification, out_of_scope_files: outOfScope
      };
    }
  }

  return { decision: 'PASS', reason: null, acceptance_criteria, evidence: verification };
}

export function jarvisAstraPostManifestV1() {
  return {
    schema: 'aurentara.jarvis.astra-post-review.v1',
    reasoning_mode: 'DETERMINISTIC_CODE_NOT_LIVE_MODEL_CALL',
    duplicates_bridge_evidence_computation: false,
    trusts_worker_self_report: false,
    decisions: ['PASS', 'REPAIR', 'BLOCK'],
    production_deploy: false,
    hamyren_data_flow: false
  };
}
