import { customerPrelaunchSecurityPrivacyManifest } from './prelaunch-security-privacy-v1.js';
import { productionPrivacySurfaceManifest } from './production-privacy-surface-v1.js';

export const HAMYREN_PRODUCT_IDENTITY_V1 = Object.freeze({
  product_name: 'HAMYREN',
  descriptor: 'Your Personal Business AI',
  byline: 'by AURENTARA SYSTEMS'
});

export const HAMYREN_CUSTOMER_DELETE_CONFIRMATION_V1 = 'DELETE_MY_HAMYREN_DATA';

export const HAMYREN_LEGAL_REVIEW_ITEMS_V1 = Object.freeze([
  'privacy_notice_final_text',
  'terms_final_text',
  'controller_identity_and_contact',
  'legal_bases_and_purposes',
  'retention_schedule_legal_signoff',
  'subprocessors_and_data_transfers',
  'dpa_scc_tia_where_applicable',
  'target_customer_and_business_scope',
  'age_and_minor_policy',
  'ai_regulatory_classification_and_transparency',
  'high_risk_disclaimer_and_professional_escalation'
].map((id) => Object.freeze({ id, status: 'REQUIRES_HUMAN_REVIEW' })));

const yes = (value) => value === true;

export function hamyrenTrustSurfaceCopyV1() {
  return {
    schema: 'hamyren.customer.trust-surface-copy.v1',
    identity: { ...HAMYREN_PRODUCT_IDENTITY_V1 },
    ai_disclosure: 'HAMYREN is an AI system that helps you understand, organize and develop your business. Its output can be incomplete or incorrect and should be reviewed before important decisions.',
    memory_controls: 'You can review, correct, export and delete your stored business information and withdraw supported consent choices.',
    high_risk_guidance: 'Tax, legal, employment, regulatory and similarly high-impact questions require current authoritative sources and, where appropriate, qualified professional verification.',
    data_plane_separation: 'Customer business data is kept in the dedicated customer data plane and is not implicitly exposed to the private AURENTARA control environment.',
    telemetry: 'Technical telemetry is designed to exclude customer business content.',
    legal_status: 'This technical readiness package does not constitute legal approval or legal advice.'
  };
}

export function evaluateHamyrenLegalPrivacyTechnicalReadiness(input = {}) {
  const live = input.live_state || {};
  const prelaunch = customerPrelaunchSecurityPrivacyManifest();
  const privacy = productionPrivacySurfaceManifest();
  const migrations = new Set(Array.isArray(live.applied_migrations) ? live.applied_migrations : []);
  const purposes = new Set(Array.isArray(privacy.consent_purposes) ? privacy.consent_purposes : []);
  const requiredMigrations = [
    'aurentara_customer_production_deletion_v1',
    'aurentara_customer_deletion_receipt_policy_v1',
    'aurentara_customer_consent_v1',
    'aurentara_customer_privacy_export_v1'
  ];
  const requiredPurposes = [
    'persistent_business_memory',
    'trusted_research',
    'product_analytics',
    'service_handoff'
  ];

  const checks = {
    synthetic_only: yes(live.synthetic_only),
    real_customer_data_absent: live.real_customer_data === false,
    zero_variable_cost: Number(live.variable_cost_eur || 0) === 0,
    customer_operator_project_separation: yes(live.project_separation_verified),
    tenant_isolation: yes(live.tenant_isolation_verified),
    conversation_owner_isolation: yes(live.conversation_owner_isolation_verified),
    security_advisor_clear: Number(live.security_advisor_findings || 0) === 0,
    deletion_executor_active: live.delete_edge_function?.status === 'ACTIVE',
    deletion_executor_jwt: yes(live.delete_edge_function?.verify_jwt),
    synthetic_hard_delete_verified: yes(live.delete_edge_function?.synthetic_hard_delete_verified),
    privacy_migrations_present: requiredMigrations.every((id) => migrations.has(id)),
    production_privacy_export_bound: privacy.privacy_export_rpc === 'aurentara_customer_ai.export_my_workspace',
    consent_append_only: yes(privacy.consent_append_only),
    consent_purposes_complete: requiredPurposes.every((id) => purposes.has(id)),
    service_role_absent_from_worker: privacy.service_role_in_worker === false,
    customer_jwt_rls: yes(privacy.user_jwt_and_rls),
    hamyren_delete_phrase_visible: privacy.customer_delete_confirmation_phrase === HAMYREN_CUSTOMER_DELETE_CONFIRMATION_V1,
    sql_security_contract_ready: yes(prelaunch.sql_security_contract_verifier_ready),
    consent_ledger_contract_ready: yes(prelaunch.consent_ledger_contract_ready),
    export_contract_ready: yes(prelaunch.business_export_contract_ready),
    deletion_plan_contract_ready: yes(prelaunch.deletion_plan_contract_ready),
    launch_shield_ready: yes(prelaunch.launch_shield_contract_ready),
    public_mode_default_off: prelaunch.public_mode_default === false,
    controlled_prelaunch_synthetic_only: yes(prelaunch.controlled_prelaunch_synthetic_only),
    public_activation_operator_gated: yes(prelaunch.public_activation_requires_operator_gate),
    live_worker_closed: yes(live.dedicated_customer_worker?.customer_surface_off_live),
    customer_surface_inactive: live.customer_surface_active === false && live.public_customer_surface_active === false,
    real_customer_ai_inactive: live.real_customer_ai_processing_approved === false,
    legal_gate_unclaimed: live.legal_privacy_review_complete === false,
    zero_cost_technical_backlog_empty: Array.isArray(live.zero_cost_technical_remaining) && live.zero_cost_technical_remaining.length === 0
  };

  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([id]) => id);
  return {
    ok: failures.length === 0,
    schema: 'hamyren.customer.legal-privacy-technical-readiness.v1',
    product: { ...HAMYREN_PRODUCT_IDENTITY_V1 },
    technical_readiness: failures.length === 0,
    checks,
    failures,
    human_review_items: HAMYREN_LEGAL_REVIEW_ITEMS_V1.map((item) => ({ ...item })),
    legal_acceptance_required: true,
    legal_privacy_review_complete: false,
    public_customer_surface_active: false,
    real_customer_ai_processing_approved: false,
    real_customer_data: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  };
}
