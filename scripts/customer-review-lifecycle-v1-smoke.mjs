import assert from 'node:assert/strict';
import {
  approveCustomerReviewV1,
  createCustomerReviewLifecycleV1,
  customerReviewLifecycleV1Manifest,
  evaluateCustomerReviewLifecycleV1,
  recordCustomerRevisionV1,
  registerPrivatePreviewV1,
  submitCustomerFeedbackV1
} from '../src/customer-review-lifecycle-v1.js';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';

const project = {
  customer_id: 'mueller-elektrotechnik',
  project_id: 'digital-system-v1',
  scope_key: 'mueller-elektrotechnik:digital-system-v1',
  delivery_contract: {
    schema: 'aurentara.customer-delivery-contract.v1',
    customer_review_required: true
  }
};

const humanOutcome = evaluateHumanOutcomeAcceptance({
  technical_implementation: true,
  technical_integration: true,
  final_dom_presence: true,
  human_visibility: true,
  human_reachability: true,
  primary_interaction: true,
  expected_result: true,
  desktop_acceptance: true,
  mobile_acceptance: true,
  composition_regression: true,
  safety_regression: true
});
assert.equal(humanOutcome.human_outcome_accepted, true);

const created = createCustomerReviewLifecycleV1(project, { at: '2026-09-04T16:20:00.000Z', actor: 'operator' });
assert.equal(created.ok, true);
let state = created.state;
assert.equal(state.status, 'AWAITING_PRIVATE_PREVIEW');
assert.equal(state.production_deploy, undefined);
assert.equal(state.safety.production_deploy, false);

const missingHuman = registerPrivatePreviewV1(state, {
  preview_url: 'https://private-preview.example.invalid',
  source_revision: 'rev-1',
  private_access_verified: true,
  qa_passed: true
});
assert.equal(missingHuman.ok, false);
assert.equal(missingHuman.error, 'PRIVATE_PREVIEW_HUMAN_OUTCOME_REQUIRED');

let result = registerPrivatePreviewV1(state, {
  preview_id: 'preview-1',
  preview_url: 'https://private-preview.example.invalid',
  source_revision: 'rev-1',
  private_access_verified: true,
  qa_passed: true,
  human_outcome_acceptance: humanOutcome
}, { at: '2026-09-04T16:21:00.000Z', actor: 'operator' });
assert.equal(result.ok, true);
state = result.state;
assert.equal(state.status, 'CUSTOMER_REVIEW');
assert.equal(state.current_preview.human_outcome_accepted, true);

const crossScope = submitCustomerFeedbackV1(state, {
  customer_id: 'other-customer',
  type: 'REVISION',
  summary: 'Nope'
});
assert.equal(crossScope.ok, false);
assert.equal(crossScope.error, 'CUSTOMER_REVIEW_CROSS_SCOPE_REJECTED');

result = submitCustomerFeedbackV1(state, {
  feedback_id: 'feedback-1',
  type: 'CONTENT_CORRECTION',
  summary: 'Telefonnummer korrigieren',
  submitted_by: 'customer-user'
}, { at: '2026-09-04T16:22:00.000Z', actor: 'customer-user' });
assert.equal(result.ok, true);
state = result.state;
assert.equal(state.status, 'REVISION_REQUIRED');
assert.equal(result.feedback.normal_revision_eligible, true);

result = recordCustomerRevisionV1(state, {
  revision_id: 'revision-1',
  source_revision: 'rev-2',
  summary: 'Telefonnummer korrigiert'
}, { at: '2026-09-04T16:23:00.000Z', actor: 'operator' });
assert.equal(result.ok, true);
state = result.state;
assert.equal(state.status, 'AWAITING_PRIVATE_PREVIEW');
assert.equal(state.normal_revision_count, 1);
assert.equal(state.feedback[0].resolved, true);
assert.equal(state.current_preview, null);

result = registerPrivatePreviewV1(state, {
  preview_id: 'preview-2',
  preview_url: 'https://private-preview-v2.example.invalid',
  source_revision: 'rev-2',
  private_access_verified: true,
  qa_passed: true,
  human_outcome_acceptance: humanOutcome
}, { at: '2026-09-04T16:24:00.000Z', actor: 'operator' });
assert.equal(result.ok, true);
state = result.state;
assert.equal(state.status, 'CUSTOMER_REVIEW');

result = approveCustomerReviewV1(state, {
  actor_id: 'customer-user'
}, { at: '2026-09-04T16:25:00.000Z', actor: 'customer-user' });
assert.equal(result.ok, true);
state = result.state;
assert.equal(state.status, 'CUSTOMER_APPROVED');
assert.equal(result.approval.approval_type, 'CUSTOMER_DELIVERY_APPROVAL');
assert.equal(result.approval.scope_key, project.scope_key);
assert.equal(result.approval.production_deploy, false);

const evidence = evaluateCustomerReviewLifecycleV1(state, { now: new Date('2026-09-04T16:26:00.000Z') });
assert.equal(evidence.ok, true);
assert.equal(evidence.ready_for_delivery, true);
assert.deepEqual(evidence.blockers, []);

let scopeState = createCustomerReviewLifecycleV1(project, { at: '2026-09-04T17:00:00.000Z' }).state;
scopeState = registerPrivatePreviewV1(scopeState, {
  preview_url: 'https://scope-preview.example.invalid',
  source_revision: 'scope-rev-1',
  private_access_verified: true,
  qa_passed: true,
  human_outcome_acceptance: humanOutcome
}).state;
const expansion = submitCustomerFeedbackV1(scopeState, {
  type: 'SCOPE_EXPANSION',
  summary: 'Zusätzlich einen Kundenlogin bauen',
  submitted_by: 'customer-user'
});
assert.equal(expansion.ok, true);
scopeState = expansion.state;
assert.equal(scopeState.status, 'SCOPE_REASSESSMENT_REQUIRED');
assert.equal(scopeState.scope_reassessment.cost_reestimate_required, true);
assert.equal(scopeState.scope_reassessment.new_scope_approval_required, true);

const illegalRevision = recordCustomerRevisionV1(scopeState, {
  source_revision: 'scope-rev-2',
  summary: 'Kundenlogin schnell ergänzt'
});
assert.equal(illegalRevision.ok, false);
assert.equal(illegalRevision.error, 'SCOPE_EXPANSION_REQUIRES_DELIVERY_CONTRACT_REASSESSMENT');

const scopeEvidence = evaluateCustomerReviewLifecycleV1(scopeState);
assert.equal(scopeEvidence.ready_for_delivery, false);
assert.equal(scopeEvidence.blockers.includes('SCOPE_REASSESSMENT_REQUIRED'), true);
assert.equal(scopeEvidence.blockers.includes('CUSTOMER_APPROVAL_REQUIRED'), true);

const manifest = customerReviewLifecycleV1Manifest();
assert.equal(manifest.scope_expansion_is_normal_revision, false);
assert.equal(manifest.private_preview_requires_human_outcome_acceptance, true);
assert.equal(manifest.production_deploy, false);

console.log('customer-review-lifecycle-v1-smoke: ok');
