import assert from 'node:assert/strict';
import { createPreviewStagingContract } from '../src/preview-staging.js';
import { createOperatorBudgetPolicy, evaluateBudgetAction, reserveBudget, settleBudget } from '../src/operator-budget-policy.js';
import { prepareStagingRelease, evaluateStagingReleaseEvidence } from '../src/staging-release-control.js';

const policy = createOperatorBudgetPolicy({ monthly_ceiling_eur: 80, warn_at_eur: 60 });
assert.equal(policy.monthly_ceiling_eur, 80);
assert.equal(policy.automatic_paid_overflow, false);

const preview = createPreviewStagingContract({
  source_revision: 'fe661adaed8e74060d9af685d4ce6c5da257665d',
  cloudflare_account_ref: 'account://cloudflare/connected',
  worker_ref: 'project://cloudflare/chatgpt-test',
  d1_ref: 'binding://cloudflare/d1/chatgpt-test-db',
  ai_binding_ref: 'binding://cloudflare/workers-ai',
  monthly_budget_eur: 80
});
assert.equal(preview.ok, true);

const zeroCost = prepareStagingRelease({
  preview_contract: preview.contract,
  budget_policy: policy,
  budget_state: { spent_eur: 0, reserved_eur: 0 },
  estimated_cost_eur: 0,
  d1_binding_present: true,
  d1_migration_declared: true,
  d1_migration_applied: false
});
assert.equal(zeroCost.ok, true);
assert.equal(zeroCost.stage, 'STAGING_RELEASE_PACKAGE_READY');
assert.equal(zeroCost.automatic_deploy, false);

const paidBlocked = prepareStagingRelease({
  preview_contract: preview.contract,
  budget_policy: policy,
  budget_state: { spent_eur: 0, reserved_eur: 0 },
  estimated_cost_eur: 20,
  d1_binding_present: true,
  d1_migration_declared: true,
  d1_migration_applied: false
});
assert.equal(paidBlocked.ok, false);
assert.ok(paidBlocked.blockers.some((item) => item.code === 'PAID_ACTION_REQUIRES_USER_APPROVAL'));
assert.equal(paidBlocked.user_action_required, true);

const paidApproved = prepareStagingRelease({
  preview_contract: preview.contract,
  budget_policy: policy,
  budget_state: { spent_eur: 10, reserved_eur: 0 },
  estimated_cost_eur: 20,
  cost_approved: true,
  d1_binding_present: true,
  d1_migration_declared: true,
  d1_migration_applied: false
});
assert.equal(paidApproved.ok, true);
assert.equal(paidApproved.budget.projected_eur, 30);

const overBudget = evaluateBudgetAction(policy, { spent_eur: 70, reserved_eur: 0 }, { estimated_cost_eur: 20, cost_approved: true });
assert.equal(overBudget.ok, false);
assert.ok(overBudget.blockers.some((item) => item.code === 'MONTHLY_BUDGET_CEILING_EXCEEDED'));

const approvedBudget = evaluateBudgetAction(policy, { spent_eur: 10, reserved_eur: 5 }, { estimated_cost_eur: 20, cost_approved: true });
const reservation = reserveBudget({ spent_eur: 10, reserved_eur: 5 }, { estimated_cost_eur: 20 }, approvedBudget);
assert.equal(reservation.ok, true);
assert.equal(reservation.state.reserved_eur, 25);
const settled = settleBudget(reservation.state, 20, 17.5);
assert.equal(settled.state.reserved_eur, 5);
assert.equal(settled.state.spent_eur, 27.5);

const evidence = evaluateStagingReleaseEvidence(zeroCost, {
  ci_green: true,
  smoke_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  external_side_effects: false,
  revision_verified: true,
  provider_health_verified: true
});
assert.equal(evidence.ok, true);
assert.equal(evidence.stage, 'STAGING_OPERATOR_REVIEW_READY');
assert.equal(evidence.production_authorized, false);

console.log('RIOSYSTEMS_STAGING_RELEASE_BUDGET_CONTROL_OK');
