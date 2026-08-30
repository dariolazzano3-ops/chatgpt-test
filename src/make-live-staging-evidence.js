const EVIDENCE = Object.freeze({
  schema: 'riosystems.make-live-staging-evidence.v1',
  provider_id: 'make-core',
  environment: 'staging',
  verified_at: '2026-08-30T01:54:15Z',
  verification: Object.freeze({
    read_only_preflight: true,
    scenario_create: true,
    scenario_run_once: true,
    scenario_restored_inactive: true
  }),
  account_binding: Object.freeze({
    zone: 'eu1.make.com',
    team_id: 939128,
    token_ref: 'secret:MAKE_API_TOKEN',
    secret_value_embedded: false
  }),
  scenario: Object.freeze({
    scenario_id: 7149691,
    staging_only: true,
    synthetic_test_data_only: true,
    external_connections: false,
    production_deploy: false
  }),
  execution: Object.freeze({
    github_actions_run_id: 33258730803,
    github_actions_job_id: 99191069568,
    execution_id: 'e3198aaaeed64e7b8380c6e067439ecf',
    completed: true,
    scenario_restored_inactive: true,
    secrets_returned: false,
    authorization_header_returned: false
  }),
  authorization_posture: Object.freeze({
    required_scopes: Object.freeze(['organization:read','scenarios:read','scenarios:write','scenarios:run']),
    production_authorized: false,
    automatic_paid_overflow: false,
    external_writes_still_require_explicit_approval: true,
    supervised_execution_still_required: true
  })
});

export function makeLiveStagingActivationEvidence() {
  return structuredClone(EVIDENCE);
}

export function isMakeLiveStagingVerified() {
  return EVIDENCE.verification.read_only_preflight === true
    && EVIDENCE.verification.scenario_create === true
    && EVIDENCE.verification.scenario_run_once === true
    && EVIDENCE.verification.scenario_restored_inactive === true
    && EVIDENCE.scenario.production_deploy === false
    && EVIDENCE.execution.secrets_returned === false;
}
