import assert from 'node:assert/strict';
import { executeMissionTask, executeReadyMissionTasks, missionExecutionRouterManifest } from '../src/mission-execution-router.js';

const mission = {
  mission_id: 'mission-v46-smoke',
  orchestration_id: 'orch-v46',
  prompt: 'build web surface and process lead data',
  project: null,
  status: 'READY',
  revision: 1,
  tasks: [
    {
      task_id: 'task-web', capability: 'web_generate', domain: 'web', engine: 'web', goal: 'generate website', depends_on: [],
      state: 'READY', attempt: 0, max_attempts: 3, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false
    },
    {
      task_id: 'task-auto', capability: 'automation', domain: 'automation', engine: 'automation', goal: 'normalize lead', depends_on: [],
      state: 'READY', attempt: 0, max_attempts: 3, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false
    },
    {
      task_id: 'task-auto-2', capability: 'automation', domain: 'automation', engine: 'automation', goal: 'mark lead ready', depends_on: ['task-auto'],
      state: 'READY', attempt: 0, max_attempts: 3, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false
    }
  ],
  events: [],
  safeguards: {}
};

const automationContracts = {
  'task-auto': {
    goal: 'normalize lead',
    steps: [{ id: 'normalize', type: 'transform', config: { mode: 'set', field: 'normalized', value: true } }]
  },
  'task-auto-2': {
    goal: 'mark lead ready',
    steps: [{ id: 'ready', type: 'transform', config: { mode: 'set', field: 'ready', value: true } }]
  }
};

const manifest = missionExecutionRouterManifest();
assert.equal(manifest.version, '4.6');
assert.deepEqual(manifest.supported_engines, ['web', 'automation']);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.automatic_cross_factory_execution, false);

const blocked = await executeMissionTask(structuredClone(mission), 'task-auto', {}, { automation_contract: automationContracts['task-auto'] });
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'ADAPTER_DISPATCH_APPROVAL_REQUIRED');

const executed = await executeReadyMissionTasks(
  structuredClone(mission),
  { web: { authorized: true }, automation: { authorized: true } },
  {
    automation_contracts: automationContracts,
    web: { project_slug: 'mission-v46-demo', project_name: 'Mission V46 Demo' },
    automation: { input: { lead_id: 42 } }
  }
);

assert.equal(executed.ok, true);
assert.equal(executed.production_deploy, false);
assert.equal(executed.automatic_cross_factory_execution, false);
assert.equal(executed.executed_count, 3);
assert.deepEqual(executed.pending_external_tasks, ['task-web']);

const web = executed.mission.tasks.find((task) => task.task_id === 'task-web');
const auto = executed.mission.tasks.find((task) => task.task_id === 'task-auto');
const auto2 = executed.mission.tasks.find((task) => task.task_id === 'task-auto-2');
assert.equal(web.state, 'RUNNING');
assert.equal(web.inputs.factory_request.production_deploy, false);
assert.equal(auto.state, 'COMPLETED');
assert.equal(auto.outputs.result.normalized, true);
assert.equal(auto2.state, 'COMPLETED');
assert.equal(auto2.outputs.result.ready, true);

console.log('mission-execution-router-smoke: ok');
