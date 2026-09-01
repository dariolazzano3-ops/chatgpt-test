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
const contractsMissing = {
  identity_adapter_contract_ready: false,
  durable_store_contract_ready: false,
  trusted_retrieval_adapter_contract_ready: false,
  distributed_rate_adapter_contract_ready: false,
  deletion_executor_contract_ready: false,
  observability_contract_ready: false
};
const historicalPreprodState = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  ...redTeamEvidence,
  ...contractsMissing
});
assert.equal(historicalPreprodState.ok, false);
assert.equal(historicalPreprodState.next_state, 'CONTINUE_PREPRODUCTION_BUILD');
for (const id of [
  'identity_adapter_contract', 'durable_store_contract', 'trusted_retrieval_adapter_contract',
  'distributed_rate_adapter_contract', 'deletion_executor_contract', 'observability_contract'
]) assert.ok(historicalPreprodState.preproduction_required_ids.includes(id));

const current = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  ...redTeamEvidence
});
assert.equal(current.ok, false);
assert.equal(current.preproduction_required_ids.length, 0);
assert.equal(current.next_state, 'OPERATOR_ACTIVATION_REQUIRED');
assert.ok(current.operator_gate_ids.includes('production_customer_identity'));
assert.ok(current.operator_gate_ids.includes('durable_customer_data_plane'));
assert.ok(current.operator_gate_ids.includes('real_customer_ai_processing'));
assert.ok(current.operator_gate_ids.includes('live_trusted_retrieval'));
assert.ok(current.operator_gate_ids.includes('distributed_rate_limit'));
assert.ok(current.operator_gate_ids.includes('production_deletion_executor'));
assert.ok(current.operator_gate_ids.includes('production_observability'));
assert.ok(current.operator_gate_ids.includes('legal_privacy_review'));
assert.ok(current.operator_gate_ids.includes('public_customer_surface'));
assert.ok(!current.operator_gate_ids.includes('payment_provider'));
assert.equal(current.production_activation_performed, false);

const freeReady = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  ...redTeamEvidence,
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
  ...redTeamEvidence
});
assert.deepEqual(paidPreprod.preproduction_required_ids, ['payment_adapter_contract']);
assert.ok(paidPreprod.operator_gate_ids.includes('payment_provider'));
assert.equal(paidPreprod.next_state, 'CONTINUE_PREPRODUCTION_BUILD');

const paidActivationGate = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.PAID_FOUNDER_LAUNCH,
  ...redTeamEvidence,
  payment_adapter_contract_ready: true
});
assert.equal(paidActivationGate.preproduction_required_ids.length, 0);
assert.ok(paidActivationGate.operator_gate_ids.includes('payment_provider'));
assert.equal(paidActivationGate.next_state, 'OPERATOR_ACTIVATION_REQUIRED');

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI CONTROLLED PUBLIC LAUNCH READINESS V1',
  status: 'PASS',
  historical_preprod_state: historicalPreprodState.next_state,
  historical_buildable_contracts: historicalPreprodState.preproduction_required_ids,
  current_free_pilot_next_state: current.next_state,
  current_free_pilot_preproduction_remaining: current.preproduction_required_ids,
  operator_gates_after_preproduction: current.operator_gate_ids,
  paid_founder_requires_payment_contract: true,
  paid_founder_requires_payment_activation: true,
  production_changes: false,
  paid_api_calls: 0,
  variable_cost_eur: 0
}, null, 2));
