#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildRiosystemsV1AcceptanceFromEvidence, riosystemsV1AcceptanceEvidenceManifest } from '../src/riosystems-v1-acceptance-evidence-v1.js';

const HEAD = '1812e107ab15fdf3e0361dab1968faf06cc196a9';
const gate = (step) => ({ status: 'HEALTHY', head_sha: HEAD, step, conclusion: 'success' });
const healthySystem = {
  status: 'HEALTHY',
  branch_truth: { status: 'HEALTHY', head_sha: HEAD },
  signals: {
    core_ci: gate('Validate JavaScript'),
    integrated_regression_gate: gate('Integrated RIOSYSTEMS regression gate'),
    dashboard_ci: gate('Private Operator Dashboard V1 acceptance'),
    universal_mission_ci: gate('Universal Mission V1 acceptance'),
    factory_readiness: { status: 'HEALTHY' },
    provider_evidence_freshness: { status: 'HEALTHY' },
    runtime_persistence: { status: 'HEALTHY', store_mode: 'supabase', runtime_revision: 2 },
    staging_availability: { status: 'HEALTHY' }
  }
};

const preActivation = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true }
});
assert.equal(preActivation.definition_of_done.summary.total, 23);
assert.equal(preActivation.definition_of_done.summary.VERIFIED, 23);
assert.equal(preActivation.status, 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED');
assert.equal(preActivation.staging_activation.summary.VERIFIED, 3);
assert.equal(preActivation.staging_activation.items.find((item) => item.id === 'access_application_configured').status, 'NOT_VERIFIED');
assert.equal(preActivation.staging_activation.items.find((item) => item.id === 'latest_factory_control_deployed_to_staging').status, 'NOT_VERIFIED');

const accepted = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  activation_evidence: {
    access_application_configured: true,
    access_application_evidence: { source: 'cloudflare_access_api', application: 'riosystems-staging-operator' }
  },
  deployment_evidence: { deployed_sha: HEAD }
});
assert.equal(accepted.status, 'V1_ACCEPTED');
assert.equal(accepted.staging_activation.summary.VERIFIED, 5);
assert.equal(accepted.next_actions.length, 0);

const staleHealth = structuredClone(healthySystem);
staleHealth.signals.universal_mission_ci.status = 'STALE';
const stale = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: staleHealth,
  request_context: { server_side_operator_authorized: true },
  activation_evidence: { access_application_configured: true },
  deployment_evidence: { deployed_sha: HEAD }
});
assert.equal(stale.status, 'INCOMPLETE');
assert.notEqual(stale.definition_of_done.items.find((item) => item.id === 'ci_green_exact_head').status, 'VERIFIED');

const wrongHeadHealth = structuredClone(healthySystem);
wrongHeadHealth.signals.dashboard_ci.head_sha = 'wrong-head';
const wrongHead = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: wrongHeadHealth,
  request_context: { server_side_operator_authorized: true }
});
assert.equal(wrongHead.status, 'INCOMPLETE');
assert.equal(wrongHead.definition_of_done.items.find((item) => item.id === 'ci_green_exact_head').status, 'BLOCKED');

const unauthorized = buildRiosystemsV1AcceptanceFromEvidence({ system_health: healthySystem });
assert.equal(unauthorized.status, 'INCOMPLETE');
assert.equal(unauthorized.definition_of_done.items.find((item) => item.id === 'private_operator_access_server_side').status, 'BLOCKED');
assert.equal(unauthorized.staging_activation.items.find((item) => item.id === 'authenticated_staging_smoke_passed').status, 'BLOCKED');

const unsafe = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  activation_evidence: { access_application_configured: true },
  deployment_evidence: { deployed_sha: HEAD },
  safety_overrides: { production_active: true }
});
assert.equal(unsafe.status, 'BLOCKED');
assert.equal(unsafe.safety.ok, false);

const manifest = riosystemsV1AcceptanceEvidenceManifest();
assert.equal(manifest.unknown_activation_is_not_verified, true);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'riosystems-v1-acceptance-evidence-v1',
  code_verified: preActivation.definition_of_done.summary.VERIFIED,
  activation_verified_without_explicit_access_or_deploy: preActivation.staging_activation.summary.VERIFIED,
  pre_activation_status: preActivation.status,
  fully_accepted_status: accepted.status,
  stale_status: stale.status,
  wrong_head_status: wrongHead.status,
  unsafe_status: unsafe.status,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
