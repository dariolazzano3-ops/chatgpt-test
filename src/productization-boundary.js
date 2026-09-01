const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export const HAMYREN_AURENTARA_CAPABILITY_BOUNDARY_V1 = Object.freeze({
  schema_version: 'aurentara.hamyren-capability-boundary.v1',
  hamyren: Object.freeze({
    role: 'personal_business_ai',
    responsibilities: Object.freeze([
      'business_understanding',
      'business_memory',
      'analysis',
      'diagnosis',
      'strategy',
      'planning',
      'decision_support',
      'requirements',
      'implementation_specification'
    ])
  }),
  self_service: Object.freeze({
    role: 'standardized_low_complexity_execution',
    eligibility_separate_from_customer_availability: true,
    customer_activation_implicit: false
  }),
  aurentara_systems: Object.freeze({
    role: 'professional_implementation_and_business_systems_engine',
    responsibilities: Object.freeze([
      'complex_systems',
      'custom_architecture',
      'integration',
      'migration',
      'critical_production_execution',
      'multi_system_transformation'
    ])
  }),
  evolution_rule: 'move_capabilities_upward_through_policy_metadata_maturity_and_risk_thresholds_not_duplicate_architecture',
  production_deploy: false
});

export function defineTenantPlan(input = {}) {
  const tenantId = clean(input.tenant_id, 160);
  if (!tenantId) return { ok: false, error: 'TENANT_ID_REQUIRED' };
  return {
    ok: true,
    tenant: {
      schema_version: 'riosystems.tenant-plan.v1',
      tenant_id: tenantId,
      operator_model: input.operator_model === 'multi_operator' ? 'multi_operator' : 'single_operator',
      max_projects: Math.max(1, Number(input.max_projects || 1)),
      allowed_capabilities: [...new Set((input.allowed_capabilities || []).map((x) => clean(x, 160)).filter(Boolean))],
      billing_plan: clean(input.billing_plan, 120) || 'internal',
      data_scope: `tenant:${tenantId}`,
      production_deploy: false
    }
  };
}

export function evaluateProductizationReadiness(input = {}) {
  const checks = {
    tenant_isolation: input.tenant_isolation === true,
    tenant_scoped_approvals: input.tenant_scoped_approvals === true,
    tenant_scoped_costs: input.tenant_scoped_costs === true,
    tenant_scoped_audit: input.tenant_scoped_audit === true,
    onboarding_contract: input.onboarding_contract === true,
    offboarding_export_contract: input.offboarding_export_contract === true,
    role_model_defined: input.role_model_defined === true,
    billing_boundary_defined: input.billing_boundary_defined === true
  };
  const blockers = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  return { schema_version: 'riosystems.productization-readiness.v1', ready: blockers.length === 0, checks, blockers, public_signup_enabled: false, production_deploy: false };
}
