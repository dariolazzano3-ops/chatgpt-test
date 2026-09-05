#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateCustomerDeliveryContractV1 } from '../src/customer-delivery-contract-v1.js';

const base = new URL('../projects/gelato-donatello-website-v1/', import.meta.url);
const evidence = JSON.parse(await readFile(new URL('auto-customer-input-closure-v1.json', base), 'utf8'));
const contract = JSON.parse(await readFile(new URL('customer-delivery-contract-v1.json', base), 'utf8'));
const confirmed = JSON.parse(await readFile(new URL('confirmed-project-inputs-v1.json', base), 'utf8'));

assert.equal(evidence.schema, 'aurentara.gelato-auto-customer-input-closure.v1');
assert.equal(contract.schema, 'aurentara.customer-delivery-contract.v1');
assert.equal(confirmed.schema, 'aurentara.gelato-confirmed-project-inputs.v1');
assert.equal(evidence.project_ref.scope_key, contract.scope_key);
assert.equal(contract.scope_key, confirmed.project_ref.scope_key);

const readiness = evaluateCustomerDeliveryContractV1(contract);
assert.equal(readiness.ok, true);
assert.equal(readiness.ready_for_build, false);
assert.deepEqual(readiness.blockers, ['REQUIRED_CUSTOMER_INPUTS_MISSING']);

assert.equal(contract.missing_inputs.includes('business_model'), false);
assert.deepEqual(contract.missing_inputs, [
  'target_customers',
  'primary_conversion_channel',
  'current_contact_details',
  'opening_hours_confirmation',
  'legal_details',
  'final_asset_quality_approval'
]);

assert.equal(evidence.classifications.confirmed.length, 6);
assert.equal(evidence.classifications.high_confidence_candidates.length, 10);
assert.equal(evidence.classifications.conflicts.length, 3);
assert.equal(evidence.classifications.missing.length, 1);
assert.equal(evidence.classifications.missing[0].required_for_scope, false);
assert.equal(evidence.human_questions.length, 7);
assert.equal(evidence.efficiency.system_extracted_fact_candidates, 18);
assert.equal(evidence.efficiency.automatically_resolved_required_inputs, 1);
assert.deepEqual(evidence.efficiency.automatically_resolved_required_input_ids, ['business_model']);
assert.equal(evidence.efficiency.manual_questions_fully_avoided, 1);
assert.equal(evidence.efficiency.open_ended_questions_narrowed_to_confirmation_or_choice, 3);
assert.equal(evidence.efficiency.repairs, 0);
assert.equal(evidence.efficiency.retries, 0);
assert.equal(evidence.efficiency.actual_variable_cost_eur, 0);
assert.equal(evidence.result.auto_customer_input_closure, 'PASS');
assert.equal(evidence.result.customer_input_closure, 'BLOCKED_BY_EXTERNAL_INPUT');
assert.equal(evidence.result.gelato_full_dogfood_ready, false);
assert.equal(evidence.safety.scraped_is_confirmed, false);
assert.equal(evidence.safety.unconfirmed_critical_facts_publishable, false);
assert.equal(evidence.safety.production_deploy, false);
assert.equal(evidence.safety.public_launch, false);
assert.equal(evidence.safety.paid_provider_calls, 0);

console.log(JSON.stringify({
  ok:true,
  schema:'aurentara.gelato-auto-customer-input-closure-evidence-smoke.v1',
  contract_ready_for_build:readiness.ready_for_build,
  remaining_contract_inputs:contract.missing_inputs.length,
  remaining_human_questions:evidence.human_questions.length,
  questions_fully_avoided:evidence.efficiency.manual_questions_fully_avoided,
  questions_narrowed:evidence.efficiency.open_ended_questions_narrowed_to_confirmation_or_choice,
  full_dogfood_ready:false,
  production_deploy:false
}, null, 2));
