import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withControlledPaidStagingActivationService } from '../src/operator-controlled-paid-staging-runtime-service-v1.js';
import { buildOperatorDeploymentIdentity } from '../src/operator-deployment-identity-v1.js';
import { handleOperatorDashboard } from '../src/operator-deployment-activation-dashboard-v1.js';
import { CONTROLLED_PAID_STAGING_CONFIRMATION } from '../src/operator-controlled-paid-staging-v1.js';

const operatorId = 'operator:deployment-acceptance@aurentara.test';
const gelatoScope = 'gelato-donatello:gelato-donatello-website-v1';
const deployedSha = '6f563b51c971ed018d9801c97f63233065ba0e2c';
const deployedAt = '2026-09-03T11:20:00.000Z';

const gelato = {
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: gelatoScope,
  name: 'Gelato Donatello',
  industry: 'gelateria',
  country: 'DE',
  language: 'de',
  state: 'READY',
  blocked: false,
  priority: 1,
  budget_cost_units: 0,
  capability_count: 0,
  mission_count: 0,
  delivery_count: 0,
  production_deploy: false
};

const created = createOperatorRuntime({
  operator_id: operatorId,
  portfolio: { operator_id: operatorId, projects: [gelato], production_deploy: false }
});
assert.equal(created.ok, true);
created.runtime.selected_project_scope = gelatoScope;
const store = createMemoryOperatorRuntimeStore([created.runtime]);
const coreService = createOperatorRuntimeApiService({ operator_id: operatorId, store });
const service = withControlledPaidStagingActivationService({ service: coreService, store, operator_id: operatorId });
const authorize = async () => ({ ok: true, operator_id: operatorId, email: 'deployment-acceptance@aurentara.test' });
const options = { runtime_service: service, authorize };
const env = {
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'false',
  RIOSYSTEMS_EXTERNAL_WRITES: 'false',
  CF_VERSION_METADATA: { id: 'cf-version-test-v1', tag: deployedSha, timestamp: deployedAt }
};

async function call(path, body = undefined, method = body === undefined ? 'GET' : 'POST') {
  const request = new Request(`https://operator.test${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const response = await handleOperatorDashboard(request, env, {}, options);
  assert.ok(response, `response required for ${path}`);
  let json = null;
  try { json = await response.clone().json(); } catch {}
  return { response, json };
}

// Runtime identity comes from Cloudflare version metadata and fails closed when no SHA-tag is available.
const identity = buildOperatorDeploymentIdentity(env);
assert.equal(identity.environment, 'staging');
assert.equal(identity.deployed_sha, deployedSha);
assert.equal(identity.deployed_at, deployedAt);
assert.equal(identity.production_deploy, false);
assert.equal(identity.external_writes, false);
assert.equal(identity.version_known, true);
assert.equal(identity.secrets_exposed, false);
assert.equal(identity.side_effects, false);
const unknown = buildOperatorDeploymentIdentity({
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'false',
  RIOSYSTEMS_EXTERNAL_WRITES: 'false',
  CF_VERSION_METADATA: { id: 'cf-version-unknown', tag: 'not-a-git-sha', timestamp: deployedAt }
});
assert.equal(unknown.deployed_sha, null);
assert.equal(unknown.version_known, false);

const version = await call('/operator/api/runtime-version');
assert.equal(version.response.status, 200);
assert.equal(version.json.deployed_sha, deployedSha);
assert.match(version.response.headers.get('cache-control') || '', /no-store/);
assert.match(version.response.headers.get('cache-control') || '', /no-cache/);
assert.equal(version.response.headers.get('pragma'), 'no-cache');

// Before activation Gelato remains on safe defaults and is visibly eligible for the operator step.
const beforeDetail = await call(`/operator/api/project-detail/${encodeURIComponent(gelatoScope)}`);
assert.equal(beforeDetail.response.status, 200);
assert.equal(beforeDetail.json.controlled_paid_staging.active, false);
assert.equal(beforeDetail.json.controlled_paid_staging.mode, 'SAFE_DEFAULT');
assert.equal(beforeDetail.json.controlled_paid_staging_activation.eligible, true);
assert.equal(beforeDetail.json.controlled_paid_staging_activation.budget_eur, 25);

// Wrong budget cannot activate the project.
const wrongBudget = await call('/operator/api/controlled-paid-staging/activate', {
  scope_key: gelatoScope,
  project_id: 'gelato-donatello-website-v1',
  project_budget_ceiling_eur: 10,
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION
});
assert.equal(wrongBudget.response.status, 400);
assert.equal(wrongBudget.json.error, 'CONTROLLED_PAID_STAGING_BUDGET_CONFIRMATION_REQUIRED');

// Exact 25 EUR confirmation activates and persists only the project policy. No mission runs.
const activation = await call('/operator/api/controlled-paid-staging/activate', {
  scope_key: gelatoScope,
  project_id: 'gelato-donatello-website-v1',
  project_budget_ceiling_eur: 25,
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION
});
assert.equal(activation.response.status, 201);
assert.equal(activation.json.status, 'ACTIVE');
assert.equal(activation.json.controlled_paid_staging.active, true);
assert.equal(activation.json.controlled_paid_staging.mode, 'CONTROLLED_PAID_STAGING');
assert.equal(activation.json.controlled_paid_staging.project_budget_ceiling_eur, 25);
assert.equal(activation.json.controlled_paid_staging.current_spend_eur, 0);
assert.equal(activation.json.controlled_paid_staging.reserved_eur, 0);
assert.equal(activation.json.controlled_paid_staging.remaining_budget_eur, 25);
assert.equal(activation.json.controlled_paid_staging.production, 'LOCKED');
assert.equal(activation.json.controlled_paid_staging.external_customer_writes, false);
assert.equal(activation.json.mission_executed, false);
assert.equal(activation.json.production_deploy, false);
assert.equal(activation.json.external_writes, false);

const persisted = await service.handle({ method: 'GET', path: '/snapshot' });
assert.equal(persisted.ok, true);
const persistedProject = (persisted.runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === gelatoScope);
assert.equal(persistedProject.controlled_paid_staging.status, 'ACTIVE');
assert.equal(persistedProject.controlled_paid_staging.project_budget_ceiling_eur, 25);
assert.equal(persistedProject.controlled_paid_staging.cost_ledger.spent_cost_units, 0);
assert.equal(persistedProject.controlled_paid_staging.cost_ledger.reserved_cost_units, 0);
assert.equal((persisted.runtime.live_staging_runs || []).length, 0);
assert.equal((persisted.runtime.universal_runs || []).length, 0);

const afterDetail = await call(`/operator/api/project-detail/${encodeURIComponent(gelatoScope)}`);
assert.equal(afterDetail.response.status, 200);
assert.equal(afterDetail.json.controlled_paid_staging.active, true);
assert.equal(afterDetail.json.controlled_paid_staging.remaining_budget_eur, 25);

const projects = await call('/operator/api/projects');
const gelatoRow = (projects.json.items || []).find((item) => item.scope_key === gelatoScope);
assert.ok(gelatoRow);
assert.equal(gelatoRow.controlled_paid_staging_snapshot.active, true);
assert.equal(gelatoRow.controlled_paid_staging_snapshot.project_budget_ceiling_eur, 25);

const shell = await call('/operator');
assert.equal(shell.response.status, 200);
const html = await shell.response.text();
assert.equal(html.includes(deployedSha.slice(0, 8)), true);
assert.equal(html.includes('Production: LOCKED'), true);
assert.equal(html.includes('External Writes: LOCKED'), true);
assert.equal(html.includes('aurentara-deployment-activation-dashboard-v1-ui'), true);
assert.equal(html.includes('VERSION UNKNOWN'), false);
assert.match(shell.response.headers.get('cache-control') || '', /no-store/);

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.operator-deployment-identity-gelato-activation-smoke.v1',
  deployment_identity: 'PASS',
  cache_safety: 'PASS',
  version_unknown_fail_safe: 'PASS',
  gelato_activation: 'PASS',
  durable_persistence: 'PASS',
  project_detail_projection: 'PASS',
  mission_studio_policy_projection: 'WIRED',
  budget_eur: 25,
  spent_eur: 0,
  reserved_eur: 0,
  remaining_eur: 25,
  gelato_mission_executed: false,
  paid_provider_calls: 0,
  external_writes: false,
  production_deploy: false
}, null, 2));
