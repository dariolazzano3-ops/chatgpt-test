/* JARVIS — ONE real local end-to-end acceptance run through the actual command
   path (Phase 4).

   Operator → action gate (blocks) → operator approval decision (recorded,
   never self-approved, never executes) → action gate re-check (now
   authorized) → Claude Code execution bridge (genuine child-process
   execution, real file I/O in a disposable /tmp workspace — NOT a second
   live nested `claude` CLI session; the operator capped this run to exactly
   one such session, already spent in
   scripts/jarvis-live-claude-cli-smoke-v1.mjs) → evidence → persisted audit
   (in-memory store, same contract as the Supabase-backed one) → Command
   Center read-bindings projection (runs/activity/evidence, derived from the
   persisted audit only) → independent verification → genuine read-only Git
   remote truth for this HEAD.

   Every step is independently re-checked by THIS script, not trusted from
   self-reports: the action gate's own decision, the approval runtime's own
   decision, the bridge's own exit code, and the projection's own derived
   state are all re-derived from the underlying persisted/observed facts. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateJarvisActionGateV1 } from '../src/jarvis/action-gate-v1.js';
import { normalizeJarvisPolicy, JARVIS_AUTONOMY } from '../src/jarvis/contracts-v1.js';
import { evaluateJarvisApprovalDecisionV1 } from '../src/jarvis/command-center-approval-runtime-v1.js';
import { createJarvisClaudeCodeBridgeV1, createChildProcessExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisCommandCenterReadBindingsV1 } from '../src/jarvis/command-center-read-bindings-v1.js';

const report = { schema: 'aurentara.jarvis.real-end-to-end-acceptance.v1', steps: {} };
const ownerId = crypto.randomUUID();
const ownerRef = 'jarvis:operator:e2e-acceptance';
const requestId = crypto.randomUUID();
const approvalId = `${requestId}:approval`;
const FIXTURE_NAME = 'e2e-fixture.txt';
const EXPECTED_CONTENT = `JARVIS_E2E_OK:${requestId}`;

const store = createMemoryJarvisStoreV1();
const policy = normalizeJarvisPolicy({
  autonomy_level: JARVIS_AUTONOMY.APPROVAL_GATED_EXTERNAL_ACTION,
  allow_external_writes: true,
  require_explicit_approval_for_writes: true
});

// ── Step 1: command arrives, action gate blocks (no explicit approval yet) ──
const gateBeforeApproval = evaluateJarvisActionGateV1({ action: 'FILE_WRITE', policy, explicit_approval: false });
report.steps.action_gate_before_approval = {
  status: gateBeforeApproval.status,
  execution_authorized: gateBeforeApproval.execution_authorized,
  approval_required: gateBeforeApproval.approval_required
};
const blockedBeforeApproval = gateBeforeApproval.execution_authorized === false && gateBeforeApproval.approval_required === true;

// ── Step 2: operator decision (a distinct, correlated, non-self action) ──
const projectedApproval = { approval_id: approvalId, run_id: requestId, state: 'PENDING' };
const decision = evaluateJarvisApprovalDecisionV1({
  approvals: [projectedApproval],
  approval_id: approvalId,
  run_id: requestId,
  owner_ref: ownerRef,
  decision: 'approve'
});
report.steps.approval_decision = {
  ok: decision.ok,
  execution_authorized: decision.execution_authorized,
  action_gate_bypassed: decision.action_gate_bypassed,
  worker_self_accepted: decision.worker_self_accepted
};
await store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: decision.audit_event });
const approvalRecordedWithoutExecuting = decision.ok === true && decision.execution_authorized === false && decision.action_gate_bypassed === false;

// ── Step 3: action gate re-checked now that an explicit approval exists ──
const gateAfterApproval = evaluateJarvisActionGateV1({ action: 'FILE_WRITE', policy, explicit_approval: true });
report.steps.action_gate_after_approval = {
  status: gateAfterApproval.status,
  execution_authorized: gateAfterApproval.execution_authorized
};
const authorizedAfterApproval = gateAfterApproval.status === 'AUTHORIZED' && gateAfterApproval.execution_authorized === true;

// ── Step 4: only now does the Claude Code bridge run — genuine child-process
//    execution, bounded to a disposable /tmp workspace, real file I/O. ──
const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-e2e-'));
let bridgeRecord = null;
let fixtureVerified = false;
let fixtureActual = null;
try {
  const exec = createChildProcessExecutorV1({
    command: 'node',
    args: ['-e', `require('node:fs').writeFileSync(process.argv[1], process.argv[2])`, path.join(workspaceDir, FIXTURE_NAME), EXPECTED_CONTENT],
    pass_task: false,
    cwd: workspaceDir
  });
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: exec, timeout_ms: 30000 });
  const handle = bridge.submit({
    correlation_id: requestId,
    request_id: requestId,
    owner_ref: ownerRef,
    workspace: '/workspace/projects/jarvis-e2e-acceptance',
    task: `write fixture ${FIXTURE_NAME}`,
    timeout_ms: 30000
  });
  bridgeRecord = await handle.result;

  try {
    fixtureActual = fs.readFileSync(path.join(workspaceDir, FIXTURE_NAME), 'utf8');
    fixtureVerified = fixtureActual === EXPECTED_CONTENT;
  } catch (error) {
    report.fixture_read_error = String(error?.message || error);
  }
} finally {
  try { fs.rmSync(workspaceDir, { recursive: true, force: true }); } catch {}
}

report.steps.bridge_execution = {
  worker: 'CLAUDE_CODE_BRIDGE (genuine child-process executor; not a second live `claude` CLI session — capped at one by operator instruction)',
  state: bridgeRecord?.state || null,
  exit_code: bridgeRecord?.exit_code ?? null,
  external_effect: bridgeRecord?.external_effect ?? null,
  independent_acceptance: bridgeRecord?.independent_acceptance ?? null,
  evidence_stdout_sha256: bridgeRecord?.evidence?.stdout_sha256 || null,
  fixture_independently_verified: fixtureVerified
};
const bridgeGenuinelyComplete = bridgeRecord?.state === 'COMPLETE' && fixtureVerified;

// ── Step 5: persist the execution outcome as a NEW owner-scoped audit event ──
const executionAudit = createJarvisAuditEventV1({
  timestamp: new Date().toISOString(),
  owner_ref: ownerRef,
  request: 'E2E acceptance: write fixture file via Claude Code bridge',
  intent: { intent_type: 'EXECUTION_REQUEST', domain: 'FILES', action: 'FILE_WRITE' },
  action: 'FILE_WRITE',
  tools_used: ['claude_code_bridge'],
  permissions: ['files.write'],
  result: {
    status: bridgeGenuinelyComplete ? 'COMPLETED' : 'FAILED',
    verified: fixtureVerified,
    external_effect: false,
    evidence_id: bridgeRecord?.evidence?.evidence_id || null,
    commit_sha: null
  },
  approval: {
    required: true,
    explicit: true,
    actor_type: 'OPERATOR',
    gate_status: 'APPROVED_BY_OPERATOR',
    decision: 'approve',
    approval_id: approvalId,
    decided_run_id: requestId
  },
  cost: { estimated_eur: 0, actual_eur: 0 },
  memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
});
executionAudit.request_id = requestId;
await store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: executionAudit });

// ── Step 6: Command Center reads the projection back from the SAME persisted
//    audit trail — nothing here is fabricated by this script. ──
const bindings = createJarvisCommandCenterReadBindingsV1({ store, owner_id: ownerId, owner_ref: ownerRef });
const runsView = await bindings.runs();
const activityView = await bindings.activity();
const evidenceView = await bindings.evidence();
const approvalsView = await bindings.approvals();

const projectedRun = runsView.data.find((r) => r.id === requestId) || null;
report.steps.command_center_projection = {
  runs_classification: runsView.classification,
  projected_run_found: Boolean(projectedRun),
  projected_run_status: projectedRun?.status || null,
  projected_run_worker: projectedRun?.worker || null,
  projected_run_approval_state: projectedRun?.approval_state || null,
  activity_events: activityView.data.length,
  evidence_items: evidenceView.data.length,
  approvals_items: approvalsView.data.length
};
const projectionGenuine = projectedRun?.status === 'COMPLETE' && projectedRun?.worker === 'Claude Code' && projectedRun?.approval_state === 'GRANTED';

// ── Step 7: genuine, read-only Git remote truth for the current HEAD (via the
//    gh CLI's own stored credential — this script never sees the token). ──
let gitTruth = { configured: true, method: 'GET', api: 'github.rest (via gh CLI)' };
try {
  const localHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  const remoteJson = execFileSync('gh', ['api', `repos/dariolazzano3-ops/chatgpt-test/git/ref/heads/${encodeURIComponent(branch)}`, '--jq', '.object.sha'], { encoding: 'utf8' }).trim();
  gitTruth.local_head = localHead;
  gitTruth.remote_head = remoteJson;
  gitTruth.branch = branch;
  gitTruth.status = localHead === remoteJson ? 'SYNCED' : 'CHANGED';
} catch (error) {
  gitTruth = { configured: false, status: 'UNKNOWN', error: String(error?.message || error).slice(0, 300) };
}
report.steps.git_remote_truth = gitTruth;

report.request_id = requestId;
report.all_steps_genuine = Boolean(
  blockedBeforeApproval && approvalRecordedWithoutExecuting && authorizedAfterApproval &&
  bridgeGenuinelyComplete && projectionGenuine
);

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.all_steps_genuine ? 0 : 1;
