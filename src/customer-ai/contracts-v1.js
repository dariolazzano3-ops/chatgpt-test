const freeze = (value) => Object.freeze(value);

export const MEMORY_STATUSES = freeze({
  CONFIRMED_FACT: 'CONFIRMED_FACT',
  INFERRED_INFORMATION: 'INFERRED_INFORMATION',
  TEMPORARY_CONTEXT: 'TEMPORARY_CONTEXT',
  HISTORICAL_FACT: 'HISTORICAL_FACT',
  OUTDATED_INFORMATION: 'OUTDATED_INFORMATION'
});

export const MEMORY_CANDIDATE_STATUSES = freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  NEEDS_CONFIRMATION: 'needs_confirmation'
});

export const MEMORY_CATEGORIES = freeze([
  'BUSINESS_PROFILE', 'OWNER_PREFERENCE', 'PRODUCT_SERVICE', 'FINANCE', 'CUSTOMER',
  'EMPLOYEE', 'OPERATIONS', 'MARKETING', 'SYSTEM', 'GOAL_RELATED', 'DECISION_RELATED', 'OTHER'
]);

export const GOAL_STATUSES = freeze(['PROPOSED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']);
export const DECISION_STATUSES = freeze(['RECORDED', 'REVIEW_DUE', 'OUTCOME_RECORDED', 'SUPERSEDED']);

export const CUSTOMER_AI_COLLECTIONS = freeze([
  'business', 'memory-facts', 'memory-candidates', 'goals', 'decisions', 'audit', 'deletion-jobs'
]);

export function normalizeTenantScope(input = {}) {
  const tenantId = String(input.tenant_id || '').trim().slice(0, 120);
  const businessId = String(input.business_id || '').trim().slice(0, 120);
  if (!tenantId) return { ok: false, error: 'TENANT_SCOPE_REQUIRED' };
  if (!businessId) return { ok: false, error: 'BUSINESS_SCOPE_REQUIRED' };
  return { ok: true, tenant_id: tenantId, business_id: businessId, scope: `${tenantId}:${businessId}` };
}

export function semanticRetrievalContract(input = {}) {
  const scope = normalizeTenantScope(input);
  if (!scope.ok) return scope;
  return {
    ok: true,
    contract: 'aurentara.customer-ai.semantic-retrieval.v1',
    tenant_id: scope.tenant_id,
    business_id: scope.business_id,
    pre_filter_required: true,
    allowed_query_scope: { tenant_id: scope.tenant_id, business_id: scope.business_id },
    forbidden_pattern: 'GLOBAL_SEARCH_THEN_POST_FILTER',
    vector_infrastructure_active: false,
    production_deploy: false
  };
}

export function truthPrecedence(memory = {}) {
  if (memory.deleted_at) return -1000;
  const status = String(memory.status || '');
  const statusScore = {
    CONFIRMED_FACT: 500,
    INFERRED_INFORMATION: 250,
    TEMPORARY_CONTEXT: 100,
    HISTORICAL_FACT: -100,
    OUTDATED_INFORMATION: -200
  }[status] ?? 0;
  const sourceScore = {
    structured_business_input: 80,
    imported_system: 70,
    user_statement: 60,
    document: 50,
    system_derived_event: 40,
    external_source: 30,
    ai_inference: 0
  }[String(memory.source_type || '')] ?? 10;
  const confirmedScore = memory.last_confirmed_at ? 20 : 0;
  return statusScore + sourceScore + confirmedScore;
}

export function customerAiFoundationManifest() {
  return {
    version: 'aurentara.personal-business-ai.foundation.v1',
    brand: 'AURENTARA SYSTEMS',
    internal_category: 'PERSONAL_BUSINESS_OPERATING_INTELLIGENCE',
    customer_data_plane: 'separate_from_operator_control_plane',
    share_engine_not_cockpit: true,
    operator_credentials_reused: false,
    paid_provider_required: false,
    production_deploy: false,
    vector_retrieval: { active: false, tenant_pre_filter_contract: true },
    privacy: { export_ready: true, deletion_plan_ready: true, memory_correction: true },
    truth_rule: 'confirmed_current_facts_outrank_inference_and_superseded_history'
  };
}
