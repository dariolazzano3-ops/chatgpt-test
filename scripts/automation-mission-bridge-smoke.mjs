import assert from 'node:assert/strict';
import { executeAutomationMissionTask } from '../src/automation-mission-bridge.js';

const mission = {
  mission_id: 'mission-v45-smoke', orchestration_id: 'orch-v45', prompt: 'run automation', project: null, status: 'READY', revision: 1,
  tasks: [{ task_id: 'task-auto', capability: 'automation', domain: 'automation', engine: 'automation', goal: 'transform input', depends_on: [], state: 'READY', attempt: 0, max_attempts: 3, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false }], events: [], safeguards: {}
};

const safeContract = { goal: 'safe transform', steps: [{ id: 'set-status', type: 'transform', config: { mode: 'set', field: 'status', value: 'ready' } }] };
const safe = await executeAutomationMissionTask(mission, 'task-auto', safeContract, { authorized: true }, { input: { id: 1 } });
assert.equal(safe.ok, true);
assert.equal(safe.mission.tasks[0].state, 'COMPLETED');
assert.equal(safe.mission.tasks[0].outputs.result.status, 'ready');
assert.equal(safe.production_deploy, false);

const externalMission = structuredClone(mission);
const externalContract = { goal: 'supervised webhook', steps: [{ id: 'hook', type: 'webhook', config: { url: 'https://example.com/hook', method: 'POST', body: { ok: true } } }] };
const blocked = await executeAutomationMissionTask(externalMission, 'task-auto', externalContract, { authorized: true }, { policy: { authorized: false, allowed_hosts: ['example.com'] }, transport: async () => ({ status_code: 204 }) });
assert.equal(blocked.ok, true);
assert.equal(blocked.mission.tasks[0].state, 'FAILED');
assert.equal(blocked.adapter_result.error.code, 'AUTOMATION_SUPERVISION_BLOCKED');

const allowedMission = structuredClone(mission);
let calls = 0;
const allowed = await executeAutomationMissionTask(allowedMission, 'task-auto', externalContract, { authorized: true }, { policy: { authorized: true, allowed_hosts: ['example.com'] }, transport: async () => { calls += 1; return { status_code: 204 }; } });
assert.equal(allowed.ok, true);
assert.equal(allowed.mission.tasks[0].state, 'COMPLETED');
assert.equal(calls, 1);
assert.equal(allowed.production_deploy, false);
console.log('automation-mission-bridge-smoke: ok');
