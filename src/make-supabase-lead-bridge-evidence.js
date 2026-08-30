const EVIDENCE = Object.freeze({
  schema: 'riosystems.make-supabase-lead-bridge-evidence.v1',
  verified_at: '2026-08-30T01:54:15Z',
  scope: Object.freeze({
    customer_id: 'bakery-muller',
    project_id: 'digital-system-v1',
    project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
    scope_key: 'bakery-muller:digital-system-v1'
  }),
  make: Object.freeze({
    provider_id: 'make-core',
    zone: 'eu1.make.com',
    team_id: 939128,
    scenario_id: 7149691,
    execution_id: 'e3198aaaeed64e7b8380c6e067439ecf',
    github_actions_run_id: 33258730803,
    github_actions_job_id: 99191069568,
    checkout_commit: '9986bdf4bebbd808de4606f01d805ced58a59760',
    execution_completed: true,
    scenario_restored_inactive: true,
    secrets_returned: false,
    authorization_header_returned: false
  }),
  supabase: Object.freeze({
    provider_id: 'supabase-free',
    project_ref: 'pgzayxpqiakuvibhonwh',
    schema_name: 'public',
    lead_count: 1,
    bridge_event_count: 1,
    make_execution_ref_count: 1,
    bridge_audit_count: 1,
    persisted_make_execution_id: 'e3198aaaeed64e7b8380c6e067439ecf',
    persisted_project_scope: 'bakery-muller:digital-system-v1',
    persisted_synthetic: true,
    idempotent_lead_count: 1
  }),
  safety: Object.freeze({
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  })
});

export function makeSupabaseLeadBridgeEvidence() {
  return structuredClone(EVIDENCE);
}

export function isMakeSupabaseLeadBridgeVerified() {
  return EVIDENCE.make.execution_completed === true
    && EVIDENCE.make.scenario_restored_inactive === true
    && EVIDENCE.supabase.lead_count === 1
    && EVIDENCE.supabase.bridge_event_count === 1
    && EVIDENCE.supabase.make_execution_ref_count === 1
    && EVIDENCE.supabase.bridge_audit_count === 1
    && EVIDENCE.supabase.persisted_make_execution_id === EVIDENCE.make.execution_id
    && EVIDENCE.supabase.persisted_project_scope === EVIDENCE.scope.scope_key
    && EVIDENCE.supabase.persisted_synthetic === true
    && EVIDENCE.safety.variable_cost_eur === 0
    && EVIDENCE.safety.real_customer_data === false
    && EVIDENCE.safety.production_deploy === false;
}
