export function automationFactoryV1Manifest() {
  return {
    schema: 'riosystems.automation-factory.v1',
    status: 'READY_SYNTHETIC_STAGING',
    mission_contract: true,
    workflow_planner: true,
    provider_router: true,
    action_contracts: true,
    safe_execution_engine: true,
    make_bridge_integrated: true,
    idempotency: true,
    retry_repair: true,
    provider_fallback: 'approval_gated',
    observability: true,
    approval_engine: true,
    cost_control: { variable_cost_ceiling_eur: 0, automatic_paid_overflow: false },
    delivery_manifest: true,
    reference_workflows: ['bakery_muller_lead_intake', 'scheduled_file_processing'],
    business_flow_support: ['lead_intake','crm_sync','form_to_crm','crm_to_email','webhook_to_make','make_to_supabase','supabase_to_analytics','scheduled_follow_up','ai_assisted_workflow'],
    provider_hierarchy: {
      primary: 'make-core',
      secondary: 'activepieces-cloud-free',
      specialist: 'n8n-client-owned',
      small_code: 'cloudflare-workers-free',
      deterministic: 'riosystems-native-automation'
    },
    hard_safety: {
      production: false,
      real_customer_data: false,
      mass_email: false,
      payments: false,
      paid_execution: false,
      automatic_paid_overflow: false,
      existing_make_scenarios: 'DO_NOT_TOUCH'
    }
  };
}
