import { planMakeScenarioRun } from './make-staging-bridge.js';
import { canonicalMakeSupabaseSyntheticLead } from './make-supabase-lead-bridge.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const ALLOWED_HOSTS = new Set(['eu1.make.com','eu2.make.com','us1.make.com','us2.make.com','eu1.make.celonis.com','us1.make.celonis.com']);
const STAGING_PREFIX = 'RIOSYSTEMS STAGING - ';
const ALLOWED_MODULES = new Set(['json:ParseJSON']);

function safeExecutableBlueprint(name) {
  const payload = canonicalMakeSupabaseSyntheticLead();
  return {
    name,
    flow: [{
      id: 1,
      module: 'json:ParseJSON',
      version: 1,
      parameters: { type: '' },
      mapper: { json: JSON.stringify(payload) },
      metadata: { designer: { x: 0, y: 0, name: 'RIOSYSTEMS Synthetic Make to Supabase Lead' }, parameters: [{ name: 'type', type: 'udt', label: 'Data structure' }] }
    }],
    metadata: {
      version: 1,
      scenario: { roundtrips: 1, maxErrors: 1, autoCommit: true, autoCommitTriggerLast: true, sequential: true, confidential: false, dataloss: false, dlq: false, freshVariables: false },
      designer: { orphans: [] },
      riosystems: { environment: 'staging', project: 'bakery-muller', scope_key: payload.project_scope, synthetic_test_data_only: true, external_connections: false }
    }
  };
}

function containsForbiddenBinding(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenBinding);
  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (['connection','connectionid','hook','hookid','webhook','webhookid','token','secret','password','authorization','callbackurl'].includes(lower)) return true;
    if (containsForbiddenBinding(item)) return true;
  }
  return false;
}

function validScenarioId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function buildUrl(origin, path) {
  const url = new URL(path, origin);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error('MAKE_STAGING_EXECUTION_HOST_REJECTED');
  return url.toString();
}

export function buildMakeSafeStagingExecutionPlan(input = {}) {
  const scenarioId = validScenarioId(input.scenario_id);
  if (!scenarioId) return { ok: false, error: 'MAKE_SCENARIO_ID_REQUIRED', production_deploy: false };
  const runPlan = planMakeScenarioRun({
    zone_url: input.zone_url,
    team_id: input.team_id,
    token_ref: input.token_ref,
    plan: input.plan,
    granted_scopes: input.granted_scopes,
    scenario_id: scenarioId,
    paid_provider_approved: input.paid_provider_approved,
    external_write_approved: input.external_write_approved,
    supervised_execution_approved: input.supervised_execution_approved,
    staging_only: input.staging_only,
    production_deploy: input.production_deploy
  });
  if (!runPlan.ok || runPlan.state !== 'RUN_PLAN_APPROVED_NOT_EXECUTED') return runPlan;
  const origin = new URL(runPlan.request.url).origin;
  return {
    ok: true,
    schema: 'riosystems.make-staging-execution-plan.v1',
    state: 'STAGING_EXECUTION_APPROVED_NOT_EXECUTED',
    provider_id: 'make-core',
    scenario_id: scenarioId,
    token_ref: runPlan.request.auth.token_ref,
    endpoints: {
      details: buildUrl(origin, `/api/v2/scenarios/${scenarioId}`),
      blueprint: buildUrl(origin, `/api/v2/scenarios/${scenarioId}/blueprint`),
      update: buildUrl(origin, `/api/v2/scenarios/${scenarioId}`),
      start: buildUrl(origin, `/api/v2/scenarios/${scenarioId}/start`),
      run: buildUrl(origin, `/api/v2/scenarios/${scenarioId}/run`),
      stop: buildUrl(origin, `/api/v2/scenarios/${scenarioId}/stop`)
    },
    required_scopes: ['scenarios:read','scenarios:write','scenarios:run'],
    synthetic_payload: canonicalMakeSupabaseSyntheticLead(),
    synthetic_test_data_only: true,
    external_connections_allowed: false,
    activate_only_for_single_supervised_run: true,
    restore_inactive_required: true,
    external_write: true,
    production_deploy: false
  };
}

async function call(fetchImpl, url, token, method = 'GET', body = undefined, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Token ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: response.ok, status: response.status, json };
  } finally { clearTimeout(timer); }
}

function verifyOriginalBlueprint(payload) {
  const blueprint = payload?.response?.blueprint ?? payload?.blueprint ?? null;
  if (!blueprint || !Array.isArray(blueprint.flow) || blueprint.flow.length < 1 || blueprint.flow.length > 3) return false;
  if (blueprint.flow.some((node) => !ALLOWED_MODULES.has(clean(node?.module, 100)))) return false;
  if (containsForbiddenBinding(blueprint)) return false;
  return true;
}

export async function runMakeStagingScenarioOnce(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (plan.state !== 'STAGING_EXECUTION_APPROVED_NOT_EXECUTED') return { ok: false, error: 'MAKE_STAGING_EXECUTION_PLAN_NOT_READY', production_deploy: false };
  if (runtime.confirmation !== 'RUN_STAGING_ONCE') return { ok: false, error: 'MAKE_STAGING_EXECUTION_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.external_write_execution_approved !== true || runtime.supervised_execution_approved !== true || runtime.paid_provider_approved !== true || runtime.staging_only !== true) {
    return { ok: false, error: 'MAKE_STAGING_EXECUTION_GATES_REQUIRED', production_deploy: false };
  }
  if (typeof runtime.fetch_impl !== 'function' || typeof runtime.resolve_secret !== 'function') return { ok: false, error: 'MAKE_STAGING_EXECUTION_RUNTIME_REQUIRED', production_deploy: false };
  const token = clean(await runtime.resolve_secret(plan.token_ref), 800);
  if (!token) return { ok: false, error: 'MAKE_SECRET_RESOLUTION_FAILED', production_deploy: false };
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 10000, 1000), 15000);

  const details = await call(runtime.fetch_impl, plan.endpoints.details, token, 'GET', undefined, timeoutMs);
  const scenario = details.json?.scenario;
  if (!details.ok || Number(scenario?.id) !== plan.scenario_id) return { ok: false, error: 'MAKE_STAGING_SCENARIO_DETAILS_REJECTED', status: details.status, production_deploy: false };
  if (!clean(scenario?.name, 200).startsWith(STAGING_PREFIX)) return { ok: false, error: 'MAKE_STAGING_SCENARIO_NAME_REJECTED', production_deploy: false };
  if (scenario?.isActive === true) return { ok: false, error: 'MAKE_STAGING_SCENARIO_ALREADY_ACTIVE', production_deploy: false };

  const currentBlueprint = await call(runtime.fetch_impl, plan.endpoints.blueprint, token, 'GET', undefined, timeoutMs);
  if (!currentBlueprint.ok || !verifyOriginalBlueprint(currentBlueprint.json)) return { ok: false, error: 'MAKE_STAGING_BLUEPRINT_REJECTED', status: currentBlueprint.status, production_deploy: false };

  const blueprint = safeExecutableBlueprint(scenario.name);
  const update = await call(runtime.fetch_impl, plan.endpoints.update, token, 'PATCH', {
    blueprint: JSON.stringify(blueprint),
    scheduling: JSON.stringify({ type: 'on-demand' })
  }, timeoutMs);
  if (!update.ok) return { ok: false, error: 'MAKE_STAGING_PREPARE_FAILED', status: update.status, external_side_effect_performed: false, production_deploy: false };

  let activated = false;
  let runResult = null;
  let stopResult = null;
  try {
    const start = await call(runtime.fetch_impl, plan.endpoints.start, token, 'POST', undefined, timeoutMs);
    if (!start.ok) return { ok: false, error: 'MAKE_STAGING_ACTIVATE_FAILED', status: start.status, external_side_effect_performed: true, production_deploy: false };
    activated = true;
    runResult = await call(runtime.fetch_impl, plan.endpoints.run, token, 'POST', { responsive: true }, timeoutMs);
  } finally {
    if (activated) {
      try { stopResult = await call(runtime.fetch_impl, plan.endpoints.stop, token, 'POST', undefined, timeoutMs); }
      catch { stopResult = { ok: false, status: null }; }
    }
  }

  if (!runResult?.ok) return { ok: false, error: 'MAKE_STAGING_RUN_FAILED', status: runResult?.status ?? null, scenario_restored_inactive: Boolean(stopResult?.ok), external_side_effect_performed: true, production_deploy: false };
  if (!stopResult?.ok) return { ok: false, error: 'MAKE_STAGING_STOP_FAILED', execution_id: clean(runResult.json?.executionId, 120) || null, scenario_restored_inactive: false, external_side_effect_performed: true, production_deploy: false };

  return {
    ok: true,
    schema: 'riosystems.make-staging-execution-result.v1',
    stage: 'MAKE_STAGING_EXECUTION_COMPLETE_AND_INACTIVE',
    scenario_id: plan.scenario_id,
    execution_id: clean(runResult.json?.executionId, 120) || null,
    execution_status: clean(runResult.json?.status, 40) || null,
    synthetic_payload: clone(plan.synthetic_payload),
    scenario_restored_inactive: true,
    synthetic_test_data_only: true,
    secrets_returned: false,
    authorization_header_returned: false,
    external_side_effect_performed: true,
    production_deploy: false
  };
}

export function makeStagingExecutionRunnerManifest() {
  return {
    schema: 'riosystems.make-staging-execution-runner.v1',
    staging_prefix: STAGING_PREFIX,
    allowed_modules: [...ALLOWED_MODULES],
    required_scopes: ['scenarios:read','scenarios:write','scenarios:run'],
    synthetic_bridge_payload_supported: true,
    synthetic_test_data_only: true,
    external_connections_allowed: false,
    single_supervised_run_only: true,
    restore_inactive_required: true,
    production_deploy: false
  };
}
