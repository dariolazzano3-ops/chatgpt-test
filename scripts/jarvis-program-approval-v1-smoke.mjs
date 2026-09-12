import assert from 'node:assert/strict';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import {
  handleJarvisProgramApprovalGrantRuntimeV1,
  handleJarvisProgramApprovalRevokeRuntimeV1,
  evaluateJarvisProgramApprovalStateV1,
  evaluateJarvisProgramApprovalActionV1,
  jarvisProgramApprovalManifestV1,
  JARVIS_PROGRAM_APPROVAL_NEVER_COVERED
} from '../src/jarvis/program-approval-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:op@example.invalid';
const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';
const REPO_DIR = '/home/dario/chatgpt-test';
const BRANCH = 'factory/jarvis-masterarchitecture-v2';

async function readAudit(store) { return store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 200 }); }

// ── 1. Grant requires an explicit confirm_scope flag ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION']
  }, { memory_store: store });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'JARVIS_PROGRAM_APPROVAL_CONFIRM_SCOPE_REQUIRED');
}

// ── 2. A never-coverable capability is stripped from the grant even if explicitly requested ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION', 'ACCEPTANCE', 'MERGE', 'DEPLOY', 'MAIN_MASTER_MUTATION'],
    confirm_scope: true
  }, { memory_store: store });
  assert.equal(r.ok, true);
  assert.deepEqual(r.granted_scope.sort(), ['ACCEPTANCE', 'CLAUDE_REPO_BOUND_EXECUTION'].sort());
  assert.deepEqual(r.rejected_scope.sort(), ['DEPLOY', 'MAIN_MASTER_MUTATION', 'MERGE'].sort());

  const audit = await readAudit(store);
  const state = evaluateJarvisProgramApprovalStateV1(audit, PROGRAM);
  assert.equal(state.granted, true);
  assert.deepEqual(state.scope.sort(), ['ACCEPTANCE', 'CLAUDE_REPO_BOUND_EXECUTION'].sort());
  assert.equal(state.repo_dir, REPO_DIR);
  assert.equal(state.target_branch, BRANCH);
}

// ── 3. evaluateJarvisProgramApprovalActionV1: the deny-list wins unconditionally, even against a "granted" scope array that (by construction) can never contain it ──
for (const denied of JARVIS_PROGRAM_APPROVAL_NEVER_COVERED) {
  const grant = { granted: true, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH, scope: [denied] };
  const r = evaluateJarvisProgramApprovalActionV1(grant, { capability: denied, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH });
  assert.equal(r.covered, false, `${denied} must never be covered`);
  assert.equal(r.reason, 'NEVER_COVERABLE');
}

// ── 4. No grant at all -> never covered ──
{
  const r = evaluateJarvisProgramApprovalActionV1(null, { capability: 'CLAUDE_REPO_BOUND_EXECUTION', program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH });
  assert.equal(r.covered, false);
  assert.equal(r.reason, 'NO_PROGRAM_APPROVAL_GRANTED');
}

// ── 5. Program / repo_dir / target_branch must match exactly — no cross-program or cross-branch leakage ──
{
  const grant = { granted: true, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH, scope: ['CLAUDE_REPO_BOUND_EXECUTION'] };
  assert.equal(evaluateJarvisProgramApprovalActionV1(grant, { capability: 'CLAUDE_REPO_BOUND_EXECUTION', program: 'OTHER_PROGRAM', repo_dir: REPO_DIR, target_branch: BRANCH }).reason, 'PROGRAM_MISMATCH');
  assert.equal(evaluateJarvisProgramApprovalActionV1(grant, { capability: 'CLAUDE_REPO_BOUND_EXECUTION', program: PROGRAM, repo_dir: '/somewhere/else', target_branch: BRANCH }).reason, 'REPO_DIR_MISMATCH');
  assert.equal(evaluateJarvisProgramApprovalActionV1(grant, { capability: 'CLAUDE_REPO_BOUND_EXECUTION', program: PROGRAM, repo_dir: REPO_DIR, target_branch: 'main' }).reason, 'TARGET_BRANCH_MISMATCH');
  assert.equal(evaluateJarvisProgramApprovalActionV1(grant, { capability: 'ACCEPTANCE', program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH }).reason, 'CAPABILITY_NOT_IN_GRANTED_SCOPE');
  assert.equal(evaluateJarvisProgramApprovalActionV1(grant, { capability: 'CLAUDE_REPO_BOUND_EXECUTION', program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH }).covered, true);
}

// ── 6. A later REVOKE supersedes an earlier GRANT ──
{
  const store = createMemoryJarvisStoreV1();
  await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION'], confirm_scope: true, now: '2026-01-01T00:00:00.000Z'
  }, { memory_store: store });
  // Manually append a revoke event (no dedicated handler needed for this smoke — evaluate reads whatever the audit trail carries).
  await store.appendAudit({
    owner_id: OWNER_ID, owner_ref: OWNER_REF,
    event: {
      timestamp: '2026-01-02T00:00:00.000Z', owner_ref: OWNER_REF, request: 'revoke', action: 'PROGRAM_APPROVAL',
      intent: { intent_type: 'PROGRAM_APPROVAL_REVOKE', domain: 'PROGRAM', action: 'PROGRAM_APPROVAL' },
      result: { program: PROGRAM }, approval: {}, cost: {}, memory_updates: {}
    }
  });
  const audit = await readAudit(store);
  const state = evaluateJarvisProgramApprovalStateV1(audit, PROGRAM);
  assert.equal(state.granted, false);
  assert.equal(state.revoked, true);
}

// ── 6b. handleJarvisProgramApprovalRevokeRuntimeV1: requires explicit confirm_revoke ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await handleJarvisProgramApprovalRevokeRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM
  }, { memory_store: store });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'JARVIS_PROGRAM_APPROVAL_CONFIRM_REVOKE_REQUIRED');
}

// ── 6c. Real revoke via the handler: supersedes a real prior grant, reads back correctly, and is scoped to the program only (not repo_dir/target_branch) ──
{
  const store = createMemoryJarvisStoreV1();
  const grant = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION', 'ACCEPTANCE'], confirm_scope: true
  }, { memory_store: store });
  assert.equal(grant.ok, true);

  const revoke = await handleJarvisProgramApprovalRevokeRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, confirm_revoke: true
  }, { memory_store: store });
  assert.equal(revoke.ok, true);
  assert.equal(revoke.was_granted, true, 'honestly reports what it actually revoked');
  assert.deepEqual(revoke.revoked_scope.sort(), ['ACCEPTANCE', 'CLAUDE_REPO_BOUND_EXECUTION'].sort());
  assert.equal(revoke.audit_persisted, true);

  const audit = await readAudit(store);
  const state = evaluateJarvisProgramApprovalStateV1(audit, PROGRAM);
  assert.equal(state.granted, false, 'the real revoke event, not a manually-constructed one, supersedes the real grant');
  const check = evaluateJarvisProgramApprovalActionV1(state, { capability: 'CLAUDE_REPO_BOUND_EXECUTION', program: PROGRAM, repo_dir: REPO_DIR, target_branch: BRANCH });
  assert.equal(check.covered, false);
  assert.equal(check.reason, 'NO_PROGRAM_APPROVAL_GRANTED');
}

// ── 6d. Idempotent: revoking when nothing was ever granted is not an error, and honestly reports was_granted: false ──
{
  const store = createMemoryJarvisStoreV1();
  const revoke = await handleJarvisProgramApprovalRevokeRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, confirm_revoke: true
  }, { memory_store: store });
  assert.equal(revoke.ok, true);
  assert.equal(revoke.was_granted, false);
  assert.deepEqual(revoke.revoked_scope, []);
}

// ── 6e. Revoke never itself requires or checks repo_dir/target_branch — it is scoped to the program only ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await handleJarvisProgramApprovalRevokeRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, confirm_revoke: true
    // deliberately no repo_dir / target_branch
  }, { memory_store: store });
  assert.equal(r.ok, true);
}

// ── 7. Invalid program / missing repo_dir / missing target_branch all fail closed (grant); invalid program fails closed (revoke) ──
{
  const store = createMemoryJarvisStoreV1();
  const bad1 = await handleJarvisProgramApprovalGrantRuntimeV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, program: 'not a valid program name', repo_dir: REPO_DIR, target_branch: BRANCH, confirm_scope: true }, { memory_store: store });
  assert.equal(bad1.error, 'JARVIS_PROGRAM_APPROVAL_PROGRAM_INVALID');
  const bad2 = await handleJarvisProgramApprovalGrantRuntimeV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, target_branch: BRANCH, confirm_scope: true }, { memory_store: store });
  assert.equal(bad2.error, 'JARVIS_PROGRAM_APPROVAL_REPO_DIR_REQUIRED');
  const bad3 = await handleJarvisProgramApprovalGrantRuntimeV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: REPO_DIR, confirm_scope: true }, { memory_store: store });
  assert.equal(bad3.error, 'JARVIS_PROGRAM_APPROVAL_TARGET_BRANCH_REQUIRED');
  const bad4 = await handleJarvisProgramApprovalRevokeRuntimeV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, program: 'not a valid program name', confirm_revoke: true }, { memory_store: store });
  assert.equal(bad4.error, 'JARVIS_PROGRAM_APPROVAL_PROGRAM_INVALID');
}

// ── 8. Manifest / safety invariants ──
{
  const man = jarvisProgramApprovalManifestV1();
  assert.equal(man.grant_requires_explicit_operator_action, true);
  assert.equal(man.grant_never_issued_automatically, true);
  assert.equal(man.revoke_requires_explicit_operator_action, true);
  assert.equal(man.revoke_never_issued_automatically, true);
  assert.equal(man.revoke_route, '/api/program/approve/revoke');
  assert.equal(man.scope_deny_list_checked_before_allow_list, true);
  assert.ok(man.never_covered.includes('MAIN_MASTER_MUTATION'));
  assert.ok(man.never_covered.includes('MERGE'));
  assert.ok(man.never_covered.includes('DEPLOY'));
  assert.ok(man.never_covered.includes('FORCE_PUSH'));
  assert.ok(man.never_covered.includes('HAMYREN_DATA_FLOW'));
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
}

console.log('JARVIS Program Approval V1 smoke: PASS');
