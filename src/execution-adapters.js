const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

const ADAPTERS = Object.freeze({
  web: Object.freeze({
    id: "web-factory-v1",
    engine: "web",
    mode: "contract",
    available: true,
    automatic_execution: false,
    production_deploy: false,
    accepts: ["website", "web_edit", "web_build"],
  }),
  app: Object.freeze({ id: "app-factory-v1", engine: "app", mode: "planned", available: false, automatic_execution: false, production_deploy: false, accepts: ["app"] }),
  automation: Object.freeze({ id: "automation-factory-v1", engine: "automation", mode: "planned", available: false, automatic_execution: false, production_deploy: false, accepts: ["automation", "lead_flow"] }),
  ai: Object.freeze({ id: "ai-factory-v1", engine: "ai", mode: "planned", available: false, automatic_execution: false, production_deploy: false, accepts: ["ai", "support_ai"] }),
  business: Object.freeze({ id: "business-factory-v1", engine: "business", mode: "planned", available: false, automatic_execution: false, production_deploy: false, accepts: ["business", "crm"] }),
});

export function listExecutionAdapters() {
  return Object.values(ADAPTERS).map((adapter) => ({ ...adapter, accepts: [...adapter.accepts] }));
}

export function resolveExecutionAdapter(contract = {}) {
  const engine = clean(contract.engine || contract.domain, 80).toLowerCase();
  const adapter = ADAPTERS[engine];
  if (!adapter) return { ok: false, error: "EXECUTION_ADAPTER_NOT_FOUND", engine };
  if (!adapter.available) return { ok: false, error: "EXECUTION_ADAPTER_UNAVAILABLE", engine, adapter: { ...adapter } };
  if (contract.state !== "READY") return { ok: false, error: "EXECUTION_CONTRACT_NOT_READY", state: contract.state, adapter: { ...adapter } };
  return { ok: true, adapter: { ...adapter, accepts: [...adapter.accepts] } };
}

export function buildAdapterDispatchEnvelope(contract = {}) {
  const resolved = resolveExecutionAdapter(contract);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    envelope_version: 1,
    adapter_id: resolved.adapter.id,
    engine: resolved.adapter.engine,
    mission_id: contract.mission_id,
    task_id: contract.task_id,
    capability: contract.capability,
    goal: contract.goal,
    project: contract.project || null,
    attempt: contract.attempt,
    max_attempts: contract.max_attempts,
    dependency_outputs: contract.dependency_outputs || {},
    execution: {
      automatic: false,
      dispatch_authorized: false,
      production_deploy: false,
      manual_production_approval_required: true,
    },
  };
}

export function validateAdapterResult(envelope = {}, result = {}) {
  if (!envelope.ok) return { ok: false, error: "INVALID_DISPATCH_ENVELOPE" };
  if (result.production_deploy === true) return { ok: false, error: "PRODUCTION_SIDE_EFFECT_REJECTED" };
  if (!['COMPLETED', 'FAILED'].includes(result.status)) return { ok: false, error: "INVALID_ADAPTER_RESULT_STATUS" };
  if (result.status === 'COMPLETED' && (!result.outputs || typeof result.outputs !== 'object' || Array.isArray(result.outputs))) return { ok: false, error: "ADAPTER_OUTPUTS_REQUIRED" };
  if (result.status === 'FAILED' && (!result.error || typeof result.error !== 'object' || Array.isArray(result.error))) return { ok: false, error: "ADAPTER_ERROR_REQUIRED" };
  return { ok: true, result: { status: result.status, outputs: result.outputs || {}, error: result.error || null, external_job_id: clean(result.external_job_id, 200) || null, production_deploy: false } };
}
