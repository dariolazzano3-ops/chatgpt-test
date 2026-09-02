import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import {
  AURENTARA_WEBSITE_SCOPE,
  AURENTARA_ACCEPTED_RC_SHA,
  createAurentaraPublicWebsitePortfolioEntry,
  classifyOperatorProjectChange,
  buildOperatorProjectWorkspace,
  workspaceDecisionResult,
  operatorProjectWorkspaceManifest
} from '../src/operator-project-workspace-v1.js';
import {
  handleOperatorDashboard,
  operatorProjectWorkspaceDashboardManifest
} from '../src/operator-project-workspace-dashboard-v1.js';

const auth = async () => ({ ok: true, operator_id: 'operator:workspace-test', email: 'workspace@example.invalid' });
const created = createOperatorRuntime({
  operator_id: 'operator:workspace-test',
  portfolio: { operator_id: 'operator:workspace-test', projects: [], production_deploy: false },
  at: '2026-09-02T15:30:00.000Z'
});
assert.equal(created.ok, true);
const store = createMemoryOperatorRuntimeStore([created.runtime]);
const runtimeService = createOperatorRuntimeApiService({ operator_id: 'operator:workspace-test', store });
const options = { authorize: auth, runtime_service: runtimeService };

const project = createAurentaraPublicWebsitePortfolioEntry();
assert.equal(project.scope_key, AURENTARA_WEBSITE_SCOPE);
assert.equal(project.accepted_rc_sha, AURENTARA_ACCEPTED_RC_SHA);
assert.equal(project.production_deploy, false);
assert.equal(project.budget_cost_units, 0);

const visual = classifyOperatorProjectChange({ requested_change: 'Mach den Hero etwas ruhiger.' });
assert.equal(visual.ok, true);
assert.ok(visual.change_types.includes('VISUAL'));
assert.equal(visual.risk_level, 'LOW');
assert.equal(visual.expected_variable_cost_eur, 0);
assert.equal(visual.production_impact, 'NONE');
assert.equal(visual.approval_requirement, 'EXPLICIT_OPERATOR_APPROVAL');
assert.equal(visual.allowed, true);

const mobile = classifyOperatorProjectChange({ requested_change: 'Mobile Navigation fühlt sich noch nicht hochwertig an.' });
assert.ok(mobile.change_types.includes('RESPONSIVE'));
assert.ok(mobile.change_types.includes('NAVIGATION'));
assert.equal(mobile.risk_level, 'MEDIUM');
assert.equal(mobile.expected_variable_cost_eur, 0);

const forbidden = classifyOperatorProjectChange({ requested_change: 'Aktiviere Production DNS, Stripe Billing und echte Kundendaten.' });
assert.equal(forbidden.risk_level, 'HIGH');
assert.equal(forbidden.allowed, false);
assert.equal(forbidden.production_deploy, false);
assert.equal(forbidden.dns_change, false);
assert.equal(forbidden.billing, false);
assert.equal(forbidden.real_customer_data, false);

const snapshot = buildOperatorProjectWorkspace({ project });
assert.equal(snapshot.ok, true);
assert.equal(snapshot.project.accepted_rc_sha, AURENTARA_ACCEPTED_RC_SHA);
assert.equal(snapshot.project.canonical_branch, 'factory-control');
assert.equal(snapshot.project.production_status, 'OFF');
for (const width of [1440, 1200, 1024, 768, 430, 390, 375, 320]) {
  assert.ok(snapshot.responsive_modes.some((mode) => mode.width === width), `missing responsive mode ${width}`);
}
for (const check of ['responsive_qa', 'desktop_qa', 'mobile_qa', 'accessibility', 'console_errors', 'horizontal_overflow', 'navigation', 'hamyren_regression', 'general_ci', 'preview_deploy']) {
  assert.ok(snapshot.qa.checks.some((item) => item.id === check), `missing QA check ${check}`);
}
assert.equal(snapshot.governance.automatic_merge, false);
assert.equal(snapshot.governance.production, 'OFF');
assert.equal(snapshot.governance.dns, 'UNCHANGED');
assert.equal(snapshot.governance.indexing, 'OFF');
assert.equal(snapshot.governance.billing, 'OFF');
assert.equal(snapshot.governance.real_customer_data, 'NONE');
assert.equal(snapshot.governance.paid_provider_calls, 0);
assert.equal(snapshot.governance.variable_cost_target_eur, 0);

for (const decision of ['accept', 'request_changes', 'return_to_accepted']) {
  const result = workspaceDecisionResult(decision);
  assert.equal(result.ok, true);
  assert.equal(result.merge_started, false);
  assert.equal(result.merge_authorized, false);
  assert.equal(result.production_deploy, false);
  assert.equal(result.variable_cost_eur, 0);
}

const shellResponse = await handleOperatorDashboard(new Request('https://operator.example.test/operator'), {}, {}, options);
assert.equal(shellResponse.status, 200);
const shell = await shellResponse.text();
assert.match(shell, /Projekt Workspace öffnen|Workspace/);
assert.equal(shellResponse.headers.get('x-aurentara-project-workspace-v1'), 'enabled');

const projectsResponse = await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/projects'), {}, {}, options);
assert.equal(projectsResponse.status, 200);
const projects = await projectsResponse.json();
const projected = projects.items.find((item) => item.scope_key === AURENTARA_WEBSITE_SCOPE);
assert.ok(projected, 'AURENTARA website must be visible before runtime registration');
assert.equal(projected.runtime_registration, 'PENDING_UNTIL_PREFLIGHT');
assert.equal(projected.production_deploy, false);

const workspacePage = await handleOperatorDashboard(new Request(`https://operator.example.test/operator/workspace/${encodeURIComponent(AURENTARA_WEBSITE_SCOPE)}`), {}, {}, options);
assert.equal(workspacePage.status, 200);
const workspaceHtml = await workspacePage.text();
for (const required of ['Project Header', 'Live Preview', 'Change Request', 'QA Panel', 'Version / Iteration History', 'ACCEPT ITERATION', 'RETURN TO LAST ACCEPTED', 'Production OFF']) {
  assert.ok(workspaceHtml.includes(required), `workspace surface missing ${required}`);
}
assert.match(workspacePage.headers.get('content-security-policy') || '', /frame-src https:\/\/\*\.pages\.dev/);

const workspaceBeforeResponse = await handleOperatorDashboard(new Request(`https://operator.example.test/operator/api/project-workspace/${encodeURIComponent(AURENTARA_WEBSITE_SCOPE)}`), {}, {}, options);
assert.equal(workspaceBeforeResponse.status, 200);
const workspaceBefore = await workspaceBeforeResponse.json();
assert.equal(workspaceBefore.runtime_registration, 'REPOSITORY_PROJECT_PENDING_RUNTIME_REGISTRATION');

const changeText = 'Website visuell optimieren und die Hero-Sektion im privaten Staging ruhiger gestalten.';
const classifiedResponse = await handleOperatorDashboard(new Request(`https://operator.example.test/operator/api/project-workspace/${encodeURIComponent(AURENTARA_WEBSITE_SCOPE)}/classify`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requested_change: changeText })
}), {}, {}, options);
assert.equal(classifiedResponse.status, 200);
const classified = await classifiedResponse.json();
assert.equal(classified.expected_variable_cost_eur, 0);
assert.equal(classified.production_deploy, false);
assert.equal(classified.allowed, true);

const preflightResponse = await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/mission-preflight', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    scope_key: AURENTARA_WEBSITE_SCOPE,
    industry: 'business-systems', country: 'DE', language: 'de', mission_text: changeText,
    requested_outcomes: ['website preview iteration'],
    known_constraints: ['staging only', 'no production', 'no DNS', 'no billing', 'synthetic data only', 'zero variable cost']
  })
}), {}, {}, options);
assert.equal(preflightResponse.status, 201);
const preflight = await preflightResponse.json();
assert.equal(preflight.status, 'APPROVAL_REQUIRED');
assert.equal(preflight.execution_started, false);
assert.equal(preflight.preflight.estimated_variable_cost_eur, 0);
assert.equal(preflight.production_deploy, false);
assert.ok(preflight.plan_token);

const runtimeProjects = await runtimeService.handle({ method: 'GET', path: '/projects' });
assert.ok(runtimeProjects.body.items.some((item) => item.scope_key === AURENTARA_WEBSITE_SCOPE), 'preflight must register project in authoritative runtime through existing CREATE_PROJECT command');

const approveResponse = await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/mission-approve', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan_token: preflight.plan_token })
}), {}, {}, options);
assert.equal(approveResponse.status, 201);
const approved = await approveResponse.json();
assert.equal(approved.variable_cost_eur, 0);
assert.equal(approved.real_provider_calls, 0);
assert.equal(approved.external_writes, 0);
assert.equal(approved.production_deploy, false);
assert.equal(approved.quality_score, 100);

const deliveriesResponse = await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/deliveries'), {}, {}, options);
assert.equal(deliveriesResponse.status, 200);
const deliveries = await deliveriesResponse.json();
const latest = deliveries.universal_missions.at(-1);
assert.equal(latest.execution_evidence.real_provider_calls, 0);
assert.equal(latest.execution_evidence.external_writes, 0);
assert.equal(latest.execution_evidence.variable_cost_eur, 0);
assert.equal(latest.production_deploy, false);

const acceptResponse = await handleOperatorDashboard(new Request(`https://operator.example.test/operator/api/project-workspace/${encodeURIComponent(AURENTARA_WEBSITE_SCOPE)}/decision`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'accept' })
}), {}, {}, options);
assert.equal(acceptResponse.status, 200);
const accepted = await acceptResponse.json();
assert.equal(accepted.status, 'ITERATION_ACCEPTED');
assert.equal(accepted.merge_started, false);
assert.equal(accepted.merge_authorized, false);
assert.equal(accepted.production_deploy, false);

const afterResponse = await handleOperatorDashboard(new Request(`https://operator.example.test/operator/api/project-workspace/${encodeURIComponent(AURENTARA_WEBSITE_SCOPE)}`), {}, {}, options);
const after = await afterResponse.json();
assert.equal(after.runtime_registration, 'REGISTERED_AUTHORITATIVE_RUNTIME');
assert.ok(after.iteration_history.some((item) => item.status === 'ITERATION_ACCEPTED'));

const manifest = operatorProjectWorkspaceManifest();
const dashboardManifest = operatorProjectWorkspaceDashboardManifest();
assert.equal(manifest.thin_workspace_adapter, true);
assert.equal(manifest.duplicate_project_state, false);
assert.equal(manifest.automatic_merge, false);
assert.equal(manifest.production_deploy, false);
assert.equal(dashboardManifest.outer_wrapper_over_existing_operator_chain, true);
assert.equal(dashboardManifest.authoritative_runtime_registration_command, 'CREATE_PROJECT');
assert.equal(dashboardManifest.production_deploy, false);
assert.equal(dashboardManifest.additional_variable_cost_eur, 0);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-project-workspace-v1',
  project_opened: true,
  change_request_classified: true,
  preflight_generated: true,
  approval_gate_verified: true,
  execution_route_resolved: true,
  quality_score: approved.quality_score,
  real_provider_calls: approved.real_provider_calls,
  external_writes: approved.external_writes,
  variable_cost_eur: approved.variable_cost_eur,
  automatic_merge: false,
  production_deploy: false,
  dns_change: false,
  billing: false,
  real_customer_data: false
}, null, 2));
