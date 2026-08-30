const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const clean = (value, max = 200) => String(value || '').trim().slice(0, max);

const ALL_TASKS = Object.freeze([
  'classification', 'extraction', 'summarization', 'generation',
  'analysis', 'decision_support', 'rewriting', 'structured_planning'
]);

function baseDescriptor(input = {}) {
  return {
    id: clean(input.id, 120),
    kind: clean(input.kind, 80),
    enabled: input.enabled === true,
    external: input.external === true,
    paid: input.paid === true,
    capabilities: Array.isArray(input.capabilities) ? [...input.capabilities] : [...ALL_TASKS],
    data_classes: Array.isArray(input.data_classes) ? [...input.data_classes] : ['synthetic'],
    logical_models: Array.isArray(input.logical_models) ? [...input.logical_models] : ['Luna', 'Terra', 'Sol'],
    latency_classes: Array.isArray(input.latency_classes) ? [...input.latency_classes] : ['interactive', 'standard', 'batch'],
    zero_cost_verified: input.zero_cost_verified === true,
    requires_credential: input.requires_credential === true,
    credential_present: input.credential_present === true,
    paid_execution_approved: input.paid_execution_approved === true,
    automatic_paid_overflow: false,
    production: false
  };
}

export function createDeterministicTestProvider(options = {}) {
  const scripted = typeof options.scripted_response === 'function' ? options.scripted_response : null;
  const fixtures = options.fixtures && typeof options.fixtures === 'object' ? clone(options.fixtures) : {};
  const descriptor = baseDescriptor({
    id: options.id || 'deterministic-local',
    kind: 'deterministic_test',
    enabled: options.enabled !== false,
    external: false,
    paid: false,
    capabilities: ALL_TASKS,
    data_classes: ['synthetic', 'internal'],
    logical_models: ['Luna', 'Terra', 'Sol'],
    zero_cost_verified: true,
    requires_credential: false
  });

  return {
    ...descriptor,
    estimateCost: () => ({ estimated_cost_eur: 0, pricing_source: 'deterministic_zero_cost' }),
    async infer(request = {}) {
      const fixtureKey = clean(request.task?.fixture_id || request.task?.task_id || request.task?.capability || request.task?.task_type, 160);
      let output;
      if (scripted) output = await scripted(clone(request));
      else if (Object.prototype.hasOwnProperty.call(fixtures, fixtureKey)) output = clone(fixtures[fixtureKey]);
      else output = clone(request.task?.deterministic_output ?? {});
      return {
        ok: true,
        provider: descriptor.id,
        provider_model: 'deterministic-v1',
        logical_model: request.route?.logical_model || 'Luna',
        output,
        usage: { input_tokens: 0, output_tokens: 0 },
        actual_cost_eur: 0
      };
    }
  };
}

export function createOpenAIAdapter(options = {}) {
  const invoke = typeof options.invoke === 'function' ? options.invoke : null;
  const descriptor = baseDescriptor({
    id: options.id || 'openai',
    kind: 'openai_api',
    enabled: options.enabled === true,
    external: true,
    paid: true,
    capabilities: ALL_TASKS,
    data_classes: Array.isArray(options.data_classes) ? options.data_classes : ['synthetic', 'internal'],
    logical_models: ['Luna', 'Terra', 'Sol'],
    zero_cost_verified: false,
    requires_credential: true,
    credential_present: options.credential_present === true,
    paid_execution_approved: options.paid_execution_approved === true
  });
  const models = Object.freeze({
    Luna: clean(options.models?.Luna, 160) || 'provider-configured-luna',
    Terra: clean(options.models?.Terra, 160) || 'provider-configured-terra',
    Sol: clean(options.models?.Sol, 160) || 'provider-configured-sol'
  });
  const pricing = options.pricing_eur_per_million_tokens && typeof options.pricing_eur_per_million_tokens === 'object'
    ? clone(options.pricing_eur_per_million_tokens) : null;

  return {
    ...descriptor,
    models,
    estimateCost(estimate = {}) {
      const logicalModel = estimate.logical_model || 'Luna';
      const rate = pricing?.[logicalModel];
      if (!rate) return { estimated_cost_eur: null, pricing_source: 'pricing_not_configured' };
      const input = Number(estimate.input_tokens || 0);
      const output = Number(estimate.output_tokens || 0);
      const cost = (input * Number(rate.input || 0) + output * Number(rate.output || 0)) / 1_000_000;
      return { estimated_cost_eur: Number.isFinite(cost) ? cost : null, pricing_source: 'runtime_config' };
    },
    async infer(request = {}) {
      if (!descriptor.credential_present) return { ok: false, error: 'OPENAI_CREDENTIAL_REQUIRED', retryable: false };
      if (!descriptor.paid_execution_approved) return { ok: false, error: 'OPENAI_PAID_EXECUTION_APPROVAL_REQUIRED', retryable: false };
      if (typeof invoke !== 'function') return { ok: false, error: 'OPENAI_INVOKER_NOT_CONFIGURED', retryable: false };
      const response = await invoke({
        model: models[request.route?.logical_model || 'Luna'],
        prompt_contract: clone(request.prompt),
        output_schema: clone(request.task?.expected_output_schema),
        metadata: { ai_run_id: request.ai_run_id, attempt: request.attempt }
      });
      return {
        ok: response?.ok !== false,
        error: response?.error || null,
        retryable: response?.retryable === true,
        provider: descriptor.id,
        provider_model: models[request.route?.logical_model || 'Luna'],
        logical_model: request.route?.logical_model || 'Luna',
        output: clone(response?.output),
        usage: clone(response?.usage || null),
        actual_cost_eur: Number.isFinite(response?.actual_cost_eur) ? Number(response.actual_cost_eur) : null
      };
    }
  };
}

export function createCloudflareWorkersAIAdapter(options = {}) {
  const invoke = typeof options.invoke === 'function' ? options.invoke : null;
  const descriptor = baseDescriptor({
    id: options.id || 'cloudflare-workers-ai',
    kind: 'cloudflare_workers_ai',
    enabled: options.enabled === true,
    external: true,
    paid: false,
    capabilities: ALL_TASKS,
    data_classes: ['synthetic'],
    logical_models: ['Luna', 'Terra'],
    zero_cost_verified: options.zero_cost_verified === true,
    requires_credential: true,
    credential_present: options.credential_present === true
  });
  const models = Object.freeze({
    Luna: clean(options.models?.Luna, 200) || 'provider-configured-free-model',
    Terra: clean(options.models?.Terra, 200) || 'provider-configured-free-model'
  });

  return {
    ...descriptor,
    hard_fail_above_free: true,
    models,
    estimateCost: () => descriptor.zero_cost_verified
      ? { estimated_cost_eur: 0, pricing_source: 'verified_zero_cost_staging_gate' }
      : { estimated_cost_eur: null, pricing_source: 'zero_cost_not_verified' },
    async infer(request = {}) {
      if (!descriptor.zero_cost_verified) return { ok: false, error: 'CLOUDFLARE_ZERO_COST_NOT_VERIFIED', retryable: false };
      if (!descriptor.credential_present) return { ok: false, error: 'CLOUDFLARE_CREDENTIAL_REQUIRED', retryable: false };
      if (typeof invoke !== 'function') return { ok: false, error: 'CLOUDFLARE_INVOKER_NOT_CONFIGURED', retryable: false };
      const response = await invoke({
        model: models[request.route?.logical_model || 'Luna'],
        prompt_contract: clone(request.prompt),
        output_schema: clone(request.task?.expected_output_schema),
        synthetic_only: true,
        hard_fail_above_free: true,
        metadata: { ai_run_id: request.ai_run_id, attempt: request.attempt }
      });
      return {
        ok: response?.ok !== false,
        error: response?.error || null,
        retryable: response?.retryable === true,
        provider: descriptor.id,
        provider_model: models[request.route?.logical_model || 'Luna'],
        logical_model: request.route?.logical_model || 'Luna',
        output: clone(response?.output),
        usage: clone(response?.usage || null),
        actual_cost_eur: 0
      };
    }
  };
}

export function providerAdapterManifest(provider = {}) {
  const { infer, estimateCost, ...safe } = provider || {};
  return {
    ...clone(safe),
    infer_configured: typeof infer === 'function',
    cost_estimator_configured: typeof estimateCost === 'function',
    secrets_exposed: false
  };
}
