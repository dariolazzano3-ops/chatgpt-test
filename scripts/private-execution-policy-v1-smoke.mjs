import assert from 'node:assert/strict';
import {
  evaluateYsrioExecutionRiskV1,
  ysrioExecutionRiskPolicyManifestV1
} from '../src/jarvis/execution-risk-policy-v1.js';

const privateBase = {
  environment: 'private-staging',
  visibility: 'PRIVATE',
  public_access: false,
  production: false,
  private_access_verified: true,
  dns_change: false,
  billing_change: false,
  secret_access: false,
  secret_change: false,
  destructive: false,
  protected_branch: false,
  merge: false,
  force_push: false,
  estimated_cost_eur: 0
};

for (const effect of ['CODE_WRITE', 'TEST', 'SERVICE_RELOAD', 'LIVE_VERIFY', 'ROLLBACK']) {
  const decision = evaluateYsrioExecutionRiskV1({ ...privateBase, effect });
  assert.equal(decision.status, 'AUTHORIZED', effect);
  assert.equal(decision.approval_required, false, effect);
}
{
  const decision = evaluateYsrioExecutionRiskV1({
    ...privateBase,
    effect: 'GIT_WRITE',
    branch: 'factory/private-autonomy-governance-v1'
  });
  assert.equal(decision.execution_authorized, true);
  assert.equal(decision.approval_required, false);
}

{
  const decision = evaluateYsrioExecutionRiskV1({
    ...privateBase,
    effect: 'PRIVATE_DEPLOY',
    existing_target: true,
    rollback_available: true
  });
  assert.equal(decision.execution_authorized, true);
  assert.equal(decision.approval_required, false);
}

for (const [effect, extra, reason] of [
  ['PUBLIC_DEPLOY', {}, 'PUBLIC_OR_PRODUCTION_ACTION'],
  ['PRIVATE_DEPLOY', { public_access: true, existing_target: true, rollback_available: true }, 'PUBLIC_OR_PRODUCTION_ACTION'],
  ['DNS_MUTATION', {}, 'DNS_MUTATION'],
  ['BILLING', {}, 'BILLING'],
  ['SECRET_ACCESS', {}, 'SECRET_ACCESS'],
  ['SECRET_MUTATION', {}, 'SECRET_MUTATION'],
  ['DESTRUCTIVE_ACTION', {}, 'DESTRUCTIVE_ACTION'],
  ['MERGE', {}, 'MERGE'],
  ['FORCE_PUSH', {}, 'FORCE_PUSH'],
  ['GIT_WRITE', { branch: 'main', protected_branch: true }, 'PROTECTED_BRANCH_WRITE'],
  ['PRIVATE_DEPLOY', { existing_target: true, rollback_available: true, estimated_cost_eur: 0.01 }, 'PAID_EXTERNAL_ACTION']
]) {
  const decision = evaluateYsrioExecutionRiskV1({
    ...privateBase,
    ...extra,
    effect,
    branch: extra.branch || 'factory/test'
  });
  assert.equal(decision.status, 'AWAITING_APPROVAL', effect);
  assert.equal(decision.execution_authorized, false, effect);
  assert.equal(decision.reason, reason, effect);
}

{
  const noRollback = evaluateYsrioExecutionRiskV1({
    ...privateBase,
    effect: 'PRIVATE_DEPLOY',
    existing_target: true,
    rollback_available: false
  });
  assert.equal(noRollback.status, 'AWAITING_APPROVAL');
  assert.equal(noRollback.reason, 'PRIVATE_DEPLOY_ROLLBACK_REQUIRED');
}
{
  const unverified = evaluateYsrioExecutionRiskV1({
    ...privateBase,
    effect: 'PRIVATE_DEPLOY',
    private_access_verified: false,
    existing_target: true,
    rollback_available: true
  });
  assert.equal(unverified.status, 'AWAITING_APPROVAL');
  assert.equal(unverified.reason, 'PRIVATE_TARGET_NOT_VERIFIED');
}

{
  const approvedPublic = evaluateYsrioExecutionRiskV1({
    ...privateBase,
    effect: 'PUBLIC_DEPLOY',
    explicit_approval: true
  });
  assert.equal(approvedPublic.status, 'AUTHORIZED');
  assert.equal(approvedPublic.approval_required, true);
}

const manifest = ysrioExecutionRiskPolicyManifestV1();
assert.equal(manifest.default_mode, 'PRIVATE_INTERNAL_AUTONOMOUS_EXTERNAL_RISK_GATED');
assert.equal(manifest.fail_closed_when_target_privacy_unverified, true);
assert.ok(manifest.autonomous_private_effects.includes('PRIVATE_DEPLOY'));
assert.ok(manifest.approval_required_effects.includes('DNS_MUTATION'));
assert.ok(manifest.approval_required_effects.includes('SECRET_ACCESS'));

console.log('YSRIO Private Internal Autonomy V1 smoke: PASS');
