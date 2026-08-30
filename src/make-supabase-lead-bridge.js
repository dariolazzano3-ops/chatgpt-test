const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCOPE_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const EXTERNAL_REF_RE = /^[a-z0-9][a-z0-9-]{2,100}$/;
const CONFIRMATION = 'RUN_MAKE_SUPABASE_STAGING_ONCE';

export function bakeryMullerSyntheticLead() {
  return {
    external_ref: 'block3-lead-001',
    full_name: 'Synthetic Bakery Lead',
    email: 'block3-lead-001@example.invalid',
    message: 'Synthetic staging lead for Make to Supabase bridge verification.',
    source: 'website-staging',
    synthetic: true
  };
}

function validLead(lead = {}) {
  return EXTERNAL_REF_RE.test(clean(lead.external_ref, 120))
    && clean(lead.full_name, 160).length > 0
    && clean(lead.email, 220).toLowerCase().endsWith('@example.invalid')
    && clean(lead.source, 80) === 'website-staging'
    && lead.synthetic === true;
}

export function buildMakeSupabaseLeadBridgePlan(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const scopeKey = clean(input.scope_key, 180).toLowerCase();
  const projectUuid = clean(input.supabase_project_uuid, 80);
  const scenarioId = Number(input.make_scenario_id);
  const lead = clone(input.lead || bakeryMullerSyntheticLead());
  const blockers = [];

  if (!SCOPE_RE.test(scopeKey)) blockers.push({ code: 'BRIDGE_SCOPE_INVALID' });
  if (!UUID_RE.test(projectUuid)) blockers.push({ code: 'SUPABASE_PROJECT_UUID_INVALID' });
  if (!Number.isSafeInteger(scenarioId) || scenarioId <= 0) blockers.push({ code: 'MAKE_SCENARIO_ID_REQUIRED' });
  if (!validLead(lead)) blockers.push({ code: 'SYNTHETIC_LEAD_REQUIRED' });
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.real_customer_data === true) blockers.push({ code: 'SYNTHETIC_STAGING_ONLY_REQUIRED' });
  if (Number(input.max_variable_cost_eur) !== 0) blockers.push({ code: 'ZERO_COST_REQUIRED' });

  const idempotencyKey = blockers.length === 0 ? `make-supabase:${scopeKey}:${lead.external_ref}` : null;
  return {
    ok: true,
    schema: 'riosystems.make-supabase-lead-bridge-plan.v1',
    state: blockers.length === 0 ? 'BRIDGE_PLAN_READY_NOT_EXECUTED' : 'BLOCKED',
    blockers,
    scope_key: scopeKey || null,
    supabase_project_uuid: UUID_RE.test(projectUuid) ? projectUuid : null,
    make_scenario_id: Number.isSafeInteger(scenarioId) && scenarioId > 0 ? scenarioId : null,
    lead,
    idempotency_key: idempotencyKey,
    stages: ['make_process_synthetic_lead','validate_make_result','supabase_idempotent_persist','verify_crm_and_audit'],
    max_persist_attempts: 2,
    dead_letter_on_persist_failure: true,
    make_restore_inactive_required: true,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    max_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    execution_authorized: false,
    production_deploy: false
  };
}

function canonicalize(plan = {}) {
  return buildMakeSupabaseLeadBridgePlan({
    scope_key: plan.scope_key,
    supabase_project_uuid: plan.supabase_project_uuid,
    make_scenario_id: plan.make_scenario_id,
    lead: plan.lead,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    max_variable_cost_eur: 0,
    production_deploy: false
  });
}

function samePlan(plan, canonical) {
  return canonical.state === 'BRIDGE_PLAN_READY_NOT_EXECUTED'
    && plan.schema === canonical.schema
    && plan.state === canonical.state
    && plan.scope_key === canonical.scope_key
    && plan.supabase_project_uuid === canonical.supabase_project_uuid
    && plan.make_scenario_id === canonical.make_scenario_id
    && plan.idempotency_key === canonical.idempotency_key
    && JSON.stringify(plan.lead) === JSON.stringify(canonical.lead)
    && plan.max_persist_attempts === 2
    && plan.dead_letter_on_persist_failure === true
    && plan.make_restore_inactive_required === true
    && plan.staging_only === true
    && plan.synthetic_test_data_only === true
    && plan.real_customer_data === false
    && Number(plan.max_variable_cost_eur) === 0
    && plan.automatic_paid_overflow === false
    && plan.execution_authorized === false
    && plan.production_deploy === false;
}

function makeResultAccepted(result, plan) {
  return result?.ok === true
    && Number(result.scenario_id) === plan.make_scenario_id
    && result.scenario_restored_inactive === true
    && result.synthetic_test_data_only === true
    && clean(result.execution_id, 160).length > 0;
}

function persistenceAccepted(result) {
  return result?.ok === true
    && Number(result.lead_count) === 1
    && Number(result.audit_count) === 1
    && Number(result.provider_ref_count) === 1
    && result.synthetic_only === true
    && result.idempotent === true;
}

export async function runMakeSupabaseLeadBridge(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const canonical = canonicalize(plan);
  if (!samePlan(plan, canonical)) return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_PLAN_TAMPERED', production_deploy: false };
  if (runtime.confirmation !== CONFIRMATION) return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_CONFIRMATION_REQUIRED', production_deploy: false };
  if (runtime.external_write_execution_approved !== true || runtime.supervised_execution_approved !== true) return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.staging_only !== true || runtime.synthetic_test_data_only !== true || runtime.real_customer_data === true) return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_STAGING_ONLY_REQUIRED', production_deploy: false };
  if (runtime.zero_cost_confirmed !== true || Number(runtime.max_variable_cost_eur) !== 0) return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_ZERO_COST_REQUIRED', production_deploy: false };
  if (typeof runtime.run_make !== 'function' || typeof runtime.persist_supabase !== 'function') return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_EXECUTORS_REQUIRED', production_deploy: false };

  let makeResult;
  try {
    makeResult = await runtime.run_make({
      scenario_id: plan.make_scenario_id,
      scope_key: plan.scope_key,
      lead: clone(plan.lead),
      idempotency_key: plan.idempotency_key
    });
  } catch (error) {
    return { ok: false, error: 'MAKE_BRIDGE_EXECUTION_FAILED', message: clean(error?.message, 300), supabase_write_performed: false, production_deploy: false };
  }
  if (!makeResultAccepted(makeResult, plan)) {
    return { ok: false, error: 'MAKE_BRIDGE_RESULT_REJECTED', make_result: clone(makeResult), supabase_write_performed: false, production_deploy: false };
  }

  const persistRequest = {
    project_uuid: plan.supabase_project_uuid,
    scope_key: plan.scope_key,
    idempotency_key: plan.idempotency_key,
    lead: clone(plan.lead),
    make: {
      scenario_id: plan.make_scenario_id,
      execution_id: clean(makeResult.execution_id, 160),
      execution_status: clean(makeResult.execution_status, 80) || null,
      scenario_restored_inactive: true
    }
  };

  let persistResult = null;
  let attempts = 0;
  let lastError = null;
  while (attempts < plan.max_persist_attempts) {
    attempts += 1;
    try {
      persistResult = await runtime.persist_supabase(clone(persistRequest));
      if (persistenceAccepted(persistResult)) break;
      lastError = clean(persistResult?.error || 'SUPABASE_BRIDGE_PERSIST_VERIFY_REJECTED', 200);
      if (persistResult?.retryable !== true) break;
    } catch (error) {
      lastError = clean(error?.message || 'SUPABASE_BRIDGE_PERSIST_FAILED', 300);
    }
  }

  if (!persistenceAccepted(persistResult)) {
    return {
      ok: false,
      error: 'SUPABASE_BRIDGE_PERSIST_FAILED',
      attempts,
      dead_letter: {
        required: true,
        scope_key: plan.scope_key,
        idempotency_key: plan.idempotency_key,
        make_execution_id: persistRequest.make.execution_id,
        reason: lastError || 'PERSISTENCE_NOT_VERIFIED'
      },
      make_execution_succeeded: true,
      scenario_restored_inactive: true,
      external_side_effect_performed: true,
      production_deploy: false
    };
  }

  return {
    ok: true,
    schema: 'riosystems.make-supabase-lead-bridge-result.v1',
    stage: 'MAKE_TO_SUPABASE_SYNTHETIC_LEAD_VERIFIED',
    scope_key: plan.scope_key,
    idempotency_key: plan.idempotency_key,
    make_scenario_id: plan.make_scenario_id,
    make_execution_id: persistRequest.make.execution_id,
    scenario_restored_inactive: true,
    lead_count: 1,
    audit_count: 1,
    provider_ref_count: 1,
    persist_attempts: attempts,
    idempotent: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    variable_cost_eur: 0,
    automatic_paid_overflow: false,
    external_side_effect_performed: true,
    production_deploy: false
  };
}

export function makeSupabaseLeadBridgeManifest() {
  return {
    schema: 'riosystems.make-supabase-lead-bridge.v1',
    providers: ['make-core','supabase-free'],
    capability: 'website.lead_to_crm',
    orchestration: 'riosystems_supervised_provider_chain',
    direct_cross_provider_secret_sharing: false,
    make_restore_inactive_required: true,
    idempotency_required: true,
    bounded_persist_attempts: 2,
    dead_letter_required_on_failure: true,
    synthetic_test_data_only: true,
    explicit_external_write_approval_required: true,
    supervised_execution_required: true,
    zero_cost_required: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
