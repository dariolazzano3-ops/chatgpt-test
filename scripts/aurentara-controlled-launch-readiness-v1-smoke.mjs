import assert from 'node:assert/strict';
import {
  CONTROLLED_LAUNCH_PROFILES_V1,
  controlledLaunchReadinessManifest,
  evaluateControlledLaunchReadiness
} from '../src/customer-product/launch-readiness-v1.js';

const manifest = controlledLaunchReadinessManifest();
assert.equal(manifest.production_activation_performed, false);
assert.equal(manifest.operator_control_plane_shared, false);
assert.equal(manifest.safety_over_launch_speed, true);

const redTeamEvidence = { red_team_passed: true, red_team_passed_cases: 22 };
const initial = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  ...redTeamEvidence
});
assert.equal(initial.ok, false);
assert.equal(initial.next_state, 'CONTINUE_PREPRODUCTION_BUILD');
for (const id of [
  'identity_adapter_contract', 'durable_store_contract', 'trusted_retrieval_adapter_contract',
  'distributed_rate_adapter_contract', 'deletion_executor_contract', 'observability_contract'
]) assert.ok(initial.preproduction_required_ids.includes(id));
assert.ok(initial.operator_gate_ids.includes('production_customer_identity'));
assert.ok(initial.operator_gate_ids.includes('public_customer_surface'));
assert.ok(!initial.operator_gate_ids.includes('payment_provider'));
assert.equal(initial.production_activation_performed, false);

const contractsReady = {
  ...redTeamEvidence,
  identity_adapter_contract_ready: true,
  durable_store_contract_ready: true,
  trusted_retrieval_adapter_contract_ready: true,
  distributed_rate_adapter_contract_ready: true,
  deletion_executor_contract_ready: true,
  observability_contract_ready: true
};
const afterPreprod = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  ...contractsReady
});
assert.equal(afterPreprod.ok, false);
assert.equal(afterPreprod.preproduction_required_ids.length, 0);
assert.equal(afterPreprod.next_state, 'OPERATOR_ACTIVATION_REQUIRED');
assert.ok(afterPreprod.operator_gate_ids.includes('production_customer_identity'));
assert.ok(afterPreprod.operator_gate_ids.includes('durable_customer_data_plane'));
assert.ok(afterPreprod.operator_gate_ids.includes('real_customer_ai_processing'));
assert.ok(afterPreprod.operator_gate_ids.includes('live_trusted_retrieval'));
assert.ok(afterPreprod.operator_gate_ids.includes('distributed_rate_limit'));
assert.ok(afterPreprod.operator_gate_ids.includes('production_deletion_executor'));
assert.ok(afterPreprod.operator_gate_ids.includes('production_observability'));
assert.ok(afterPreprod.operator_gate_ids.includes('legal_privacy_review'));
assert.ok(afterPreprod.operator_gate_ids.includes('public_customer_surface'));

const freeReady = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  ...contractsReady,
  production_customer_identity_active: true,
  durable_customer_data_plane_active: true,
  real_customer_ai_processing_approved: true,
  live_trusted_retrieval_active: true,
  distributed_rate_limit_active: true,
  production_deletion_executor_active: true,
  production_observability_active: true,
  legal_privacy_review_complete: true,
  public_customer_surface_active: true
});
assert.equal(freeReady.ok, true);
assert.equal(freeReady.next_state, 'CONTROLLED_LAUNCH_READY');
assert.equal(freeReady.readiness_percent, 100);

const paidPreprod = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.PAID_FOUNDER_LAUNCH,
  ...contractsReady
});
assert.ok(paidPreprod.preproduction_required_ids.includes('payment_adapter_contract'));
assert.ok(paidPreprod.operator_gate_ids.includes('payment_provider'));
assert.equal(paidPreprod.next_state, 'CONTINUE_PREPRODUCTION_BUILD');

const paidActivationGate = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.PAID_FOUNDER_LAUNCH,
  ...contractsReady,
  payment_adapter_contract_ready: true
});
assert.equal(paidActivationGate.preproduction_required_ids.length, 0);
assert.ok(paidActivationGate.operator_gate_ids.includes('payment_provider'));
assert.equal(paidActivationGate.next_state, 'OPERATOR_ACTIVATION_REQUIRED');

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI CONTROLLED PUBLIC LAUNCH READINESS V1',
  status: 'PASS',
  current_free_pilot_next_state: initial.next_state,
  buildable_preproduction_contracts: initial.preproduction_required_ids,
  post_contract_next_state: afterPreprod.next_state,
  operator_gates_after_preproduction: afterPreprod.operator_gate_ids,
  paid_founder_requires_payment_contract: true,
  paid_founder_requires_payment_activation: true,
  production_changes: false,
  paid_api_calls: 0,
  variable_cost_eur: 0
}, null, 2));
