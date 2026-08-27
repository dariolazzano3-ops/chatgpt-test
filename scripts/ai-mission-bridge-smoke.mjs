import assert from 'node:assert/strict';
import { executeAIMissionTask, aiMissionBridgeManifest } from '../src/ai-mission-bridge.js';

const mission = {
  mission_id: 'mission-v47-ai-smoke', orchestration_id: 'orch-v47-ai', prompt: 'summarize lead', project: null, status: 'READY', revision: 1,
  tasks: [{ task_id: 'task-ai', capability: 'ai', domain: 'ai', engine: 'ai', goal: 'summarize lead', depends_on: [], state: 'READY', attempt: 0, max_attempts: 2, inputs: {}, outputs: {}, external_job_id: null, production_deploy: false }],
  events: [], safeguards: {}
};

const manifest = aiMissionBridgeManifest();
assert.equal(manifest.version, '4.7');
assert.equal(manifest.explicit_dispatch_approval, true);
assert.equal(manifest.external_side_effects, false);
assert.equal(manifest.production_deploy, false);

const blocked = await executeAIMissionTask(structuredClone(mission), 'task-ai', {}, { runner: async () => ({ output: 'never' }) });
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'ADAPTER_DISPATCH_APPROVAL_REQUIRED');

const missingRunner = await executeAIMissionTask(structuredClone(mission), 'task-ai', { authorized: true }, {});
assert.equal(missingRunner.ok, false);
assert.equal(missingRunner.error, 'AI_RUNNER_NOT_CONFIGURED');

let calls = 0;
const completed = await executeAIMissionTask(structuredClone(mission), 'task-ai', { authorized: true }, {
  input: { lead: 'Müller GmbH' },
  runner: async (request) => {
    calls += 1;
    assert.equal(request.constraints.allow_tools, false);
    assert.equal(request.constraints.allow_external_data, false);
    assert.equal(request.constraints.production_deploy, false);
    return { output: `Summary: ${request.input.lead}`, provider: 'mock', model: 'mock-v1', external_side_effects: false, production_deploy: false };
  }
});
assert.equal(completed.ok, true);
assert.equal(calls, 1);
assert.equal(completed.mission.tasks[0].state, 'COMPLETED');
assert.equal(completed.mission.tasks[0].outputs.ai_output, 'Summary: Müller GmbH');
assert.equal(completed.mission.tasks[0].outputs.provider, 'mock');
assert.equal(completed.production_deploy, false);
assert.equal(completed.external_side_effects, false);

console.log('ai-mission-bridge-smoke: ok');
