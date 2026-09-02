const RESOLUTIONS = Object.freeze({
  'base44': Object.freeze({
    provider_id: 'base44',
    strategic_role: 'full_stack_app_portal_specialist',
    maturity_level: 'L0',
    final_classification: 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED',
    central_connection_required: false,
    account_state: 'NOT_EVIDENCED_IN_APPROVED_RUNTIME',
    credential_state: 'NOT_BOUND',
    connected: false,
    verification: 'OFFICIAL_MODEL_AUDITED_NO_AUTHENTICATED_PROVIDER_REQUEST',
    routing_ready: false,
    architecture_reason: 'external_sdk_requires_app_specific_user_auth_while_service_role_is_only_available_inside_base44_hosted_backend_functions',
    intended_usage: 'mission_specific_supervised_app_builder_or_backend_specialist',
    official_model: Object.freeze({
      sdk: '@base44/sdk',
      external_client_requires_app_id: true,
      external_service_role_available: false,
      cli_device_code_login_available: true,
      free_plan_available: true,
      backend_beta_free: true,
      documentation: Object.freeze([
        'https://docs.base44.com/developers/references/sdk/getting-started/client',
        'https://docs.base44.com/developers/references/cli/commands/login',
        'https://base44.com/pricing'
      ])
    }),
    operator_gate: null,
    provider_requests: 0,
    provider_writes: 0,
    variable_cost_eur: 0
  }),
  'activepieces-cloud-free': Object.freeze({
    provider_id: 'activepieces-cloud-free',
    strategic_role: 'secondary_automation_runtime',
    maturity_level: 'L0',
    final_classification: 'OPERATOR_GATE',
    central_connection_required: true,
    account_state: 'NOT_EVIDENCED_IN_APPROVED_RUNTIME',
    instance_state: 'NOT_BOUND',
    credential_state: 'NOT_BOUND',
    connected: false,
    verification: 'OFFICIAL_API_AUDITED_NO_AUTHENTICATED_PROVIDER_REQUEST',
    routing_ready: false,
    architecture_reason: 'secondary_only_make_remains_primary',
    official_model: Object.freeze({
      api_available: true,
      authentication: 'bearer_api_key',
      read_only_verification: 'GET /api/v1/projects',
      free_plan_available: true,
      pricing_page_states_api_access_in_free_plan: true,
      api_docs_state_platform_dashboard_key_requirement: true,
      documentation_tension_requires_operator_ui_confirmation: true,
      documentation: Object.freeze([
        'https://www.activepieces.com/docs/endpoints/overview',
        'https://www.activepieces.com/docs/endpoints/projects/list',
        'https://www.activepieces.com/pricing'
      ])
    }),
    operator_gate: 'SIGN_IN_EXISTING_OR_FREE_ACCOUNT_CONFIRM_API_KEY_GENERATION_THEN_BIND_ACTIVEPIECES_API_KEY_AND_INSTANCE_PROJECT_REFERENCE_IF_ZERO_COST',
    provider_requests: 0,
    provider_writes: 0,
    variable_cost_eur: 0
  }),
  'webflow-api': Object.freeze({
    provider_id: 'webflow-api',
    strategic_role: 'specialist_visual_cms_platform',
    maturity_level: 'L3',
    final_classification: 'CONNECTED_STAGING',
    central_connection_required: true,
    account_state: 'READY',
    site_state: 'ACCESSIBLE',
    credential_state: 'PRESENT_VALID',
    connected: true,
    verification: 'PROTECTED_STAGING_RUNTIME_READ_ONLY_GET_V2_SITES_VERIFIED',
    routing_ready: false,
    architecture_reason: 'specialist_only_native_web_factory_framer_and_cloudflare_remain_primary',
    official_model: Object.freeze({
      api_available: true,
      authentication: 'bearer_site_token_or_oauth',
      workspace_token_enterprise_only: true,
      site_token_supports_read_only_scopes: true,
      read_only_verification: 'GET /v2/sites',
      required_scope: 'sites:read',
      free_starter_workspace_and_site_available: true,
      documentation: Object.freeze([
        'https://developers.webflow.com/data/reference/authentication',
        'https://developers.webflow.com/data/reference/sites/list',
        'https://help.webflow.com/hc/en-us/articles/33961356296723-Intro-to-Webflow-s-APIs',
        'https://help.webflow.com/hc/en-us/articles/33961232582419-Choose-a-Site-plan'
      ])
    }),
    operator_gate: null,
    provider_requests: 1,
    provider_writes: 0,
    variable_cost_eur: 0
  }),
  'lovable-github': Object.freeze({
    provider_id: 'lovable-github',
    strategic_role: 'rapid_product_web_accelerator',
    maturity_level: 'L0',
    final_classification: 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED',
    central_connection_required: false,
    account_state: 'NOT_REQUIRED_FOR_CENTRAL_RUNTIME',
    credential_state: 'NOT_BOUND',
    connected: false,
    verification: 'OFFICIAL_AUTOMATION_MODEL_AUDITED_NO_AUTHENTICATED_PROVIDER_REQUEST',
    routing_ready: false,
    architecture_reason: 'official_build_with_url_triggers_app_creation_and_mcp_is_research_preview_not_a_stable_read_only_provider_control_api',
    intended_usage: 'supervised_builder_and_github_handoff_when_a_mission_explicitly_requires_lovable',
    official_model: Object.freeze({
      build_with_url_api: 'open_beta_write_oriented',
      mcp_server: 'research_preview',
      github_sync: 'two_way_project_sync',
      stable_read_only_central_provider_api: false,
      free_plan_available: true,
      documentation: Object.freeze([
        'https://docs.lovable.dev/integrations/lovable-api',
        'https://docs.lovable.dev/integrations/build-with-url',
        'https://docs.lovable.dev/integrations/github',
        'https://lovable.dev/pricing'
      ])
    }),
    operator_gate: null,
    provider_requests: 0,
    provider_writes: 0,
    variable_cost_eur: 0
  }),
  'n8n-client-owned': Object.freeze({
    provider_id: 'n8n-client-owned',
    strategic_role: 'customer_owned_technical_specialist_runtime',
    maturity_level: 'L0',
    final_classification: 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED',
    central_connection_required: false,
    customer_owned_strategy: true,
    account_state: 'PER_CUSTOMER_WHEN_REQUIRED',
    instance_state: 'PER_CUSTOMER_WHEN_REQUIRED',
    credential_state: 'PER_INSTANCE_WHEN_REQUIRED',
    connected: false,
    verification: 'OFFICIAL_INSTANCE_AND_LICENSE_MODEL_AUDITED_NO_AUTHENTICATED_PROVIDER_REQUEST',
    routing_ready: false,
    architecture_reason: 'central_shared_hosting_of_client_workflows_or_credentials_can_require_commercial_licensing_while consulting_on_client_owned_instances_is_supported_without_a_central_dependency',
    intended_usage: 'connect_per_customer_instance_only_when_complex_technical_workflow_requires_n8n',
    official_model: Object.freeze({
      instance_api_available: true,
      authentication: 'X-N8N-API-KEY',
      self_host_available: true,
      cloud_available: true,
      commercial_license_risk_for_centrally_hosted_client_workflows: true,
      client_owned_consulting_path_supported: true,
      documentation: Object.freeze([
        'https://n8n.io/pricing/',
        'https://support.n8n.io/article/can-i-use-your-license-for-my-use-case',
        'https://docs.n8n.io/source-control-environments/create-environments/'
      ])
    }),
    operator_gate: null,
    provider_requests: 0,
    provider_writes: 0,
    variable_cost_eur: 0
  })
});

export function remainingProviderFastLaneEvidence() {
  return structuredClone(RESOLUTIONS);
}

export function remainingProviderResolution(providerId) {
  return structuredClone(RESOLUTIONS[providerId] || null);
}

export function remainingProviderFastLaneManifest() {
  const providers = Object.values(RESOLUTIONS);
  return {
    schema: 'aurentara.remaining-provider-fast-lane-evidence.v1',
    verified_at: '2026-09-01',
    providers: structuredClone(providers),
    provider_requests: providers.reduce((sum, item) => sum + item.provider_requests, 0),
    provider_writes: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    secrets_exposed: false,
    total_new_paid_cost_eur: 0
  };
}
