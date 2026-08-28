const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function evaluateProductionReadiness(input = {}) {
  const required = {
    source_revision_bound: input.source_revision_bound === true,
    phase5_ready: input.phase5_ready === true,
    ci_green: input.ci_green === true,
    secrets_externalized: input.secrets_externalized === true,
    credential_rotation_defined: input.credential_rotation_defined === true,
    least_privilege_reviewed: input.least_privilege_reviewed === true,
    backup_defined: input.backup_defined === true,
    restore_tested: input.restore_tested === true,
    observability_defined: input.observability_defined === true,
    incident_runbook_defined: input.incident_runbook_defined === true,
    rollback_defined: input.rollback_defined === true,
    provider_cost_limits_defined: input.provider_cost_limits_defined === true,
    customer_isolation_verified: input.customer_isolation_verified === true,
    external_write_approvals_defined: input.external_write_approvals_defined === true
  };
  const blockers = Object.entries(required).filter(([, ok]) => !ok).map(([key]) => key);
  return {
    schema_version: 'riosystems.production-readiness.v1',
    ready_for_production_activation: blockers.length === 0 && input.operator_production_approval === true,
    operator_production_approval: input.operator_production_approval === true,
    checks: required,
    blockers,
    environment: clean(input.environment, 80) || 'production',
    production_deploy: false
  };
}

export function authorizeProductionActivation(readiness = {}, request = {}) {
  if (readiness.ready_for_production_activation !== true) return { ok: false, error: 'PRODUCTION_READINESS_BLOCKED', blockers: readiness.blockers || [] };
  if (request.explicit_go !== true) return { ok: false, error: 'PRODUCTION_EXPLICIT_GO_REQUIRED' };
  if (!clean(request.actor, 160)) return { ok: false, error: 'PRODUCTION_ACTOR_REQUIRED' };
  return {
    ok: true,
    authorization: {
      schema_version: 'riosystems.production-authorization.v1',
      actor: clean(request.actor, 160),
      revision: clean(request.revision, 80) || null,
      environment: clean(request.environment, 80) || 'production',
      expires_at: request.expires_at || null,
      activation_authorized: true,
      automatic_deploy: false
    }
  };
}

export function productionReadinessManifest() {
  return {
    version: 'riosystems.production-readiness.v1',
    fail_closed: true,
    explicit_operator_go_required: true,
    automatic_production_deploy: false
  };
}
