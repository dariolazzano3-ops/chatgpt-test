const EVIDENCE = Object.freeze({
  schema: 'aurentara.openai-staging-connection-evidence.v1',
  provider_id: 'openai-api',
  environment: 'riosystems-staging',
  source: Object.freeze({
    verification: 'protected_staging_runtime_diagnostic',
    diagnostic_schema: 'aurentara.openai-connection-check.v1',
    verification_method: 'GET /v1/models',
    merge_pr: 335,
    merge_commit: 'ac5c370a66fd8796955cb1a920a46442da1212e5'
  }),
  connection: Object.freeze({
    credential_present: true,
    credential_valid: true,
    connected_staging: true,
    http_status: 200,
    authenticated: true,
    external_request_performed: true
  }),
  execution: Object.freeze({
    inference_performed: false,
    prompt_submitted: false,
    token_generation_requested: false,
    paid_execution_approved: false,
    routing_ready: false
  }),
  cost_guard: Object.freeze({
    variable_cost_eur: 0,
    automatic_paid_overflow: false
  }),
  safety: Object.freeze({
    secret_value_exposed: false,
    secrets_embedded: false,
    real_customer_data: false,
    production_deploy: false,
    production_eligible: false
  })
});

export function openAiStagingConnectionEvidence() {
  return structuredClone(EVIDENCE);
}

export function isOpenAiStagingConnected() {
  return EVIDENCE.provider_id === 'openai-api'
    && EVIDENCE.environment === 'riosystems-staging'
    && EVIDENCE.connection.credential_present === true
    && EVIDENCE.connection.credential_valid === true
    && EVIDENCE.connection.connected_staging === true
    && EVIDENCE.connection.http_status === 200
    && EVIDENCE.connection.authenticated === true
    && EVIDENCE.source.verification_method === 'GET /v1/models'
    && EVIDENCE.execution.inference_performed === false
    && EVIDENCE.execution.prompt_submitted === false
    && EVIDENCE.execution.token_generation_requested === false
    && EVIDENCE.execution.paid_execution_approved === false
    && EVIDENCE.execution.routing_ready === false
    && EVIDENCE.cost_guard.variable_cost_eur === 0
    && EVIDENCE.cost_guard.automatic_paid_overflow === false
    && EVIDENCE.safety.secret_value_exposed === false
    && EVIDENCE.safety.secrets_embedded === false
    && EVIDENCE.safety.real_customer_data === false
    && EVIDENCE.safety.production_deploy === false
    && EVIDENCE.safety.production_eligible === false;
}
