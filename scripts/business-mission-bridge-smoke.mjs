import assert from 'node:assert/strict';
import { executeBusinessMissionTask, businessMissionBridgeManifest } from '../src/business-mission-bridge.js';

const mission = {
  mission_id: 'mission-v48-business', orchestration_id: 'orch-v48-business', prompt: 'configure CRM', project: null, status: 'READY', revision: 1,
  tasks: [{ task_id: 'task-business', capability: 'business_system_build', domain: 'business', engine: 'business', goal: 'configure CRM', depends_on: [], state: 'READY', attempt: 0, max_attempts: 3, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false }],
  events: [], safeguards: {}
};
const contract = { goal: 'configure CRM', operations: [{ id: 'crm', type: 'define_crm', config: { name: 'Core CRM' } }] };

const blocked = await executeBusinessMissionTask(structuredClone(mission), 'task-business', contract, {}, {});
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'ADAPTER_DISPATCH_APPROVAL_REQUIRED');

const executed = await executeBusinessMissionTask(structuredClone(mission), 'task-business', contract, { authorized: true }, { input: { tenant: 'mueller' } });
assert.equal(executed.ok, true);
assert.equal(executed.mission.tasks[0].state, 'COMPLETED');
assert.equal(executed.mission.tasks[0].outputs.business_system.crm.name, 'Core CRM');
assert.equal(executed.mission.tasks[0].outputs.business_system.tenant, 'mueller');
assert.equal(executed.production_deploy, false);

const manifest = businessMissionBridgeManifest();
assert.equal(manifest.version, '4.8');
assert.equal(manifest.explicit_dispatch_approval, true);
assert.equal(manifest.external_writes, false);
console.log('business-mission-bridge-smoke: ok');
