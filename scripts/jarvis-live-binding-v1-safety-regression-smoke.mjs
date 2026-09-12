import assert from 'node:assert/strict';
import fs from 'node:fs';
import { jarvisClaudeCodeBridgeContractV1, createJarvisClaudeCodeBridgeV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { jarvisGitRemoteTruthManifestV1 } from '../src/jarvis/git-remote-truth-v1.js';
import { jarvisSystemHealthProbesManifestV1 } from '../src/jarvis/system-health-probes-v1.js';
import { jarvisCommandCenterApprovalRuntimeManifestV1, evaluateJarvisApprovalDecisionV1 } from '../src/jarvis/command-center-approval-runtime-v1.js';
import { jarvisCommandCenterWorkerChainV1 } from '../src/jarvis/command-center-worker-binding-v1.js';
import { jarvisHttpManifestV1 } from '../src/jarvis/http-v1.js';

/* Deterministic safety regression for the Live Binding V1 additions. No network,
   no git, no database — pure static/manifest checks so this runs the same in CI
   as it does here. */

// ── every new manifest declares no production/deploy/billing/dns/hamyren action ──
const contract = jarvisClaudeCodeBridgeContractV1(createJarvisClaudeCodeBridgeV1({}));
assert.equal(contract.production_deploy, false);
assert.equal(contract.hamyren_data_flow, false);
assert.equal(contract.external_writes, false);
assert.equal(contract.credentials_touched, false);
assert.equal(contract.production_execution, false);
assert.equal(contract.protected_branch_execution, false);

const gitMan = jarvisGitRemoteTruthManifestV1();
assert.equal(gitMan.read_only, true);
assert.equal(gitMan.write_operations, 0);
assert.equal(gitMan.production_deploy, false);
assert.equal(gitMan.hamyren_data_flow, false);
assert.equal(gitMan.token_returned_or_logged, false);

const healthMan = jarvisSystemHealthProbesManifestV1();
assert.equal(healthMan.read_only, true);
assert.equal(healthMan.production_deploy, false);
assert.equal(healthMan.hamyren_data_flow, false);
assert.equal(healthMan.config_presence_implies_liveness, false);

const apprMan = jarvisCommandCenterApprovalRuntimeManifestV1();
assert.equal(apprMan.approving_bypasses_action_gate, false);
assert.equal(apprMan.external_effect_on_decision, false);
assert.equal(apprMan.worker_output_counts_as_acceptance, false);
assert.equal(apprMan.projected_approval_can_self_approve, false);
assert.equal(apprMan.production_deploy, false);
assert.equal(apprMan.hamyren_data_flow, false);

const chain = jarvisCommandCenterWorkerChainV1();
assert.equal(chain.production_deploy, false);
assert.equal(chain.hamyren_data_flow, false);
assert.equal(chain.worker_output_self_accepts, false);
// default (no bridge injected) must stay unbound
assert.equal(chain.claude_execution_bridge_bound, false);
assert.equal(chain.codex_binding_present, false);
assert.equal(chain.git_remote_truth_bound, false);

const httpMan = jarvisHttpManifestV1();
assert.equal(httpMan.production_deploy, false);
assert.equal(httpMan.hamyren_data_flow, false);
assert.equal(httpMan.calendar_write_enabled, false);
assert.equal(httpMan.external_writes_enabled, false);
assert.equal(httpMan.command_center_approval_decide_bypasses_gate, false);
assert.equal(httpMan.command_center_approval_decide_external_effect, false);
assert.equal(httpMan.command_center_command_external_writes, false);

// ── an approval decision, evaluated directly, can never carry an external effect
//    or authorize execution regardless of the decision value ──
for (const decision of ['approve', 'reject', 'defer']) {
  const r = evaluateJarvisApprovalDecisionV1({
    approvals: [{ approval_id: 'x:approval', run_id: 'x', state: 'PENDING' }],
    approval_id: 'x:approval', run_id: 'x', decision, owner_ref: 'jarvis:operator:op@example.invalid'
  });
  assert.equal(r.execution_authorized, false, `${decision} must not authorize execution`);
  assert.equal(r.external_effect, false, `${decision} must not set external_effect`);
  assert.equal(r.executed, false, `${decision} must not mark executed`);
}

// ── the live-binding sources contain no write/destructive/deploy verbs ──
const LIVE_BINDING_FILES = [
  'src/jarvis/claude-code-bridge-v1.js',
  'src/jarvis/git-remote-truth-v1.js',
  'src/jarvis/system-health-probes-v1.js',
  'src/jarvis/command-center-approval-runtime-v1.js',
  'src/jarvis/command-center-worker-binding-v1.js',
  'src/jarvis/claude-code-local-cli-executor-v1.js',
  'src/jarvis/claude-code-local-runtime-binding-v1.js',
  'src/jarvis/claude-code-repo-bound-executor-v1.js',
  'src/jarvis/claude-code-repo-bound-runtime-binding-v1.js',
  'src/jarvis/engineering-mission-v1.js',
  'src/jarvis/engineering-mission-resume-v1.js',
  'src/jarvis/engineering-mission-acceptance-v1.js',
  'src/jarvis/branch-manager-v1.js',
  'src/jarvis/program-approval-v1.js',
  'src/jarvis/program-controller-v1.js',
  'src/jarvis/runtime-v1.js',
  'src/jarvis/http-v1.js'
];
const FORBIDDEN_PATTERNS = [
  /wrangler\s+deploy/i, /\bDROP\s+TABLE/i, /\bTRUNCATE\b/i, /\brm\s+-rf\b/i,
  /dns_records/i, /\/billing\//i, /\bgit\s+push\b/i, /\bgit\s+merge\b/i,
  /method:\s*['"]POST['"][^}]*\/git\/refs/i, // ref creation would be a write
  /\bPUT\b.*\/contents\//i, // GitHub content write endpoint
  /docker\.sock/i
];
for (const file of LIVE_BINDING_FILES) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    assert.doesNotMatch(text, pattern, `${file} must not contain forbidden pattern ${pattern}`);
  }
}

// ── git remote truth resolver issues GET only (grep the source, not a live call) ──
const gitSrc = fs.readFileSync('src/jarvis/git-remote-truth-v1.js', 'utf8');
const methodMatches = [...gitSrc.matchAll(/method:\s*['"]([A-Z]+)['"]/g)].map((m) => m[1]);
assert.ok(methodMatches.length > 0, 'resolver specifies an explicit HTTP method');
assert.ok(methodMatches.every((m) => m === 'GET'), `git-remote-truth must only ever GET, found: ${methodMatches.join(',')}`);

// ── health probes issue GET only ──
const healthSrc = fs.readFileSync('src/jarvis/system-health-probes-v1.js', 'utf8');
const healthMethods = [...healthSrc.matchAll(/method:\s*['"]([A-Z]+)['"]/g)].map((m) => m[1]);
assert.ok(healthMethods.every((m) => m === 'GET'), 'system-health-probes must only ever GET');

// ── no secret material committed in the new modules ──
for (const file of LIVE_BINDING_FILES) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /sk-[A-Za-z0-9]{16}|gh[pous]_[A-Za-z0-9]{20}|-----BEGIN [A-Z ]*PRIVATE KEY/, `${file} must not contain secret-shaped literals`);
}

// ── the Node-only local Claude Code binding files are never imported by any
//    module that gets bundled into the deployed Cloudflare Worker — the
//    "local worker binding boundary" from Phase 1 of the runtime-integration
//    run. No config = Claude stays NOT_BOUND there, structurally, not just
//    by convention. ──
const DEPLOYED_WORKER_ENTRY_FILES = [
  'src/jarvis/http-v1.js',
  'src/jarvis/standalone-worker-v1.js',
  'src/jarvis/pages-worker-v1.js',
  'src/jarvis/command-center-worker-binding-v1.js'
];
const NODE_ONLY_LOCAL_FILES = [
  'claude-code-local-cli-executor-v1.js',
  'claude-code-local-runtime-binding-v1.js',
  'claude-code-repo-bound-executor-v1.js',
  'claude-code-repo-bound-runtime-binding-v1.js',
  'branch-manager-v1.js',
  'program-controller-v1.js'
];
for (const file of DEPLOYED_WORKER_ENTRY_FILES) {
  const text = fs.readFileSync(file, 'utf8');
  for (const nodeOnly of NODE_ONLY_LOCAL_FILES) {
    // An actual import/require statement, not merely a mention in a comment
    // explaining why it's absent (http-v1.js documents that deliberately).
    const importPattern = new RegExp(`(?:from|require\\()\\s*['"][^'"]*${nodeOnly.replace(/\./g, '\\.')}['"]`);
    assert.doesNotMatch(text, importPattern, `${file} must never import the Node-only ${nodeOnly} (no production dependency)`);
  }
}

console.log('JARVIS Live Binding V1 safety regression smoke: PASS');
