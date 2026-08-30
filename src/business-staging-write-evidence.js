const EVIDENCE = Object.freeze({
  schema: 'riosystems.business-staging-write-evidence.v1',
  verified_at: '2026-08-30',
  provider: 'supabase-free',
  project_ref: 'pgzayxpqiakuvibhonwh',
  region: 'eu-west-1',
  migrations: Object.freeze([
    Object.freeze({ version: '20260830013445', name: 'riosystems_staging_crm_foundation' }),
    Object.freeze({ version: '20260830013612', name: 'riosystems_staging_crm_fk_indexes' })
  ]),
  foundation: Object.freeze({
    schema_name: 'public',
    tables: Object.freeze([
      'customer_projects',
      'contacts',
      'leads',
      'lead_events',
      'provider_execution_refs',
      'audit_log'
    ]),
    stable_uuid_ids: true,
    project_scoped_foreign_keys: true,
    timestamps: true,
    source_and_provider_refs: true,
    audit_metadata: true
  }),
  verification: Object.freeze({
    synthetic_projects_written: 2,
    synthetic_lead_written: true,
    repeated_identical_lead_write_count: 1,
    lead_event_count: 1,
    provider_execution_ref_count: 1,
    audit_entry_count: 1,
    project_a_visible_leads: 1,
    project_b_visible_foreign_leads: 0,
    rls_enabled: true,
    rls_forced: true,
    anon_project_select: false,
    anon_lead_select: false,
    anon_lead_insert: false,
    security_advisor_lints: 0
  }),
  idempotency: Object.freeze({
    key_scope: 'project_id_plus_idempotency_key',
    duplicate_created_on_repeat: false
  }),
  safety: Object.freeze({
    synthetic_data_only: true,
    real_customer_data: false,
    secrets_embedded: false,
    public_anonymous_write: false,
    production_data_changed: false,
    production_deploy: false,
    paid_upgrade: false,
    variable_cost_eur: 0
  })
});

export function businessStagingWriteEvidence() {
  return structuredClone(EVIDENCE);
}

export function isBusinessStagingWriteVerified() {
  return EVIDENCE.verification.synthetic_lead_written === true
    && EVIDENCE.verification.repeated_identical_lead_write_count === 1
    && EVIDENCE.verification.audit_entry_count === 1
    && EVIDENCE.verification.project_a_visible_leads === 1
    && EVIDENCE.verification.project_b_visible_foreign_leads === 0
    && EVIDENCE.verification.rls_enabled === true
    && EVIDENCE.verification.rls_forced === true
    && EVIDENCE.verification.anon_lead_insert === false
    && EVIDENCE.safety.synthetic_data_only === true
    && EVIDENCE.safety.real_customer_data === false
    && EVIDENCE.safety.variable_cost_eur === 0
    && EVIDENCE.safety.production_deploy === false;
}
