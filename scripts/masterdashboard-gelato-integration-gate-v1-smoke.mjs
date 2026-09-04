import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard } from '../src/operator-project-source-intake-storage-dashboard-v1.js';
import {
  registerProjectSource,
  upsertProjectFact,
  createContentPack,
  createVisualPack,
  recordContentReadiness,
  effectiveProjectWebsiteUsage
} from '../src/project-source-intake-v1.js';
import { compileProjectMissionContext } from '../src/project-mission-context-v1.js';
import { adaptProjectContextToWebMission } from '../src/web-factory/project-context-adapter-v1.js';

const operatorId = 'operator:masterdashboard-gate@example.test';
const gelato = {
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1',
  name: 'Gelato Donatello',
  industry: 'gelateria',
  country: 'DE',
  language: 'de',
  state: 'ACTIVE',
  blocked: false,
  priority: 10,
  budget_cost_units: 0,
  capability_count: 5,
  mission_count: 0,
  delivery_count: 0,
  production_deploy: false
};
const other = {
  customer_id: 'other-customer',
  project_id: 'other-project-v1',
  scope_key: 'other-customer:other-project-v1',
  name: 'Other Project',
  industry: 'services',
  country: 'DE',
  language: 'de',
  state: 'READY',
  blocked: false,
  production_deploy: false
};

const created = createOperatorRuntime({
  operator_id: operatorId,
  portfolio: { operator_id: operatorId, projects: [gelato, other], production_deploy: false }
});
assert.equal(created.ok, true);
created.runtime.selected_project_scope = gelato.scope_key;
const store = createMemoryOperatorRuntimeStore([created.runtime]);
const core = createOperatorRuntimeApiService({ operator_id: operatorId, store });
const service = withProjectSourceIntakeRuntimeService({ service: core, store, operator_id: operatorId });
const authorize = async () => ({ ok: true, status: 200, operator_id: operatorId, email: 'masterdashboard-gate@example.test' });
const options = { runtime_service: service, authorize };

let read = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
assert.equal(read.ok, true);
let state = read.body.state;

let result = registerProjectSource(state, {
  source_id: 'gelato-owned-website',
  source_type: 'OWNED_WEBSITE',
  locator: 'https://gelato.example/',
  display_name: 'Gelato Donatello Website',
  ownership_status: 'OWNED_CONFIRMED',
  website_usage: { content: true, structure_reference: false, design_reference: false }
});
assert.equal(result.ok, true);
state = result.state;

for (const [fact_id, field_path, value] of [
  ['gelato-name', 'business.name', 'Gelato Donatello'],
  ['gelato-offerings', 'business.offerings', ['Eis', 'Eistorten', 'Shakes']],
  ['gelato-goal', 'website.primary_goal', 'Sortiment präsentieren und Anfragen ermöglichen'],
  ['gelato-summary', 'content.summary', 'Gelato Donatello präsentiert Eis, Eistorten und weitere Angebote.']
]) {
  const fact = upsertProjectFact(state, {
    fact_id,
    field_path,
    value,
    origin: 'EXTRACTED',
    verification_status: 'OPERATOR_CONFIRMED',
    source_refs: ['gelato-owned-website']
  });
  assert.equal(fact.ok, true);
  state = fact.state;
}

let packed = createContentPack(state, { pack_id: 'gelato-integration-content-v1' });
assert.equal(packed.ok, true);
state = packed.state;
const contentPack = packed.pack;
packed = createVisualPack(state, { pack_id: 'gelato-integration-visual-v1' });
assert.equal(packed.ok, true);
state = packed.state;
const visualPack = packed.pack;
const readiness = recordContentReadiness(state, {
  readiness_id: 'gelato-integration-readiness-v1',
  production_locked: true,
  requires_assets: false
});
assert.equal(readiness.ok, true);
assert.notEqual(readiness.snapshot.status, 'BLOCKED');
state = readiness.state;

const websiteSource = state.sources.find((source) => source.source_id === 'gelato-owned-website');
const websiteUsage = effectiveProjectWebsiteUsage(websiteSource);
assert.deepEqual(websiteUsage.effective_usage, {
  content: true,
  structure_reference: false,
  design_reference: false
});
assert.equal(contentPack.canonical_values['business.name'], 'Gelato Donatello');
assert.equal(Object.keys(visualPack.brand_information || {}).length, 0);
assert.equal((visualPack.visual_references || []).length, 0);

const contextResult = compileProjectMissionContext(state, {
  content_pack: contentPack,
  visual_pack: visualPack,
  readiness: readiness.snapshot,
  deployment_policy: { staging_only: true, production_deploy: false }
});
assert.equal(contextResult.ok, true);
const context = contextResult.context;
assert.equal(context.project.scope_key, gelato.scope_key);
const contextWebsite = context.website_sources.find((source) => source.source_id === 'gelato-owned-website');
assert.deepEqual(contextWebsite.effective_usage, {
  content: true,
  structure_reference: false,
  design_reference: false
});

const web = adaptProjectContextToWebMission(context, {});
assert.equal(web.ok, true);
assert.equal(web.mission.business_name, 'Gelato Donatello');
assert.equal(web.mission.project_scope_key, gelato.scope_key);
assert.deepEqual(web.mission.reference_sites, []);
assert.deepEqual(web.mission.design_reference_sites, []);
assert.deepEqual(web.mission.structure_reference_sites, []);
assert.equal(web.mission.existing_website, null);
assert.equal(web.mission.website_reference_policy.content_copy_allowed, false);
assert.equal(web.mission.website_reference_policy.logo_clone_allowed, false);
assert.equal(web.mission.website_reference_policy.pixel_clone_allowed, false);
assert.equal(web.mission.production_deploy, false);

const saved = await service.saveProjectSourceIntake({
  state,
  expected_revision: read.body.runtime_revision,
  event: 'MASTERDASHBOARD_GELATO_INTEGRATION_SOURCE_READY'
});
assert.equal(saved.ok, true);

async function call(path, init = {}) {
  const response = await handleOperatorDashboard(
    new Request('https://operator.example.test' + path, init),
    {},
    {},
    options
  );
  assert.ok(response, 'operator handler must return a response for ' + path);
  const type = response.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
}

const shell = await call('/operator');
assert.equal(shell.response.status, 200);
assert.equal((shell.body.match(/<div class="app">/g) || []).length, 1, 'one operator shell');
assert.equal((shell.body.match(/<nav class="nav"/g) || []).length, 1, 'one primary navigation');
assert.match(shell.body, /<html lang="de">/);
assert.match(shell.body, /function humanStatus\(/);
assert.match(shell.body, /function humanEvent\(/);
assert.match(shell.body, /function humanCostState\(/);
assert.match(shell.body, /function formatOperatorTimestamp\(/);
assert.match(shell.body, /function renderStructuredHumanValue\(/);
assert.match(shell.body, /timeZone:'Europe\/Berlin'/);
assert.match(shell.body, /year:'numeric'/);
assert.match(shell.body, /@media\(max-width:760px\)/);
assert.match(shell.body, /Technische Details/);
assert.match(shell.body, /Website-Art/);
assert.match(shell.body, /data-source-use-content/);
assert.equal(shell.body.includes('[object Object]'), false);
assert.equal(shell.body.includes('Number(v||0)'), false);

const sourceView = await call('/operator/api/project-source-intake?scope_key=' + encodeURIComponent(gelato.scope_key));
assert.equal(sourceView.response.status, 200);
const sourceCard = sourceView.body.workspace.sections.project_sources.find((source) => source.source_id === 'gelato-owned-website');
assert.ok(sourceCard);
assert.deepEqual(sourceCard.effective_usage, {
  content: true,
  structure_reference: false,
  design_reference: false
});

const beforeProject = await call('/operator/api/project-detail/' + encodeURIComponent(gelato.scope_key));
assert.equal(beforeProject.response.status, 200);
assert.equal(beforeProject.body.project.scope_key, gelato.scope_key);

const mismatch = await call('/operator/api/mission-preflight', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: gelato.scope_key,
    context_scope_key: other.scope_key,
    mission_text: 'Ungültiger Cross-Project-Test',
    requested_outcomes: ['Website']
  })
});
assert.equal(mismatch.response.status, 409);
assert.equal(mismatch.body.error, 'MISSION_PROJECT_CONTEXT_MISMATCH');

const preflight = await call('/operator/api/mission-preflight', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: gelato.scope_key,
    context_scope_key: gelato.scope_key,
    industry: 'gelateria',
    country: 'DE',
    language: 'de',
    mission_text: 'Erstelle einen rein synthetischen internen Website-Testplan für Gelato Donatello ohne Production und ohne externe Writes.',
    requested_outcomes: ['Website'],
    known_constraints: ['staging only', 'no production', 'no DNS', 'no billing', 'synthetic data only', 'zero variable cost']
  })
});
assert.equal(preflight.response.status, 201);
assert.equal(preflight.body.status, 'APPROVAL_REQUIRED');
assert.equal(preflight.body.execution_started, false);
assert.equal(preflight.body.mission.customer_id, gelato.customer_id);
assert.equal(preflight.body.mission.project_id, gelato.project_id);
assert.equal(preflight.body.preflight.estimated_variable_cost_eur, 0);
assert.equal(preflight.body.production_deploy, false);

const approved = await call('/operator/api/mission-plan-decision', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    plan_token: preflight.body.plan_token,
    decision: 'approve',
    confirmation_text: 'CONFIRM_SYNTHETIC_STAGING'
  })
});
assert.equal(approved.response.status, 201);
assert.equal(approved.body.variable_cost_eur, 0);
assert.equal(approved.body.real_provider_calls, 0);
assert.equal(approved.body.external_writes, 0);
assert.equal(approved.body.production_deploy, false);
assert.equal(approved.body.quality_score, 100);

const deliveries = await call('/operator/api/deliveries');
assert.equal(deliveries.response.status, 200);
const delivery = deliveries.body.universal_missions.find((item) => item.mission_id === preflight.body.mission.mission_id);
assert.ok(delivery);
assert.equal(delivery.execution_evidence.variable_cost_eur, 0);
assert.equal(delivery.execution_evidence.real_provider_calls, 0);
assert.equal(delivery.execution_evidence.external_writes, 0);
assert.equal(delivery.production_deploy, false);

const costs = await call('/operator/api/costs');
assert.equal(costs.response.status, 200);
assert.equal(costs.body.automatic_paid_overflow, false);
assert.equal(costs.body.production_deploy, false);
assert.ok(['ESTIMATED_ZERO','VERIFIED_ACTUAL','UNKNOWN','NOT_RECONCILED'].includes(costs.body.variable_cost_state));

const audit = await call('/operator/api/audit');
assert.equal(audit.response.status, 200);
assert.ok((audit.body.items || []).some((item) => item.scope_key === gelato.scope_key && item.event === 'MISSION_PLAN_CREATED'));
assert.ok((audit.body.items || []).some((item) => item.scope_key === gelato.scope_key && /APPROV/.test(item.event || '')));

const afterProject = await call('/operator/api/project-detail/' + encodeURIComponent(gelato.scope_key));
assert.equal(afterProject.response.status, 200);
assert.equal(afterProject.body.project.scope_key, gelato.scope_key);

const runtimeAfter = await store.load(operatorId);
assert.equal(runtimeAfter.selected_project_scope, gelato.scope_key);
assert.equal(runtimeAfter.safety.production_deploy, false);
assert.equal(runtimeAfter.safety.external_writes, false);
assert.equal(runtimeAfter.safety.variable_cost_eur, 0);
assert.equal((runtimeAfter.universal_runs || []).length, 1);

console.log(JSON.stringify({
  ok: true,
  suite: 'masterdashboard-gelato-integration-gate-v1',
  one_operator_shell: true,
  one_project_context: true,
  one_navigation_model: true,
  human_presentation_foundation: true,
  source_purpose_propagation: 'PASS',
  mission_scope_safety: 'PASS',
  synthetic_execution: 'PASS',
  quality_score: approved.body.quality_score,
  variable_cost_eur: approved.body.variable_cost_eur,
  real_provider_calls: approved.body.real_provider_calls,
  external_writes: approved.body.external_writes,
  production_deploy: false
}, null, 2));
