import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHamyrenCustomerJourneyV1,
  prepareAurentaraMissionHandoffV1,
  prepareHamyrenPostDeliveryContinuationV1
} from '../src/customer-ai/customer-journey-commercial-routing-v1.js';

const ids = { tenant_id: 'synthetic-tenant', business_id: 'synthetic-business' };

test('CASE 1 sales improvement stays HAMYREN direct', () => {
  const journey = buildHamyrenCustomerJourneyV1({ ...ids, activity: 'strategy', message: 'How can I improve sales?' });
  assert.equal(journey.outcome, 'HAMYREN_DIRECT');
  assert.equal(journey.commercial.route, 'NO_COMMERCIAL_ACTION');
  assert.equal(journey.implementation_brief, null);
});

test('CASE 2 CRM structure design stays planning', () => {
  const journey = buildHamyrenCustomerJourneyV1({ ...ids, activity: 'planning', message: 'Design a CRM structure for my company.' });
  assert.equal(journey.outcome, 'HAMYREN_DIRECT');
  assert.equal(journey.capability_path.decision.execution_class, 'AUTONOMOUS');
});

test('CASE 3 standardized CRM build never lies about Self-Service availability', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    capability: 'crm',
    customer_goal: 'Build the simple standardized CRM we just planned.',
    complexity: 'low',
    integration_count: 0
  });
  assert.equal(journey.capability_path.decision.implementation_execution_class, 'SELF_SERVICE');
  assert.equal(journey.capability_path.decision.implementation_availability, 'CUSTOMER_DISABLED');
  assert.equal(journey.outcome, 'SELF_SERVICE_NOT_AVAILABLE');
  assert.equal(journey.execution.customer_execution_enabled, false);
  assert.equal(journey.execution.execution_authorized, false);
});

test('CASE 4 large CRM migration routes to AURENTARA with structured brief', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    capability: 'crm',
    customer_goal: 'Migrate our existing CRM with 50,000 contacts and integrations.',
    problem_statement: 'Legacy CRM with 50,000 contacts and connected systems.',
    complexity: 'high',
    migration_required: true,
    integration_count: 4,
    customer_data_required: true,
    production_required: true,
    existing_systems: ['Synthetic Legacy CRM'],
    integration_requirements: ['Synthetic ERP', 'Synthetic email platform'],
    data_requirements: ['50,000 synthetic-contact equivalent records'],
    success_criteria: ['History preserved', 'Pipeline works after migration']
  });
  assert.equal(journey.outcome, 'AURENTARA_PROFESSIONAL');
  assert.equal(journey.implementation_brief.schema_version, 'aurentara.customer-implementation-brief.v1');
  assert.equal(journey.implementation_brief.commercial_review_requirement, true);
  assert.equal(journey.implementation_brief.execution_authorized, false);
});

test('CASE 5 simple landing page is Self-Service eligible but not falsely activated', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    capability: 'web',
    customer_goal: 'Create a simple landing page.',
    complexity: 'low',
    integration_count: 0
  });
  assert.equal(journey.capability_path.decision.implementation_execution_class, 'SELF_SERVICE');
  assert.equal(journey.outcome, 'SELF_SERVICE_NOT_AVAILABLE');
  assert.equal(journey.commercial.final_price_defined, false);
});

test('CASE 6 website plus CRM plus automations becomes professional multi-capability scope', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    customer_goal: 'Replace our website, CRM and automations.',
    message: 'Replace our website, CRM and automations.',
    required_capabilities: ['web', 'crm', 'automation'],
    complexity: 'high',
    integration_count: 3,
    scope: 'transformation',
    business_critical: true
  });
  assert.equal(journey.outcome, 'AURENTARA_PROFESSIONAL');
  assert.ok(journey.implementation_brief.required_capabilities.length >= 3);
});

test('CASE 7 prior HAMYREN context is reused without needless re-questioning', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    capability: 'crm',
    customer_goal: 'Migrate the CRM we already planned.',
    complexity: 'high',
    migration_required: true,
    integration_count: 3,
    business_context: {
      sales_process: 'Synthetic B2B sales process already defined',
      target_pipeline: ['new', 'qualified', 'proposal', 'won'],
      current_crm: 'Synthetic Legacy CRM'
    },
    open_questions: ['Confirm maintenance window']
  });
  assert.equal(journey.context_reuse.business_context_reused, true);
  assert.deepEqual(journey.context_reuse.additional_information_requested, ['Confirm maintenance window']);
  assert.equal(journey.context_reuse.repeated_questions_required, false);
});

test('professional journey can prepare existing mission package only after explicit customer/commercial/operator approvals', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    capability: 'crm',
    customer_goal: 'Migrate CRM and preserve sales history.',
    problem_statement: 'Synthetic legacy CRM migration.',
    complexity: 'high',
    migration_required: true,
    integration_count: 3,
    success_criteria: ['Sales history preserved']
  });
  const blocked = prepareAurentaraMissionHandoffV1({ journey, approvals: {} });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'IMPLEMENTATION_APPROVALS_REQUIRED');

  const prepared = prepareAurentaraMissionHandoffV1({
    journey,
    approvals: {
      customer_scope_approved: true,
      commercial_review_approved: true,
      operator_implementation_approved: true
    }
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.current_state, 'MISSION_PREPARED');
  assert.equal(prepared.mission_package.safeguards.production_deploy, false);
  assert.equal(prepared.mission_execution_authorized, false);
});

test('CASE 8 delivered AURENTARA result prepares HAMYREN continuation without duplicate memory', () => {
  const journey = buildHamyrenCustomerJourneyV1({
    ...ids,
    activity: 'implementation',
    capability: 'crm',
    customer_goal: 'Migrate CRM.',
    problem_statement: 'Synthetic migration.',
    complexity: 'high',
    migration_required: true,
    integration_count: 3,
    success_criteria: ['Pipeline operational']
  });

  const mission = {
    mission_id: 'mission-synthetic-1',
    orchestration_id: 'orchestration-synthetic-1',
    prompt: 'Synthetic CRM migration',
    project: 'synthetic-project',
    status: 'COMPLETED',
    tasks: [{
      task_id: 'task-business-1',
      capability: 'business_system_build',
      domain: 'business',
      state: 'COMPLETED',
      attempt: 1,
      outputs: { business_system: { type: 'synthetic-crm' }, operation_count: 3 }
    }]
  };
  const continuation = prepareHamyrenPostDeliveryContinuationV1({ journey, mission });
  assert.equal(continuation.ok, true);
  assert.equal(continuation.current_state, 'MONITORING');
  assert.equal(continuation.memory_adapter.duplicate_memory_created, false);
  assert.equal(continuation.memory_write_performed, false);
  assert.equal(continuation.business_state_update_candidate.implemented.length, 1);
});
