import assert from 'node:assert/strict';
import { aiProviderDecisionManifest, aiProviderStrategy, selectAIProviderTier } from '../src/ai-provider-strategy.js';
import { planAIProviderRoute } from '../src/ai-provider-router.js';

const manifest = aiProviderDecisionManifest();
assert.equal(manifest.primary_intelligence_provider, 'openai-api');
assert.equal(manifest.default_openai_model, 'gpt-5.6-luna');
assert.equal(manifest.free_staging_provider, 'cloudflare-workers-ai-free');
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

const strategy = aiProviderStrategy();
assert.equal(strategy.default_model_tier, 'economy');
assert.deepEqual(strategy.escalation_order, ['economy','balanced','frontier']);
assert.ok(strategy.providers.some((item) => item.id === 'openai-api'));
assert.ok(strategy.providers.some((item) => item.id === 'cloudflare-workers-ai-free'));

const autoFree = selectAIProviderTier({ connected_providers: ['cloudflare-workers-ai-free'] });
assert.equal(autoFree.ready, true);
assert.equal(autoFree.provider.id, 'cloudflare-workers-ai-free');
assert.equal(autoFree.model, '@cf/zai-org/glm-4.7-flash');
assert.equal(autoFree.paid_execution, false);

const paidBlocked = selectAIProviderTier({ mode: 'paid', connected_providers: ['openai-api'], quality: 'balanced', mission_budget_eur: 2 });
assert.equal(paidBlocked.ready, false);
assert.ok(paidBlocked.blockers.some((item) => item.code === 'PAID_AI_EXECUTION_APPROVAL_REQUIRED'));

const paidReady = selectAIProviderTier({ mode: 'paid', connected_providers: ['openai-api'], quality: 'balanced', mission_budget_eur: 2, paid_execution_approved: true });
assert.equal(paidReady.ready, true);
assert.equal(paidReady.model, 'gpt-5.6-terra');
assert.equal(paidReady.mission_budget_eur, 2);

const missingBudget = selectAIProviderTier({ mode: 'paid', connected_providers: ['openai-api'], quality: 'frontier', paid_execution_approved: true });
assert.equal(missingBudget.ready, false);
assert.ok(missingBudget.blockers.some((item) => item.code === 'MISSION_AI_BUDGET_REQUIRED'));

const route = planAIProviderRoute({ source_revision: 'abc123', connected_providers: ['cloudflare-workers-ai-free'] });
assert.equal(route.ok, true);
assert.equal(route.state, 'ROUTE_READY');
assert.deepEqual(route.route, ['riosystems-ai-local-policy','cloudflare-workers-ai-free']);

const executeBlocked = planAIProviderRoute({ source_revision: 'abc123', connected_providers: ['cloudflare-workers-ai-free'], execute: true });
assert.equal(executeBlocked.state, 'ROUTE_BLOCKED');
assert.ok(executeBlocked.blockers.some((item) => item.code === 'SUPERVISED_AI_EXECUTION_APPROVAL_REQUIRED'));

const production = planAIProviderRoute({ production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS AI Factory provider selection smoke: OK');
