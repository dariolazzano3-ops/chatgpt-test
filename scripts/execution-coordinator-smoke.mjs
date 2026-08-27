import assert from 'node:assert/strict';
import { buildOrchestrationPlan } from '../src/orchestration-planner.js';
import { createMission } from '../src/orchestration-state.js';
import { executeMissionTask } from '../src/execution-coordinator.js';
import { runWebFactoryAdapter, buildWebFactoryInvocation } from '../src/web-factory-adapter.js';
import { buildTaskExecutionContract } from '../src/orchestration-state.js';
import { buildAdapterDispatchEnvelope } from '../src/execution-adapters.js';

const plan = buildOrchestrationPlan({ prompt: 'Baue eine Website', project: 'v39-smoke' });
assert.equal(plan.ok, true);
const mission = createMission({ plan });
const task = mission.tasks.find((item) => item.state === 'READY');
assert.ok(task);

const unauthorized = await executeMissionTask(mission, task.task_id, { runner: async () => ({ status: 'COMPLETED', outputs: {} }) });
assert.equal(unauthorized.error, 'ADAPTER_DISPATCH_NOT_AUTHORIZED');
assert.equal(unauthorized.mission.tasks.find((item) => item.task_id === task.task_id).state, 'READY');

const completed = await executeMissionTask(mission, task.task_id, {
  authorize_dispatch: true,
  runner: async (envelope) => ({ status: 'COMPLETED', outputs: { preview_url: `https://preview.invalid/${envelope.task_id}` }, production_deploy: false }),
});
assert.equal(completed.ok, true);
assert.equal(completed.mission.tasks.find((item) => item.task_id === task.task_id).state, 'COMPLETED');
assert.ok(completed.mission.tasks.find((item) => item.task_id === task.task_id).outputs.preview_url);
assert.equal(completed.mission.safeguards.production_deploy, false);

const retryPlan = buildOrchestrationPlan({ prompt: 'Baue eine Website', project: 'v39-retry' });
const retryMission = createMission({ plan: retryPlan });
const retryTask = retryMission.tasks.find((item) => item.state === 'READY');
const failed = await executeMissionTask(retryMission, retryTask.task_id, {
  authorize_dispatch: true,
  runner: async () => ({ status: 'FAILED', error: { code: 'TEMPORARY_WEB_FAILURE', retryable: true }, production_deploy: false }),
});
assert.equal(failed.ok, false);
assert.equal(failed.mission.tasks.find((item) => item.task_id === retryTask.task_id).state, 'READY');
assert.equal(failed.mission.tasks.find((item) => item.task_id === retryTask.task_id).attempt, 1);

const contract = buildTaskExecutionContract(mission, task.task_id);
const envelope = buildAdapterDispatchEnvelope(contract);
const invocation = buildWebFactoryInvocation(envelope);
assert.equal(invocation.ok, true);
assert.equal(invocation.production_deploy, false);
assert.equal(invocation.body.limits.auto_deploy, false);
assert.equal(invocation.body.limits.require_approval_before_production, true);

const blockedExecution = await runWebFactoryAdapter(envelope, { authorize_execution: false });
assert.equal(blockedExecution.error.code, 'WEB_FACTORY_EXECUTION_NOT_AUTHORIZED');
assert.equal(blockedExecution.production_deploy, false);

const fakeHandler = async () => new Response(JSON.stringify({ ok: true, project: { slug: 'v39-smoke' }, preview_url: 'https://preview.invalid/real-adapter', production_deployed: false }), { status: 201, headers: { 'content-type': 'application/json' } });
const realBoundary = await runWebFactoryAdapter(envelope, { authorize_execution: true, handler: fakeHandler });
assert.equal(realBoundary.status, 'COMPLETED');
assert.equal(realBoundary.outputs.preview_url, 'https://preview.invalid/real-adapter');
assert.equal(realBoundary.production_deploy, false);

console.log('execution-coordinator-smoke: ok');
