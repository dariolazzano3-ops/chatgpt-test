import assert from 'node:assert/strict';
import { planProviderStackMission, providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';

const stack = providerStackV1();
assert.equal(stack.status, 'PROVIDER_SELECTION_COMPLETE');
assert.deepEqual(stack.active_factories, ['web','automation','ai','business']);
for (const key of stack.active_factories) {
  assert.equal(stack.factories[key].adapter.mode, 'provider_routed');
  assert.equal(stack.factories[key].adapter.production_deploy, false);
}
assert.deepEqual(stack.factories.web.primary_path, ['riosystems-native-web','cloudflare-workers-free']);
assert.deepEqual(stack.factories.automation.primary_path, ['riosystems-native-automation','activepieces-cloud-free']);
assert.deepEqual(stack.factories.ai.primary_path, ['riosystems-ai-local-policy','openai-api']);
assert.deepEqual(stack.factories.ai.free_staging_path, ['riosystems-ai-local-policy','cloudflare-workers-ai-free']);
assert.deepEqual(stack.factories.business.primary_path, ['riosystems-native-business','supabase-free','posthog-free']);
assert.equal(stack.factories.business.standalone_crm_saas_required, false);
assert.equal(stack.activation_policy.external_writes_require_explicit_approval, true);
assert.equal(stack.activation_policy.paid_execution_requires_explicit_approval, true);
assert.equal(stack.activation_policy.automatic_paid_overflow, false);
assert.equal(stack.activation_policy.production_deploy, false);
assert.equal(stack.app_factory.provider_selection_complete, false);

const matrix = providerActivationMatrix();
assert.equal(matrix.secrets_embedded, false);
assert.equal(matrix.automatic_paid_overflow, false);
assert.equal(matrix.production_deploy, false);
assert.equal(matrix.providers.find((item) => item.id === 'openai-api')?.paid_execution, 'approval_required');
assert.equal(matrix.providers.find((item) => item.id === 'activepieces-cloud-free')?.activation, 'account_connection_required');
assert.equal(matrix.providers.find((item) => item.id === 'lovable-github')?.selection, 'optional_specialist');

const bakery = planProviderStackMission({ project: 'Bäckerei Müller' });
assert.equal(bakery.ok, true);
assert.equal(bakery.project, 'Bäckerei Müller');
assert.deepEqual(bakery.routes.web, ['riosystems-native-web','cloudflare-workers-free']);
assert.deepEqual(bakery.routes.automation, ['riosystems-native-automation','activepieces-cloud-free']);
assert.deepEqual(bakery.routes.ai, ['riosystems-ai-local-policy','cloudflare-workers-ai-free']);
assert.deepEqual(bakery.routes.business, ['riosystems-native-business','supabase-free','posthog-free']);
assert.equal(bakery.execution_authorized, false);
assert.equal(bakery.external_writes, false);
assert.equal(bakery.paid_execution, false);
assert.equal(bakery.production_deploy, false);
assert.equal(bakery.next_gate, 'RUNTIME_PROVIDER_ACTIVATION_AND_STAGING_APPROVAL');

const prod = planProviderStackMission({ project: 'Bäckerei Müller', production_deploy: true });
assert.equal(prod.ok, false);
assert.equal(prod.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Provider Stack v1 smoke: OK');
