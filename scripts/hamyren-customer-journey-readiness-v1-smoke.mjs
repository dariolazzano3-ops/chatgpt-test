import assert from 'node:assert/strict';
import {
  HAMYREN_FREE_QUESTION_LIMIT_V1,
  hamyrenCustomerJourneyReadinessManifest,
  normalizeHamyrenMinimalIntake,
  createHamyrenFreeQuestionJourney,
  evaluateHamyrenCustomerJourneyReadiness
} from '../src/customer-product/hamyren-customer-journey-readiness-v1.js';

const manifest = hamyrenCustomerJourneyReadinessManifest();
assert.equal(manifest.product_name, 'HAMYREN');
assert.equal(manifest.tagline, 'Your Personal Business AI');
assert.equal(manifest.maker, 'AURENTARA SYSTEMS');
assert.equal(HAMYREN_FREE_QUESTION_LIMIT_V1, 5);
assert.equal(manifest.free_business_question_limit, 5);
assert.equal(manifest.public_customer_surface_active, false);
assert.equal(manifest.real_customer_ai_processing_active, false);
assert.equal(manifest.billing_active, false);
assert.equal(manifest.stripe_active, false);
assert.equal(manifest.variable_cost_eur, 0);

const missing = normalizeHamyrenMinimalIntake({ name: 'Synthetic User' });
assert.equal(missing.ok, false);
assert.deepEqual(missing.missing, ['business_name_or_idea', 'industry', 'current_objective']);
assert.equal(missing.persistence_allowed, false);
assert.equal(missing.real_customer_processing_allowed, false);

const intake = {
  name: 'Synthetic User',
  business_name_or_idea: 'Synthetic Bakery',
  industry: 'bakery',
  current_objective: 'Improve weekday demand',
  country_or_region: 'DE'
};
const first = createHamyrenFreeQuestionJourney({ intake, questions_used: 0 });
assert.equal(first.ok, true);
assert.equal(first.questions_remaining, 5);
assert.equal(first.may_ask_free_question, true);
assert.equal(first.next_step, 'ASK_BUSINESS_QUESTION');
assert.equal(first.account_creation_automatic, false);
assert.equal(first.subscription_activation_automatic, false);

const fifth = createHamyrenFreeQuestionJourney({ intake, questions_used: 5 });
assert.equal(fifth.questions_remaining, 0);
assert.equal(fifth.may_ask_free_question, false);
assert.equal(fifth.next_step, 'ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF');
assert.equal(fifth.public_activation_automatic, false);
assert.equal(fifth.real_customer_ai_processing_automatic, false);
assert.equal(fifth.operator_access, false);

const readiness = evaluateHamyrenCustomerJourneyReadiness({ operator_route_exposed: false });
assert.equal(readiness.ok, true, JSON.stringify(readiness.failures));
assert.equal(readiness.technical_journey_ready, true);
assert.deepEqual(readiness.required_operator_gates, ['legal_privacy_review', 'public_customer_surface', 'real_customer_ai_processing']);
assert.equal(readiness.payment_gate_deferred, true);
assert.equal(readiness.public_customer_surface_active, false);
assert.equal(readiness.real_customer_ai_processing_active, false);
assert.equal(readiness.real_customer_data, false);
assert.equal(readiness.variable_cost_eur, 0);

console.log(JSON.stringify({
  suite: 'HAMYREN CUSTOMER JOURNEY READINESS V1',
  status: 'PASS',
  five_free_business_questions: true,
  minimal_business_intake: true,
  persistent_context_handoff_ready: true,
  public_customer_surface_active: false,
  real_customer_ai_processing_active: false,
  stripe_active: false,
  real_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
