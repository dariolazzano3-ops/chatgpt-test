const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

const ADAPTERS = Object.freeze({
  web: Object.freeze({ id: "web-factory-v1", engine: "web", mode: "provider_routed", provider_policy: "riosystems.web-provider-strategy.v1", default_build_provider: "riosystems-native-web", default_host_provider: "cloudflare-workers-free", available: true, automatic_execution: false, production_deploy: false, accepts: ["website", "web_edit", "web_build"] }),
  app: Object.freeze({ id: "app-factory-v1", engine: "app", mode: "planned", available: false, automatic_execution: false, production_deploy: false, accepts: ["app"] }),
  automation: Object.freeze({ id: "automation-factory-v1", engine: "automation", mode: "provider_routed", provider_policy: "riosystems.automation-provider-strategy.v1", default_runtime_provider: "make-core", secondary_runtime_provider: "activepieces-cloud-free", technical_specialist_provider: "n8n-client-owned", available: true, automatic_execution: false, external_side_effects: "supervised_only", production_deploy: false, accepts: ["automation", "lead_flow", "workflow", "api_flow", "webhook_flow"] }),
  ai: Object.freeze({ id: "ai-factory-v1", engine: "ai", mode: "provider_routed", provider_policy: "riosystems.ai-provider-strategy.v1", default_provider: "openai-api", free_staging_provider: "cloudflare-workers-ai-free", available: true, automatic_execution: false, provider_configured: false, tool_access: false, external_data_access: false, external_side_effects: false, production_deploy: false, accepts: ["ai", "support_ai", "ai_system_build"] }),
  business: Object.freeze({ id: "business-factory-v1", engine: "business", mode: "provider_routed", provider_policy: "riosystems.business-provider-strategy.v1", default_backend_provider: "supabase-free", default_analytics_provider: "posthog-free", available: true, automatic_execution: false, external_writes: false, production_deploy: false, accepts: ["business", "crm", "business_system_build", "lead_system", "sales_pipeline", "offer_flow"] })
});

export function listExecutionAdapters() { return Object.values(ADAPTERS).map((adapter) => ({ ...adapter, accepts: [...adapter.accepts] })); }

export function canonicalProviderExecutorDescriptor(providerId) {
  switch (clean(providerId, 120)) {
    case 'riosystems-native-web':
      return { provider_id: 'riosystems-native-web', executor_id: 'web-factory-native-v1', accepted_capabilities: ['web.build'], environment: 'staging', production_eligible: false };
    case 'cloudflare-workers-free':
      return { provider_id: 'cloudflare-workers-free', executor_id: 'cloudflare-staging-preview-v1', accepted_capabilities: ['web.deploy'], environment: 'staging', production_eligible: false };
    case 'openai-api':
      return { provider_id: 'openai-api', executor_id: 'openai-api-adapter-v1', accepted_capabilities: ['ai.generate','ai.analyze','ai.classify','ai.extract'], environment: 'staging', production_eligible: false };
    case 'make-core':
      return { provider_id: 'make-core', executor_id: 'make-staging-execution-runner-v1', accepted_capabilities: ['automation.run'], environment: 'staging', production_eligible: false };
    case 'supabase-free':
      return { provider_id: 'supabase-free', executor_id: 'supabase-staging-write-runner-v2', accepted_capabilities: ['business.configure','business.crm.write','storage.data'], environment: 'staging', production_eligible: false };
    case 'posthog-free':
      return { provider_id: 'posthog-free', executor_id: 'posthog-staging-runner-v1', accepted_capabilities: ['web.analytics','business.analytics'], environment: 'staging', production_eligible: false };
    default:
      return null;
  }
}

export function validateProviderExecutionTruth(envelope = {}, result = {}) {
  const plannedProvider = clean(envelope.provider_route?.provider_id, 120);
  const dispatchedProvider = clean(result.dispatched_provider, 120);
  const actualProvider = clean(result.actual_provider, 120);
  const executorId = clean(result.executor_id, 160);
  if (!plannedProvider) return { ok: false, error: 'PROVIDER_ROUTE_REQUIRED' };
  const descriptor = canonicalProviderExecutorDescriptor(plannedProvider);
  if (!descriptor) return { ok: false, error: 'PROVIDER_EXECUTOR_NOT_AVAILABLE', planned_provider: plannedProvider };
  if (!dispatchedProvider || !actualProvider || !executorId || dispatchedProvider !== plannedProvider || actualProvider !== plannedProvider) {
    return {
      ok: false,
      error: 'PROVIDER_EXECUTION_TRUTH_MISMATCH',
      planned_provider: plannedProvider,
      dispatched_provider: dispatchedProvider || null,
      actual_provider: actualProvider || null,
      executor_id: executorId || null
    };
  }
  const expectedExecutor = clean(envelope.executor_id, 160) || descriptor.executor_id;
  if (executorId !== expectedExecutor) {
    return {
      ok: false,
      error: 'PROVIDER_EXECUTOR_ID_MISMATCH',
      planned_provider: plannedProvider,
      actual_provider: actualProvider,
      expected_executor_id: expectedExecutor,
      actual_executor_id: executorId
    };
  }
  return {
    ok: true,
    planned_provider: plannedProvider,
    dispatched_provider: dispatchedProvider,
    actual_provider: actualProvider,
    executor_id: executorId
  };
}

export async function executeCanonicalProviderRoute(envelope = {}, runtime = {}) {
  if (!envelope?.ok) return { ok: false, error: 'INVALID_DISPATCH_ENVELOPE' };
  if (envelope.provider_execution_version !== 'riosystems.provider-execution.v1') return { ok: false, error: 'PROVIDER_EXECUTION_VERSION_UNSUPPORTED' };
  if (envelope.environment !== 'staging' || envelope.production_policy !== 'PRODUCTION_DISABLED' || envelope.execution?.production_deploy === true) {
    return { ok: false, error: 'PROVIDER_EXECUTION_ENVIRONMENT_REJECTED' };
  }
  const plannedProvider = clean(envelope.provider_route?.provider_id, 120);
  const descriptor = canonicalProviderExecutorDescriptor(plannedProvider);
  if (!descriptor) return { ok: false, error: 'PROVIDER_EXECUTOR_NOT_AVAILABLE', planned_provider: plannedProvider || null };
  const routeCapability = clean(envelope.provider_route?.capability || envelope.capability, 120);
  if (!descriptor.accepted_capabilities.includes(routeCapability)) {
    return { ok: false, error: 'PROVIDER_CAPABILITY_NOT_ACCEPTED', provider_id: plannedProvider, capability: routeCapability };
  }
  const verified = new Set(Array.isArray(runtime.current_runtime_verified_provider_ids) ? runtime.current_runtime_verified_provider_ids : []);
  if (!verified.has(plannedProvider)) {
    return { ok: false, error: 'PROVIDER_NOT_EXECUTION_READY', provider_id: plannedProvider };
  }
  const executor = runtime.executors && typeof runtime.executors[plannedProvider] === 'function' ? runtime.executors[plannedProvider] : null;
  if (!executor) return { ok: false, error: 'PROVIDER_EXECUTOR_NOT_CONFIGURED', provider_id: plannedProvider, executor_id: descriptor.executor_id };
  let raw;
  try {
    raw = await executor({ envelope, descriptor, provider_id: plannedProvider, capability: routeCapability });
  } catch (error) {
    return { ok: false, error: 'PROVIDER_EXECUTOR_THROWN', provider_id: plannedProvider, message: clean(error?.message, 300) || null };
  }
  const status = raw?.status === 'FAILED' || raw?.ok === false ? 'FAILED' : 'COMPLETED';
  const adapterResult = status === 'COMPLETED'
    ? {
        status,
        outputs: raw?.outputs && typeof raw.outputs === 'object' && !Array.isArray(raw.outputs) ? raw.outputs : { provider_result: raw ?? null },
        dispatched_provider: plannedProvider,
        actual_provider: clean(raw?.actual_provider, 120) || null,
        executor_id: clean(raw?.executor_id, 160) || null,
        external_job_id: clean(raw?.external_job_id || raw?.execution_id, 200) || null,
        production_deploy: raw?.production_deploy === true
      }
    : {
        status,
        error: raw?.error && typeof raw.error === 'object' && !Array.isArray(raw.error)
          ? raw.error
          : { code: clean(raw?.error, 160) || 'PROVIDER_EXECUTION_FAILED', message: clean(raw?.message, 500) || null, retryable: raw?.retryable === true },
        dispatched_provider: plannedProvider,
        actual_provider: clean(raw?.actual_provider, 120) || null,
        executor_id: clean(raw?.executor_id, 160) || null,
        external_job_id: clean(raw?.external_job_id || raw?.execution_id, 200) || null,
        production_deploy: raw?.production_deploy === true
      };
  const validated = validateAdapterResult(envelope, adapterResult);
  if (!validated.ok) return { ...validated, raw_result: raw ?? null };
  return {
    ok: true,
    status: validated.result.status,
    result: validated.result,
    provider_truth: {
      planned_provider: validated.result.planned_provider,
      dispatched_provider: validated.result.dispatched_provider,
      actual_provider: validated.result.actual_provider,
      executor_id: validated.result.executor_id
    },
    raw_result: raw ?? null,
    production_deploy: false
  };
}
export function resolveExecutionAdapter(contract = {}) {
  const domain = clean(contract.domain, 80).toLowerCase();
  const legacyEngine = clean(contract.engine, 80).toLowerCase();
  const adapterKey = domain && ADAPTERS[domain] ? domain : legacyEngine;
  const adapter = ADAPTERS[adapterKey];
  if (!adapter) return { ok: false, error: "EXECUTION_ADAPTER_NOT_FOUND", engine: legacyEngine || domain };
  if (!adapter.available) return { ok: false, error: "EXECUTION_ADAPTER_UNAVAILABLE", engine: adapterKey, adapter: { ...adapter } };
  if (contract.factory && contract.factory !== adapter.engine) return { ok: false, error: "EXECUTION_FACTORY_ADAPTER_MISMATCH", factory: contract.factory, adapter_engine: adapter.engine };
  if (contract.provider_execution_version && contract.provider_execution_version !== 'riosystems.provider-execution.v1') return { ok: false, error: "PROVIDER_EXECUTION_VERSION_UNSUPPORTED" };
  if (contract.environment && contract.environment !== 'staging') return { ok: false, error: "EXECUTION_ENVIRONMENT_NOT_ALLOWED" };
  if (contract.write_policy && contract.write_policy !== 'NO_EXTERNAL_WRITES') return { ok: false, error: "EXECUTION_WRITE_POLICY_NOT_ALLOWED" };
  if (contract.production_policy && contract.production_policy !== 'PRODUCTION_DISABLED') return { ok: false, error: "EXECUTION_PRODUCTION_POLICY_NOT_ALLOWED" };
  if (contract.state !== "READY") return { ok: false, error: "EXECUTION_CONTRACT_NOT_READY", state: contract.state, adapter: { ...adapter } };
  return { ok: true, adapter: { ...adapter, accepts: [...adapter.accepts] }, underlying_engine: legacyEngine || null };
}
export function buildAdapterDispatchEnvelope(contract = {}) {
  const resolved = resolveExecutionAdapter(contract); if (!resolved.ok) return resolved;
  return {
    ok: true,
    envelope_version: 1,
    adapter_id: resolved.adapter.id,
    engine: resolved.adapter.engine,
    underlying_engine: resolved.underlying_engine,
    mission_id: contract.mission_id,
    task_id: contract.task_id,
    execution_id: contract.execution_id || null,
    provider_execution_version: contract.provider_execution_version || null,
    capability: contract.capability,
    factory: contract.factory || resolved.adapter.engine,
    goal: contract.goal,
    project: contract.project || null,
    customer_id: contract.customer_id || null,
    project_id: contract.project_id || null,
    project_scope_key: contract.project_scope_key || null,
    knowledge_snapshot_ref: contract.knowledge_snapshot_ref || null,
    project_knowledge: contract.project_knowledge || null,
    knowledge_revision: contract.knowledge_revision || null,
    content_pack_ref: contract.content_pack_ref || null,
    visual_pack_ref: contract.visual_pack_ref || null,
    readiness_ref: contract.readiness_ref || null,
    fact_version_refs: contract.fact_version_refs || [],
    source_refs: contract.source_refs || [],
    rights_constraints: contract.rights_constraints || {},
    human_decision_refs: contract.human_decision_refs || [],
    approved_assets: contract.approved_assets || [],
    open_critical_conflicts: contract.open_critical_conflicts || [],
    provider_route: contract.provider_route || null,
    executor_id: contract.executor_id || null,
    budget_reservation_ref: contract.budget_reservation_ref || null,
    approval_ref: contract.approval_ref || null,
    environment: contract.environment || 'staging',
    write_policy: contract.write_policy || 'NO_EXTERNAL_WRITES',
    production_policy: contract.production_policy || 'PRODUCTION_DISABLED',
    evidence_policy: contract.evidence_policy || {},
    attempt: contract.attempt,
    max_attempts: contract.max_attempts,
    dependency_outputs: contract.dependency_outputs || {},
    execution: { automatic: false, dispatch_authorized: false, production_deploy: false, external_writes: false, manual_production_approval_required: true, canonical_execution_contract: true }
  };
}
export function authorizeAdapterDispatch(envelope = {}, approval = {}) {
  if (!envelope.ok) return { ok: false, error: "INVALID_DISPATCH_ENVELOPE" };
  if (approval.production_deploy === true) return { ok: false, error: "PRODUCTION_SIDE_EFFECT_REJECTED" };
  if (approval.authorized !== true) return { ok: false, error: "ADAPTER_DISPATCH_APPROVAL_REQUIRED" };
  return { ok: true, envelope: { ...envelope, execution: { ...envelope.execution, dispatch_authorized: true, production_deploy: false } } };
}
export function validateAdapterResult(envelope = {}, result = {}) {
  if (!envelope.ok) return { ok: false, error: "INVALID_DISPATCH_ENVELOPE" };
  if (result.production_deploy === true) return { ok: false, error: "PRODUCTION_SIDE_EFFECT_REJECTED" };
  if (!["COMPLETED", "FAILED"].includes(result.status)) return { ok: false, error: "INVALID_ADAPTER_RESULT_STATUS" };
  if (result.status === "COMPLETED" && (!result.outputs || typeof result.outputs !== "object" || Array.isArray(result.outputs))) return { ok: false, error: "ADAPTER_OUTPUTS_REQUIRED" };
  if (result.status === "FAILED" && (!result.error || typeof result.error !== "object" || Array.isArray(result.error))) return { ok: false, error: "ADAPTER_ERROR_REQUIRED" };
  let providerTruth = null;
  if (envelope.provider_route?.provider_id) {
    providerTruth = validateProviderExecutionTruth(envelope, result);
    if (!providerTruth.ok) return providerTruth;
  }
  return {
    ok: true,
    result: {
      status: result.status,
      outputs: result.outputs || {},
      error: result.error || null,
      external_job_id: clean(result.external_job_id, 200) || null,
      planned_provider: providerTruth?.planned_provider || null,
      dispatched_provider: providerTruth?.dispatched_provider || null,
      actual_provider: providerTruth?.actual_provider || null,
      executor_id: providerTruth?.executor_id || null,
      production_deploy: false
    }
  };
}
