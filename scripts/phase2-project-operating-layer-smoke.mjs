import assert from 'node:assert/strict';
import { prepareCustomerProject, runCustomerProjectMission } from '../src/project-control-plane.js';
import { transitionCustomerProject, projectOperatingLayerManifest } from '../src/project-operating-layer.js';

const prepared = prepareCustomerProject({
  customer_id: 'baeckerei-mueller',
  project_id: 'digital-system-v1',
  name: 'Bäckerei Müller Digital System',
  objective: 'Baue eine Website mit CRM, Support KI und automatischem Lead Flow inklusive Kontaktformular.',
  budget_cost_units: 100,
  actor: 'operator'
});
assert.equal(prepared.ok, true);
assert.equal(prepared.readiness.ready, true);
assert.equal(prepared.project.scope_key, 'baeckerei-mueller:digital-system-v1');
assert.deepEqual(new Set(prepared.blueprint.factories), new Set(['web','business','ai','automation']));
assert.ok(prepared.project.capabilities.some((item) => item.id === 'website'));
assert.ok(prepared.project.capabilities.some((item) => item.id === 'crm'));
assert.ok(prepared.project.capabilities.some((item) => item.id === 'support-ai'));
assert.ok(prepared.project.capabilities.some((item) => item.id === 'lead-flow'));

const ready = transitionCustomerProject(prepared.project, { state: 'READY', actor: 'operator' });
assert.equal(ready.ok, true);
const active = transitionCustomerProject(ready.project, { state: 'ACTIVE', actor: 'operator' });
assert.equal(active.ok, true);
assert.equal(active.project.state, 'ACTIVE');

const result = await runCustomerProjectMission(active.project, {
  prompt: 'Erstelle Website, CRM, Support KI und automatischen Lead Flow für Bäckerei Müller.'
}, {
  runtime: { enabled: true, providers: [], limit_cost_units: 100 }
});
assert.equal(result.ok, true);
assert.equal(result.mission_result.stage, 'runtime_governance');
assert.equal(result.mission_result.user_action_required, true);
assert.equal(result.mission_result.production_deploy, false);
assert.ok(result.mission_result.runtime.blockers.some((item) => item.code === 'PROVIDER_ROUTE_NOT_FOUND'));
assert.equal(result.project.missions.length, 1);

const manifest = projectOperatingLayerManifest();
assert.equal(manifest.customer_project_isolation, true);
assert.equal(manifest.production_deploy, false);
console.log(JSON.stringify({ ok: true, suite: 'phase2-project-operating-layer', scope: active.project.scope_key, stage: result.mission_result.stage }, null, 2));
