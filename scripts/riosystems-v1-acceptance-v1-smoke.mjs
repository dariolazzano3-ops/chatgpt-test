#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildRiosystemsV1Acceptance, riosystemsV1AcceptanceManifest } from '../src/riosystems-v1-acceptance-v1.js';

const manifest = riosystemsV1AcceptanceManifest();
const allDod = Object.fromEntries(manifest.definition_of_done_ids.map((id) => [id, true]));
const allActivation = Object.fromEntries(manifest.staging_activation_ids.map((id) => [id, true]));
const safe = {
  production_active: false,
  real_customer_data_active: false,
  automatic_paid_overflow: false,
  unapproved_external_writes: false
};

const accepted = buildRiosystemsV1Acceptance({
  definition_of_done: allDod,
  staging_activation: allActivation,
  safety: safe
});
assert.equal(accepted.status, 'V1_ACCEPTED');
assert.equal(accepted.definition_of_done.summary.total, 23);
assert.equal(accepted.definition_of_done.summary.VERIFIED, 23);
assert.equal(accepted.staging_activation.summary.total, 5);
assert.equal(accepted.staging_activation.summary.VERIFIED, 5);
assert.equal(accepted.next_actions.length, 0);
assert.equal(accepted.production_deploy, false);

const awaitingActivation = buildRiosystemsV1Acceptance({
  definition_of_done: allDod,
  staging_activation: {
    durable_runtime_schema_applied: true,
    durable_runtime_secrets_configured: false,
    access_application_configured: false,
    latest_factory_control_deployed_to_staging: false,
    authenticated_staging_smoke_passed: false
  },
  safety: safe
});
assert.equal(awaitingActivation.status, 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED');
assert.equal(awaitingActivation.staging_activation.summary.VERIFIED, 1);
assert.equal(awaitingActivation.next_actions.length, 4);
assert.ok(awaitingActivation.next_actions.every((item) => item.type === 'STAGING_ACTIVATION'));

const incomplete = buildRiosystemsV1Acceptance({
  definition_of_done: { ...allDod, audit_timeline: false },
  staging_activation: allActivation,
  safety: safe
});
assert.equal(incomplete.status, 'INCOMPLETE');
assert.equal(incomplete.next_actions[0].id, 'audit_timeline');

const unknown = buildRiosystemsV1Acceptance({
  definition_of_done: { ...allDod, ci_green_exact_head: undefined },
  staging_activation: allActivation,
  safety: safe
});
assert.equal(unknown.status, 'INCOMPLETE');
assert.equal(unknown.definition_of_done.items.find((item) => item.id === 'ci_green_exact_head').status, 'NOT_VERIFIED');

const unsafe = buildRiosystemsV1Acceptance({
  definition_of_done: allDod,
  staging_activation: allActivation,
  safety: { ...safe, production_active: true }
});
assert.equal(unsafe.status, 'BLOCKED');
assert.equal(unsafe.safety.ok, false);
assert.equal(unsafe.next_actions[0].type, 'SAFETY_BLOCKER');

console.log(JSON.stringify({
  ok: true,
  suite: 'riosystems-v1-acceptance-v1',
  definition_of_done_checks: manifest.definition_of_done_ids.length,
  staging_activation_checks: manifest.staging_activation_ids.length,
  accepted_status: accepted.status,
  pre_activation_status: awaitingActivation.status,
  unsafe_status: unsafe.status,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
