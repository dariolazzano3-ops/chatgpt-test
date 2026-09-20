import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const CORR = '55555555-6666-4777-8888-999999999999';

function fakeBridge(counter) {
  return {
    bound: true,
    submit() {
      counter.count += 1;
      return {
        result: Promise.resolve({
          state: 'COMPLETE',
          exit_code: 0,
          external_effect: true,
          evidence: {
            evidence_id: 'project-mission-evidence-1',
            verification: {
              schema: 'aurentara.jarvis.repo-bound-verification.v1',
              branch: 'factory/aurentara-real-lifecycle-v1',
              branch_drift: false,
              files_changed: ['src/example.js'],
              syntax_check: { passed: true }
            }
          }
        })
      };
    }
  };
}

const targetCalls = { count: 0 };
const defaultCalls = { count: 0 };
const targetBridge = fakeBridge(targetCalls);
const defaultBridge = fakeBridge(defaultCalls);
const target = {
  target_id: 'AURENTARA',
  label: 'AURENTARA',
  program: 'AURENTARA_PROJECT_MISSION_V1',
  target_branch: 'factory/aurentara-real-lifecycle-v1',
  bridge_project: 'aurentara-real-lifecycle-v1',
  bridge_bound: true,
  repo_dir: '/server/only/never-exposed',
  bridge: targetBridge
};

function options(store) {
  return {
    authorize,
    memory_store: store,
    claude_bridge: defaultBridge,
    project_mission_targets: { AURENTARA: target },
    engineering_mission_bridge_resolver: async ({ program }) =>
      program === target.program
        ? { matched: true, bridge: targetBridge, target_id: target.target_id, reason: null }
        : { matched: false, bridge: null, target_id: null, reason: null }
  };
}

async function request(store, path, init = {}) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/' + path, init),
    {},
    {},
    options(store)
  );
}

// 1. Only safe public target metadata is exposed.
{
  const store = createMemoryJarvisStoreV1();
  const r = await request(store, 'project-mission/targets');
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.target_count, 1);
  assert.deepEqual(b.targets[0], {
    target_id: 'AURENTARA',
    label: 'AURENTARA',
    program: 'AURENTARA_PROJECT_MISSION_V1',
    target_branch: 'factory/aurentara-real-lifecycle-v1',
    bridge_bound: true
  });
  assert.equal(JSON.stringify(b).includes('/server/only/never-exposed'), false, 'server repo path must never be exposed');
  assert.equal(b.client_supplied_repo_paths_allowed, false);
  assert.equal(b.client_supplied_bridge_projects_allowed, false);
}

// 2. Creating a Project Mission is approval-gated and cannot execute immediately.
const store = createMemoryJarvisStoreV1();
{
  const r = await request(store, 'project-mission', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      target_id: 'AURENTARA',
      title: 'AURENTARA weiterführen',
      goal: 'Verifiziere Truth und bereite den nächsten bounded Lifecycle-Schritt vor.',
      correlation_id: CORR,
      repo_dir: '/tmp/attacker-controlled',
      bridge_project: 'wrong-project'
    })
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.request_id, CORR);
  assert.equal(b.target_id, 'AURENTARA');
  assert.equal(b.program, 'AURENTARA_PROJECT_MISSION_V1');
  assert.equal(b.target_branch, 'factory/aurentara-real-lifecycle-v1');
  assert.equal(b.run_state, 'WAITING_APPROVAL');
  assert.equal(b.approval_required, true);
  assert.equal(b.external_effect, false);
  assert.equal(b.client_supplied_repo_paths_allowed, false);
  assert.equal(b.client_supplied_bridge_projects_allowed, false);
  assert.equal(targetCalls.count, 0, 'approval creation must not dispatch target Bridge');
  assert.equal(defaultCalls.count, 0, 'approval creation must not dispatch default JARVIS Bridge');
}

// 3. Unknown target fails closed.
{
  const r = await request(store, 'project-mission', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target_id: 'NOT_ALLOWED', title: 'x', goal: 'y' })
  });
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.error, 'JARVIS_PROJECT_MISSION_TARGET_NOT_CONFIGURED');
  assert.equal(b.executed, false);
}

// 4. Approval is a distinct audit action and still does not execute.
let approvalId = null;
{
  const truth = await request(store, 'runtime-truth');
  const tb = await truth.json();
  const approval = tb.approvals.data.items.find((item) => item.run_id === CORR);
  assert.ok(approval, 'Project Mission must project a real pending approval');
  approvalId = approval.approval_id;

  const r = await request(store, 'approvals/decide', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ approval_id: approvalId, run_id: CORR, decision: 'approve' })
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.ok, true);
  assert.equal(b.executed, false, 'approval itself must never execute');
  assert.equal(targetCalls.count, 0);
  assert.equal(defaultCalls.count, 0);
}

// 5. Resume routes the persisted AURENTARA program to the target Bridge only.
{
  const r = await request(store, 'engineering-mission/resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      request_id: CORR,
      // These must be ignored by the resume contract.
      target_id: 'NOT_ALLOWED',
      title: 'replacement attack',
      goal: 'replacement attack'
    })
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.ok, true);
  assert.equal(b.executed, true);
  assert.equal(b.wave_state, 'COMPLETE');
  assert.equal(b.claude_bridge_bound, true);
  assert.equal(b.claude_bridge_resolution?.matched, true);
  assert.equal(b.claude_bridge_resolution?.target_id, 'AURENTARA');
  assert.equal(targetCalls.count, 1, 'target Bridge must execute exactly once');
  assert.equal(defaultCalls.count, 0, 'Project Mission must never fall back to default JARVIS Bridge');
}

// 6. Duplicate resume remains idempotent and does not execute a second time.
{
  const r = await request(store, 'engineering-mission/resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request_id: CORR })
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.executed, false);
  assert.equal(b.duplicate_execution_guard, 'BLOCKED_DUPLICATE');
  assert.equal(targetCalls.count, 1);
  assert.equal(defaultCalls.count, 0);
}

console.log('JARVIS Project Mission Lane V1 smoke: PASS');
