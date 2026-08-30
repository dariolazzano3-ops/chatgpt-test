const SCOPE = Object.freeze({
  customer_id: 'bakery-muller',
  project_id: 'digital-system-v1',
  project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
  scope_key: 'bakery-muller:digital-system-v1'
});

const TRACE_ID = 'block6-e2e-staging-001';
const FLOW_ID = 'block6-e2e-staging-001';
const CONTACT_REF = 'bakery-muller-digital-system-v1-block6-contact-001';
const LEAD_KEY = 'bakery-muller-digital-system-v1-block6-e2e-lead-001';

const clone = (value) => structuredClone(value ?? null);

export function bakeryMullerBlock6SyntheticLead() {
  return {
    schema: 'riosystems.synthetic-lead-envelope.v1',
    source: 'make-core',
    source_kind: 'automation',
    environment: 'staging',
    project_scope: SCOPE.scope_key,
    trace_id: TRACE_ID,
    contact: {
      external_ref: CONTACT_REF,
      email: 'block6.synthetic@example.invalid',
      full_name: 'Block 6 Synthetic Bakery Lead'
    },
    lead: {
      idempotency_key: LEAD_KEY,
      status: 'validated',
      message: 'Synthetic Block 6 end-to-end staging lead'
    },
    synthetic: true,
    real_customer_data: false,
    production: false
  };
}

export function buildBakeryMullerBlock6Plan(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.real_customer_data === true) {
    return { ok: false, error: 'BLOCK6_SYNTHETIC_STAGING_REQUIRED', production_deploy: false };
  }
  if (Number(input.max_variable_cost_eur) !== 0 || input.zero_cost_confirmed !== true) {
    return { ok: false, error: 'BLOCK6_ZERO_COST_CONFIRMATION_REQUIRED', production_deploy: false };
  }
  return {
    ok: true,
    schema: 'riosystems.bakery-muller-live-e2e-plan.v1',
    state: 'LIVE_STAGING_E2E_APPROVED_NOT_EXECUTED',
    scope: clone(SCOPE),
    trace_id: TRACE_ID,
    analytics_flow_id: FLOW_ID,
    synthetic_lead: bakeryMullerBlock6SyntheticLead(),
    path: ['website','make','supabase','posthog','cloudflare-workers-ai','qa','unified-delivery'],
    providers: {
      web: 'cloudflare-pages-staging',
      automation: 'make-core',
      crm: 'supabase-free',
      analytics: 'posthog-free',
      ai: 'cloudflare-workers-ai-free'
    },
    execution_rules: {
      website_read_before_lead: true,
      make_scenario_id: 7149691,
      make_restore_inactive_required: true,
      supabase_idempotency_required: true,
      posthog_max_events: 5,
      posthog_retries: 0,
      ai_model: '@cf/zai-org/glm-4.7-flash',
      ai_max_tokens: 4,
      openai_paid_fallback: false,
      provider_secrets_shared_across_jobs: false
    },
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    max_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function buildBakeryMullerBlock6Delivery(evidence = {}) {
  const web = evidence.web || {};
  const make = evidence.make || {};
  const supabase = evidence.supabase || {};
  const posthog = evidence.posthog || {};
  const ai = evidence.ai || {};
  const posthogCounts = posthog.event_counts || {};
  const checks = {
    web: web.ok === true && web.staging === true && Number(web.http_status) === 200,
    make: make.ok === true && Number(make.scenario_id) === 7149691 && Boolean(make.execution_id) && make.scenario_restored_inactive === true,
    supabase: supabase.ok === true && supabase.contact_count === 1 && supabase.lead_count === 1 && supabase.event_count === 1 && supabase.provider_ref_count === 1 && supabase.audit_count === 1,
    posthog: posthog.ok === true && posthog.event_count === 5 && posthog.flow_id === FLOW_ID && ['page_view','cta_clicked','lead_submitted','automation_started','lead_persisted'].every((event) => posthogCounts[event] === 1) && posthog.automation_failed_count === 0,
    ai: ai.ok === true && ai.http_status === 200 && ai.api_success === true && ai.model === '@cf/zai-org/glm-4.7-flash' && Number(ai.variable_cost_eur) === 0 && ai.openai_paid_fallback_used === false
  };
  const passed = Object.values(checks).every(Boolean);
  return {
    ok: passed,
    schema: 'riosystems.bakery-muller-live-e2e-delivery.v1',
    scope: clone(SCOPE),
    trace_id: TRACE_ID,
    flow_id: FLOW_ID,
    status: passed ? 'LIVE_STAGING_E2E_VERIFIED' : 'LIVE_STAGING_E2E_INCOMPLETE',
    checks,
    evidence: clone({ web, make, supabase, posthog, ai }),
    qa: {
      passed,
      required_checks: ['web','make','supabase','posthog','ai'],
      idempotency_key: LEAD_KEY,
      synthetic_only: true,
      zero_cost: true
    },
    variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function bakeryMullerBlock6Manifest() {
  return {
    schema: 'riosystems.bakery-muller-live-e2e-manifest.v1',
    scope: clone(SCOPE),
    trace_id: TRACE_ID,
    flow_id: FLOW_ID,
    lead_idempotency_key: LEAD_KEY,
    live_staging_providers: ['cloudflare-pages-staging','make-core','supabase-free','posthog-free','cloudflare-workers-ai-free'],
    qa_required: true,
    unified_delivery_required: true,
    synthetic_test_data_only: true,
    max_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
