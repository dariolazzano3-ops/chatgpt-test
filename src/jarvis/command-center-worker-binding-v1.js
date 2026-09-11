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

export function jarvisCommandCenterWorkerChainV1(options = {}) {
  // A genuine bridge is bound only when an executor was injected AND
  // command-center-worker-binding was told about it. Config/registry presence
  // is never enough.
  const claudeBridgeBound = options.claude_bridge && options.claude_bridge.bound === true;
  const gitRemoteTruthBound = options.git_remote_truth_bound === true;
  const codexBound = options.codex_bridge && options.codex_bridge.bound === true;

  const nodes = NODES.map((n) => {
    if (n.node === 'CLAUDE_CODE' && claudeBridgeBound) {
      return { ...n, bound: true, reason: null, evidence: 'src/jarvis/claude-code-bridge-v1.js executor injected' };
    }
    if (n.node === 'CODEX' && codexBound) {
      return { ...n, bound: true, reason: 'FALLBACK_BOUND_INACTIVE' };
    }
    if (n.node === 'GIT' && gitRemoteTruthBound) {
      return { ...n, bound: true, reason: null, evidence: 'src/jarvis/git-remote-truth-v1.js read-only remote-head resolver injected' };
    }
    return { ...n };
  });

  return {
    schema: 'aurentara.jarvis.command-center.worker-chain.v1',
    primary_worker: 'CLAUDE_CODE',
    fallback_worker: 'CODEX',
    fallback_active: false,
    claude_execution_bridge_bound: Boolean(claudeBridgeBound),
    claude_execution_bridge_contract: 'aurentara.jarvis.claude-code-bridge.v1',
    codex_binding_present: Boolean(codexBound),
    git_remote_truth_bound: Boolean(gitRemoteTruthBound),
    implementation_commands_fail_closed: true,
    worker_output_self_accepts: false,
    nodes,
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
  const claudeBridgeBound = input.claude_bridge && input.claude_bridge.bound === true;
  const codexBound = input.codex_bridge && input.codex_bridge.bound === true;

  if (blocked) {
    return { worker: null, executable: false, reason: 'BLOCKED_BY_POLICY' };
  }
  // The only genuinely executable connector path today is read-only calendar.
  if (action === 'READ_CALENDAR') {
    return { worker: 'JARVIS_CONNECTOR', executable: true, reason: null };
  }
  if (['READ_PERSONAL_CONTEXT', 'READ_PERSONAL_MEMORY', 'SEARCH_FILES', 'RESEARCH_WEB'].includes(action)) {
    return { worker: 'JARVIS_RUNTIME', executable: true, reason: 'LOCAL_READ_ONLY' };
  }
  if (approvalRequired) {
    // Approval first; only then may the Claude Code bridge run (if bound).
    return {
      worker: 'CLAUDE_CODE',
      executable: false,
      reason: claudeBridgeBound
        ? 'AWAITING_APPROVAL_THEN_CLAUDE_CODE'
        : 'AWAITING_APPROVAL_THEN_CLAUDE_CODE_BRIDGE_REQUIRED'
    };
  }
  // Implementation work: Claude Code is primary.
  if (claudeBridgeBound) {
    return { worker: 'CLAUDE_CODE', executable: true, reason: 'CLAUDE_CODE_BRIDGE_BOUND' };
  }
  // Codex is a fallback ONLY when Claude is genuinely unavailable and a real
  // Codex binding exists and policy permits it. Never by default.
  if (codexBound && input.claude_unavailable === true && input.codex_fallback_permitted === true) {
    return { worker: 'CODEX', executable: true, reason: 'CLAUDE_UNAVAILABLE_CODEX_FALLBACK' };
  }
  return { worker: 'CLAUDE_CODE', executable: false, reason: 'CLAUDE_CODE_EXECUTION_BRIDGE_NOT_BOUND' };
}
