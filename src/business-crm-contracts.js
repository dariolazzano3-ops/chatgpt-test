function clean(value, max = 300) { return String(value ?? '').trim().slice(0, max); }

export function buildAutomationFactoryEnvelope(input = {}) {
  if (!input.project_id || !input.business_run_id || !input.operation || !input.idempotency_key) return { ok: false, error: 'AUTOMATION_CRM_CONTRACT_INVALID' };
  return {
    ok: true,
    envelope: {
      schema: 'riosystems.crm-automation-contract.v1',
      project_id: clean(input.project_id, 64),
      business_run_id: clean(input.business_run_id, 100),
      operation: clean(input.operation, 100),
      resource_type: clean(input.resource_type, 60),
      resource_id: clean(input.resource_id, 120),
      idempotency_key: clean(input.idempotency_key, 160),
      payload: structuredClone(input.payload || {}),
      guardrails: { staging_only: true, synthetic_test_data_only: true, max_variable_cost_eur: 0, production: false }
    }
  };
}

export function buildAiFactoryLeadInput(lead = {}, context = {}) {
  if (!lead.project_id || !lead.id) return { ok: false, error: 'AI_CRM_LEAD_SCOPE_REQUIRED' };
  return {
    ok: true,
    input: {
      schema: 'riosystems.crm-ai-input.v1',
      project_id: clean(lead.project_id, 64),
      lead_id: clean(lead.id, 120),
      source: clean(lead.source, 80),
      status: clean(lead.status, 80),
      score: Number.isFinite(Number(lead.score)) ? Number(lead.score) : null,
      last_activity: clean(lead.last_activity || lead.last_activity_at, 80) || null,
      next_action: clean(lead.next_action, 200) || null,
      requested_tasks: ['lead_summary', 'classification', 'next_action', 'enrichment'],
      context: {
        industry: clean(context.industry, 120),
        pipeline_stage: clean(context.pipeline_stage, 80),
        synthetic: context.synthetic === true
      },
      pii_policy: 'direct_contact_fields_excluded_by_default'
    }
  };
}

export function buildWebFactoryLeadContract(input = {}) {
  if (!input.project_id || !input.idempotency_key || !input.source) return { ok: false, error: 'WEB_CRM_LEAD_CONTRACT_INVALID' };
  if (input.synthetic !== true) return { ok: false, error: 'WEB_CRM_V1_SYNTHETIC_ONLY' };
  return {
    ok: true,
    contract: {
      schema: 'riosystems.web-crm-lead.v1',
      project_id: clean(input.project_id, 64),
      idempotency_key: clean(input.idempotency_key, 160),
      source: clean(input.source, 80),
      form_id: clean(input.form_id, 100),
      fields: structuredClone(input.fields || {}),
      event_type: 'form_submitted',
      synthetic: true,
      production: false
    }
  };
}
