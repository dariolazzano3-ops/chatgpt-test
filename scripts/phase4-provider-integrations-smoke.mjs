import assert from 'node:assert/strict';
import { createIntegrationCatalog, selectIntegration } from '../src/integration-catalog.js';
import { prepareIntegrationExecution, runIntegration } from '../src/integration-runtime.js';
import { buildFactoryIntegrationPlan } from '../src/factory-integration-bridge.js';
import { evaluatePhase4Readiness } from '../src/phase4-readiness.js';

const runner = async ({ payload }) => ({ ok: true, echoed: payload });
const catalog = createIntegrationCatalog([
  { id: 'ai-primary', capability: 'ai.generate', kind: 'ai_provider', provider: 'provider-a', credential_ref: 'secret://ai-primary', endpoint: 'https://api.example.test/v1', allowed_hosts: ['api.example.test'], enabled: true, paid: true, health: 'healthy', runner },
  { id: 'crm-primary', capability: 'business.crm.write', kind: 'crm', provider: 'crm-a', credential_ref: 'secret://crm-primary', endpoint: 'https://crm.example.test/v1', allowed_hosts: ['crm.example.test'], enabled: true, external_write: true, health: 'healthy', runner }
]);
assert.equal(catalog.integrations.length, 2);
assert.equal(selectIntegration(catalog, { capability: 'ai.generate' }).ok, true);

const blocked = prepareIntegrationExecution(catalog, { capability: 'ai.generate' }, { cost_approved: false, external_write_approved: false });
assert.equal(blocked.user_action_required, true);
assert.ok(blocked.activation.blockers.some((item) => item.code === 'INTEGRATION_COST_APPROVAL_REQUIRED'));

const dryRun = await runIntegration(catalog, { capability: 'ai.generate', payload: { prompt: 'test' } }, { cost_approved: true, external_write_approved: true, execution_mode: 'dry_run' });
assert.equal(dryRun.stage, 'dry_run_complete');
assert.equal(dryRun.external_side_effect_performed, false);

const execute = await runIntegration(catalog, { capability: 'business.crm.write', payload: { lead: 'A' } }, { cost_approved: true, external_write_approved: true, execution_mode: 'execute', supervised_execution_approved: true });
assert.equal(execute.stage, 'integration_execution_complete');
assert.equal(execute.external_side_effect_performed, true);
assert.equal(execute.production_deploy, false);

const plan = buildFactoryIntegrationPlan({ tasks: [{ task_id: 't1', domain: 'ai', capability: 'ai.generate' }] }, catalog, { cost_approved: true, external_write_approved: true });
assert.equal(plan.ready_for_supervised_integrations, true);
const readiness = evaluatePhase4Readiness();
assert.equal(readiness.ready, true);
assert.equal(readiness.status, 'ARCHITECTURE_COMPLETE');
console.log(JSON.stringify({ ok: true, suite: 'phase4-provider-integrations', readiness }, null, 2));
