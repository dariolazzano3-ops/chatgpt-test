const clone = (value) => JSON.parse(JSON.stringify(value));
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const uniq = (items = []) => [...new Set((Array.isArray(items) ? items : [items]).map((item) => clean(item, 160)).filter(Boolean))];

export const FERRARI_CAPABILITIES_V1 = Object.freeze([
  'web_presence',
  'lead_capture',
  'business_crm',
  'automation_followup',
  'analytics',
  'ai_assistance'
]);

export const CUSTOMER_FEEDBACK_TYPES_V1 = Object.freeze([
  'BUG',
  'QUALITY_GAP',
  'CONTENT_CORRECTION',
  'REVISION',
  'SCOPE_EXPANSION'
]);

const CONFIRMED_SCOPE_STATES = new Set(['HUMAN_CONFIRMED', 'CUSTOMER_CONFIRMED']);
const READY_SOURCE_STATES = new Set(['READY', 'READY_WITH_WARNINGS']);
const READY_RIGHTS_STATES = new Set(['READY', 'READY_WITH_WARNINGS']);

function normalizeStatus(value, fallback) {
  return clean(value, 80).toUpperCase() || fallback;
}

function hasUsefulObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
}

function providedInputKeys(input = {}) {
  if (Array.isArray(input.available_customer_inputs)) return new Set(uniq(input.available_customer_inputs));
  if (Array.isArray(input.customer_inputs)) return new Set(uniq(input.customer_inputs));
  const source = input.customer_inputs && typeof input.customer_inputs === 'object' ? input.customer_inputs : {};
  return new Set(Object.entries(source).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([key]) => clean(key, 160)).filter(Boolean));
}

export function draftFerrariRequirementsFromCustomerWish(customerWish = '') {
  const wish = clean(customerWish, 4000);
  const text = wish.toLowerCase();
  const capabilities = new Set();

  const wantsWebsite = /(website|webseite|seite|homepage|webauftritt|landingpage|landing page)/i.test(text);
  const wantsLeads = /(anfragen|anfrage|leads?|kontakte?|kunden gewinnen|mehr kunden|kontaktformular|formular)/i.test(text);
  const wantsCrm = /(crm|pipeline|lead status|lead-status|kundenverwaltung|anfragen verwalten)/i.test(text);
  const wantsAutomation = /(automation|automatis|follow.?up|nachfass|bestätigung|bestaetigung)/i.test(text);
  const wantsAnalytics = /(analytics|analyse|tracking|messen|conversion|auswertung)/i.test(text);
  const wantsAi = /(\bki\b|\bai\b|chatbot|assistent)/i.test(text);

  if (wantsWebsite) capabilities.add('web_presence');
  if (wantsLeads) {
    capabilities.add('web_presence');
    capabilities.add('lead_capture');
    capabilities.add('business_crm');
    capabilities.add('automation_followup');
    capabilities.add('analytics');
  }
  if (wantsCrm) capabilities.add('business_crm');
  if (wantsAutomation) capabilities.add('automation_followup');
  if (wantsAnalytics) capabilities.add('analytics');
  if (wantsAi) capabilities.add('ai_assistance');

  return {
    schema: 'aurentara.ferrari-requirements-draft.v1',
    customer_wish: wish || null,
    requested_capabilities: [...capabilities],
    authoritative: false,
    scope_confirmation_required: true,
    production_deploy: false,
    paid_provider_calls_authorized: false
  };
}

export function createCustomerDeliveryContractV1(input = {}) {
  const customerId = clean(input.customer_id, 160);
  const projectId = clean(input.project_id, 160);
  if (!customerId || !projectId) return { ok: false, error: 'CUSTOMER_DELIVERY_IDENTITY_REQUIRED', production_deploy: false };

  const expectedScopeKey = `${customerId}:${projectId}`;
  const scopeKey = clean(input.scope_key, 320) || expectedScopeKey;
  if (scopeKey !== expectedScopeKey) return { ok: false, error: 'CUSTOMER_DELIVERY_SCOPE_MISMATCH', expected_scope_key: expectedScopeKey, production_deploy: false };

  const customerProblem = clean(input.customer_problem || input.customer_wish || input.objective || input.prompt || input.goal, 4000);
  const discoveryDraft = draftFerrariRequirementsFromCustomerWish(customerProblem);
  const requestedCapabilities = uniq(input.requested_capabilities?.length ? input.requested_capabilities : discoveryDraft.requested_capabilities);
  const requiredCapabilities = uniq(input.required_capabilities?.length ? input.required_capabilities : requestedCapabilities);
  const optionalCapabilities = uniq(input.optional_capabilities);
  const excludedCapabilities = uniq(input.excluded_capabilities);

  const requiredCustomerInputs = uniq(input.required_customer_inputs);
  const available = providedInputKeys(input);
  const explicitMissing = input.missing_inputs === undefined ? null : uniq(input.missing_inputs);
  const missingInputs = explicitMissing ?? requiredCustomerInputs.filter((key) => !available.has(key));

  const contract = {
    schema: 'aurentara.customer-delivery-contract.v1',
    customer_id: customerId,
    project_id: projectId,
    scope_key: scopeKey,
    customer_problem: customerProblem || null,
    desired_outcomes: uniq(input.desired_outcomes),
    business_profile: hasUsefulObject(input.business_profile) ? clone(input.business_profile) : null,
    requested_capabilities: requestedCapabilities,
    required_capabilities: requiredCapabilities,
    optional_capabilities: optionalCapabilities,
    excluded_capabilities: excludedCapabilities,
    required_customer_inputs: requiredCustomerInputs,
    missing_inputs: missingInputs,
    human_decisions_required: uniq(input.human_decisions_required),
    source_readiness: normalizeStatus(input.source_readiness, 'NOT_ASSESSED'),
    rights_readiness: normalizeStatus(input.rights_readiness, 'NOT_ASSESSED'),
    provider_plan: hasUsefulObject(input.provider_plan) ? clone(input.provider_plan) : null,
    cost_preflight: hasUsefulObject(input.cost_preflight) ? clone(input.cost_preflight) : null,
    quality_contract: hasUsefulObject(input.quality_contract) ? clone(input.quality_contract) : null,
    acceptance_criteria: uniq(input.acceptance_criteria),
    customer_review_required: input.customer_review_required !== false,
    production_approval_required: input.production_approval_required !== false,
    delivery_definition: hasUsefulObject(input.delivery_definition) ? clone(input.delivery_definition) : null,
    scope_confirmation_status: normalizeStatus(input.scope_confirmation_status, 'DRAFT_UNCONFIRMED'),
    current_status: normalizeStatus(input.current_status, 'DRAFT'),
    discovery: discoveryDraft,
    safety: {
      production_deploy: false,
      public_launch: false,
      dns_changes: false,
      billing: false,
      automatic_paid_provider_calls: false,
      uncontrolled_external_writes: false,
      automatic_customer_communication: false
    }
  };

  return {
    ok: true,
    contract,
    readiness: evaluateCustomerDeliveryContractV1(contract),
    production_deploy: false
  };
}

export function evaluateCustomerDeliveryContractV1(contract = {}) {
  if (contract?.schema !== 'aurentara.customer-delivery-contract.v1') {
    return { ok: false, error: 'CUSTOMER_DELIVERY_CONTRACT_REQUIRED', ready_for_build: false, production_deploy: false };
  }

  const blockers = [];
  if (!clean(contract.customer_id, 160) || !clean(contract.project_id, 160) || !clean(contract.scope_key, 320)) blockers.push('PROJECT_SCOPE_REQUIRED');
  if (!clean(contract.customer_problem, 4000)) blockers.push('CUSTOMER_PROBLEM_REQUIRED');
  if (!Array.isArray(contract.desired_outcomes) || contract.desired_outcomes.length === 0) blockers.push('DESIRED_OUTCOMES_REQUIRED');
  if (!Array.isArray(contract.required_capabilities) || contract.required_capabilities.length === 0) blockers.push('REQUIRED_CAPABILITIES_REQUIRED');
  if ((contract.missing_inputs || []).length > 0) blockers.push('REQUIRED_CUSTOMER_INPUTS_MISSING');
  if (!READY_SOURCE_STATES.has(normalizeStatus(contract.source_readiness, 'NOT_ASSESSED'))) blockers.push('SOURCE_READINESS_REQUIRED');
  if (!READY_RIGHTS_STATES.has(normalizeStatus(contract.rights_readiness, 'NOT_ASSESSED'))) blockers.push('RIGHTS_READINESS_REQUIRED');
  if (!hasUsefulObject(contract.provider_plan)) blockers.push('PROVIDER_PLAN_REQUIRED');
  if (!hasUsefulObject(contract.cost_preflight)) blockers.push('COST_PREFLIGHT_REQUIRED');
  if (!hasUsefulObject(contract.quality_contract)) blockers.push('QUALITY_CONTRACT_REQUIRED');
  if (!Array.isArray(contract.acceptance_criteria) || contract.acceptance_criteria.length === 0) blockers.push('ACCEPTANCE_CRITERIA_REQUIRED');
  if (!hasUsefulObject(contract.delivery_definition)) blockers.push('DELIVERY_DEFINITION_REQUIRED');
  if (!CONFIRMED_SCOPE_STATES.has(normalizeStatus(contract.scope_confirmation_status, 'DRAFT_UNCONFIRMED'))) blockers.push('SCOPE_CONFIRMATION_REQUIRED');

  return {
    ok: true,
    schema: 'aurentara.customer-delivery-contract-readiness.v1',
    scope_key: contract.scope_key,
    ready_for_build: blockers.length === 0,
    blockers,
    scope_drift_blocked: true,
    delivery_without_acceptance_blocked: true,
    production_without_approval_blocked: true,
    production_deploy: false
  };
}

export function classifyCustomerFeedbackV1(input = {}) {
  const type = normalizeStatus(input.type, '');
  if (!CUSTOMER_FEEDBACK_TYPES_V1.includes(type)) {
    return { ok: false, error: 'CUSTOMER_FEEDBACK_TYPE_INVALID', allowed_types: [...CUSTOMER_FEEDBACK_TYPES_V1], production_deploy: false };
  }

  const scopeExpansion = type === 'SCOPE_EXPANSION';
  return {
    ok: true,
    feedback: {
      schema: 'aurentara.customer-feedback-classification.v1',
      type,
      summary: clean(input.summary || input.feedback, 4000) || null,
      normal_revision_eligible: !scopeExpansion,
      requires_scope_reassessment: scopeExpansion,
      requires_cost_reestimate: scopeExpansion,
      requires_new_approval: scopeExpansion,
      production_deploy: false
    }
  };
}

export function customerDeliveryContractV1Manifest() {
  return {
    schema: 'aurentara.customer-delivery-contract.v1',
    customer_wish_to_draft_requirements: true,
    draft_is_authoritative: false,
    scope_confirmation_required: true,
    missing_input_detection: true,
    scope_expansion_separate_from_revision: true,
    customer_review_required_by_default: true,
    production_approval_required_by_default: true,
    production_deploy: false,
    automatic_paid_provider_calls: false
  };
}
