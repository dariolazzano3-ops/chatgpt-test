import assert from 'node:assert/strict';
import { createCommandCenterState, buildCommandCenterSnapshot, evaluateCommand, applyLocalCommand } from '../src/command-center.js';
import { commandCenterRequest } from '../src/command-center-api.js';
import { evaluatePhase5Readiness } from '../src/phase5-readiness.js';

const portfolio = {
  operator_id: 'operator',
  projects: [
    { customer_id: 'c1', project_id: 'p1', scope_key: 'c1:p1', name: 'P1', state: 'ACTIVE', blocked: false, priority: 20, budget_cost_units: 100, capability_count: 4, mission_count: 1, delivery_count: 0, production_deploy: false },
    { customer_id: 'c2', project_id: 'p2', scope_key: 'c2:p2', name: 'P2', state: 'READY', blocked: true, blocker_count: 2, priority: 10, budget_cost_units: 50, capability_count: 2, mission_count: 0, delivery_count: 0, production_deploy: false }
  ],
  production_deploy: false
};
const created = createCommandCenterState({ operator_id: 'operator', portfolio, integration_health: { ai: 'healthy', crm: 'degraded' }, execution_runs: [{ run_id: 'r1', status: 'WAITING_APPROVAL' }] });
assert.equal(created.ok, true);
const snapshot = buildCommandCenterSnapshot(created.state);
assert.equal(snapshot.portfolio.project_count, 2);
assert.equal(snapshot.queue[0].scope_key, 'c2:p2');
assert.equal(snapshot.executions.waiting_count, 1);
assert.equal(snapshot.integrations.degraded_count, 1);
assert.equal(snapshot.provider_readiness.status, 'PROVIDER_SELECTION_COMPLETE');
assert.equal(snapshot.provider_readiness.source_of_truth, 'github_repository_evidence');
assert.equal(snapshot.provider_readiness.factories.web.provider_read_verified, true);
assert.equal(snapshot.provider_readiness.factories.web.staging_deploy_verified, true);
assert.equal(snapshot.provider_readiness.factories.web.evidence.github_actions_run_id, 33285150036);
assert.equal(snapshot.provider_readiness.factories.automation.staging_activation_verified, true);
assert.equal(snapshot.provider_readiness.factories.business.provider_read_verified, true);
assert.equal(snapshot.provider_readiness.factories.business.staging_write_verified, false);
assert.equal(snapshot.provider_readiness.factories.ai.cloudflare_runtime_verified, false);
assert.equal(snapshot.provider_readiness.paid_execution, false);
assert.equal(snapshot.provider_readiness.automatic_paid_overflow, false);
assert.equal(snapshot.provider_readiness.production_deploy, false);

const prioritize = evaluateCommand(created.state, { type: 'PRIORITIZE_PROJECT', scope_key: 'c1:p1', priority: 1 });
assert.equal(prioritize.ready_for_dispatch, true);
const applied = applyLocalCommand(created.state, prioritize);
assert.equal(applied.state.portfolio.projects.find((p) => p.scope_key === 'c1:p1').priority, 1);

const execution = commandCenterRequest(applied.state, { method: 'POST', path: '/commands', body: { type: 'REQUEST_EXECUTION', scope_key: 'c1:p1' } });
assert.equal(execution.status, 202);
assert.equal(execution.user_action_required, true);
const approvedExecution = commandCenterRequest(applied.state, { method: 'POST', path: '/commands', body: { type: 'REQUEST_EXECUTION', scope_key: 'c1:p1', approved: true } }, { dispatch: async () => ({ ok: true }) });
assert.equal(approvedExecution.body.dispatch, 'SUPERVISED_DISPATCH_READY');
assert.equal(typeof approvedExecution.dispatch.fn, 'function');
assert.equal(approvedExecution.production_deploy, false);

const readiness = evaluatePhase5Readiness();
assert.equal(readiness.ready, true);
assert.equal(readiness.status, 'ARCHITECTURE_COMPLETE');
console.log(JSON.stringify({ ok: true, suite: 'phase5-command-center', readiness }, null, 2));
