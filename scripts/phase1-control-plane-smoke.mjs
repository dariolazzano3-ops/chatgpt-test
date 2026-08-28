import assert from 'node:assert/strict';
import { createProviderRegistry, routeProvider } from '../src/runtime-governance.js';
import { createCostLedger, reserveCost, settleCost, releaseCost } from '../src/runtime-cost-ledger.js';
import { createApprovalRecord, evaluateApproval } from '../src/runtime-approvals.js';
import { createProjectBoundary, authorizeProjectWrite } from '../src/runtime-project-boundary.js';
import { buildProviderAttemptPlan } from '../src/provider-runtime.js';
import { evaluateMissionRuntime, runtimeControlPlaneManifest } from '../src/runtime-control-plane.js';
import { runMissionPipeline, missionPipelineManifest } from '../src/mission-pipeline.js';

const scope = { customer_id: 'customer-a', project_id: 'project-a' };
const noop = async () => ({ ok: true });
const registry = createProviderRegistry([
  { id: 'web-local', capability: 'web.build', enabled: true, external: false, paid: false, estimated_cost_units: 0, runner: noop },
  { id: 'ai-primary', capability: 'ai.generate', enabled: true, external: true, paid: true, estimated_cost_units: 3, priority: 10, runner: noop, fallback_ids: ['ai-fallback'] },
  { id: 'ai-fallback', capability: 'ai.generate', enabled: true, external: true, paid: false, estimated_cost_units: 1, priority: 20, runner: noop }
]);

const route = routeProvider(registry, { capability: 'ai.generate' });
assert.equal(route.ok, true);
assert.equal(buildProviderAttemptPlan(route, { 'ai-primary': { status: 'down' } }).primary_provider_id, 'ai-fallback');

const ledgerCreated = createCostLedger({ ...scope, limit_cost_units: 10 });
assert.equal(ledgerCreated.ok, true);
const reserved = reserveCost(ledgerCreated.ledger, { reservation_id: 'r1', cost_units: 3, provider_id: 'ai-primary', capability: 'ai.generate' });
assert.equal(reserved.ok, true);
assert.equal(reserved.ledger.remaining_cost_units, 7);
const settled = settleCost(reserved.ledger, { reservation_id: 'r1', actual_cost_units: 2 });
assert.equal(settled.ok, true);
assert.equal(settled.ledger.spent_cost_units, 2);
const reserved2 = reserveCost(settled.ledger, { reservation_id: 'r2', cost_units: 2 });
const released = releaseCost(reserved2.ledger, { reservation_id: 'r2', reason: 'not-used' });
assert.equal(released.ok, true);
assert.equal(released.ledger.reserved_cost_units, 0);

const approvals = [
  createApprovalRecord({ ...scope, approval_type: 'provider_cost', actor_id: 'operator', provider_id: 'ai-primary', capability: 'ai.generate', granted: true }).approval,
  createApprovalRecord({ ...scope, approval_type: 'external_provider', actor_id: 'operator', provider_id: 'ai-primary', capability: 'ai.generate', granted: true }).approval
];
assert.equal(evaluateApproval(approvals, { ...scope, approval_type: 'provider_cost', provider_id: 'ai-primary', capability: 'ai.generate' }).approved, true);
assert.equal(evaluateApproval(approvals, { customer_id: 'customer-b', project_id: 'project-a', approval_type: 'provider_cost' }).approved, false);

const boundary = createProjectBoundary({ ...scope }).boundary;
assert.equal(authorizeProjectWrite(boundary, { ...scope, path: 'projects/project-a/src/index.js' }).authorized, true);
assert.equal(authorizeProjectWrite(boundary, { ...scope, path: 'src/core.js' }).authorized, false);
assert.equal(authorizeProjectWrite(boundary, { customer_id: 'customer-b', project_id: 'project-a', path: 'projects/project-a/src/index.js' }).authorized, false);

const pkg = {
  mission: { mission_id: 'mission-a', project: 'project-a', tasks: [
    { task_id: 'web-1', domain: 'web' },
    { task_id: 'ai-1', domain: 'ai' }
  ] }
};
const runtime = evaluateMissionRuntime(pkg, { ...scope, registry, limit_cost_units: 10, approvals });
assert.equal(runtime.ok, true);
assert.equal(runtime.blocked, false);
assert.equal(runtime.scope.scope_key, 'customer-a:project-a');
assert.equal(runtime.ledger.reserved_cost_units, 3);
assert.equal(runtime.project_boundary.scope_key, 'customer-a:project-a');

const blockedRuntime = evaluateMissionRuntime(pkg, { ...scope, registry, limit_cost_units: 2, approvals: [] });
assert.equal(blockedRuntime.blocked, true);
assert.ok(blockedRuntime.blockers.some((item) => item.code === 'PROJECT_BUDGET_EXCEEDED'));
assert.ok(blockedRuntime.blockers.some((item) => item.code === 'PAID_PROVIDER_COST_APPROVAL_REQUIRED'));

const pipelineBlocked = await runMissionPipeline({ prompt: 'Erstelle eine Website', project: 'project-a' }, {
  runtime: { enabled: true, customer_id: 'customer-a', project_id: 'project-a', providers: [] }
});
assert.equal(pipelineBlocked.stage, 'waiting_for_runtime_governance');
assert.equal(pipelineBlocked.user_action_required, true);

const legacyPipeline = await runMissionPipeline({ prompt: 'Erstelle eine Website', project: 'project-a' });
assert.notEqual(legacyPipeline.stage, 'waiting_for_runtime_governance');

assert.equal(runtimeControlPlaneManifest().production_deploy, false);
assert.equal(missionPipelineManifest().runtime_governance_supported, true);
console.log(JSON.stringify({ ok: true, suite: 'phase1-control-plane-smoke', runtime_manifest: runtimeControlPlaneManifest(), pipeline_manifest: missionPipelineManifest() }, null, 2));
