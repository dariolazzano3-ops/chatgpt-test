import assert from 'node:assert/strict';
import {
  createOperatorRuntime,
  buildOperatorRuntimeSnapshot,
  operatorRuntimeManifest
} from '../src/operator-runtime-v1.js';
import {
  operatorRuntimeRequest,
  createOperatorRuntimeApiService,
  operatorRuntimeApiManifest
} from '../src/operator-runtime-api-v1.js';
import { createMemoryOperatorRuntimeStore, operatorRuntimeStoreManifest } from '../src/operator-runtime-store-v1.js';

const portfolio = {
  operator_id: 'operator',
  projects: [
    {
      customer_id: 'customer-a',
      project_id: 'project-a',
      scope_key: 'customer-a:project-a',
      name: 'Synthetic Handwerk A',
      state: 'ACTIVE',
      blocked: false,
      priority: 20,
      budget_cost_units: 0,
      capability_count: 5,
      mission_count: 0,
      delivery_count: 0,
      production_deploy: false
    },
    {
      customer_id: 'customer-b',
      project_id: 'project-b',
      scope_key: 'customer-b:project-b',
      name: 'Synthetic Service B',
      state: 'READY',
      blocked: false,
      priority: 30,
      budget_cost_units: 0,
      capability_count: 3,
      mission_count: 0,
      delivery_count: 0,
      production_deploy: false
    }
  ],
  production_deploy: false
};

const created = createOperatorRuntime({ operator_id: 'operator', portfolio, at: '2026-08-30T12:00:00+02:00' });
assert.equal(created.ok, true);
let runtime = created.runtime;
assert.equal(runtime.revision, 1);
assert.equal(runtime.selected_project_scope, null);
assert.equal(runtime.safety.automatic_dispatch, false);

const health = operatorRuntimeRequest(runtime, { method: 'GET', path: '/health' });
assert.equal(health.status, 200);
assert.equal(health.body.status, 'READY');
assert.equal(health.body.production, 'LOCKED');
assert.equal(health.body.automatic_dispatch, false);

const dashboard = operatorRuntimeRequest(runtime, { method: 'GET', path: '/dashboard' });
assert.equal(dashboard.status, 200);
assert.equal(dashboard.body.schema, 'riosystems.operator-dashboard-view.v1');
assert.equal(dashboard.body.metrics.projects, 2);
assert.equal(dashboard.body.metrics.live_factories, 4);
assert.equal(dashboard.body.metrics.live_e2e_proofs, 1);
assert.equal(dashboard.body.safety_panel.production, 'LOCKED');

const selectA = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: `/projects/${encodeURIComponent('customer-a:project-a')}/select`,
  body: { expected_revision: 1 }
}, { at: '2026-08-30T12:01:00+02:00' });
assert.equal(selectA.status, 200);
assert.equal(selectA.changed, true);
runtime = selectA.runtime;
assert.equal(runtime.revision, 2);
assert.equal(runtime.selected_project_scope, 'customer-a:project-a');

const stale = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: `/projects/${encodeURIComponent('customer-b:project-b')}/select`,
  body: { expected_revision: 1 }
});
assert.equal(stale.status, 409);
assert.equal(stale.body.error, 'RUNTIME_REVISION_CONFLICT');
assert.equal(stale.runtime.revision, 2);

const mission = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: '/universal-missions',
  body: {
    expected_revision: 2,
    mission_text: 'Baue lokale Kundengewinnung mit Website, CRM, automatischem Follow-up und Analytics für den Handwerksbetrieb.',
    industry: 'handwerk',
    country: 'DE',
    language: 'de'
  }
}, { at: '2026-08-30T12:02:00+02:00' });
assert.equal(mission.status, 201);
assert.equal(mission.changed, true);
assert.equal(mission.body.status, 'SIMULATED_HANDOFF_READY');
assert.equal(mission.body.quality_score, 100);
assert.equal(mission.body.variable_cost_eur, 0);
assert.equal(mission.body.real_provider_calls, 0);
assert.equal(mission.body.external_writes, 0);
assert.equal(mission.body.production_deploy, false);
runtime = mission.runtime;
assert.equal(runtime.revision, 3);
assert.equal(runtime.universal_runs.length, 1);
assert.equal(runtime.universal_runs[0].execution.real_providers_involved.length, 0);

const unsafeMission = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: '/universal-missions',
  body: {
    expected_revision: 3,
    mission_text: 'Synthetic unsafe request should be blocked.',
    production_authorized: true
  }
});
assert.equal(unsafeMission.status, 400);
assert.equal(unsafeMission.changed, false);
assert.equal(unsafeMission.runtime.revision, 3);

const missions = operatorRuntimeRequest(runtime, { method: 'GET', path: '/missions' });
assert.equal(missions.status, 200);
assert.equal(missions.body.universal.length, 1);
const missionId = missions.body.universal[0].mission_id;
const missionDetail = operatorRuntimeRequest(runtime, { method: 'GET', path: `/missions/${encodeURIComponent(missionId)}` });
assert.equal(missionDetail.status, 200);
assert.equal(missionDetail.body.kind, 'universal_mission');

const deliveries = operatorRuntimeRequest(runtime, { method: 'GET', path: '/deliveries' });
assert.equal(deliveries.status, 200);
assert.equal(deliveries.body.live_proofs.length, 1);
assert.equal(deliveries.body.universal_missions.length, 1);
assert.equal(deliveries.body.universal_missions[0].execution_evidence.real_provider_calls, 0);

const needsApproval = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: '/commands',
  body: {
    expected_revision: 3,
    type: 'REQUEST_EXECUTION',
    scope_key: 'customer-a:project-a'
  }
});
assert.equal(needsApproval.status, 202);
assert.equal(needsApproval.user_action_required, true);
assert.equal(needsApproval.changed, false);
assert.equal(needsApproval.runtime.revision, 3);

const prioritize = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: '/commands',
  body: {
    expected_revision: 3,
    type: 'PRIORITIZE_PROJECT',
    scope_key: 'customer-a:project-a',
    priority: 1
  }
}, { at: '2026-08-30T12:03:00+02:00' });
assert.equal(prioritize.status, 200);
assert.equal(prioritize.changed, true);
runtime = prioritize.runtime;
assert.equal(runtime.revision, 4);
assert.equal(runtime.command_center_state.portfolio.projects.find((item) => item.scope_key === 'customer-a:project-a').priority, 1);

let dispatchCalls = 0;
const qa = operatorRuntimeRequest(runtime, {
  method: 'POST',
  path: '/commands',
  body: {
    expected_revision: 4,
    type: 'REQUEST_QA',
    scope_key: 'customer-a:project-a'
  }
}, { dispatch: async () => { dispatchCalls += 1; return { ok: true }; }, at: '2026-08-30T12:04:00+02:00' });
assert.equal(qa.status, 202);
assert.equal(qa.body.dispatch_prepared, true);
assert.equal(qa.body.dispatch_executed, false);
assert.equal(dispatchCalls, 0);
runtime = qa.runtime;
assert.equal(runtime.revision, 5);

const snapshot = buildOperatorRuntimeSnapshot(runtime);
assert.equal(snapshot.ok, true);
assert.equal(snapshot.universal_missions.count, 1);
assert.equal(snapshot.universal_missions.variable_cost_eur, 0);
assert.equal(snapshot.control_plane.safety.production_deploy, false);
assert.equal(snapshot.control_plane.cost.automatic_paid_overflow, false);

const store = createMemoryOperatorRuntimeStore([runtime]);
assert.equal(await store.count(), 1);
const service = createOperatorRuntimeApiService({ operator_id: 'operator', store });
const serviceSelect = await service.handle({
  method: 'POST',
  path: `/projects/${encodeURIComponent('customer-b:project-b')}/select`,
  body: { expected_revision: 5 }
}, { at: '2026-08-30T12:05:00+02:00' });
assert.equal(serviceSelect.status, 200);
assert.equal(serviceSelect.runtime.revision, 6);

const staleService = await service.handle({
  method: 'POST',
  path: `/projects/${encodeURIComponent('customer-a:project-a')}/select`,
  body: { expected_revision: 5 }
});
assert.equal(staleService.status, 409);
assert.equal(staleService.body.error, 'RUNTIME_REVISION_CONFLICT');
const stored = await store.load('operator');
assert.equal(stored.revision, 6);
assert.equal(stored.selected_project_scope, 'customer-b:project-b');

const runtimeManifest = operatorRuntimeManifest();
const apiManifest = operatorRuntimeApiManifest();
const storeManifest = operatorRuntimeStoreManifest();
assert.equal(runtimeManifest.automatic_dispatch, false);
assert.equal(runtimeManifest.production_deploy, false);
assert.equal(apiManifest.mutations_require_runtime_revision, true);
assert.equal(apiManifest.supervised_dispatch_preparation_only, true);
assert.equal(apiManifest.direct_provider_calls, false);
assert.equal(storeManifest.compare_and_swap, true);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-runtime-api-v1',
  final_revision: stored.revision,
  universal_missions: snapshot.universal_missions.count,
  dispatch_calls: dispatchCalls,
  variable_cost_eur: snapshot.universal_missions.variable_cost_eur,
  production_deploy: false
}, null, 2));
