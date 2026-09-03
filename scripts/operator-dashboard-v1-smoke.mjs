import assert from 'node:assert/strict';
import {
  authorizeOperator,
  handleOperatorDashboard,
  operatorDashboardHttpManifest,
  operatorDashboardStatusMeta
} from '../src/operator-dashboard-http-v1.js';

const base = 'https://operator.test';
const operatorId = 'operator:dashboard-smoke';
const authorize = async () => ({ ok: true, operator_id: operatorId, email: 'operator@example.test' });

async function request(path, { method = 'GET', body = null, options = {} } = {}) {
  const headers = body ? { 'content-type': 'application/json' } : {};
  const response = await handleOperatorDashboard(
    new Request(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    {},
    {},
    { authorize, ...options }
  );
  assert.ok(response, `expected operator response for ${path}`);
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  return { response, payload };
}

const outside = await handleOperatorDashboard(new Request(`${base}/factory`), {}, {}, { authorize });
assert.equal(outside, null);

const unauthenticated = await handleOperatorDashboard(new Request(`${base}/operator/api/dashboard`), {}, {});
assert.equal(unauthenticated.status, 503);
assert.equal((await unauthenticated.json()).error, 'OPERATOR_ACCESS_NOT_CONFIGURED');

const deniedNoAccess = await authorizeOperator(
  new Request(`${base}/operator`),
  { RIOSYSTEMS_OPERATOR_EMAIL: 'operator@example.test', RIOSYSTEMS_ACCESS_AUD: 'aud-1' },
  {}
);
assert.equal(deniedNoAccess.ok, false);
assert.equal(deniedNoAccess.error, 'CLOUDFLARE_ACCESS_REQUIRED');

const deniedAudience = await authorizeOperator(
  new Request(`${base}/operator`),
  { RIOSYSTEMS_OPERATOR_EMAIL: 'operator@example.test', RIOSYSTEMS_ACCESS_AUD: 'aud-1' },
  { access: { aud: 'wrong-aud', getIdentity: async () => ({ email: 'operator@example.test' }) } }
);
assert.equal(deniedAudience.ok, false);
assert.equal(deniedAudience.error, 'CLOUDFLARE_ACCESS_AUDIENCE_MISMATCH');

const allowedIdentity = await authorizeOperator(
  new Request(`${base}/operator`),
  { RIOSYSTEMS_OPERATOR_EMAIL: 'operator@example.test', RIOSYSTEMS_ACCESS_AUD: 'aud-1' },
  { access: { aud: 'aud-1', getIdentity: async () => ({ email: 'operator@example.test' }) } }
);
assert.equal(allowedIdentity.ok, true);
assert.equal(allowedIdentity.operator_id, 'operator:operator@example.test');

const shell = await request('/operator');
assert.equal(shell.response.status, 200);
assert.match(shell.payload, /Private Operator Control Plane/);
assert.match(shell.payload, /Mission Studio/);
assert.match(shell.payload, /System Health/);
assert.match(shell.payload, /aria-label="Hauptnavigation"/);
assert.match(shell.payload, /@media\(max-width:760px\)/);
assert.doesNotMatch(shell.payload, /projects\.items\?\.\[0\]/);
assert.match(shell.payload, /Mission für <span id="mission-project-name">/);
assert.match(shell.payload, /name="requested_outcomes" value="Website"/);
assert.match(shell.payload, /name="requested_outcomes" value="KI-Unterstützung"/);
assert.match(shell.payload, /textarea name="mission_text" required lang="de" spellcheck="true"/);
assert.match(shell.response.headers.get('content-security-policy'), /frame-ancestors 'none'/);

const dashboard = await request('/operator/api/dashboard');
assert.equal(dashboard.response.status, 200);
assert.equal(dashboard.payload.schema, 'riosystems.operator-dashboard-view.v1');
assert.equal(dashboard.payload.metrics.projects, 3);
assert.equal(dashboard.payload.safety_panel.production, 'LOCKED');

const projects = await request('/operator/api/projects');
assert.equal(projects.payload.items.length, 3);
const bakery = projects.payload.items.find((item) => item.name === 'Bäckerei Müller');
const craft = projects.payload.items.find((item) => item.name === 'Muster Handwerksbetrieb');
assert.ok(bakery);
assert.ok(craft);
assert.notEqual(bakery.customer_id, craft.customer_id);
assert.notEqual(bakery.project_id, craft.project_id);

const beforeMissions = await request('/operator/api/missions');
assert.equal(beforeMissions.payload.universal.length, 0);

const missingScopePreflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: { mission_text: 'Diese Mission darf ohne explizites Projekt nicht starten.' }
});
assert.equal(missingScopePreflight.response.status, 400);
assert.equal(missingScopePreflight.payload.error, 'MISSION_PROJECT_SCOPE_REQUIRED');

const mismatchedContextPreflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: {
    scope_key: bakery.scope_key,
    context_scope_key: craft.scope_key,
    mission_text: 'Diese Mission muss am sichtbaren Project Context scheitern.'
  }
});
assert.equal(mismatchedContextPreflight.response.status, 409);
assert.equal(mismatchedContextPreflight.payload.error, 'MISSION_PROJECT_CONTEXT_MISMATCH');

const maliciousPreflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: {
    scope_key: bakery.scope_key,
    industry: 'bakery',
    country: 'DE',
    language: 'de',
    mission_text: 'Modernisiere die Website, verbessere lokale Kundengewinnung, strukturiere Anfragen im CRM und automatisiere Follow-up mit Analytics.',
    requested_outcomes: ['Website', 'Growth Plan', 'CRM', 'Follow-up', 'Analytics'],
    production_authorized: true,
    environment: 'production',
    budget_policy: { variable_cost_ceiling_eur: 999, paid_overflow: true },
    data_policy: { synthetic_only: false, real_customer_data: true }
  }
});
assert.equal(maliciousPreflight.response.status, 201);
assert.equal(maliciousPreflight.payload.status, 'APPROVAL_REQUIRED');
assert.equal(maliciousPreflight.payload.execution_started, false);
assert.equal(maliciousPreflight.payload.mission.environment, 'staging');
assert.equal(maliciousPreflight.payload.mission.production_authorized, false);
assert.equal(maliciousPreflight.payload.mission.data_policy.synthetic_only, true);
assert.equal(maliciousPreflight.payload.mission.data_policy.real_customer_data, false);
assert.equal(maliciousPreflight.payload.mission.budget_policy.variable_cost_ceiling_eur, 0);
assert.equal(maliciousPreflight.payload.mission.budget_policy.paid_overflow, false);
assert.equal(maliciousPreflight.payload.preflight.estimated_variable_cost_eur, 0);
assert.equal(maliciousPreflight.payload.preflight.external_writes_authorized, false);
assert.ok(maliciousPreflight.payload.plan.selected_capabilities.some((item) => item.capability === 'web_presence'));
assert.ok(maliciousPreflight.payload.plan.selected_capabilities.some((item) => item.capability === 'business_crm'));
assert.ok(maliciousPreflight.payload.plan.selected_capabilities.every((item) => item.provider.estimated_variable_cost_eur === 0));

const stillNoMission = await request('/operator/api/missions');
assert.equal(stillNoMission.payload.universal.length, 0);

const approvalCenter = await request('/operator/api/approvals');
assert.equal(approvalCenter.payload.schema, 'riosystems.operator-approval-center.v2');
assert.equal(approvalCenter.payload.mission_plans.length, 1);
assert.equal(approvalCenter.payload.mission_plans[0].status, 'APPROVAL_REQUIRED');

const approved = await request('/operator/api/mission-approve', {
  method: 'POST',
  body: { plan_token: maliciousPreflight.payload.plan_token }
});
assert.equal(approved.response.status, 201);
assert.equal(approved.payload.status, 'SIMULATED_HANDOFF_READY');
assert.equal(approved.payload.quality_score, 100);
assert.equal(approved.payload.variable_cost_eur, 0);
assert.equal(approved.payload.real_provider_calls, 0);
assert.equal(approved.payload.external_writes, 0);
assert.equal(approved.payload.production_deploy, false);

const missionsAfter = await request('/operator/api/missions');
assert.equal(missionsAfter.payload.universal.length, 1);
assert.equal(missionsAfter.payload.universal[0].project_id, bakery.project_id);
const missionId = missionsAfter.payload.universal[0].mission_id;

const missionDetail = await request(`/operator/api/missions/${encodeURIComponent(missionId)}`);
assert.equal(missionDetail.payload.kind, 'universal_mission');
assert.equal(missionDetail.payload.mission.mission.customer_id, bakery.customer_id);
assert.equal(missionDetail.payload.mission.mission.project_id, bakery.project_id);
assert.equal(missionDetail.payload.mission.execution.status, 'SYNTHETIC_STAGING_COMPLETED');
assert.deepEqual(missionDetail.payload.mission.execution.real_providers_involved, []);
assert.equal(missionDetail.payload.mission.quality.status, 'PASS');
assert.equal(missionDetail.payload.mission.delivery.final_delivery_status, 'SIMULATED_HANDOFF_READY');

const deliveries = await request('/operator/api/deliveries');
assert.equal(deliveries.payload.universal_missions.length, 1);
assert.equal(deliveries.payload.universal_missions[0].execution_evidence.real_provider_calls, 0);
assert.equal(deliveries.payload.universal_missions[0].execution_evidence.external_writes, 0);
assert.equal(deliveries.payload.universal_missions[0].production_deploy, false);

const costs = await request('/operator/api/costs');
assert.equal(costs.payload.spent_eur, 0);
assert.equal(costs.payload.reserved_eur, 0);
assert.equal(costs.payload.estimated_eur, 0);
assert.equal(costs.payload.variable_cost_state, 'ESTIMATED_ZERO');
assert.equal(costs.payload.automatic_paid_overflow, false);

const health = await request('/operator/api/system-health');
assert.equal(health.payload.production.raw, 'DISABLED');
assert.equal(health.payload.ci.raw, 'NOT_VERIFIED');
assert.ok(Array.isArray(health.payload.factories));

const audit = await request('/operator/api/audit');
assert.ok(audit.payload.items.some((item) => item.event === 'SYNTHETIC_UNIVERSAL_MISSION_RECORDED'));

const settings = await request('/operator/api/settings');
assert.equal(settings.payload.default_environment, 'staging');
assert.equal(settings.payload.data_mode, 'synthetic_only');
assert.equal(settings.payload.production_policy, 'LOCKED');
assert.equal(settings.payload.runtime_store, 'MEMORY_REFERENCE_ADAPTER');

const directUnsafe = await request('/operator/api/universal-missions', {
  method: 'POST',
  body: { production_authorized: true, environment: 'production', real_customer_data: true }
});
assert.equal(directUnsafe.response.status, 404);
assert.equal(directUnsafe.payload.error, 'OPERATOR_DASHBOARD_ROUTE_NOT_FOUND');

const craftPreflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: {
    scope_key: craft.scope_key,
    industry: 'handwerk',
    mission_text: 'Baue Kundengewinnung, Website, CRM und sichere Nachverfolgung für einen Handwerksbetrieb.'
  }
});
assert.equal(craftPreflight.response.status, 201);

const snapshot = await request('/operator/api/snapshot');
const selected = await request(`/operator/api/projects/${encodeURIComponent(craft.scope_key)}/select`, {
  method: 'POST',
  body: { expected_revision: snapshot.payload.runtime.revision }
});
assert.equal(selected.response.status, 200);

const staleApproval = await request('/operator/api/mission-approve', {
  method: 'POST',
  body: { plan_token: craftPreflight.payload.plan_token }
});
assert.equal(staleApproval.response.status, 409);
assert.equal(staleApproval.payload.error, 'PLAN_RUNTIME_REVISION_CONFLICT');

const statusReady = operatorDashboardStatusMeta('LIVE_STAGING_VERIFIED');
assert.equal(statusReady.tone, 'ready');
const statusUnknown = operatorDashboardStatusMeta('SOMETHING_NEW');
assert.equal(statusUnknown.tone, 'neutral');

const manifest = operatorDashboardHttpManifest();
assert.equal(manifest.single_operator, true);
assert.equal(manifest.auth, 'cloudflare_access_ctx_identity_fail_closed');
assert.equal(manifest.backend, 'riosystems.operator-runtime-api.v1');
assert.equal(manifest.direct_provider_calls, false);
assert.equal(manifest.secrets_in_frontend, false);
assert.equal(manifest.automatic_dispatch, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-dashboard-v1',
  projects: projects.payload.items.length,
  mission: missionId,
  quality: missionDetail.payload.mission.quality.quality_score,
  variable_cost_eur: costs.payload.spent_eur,
  access: 'fail_closed',
  stale_plan_guard: true,
  production_deploy: false
}, null, 2));
