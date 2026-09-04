import assert from 'node:assert/strict';
import {
  classifyCustomerFeedbackV1,
  createCustomerDeliveryContractV1,
  customerDeliveryContractV1Manifest,
  draftFerrariRequirementsFromCustomerWish,
  evaluateCustomerDeliveryContractV1
} from '../src/customer-delivery-contract-v1.js';

const draft = draftFerrariRequirementsFromCustomerWish('Ich brauche eine moderne Webseite und will mehr Anfragen.');
assert.equal(draft.authoritative, false);
assert.equal(draft.scope_confirmation_required, true);
for (const capability of ['web_presence', 'lead_capture', 'business_crm', 'automation_followup', 'analytics']) {
  assert.equal(draft.requested_capabilities.includes(capability), true, capability);
}

const blocked = createCustomerDeliveryContractV1({
  customer_id: 'mueller-elektrotechnik',
  project_id: 'digital-system-v1',
  customer_problem: 'Moderne Website und mehr qualifizierte Anfragen',
  desired_outcomes: ['Mehr qualifizierte Anfragen'],
  required_customer_inputs: ['company_name', 'phone', 'email'],
  customer_inputs: { company_name: 'Müller Elektrotechnik' }
});
assert.equal(blocked.ok, true);
assert.equal(blocked.contract.scope_key, 'mueller-elektrotechnik:digital-system-v1');
assert.deepEqual(blocked.contract.missing_inputs.sort(), ['email', 'phone']);
assert.equal(blocked.readiness.ready_for_build, false);
assert.equal(blocked.readiness.blockers.includes('REQUIRED_CUSTOMER_INPUTS_MISSING'), true);
assert.equal(blocked.readiness.blockers.includes('SCOPE_CONFIRMATION_REQUIRED'), true);
assert.equal(blocked.contract.discovery.authoritative, false);
assert.equal(blocked.contract.safety.production_deploy, false);
assert.equal(blocked.contract.safety.automatic_paid_provider_calls, false);

const ready = createCustomerDeliveryContractV1({
  customer_id: 'mueller-elektrotechnik',
  project_id: 'digital-system-v1',
  customer_problem: 'Moderne Website und mehr qualifizierte Anfragen',
  desired_outcomes: ['Website ist verständlich', 'Anfragen landen zuverlässig im CRM'],
  required_customer_inputs: ['company_name', 'phone', 'email'],
  customer_inputs: {
    company_name: 'Müller Elektrotechnik',
    phone: 'synthetic-only',
    email: 'synthetic@example.invalid'
  },
  source_readiness: 'READY',
  rights_readiness: 'READY',
  provider_plan: { web: 'native-web-factory', crm: 'supabase', automation: 'make', analytics: 'posthog' },
  cost_preflight: { estimate_eur: 1.5, approved_ceiling_eur: 5 },
  quality_contract: { premium_website_standard_required: true },
  acceptance_criteria: ['Website CTA funktioniert', 'Lead erscheint im CRM'],
  delivery_definition: { private_preview_required: true, customer_approval_required: true },
  scope_confirmation_status: 'CUSTOMER_CONFIRMED'
});
assert.equal(ready.ok, true);
assert.deepEqual(ready.contract.missing_inputs, []);
assert.equal(ready.readiness.ready_for_build, true);
assert.deepEqual(ready.readiness.blockers, []);

const evaluated = evaluateCustomerDeliveryContractV1(ready.contract);
assert.equal(evaluated.ready_for_build, true);
assert.equal(evaluated.scope_drift_blocked, true);
assert.equal(evaluated.production_without_approval_blocked, true);

const mismatch = createCustomerDeliveryContractV1({
  customer_id: 'project-a',
  project_id: 'delivery-v1',
  scope_key: 'project-b:delivery-v1'
});
assert.equal(mismatch.ok, false);
assert.equal(mismatch.error, 'CUSTOMER_DELIVERY_SCOPE_MISMATCH');

const revision = classifyCustomerFeedbackV1({ type: 'REVISION', summary: 'CTA Text ändern' });
assert.equal(revision.ok, true);
assert.equal(revision.feedback.normal_revision_eligible, true);
assert.equal(revision.feedback.requires_cost_reestimate, false);

const expansion = classifyCustomerFeedbackV1({ type: 'SCOPE_EXPANSION', summary: 'Zusätzlich einen Kundenlogin bauen' });
assert.equal(expansion.ok, true);
assert.equal(expansion.feedback.normal_revision_eligible, false);
assert.equal(expansion.feedback.requires_scope_reassessment, true);
assert.equal(expansion.feedback.requires_cost_reestimate, true);
assert.equal(expansion.feedback.requires_new_approval, true);

const manifest = customerDeliveryContractV1Manifest();
assert.equal(manifest.draft_is_authoritative, false);
assert.equal(manifest.scope_expansion_separate_from_revision, true);
assert.equal(manifest.production_deploy, false);

console.log('customer-delivery-contract-v1-smoke: ok');
