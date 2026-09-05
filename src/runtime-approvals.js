const clean = (value, max = 200) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value ?? null;
}

function sameBinding(a, b) {
  return JSON.stringify(canonical(a || null)) === JSON.stringify(canonical(b || null));
}

export function createExecutionApprovalBinding(contract = {}, input = {}) {
  const costCeiling = Number(input.cost_ceiling_eur);
  return {
    schema: 'riosystems.execution-approval-binding.v1',
    mission_id: clean(contract.mission_id || input.mission_id, 180) || null,
    task_id: clean(contract.task_id || input.task_id, 180) || null,
    execution_id: clean(contract.execution_id || input.execution_id, 200) || null,
    execution_contract_revision: Number(contract.execution_contract_revision || input.execution_contract_revision || 0) || null,
    execution_contract_hash: clean(contract.execution_contract_hash || input.execution_contract_hash, 160) || null,
    knowledge_revision: Number(contract.knowledge_revision ?? input.knowledge_revision ?? 0) || null,
    provider_route: clone(contract.provider_route || input.provider_route || null),
    provider_id: clean(input.provider_id || contract.provider_route?.provider_id, 160) || null,
    cost_ceiling_eur: Number.isFinite(costCeiling) ? Math.max(0, costCeiling) : null,
    environment: clean(contract.environment || input.environment, 80) || null,
    write_scope: clean(input.write_scope || contract.write_policy, 120) || null,
    production_scope: clean(input.production_scope || contract.production_policy, 120) || null
  };
}

export function createApprovalRecord(input = {}) {
  const customerId = clean(input.customer_id, 120);
  const projectId = clean(input.project_id, 120);
  const approvalType = clean(input.approval_type, 120);
  const actorId = clean(input.actor_id, 160);
  if (!customerId || !projectId) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED' };
  if (!approvalType) return { ok: false, error: 'APPROVAL_TYPE_REQUIRED' };
  if (!actorId) return { ok: false, error: 'APPROVAL_ACTOR_REQUIRED' };
  const expiresAt = input.expires_at ? new Date(input.expires_at) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { ok: false, error: 'APPROVAL_EXPIRY_INVALID' };
  return {
    ok: true,
    approval: {
      approval_version: 'riosystems.approval.v1',
      approval_id: clean(input.approval_id, 180) || `${customerId}:${projectId}:${approvalType}:${actorId}`,
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      approval_type: approvalType,
      actor_id: actorId,
      provider_id: clean(input.provider_id, 120) || null,
      capability: clean(input.capability, 120) || null,
      binding: input.binding && typeof input.binding === 'object' ? clone(input.binding) : null,
      granted: input.granted === true,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      metadata: input.metadata && typeof input.metadata === 'object' ? clone(input.metadata) : {},
      production_deploy: false
    }
  };
}

export function evaluateApproval(records = [], request = {}, now = new Date()) {
  const customerId = clean(request.customer_id, 120);
  const projectId = clean(request.project_id, 120);
  const type = clean(request.approval_type, 120);
  if (!customerId || !projectId || !type) return { ok: false, error: 'APPROVAL_REQUEST_INVALID' };
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const scopeMatches = (records || []).filter((record) =>
    record && record.customer_id === customerId && record.project_id === projectId && record.approval_type === type && record.granted === true
  ).filter((record) => !record.provider_id || !request.provider_id || record.provider_id === request.provider_id)
   .filter((record) => !record.capability || !request.capability || record.capability === request.capability)
   .filter((record) => !record.expires_at || new Date(record.expires_at).getTime() > nowMs);
  const bindingRequired = request.require_execution_binding === true || (request.binding && typeof request.binding === 'object');
  const matches = bindingRequired
    ? scopeMatches.filter((record) => record.binding && sameBinding(record.binding, request.binding))
    : scopeMatches;
  if (!matches.length) return {
    ok: true,
    approved: false,
    code: bindingRequired && scopeMatches.length ? 'SCOPED_APPROVAL_BINDING_MISMATCH' : 'SCOPED_APPROVAL_REQUIRED',
    approval_type: type
  };
  const selected = matches.sort((a, b) => String(b.expires_at || '').localeCompare(String(a.expires_at || '')))[0];
  return { ok: true, approved: true, approval: clone(selected) };
}

export function runtimeApprovalManifest() {
  return {
    version: 'riosystems.approval.v1',
    scope: 'customer_project',
    supports_expiry: true,
    supports_provider_binding: true,
    supports_capability_binding: true,
    supports_execution_contract_binding: true,
    binding_fields: ['mission','execution_contract_revision_hash','knowledge_revision','provider_route','cost_ceiling','environment','write_scope','production_scope','expiry','actor'],
    legacy_classification: 'ADAPT',
    legacy_approval_status: 'MIGRATED_TO_CANONICAL_SCOPED_APPROVAL',
    canonical_approval_truth: true,
    parallel_approval_system: false,
    production_deploy: false
  };
}
