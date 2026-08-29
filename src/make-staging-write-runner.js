import { bakeryMullerMakeStagingSpec, planMakeScenarioCreate } from './make-staging-bridge.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const ALLOWED_HOSTS = new Set(['eu1.make.com','eu2.make.com','us1.make.com','us2.make.com','eu1.make.celonis.com','us1.make.celonis.com']);
const ALLOWED_MODULES = new Set(['json:ParseJSON']);
const STAGING_NAME_PREFIX = 'RIOSYSTEMS STAGING - ';

function containsForbiddenRuntimeBinding(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenRuntimeBinding);
  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (['connection','connectionid','hook','hookid','webhook','webhookid','token','secret','password','authorization'].includes(lower)) return true;
    if (containsForbiddenRuntimeBinding(item)) return true;
  }
  return false;
}

function safeBlueprint(spec) {
  return {
    name: spec.name,
    flow: [
      {
        id: 1,
        module: 'json:ParseJSON',
        version: 1,
        metadata: {
          designer: {
            x: 0,
            y: 0,
            messages: [
              {
                category: 'last',
                severity: 'warning',
                message: 'RIOSYSTEMS staging shell only. No external connection is attached.'
              }
            ]
          }
        }
      }
    ],
    metadata: {
      version: 1,
      scenario: {
        roundtrips: 1,
        maxErrors: 1,
        autoCommit: true,
        autoCommitTriggerLast: true,
        sequential: true,
        confidential: false,
        dataloss: false,
        dlq: false,
        freshVariables: false
      },
      designer: { orphans: [] },
      riosystems: {
        environment: 'staging',
        project: 'bakery-muller',
        synthetic_test_data_only: true,
        external_connections: false
      }
    }
  };
}

export function buildMakeSafeStagingScenarioCreatePlan(input = {}) {
  const spec = input.scenario_spec || bakeryMullerMakeStagingSpec();
  const base = planMakeScenarioCreate({
    zone_url: input.zone_url,
    team_id: input.team_id,
    token_ref: input.token_ref,
    plan: input.plan,
    granted_scopes: input.granted_scopes,
    scenario_spec: spec,
    paid_provider_approved: input.paid_provider_approved,
    external_write_approved: input.external_write_approved,
    supervised_execution_approved: input.supervised_execution_approved,
    staging_only: input.staging_only,
    production_deploy: input.production_deploy
  });

  if (!base.ok || base.state !== 'WRITE_PLAN_APPROVED_NOT_EXECUTED') return base;
  if (spec.environment !== 'staging' || spec.production_deploy === true) return { ok: false, error: 'MAKE_STAGING_SPEC_REQUIRED', production_deploy: false };
  if (!clean(spec.name, 200).startsWith(STAGING_NAME_PREFIX)) return { ok: false, error: 'MAKE_STAGING_NAME_PREFIX_REQUIRED', production_deploy: false };
  if (spec.real_customer_data !== false || spec.downstream_crm_write !== false) return { ok: false, error: 'MAKE_SYNTHETIC_ISOLATED_SPEC_REQUIRED', production_deploy: false };

  const blueprint = safeBlueprint(spec);
  const scheduling = { type: 'on-demand' };
  return {
    ok: true,
    schema: 'riosystems.make-staging-scenario-create-http-plan.v1',
    provider_id: 'make-core',
    state: 'WRITE_PLAN_APPROVED_NOT_EXECUTED',
    request: {
      method: 'POST',
      url: base.request.url,
      required_scopes: ['scenarios:write'],
      auth: base.request.auth,
      body: {
        blueprint: JSON.stringify(blueprint),
        teamId: base.request.team_id,
        scheduling: JSON.stringify(scheduling)
      }
    },
    expected_state: { is_active: false, external_connections: false },
    staging_only: true,
    synthetic_test_data_only: true,
    external_write: true,
    execute_http: false,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

function validatePlan(plan = {}) {
  if (plan.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED' };
  if (plan.state !== 'WRITE_PLAN_APPROVED_NOT_EXECUTED') return { ok: false, error: 'MAKE_STAGING_CREATE_PLAN_NOT_READY' };
  if (plan.staging_only !== true || plan.synthetic_test_data_only !== true) return { ok: false, error: 'MAKE_STAGING_CREATE_ISOLATION_REQUIRED' };
  const request = plan.request || {};
  if (clean(request.method, 10).toUpperCase() !== 'POST') return { ok: false, error: 'MAKE_STAGING_CREATE_METHOD_REJECTED' };
  let url;
  try { url = new URL(clean(request.url, 600)); } catch { return { ok: false, error: 'MAKE_STAGING_CREATE_URL_INVALID' }; }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.pathname !== '/api/v2/scenarios' || url.search) {
    return { ok: false, error: 'MAKE_STAGING_CREATE_ENDPOINT_REJECTED' };
  }
  if (!request.auth?.token_ref) return { ok: false, error: 'MAKE_TOKEN_REFERENCE_REQUIRED' };
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'MAKE_STAGING_CREATE_BODY_REQUIRED' };
  const teamId = Number(body.teamId);
  if (!Number.isSafeInteger(teamId) || teamId <= 0) return { ok: false, error: 'MAKE_TEAM_ID_REQUIRED' };

  let blueprint;
  let scheduling;
  try { blueprint = JSON.parse(body.blueprint); } catch { return { ok: false, error: 'MAKE_BLUEPRINT_JSON_REQUIRED' }; }
  try { scheduling = JSON.parse(body.scheduling); } catch { return { ok: false, error: 'MAKE_SCHEDULING_JSON_REQUIRED' }; }
  if (!clean(blueprint?.name, 200).startsWith(STAGING_NAME_PREFIX)) return { ok: false, error: 'MAKE_STAGING_NAME_PREFIX_REQUIRED' };
  if (!Array.isArray(blueprint?.flow) || blueprint.flow.length < 1 || blueprint.flow.length > 3) return { ok: false, error: 'MAKE_STAGING_FLOW_REJECTED' };
  if (blueprint.flow.some((node) => !ALLOWED_MODULES.has(clean(node?.module, 100)))) return { ok: false, error: 'MAKE_STAGING_MODULE_REJECTED' };
  if (containsForbiddenRuntimeBinding(blueprint)) return { ok: false, error: 'MAKE_STAGING_RUNTIME_BINDING_REJECTED' };
  if (scheduling?.type !== 'on-demand') return { ok: false, error: 'MAKE_STAGING_ON_DEMAND_REQUIRED' };
  return { ok: true, url, team_id: teamId, body };
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function runMakeStagingScenarioCreate(plan = {}, runtime = {}) {
  if (runtime.production_deploy === true || plan.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (runtime.external_write_execution_approved !== true) return { ok: false, error: 'MAKE_EXTERNAL_WRITE_EXECUTION_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.supervised_execution_approved !== true) return { ok: false, error: 'MAKE_SUPERVISED_EXECUTION_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.paid_provider_approved !== true) return { ok: false, error: 'MAKE_PAID_PROVIDER_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.staging_only !== true) return { ok: false, error: 'MAKE_STAGING_ONLY_REQUIRED', production_deploy: false };
  if (typeof runtime.fetch_impl !== 'function') return { ok: false, error: 'MAKE_FETCH_IMPLEMENTATION_REQUIRED', production_deploy: false };
  if (typeof runtime.resolve_secret !== 'function') return { ok: false, error: 'MAKE_SECRET_RESOLVER_REQUIRED', production_deploy: false };

  const checked = validatePlan(plan);
  if (!checked.ok) return { ...checked, production_deploy: false };
  const token = clean(await runtime.resolve_secret(plan.request.auth.token_ref), 800);
  if (!token) return { ok: false, error: 'MAKE_SECRET_RESOLUTION_FAILED', production_deploy: false };
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 8000, 1000), 15000);

  let response;
  try {
    response = await fetchWithTimeout(runtime.fetch_impl, checked.url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checked.body),
      redirect: 'error'
    }, timeoutMs);
  } catch (error) {
    return { ok: false, error: 'MAKE_STAGING_CREATE_HTTP_FAILED', message: clean(error?.message, 300), external_side_effect_performed: false, production_deploy: false };
  }

  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (!response.ok) {
    return {
      ok: false,
      error: 'MAKE_STAGING_CREATE_HTTP_STATUS_ERROR',
      status: response.status,
      response_parseable: Boolean(parsed),
      external_side_effect_performed: false,
      production_deploy: false
    };
  }

  const scenario = parsed?.scenario;
  const scenarioId = Number(scenario?.id);
  if (!Number.isSafeInteger(scenarioId) || scenarioId <= 0) {
    return { ok: false, error: 'MAKE_STAGING_CREATE_RESPONSE_INVALID', status: response.status, external_side_effect_performed: true, production_deploy: false };
  }
  if (scenario?.isActive === true) {
    return { ok: false, error: 'MAKE_STAGING_SCENARIO_UNEXPECTEDLY_ACTIVE', scenario_id: scenarioId, external_side_effect_performed: true, production_deploy: false };
  }

  return {
    ok: true,
    schema: 'riosystems.make-staging-scenario-create-result.v1',
    stage: 'MAKE_STAGING_SCENARIO_CREATED_INACTIVE',
    scenario_id: scenarioId,
    is_active: false,
    token_ref: plan.request.auth.token_ref,
    secrets_returned: false,
    authorization_header_returned: false,
    external_side_effect_performed: true,
    production_deploy: false
  };
}

export function makeStagingWriteRunnerManifest() {
  return {
    schema: 'riosystems.make-staging-write-runner.v1',
    allowed_method: 'POST',
    allowed_path: '/api/v2/scenarios',
    allowed_modules: [...ALLOWED_MODULES],
    staging_name_prefix: STAGING_NAME_PREFIX,
    on_demand_only: true,
    external_connections_allowed: false,
    synthetic_test_data_only: true,
    explicit_external_write_execution_approval_required: true,
    supervised_execution_required: true,
    production_deploy: false
  };
}
