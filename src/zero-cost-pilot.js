const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function createZeroCostPilot(input = {}) {
  const customerId = clean(input.customer_id, 160);
  const projectId = clean(input.project_id, 160);
  if (!customerId || !projectId) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED' };
  return {
    ok: true,
    pilot: {
      schema_version: 'riosystems.zero-cost-pilot.v1',
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      mode: 'ZERO_COST_DRY_RUN',
      monthly_paid_budget: 0,
      paid_providers_allowed: false,
      external_writes_allowed: false,
      production_deploy: false,
      public_access: false
    }
  };
}

export function evaluatePilotAction(pilot = {}, action = {}) {
  const blockers = [];
  if (pilot.mode !== 'ZERO_COST_DRY_RUN') blockers.push('ZERO_COST_MODE_REQUIRED');
  if (action.paid === true || Number(action.estimated_cost || 0) > 0) blockers.push('PAID_ACTION_REQUIRES_USER_APPROVAL');
  if (action.external_write === true) blockers.push('EXTERNAL_WRITE_DISABLED');
  if (action.production === true) blockers.push('PRODUCTION_DISABLED');
  if (action.public_access === true) blockers.push('PUBLIC_ACCESS_DISABLED');
  return { ok: blockers.length === 0, blockers, user_action_required: blockers.includes('PAID_ACTION_REQUIRES_USER_APPROVAL'), production_deploy: false };
}

export function zeroCostPilotManifest() {
  return { version:'riosystems.zero-cost-pilot.v1', paid_budget:0, fail_closed:true, external_writes:false, production:false };
}
