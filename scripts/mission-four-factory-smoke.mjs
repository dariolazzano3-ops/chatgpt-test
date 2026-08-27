import assert from 'node:assert/strict';
import { createMission } from '../src/orchestration-state.js';
import { executeReadyMissionTasks } from '../src/mission-execution-router.js';
import { reconcileMissionTaskFromWebJob } from '../src/mission-execution-bridge.js';

const created = createMission({
  prompt: 'Baue eine Website, richte ein CRM ein, erstelle eine Support KI und automatisiere den Lead Datenfluss.'
});
assert.equal(created.ok, true);
assert.equal(created.status, 'READY');
const byCapability = Object.fromEntries(created.tasks.map((task) => [task.capability, task]));
for (const capability of ['web_generate', 'business_system_build', 'ai_system_build', 'automation_build']) assert.ok(byCapability[capability], `${capability} missing`);
assert.equal(created.tasks.some((task) => task.state === 'BLOCKED'), false);

const webId = byCapability.web_generate.task_id;
const businessId = byCapability.business_system_build.task_id;
const aiId = byCapability.ai_system_build.task_id;
const automationId = byCapability.automation_build.task_id;
let sawBusinessInAI = false;

const first = await executeReadyMissionTasks(created, {
  web: { authorized: true },
  business: { authorized: true },
  ai: { authorized: true },
  automation: { authorized: true }
}, {
  web: { project_slug: 'mueller-mission', project_name: 'Mueller Mission' },
  business_contracts: {
    [businessId]: {
      goal: 'Configure CRM',
      operations: [
        { id: 'crm', type: 'define_crm', config: { name: 'Mueller CRM', entity: 'lead' } },
        { id: 'pipeline', type: 'configure_pipeline', config: { stages: ['new', 'qualified', 'won'] } }
      ]
    }
  },
  ai: {
    runner: async (request) => {
      sawBusinessInAI = Object.prototype.hasOwnProperty.call(request.input || {}, businessId);
      return { output: 'Support AI configured from CRM context', provider: 'mock', model: 'mock-v1', external_side_effects: false, production_deploy: false };
    }
  },
  automation_contracts: {
    [automationId]: {
      goal: 'Connect completed factory outputs',
      steps: [{ id: 'complete-flow', type: 'transform', config: { mode: 'set', field: 'lead_flow_connected', value: true } }]
    }
  }
});

assert.equal(first.ok, true);
assert.equal(first.mission.tasks.find((task) => task.task_id === webId).state, 'RUNNING');
assert.equal(first.mission.tasks.find((task) => task.task_id === businessId).state, 'COMPLETED');
assert.equal(first.mission.tasks.find((task) => task.task_id === aiId).state, 'COMPLETED');
assert.equal(first.mission.tasks.find((task) => task.task_id === automationId).state, 'WAITING_DEPENDENCIES');
assert.equal(sawBusinessInAI, true);
assert.deepEqual(first.pending_external_tasks, [webId]);

const reconciled = reconcileMissionTaskFromWebJob(first.mission, webId, {
  status: 'READY_FOR_REVIEW',
  job_id: 'mock-web-job',
  project_slug: 'mueller-mission',
  revision: 1,
  commit_sha: 'mocksha',
  preview_url: 'https://example.invalid/preview',
  qa_status: 'passed',
  qa_attempt: 1
});
assert.equal(reconciled.ok, true);
assert.equal(reconciled.mission.tasks.find((task) => task.task_id === automationId).state, 'READY');

const second = await executeReadyMissionTasks(reconciled.mission, { automation: { authorized: true } }, {
  automation_contracts: {
    [automationId]: {
      goal: 'Connect completed factory outputs',
      steps: [{ id: 'complete-flow', type: 'transform', config: { mode: 'set', field: 'lead_flow_connected', value: true } }]
    }
  }
});
assert.equal(second.ok, true);
assert.equal(second.mission.status, 'COMPLETED');
const automationTask = second.mission.tasks.find((task) => task.task_id === automationId);
assert.equal(automationTask.state, 'COMPLETED');
assert.equal(automationTask.outputs.result.lead_flow_connected, true);
assert.ok(automationTask.outputs.result[webId]);
assert.ok(automationTask.outputs.result[businessId]);
assert.ok(automationTask.outputs.result[aiId]);
assert.equal(second.production_deploy, false);
assert.equal(second.automatic_cross_factory_execution, false);
console.log('mission-four-factory-smoke: ok');
