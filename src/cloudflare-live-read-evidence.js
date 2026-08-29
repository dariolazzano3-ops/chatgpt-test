const EVIDENCE = Object.freeze({
  schema: 'riosystems.cloudflare-live-read-evidence.v1',
  provider_id: 'cloudflare',
  environment: 'staging',
  verified_at: '2026-08-29T15:04:32Z',
  github_actions_run_id: 33259245919,
  token: Object.freeze({
    status: 'active',
    verification_mode: 'account_token_endpoint',
    token_ref: 'secret:CLOUDFLARE_API_TOKEN',
    account_ref: 'secret:CLOUDFLARE_ACCOUNT_ID',
    secret_values_embedded: false
  }),
  capabilities: Object.freeze({
    workers_scripts_read: 'verified',
    pages_projects_read: 'verified',
    d1_read: 'credential_or_scope_blocked',
    workers_ai_read: 'permission_missing'
  }),
  resource_presence: Object.freeze({
    worker_scripts_present: true,
    pages_projects_present: true,
    d1_databases_present: null,
    workers_ai_models_visible: null
  }),
  safety: Object.freeze({
    resource_names_returned: false,
    account_id_returned: false,
    secrets_returned: false,
    authorization_header_returned: false,
    external_side_effect_performed: false,
    deployment_performed: false,
    production_deploy: false,
    automatic_paid_overflow: false
  })
});

export function cloudflareLiveReadEvidence() {
  return structuredClone(EVIDENCE);
}

export function isCloudflareWebReadVerified() {
  return EVIDENCE.token.status === 'active'
    && EVIDENCE.capabilities.workers_scripts_read === 'verified'
    && EVIDENCE.capabilities.pages_projects_read === 'verified'
    && EVIDENCE.safety.external_side_effect_performed === false
    && EVIDENCE.safety.production_deploy === false;
}

export function isCloudflareAiReadVerified() {
  return EVIDENCE.capabilities.workers_ai_read === 'verified';
}
