import assert from 'node:assert/strict';
import { createMission } from '../src/orchestration-state.js';
import { superviseMission, missionSupervisorManifest } from '../src/mission-supervisor.js';

const created = createMission({ prompt: 'Baue eine Website, richte ein CRM ein, erstelle eine Support KI und automatisiere den Lead Datenfluss.' });
assert.equal(created.ok, true);
const byCapability = Object.fromEntries(created.tasks.map((task) => [task.capability, task.task_id]));
const persisted = [];
let dispatchCalls = 0;
let observeCalls = 0;
let aiCalls = 0;

const result = await superviseMission(created, {
  web: { authorized: true }, business: { authorized: true }, ai: { authorized: true }, automation: { authorized: true }
}, {
  max_rounds: 10,
  web: { project_slug: 'mueller-supervised', project_name: 'Mueller Supervised' },
  business_contracts: {
    [byCapability.business_system_build]: {
      goal: 'Configure CRM',
      operations: [
        { id: 'crm', type: 'define_crm', config: { name: 'Mueller CRM' } },
        { id: 'pipeline', type: 'configure_pipeline', config: { stages: ['new', 'qualified', 'won'] } }
      ]
    }
  },
  ai: {
    runner: async (request) => {
      aiCalls += 1;
      assert.ok(request.input[byCapability.business_system_build]);
      return { output: 'Support AI ready', provider: 'mock', model: 'mock-v1', external_side_effects: false, production_deploy: false };
    }
  },
  automation_contracts: {
    [byCapability.automation_build]: {
      goal: 'Connect lead flow',
      steps: [{ id: 'connect', type: 'transform', config: { mode: 'set', field: 'lead_flow_connected', value: true } }]
    }
  },
  dispatch_web: async ({ request }) => {
    dispatchCalls += 1;
    assert.equal(request.production_deploy, false);
    return { job_id: 'mock-web-job-v49', request_ref: 'factory-requests/mock-v49.json', production_deploy: false };
  },
  observe_web: async ({ job_id }) => {
    observeCalls += 1;
    assert.equal(job_id, 'mock-web-job-v49');
    return { status: 'READY_FOR_REVIEW', job_id, project_slug: 'mueller-supervised', revision: 1, commit_sha: 'mocksha', preview_url: 'https://example.invalid/preview', qa_status: 'passed', qa_attempt: 1 };
  },
  persist: async (mission, metadata) => {
    persisted.push({ status: mission.status, revision: mission.revision, reason: metadata.reason, task_id: metadata.task_id });
  }
});

assert.equal(result.ok, true);
assert.equal(result.completed, true);
assert.equal(result.mission_status, 'COMPLETED');
assert.equal(dispatchCalls, 1);
assert.ok(observeCalls >= 1);
assert.equal(aiCalls, 1);
assert.ok(persisted.length >= 4);
assert.equal(result.pending_web_tasks.length, 0);
assert.equal(result.ready_but_not_executed.length, 0);
assert.equal(result.production_deploy, false);
assert.equal(result.automatic_multi_factory_execution, false);
assert.equal(result.supervision_required, true);
const automation = result.mission.tasks.find((task) => task.task_id === byCapability.automation_build);
assert.equal(automation.state, 'COMPLETED');
assert.equal(automation.outputs.result.lead_flow_connected, true);
assert.ok(automation.outputs.result[byCapability.web_generate]);
assert.ok(automation.outputs.result[byCapability.business_system_build]);
assert.ok(automation.outputs.result[byCapability.ai_system_build]);

const manifest = missionSupervisorManifest();
assert.equal(manifest.version, '4.9');
assert.equal(manifest.durable_persistence_hook, true);
assert.equal(manifest.explicit_adapter_approval_required, true);
assert.equal(manifest.automatic_multi_factory_execution, false);
assert.equal(manifest.production_deploy, false);
console.log('mission-supervisor-smoke: ok');
