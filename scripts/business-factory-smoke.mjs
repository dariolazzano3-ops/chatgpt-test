import assert from 'node:assert/strict';
import { normalizeBusinessContract, businessFactoryManifest } from '../src/business-factory.js';
import { executeBusinessContract } from '../src/business-executor.js';

const contract = {
  goal: 'Configure a bounded CRM and sales pipeline',
  operations: [
    { id: 'crm', type: 'define_crm', config: { name: 'Mission CRM', entity: 'lead' } },
    { id: 'fields', type: 'define_lead_fields', config: { fields: ['name', 'email', 'source'] } },
    { id: 'pipeline', type: 'configure_pipeline', config: { stages: ['new', 'qualified', 'won'] } }
  ]
};

const normalized = normalizeBusinessContract(contract);
assert.equal(normalized.ok, true);
assert.equal(normalized.contract.execution.external_writes, false);

const executed = await executeBusinessContract(contract, { input: { company: 'Mueller' } });
assert.equal(executed.ok, true);
assert.equal(executed.status, 'COMPLETED');
assert.equal(executed.outputs.business_system.company, 'Mueller');
assert.equal(executed.outputs.business_system.crm.name, 'Mission CRM');
assert.deepEqual(executed.outputs.business_system.pipeline.stages, ['new', 'qualified', 'won']);
assert.equal(executed.external_writes, false);
assert.equal(executed.production_deploy, false);

const blocked = await executeBusinessContract(contract, { external_write: true });
assert.equal(blocked.ok, false);
assert.equal(blocked.status, 'BLOCKED');
assert.equal(blocked.error, 'BUSINESS_EXTERNAL_WRITE_REJECTED');

const manifest = businessFactoryManifest();
assert.equal(manifest.engine, 'business');
assert.equal(manifest.external_writes, false);
assert.equal(manifest.production_deploy, false);
console.log('business-factory-smoke: ok');
