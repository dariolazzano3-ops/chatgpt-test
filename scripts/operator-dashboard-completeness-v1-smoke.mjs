import assert from 'node:assert/strict';
import { handleOperatorDashboard } from '../src/operator-dashboard-completeness-v1.js';
import { operatorDashboardCompletenessManifest } from '../src/operator-dashboard-completeness-v1.js';

const base = 'https://operator-complete.test';
const operatorId = 'operator:dashboard-completeness-smoke';
const authorize = async () => ({ ok: true, operator_id: operatorId, email: 'operator@example.test' });

async function request(path, { method = 'GET', body = null } = {}) {
  const headers = body ? { 'content-type': 'application/json' } : {};
  const response = await handleOperatorDashboard(
    new Request(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    {},
    {},
    { authorize }
  );
  assert.ok(response, `expected response for ${path}`);
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  return { response, payload };
}

const shell = await request('/operator');
assert.equal(shell.response.status, 200);
assert.match(shell.payload, /Project Detail/);
assert.match(shell.payload, /Audit Log/);
assert.match(shell.payload, /CONFIRM_SYNTHETIC_STAGING/);
assert.match(shell.payload, /approval_required/);
assert.match(shell.payload, /delivery_ready/);
assert.match(shell.payload, /window\.prompt/);
assert.match(shell.payload, /@media\(max-width:760px\)/);
assert.match(shell.response.headers.get('content-security-policy'), /frame-ancestors 'none'/);

const projectsBefore = await request('/operator/api/projects');
assert.equal(projectsBefore.payload.schema, 'riosystems.operator-projects-view.v2');
assert.equal(projectsBefore.payload.items.length, 3);
const bakery = projectsBefore.payload.items.find((item) => item.name === 'Bäckerei Müller');
const craft = projectsBefore.payload.items.find((item) => item.name === 'Muster Handwerksbetrieb');
const serviceStudio = projectsBefore.payload.items.find((item) => item.name === 'Synthetic Service Studio');
assert.ok(bakery && craft && serviceStudio);
assert.ok(bakery.filter_tags.includes('synthetic'));
assert.ok(bakery.filter_tags.includes('staging'));
assert.ok(craft.filter_tags.includes('active'));

const initialDetail = await request(`/operator/api/project-detail/${encodeURIComponent(bakery.scope_key)}`);
assert.equal(initialDetail.payload.schema, 'riosystems.operator-project-detail.v1');
assert.equal(initialDetail.payload.project.customer_id, bakery.customer_id);
assert.equal(initialDetail.payload.project.project_id, bakery.project_id);
assert.equal(initialDetail.payload.project.progress_percent, 0);
assert.equal(initialDetail.payload.reality, 'NOT_VERIFIED');
assert.equal(initialDetail.payload.results.delivery, null);

const preflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: {
    scope_key: bakery.scope_key,
    industry: 'bakery',
    country: 'DE',
    language: 'de',
    mission_text: 'Modernisiere Website und lokale Kundengewinnung, strukturiere Anfragen im CRM, automatisiere Follow-up und liefere Analytics.',
    requested_outcomes: ['Website', 'Growth', 'CRM', 'Automation', 'Analytics'],
    production_authorized: true,
    environment: 'production',
    data_policy: { synthetic_only: false, real_customer_data: true },
    budget_policy: { variable_cost_ceiling_eur: 999, paid_overflow: true }
  }
});
assert.equal(preflight.response.status, 201);
assert.equal(preflight.payload.schema, 'riosystems.operator-plan-review.v2');
assert.equal(preflight.payload.status, 'APPROVAL_REQUIRED');
assert.equal(preflight.payload.confirmation_text, 'CONFIRM_SYNTHETIC_STAGING');
assert.equal(preflight.payload.execution_started, false);
assert.equal(preflight.payload.mission.environment, 'staging');
assert.equal(preflight.payload.mission.production_authorized, false);
assert.equal(preflight.payload.mission.data_policy.synthetic_only, true);
assert.equal(preflight.payload.mission.data_policy.real_customer_data, false);
assert.equal(preflight.payload.mission.budget_policy.variable_cost_ceiling_eur, 0);
assert.equal(preflight.payload.preflight.estimated_variable_cost_eur, 0);

const detailWithApproval = await request(`/operator/api/project-detail/${encodeURIComponent(bakery.scope_key)}`);
assert.equal(detailWithApproval.payload.project.progress_percent, 25);
assert.equal(detailWithApproval.payload.project.open_approval_count, 1);
assert.equal(detailWithApproval.payload.project.mission_status, 'APPROVAL_REQUIRED');
assert.equal(detailWithApproval.payload.reality, 'PLANNED');

const approvalCenter = await request('/operator/api/approvals');
assert.equal(approvalCenter.payload.schema, 'riosystems.operator-approval-center.v2');
assert.equal(approvalCenter.payload.mission_plans.length, 1);
assert.equal(approvalCenter.payload.mission_plans[0].confirmation_text, 'CONFIRM_SYNTHETIC_STAGING');
assert.equal(approvalCenter.payload.mission_plans[0].generated_by, 'universal-mission-run-v1');
assert.equal(approvalCenter.payload.mission_plans[0].side_effects, 'NO_REAL_PROVIDER_WRITES');

const noConfirmation = await request('/operator/api/mission-plan-decision', {
  method: 'POST',
  body: { plan_token: preflight.payload.plan_token, decision: 'approve' }
});
assert.equal(noConfirmation.response.status, 400);
assert.equal(noConfirmation.payload.error, 'PLAN_CONFIRMATION_TEXT_REQUIRED');

const wrongConfirmation = await request('/operator/api/mission-plan-decision', {
  method: 'POST',
  body: { plan_token: preflight.payload.plan_token, decision: 'approve', confirmation_text: 'WRONG' }
});
assert.equal(wrongConfirmation.response.status, 400);
assert.equal(wrongConfirmation.payload.error, 'PLAN_CONFIRMATION_TEXT_REQUIRED');

const approved = await request('/operator/api/mission-plan-decision', {
  method: 'POST',
  body: { plan_token: preflight.payload.plan_token, decision: 'approve', confirmation_text: 'CONFIRM_SYNTHETIC_STAGING' }
});
assert.equal(approved.response.status, 201);
assert.equal(approved.payload.status, 'SIMULATED_HANDOFF_READY');
assert.equal(approved.payload.quality_score, 100);
assert.equal(approved.payload.variable_cost_eur, 0);
assert.equal(approved.payload.real_provider_calls, 0);
assert.equal(approved.payload.external_writes, 0);
assert.equal(approved.payload.production_deploy, false);

const detailAfter = await request(`/operator/api/project-detail/${encodeURIComponent(bakery.scope_key)}`);
assert.equal(detailAfter.payload.project.progress_percent, 100);
assert.equal(detailAfter.payload.project.open_approval_count, 0);
assert.equal(detailAfter.payload.project.mission_status, 'SIMULATED_HANDOFF_READY');
assert.equal(detailAfter.payload.reality, 'SYNTHETIC');
assert.ok(detailAfter.payload.capabilities.length >= 3);
assert.ok(detailAfter.payload.capabilities.every((item) => item.reality === 'SYNTHETIC'));
assert.ok(detailAfter.payload.capabilities.every((item) => item.quality_score === 100));
assert.ok(detailAfter.payload.capabilities.every((item) => item.retry_count >= 0));
assert.equal(detailAfter.payload.results.quality.status, 'PASS');
assert.equal(detailAfter.payload.results.delivery.final_delivery_status, 'SIMULATED_HANDOFF_READY');
assert.equal(detailAfter.payload.results.execution_evidence.real_provider_calls, 0);
assert.equal(detailAfter.payload.results.execution_evidence.external_writes, 0);

const projectsAfter = await request('/operator/api/projects');
const bakeryAfter = projectsAfter.payload.items.find((item) => item.scope_key === bakery.scope_key);
assert.equal(bakeryAfter.progress_percent, 100);
assert.ok(bakeryAfter.filter_tags.includes('delivery_ready'));
assert.ok(bakeryAfter.filter_tags.includes('synthetic'));

const costs = await request('/operator/api/costs');
assert.equal(costs.payload.schema, 'riosystems.operator-cost-center.v2');
assert.equal(costs.payload.spent_eur, 0);
assert.equal(costs.payload.reserved_eur, 0);
assert.equal(costs.payload.estimated_eur, 0);
assert.equal(costs.payload.variable_cost_state, 'ESTIMATED_ZERO');
assert.ok(costs.payload.by_project.some((item) => item.key === 'Bäckerei Müller'));
assert.ok(costs.payload.by_mission.some((item) => item.key === approved.payload.mission_id));
assert.ok(costs.payload.by_factory.length > 0);
assert.ok(costs.payload.by_capability.length > 0);
assert.ok(costs.payload.by_provider.length > 0);
assert.equal(costs.payload.automatic_paid_overflow, false);
assert.equal(costs.payload.paid_execution_authorized, false);

const factories = await request('/operator/api/factories');
assert.equal(factories.payload.schema, 'riosystems.operator-factory-operations.v1');
assert.ok(Array.isArray(factories.payload.items));
assert.ok(factories.payload.items.every((item) => item.ci_verification === 'NOT_PROJECTED_IN_RUNTIME'));
assert.ok(factories.payload.items.some((item) => item.execution_count > 0));

const providers = await request('/operator/api/providers');
assert.equal(providers.payload.schema, 'riosystems.operator-provider-operations.v1');
assert.ok(Array.isArray(providers.payload.active_runtime_providers));
assert.ok(providers.payload.active_runtime_providers.length > 0);
assert.ok(providers.payload.active_runtime_providers.every((item) => item.reality === 'SYNTHETIC_ROUTE_ONLY'));
assert.ok(providers.payload.active_runtime_providers.every((item) => item.credentials_exposed === false));

const health = await request('/operator/api/system-health');
assert.equal(health.payload.schema, 'riosystems.operator-system-health.v2');
assert.equal(health.payload.factory_control_api.raw, 'VERIFIED_HEALTHY');
assert.equal(health.payload.ci.raw, 'NOT_VERIFIED');
assert.equal(health.payload.production.raw, 'DISABLED');
assert.ok(health.payload.factories.length > 0);

const audit = await request('/operator/api/audit');
assert.equal(audit.payload.schema, 'riosystems.operator-audit-view.v2');
for (const event of ['MISSION_PLAN_CREATED','MISSION_PLAN_APPROVED','SUPERVISED_SYNTHETIC_STAGING_COMPLETED','QUALITY_GATE_PASSED','UNIFIED_DELIVERY_AVAILABLE']) {
  assert.ok(audit.payload.items.some((item) => item.event === event), `missing audit event ${event}`);
}
assert.ok(audit.payload.items.some((item) => item.event === 'SYNTHETIC_UNIVERSAL_MISSION_RECORDED'));

const deferPreflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: {
    scope_key: serviceStudio.scope_key,
    industry: 'professional-services',
    mission_text: 'Strukturiere Website, CRM und Analytics für ein synthetisches Service-Unternehmen.'
  }
});
assert.equal(deferPreflight.response.status, 201);
const deferred = await request('/operator/api/mission-plan-decision', {
  method: 'POST',
  body: { plan_token: deferPreflight.payload.plan_token, decision: 'defer' }
});
assert.equal(deferred.response.status, 200);
assert.equal(deferred.payload.status, 'DEFERRED');
const approvalsAfterDefer = await request('/operator/api/approvals');
assert.ok(approvalsAfterDefer.payload.mission_plans.some((item) => item.plan_token === deferPreflight.payload.plan_token && item.status === 'DEFERRED'));

const rejectPreflight = await request('/operator/api/mission-preflight', {
  method: 'POST',
  body: {
    scope_key: craft.scope_key,
    industry: 'handwerk',
    mission_text: 'Plane Website, Growth und CRM für einen synthetischen Handwerksbetrieb.'
  }
});
assert.equal(rejectPreflight.response.status, 201);
const rejected = await request('/operator/api/mission-plan-decision', {
  method: 'POST',
  body: { plan_token: rejectPreflight.payload.plan_token, decision: 'reject' }
});
assert.equal(rejected.response.status, 200);
assert.equal(rejected.payload.status, 'REJECTED');
const approvalsAfterReject = await request('/operator/api/approvals');
assert.ok(!approvalsAfterReject.payload.mission_plans.some((item) => item.plan_token === rejectPreflight.payload.plan_token));

const auditAfterDecisions = await request('/operator/api/audit');
assert.ok(auditAfterDecisions.payload.items.some((item) => item.event === 'MISSION_PLAN_DEFERRED'));
assert.ok(auditAfterDecisions.payload.items.some((item) => item.event === 'MISSION_PLAN_REJECTED'));

const settings = await request('/operator/api/settings');
assert.equal(settings.payload.schema, 'riosystems.operator-settings-view.v2');
assert.equal(settings.payload.default_environment, 'staging');
assert.equal(settings.payload.data_mode, 'synthetic_only');
assert.equal(settings.payload.mission_variable_budget_ceiling_eur, 0);
assert.equal(settings.payload.monthly_operator_budget_eur, null);
assert.equal(settings.payload.production_policy, 'LOCKED');
assert.equal(settings.payload.secrets_surface, 'NOT_EXPOSED');
assert.equal(settings.payload.runtime_store, 'MEMORY_REFERENCE_ADAPTER');

const unsafeDirect = await request('/operator/api/universal-missions', {
  method: 'POST',
  body: { environment: 'production', production_authorized: true, real_customer_data: true }
});
assert.equal(unsafeDirect.response.status, 404);
assert.equal(unsafeDirect.payload.error, 'OPERATOR_DASHBOARD_ROUTE_NOT_FOUND');

const missingProject = await request(`/operator/api/project-detail/${encodeURIComponent('other-customer:other-project')}`);
assert.equal(missingProject.response.status, 404);
assert.equal(missingProject.payload.error, 'OPERATOR_PROJECT_DETAIL_NOT_FOUND');

const manifest = operatorDashboardCompletenessManifest();
assert.equal(manifest.enriches_existing_dashboard_only, true);
assert.equal(manifest.typed_plan_confirmation, 'CONFIRM_SYNTHETIC_STAGING');
assert.ok(manifest.project_filters.includes('approval_required'));
assert.ok(manifest.project_filters.includes('delivery_ready'));
assert.equal(manifest.backend_authority_unchanged, true);
assert.equal(manifest.direct_provider_calls, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-dashboard-completeness-v1',
  project_detail: true,
  project_filters: manifest.project_filters.length,
  typed_approval: true,
  approval_decisions: ['approve','reject','defer'],
  cost_dimensions: ['project','mission','factory','capability','provider'],
  audit_search_ui: true,
  quality_score: detailAfter.payload.results.quality.quality_score,
  production_deploy: false
}, null, 2));
