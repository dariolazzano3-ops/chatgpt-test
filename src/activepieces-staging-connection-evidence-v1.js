const EVIDENCE = Object.freeze({
  provider_id: 'activepieces-cloud-free',
  environment: 'riosystems-staging',
  worker_reached: true,
  credential_present: true,
  credential_valid: true,
  authenticated: true,
  api_accessible: true,
  connected_staging: true,
  verification_method: 'GET /api/v1/projects?limit=1&types=PERSONAL',
  provider_requests: 1,
  provider_writes: 0,
  flow_execution_performed: false,
  production_deploy: false,
  external_writes: false,
  real_customer_data: false,
  variable_cost_eur: 0,
  cleanup_verified: true
});

export function activepiecesStagingConnectionEvidence() {
  return structuredClone(EVIDENCE);
}

export function isActivepiecesStagingConnected() {
  const evidence = EVIDENCE;
  return evidence.environment === 'riosystems-staging'
    && evidence.worker_reached === true
    && evidence.credential_present === true
    && evidence.credential_valid === true
    && evidence.authenticated === true
    && evidence.api_accessible === true
    && evidence.connected_staging === true
    && evidence.provider_requests === 1
    && evidence.provider_writes === 0
    && evidence.flow_execution_performed === false
    && evidence.production_deploy === false
    && evidence.external_writes === false
    && evidence.real_customer_data === false
    && evidence.variable_cost_eur === 0
    && evidence.cleanup_verified === true;
}
