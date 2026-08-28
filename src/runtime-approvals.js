const clean = (value, max = 200) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

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
  const matches = (records || []).filter((record) =>
    record && record.customer_id === customerId && record.project_id === projectId && record.approval_type === type && record.granted === true
  ).filter((record) => !record.provider_id || !request.provider_id || record.provider_id === request.provider_id)
   .filter((record) => !record.capability || !request.capability || record.capability === request.capability)
   .filter((record) => !record.expires_at || new Date(record.expires_at).getTime() > nowMs);
  if (!matches.length) return { ok: true, approved: false, code: 'SCOPED_APPROVAL_REQUIRED', approval_type: type };
  const selected = matches.sort((a, b) => String(b.expires_at || '').localeCompare(String(a.expires_at || '')))[0];
  return { ok: true, approved: true, approval: clone(selected) };
}

export function runtimeApprovalManifest() {
  return { version: 'riosystems.approval.v1', scope: 'customer_project', supports_expiry: true, supports_provider_binding: true, supports_capability_binding: true, production_deploy: false };
}
