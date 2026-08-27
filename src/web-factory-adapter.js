import { handleFactory } from './factory.js';

function modeForCapability(capability) {
  if (capability === 'web_generate') return 'generate';
  if (capability === 'web_rebuild') return 'rebuild';
  if (capability === 'web_evolve') return 'evolve';
  return null;
}

export function buildWebFactoryInvocation(envelope = {}, options = {}) {
  if (!envelope.ok || envelope.engine !== 'web') return { ok: false, error: 'INVALID_WEB_ADAPTER_ENVELOPE' };
  const mode = modeForCapability(envelope.capability);
  if (!mode) return { ok: false, error: 'UNSUPPORTED_WEB_CAPABILITY' };
  const endpoint = mode === 'evolve' ? '/factory/evolve/apply' : `/factory/${mode}/run`;
  return {
    ok: true,
    mode,
    endpoint,
    body: {
      project: envelope.project || undefined,
      project_slug: envelope.project || undefined,
      prompt: envelope.goal,
      source_url: options.source_url,
      dependency_outputs: envelope.dependency_outputs || {},
      limits: {
        max_iterations: 1,
        api_budget_eur: 0,
        auto_deploy: false,
        require_approval_before_production: true,
      },
    },
    production_deploy: false,
  };
}

export async function runWebFactoryAdapter(envelope = {}, options = {}) {
  const invocation = buildWebFactoryInvocation(envelope, options);
  if (!invocation.ok) return { status: 'FAILED', error: { code: invocation.error, retryable: false }, production_deploy: false };
  if (options.authorize_execution !== true) {
    return { status: 'FAILED', error: { code: 'WEB_FACTORY_EXECUTION_NOT_AUTHORIZED', retryable: false }, production_deploy: false };
  }

  const baseUrl = options.base_url || 'https://factory.local';
  const request = new Request(new URL(invocation.endpoint, baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(invocation.body),
  });
  const handler = options.handler || handleFactory;
  const response = await handler(request, options.env || {});
  if (!response) return { status: 'FAILED', error: { code: 'WEB_FACTORY_NO_RESPONSE', retryable: true }, production_deploy: false };
  const payload = await response.json();
  if (!response.ok || payload?.error) {
    return {
      status: 'FAILED',
      error: { code: payload?.error || `WEB_FACTORY_HTTP_${response.status}`, message: payload?.stage || null, retryable: response.status >= 500 },
      production_deploy: false,
    };
  }
  if (payload?.production_deployed === true || payload?.production_deploy === true) {
    return { status: 'FAILED', error: { code: 'PRODUCTION_SIDE_EFFECT_REJECTED', retryable: false }, production_deploy: true };
  }
  return {
    status: 'COMPLETED',
    outputs: {
      mode: invocation.mode,
      preview_url: payload?.preview_url || payload?.materialization?.preview?.url || null,
      project: payload?.project || envelope.project || null,
      result: payload,
    },
    production_deploy: false,
  };
}
