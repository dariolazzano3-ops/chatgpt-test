import {
  CONTROLLED_LAUNCH_PROFILES_V1,
  evaluateControlledLaunchReadiness
} from './launch-readiness-v1.js';

const yes = (value) => value === true;
const text = (value) => String(value ?? '').trim();

export function evaluateLaunchGateEvidence(input = {}) {
  const supabase = input.supabase || {};
  const cloudflare = input.cloudflare || {};

  const customerIdentityActive = yes(supabase.project_separation_verified)
    && yes(supabase.auth_service_reachable)
    && yes(supabase.hosted_auth_user_flow_verified)
    && yes(supabase.jwt_to_rls_membership_e2e_verified);

  const durableCustomerDataPlaneActive = yes(supabase.project_separation_verified)
    && Number(supabase.applied_migration_count || 0) >= 8
    && Number(supabase.security_advisor_findings || 0) === 0
    && yes(supabase.tenant_isolation_verified)
    && yes(supabase.conversation_owner_isolation_verified);

  const productionDeletionExecutorActive = text(supabase.delete_edge_function_status) === 'ACTIVE'
    && yes(supabase.delete_edge_function_verify_jwt)
    && yes(supabase.synthetic_hard_delete_verified);

  const liveTrustedRetrievalActive = yes(cloudflare.worker_settings_verified)
    && yes(cloudflare.official_retrieval_binding_live)
    && yes(cloudflare.official_source_fetch_verified);

  const distributedRateLimitActive = yes(cloudflare.worker_settings_verified)
    && yes(cloudflare.distributed_rate_binding_live);

  const productionObservabilityActive = yes(cloudflare.worker_settings_verified)
    && yes(cloudflare.observability_binding_live)
    && yes(cloudflare.alert_signal_path_verified);

  const readiness = evaluateControlledLaunchReadiness({
    profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
    red_team_passed: yes(input.red_team_passed),
    red_team_passed_cases: Number(input.red_team_passed_cases || 0),
    production_customer_identity_active: customerIdentityActive,
    durable_customer_data_plane_active: durableCustomerDataPlaneActive,
    real_customer_ai_processing_approved: yes(input.real_customer_ai_processing_approved),
    live_trusted_retrieval_active: liveTrustedRetrievalActive,
    distributed_rate_limit_active: distributedRateLimitActive,
    production_deletion_executor_active: productionDeletionExecutorActive,
    production_observability_active: productionObservabilityActive,
    legal_privacy_review_complete: yes(input.legal_privacy_review_complete),
    public_customer_surface_active: yes(input.public_customer_surface_active)
  });

  const technical = {
    production_customer_identity_active: customerIdentityActive,
    durable_customer_data_plane_active: durableCustomerDataPlaneActive,
    live_trusted_retrieval_active: liveTrustedRetrievalActive,
    distributed_rate_limit_active: distributedRateLimitActive,
    production_deletion_executor_active: productionDeletionExecutorActive,
    production_observability_active: productionObservabilityActive
  };

  const explicitHumanGates = [
    'real_customer_ai_processing',
    'legal_privacy_review',
    'public_customer_surface'
  ].filter((id) => readiness.operator_gate_ids.includes(id));

  return {
    ok: true,
    schema: 'aurentara.customer.launch-gate-evidence-audit.v1',
    technical,
    readiness,
    explicit_human_gate_ids: explicitHumanGates,
    remaining_operator_gate_ids: [...readiness.operator_gate_ids],
    preproduction_required_ids: [...readiness.preproduction_required_ids],
    customer_surface_active: yes(input.public_customer_surface_active),
    real_customer_ai_processing_approved: yes(input.real_customer_ai_processing_approved),
    legal_privacy_review_complete: yes(input.legal_privacy_review_complete),
    variable_cost_eur: 0,
    real_customer_data: false
  };
}

export function launchGateAuditManifest() {
  return {
    schema: 'aurentara.customer.launch-gate-evidence-audit-manifest.v1',
    evidence_over_defaults: true,
    configuration_is_not_live_evidence: true,
    hosted_auth_e2e_required_for_identity_pass: true,
    trusted_retrieval_requires_live_binding_and_live_official_fetch: true,
    observability_requires_live_binding_and_alert_signal_path: true,
    public_surface_default: false,
    real_customer_ai_default: false,
    variable_cost_eur: 0
  };
}
