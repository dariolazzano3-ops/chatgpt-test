import { selectIntegration } from './integration-catalog.js';

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
  return {
    ok: true,
    integration_id: integration.id || null,
    blockers,
    ready: blockers.length === 0,
    external_write: integration.external_write === true,
    production_deploy: false
  };
}

export function prepareIntegrationExecution(catalog = {}, request = {}, context = {}) {
  const selected = selectIntegration(catalog, request);
  if (!selected.ok) return selected;
  const activation = evaluateIntegrationActivation(selected.integration, context);
  if (!activation.ready) return { ok: true, stage: 'waiting_for_integration_approval', integration: clone({ ...selected.integration, runner: undefined }), activation, user_action_required: true, production_deploy: false };
  if (typeof selected.integration.runner !== 'function') return { ok: false, error: 'INTEGRATION_RUNNER_NOT_CONFIGURED', integration_id: selected.integration.id, production_deploy: false };
  return {
    ok: true,
    stage: 'ready_for_supervised_integration_execution',
    integration: selected.integration,
    activation,
    execution_mode: context.execution_mode === 'execute' ? 'execute' : 'dry_run',
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
  const result = await prepared.integration.runner({
    payload: clone(request.payload || null),
    credential_ref: prepared.integration.credential_ref,
    endpoint: prepared.integration.endpoint,
    scope: clone(context.scope || null)
  });
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
    safety: ['credential_refs','host_allowlist','cost_approval','external_write_approval','supervised_execution_approval','dry_run_default'],
    real_execution_supported_with_injected_runner: true,
    implicit_external_execution: false,
    production_deploy: false
  };
}
