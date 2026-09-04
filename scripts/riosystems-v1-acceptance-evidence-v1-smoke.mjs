#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildRiosystemsV1AcceptanceFromEvidence, riosystemsV1AcceptanceEvidenceManifest } from '../src/riosystems-v1-acceptance-evidence-v1.js';

const HEAD = '8209e599659b73fc4d63bfe2f54eaf483f974b33';
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
const access = {
  status: 'HEALTHY',
  access_application_configured: true,
  restrictive_policy_verified: true,
  source: 'github_actions_cloudflare_access_readonly'
};
const humanPass = {
  technical_implementation: true,
  technical_integration: true,
  final_dom_presence: true,
  human_visibility: true,
  human_reachability: true,
  primary_interaction: true,
  expected_result: true,
  desktop_acceptance: true,
  mobile_acceptance: true,
  mobile_required: true,
  composition_regression: true,
  safety_regression: true
};

const deployed = { status: 'HEALTHY', deployed_sha: HEAD, source: 'github_actions_zero_cost_staging_deploy' };

const preActivation = buildRiosystemsV1AcceptanceFromEvidence({ system_health: healthySystem, request_context: { server_side_operator_authorized: true } });
assert.equal(preActivation.definition_of_done.summary.total, 23);
assert.equal(preActivation.definition_of_done.summary.VERIFIED, 23);
assert.equal(preActivation.status, 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED');
assert.equal(preActivation.staging_activation.summary.VERIFIED, 3);
assert.equal(preActivation.staging_activation.items.find((item) => item.id === 'access_application_configured').status, 'NOT_VERIFIED');
assert.equal(preActivation.staging_activation.items.find((item) => item.id === 'latest_factory_control_deployed_to_staging').status, 'NOT_VERIFIED');

const accepted = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: access,
  deployment_evidence: deployed,
  human_outcome: humanPass
});
assert.equal(accepted.status, 'V1_ACCEPTED');
assert.equal(accepted.staging_activation.summary.VERIFIED, 5);
assert.equal(accepted.next_actions.length, 0);

const missingHuman = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: access,
  deployment_evidence: deployed
});
assert.equal(missingHuman.status, 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING');
assert.equal(missingHuman.human_outcome.human_outcome_accepted, false);


const blockedAccess = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: { status: 'BLOCKED', access_application_configured: false },
  deployment_evidence: deployed
});
assert.equal(blockedAccess.status, 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED');
assert.equal(blockedAccess.staging_activation.items.find((item) => item.id === 'access_application_configured').status, 'BLOCKED');

const pendingAccess = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: { status: 'DEGRADED' },
  deployment_evidence: deployed
});
assert.equal(pendingAccess.staging_activation.items.find((item) => item.id === 'access_application_configured').status, 'NOT_VERIFIED');

const staleDeploy = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: access,
  deployment_evidence: { status: 'STALE', deployed_sha: 'old-head' }
});
assert.equal(staleDeploy.status, 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED');
assert.equal(staleDeploy.staging_activation.items.find((item) => item.id === 'latest_factory_control_deployed_to_staging').status, 'BLOCKED');

const failedDeploy = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: access,
  deployment_evidence: { status: 'BLOCKED', deployed_sha: HEAD }
});
assert.equal(failedDeploy.staging_activation.items.find((item) => item.id === 'latest_factory_control_deployed_to_staging').status, 'BLOCKED');

const staleHealth = structuredClone(healthySystem);
staleHealth.signals.universal_mission_ci.status = 'STALE';
const stale = buildRiosystemsV1AcceptanceFromEvidence({ system_health: staleHealth, request_context: { server_side_operator_authorized: true }, access_evidence: access, deployment_evidence: deployed });
assert.equal(stale.status, 'INCOMPLETE');
assert.notEqual(stale.definition_of_done.items.find((item) => item.id === 'ci_green_exact_head').status, 'VERIFIED');

const wrongHeadHealth = structuredClone(healthySystem);
wrongHeadHealth.signals.dashboard_ci.head_sha = 'wrong-head';
const wrongHead = buildRiosystemsV1AcceptanceFromEvidence({ system_health: wrongHeadHealth, request_context: { server_side_operator_authorized: true } });
assert.equal(wrongHead.status, 'INCOMPLETE');
assert.equal(wrongHead.definition_of_done.items.find((item) => item.id === 'ci_green_exact_head').status, 'BLOCKED');

const unauthorized = buildRiosystemsV1AcceptanceFromEvidence({ system_health: healthySystem });
assert.equal(unauthorized.status, 'INCOMPLETE');
assert.equal(unauthorized.definition_of_done.items.find((item) => item.id === 'private_operator_access_server_side').status, 'BLOCKED');
assert.equal(unauthorized.staging_activation.items.find((item) => item.id === 'authenticated_staging_smoke_passed').status, 'BLOCKED');

const unsafe = buildRiosystemsV1AcceptanceFromEvidence({
  system_health: healthySystem,
  request_context: { server_side_operator_authorized: true },
  access_evidence: access,
  deployment_evidence: deployed,
  safety_overrides: { production_active: true }
});
assert.equal(unsafe.status, 'BLOCKED');
assert.equal(unsafe.safety.ok, false);

const manifest = riosystemsV1AcceptanceEvidenceManifest();
assert.equal(manifest.unknown_activation_is_not_verified, true);
assert.ok(manifest.activation_sources.includes('github_actions_cloudflare_access_readonly'));
assert.ok(manifest.activation_sources.includes('github_actions_zero_cost_staging_deploy'));
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'riosystems-v1-acceptance-evidence-v1',
  code_verified: preActivation.definition_of_done.summary.VERIFIED,
  activation_verified_without_access_or_deploy: preActivation.staging_activation.summary.VERIFIED,
  pre_activation_status: preActivation.status,
  fully_accepted_status: accepted.status,
  missing_human_status: missingHuman.status,
  blocked_access_gate: blockedAccess.staging_activation.items.find((item) => item.id === 'access_application_configured').status,
  pending_access_gate: pendingAccess.staging_activation.items.find((item) => item.id === 'access_application_configured').status,
  stale_deploy_gate: staleDeploy.staging_activation.items.find((item) => item.id === 'latest_factory_control_deployed_to_staging').status,
  failed_deploy_gate: failedDeploy.staging_activation.items.find((item) => item.id === 'latest_factory_control_deployed_to_staging').status,
  stale_status: stale.status,
  wrong_head_status: wrongHead.status,
  unsafe_status: unsafe.status,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
