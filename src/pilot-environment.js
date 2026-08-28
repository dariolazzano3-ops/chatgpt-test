const clean = (value, max = 180) => String(value || '').trim().slice(0, max);

export function createPilotEnvironment(input = {}) {
  const customerId = clean(input.customer_id, 120);
  const projectId = clean(input.project_id, 120);
  const revision = clean(input.source_revision, 80);
  if (!customerId || !projectId || !revision) return { ok: false, error: 'PILOT_SCOPE_AND_REVISION_REQUIRED' };
  return {
    ok: true,
    environment: {
      schema_version: 'riosystems.pilot-environment.v1',
      environment: 'staging-local',
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      source_revision: revision,
      network_external_writes: false,
      paid_providers_allowed: false,
      secret_values_required: false,
      public_access: false,
      production_deploy: false
    }
  };
}

export function evaluatePilotEnvironment(environment = {}) {
  const blockers = [];
  if (environment.environment !== 'staging-local') blockers.push('PILOT_ENVIRONMENT_INVALID');
  if (!environment.source_revision) blockers.push('SOURCE_REVISION_REQUIRED');
  if (environment.network_external_writes !== false) blockers.push('EXTERNAL_WRITES_MUST_BE_DISABLED');
  if (environment.paid_providers_allowed !== false) blockers.push('PAID_PROVIDERS_MUST_BE_DISABLED');
  if (environment.public_access !== false) blockers.push('PUBLIC_ACCESS_MUST_BE_DISABLED');
  if (environment.production_deploy !== false) blockers.push('PRODUCTION_MUST_BE_DISABLED');
  return { ok: blockers.length === 0, ready: blockers.length === 0, blockers, production_deploy: false };
}
