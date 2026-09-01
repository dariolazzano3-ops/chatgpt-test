import { HAMYREN_EXECUTION_CLASSES, classifyHamyrenCapabilityRequest } from '../capability-router.js';
import { compileProjectBlueprint } from '../project-blueprint.js';

const clean = (value, max = 12000) => String(value || '').trim().slice(0, max);
const unique = (values = []) => [...new Set(values.map((value) => clean(value, 4000)).filter(Boolean))];

export function createAurentaraImplementationHandoffV1(input = {}) {
  const decision = input.decision;
  if (!decision || decision.implementation_execution_class !== HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED) return null;
  const customerGoal = clean(input.customer_goal, 4000) || 'Professional AURENTARA implementation';
  const problemStatement = clean(input.problem_statement, 4000);
  const blueprintResult = compileProjectBlueprint({ objective: [customerGoal, problemStatement].filter(Boolean).join('\n') });

  return {
    schema_version: 'aurentara.hamyren-implementation-handoff.v1',
    handoff_type: 'AURENTARA_PROFESSIONAL_IMPLEMENTATION',
    tenant_id: clean(input.tenant_id, 160) || 'default',
    business_id: clean(input.business_id, 160) || null,
    customer_goal: customerGoal,
    problem_statement: problemStatement || null,
    business_context: input.business_context || {},
    recommended_solution: clean(input.recommended_solution, 4000) || null,
    required_capabilities: [...decision.required_capabilities],
    execution_routes: [...decision.routes],
    scope: input.scope || {},
    constraints: unique(input.constraints || []),
    existing_systems: unique(input.existing_systems || []),
    integration_requirements: input.integration_requirements || [],
    migration_requirements: input.migration_requirements || [],
    data_requirements: input.data_requirements || [],
    complexity: decision.complexity,
    risk_class: decision.risk_class,
    cost_class: decision.cost_class,
    priorities: input.priorities || [],
    success_criteria: input.success_criteria || [],
    open_questions: input.open_questions || [],
    required_approvals: [...decision.required_approvals],
    execution_constraints: [...decision.execution_constraints],
    recommended_service_category: 'professional_implementation',
    project_blueprint: blueprintResult.ok ? blueprintResult.blueprint : null,
    execution_status: 'planned_only',
    execution_authorized: false,
    production_deploy: false
  };
}

export function planCustomerCapabilityPathV1(input = {}) {
  const decision = classifyHamyrenCapabilityRequest({
    ...(input.requirements || {}),
    intent: input.intent || 'BUSINESS_ADVICE',
    activity: input.activity,
    prompt: input.message || input.prompt || input.customer_goal,
    capability: input.capability,
    required_capabilities: input.required_capabilities || []
  });
  const handoff = createAurentaraImplementationHandoffV1({ ...input, decision });
  return {
    schema_version: 'aurentara.customer-ai.capability-decision.v1',
    tenant_id: clean(input.tenant_id, 160) || 'default',
    business_id: clean(input.business_id, 160) || null,
    decision,
    handoff,
    execution_status: 'planned_only',
    execution_authorized: false,
    external_writes_executed: false,
    production_deploy: false
  };
}

export function customerCapabilityPolicyManifestV1() {
  return {
    version: 'hamyren-aurentara-capability-policy.v1',
    responsibility_classes: Object.values(HAMYREN_EXECUTION_CLASSES),
    thinking_and_execution_separated: true,
    customer_availability_separate_from_eligibility: true,
    project_blueprint_reused_for_handoff: true,
    professional_handoff_prepared_only: true,
    production_deploy: false,
    external_write_execution: false
  };
}
