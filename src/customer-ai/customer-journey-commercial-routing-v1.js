import { HAMYREN_EXECUTION_CLASSES } from '../capability-router.js';
import { planCustomerCapabilityPathV1 } from './capability-policy-v1.js';
import { compileMissionPackage } from '../mission-compiler.js';
import { aggregateMissionDelivery } from '../mission-delivery-aggregator.js';

export const HAMYREN_CUSTOMER_JOURNEY_STATES = Object.freeze({
  UNDERSTAND: 'UNDERSTAND',
  ANALYZE: 'ANALYZE',
  RECOMMEND: 'RECOMMEND',
  PREPARE: 'PREPARE',
  SELF_SERVICE_AVAILABLE: 'SELF_SERVICE_AVAILABLE',
  AURENTARA_RECOMMENDED: 'AURENTARA_RECOMMENDED',
  SCOPE_PREPARED: 'SCOPE_PREPARED',
  CUSTOMER_REVIEW_REQUIRED: 'CUSTOMER_REVIEW_REQUIRED',
  COMMERCIAL_GATE: 'COMMERCIAL_GATE',
  IMPLEMENTATION_APPROVED: 'IMPLEMENTATION_APPROVED',
  MISSION_PREPARED: 'MISSION_PREPARED',
  IMPLEMENTATION_IN_PROGRESS: 'IMPLEMENTATION_IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  MONITORING: 'MONITORING'
});

export const HAMYREN_COMMERCIAL_ROUTES = Object.freeze({
  NO_COMMERCIAL_ACTION: 'NO_COMMERCIAL_ACTION',
  SELF_SERVICE_ACTION: 'SELF_SERVICE_ACTION',
  AURENTARA_ESTIMATE_REQUIRED: 'AURENTARA_ESTIMATE_REQUIRED',
  AURENTARA_SCOPE_REVIEW_REQUIRED: 'AURENTARA_SCOPE_REVIEW_REQUIRED',
  CUSTOM_QUOTE_REQUIRED: 'CUSTOM_QUOTE_REQUIRED',
  MANAGED_SERVICE_CANDIDATE: 'MANAGED_SERVICE_CANDIDATE'
});

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const list = (value) => Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
const unique = (values = []) => [...new Set(values.map((value) => typeof value === 'string' ? clean(value, 4000) : value).filter(Boolean))];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const yes = (value) => value === true;
const clone = (value) => structuredClone(value ?? null);

function isProfessional(decision = {}) {
  return decision.implementation_execution_class === HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED;
}

function isImplementationRequested(decision = {}) {
  return ['implementation', 'execution', 'build', 'deploy'].includes(clean(decision.activity, 80).toLowerCase());
}

function selfServiceCustomerEnabled(decision = {}) {
  return decision.implementation_execution_class === HAMYREN_EXECUTION_CLASSES.SELF_SERVICE
    && decision.self_service_eligible === true
    && decision.implementation_availability === 'CUSTOMER_ENABLED';
}

function commercialRouteFor(decision = {}, input = {}) {
  if (!isImplementationRequested(decision)) return HAMYREN_COMMERCIAL_ROUTES.NO_COMMERCIAL_ACTION;

  if (decision.implementation_execution_class === HAMYREN_EXECUTION_CLASSES.SELF_SERVICE) {
    return selfServiceCustomerEnabled(decision)
      ? HAMYREN_COMMERCIAL_ROUTES.SELF_SERVICE_ACTION
      : HAMYREN_COMMERCIAL_ROUTES.NO_COMMERCIAL_ACTION;
  }

  if (!isProfessional(decision)) return HAMYREN_COMMERCIAL_ROUTES.NO_COMMERCIAL_ACTION;
  if (yes(input.managed_service_requested) || yes(input.recurring_management_requested)) {
    return HAMYREN_COMMERCIAL_ROUTES.MANAGED_SERVICE_CANDIDATE;
  }
  if (list(input.open_questions).length > 0) {
    return HAMYREN_COMMERCIAL_ROUTES.AURENTARA_SCOPE_REVIEW_REQUIRED;
  }
  if (
    decision.complexity === 'high'
    || decision.complexity === 'critical'
    || decision.requirements?.migration_required === true
    || decision.requirements?.custom_code_required === true
    || list(decision.required_capabilities).length > 1
  ) {
    return HAMYREN_COMMERCIAL_ROUTES.CUSTOM_QUOTE_REQUIRED;
  }
  return HAMYREN_COMMERCIAL_ROUTES.AURENTARA_ESTIMATE_REQUIRED;
}

function routeOutcome(decision = {}) {
  if (!isImplementationRequested(decision)) return 'HAMYREN_DIRECT';
  if (isProfessional(decision)) return 'AURENTARA_PROFESSIONAL';
  if (decision.implementation_execution_class === HAMYREN_EXECUTION_CLASSES.SELF_SERVICE) {
    return selfServiceCustomerEnabled(decision) ? 'HAMYREN_SELF_SERVICE' : 'SELF_SERVICE_NOT_AVAILABLE';
  }
  return decision.decision_status === 'NEEDS_INFORMATION' ? 'NEEDS_INFORMATION' : 'HAMYREN_DIRECT';
}

function initialState(outcome, decision = {}) {
  if (outcome === 'HAMYREN_DIRECT') return HAMYREN_CUSTOMER_JOURNEY_STATES.RECOMMEND;
  if (outcome === 'HAMYREN_SELF_SERVICE') return HAMYREN_CUSTOMER_JOURNEY_STATES.SELF_SERVICE_AVAILABLE;
  if (outcome === 'SELF_SERVICE_NOT_AVAILABLE') return HAMYREN_CUSTOMER_JOURNEY_STATES.PREPARE;
  if (outcome === 'AURENTARA_PROFESSIONAL') return HAMYREN_CUSTOMER_JOURNEY_STATES.CUSTOMER_REVIEW_REQUIRED;
  if (decision.decision_status === 'NEEDS_INFORMATION') return HAMYREN_CUSTOMER_JOURNEY_STATES.UNDERSTAND;
  return HAMYREN_CUSTOMER_JOURNEY_STATES.RECOMMEND;
}

function journeyTrail(outcome) {
  const base = [
    HAMYREN_CUSTOMER_JOURNEY_STATES.UNDERSTAND,
    HAMYREN_CUSTOMER_JOURNEY_STATES.ANALYZE,
    HAMYREN_CUSTOMER_JOURNEY_STATES.RECOMMEND
  ];
  if (outcome === 'HAMYREN_DIRECT') return base;
  if (outcome === 'HAMYREN_SELF_SERVICE') return [...base, HAMYREN_CUSTOMER_JOURNEY_STATES.PREPARE, HAMYREN_CUSTOMER_JOURNEY_STATES.SELF_SERVICE_AVAILABLE];
  if (outcome === 'SELF_SERVICE_NOT_AVAILABLE') return [...base, HAMYREN_CUSTOMER_JOURNEY_STATES.PREPARE];
  if (outcome === 'AURENTARA_PROFESSIONAL') return [
    ...base,
    HAMYREN_CUSTOMER_JOURNEY_STATES.AURENTARA_RECOMMENDED,
    HAMYREN_CUSTOMER_JOURNEY_STATES.SCOPE_PREPARED,
    HAMYREN_CUSTOMER_JOURNEY_STATES.CUSTOMER_REVIEW_REQUIRED
  ];
  return [HAMYREN_CUSTOMER_JOURNEY_STATES.UNDERSTAND];
}

function securityConsiderations(input = {}, decision = {}) {
  const values = [...list(input.security_considerations)];
  if (decision.requirements?.security_sensitive) values.push('Security-sensitive implementation');
  if (decision.requirements?.customer_data_required) values.push('Customer data is involved');
  if (decision.requirements?.credential_required) values.push('Credentials are required');
  if (decision.requirements?.external_write_required) values.push('External systems may be changed');
  if (decision.requirements?.production_required) values.push('Production activation is required');
  return unique(values);
}

export function buildAurentaraImplementationBriefV1(input = {}, capabilityPath = null) {
  const path = capabilityPath || input.capability_path || planCustomerCapabilityPathV1(input);
  const decision = path?.decision || {};
  const handoff = path?.handoff || null;
  if (!handoff || !isProfessional(decision)) return null;

  return {
    schema_version: 'aurentara.customer-implementation-brief.v1',
    tenant_id: handoff.tenant_id,
    business_id: handoff.business_id,
    customer_goal: handoff.customer_goal,
    problem: handoff.problem_statement,
    business_context: clone(handoff.business_context || {}),
    recommended_solution: handoff.recommended_solution,
    required_capabilities: clone(handoff.required_capabilities || []),
    scope: clone(handoff.scope || {}),
    priorities: clone(handoff.priorities || []),
    constraints: clone(handoff.constraints || []),
    current_systems: clone(handoff.existing_systems || []),
    integrations: clone(handoff.integration_requirements || []),
    migration_requirements: clone(handoff.migration_requirements || []),
    data_requirements: clone(handoff.data_requirements || []),
    security_considerations: securityConsiderations(input, decision),
    risk_level: handoff.risk_class,
    complexity: handoff.complexity,
    success_criteria: clone(handoff.success_criteria || []),
    known_assumptions: clone(list(input.known_assumptions)),
    open_questions: clone(handoff.open_questions || []),
    recommended_implementation_path: 'AURENTARA_PROFESSIONAL_IMPLEMENTATION',
    commercial_review_requirement: true,
    canonical_capability_decision: clone(decision),
    canonical_handoff: clone(handoff),
    project_blueprint: clone(handoff.project_blueprint),
    execution_status: 'planned_only',
    execution_authorized: false,
    binding_quote_created: false,
    payment_requested: false,
    production_deploy: false
  };
}

function customerReviewFor(input, decision, outcome, implementationBrief, commercialRoute) {
  const goal = clean(input.customer_goal || input.goal || input.message || input.prompt, 4000);
  const recommendation = clean(decision.customer_message, 4000);
  const currentSystems = unique([
    ...list(input.existing_systems),
    ...list(implementationBrief?.current_systems)
  ]);
  const integrations = unique([
    ...list(input.integration_requirements).map((item) => typeof item === 'string' ? item : JSON.stringify(item)),
    ...list(implementationBrief?.integrations).map((item) => typeof item === 'string' ? item : JSON.stringify(item))
  ]);
  const data = unique([
    ...list(input.data_requirements).map((item) => typeof item === 'string' ? item : JSON.stringify(item)),
    ...(decision.requirements?.customer_data_required ? ['Customer data'] : [])
  ]);
  const changes = [];
  if (decision.requirements?.migration_required) changes.push('Existing data or system state will need migration.');
  if (decision.requirements?.external_write_required) changes.push('Connected external systems may be changed after approval.');
  if (decision.requirements?.production_required) changes.push('A production change is part of the requested implementation.');
  if (!changes.length && isImplementationRequested(decision)) changes.push('Only the approved implementation scope will be changed.');

  let nextStep = 'Continue the analysis and planning with HAMYREN.';
  if (outcome === 'HAMYREN_SELF_SERVICE') nextStep = 'Review the standardized Self-Service scope and required approvals before any execution.';
  if (outcome === 'SELF_SERVICE_NOT_AVAILABLE') nextStep = 'Keep the scope prepared. Customer Self-Service execution is not enabled, so no execution will start.';
  if (outcome === 'AURENTARA_PROFESSIONAL') nextStep = 'Review the prepared scope. After customer and commercial/operator approval, HAMYREN can prepare the existing AURENTARA mission flow.';
  if (decision.decision_status === 'NEEDS_INFORMATION') nextStep = 'Provide only the missing implementation details needed to classify the execution path.';

  return {
    what_we_understood: goal || implementationBrief?.customer_goal || null,
    what_we_recommend: recommendation || null,
    what_will_be_built: implementationBrief?.recommended_solution || clean(input.recommended_solution, 4000) || (isImplementationRequested(decision) ? goal : null),
    what_will_change: changes,
    data_and_systems_involved: {
      systems: currentSystems,
      integrations,
      data
    },
    what_requires_approval: unique([
      ...list(decision.required_approvals),
      ...(commercialRoute !== HAMYREN_COMMERCIAL_ROUTES.NO_COMMERCIAL_ACTION && commercialRoute !== HAMYREN_COMMERCIAL_ROUTES.SELF_SERVICE_ACTION ? ['commercial_operator_review'] : [])
    ]),
    what_remains_unknown: clone(list(input.open_questions)),
    next_step: nextStep
  };
}

function contextReuseSummary(input = {}) {
  const businessContext = object(input.business_context);
  const knownKeys = Object.keys(businessContext).filter((key) => businessContext[key] !== undefined && businessContext[key] !== null);
  return {
    business_context_reused: knownKeys.length > 0,
    reused_context_fields: knownKeys,
    repeated_questions_required: false,
    additional_information_requested: clone(list(input.open_questions)),
    memory_write_performed: false
  };
}

export function buildHamyrenCustomerJourneyV1(input = {}) {
  const capabilityPath = input.capability_path || planCustomerCapabilityPathV1(input);
  const decision = capabilityPath?.decision || {};
  const outcome = routeOutcome(decision);
  const commercialRoute = commercialRouteFor(decision, input);
  const implementationBrief = buildAurentaraImplementationBriefV1(input, capabilityPath);
  const state = initialState(outcome, decision);

  return {
    schema_version: 'hamyren-aurentara.customer-journey.v1',
    tenant_id: capabilityPath?.tenant_id || clean(input.tenant_id, 160) || 'default',
    business_id: capabilityPath?.business_id || clean(input.business_id, 160) || null,
    customer_goal: clean(input.customer_goal || input.goal || input.message || input.prompt, 4000) || null,
    current_state: state,
    journey_trail: journeyTrail(outcome),
    outcome,
    capability_path: clone(capabilityPath),
    implementation_brief: implementationBrief,
    commercial: {
      route: commercialRoute,
      operator_review_required: [
        HAMYREN_COMMERCIAL_ROUTES.AURENTARA_ESTIMATE_REQUIRED,
        HAMYREN_COMMERCIAL_ROUTES.AURENTARA_SCOPE_REVIEW_REQUIRED,
        HAMYREN_COMMERCIAL_ROUTES.CUSTOM_QUOTE_REQUIRED,
        HAMYREN_COMMERCIAL_ROUTES.MANAGED_SERVICE_CANDIDATE
      ].includes(commercialRoute),
      final_price_defined: false,
      binding_quote_created: false,
      billing_enabled: false,
      payment_collected: false
    },
    customer_review: customerReviewFor(input, decision, outcome, implementationBrief, commercialRoute),
    context_reuse: contextReuseSummary(input),
    execution: {
      customer_execution_enabled: outcome === 'HAMYREN_SELF_SERVICE',
      execution_authorized: false,
      external_writes_executed: false,
      production_deploy: false
    }
  };
}

function commercialApprovalRequired(journey = {}) {
  return journey.commercial?.operator_review_required === true;
}

export function prepareAurentaraMissionHandoffV1(input = {}) {
  const journey = input.journey;
  if (!journey || journey.schema_version !== 'hamyren-aurentara.customer-journey.v1') {
    return { ok: false, error: 'CUSTOMER_JOURNEY_REQUIRED', execution_authorized: false, production_deploy: false };
  }
  if (journey.outcome !== 'AURENTARA_PROFESSIONAL' || !journey.implementation_brief) {
    return { ok: false, error: 'AURENTARA_PROFESSIONAL_PATH_REQUIRED', execution_authorized: false, production_deploy: false };
  }

  const approvals = object(input.approvals);
  const missing = [];
  if (!yes(approvals.customer_scope_approved)) missing.push('customer_scope_approval');
  if (commercialApprovalRequired(journey) && !yes(approvals.commercial_review_approved)) missing.push('commercial_review_approval');
  if (!yes(approvals.operator_implementation_approved)) missing.push('operator_implementation_approval');
  if (missing.length) {
    return {
      ok: false,
      error: 'IMPLEMENTATION_APPROVALS_REQUIRED',
      current_state: commercialApprovalRequired(journey)
        ? HAMYREN_CUSTOMER_JOURNEY_STATES.COMMERCIAL_GATE
        : HAMYREN_CUSTOMER_JOURNEY_STATES.CUSTOMER_REVIEW_REQUIRED,
      missing_approvals: missing,
      execution_authorized: false,
      production_deploy: false
    };
  }

  const brief = journey.implementation_brief;
  const prompt = unique([
    brief.customer_goal,
    brief.problem,
    brief.recommended_solution,
    ...list(brief.required_capabilities).map((item) => `Required capability: ${item}`)
  ]).join('\n');

  const compiled = compileMissionPackage({
    prompt,
    project: clean(input.project || input.project_slug, 120) || null,
    project_name: clean(input.project_name, 120) || null,
    source_of_truth: object(input.source_of_truth)
  });
  if (!compiled.ok) {
    return {
      ok: false,
      error: compiled.error || 'MISSION_COMPILATION_FAILED',
      compiler_result: compiled,
      execution_authorized: false,
      production_deploy: false
    };
  }

  return {
    ok: true,
    schema_version: 'aurentara.hamyren-mission-handoff.v1',
    tenant_id: journey.tenant_id,
    business_id: journey.business_id,
    current_state: HAMYREN_CUSTOMER_JOURNEY_STATES.MISSION_PREPARED,
    customer_journey_reference: {
      schema_version: journey.schema_version,
      customer_goal: journey.customer_goal,
      commercial_route: journey.commercial.route
    },
    implementation_brief: clone(brief),
    mission_package: compiled.package,
    approvals_recorded: {
      customer_scope_approved: true,
      commercial_review_approved: commercialApprovalRequired(journey) ? true : null,
      operator_implementation_approved: true
    },
    downstream_gates_preserved: true,
    mission_execution_authorized: false,
    external_writes_executed: false,
    production_deploy: false
  };
}

export function prepareHamyrenPostDeliveryContinuationV1(input = {}) {
  const journey = input.journey;
  if (!journey || journey.schema_version !== 'hamyren-aurentara.customer-journey.v1') {
    return { ok: false, error: 'CUSTOMER_JOURNEY_REQUIRED', memory_write_performed: false, production_deploy: false };
  }

  let report = input.delivery_report || null;
  if (!report && input.mission) report = aggregateMissionDelivery(input.mission, { activation: input.activation });
  if (!report?.ok || report.delivery_version !== 'mission.delivery.v1') {
    return { ok: false, error: 'VALID_MISSION_DELIVERY_REQUIRED', memory_write_performed: false, production_deploy: false };
  }

  const brief = journey.implementation_brief || {};
  const delivered = report.deliveries.filter((item) => item.completed).map((item) => ({
    task_id: item.task_id,
    capability: item.capability,
    engine: item.engine,
    delivery_kind: item.delivery_kind,
    evidence: clone(item.evidence)
  }));

  return {
    ok: true,
    schema_version: 'hamyren.post-delivery-continuation.v1',
    tenant_id: journey.tenant_id,
    business_id: journey.business_id,
    current_state: report.structural_completion
      ? HAMYREN_CUSTOMER_JOURNEY_STATES.MONITORING
      : HAMYREN_CUSTOMER_JOURNEY_STATES.IMPLEMENTATION_IN_PROGRESS,
    delivery_reference: {
      mission_id: report.mission_id,
      orchestration_id: report.orchestration_id,
      mission_status: report.mission_status,
      completion_class: report.completion_class
    },
    business_state_update_candidate: {
      implemented: delivered,
      implementation_reason: brief.customer_goal || journey.customer_goal,
      success_criteria: clone(brief.success_criteria || []),
      monitoring_targets: clone(brief.success_criteria || []),
      unresolved: clone(report.unresolved || [])
    },
    hamyren_context_continuation: {
      what_was_implemented: delivered,
      why_it_was_implemented: brief.problem || brief.customer_goal || journey.customer_goal,
      success_criteria: clone(brief.success_criteria || []),
      what_to_monitor: clone(brief.success_criteria || []),
      next_role: 'continue_advising_and_monitoring'
    },
    memory_adapter: {
      target: 'existing_hamyren_business_memory',
      persistence_interface_present_in_this_block: false,
      payload_prepared_only: true,
      duplicate_memory_created: false
    },
    memory_write_performed: false,
    external_writes_executed: false,
    production_deploy: false
  };
}

export function customerJourneyCommercialRoutingManifestV1() {
  return {
    version: 'hamyren-aurentara.customer-journey.v1',
    capability_policy_reused: true,
    capability_router_reimplemented: false,
    mission_compiler_reused: true,
    mission_delivery_aggregator_reused: true,
    duplicate_memory_created: false,
    commercial_prices_defined: false,
    billing_enabled: false,
    payments_enabled: false,
    public_customer_activation: false,
    external_write_execution: false,
    production_deploy: false
  };
}
