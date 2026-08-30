import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { handleOperatorDashboard } from '../src/operator-project-create-dashboard-v1.js';
import { commandCenterManifest } from '../src/command-center.js';

const operatorId = 'operator:test@example.com';
const seedScope = 'seed-customer:seed-project';
const created = createOperatorRuntime({
  operator_id: operatorId,
  selected_project_scope: seedScope,
  portfolio: {
    operator_id: operatorId,
    projects: [{
      customer_id: 'seed-customer', project_id: 'seed-project', scope_key: seedScope,
      name: 'Seed Project', business_name: 'Seed Project', industry: 'services', country: 'DE', language: 'de',
      state: 'READY', blocked: false, budget_cost_units: 0, capability_count: 0, mission_count: 0, delivery_count: 0,
      production_deploy: false
    }],
    production_deploy: false
  },
  at: '2026-08-30T12:40:00.000Z'
});
assert.equal(created.ok, true);
const store = createMemoryOperatorRuntimeStore([created.runtime]);
let service = createOperatorRuntimeApiService({ operator_id: operatorId, store });
const authorize = async () => ({ ok: true, operator_id: operatorId, email: 'test@example.com' });
const env = { RIOSYSTEMS_ENVIRONMENT: 'local' };
const ctx = {};
const options = () => ({ runtime_service: service, authorize });
const request = (path, method = 'GET', body = null) => new Request(`https://operator.test${path}`, {
  method,
  headers: body ? { 'content-type': 'application/json' } : {},
  body: body ? JSON.stringify(body) : undefined
});

const shell = await handleOperatorDashboard(request('/operator'), env, ctx, options());
assert.equal(shell.status, 200);
const shellText = await shell.text();
assert.match(shellText, /Neues Projekt anlegen/);
assert.match(shellText, /Projekt autoritativ anlegen/);

let approvals = await handleOperatorDashboard(request('/operator/api/approvals'), env, ctx, options());
assert.equal(approvals.status, 200);
let approvalBody = await approvals.json();
assert.equal(approvalBody.runtime_revision, 1);

const createResponse = await handleOperatorDashboard(request('/operator/api/projects/create', 'POST', {
  expected_revision: 1,
  customer_id: 'mueller-elektro',
  project_id: 'digital-system-v1',
  business_name: 'Müller Elektrotechnik',
  industry: 'handwerk',
  country: 'DE',
  language: 'de',
  mission_context: 'Digitales Vertriebs- und Betriebssystem aufbauen.'
}), env, ctx, options());
assert.equal(createResponse.status, 201);
const createBody = await createResponse.json();
assert.equal(createBody.status, 'CREATED');
assert.equal(createBody.scope_key, 'mueller-elektro:digital-system-v1');
assert.equal(createBody.project.operator_id, operatorId);
assert.deepEqual(createBody.project.allowed_environments, ['staging']);
assert.equal(createBody.project.data_policy.synthetic_only, true);
assert.equal(createBody.project.data_policy.real_customer_data, false);
assert.equal(createBody.project.budget_policy.variable_cost_ceiling_eur, 0);
assert.equal(createBody.project.budget_policy.paid_overflow, false);
assert.equal(createBody.project.production_deploy, false);
assert.equal(createBody.external_side_effect_performed, false);
assert.equal(createBody.variable_cost_eur, 0);
assert.equal(createBody.runtime_revision, 2);

let projects = await handleOperatorDashboard(request('/operator/api/projects'), env, ctx, options());
assert.equal(projects.status, 200);
let projectBody = await projects.json();
assert.equal(projectBody.items.length, 2);
assert.ok(projectBody.items.some((item) => item.scope_key === 'mueller-elektro:digital-system-v1'));
assert.ok(projectBody.items.some((item) => item.scope_key === seedScope));

// Runtime-service restart: project must remain because it lives in the authoritative store.
service = createOperatorRuntimeApiService({ operator_id: operatorId, store });
projects = await handleOperatorDashboard(request('/operator/api/projects'), env, ctx, options());
projectBody = await projects.json();
assert.equal(projectBody.items.length, 2);
assert.ok(projectBody.items.some((item) => item.scope_key === 'mueller-elektro:digital-system-v1'));

// Exact replay is allowed but must never duplicate the project.
const duplicate = await handleOperatorDashboard(request('/operator/api/projects/create', 'POST', {
  expected_revision: 2,
  customer_id: 'mueller-elektro', project_id: 'digital-system-v1', business_name: 'Müller Elektrotechnik',
  industry: 'handwerk', country: 'DE', language: 'de'
}), env, ctx, options());
assert.equal(duplicate.status, 200);
const duplicateBody = await duplicate.json();
assert.equal(duplicateBody.idempotent_replay, true);
projects = await handleOperatorDashboard(request('/operator/api/projects'), env, ctx, options());
projectBody = await projects.json();
assert.equal(projectBody.items.length, 2);

const afterDuplicate = await service.handle({ method: 'GET', path: '/snapshot' });
const currentRevision = afterDuplicate.runtime.revision;
assert.ok(currentRevision >= 2);

// Stale client revision is blocked by Runtime CAS/revision governance.
const stale = await handleOperatorDashboard(request('/operator/api/projects/create', 'POST', {
  expected_revision: 1,
  customer_id: 'stale-customer', project_id: 'stale-project', business_name: 'Stale Project', industry: 'services', country: 'DE', language: 'de'
}), env, ctx, options());
assert.equal(stale.status, 409);

// Forged scope key cannot escape the canonical customer/project isolation key.
const scopeMismatch = await service.handle({ method: 'POST', path: '/commands', body: {
  expected_revision: currentRevision,
  type: 'CREATE_PROJECT', customer_id: 'customer-x', project_id: 'project-x', scope_key: 'other:scope',
  business_name: 'Scope Attack', industry: 'services', country: 'DE', language: 'de',
  allowed_environments: ['staging'], data_policy: { synthetic_only: true, real_customer_data: false },
  budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false }
}});
assert.equal(scopeMismatch.status, 400);
assert.equal(scopeMismatch.body.error, 'PROJECT_CREATE_SCOPE_MISMATCH');

const production = await service.handle({ method: 'POST', path: '/commands', body: {
  expected_revision: currentRevision,
  type: 'CREATE_PROJECT', customer_id: 'prod-customer', project_id: 'prod-project', business_name: 'Production Project', industry: 'services', country: 'DE', language: 'de',
  allowed_environments: ['production'], data_policy: { synthetic_only: true, real_customer_data: false }, budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false }
}});
assert.equal(production.status, 400);
assert.equal(production.body.error, 'PROJECT_CREATE_STAGING_ONLY');

const paid = await service.handle({ method: 'POST', path: '/commands', body: {
  expected_revision: currentRevision,
  type: 'CREATE_PROJECT', customer_id: 'paid-customer', project_id: 'paid-project', business_name: 'Paid Project', industry: 'services', country: 'DE', language: 'de',
  allowed_environments: ['staging'], data_policy: { synthetic_only: true, real_customer_data: false }, budget_policy: { variable_cost_ceiling_eur: 1, paid_overflow: false }
}});
assert.equal(paid.status, 400);
assert.equal(paid.body.error, 'PROJECT_CREATE_ZERO_COST_POLICY_REQUIRED');

const realData = await service.handle({ method: 'POST', path: '/commands', body: {
  expected_revision: currentRevision,
  type: 'CREATE_PROJECT', customer_id: 'real-customer', project_id: 'real-project', business_name: 'Real Data Project', industry: 'services', country: 'DE', language: 'de',
  allowed_environments: ['staging'], data_policy: { synthetic_only: false, real_customer_data: true }, budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false }
}});
assert.equal(realData.status, 400);
assert.equal(realData.body.error, 'PROJECT_CREATE_SYNTHETIC_DATA_POLICY_REQUIRED');

const finalSnapshot = await service.handle({ method: 'GET', path: '/snapshot' });
assert.equal(finalSnapshot.runtime.command_center_state.portfolio.projects.length, 2);
assert.ok(finalSnapshot.runtime.command_center_state.audit.some((event) => event.event === 'PROJECT_CREATED'));
assert.equal(finalSnapshot.runtime.selected_project_scope, seedScope);

const manifest = commandCenterManifest();
assert.equal(manifest.project_creation_authoritative, true);
assert.equal(manifest.project_creation_external_side_effects, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'riosystems.operator-project-create.smoke.v1',
  authoritative_runtime_command: true,
  restart_recovery: true,
  duplicate_project_prevented: true,
  stale_revision_blocked: true,
  scope_isolation_verified: true,
  production_blocked: true,
  paid_budget_blocked: true,
  real_customer_data_blocked: true,
  projects: finalSnapshot.runtime.command_center_state.portfolio.projects.length,
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
