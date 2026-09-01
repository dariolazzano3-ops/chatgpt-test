import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHamyrenCapabilityRequest } from '../src/capability-router.js';
import { createAurentaraImplementationHandoffV1 } from '../src/customer-ai/capability-policy-v1.js';

const cases = [
  ['1 business strategy', { activity: 'strategy', prompt: 'Help with business strategy.' }, 'AUTONOMOUS'],
  ['2 website architecture', { activity: 'planning', prompt: 'Plan the website architecture for our local business.' }, 'AUTONOMOUS'],
  ['3 simple five-page website', { activity: 'implementation', capability: 'web', complexity: 'low', risk_class: 'low', integration_count: 0 }, 'SELF_SERVICE'],
  ['4 large custom integrated website', { activity: 'implementation', capability: 'web', complexity: 'high', custom_code_required: true, complex_authentication_required: true, integration_count: 4, production_required: true }, 'AURENTARA_REQUIRED'],
  ['5 simple CRM pipeline', { activity: 'implementation', capability: 'crm', complexity: 'low', integration_count: 0 }, 'SELF_SERVICE'],
  ['6 CRM migration', { activity: 'implementation', capability: 'crm', complexity: 'high', migration_required: true, integration_count: 4, customer_data_required: true, production_required: true }, 'AURENTARA_REQUIRED'],
  ['7 simple bounded automation', { activity: 'implementation', capability: 'automation', complexity: 'low', risk_class: 'low', integration_count: 1 }, 'SELF_SERVICE'],
  ['8 critical external-write automation', { activity: 'implementation', capability: 'automation', complexity: 'high', risk_class: 'high', integration_count: 3, production_required: true, external_write_required: true, business_critical: true, human_approval_required: true }, 'AURENTARA_REQUIRED'],
  ['9 AI strategy', { activity: 'strategy', prompt: 'Design our AI assistant use-case strategy.' }, 'AUTONOMOUS'],
  ['10 custom production AI platform', { activity: 'implementation', capability: 'ai', complexity: 'high', custom_code_required: true, production_required: true, security_sensitive: true, integration_count: 4, business_critical: true }, 'AURENTARA_REQUIRED']
];

for (const [name, input, expected] of cases) test(name, () => assert.equal(classifyHamyrenCapabilityRequest(input).execution_class, expected));

test('Self-Service eligibility is separate from availability', () => {
  const decision = classifyHamyrenCapabilityRequest({ activity: 'implementation', capability: 'web', complexity: 'low' });
  assert.equal(decision.self_service_eligible, true);
  assert.equal(decision.availability, 'CUSTOMER_DISABLED');
});

test('planning remains autonomous when implementation requires AURENTARA', () => {
  const decision = classifyHamyrenCapabilityRequest({ activity: 'planning', capability: 'crm', complexity: 'high', migration_required: true, integration_count: 5 });
  assert.equal(decision.execution_class, 'AUTONOMOUS');
  assert.equal(decision.implementation_execution_class, 'AURENTARA_REQUIRED');
});

test('critical external writes retain approval and production gates', () => {
  const decision = classifyHamyrenCapabilityRequest({ activity: 'implementation', capability: 'automation', risk_class: 'high', external_write_required: true, production_required: true, business_critical: true, integration_count: 3 });
  assert.ok(decision.required_approvals.includes('external_write_approval'));
  assert.ok(decision.required_approvals.includes('production_activation'));
  assert.ok(decision.execution_constraints.includes('existing_external_write_gate'));
  assert.ok(decision.execution_constraints.includes('existing_production_activation_gate'));
});

test('AURENTARA handoff reuses project blueprint and never authorizes execution', () => {
  const decision = classifyHamyrenCapabilityRequest({ activity: 'implementation', capability: 'crm', complexity: 'high', migration_required: true, integration_count: 3 });
  const handoff = createAurentaraImplementationHandoffV1({
    decision,
    tenant_id: 'synthetic-tenant',
    business_id: 'synthetic-business',
    customer_goal: 'Migrate the CRM safely',
    problem_statement: 'Legacy CRM migration with integrations',
    business_context: { industry: 'synthetic' },
    existing_systems: ['Legacy CRM'],
    success_criteria: ['History preserved']
  });
  assert.equal(handoff.handoff_type, 'AURENTARA_PROFESSIONAL_IMPLEMENTATION');
  assert.equal(handoff.execution_authorized, false);
  assert.equal(handoff.production_deploy, false);
  assert.equal(handoff.project_blueprint.schema_version, 'riosystems.project-blueprint.v1');
  assert.ok(handoff.project_blueprint.factories.includes('business'));
});

test('existing router behavior is preserved for explicit capabilities', () => {
  const decision = classifyHamyrenCapabilityRequest({ activity: 'implementation', capability: 'automation', complexity: 'low' });
  assert.equal(decision.required_capability, 'automation_build');
  assert.equal(decision.routes[0].engine, 'automation');
});
