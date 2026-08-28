import { selectIntegration } from './integration-catalog.js';
import { evaluateRealProviderBridge } from './real-provider-bridge.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

function endpointHost(value) {
  if (!value) return null;
  try { return new URL(value).host; } catch { return null; }
}

export function evaluateIntegrationActivation(integration = {}, context = {}) {
  const blockers = [];
  if (!integration.id) blockers.push({ code: 'INTEGRATION_REQUIRED' });
  if (!integration.credential_ref && context.credentials_required !== false) blockers.push({ code: 'INTEGRATION_CREDENTIAL_REFERENCE_REQUIRED' });
  const host = endpointHost(integration.endpoint);
  if (host && !(integration.allowed_hosts || []).includes(host)) blockers.push({ code: 'INTEGRATION_HOST_NOT_ALLOWLISTED', host });
  if (integration.paid === true && context.cost_approved !== true) blockers.push({ code: 'INTEGRATION_COST_APPROVAL_REQUIRED' });
  if (integration.external_write === true && context.external_write_approved !== true) blockers.push({ code: 'INTEGRATION_EXTERNAL_WRITE_APPROVAL_REQUIRED' });
  if (context.production_deploy === true) blockers.push({ code: 'PRODUCTION_DEPLOY_NOT_ALLOWED_IN_PHASE4' });
  let realProvider = null;
  if (integration.real_provider === true) {
    if (!integration.provider_candidate) blockers.push({ code: 'REAL_PROVIDER_CANDIDATE_REQUIRED' });
    else {
      realProvider = evaluateRealProviderBridge(integration.provider_candidate, {
        requirements: context.provider_requirements || {},
        execute: context.execution_mode === 'execute',
        provider_activation_approved: context.provider_activation_approved === true,
        supervised_execution_approved: context.supervised_execution_approved === true,
        cost_approved: context.cost_approved === true,
        external_write_approved: context.external_write_approved === true,
        production_deploy: context.production_deploy === true
      });
      for (const blocker of realProvider.blockers) blockers.push(blocker);
    }
  }
  const uniqueBlockers = blockers.filter((item, index, values) => values.findIndex((other) => other.code === item.code && other.host === item.host && other.data_class === item.data_class) === index);
  return {
    ok: true,
    integration_id: integration.id || null,
    blockers: uniqueBlockers,
    ready: uniqueBlockers.length === 0,
    external_write: integration.external_write === true,
    real_provider: realProvider,
    production_deploy: false
  };
}

export function prepareIntegrationExecution(catalog = {}, request = {}, context = {}) {
  const selected = selectIntegration(catalog, request);
  if (!selected.ok) return selected;
  const executionMode = context.execution_mode === 'execute' ? 'execute' : 'dry_run';
  const activation = evaluateIntegrationActivation(selected.integration, { ...context, execution_mode: executionMode });
  if (!activation.ready) return { ok: true, stage: 'waiting_for_integration_approval', integration: clone({ ...selected.integration, runner: undefined }), activation, user_action_required: true, production_deploy: false };
  if (executionMode === 'execute' && typeof selected.integration.runner !== 'function') return { ok: false, error: 'INTEGRATION_RUNNER_NOT_CONFIGURED', integration_id: selected.integration.id, production_deploy: false };
  return {
    ok: true,
    stage: 'ready_for_supervised_integration_execution',
    integration: selected.integration,
    activation,
    execution_mode: executionMode,
    production_deploy: false
  };
}

export async function runIntegration(catalog = {}, request = {}, context = {}) {
  const prepared = prepareIntegrationExecution(catalog, request, context);
  if (!prepared.ok || prepared.user_action_required) return prepared;
  if (prepared.execution_mode !== 'execute') {
    return {
      ok: true,
      stage: 'dry_run_complete',
      integration: clone({ ...prepared.integration, runner: undefined }),
      request: clone(request.payload || null),
      external_side_effect_performed: false,
      production_deploy: false
    };
  }
  if (context.supervised_execution_approved !== true) {
    return { ok: true, stage: 'waiting_for_supervised_execution_approval', integration: clone({ ...prepared.integration, runner: undefined }), user_action_required: true, production_deploy: false };
  }
  let result;
  try {
    result = await prepared.integration.runner({
      payload: clone(request.payload || null),
      credential_ref: prepared.integration.credential_ref,
      endpoint: prepared.integration.endpoint,
      scope: clone(context.scope || null),
      production_deploy: false
    });
  } catch (error) {
    return { ok: false, stage: 'integration_execution_failed', error: 'INTEGRATION_RUNNER_EXCEPTION', message: clean(error?.message, 500), integration: clone({ ...prepared.integration, runner: undefined }), external_side_effect_performed: false, production_deploy: false };
  }
  if (result?.production_deploy === true) return { ok: false, stage: 'integration_execution_blocked', error: 'PRODUCTION_SIDE_EFFECT_REJECTED', integration: clone({ ...prepared.integration, runner: undefined }), external_side_effect_performed: false, production_deploy: false };
  if (result?.external_side_effect_performed === true && prepared.integration.external_write !== true) return { ok: false, stage: 'integration_execution_blocked', error: 'UNDECLARED_EXTERNAL_SIDE_EFFECT_REJECTED', integration: clone({ ...prepared.integration, runner: undefined }), external_side_effect_performed: false, production_deploy: false };
  return {
    ok: result?.ok !== false,
    stage: result?.ok === false ? 'integration_execution_failed' : 'integration_execution_complete',
    integration: clone({ ...prepared.integration, runner: undefined }),
    result: clone(result),
    external_side_effect_performed: prepared.integration.external_write === true,
    production_deploy: false
  };
}

export function integrationRuntimeManifest() {
  return {
    version: 'riosystems.integration-runtime.v1',
    safety: ['credential_refs','host_allowlist','hard_provider_eligibility','provider_activation_approval','cost_approval','external_write_approval','supervised_execution_approval','dry_run_default','production_side_effect_rejection'],
    real_execution_supported_with_injected_runner: true,
    implicit_external_execution: false,
    production_deploy: false
  };
}
