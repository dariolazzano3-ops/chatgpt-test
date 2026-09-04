import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCustomerDeliveryContractV1 } from '../src/customer-delivery-contract-v1.js';
import {
  approveCustomerReviewV1,
  createCustomerReviewLifecycleV1,
  evaluateCustomerReviewLifecycleV1,
  recordCustomerRevisionV1,
  registerPrivatePreviewV1,
  submitCustomerFeedbackV1
} from '../src/customer-review-lifecycle-v1.js';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';
import { evaluateProjectDelivery, createProjectHandoff } from '../src/project-delivery-gate.js';
import { buildMakeSupabaseLeadBridgePlan, evaluateMakeSupabaseLeadBridgeExecution } from '../src/make-supabase-lead-bridge.js';
import { buildPostHogStagingBatchPlan } from '../src/posthog-staging-event-runner.js';
import { isPipelineTransitionAllowed } from '../src/business-crm-model.js';
import { buildOperatorProjectDetail } from '../src/operator-dashboard-projections-v1.js';
import { deepMissionCostPreflight, evaluateMissionCostCeiling } from '../src/mission-cost-preflight-v1.js';

const root = new URL('../projects/mueller-elektrotechnik-digital-customer-system-v1/', import.meta.url);
const projectFile = JSON.parse(await readFile(new URL('project.json', root), 'utf8'));
const system = JSON.parse(await readFile(new URL('customer-system.json', root), 'utf8'));
const scopeKey = projectFile.scope_key;
const projectUuid = 'b3f54cc8-4abf-4f9c-92c9-81a4ebcdd001';

assert.equal(projectFile.synthetic_test_data_only, true);
assert.equal(projectFile.real_customer_data, false);
assert.equal(projectFile.production_deploy, false);
assert.equal(projectFile.public_deploy, false);

const selectedCapabilities = [
  { capability: 'web_presence', factory: 'web', dependencies: [] },
  { capability: 'business_crm', factory: 'business', dependencies: ['web_presence'] },
  { capability: 'automation_followup', factory: 'automation', dependencies: ['business_crm'] },
  { capability: 'analytics', factory: 'automation', dependencies: ['web_presence'] }
];
const cost = deepMissionCostPreflight({
  route: 'ECONOMY',
  mission_type: 'FERRARI_MUELLER_FULL_E2E',
  mission_text: system.system_plan.objective,
  expected_capabilities: selectedCapabilities.map((item) => item.capability),
  selected_capabilities: selectedCapabilities,
  requested_outcomes: system.system_plan.capabilities.map((item) => item.outcome),
  known_constraints: system.brief.constraints,
  external_dependencies_unknown: false,
  external_dependencies: ['make-core-staging','supabase-free-staging','posthog-free-staging'],
  force_deep_preflight: true
});
assert.equal(cost.paid_calls_performed, 0);
assert.equal(cost.production_deploy, false);
assert.equal(cost.external_writes, false);
const ceiling = evaluateMissionCostCeiling({
  customer_id: projectFile.customer_id,
  project_id: projectFile.project_id,
  mission_id: 'mueller-elektrotechnik:ferrari-full-e2e-v1',
  actual_spend_eur: 0,
  projected_final_cost_eur: 0,
  approved_ceiling_eur: 0
});
assert.equal(ceiling.ok, true);

const contractResult = createCustomerDeliveryContractV1({
  customer_id: projectFile.customer_id,
  project_id: projectFile.project_id,
  scope_key: scopeKey,
  customer_problem: system.system_plan.objective,
  desired_outcomes: system.system_plan.capabilities.map((item) => item.outcome),
  requested_capabilities: projectFile.capabilities.map((item) => item.id),
  required_capabilities: projectFile.capabilities.filter((item) => item.required !== false).map((item) => item.id),
  required_customer_inputs: [],
  missing_inputs: [],
  source_readiness: 'READY',
  rights_readiness: 'READY',
  provider_plan: { route: 'existing-staging-providers', providers: ['make-core','supabase-free','posthog-free'] },
  cost_preflight: { approved_ceiling_eur: 0, actual_variable_cost_eur: 0, paid_overflow: false },
  quality_contract: { browser_qa_required: true, human_outcome_required: true },
  acceptance_criteria: ['full_cross_factory_e2e','zero_cross_project_leaks','customer_review_before_delivery'],
  customer_review_required: true,
  production_approval_required: true,
  delivery_definition: { kind: 'synthetic_ferrari_e2e_evidence', production: false },
  scope_confirmation_status: 'CUSTOMER_CONFIRMED',
  current_status: 'READY_FOR_BUILD'
});
assert.equal(contractResult.ok, true);
const project = { ...projectFile, delivery_contract: contractResult.contract };

const bridge = buildMakeSupabaseLeadBridgePlan({
  customer_id: project.customer_id,
  project_id: project.project_id,
  project_uuid: projectUuid,
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  production_deploy: false
});
assert.equal(bridge.ok, true);
assert.equal(bridge.state, 'BRIDGE_PLAN_READY_APPROVAL_REQUIRED');
assert.equal(bridge.scope.scope_key, scopeKey);
assert.equal(bridge.bridge_contract.input.pii_in_envelope, false);
assert.equal(JSON.stringify(bridge.bridge_contract.input).includes('@'), false);
const bridgeGate = evaluateMakeSupabaseLeadBridgeExecution(bridge, {
  bridge_confirmation: 'RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE',
  make_confirmation: 'RUN_STAGING_ONCE',
  supabase_confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  make_provider_approved: true,
  project_isolation_approved: true,
  approved_scope_key: scopeKey,
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
assert.equal(bridgeGate.execution_ready, true);

const pipeline = system.crm_contract.sales_pipeline;
assert.equal(isPipelineTransitionAllowed(pipeline, 'new-inquiry', 'qualification').ok, true);
const invalidTransition = isPipelineTransitionAllowed(pipeline, 'new-inquiry', 'quote');
assert.equal(invalidTransition.ok, false);
assert.equal(invalidTransition.error, 'CRM_PIPELINE_TRANSITION_NOT_ALLOWED');

const posthog = buildPostHogStagingBatchPlan({
  scope_key: scopeKey,
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  make_execution_id: 'synthetic-execution-ref-001',
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
assert.equal(posthog.ok, true);
assert.equal(posthog.event_count, 5);
assert.equal(posthog.events.every((event) => event.properties.project_scope === scopeKey), true);
assert.equal(JSON.stringify(posthog.events).includes('@'), false);

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

let review = createCustomerReviewLifecycleV1(project, { actor: 'operator:synthetic-ferrari' }).state;
review = registerPrivatePreviewV1(review, {
  preview_id: 'mueller-ferrari-preview-v1',
  preview_url: 'http://127.0.0.1:4173/',
  source_revision: 'mueller-ferrari-preview-rev-1',
  private_access_verified: true,
  qa_passed: true,
  human_outcome_acceptance: humanOutcome
}, { actor: 'operator:synthetic-ferrari' }).state;
assert.equal(review.status, 'CUSTOMER_REVIEW');

const capabilityEvidence = project.capabilities.map((item) => ({ id: item.id, completed: true }));
const beforeApproval = evaluateProjectDelivery(project, {
  capabilities: capabilityEvidence,
  qa_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  customer_review: review,
  production_deploy: false
});
assert.equal(beforeApproval.ready_for_structural_delivery, false);
assert.equal(beforeApproval.blockers.some((item) => item.code === 'CUSTOMER_APPROVAL_REQUIRED'), true);

let feedback = submitCustomerFeedbackV1(review, {
  feedback_id: 'mueller-synthetic-feedback-001',
  type: 'CONTENT_CORRECTION',
  summary: 'SYNTHETIC_CONTENT_CORRECTION',
  submitted_by: 'customer:synthetic'
}, { actor: 'customer:synthetic' });
assert.equal(feedback.ok, true);
review = feedback.state;
assert.equal(review.status, 'REVISION_REQUIRED');

const revision = recordCustomerRevisionV1(review, {
  revision_id: 'mueller-synthetic-revision-001',
  source_revision: 'mueller-ferrari-preview-rev-2',
  summary: 'SYNTHETIC_REVISION_APPLIED'
}, { actor: 'operator:synthetic-ferrari' });
assert.equal(revision.ok, true);
review = revision.state;
assert.equal(review.status, 'AWAITING_PRIVATE_PREVIEW');

review = registerPrivatePreviewV1(review, {
  preview_id: 'mueller-ferrari-preview-v2',
  preview_url: 'http://127.0.0.1:4173/',
  source_revision: 'mueller-ferrari-preview-rev-2',
  private_access_verified: true,
  qa_passed: true,
  human_outcome_acceptance: humanOutcome
}, { actor: 'operator:synthetic-ferrari' }).state;

const approved = approveCustomerReviewV1(review, {
  actor_id: 'customer:synthetic'
}, { actor: 'customer:synthetic' });
assert.equal(approved.ok, true);
review = approved.state;
const reviewEvidence = evaluateCustomerReviewLifecycleV1(review);
assert.equal(reviewEvidence.ready_for_delivery, true);

const delivery = evaluateProjectDelivery(project, {
  capabilities: capabilityEvidence,
  qa_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  customer_review: review,
  production_deploy: false
});
assert.equal(delivery.ready_for_structural_delivery, true);
const handoff = createProjectHandoff(project, {
  capabilities: capabilityEvidence,
  qa_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  customer_review: review,
  production_deploy: false
});
assert.equal(handoff.ok, true);
assert.equal(handoff.handoff.customer_review.ready, true);

const runtime = {
  command_center_state: {
    portfolio: {
      projects: [{
        customer_id: project.customer_id,
        project_id: project.project_id,
        scope_key: scopeKey,
        name: project.name,
        state: 'ACTIVE',
        blocked: false
      }]
    }
  },
  universal_runs: [{
    mission: { customer_id: project.customer_id, project_id: project.project_id, mission_id: 'mueller-elektrotechnik:ferrari-full-e2e-v1', environment: 'staging', data_policy: { synthetic_only: true } },
    plan: { selected_capabilities: selectedCapabilities, execution_order: selectedCapabilities.map((item) => item.capability) },
    execution: { status: 'SYNTHETIC_STAGING_COMPLETED', variable_cost_eur: 0, results: selectedCapabilities.map((item) => ({ capability: item.capability, factory: item.factory, provider: item.factory === 'business' ? 'supabase-free' : item.capability === 'analytics' ? 'posthog-free' : item.factory === 'automation' ? 'make-core' : 'local-web', status: 'COMPLETED', retries: [] })) },
    quality: { status: 'PASS', quality_score: 100, failures: [] },
    delivery: { final_delivery_status: 'SIMULATED_HANDOFF_READY', execution_evidence: { synthetic: true, production_deploy: false } }
  }],
  audit: []
};
const operator = buildOperatorProjectDetail({
  runtime,
  scope_key: scopeKey,
  crm_snapshot: {
    scope_key: scopeKey,
    lead_id: 'mueller-elektrotechnik-digital-customer-system-v1-synthetic-lead-001',
    pipeline_key: 'inquiries',
    stage_key: 'qualification',
    next_action: 'QUALIFY_SYNTHETIC_LEAD',
    last_activity: 'SYNTHETIC_FORM_SUBMITTED',
    automation_status: 'MAKE_STAGING_EXECUTION_VERIFIED',
    review_status: review.status,
    synthetic: true,
    pii_present: false
  }
});
assert.equal(operator.ok, true);
assert.equal(operator.results.crm.stage_key, 'qualification');
assert.equal(operator.results.crm.review_status, 'CUSTOMER_APPROVED');
assert.equal(operator.results.crm.pii_present, false);

const wrongOperator = buildOperatorProjectDetail({
  runtime,
  scope_key: scopeKey,
  crm_snapshot: { scope_key: 'other:project', synthetic: true, pii_present: false }
});
assert.equal(wrongOperator.blockers.includes('CRM_OPERATOR_SNAPSHOT_SCOPE_OR_PRIVACY_REJECTED'), true);

console.log('PROJECT FERRARI Müller full cross-factory contract E2E: PASS');
console.log(JSON.stringify({
  status: 'PASS',
  scope_key: scopeKey,
  cost: {
    estimated_variable_cost_eur: cost.estimated_cost_eur,
    low_estimate_eur: cost.low_estimate_eur,
    high_estimate_eur: cost.high_estimate_eur,
    approved_ceiling_eur: 0,
    actual_variable_cost_eur: 0,
    ai_cost_eur: 0,
    paid_calls_performed_by_preflight: cost.paid_calls_performed
  },
  website: { form_contract: 'aurentara.synthetic-form-lead.v1', synthetic: true },
  lead: { idempotency_key: bridge.bridge_contract.input.lead.idempotency_key, pii_in_envelope: false },
  crm: { pipeline: pipeline.key, initial_stage: 'new-inquiry', valid_transition: 'new-inquiry->qualification', invalid_transition_blocked: 'new-inquiry->quote' },
  automation: { provider: 'make-core', execution_ready: bridgeGate.execution_ready, zero_cost_ceiling_eur: 0 },
  analytics: { provider: 'posthog-free', events: posthog.events.map((event) => event.event), pii_present: false },
  operator: { projected: true, stage_key: operator.results.crm.stage_key, next_action: operator.results.crm.next_action },
  human_outcome: { verdict: humanOutcome.verdict, accepted: humanOutcome.human_outcome_accepted },
  customer_review: { status: review.status, normal_revision_count: review.normal_revision_count, ready_for_delivery: reviewEvidence.ready_for_delivery },
  delivery_gate: { before_approval_blocked: true, after_approval_ready: delivery.ready_for_structural_delivery },
  production_deploy: false,
  public_launch: false,
  real_customer_data: false
}, null, 2));
