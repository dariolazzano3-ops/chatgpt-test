import assert from 'node:assert/strict';
import { createPreviewStagingContract, buildPreviewDeploymentPlan, evaluatePreviewPromotion } from '../src/preview-staging.js';
import { createMemoryRuntimeStore, createScopedRuntimeRepository } from '../src/durable-runtime-store.js';

const sourceRevision = '61e8e306864158b83f76178ce3ba60b412fdff6f';
const preview = createPreviewStagingContract({
  source_revision: sourceRevision,
  cloudflare_account_ref: 'account://cloudflare/connected',
  worker_ref: 'project://cloudflare/chatgpt-test',
  d1_ref: 'binding://cloudflare/d1/chatgpt-test-db',
  ai_binding_ref: 'binding://cloudflare/workers-ai',
  monthly_budget_eur: 0
});
assert.equal(preview.ok, true);
assert.equal(preview.contract.production_deploy, false);

const dryPlan = buildPreviewDeploymentPlan(preview.contract, { estimated_cost_eur: 0 });
assert.equal(dryPlan.ok, true);
assert.equal(dryPlan.stage, 'PREVIEW_PLAN_READY');
assert.equal(dryPlan.deployment.dry_run, true);
assert.equal(dryPlan.deployment.production_deploy, false);

const paidAttempt = buildPreviewDeploymentPlan(preview.contract, { estimated_cost_eur: 0.01, execute: true });
assert.equal(paidAttempt.ok, false);
assert.ok(paidAttempt.blockers.some((item) => item.code === 'PREVIEW_BUDGET_EXCEEDED'));
assert.ok(paidAttempt.blockers.some((item) => item.code === 'PAID_ACTION_REQUIRES_USER_APPROVAL'));

const productionAttempt = buildPreviewDeploymentPlan(preview.contract, { production: true });
assert.equal(productionAttempt.ok, false);
assert.ok(productionAttempt.blockers.some((item) => item.code === 'PRODUCTION_NOT_AUTHORIZED'));

const promotion = evaluatePreviewPromotion(preview.contract, {
  ci_green: true,
  smoke_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  external_side_effects: false
});
assert.equal(promotion.ok, true);
assert.equal(promotion.ready_for_operator_review, true);
assert.equal(promotion.automatic_production_promotion, false);

const store = createMemoryRuntimeStore();
const repoA = createScopedRuntimeRepository(store, { customer_id: 'baeckerei-mueller', project_id: 'digital-system-v1' });
const repoB = createScopedRuntimeRepository(store, { customer_id: 'other-customer', project_id: 'digital-system-v1' });
assert.equal(repoA.ok, true);
assert.equal(repoB.ok, true);

const first = await repoA.put('projects', 'project', { name: 'Bäckerei Müller' }, { expected_revision: 0 });
assert.equal(first.ok, true);
assert.equal(first.revision, 1);

const conflict = await repoA.put('projects', 'project', { name: 'stale writer' }, { expected_revision: 0 });
assert.equal(conflict.ok, false);
assert.equal(conflict.error, 'STORE_REVISION_CONFLICT');

const secondScopeRead = await repoB.get('projects', 'project');
assert.equal(secondScopeRead.ok, true);
assert.equal(secondScopeRead.record, null);

const ownRead = await repoA.get('projects', 'project');
assert.equal(ownRead.record.value.name, 'Bäckerei Müller');
assert.equal(ownRead.record.revision, 1);

console.log('RIOSYSTEMS_PREVIEW_STAGING_FULLGAS_OK');
