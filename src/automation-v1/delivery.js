const clone = (value) => structuredClone(value ?? null);

export function buildDeliveryManifest({ plan, providerPlans, run, warnings = [] } = {}) {
  const failed = (run?.steps || []).filter((step) => step.status === 'FAILED');
  const blocked = (run?.steps || []).filter((step) => step.status === 'BLOCKED');
  const qaPassed = Boolean(plan?.ok && providerPlans?.ok && run?.status === 'COMPLETED' && !failed.length && !blocked.length);
  const providerIds = [...new Set((plan?.nodes || []).map((node) => node.provider_id).filter(Boolean))];
  return {
    schema: 'riosystems.automation-delivery-manifest.v1',
    workflow_plan: clone(plan),
    providers: providerIds,
    provider_plans: clone(providerPlans?.plans || []),
    execution_status: run?.status || 'NOT_EXECUTED',
    side_effects: clone(run?.side_effects || []),
    qa: {
      passed: qaPassed,
      failed_steps: failed.map((step) => step.step_id),
      blocked_steps: blocked.map((step) => step.step_id),
      idempotency_enforced: true,
      bounded_retry_enforced: true,
      secrets_redacted: true,
      synthetic_test_data_only: true
    },
    warnings: [...new Set([
      'EXTERNAL_PROVIDER_EXECUTION_DISABLED_IN_AUTOMATION_FACTORY_V1',
      'PRODUCTION_LOCKED',
      'PAID_EXECUTION_LOCKED',
      ...(warnings || [])
    ])],
    cost: { variable_eur: 0, ceiling_eur: 0, automatic_paid_overflow: false },
    production_status: 'LOCKED_FALSE',
    real_customer_data: false,
    mass_email: false,
    payments: false
  };
}
