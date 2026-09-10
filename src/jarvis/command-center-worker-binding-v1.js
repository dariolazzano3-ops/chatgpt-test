/* JARVIS Command Center — worker / execution-chain binding truth (Wave 6).

   The intended operational chain is:
     Operator → JARVIS/Hermes → Astra reasoning+control → Claude Code (primary
     implementation worker) → Codex (true-unavailable fallback only) → Bridge
     (security + evidence) → Git/GitHub truth → independent verification.

   This module reports which links are GENUINELY bound in the current repo, and
   never claims a link is live when it is not. Nothing here executes anything. */

const NODES = Object.freeze([
  {
    node: 'HERMES',
    role: 'Orchestrierung / Intake',
    // Intent resolution + action planning run locally in src/jarvis/service-v1.js.
    bound: 'LOCAL_ONLY',
    evidence: 'src/jarvis/intent-v1.js + src/jarvis/planner-v1.js',
    reason: 'Local intake/routing only; no external Hermes process is probed.'
  },
  {
    node: 'ASTRA',
    role: 'Reasoning & Kontrolle',
    bound: 'LOCAL_ONLY',
    evidence: 'src/jarvis/context-v1.js + src/jarvis/action-gate-v1.js',
    reason: 'Local context assembly and policy gating only; no external Astra service is probed.'
  },
  {
    node: 'CLAUDE_CODE',
    role: 'Primäre Umsetzung',
    bound: false,
    evidence: 'src/jarvis/integration-layer-v1.js registers claude_code.* as policy only',
    reason: 'NO_EXECUTION_BRIDGE: no Claude Code execution adapter and no Anthropic credential are wired to the JARVIS runtime. Implementation commands fail closed to prepare-only / approval-gated; nothing is executed or faked.'
  },
  {
    node: 'CODEX',
    role: 'Fallback (nur bei echter Nichtverfügbarkeit)',
    bound: false,
    evidence: null,
    reason: 'FALLBACK_INACTIVE: no real Codex binding exists and fallback is not activated. Codex is never used by default.'
  },
  {
    node: 'BRIDGE',
    role: 'Sicherheit & Evidence',
    // The action gate genuinely runs on every command and blocks financial /
    // critical / unauthorised-external actions.
    bound: true,
    evidence: 'src/jarvis/action-gate-v1.js + src/jarvis/result-v1.js enforced on every command',
    reason: null
  },
  {
    node: 'GIT',
    role: 'Truth Layer',
    bound: 'ADAPTER_REQUIRED',
    evidence: 'src/source-of-truth.js deriveRemoteGitStatus (needs an injected genuine remote-head reader)',
    reason: 'Full-SHA remote-truth validation exists but no live project-head resolver is injected in this runtime.'
  },
  {
    node: 'VERIFICATION',
    role: 'Unabhängige Abnahme',
    bound: false,
    evidence: 'command-center-read-bindings-v1.js only marks independent_acceptance when a distinct acceptance/bridge/review ref is persisted',
    reason: 'No independent acceptance service is wired; worker self-report is never treated as acceptance.'
  }
]);

export function jarvisCommandCenterWorkerChainV1() {
  return {
    schema: 'aurentara.jarvis.command-center.worker-chain.v1',
    primary_worker: 'CLAUDE_CODE',
    fallback_worker: 'CODEX',
    fallback_active: false,
    claude_execution_bridge_bound: false,
    codex_binding_present: false,
    implementation_commands_fail_closed: true,
    worker_output_self_accepts: false,
    nodes: NODES.map((n) => ({ ...n })),
    production_deploy: false,
    hamyren_data_flow: false
  };
}

/** Decide which worker (if any) a resolved command would route to, and whether it
 *  can actually execute. Fail-closed: an implementation-needing command with no
 *  bound worker returns executable:false and never runs. */
export function resolveJarvisCommandWorkerV1(input = {}) {
  const action = String(input.action || '').toUpperCase();
  const approvalRequired = input.approval_required === true;
  const blocked = input.blocked === true;

  if (blocked) {
    return { worker: null, executable: false, reason: 'BLOCKED_BY_POLICY' };
  }
  // The only genuinely executable path today is the read-only calendar connector.
  if (action === 'READ_CALENDAR') {
    return { worker: 'JARVIS_CONNECTOR', executable: true, reason: null };
  }
  if (['READ_PERSONAL_CONTEXT', 'READ_PERSONAL_MEMORY', 'SEARCH_FILES', 'RESEARCH_WEB'].includes(action)) {
    return { worker: 'JARVIS_RUNTIME', executable: true, reason: 'LOCAL_READ_ONLY' };
  }
  if (approvalRequired) {
    return { worker: 'CLAUDE_CODE', executable: false, reason: 'AWAITING_APPROVAL_THEN_CLAUDE_CODE_BRIDGE_REQUIRED' };
  }
  // Anything else that would need real implementation: Claude Code is primary,
  // but the bridge is not bound -> not executable.
  return { worker: 'CLAUDE_CODE', executable: false, reason: 'CLAUDE_CODE_EXECUTION_BRIDGE_NOT_BOUND' };
}
