const arr = (v) => Array.isArray(v) ? v : [];
const text = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const STANDARD_WEBSITE_EVENTS = Object.freeze([
  'page_view','cta_clicked','form_started','form_submitted','lead_created_request','booking_clicked','phone_clicked','email_clicked','download_clicked'
]);

export function createMigrationPlan(input = {}) {
  const sources = {
    existing_website_url:text(input.existing_website_url || '', 500) || null,
    existing_html_present:Boolean(text(input.existing_html || '', 20)),
    screenshots:arr(input.screenshots).map((item) => ({ reference_id:text(item?.reference_id || item,120), rights_status:text(item?.rights_status || 'unknown',80) })),
    structured_content_dump_present:Boolean(input.structured_content_dump && typeof input.structured_content_dump === 'object')
  };
  const inventory = arr(input.structured_content_dump?.pages).map((page, index) => ({
    content_id:text(page?.content_id || `content-${index + 1}`,120),
    source_path:text(page?.source_path || page?.path || '/',300),
    title:text(page?.title || '',300),
    content_type:text(page?.content_type || 'page',120),
    migrate_copy:page?.migrate_copy !== false,
    rights_status:text(page?.rights_status || 'unknown',80),
    asset_ids:arr(page?.asset_ids).map(String)
  }));
  const unsafe = inventory.filter((item) => item.rights_status === 'unknown');
  return {
    schema:'riosystems.web-migration-plan.v1',
    status:sources.existing_website_url || sources.existing_html_present || sources.screenshots.length || sources.structured_content_dump_present ? 'READY_FOR_STAGED_ANALYSIS' : 'NOT_REQUESTED',
    sources,
    content_inventory:inventory,
    design_structure_audit:{ required:true, external_fetch_executed:false, screenshot_runtime_executed:false },
    modernization_plan:['Preserve verified business-critical content','Rebuild structure and presentation in RIOSYSTEMS-owned code','Replace unlicensed or rights-uncertain assets','Run SEO/accessibility/CRO/visual QA before staging'],
    rights_gate:{ status:unsafe.length ? 'REVIEW_REQUIRED' : 'PASS', unknown_content:unsafe.map((item) => item.content_id), unverified_asset_reuse_allowed:false },
    production_deploy:false
  };
}

export function createBusinessIntegrationPlan(mission = {}, input = {}) {
  const providers = { crm:text(input.crm || 'business-factory',120), automation:text(input.automation || 'automation-factory',120), data:text(input.data || 'supabase',120), analytics:text(input.analytics || 'posthog',120), qualification:text(input.qualification || 'ai-factory',120), support:text(input.support || 'support-contract',120) };
  const hooks = [
    { hook_id:'lead_capture', source:'contact_form', emits:'lead_created_request', target:'business-factory', payload_schema:'riosystems.standardized-lead-event.v1', execution_owner:'business-factory' },
    { hook_id:'crm_handoff', source:'lead_created_request', emits:'crm_upsert_request', target:providers.crm, payload_schema:'riosystems.crm-handoff.v1', execution_owner:'business-factory' },
    { hook_id:'automation_handoff', source:'lead_created_request', emits:'automation_request', target:providers.automation, payload_schema:'riosystems.automation-handoff.v1', execution_owner:'automation-factory' },
    { hook_id:'analytics', source:'standard_website_events', emits:'privacy_safe_analytics_event', target:providers.analytics, payload_schema:'riosystems.web-analytics-event.v1', execution_owner:'analytics-provider-adapter' },
    { hook_id:'qualification', source:'lead_created_request', emits:'qualification_request', target:providers.qualification, payload_schema:'riosystems.ai-qualification-request.v1', execution_owner:'ai-factory' }
  ];
  return {
    schema:'riosystems.web-business-integration-plan.v1', status:'CONTRACTS_READY', providers, hooks,
    standard_events:STANDARD_WEBSITE_EVENTS.map((event) => ({ event, personal_data_default:false, allowed_context:['project_id','page_id','cta_id','variant_id','timestamp_bucket'], raw_form_payload_in_analytics:false })),
    canonical_flow:['contact_form','lead_created_request','business-factory','supabase','automation-factory','make','posthog_event'],
    cross_factory_execution:false,
    web_factory_scope:'contracts_and_hooks_only',
    real_customer_data:false,
    external_writes:false,
    mass_email:false,
    payments:false
  };
}

export function createExperimentContract(input = {}) {
  return {
    schema:'riosystems.web-experiment-contract.v1',
    variant_id:text(input.variant_id || 'variant-draft',120),
    experiment_goal:text(input.experiment_goal || 'improve_conversion_clarity',300),
    metric:text(input.metric || 'cta_clicked',120),
    traffic_split:input.traffic_split ?? null,
    result:null,
    winner:null,
    confidence:null,
    rollout_status:'DRAFT_NO_PRODUCTION_ROLLOUT',
    result_provider:'posthog_candidate',
    automatic_production_switch:false
  };
}
