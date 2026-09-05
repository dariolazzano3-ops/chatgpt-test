const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

const ADAPTERS = Object.freeze({
  web: Object.freeze({ id: "web-factory-v1", engine: "web", mode: "provider_routed", provider_policy: "riosystems.web-provider-strategy.v1", default_build_provider: "riosystems-native-web", default_host_provider: "cloudflare-workers-free", available: true, automatic_execution: false, production_deploy: false, accepts: ["website", "web_edit", "web_build"] }),
  app: Object.freeze({ id: "app-factory-v1", engine: "app", mode: "planned", available: false, automatic_execution: false, production_deploy: false, accepts: ["app"] }),
  automation: Object.freeze({ id: "automation-factory-v1", engine: "automation", mode: "provider_routed", provider_policy: "riosystems.automation-provider-strategy.v1", default_runtime_provider: "make-core", secondary_runtime_provider: "activepieces-cloud-free", technical_specialist_provider: "n8n-client-owned", available: true, automatic_execution: false, external_side_effects: "supervised_only", production_deploy: false, accepts: ["automation", "lead_flow", "workflow", "api_flow", "webhook_flow"] }),
  ai: Object.freeze({ id: "ai-factory-v1", engine: "ai", mode: "provider_routed", provider_policy: "riosystems.ai-provider-strategy.v1", default_provider: "openai-api", free_staging_provider: "cloudflare-workers-ai-free", available: true, automatic_execution: false, provider_configured: false, tool_access: false, external_data_access: false, external_side_effects: false, production_deploy: false, accepts: ["ai", "support_ai", "ai_system_build"] }),
  business: Object.freeze({ id: "business-factory-v1", engine: "business", mode: "provider_routed", provider_policy: "riosystems.business-provider-strategy.v1", default_backend_provider: "supabase-free", default_analytics_provider: "posthog-free", available: true, automatic_execution: false, external_writes: false, production_deploy: false, accepts: ["business", "crm", "business_system_build", "lead_system", "sales_pipeline", "offer_flow"] })
});

export function listExecutionAdapters() { return Object.values(ADAPTERS).map((adapter) => ({ ...adapter, accepts: [...adapter.accepts] })); }
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
  return { ok: true, result: { status: result.status, outputs: result.outputs || {}, error: result.error || null, external_job_id: clean(result.external_job_id, 200) || null, production_deploy: false } };
}
