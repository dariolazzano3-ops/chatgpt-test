const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

export const HAMYREN_FREE_QUESTION_LIMIT_V1 = 5;

export function hamyrenCustomerJourneyReadinessManifest() {
  return {
    schema: 'hamyren.customer-journey-readiness.v1',
    product_name: 'HAMYREN',
    tagline: 'Your Personal Business AI',
    maker: 'AURENTARA SYSTEMS',
    journey: [
      'visitor',
      'minimal_business_intake',
      'five_free_business_questions',
      'account_or_persistent_context_handoff',
      'subscription_readiness'
    ],
    minimal_intake_fields: ['name', 'business_name_or_idea', 'industry', 'current_objective', 'country_or_region'],
    country_or_region_required: false,
    free_business_question_limit: HAMYREN_FREE_QUESTION_LIMIT_V1,
    generic_chatbot_positioning: false,
    persistent_context_after_account: true,
    customer_operator_plane_separation: true,
    public_customer_surface_active: false,
    real_customer_ai_processing_active: false,
    billing_active: false,
    stripe_active: false,
    real_customer_data: false,
    variable_cost_eur: 0
  };
}

export function normalizeHamyrenMinimalIntake(input = {}) {
  const intake = {
    name: clean(input.name, 120),
    business_name_or_idea: clean(input.business_name_or_idea, 240),
    industry: clean(input.industry, 160),
    current_objective: clean(input.current_objective, 600),
    country_or_region: clean(input.country_or_region, 160) || null
  };
  const missing = ['name', 'business_name_or_idea', 'industry', 'current_objective'].filter((key) => !intake[key]);
  return {
    ok: missing.length === 0,
    schema: 'hamyren.minimal-business-intake-result.v1',
    intake,
    missing,
    data_class: 'customer_input',
    persistence_allowed: false,
    real_customer_processing_allowed: false
  };
}

export function createHamyrenFreeQuestionJourney(input = {}) {
  const intake = normalizeHamyrenMinimalIntake(input.intake || input);
  const used = Math.max(0, Math.min(HAMYREN_FREE_QUESTION_LIMIT_V1, Number(input.questions_used || 0) || 0));
  const remaining = HAMYREN_FREE_QUESTION_LIMIT_V1 - used;
  return {
    schema: 'hamyren.free-business-question-journey.v1',
    ok: intake.ok,
    intake,
    questions_used: used,
    questions_remaining: remaining,
    question_limit: HAMYREN_FREE_QUESTION_LIMIT_V1,
    may_ask_free_question: intake.ok && remaining > 0,
    next_step: !intake.ok
      ? 'COMPLETE_MINIMAL_BUSINESS_INTAKE'
      : remaining > 0
        ? 'ASK_BUSINESS_QUESTION'
        : 'ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF',
    account_creation_automatic: false,
    subscription_activation_automatic: false,
    public_activation_automatic: false,
    real_customer_ai_processing_automatic: false,
    operator_access: false,
    variable_cost_eur: 0
  };
}

export function evaluateHamyrenCustomerJourneyReadiness(input = {}) {
  const manifest = hamyrenCustomerJourneyReadinessManifest();
  const failures = [];
  if (manifest.free_business_question_limit !== 5) failures.push('FREE_QUESTION_LIMIT_INVALID');
  if (manifest.customer_operator_plane_separation !== true) failures.push('CUSTOMER_OPERATOR_SEPARATION_REQUIRED');
  if (manifest.public_customer_surface_active !== false) failures.push('PUBLIC_SURFACE_MUST_REMAIN_OFF');
  if (manifest.real_customer_ai_processing_active !== false) failures.push('REAL_CUSTOMER_AI_MUST_REMAIN_OFF');
  if (manifest.billing_active !== false || manifest.stripe_active !== false) failures.push('BILLING_MUST_REMAIN_OFF');
  if (input.operator_route_exposed === true) failures.push('OPERATOR_ROUTE_EXPOSURE_FORBIDDEN');
  return {
    schema: 'hamyren.customer-journey-readiness-result.v1',
    ok: failures.length === 0,
    failures,
    technical_journey_ready: failures.length === 0,
    required_operator_gates: ['legal_privacy_review', 'public_customer_surface', 'real_customer_ai_processing'],
    payment_gate_deferred: true,
    public_customer_surface_active: false,
    real_customer_ai_processing_active: false,
    real_customer_data: false,
    variable_cost_eur: 0
  };
}
