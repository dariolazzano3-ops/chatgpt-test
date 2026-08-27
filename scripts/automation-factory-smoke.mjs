import assert from 'node:assert/strict';
import { automationFactoryManifest, validateAutomationContract, compileAutomationPlan, dryRunAutomation } from '../src/automation-factory.js';
import { resolveExecutionAdapter } from '../src/execution-adapters.js';

const manifest = automationFactoryManifest();
assert.equal(manifest.available, true);
assert.equal(manifest.execution_mode, 'dry_run_only');
assert.equal(manifest.external_side_effects, false);
assert.equal(manifest.production_deploy, false);

const safe = {
  goal: 'Normalize incoming leads and route qualified leads',
  steps: [
    { id: 'input', type: 'input' },
    { id: 'normalize', type: 'transform', depends_on: ['input'] },
    { id: 'qualified', type: 'condition', depends_on: ['normalize'] },
    { id: 'output', type: 'output', depends_on: ['qualified'] }
  ]
};
assert.equal(validateAutomationContract(safe).ok, true);
const safePlan = compileAutomationPlan(safe);
assert.equal(safePlan.ok, true);
assert.equal(dryRunAutomation(safePlan).status, 'DRY_RUN_PASSED');

const external = compileAutomationPlan({
  goal: 'Send qualified leads to CRM webhook',
  steps: [
    { id: 'input', type: 'input' },
    { id: 'crm', type: 'webhook', depends_on: ['input'], config: { endpoint_ref: 'CRM_WEBHOOK' } }
  ]
});
assert.equal(external.ok, true);
assert.equal(external.has_external_side_effects, true);
const externalRun = dryRunAutomation(external);
assert.equal(externalRun.status, 'READY_WITH_BLOCKED_EXTERNAL_STEPS');
assert.equal(externalRun.trace.find((item) => item.step_id === 'crm')?.status, 'BLOCKED');

const adapter = resolveExecutionAdapter({ domain: 'automation', engine: 'automation', state: 'READY' });
assert.equal(adapter.ok, true);
assert.equal(adapter.adapter.mode, 'supervised');
assert.equal(adapter.adapter.external_side_effects, 'supervised_only');
assert.equal(adapter.adapter.automatic_execution, false);
assert.equal(adapter.adapter.production_deploy, false);

assert.equal(validateAutomationContract({ goal: 'bad', steps: [{ id: 'x', type: 'shell_exec' }] }).ok, false);
console.log('automation-factory-smoke: ok');
