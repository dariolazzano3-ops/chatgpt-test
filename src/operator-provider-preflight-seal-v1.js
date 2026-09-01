import { handleOperatorDashboard as handleExistingOperatorDashboard } from './operator-provider-preflight-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import { runMissionCostPreflight } from './mission-cost-preflight-runner-v1.js';

const clone = (value) => structuredClone(value ?? null);
const asArray = (value) => Array.isArray(value) ? value : [];

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function authorize(request, env, ctx, options) {
  const auth = await authorizeOperator(request, env, ctx, options);
  if (auth.ok) return null;
  return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
}

async function readHistory(request, env, ctx, options) {
  const url = new URL(request.url);
  url.pathname = '/operator/api/estimate-history';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  const response = await handleExistingOperatorDashboard(probe, env, ctx, options);
  if (!response || response.status !== 200) return [];
  try {
    const body = await response.clone().json();
    return asArray(body.items);
  } catch {
    return [];
  }
}

export function reconcileOpenAiConnectionTruth(provider = {}) {
  if (provider.id !== 'openai-api') return clone(provider);
  const matrix = provider.evidence || {};
  const evidence = matrix.connection_evidence || {};
  const connection = evidence.connection || {};
  const execution = evidence.execution || {};
  const costGuard = evidence.cost_guard || {};
  const safety = evidence.safety || {};
  const connected = matrix.connection_state === 'CONNECTED_STAGING'
    && connection.credential_present === true
    && connection.credential_valid === true
    && connection.connected_staging === true
    && connection.http_status === 200
    && connection.authenticated === true
    && execution.inference_performed === false
    && execution.paid_execution_approved === false
    && costGuard.variable_cost_eur === 0
    && costGuard.automatic_paid_overflow === false
    && safety.secret_value_exposed === false
    && safety.production_deploy === false;
  if (!connected) return clone(provider);
  return {
    ...clone(provider),
    connection_state: 'CONNECTED_STAGING',
    verification: 'CONNECTION_VERIFIED_STAGING',
    credential_state: 'PRESENT_VALID',
    inference_verified: false,
    routing_ready: false,
    paid_execution_approved: false,
    automatic_paid_overflow: false,
    production_eligible: false,
    secrets_exposed: false,
    production_deploy: false
  };
}

function strictProviderRuntimeTruth(body = {}) {
  const providers = asArray(body.provider_ecosystem).map((provider) => {
    const reconciled = reconcileOpenAiConnectionTruth(provider);
    const active = reconciled.runtime_eligible !== false && reconciled.connection_state === 'CONNECTED_STAGING';
    return { ...reconciled, active_runtime: active };
  });
  return {
    ...clone(body),
    provider_ecosystem: providers,
    active_runtime_routes: providers.filter((provider) => provider.active_runtime === true),
    read_only_evidence_is_not_active_runtime: true,
    not_connected_never_runtime_eligible: providers.every((provider) => provider.connection_state !== 'NOT_CONNECTED' || provider.active_runtime === false),
    production_deploy: false,
    external_writes: false,
    additional_variable_cost_eur: 0
  };
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/operator/api/cost-preflight/quick') {
    const denied = await authorize(request, env, ctx, options);
    if (denied) return denied;
    let input = {};
    try { input = await request.json(); } catch { input = {}; }
    const history = await readHistory(request, env, ctx, options);
    return json(runMissionCostPreflight(input, { history }));
  }

  if (request.method === 'GET' && url.pathname === '/operator/api/provider-ecosystem') {
    const response = await handleExistingOperatorDashboard(request, env, ctx, options);
    if (!response || response.status !== 200) return response;
    try {
      const body = await response.clone().json();
      return json(strictProviderRuntimeTruth(body));
    } catch {
      return response;
    }
  }

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;

  const source = await response.text();
  const body = source.replace(`'"':'&quot'`, `'"':'&quot;'`);
  const headers = new Headers(response.headers);
  headers.set('x-aurentara-provider-preflight-seal-v1', 'enabled');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorProviderPreflightSealManifest() {
  return {
    schema: 'aurentara.operator-provider-preflight-seal.v1',
    governed_auto_deep_preflight: true,
    read_only_evidence_is_not_active_runtime: true,
    not_connected_never_runtime_eligible: true,
    openai_connection_evidence_reconciled: true,
    openai_inference_verification_not_implied: true,
    openai_paid_execution_remains_gated: true,
    same_existing_control_plane: true,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    paid_provider_activation: false,
    additional_variable_cost_eur: 0
  };
}
