import assert from 'node:assert/strict';
import { executeReadyMissionTasks, missionExecutionRouterManifest } from '../src/mission-execution-router.js';

const mission = {
  mission_id: 'mission-v47-router', orchestration_id: 'orch-v47-router', prompt: 'normalize and summarize lead', project: null, status: 'READY', revision: 1,
  tasks: [
    { task_id: 'normalize', capability: 'automation', domain: 'automation', engine: 'automation', goal: 'normalize lead', depends_on: [], state: 'READY', attempt: 0, max_attempts: 2, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false },
    { task_id: 'summarize', capability: 'ai', domain: 'ai', engine: 'ai', goal: 'summarize normalized lead', depends_on: ['normalize'], state: 'READY', attempt: 0, max_attempts: 2, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false }
  ], events: [], safeguards: {}
};

const manifest = missionExecutionRouterManifest();
assert.equal(manifest.version, '4.7');
assert.deepEqual(manifest.supported_engines, ['web', 'automation', 'ai']);

let aiCalls = 0;
const result = await executeReadyMissionTasks(
  mission,
  { automation: { authorized: true }, ai: { authorized: true } },
  {
    automation_contracts: {
      normalize: { goal: 'normalize', steps: [{ id: 'set', type: 'transform', config: { mode: 'set', field: 'normalized', value: true } }] }
    },
    ai: {
      runner: async (request) => {
        aiCalls += 1;
        assert.equal(request.input.normalize.result.normalized, true);
        return { output: 'Normalized lead is ready.', provider: 'mock', model: 'mock-v1' };
      }
    }
  }
);

assert.equal(result.ok, true);
assert.equal(result.executed_count, 2);
assert.equal(result.pending_external_tasks.length, 0);
assert.equal(aiCalls, 1);
assert.equal(result.mission.tasks.find((task) => task.task_id === 'normalize').state, 'COMPLETED');
assert.equal(result.mission.tasks.find((task) => task.task_id === 'summarize').state, 'COMPLETED');
assert.equal(result.mission.tasks.find((task) => task.task_id === 'summarize').outputs.ai_output, 'Normalized lead is ready.');
assert.equal(result.production_deploy, false);
assert.equal(result.automatic_cross_factory_execution, false);

console.log('mission-router-ai-smoke: ok');
