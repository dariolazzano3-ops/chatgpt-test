import { evaluateMakeSupabaseLeadBridgeExecution } from './make-supabase-lead-bridge.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

function validMakeResult(result, plan) {
  return result?.ok === true
    && Number(result.scenario_id) === Number(plan.providers?.automation?.verified_scenario_id)
    && clean(result.execution_id, 160).length > 0
    && result.scenario_restored_inactive === true
    && result.synthetic_test_data_only === true
    && result.synthetic_payload?.synthetic === true
    && result.synthetic_payload?.project_scope === plan.scope?.scope_key;
}

function validPersistence(result) {
  return result?.ok === true
    && Number(result.lead_count) === 1
    && Number(result.lead_event_count) === 1
    && Number(result.provider_ref_count) === 1
    && Number(result.audit_count) === 1
    && result.synthetic_only === true
    && result.idempotent === true;
}

export async function runMakeSupabaseLeadBridgeOnce(plan = {}, approvals = {}, runtime = {}) {
  const gate = evaluateMakeSupabaseLeadBridgeExecution(plan, approvals);
  if (!gate.ok || gate.execution_ready !== true) return { ...gate, production_deploy: false };
  if (runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (typeof runtime.run_make !== 'function' || typeof runtime.persist_supabase !== 'function') return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_RUNTIME_REQUIRED', production_deploy: false };

  let makeResult;
  try {
    makeResult = await runtime.run_make({ scope: clone(plan.scope), input: clone(plan.bridge_contract.input), scenario_id: plan.providers.automation.verified_scenario_id });
  } catch (error) {
    return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_MAKE_FAILED', message: clean(error?.message), supabase_write_performed: false, production_deploy: false };
  }
  if (!validMakeResult(makeResult, plan)) {
    return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_MAKE_RESULT_REJECTED', supabase_write_performed: false, make_result: clone(makeResult), production_deploy: false };
  }

  const request = {
    scope: clone(plan.scope),
    input: clone(plan.bridge_contract.input),
    make: {
      scenario_id: Number(makeResult.scenario_id),
      execution_id: clean(makeResult.execution_id, 160),
      execution_status: clean(makeResult.execution_status, 80) || null,
      scenario_restored_inactive: true
    }
  };

  let persist = null;
  let attempts = 0;
  let lastError = null;
  while (attempts < 2) {
    attempts += 1;
    try {
      persist = await runtime.persist_supabase(clone(request));
      if (validPersistence(persist)) break;
      lastError = clean(persist?.error || 'SUPABASE_PERSISTENCE_NOT_VERIFIED');
      if (persist?.retryable !== true) break;
    } catch (error) {
      lastError = clean(error?.message || 'SUPABASE_PERSISTENCE_FAILED');
    }
  }

  if (!validPersistence(persist)) {
    return {
      ok: false,
      error: 'MAKE_SUPABASE_BRIDGE_PERSIST_FAILED',
      attempts,
      dead_letter: {
        required: true,
        scope_key: plan.scope.scope_key,
        idempotency_key: plan.bridge_contract.input.lead.idempotency_key,
        make_execution_id: request.make.execution_id,
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
    scope_key: plan.scope.scope_key,
    idempotency_key: plan.bridge_contract.input.lead.idempotency_key,
    make_scenario_id: request.make.scenario_id,
    make_execution_id: request.make.execution_id,
    scenario_restored_inactive: true,
    lead_count: 1,
    lead_event_count: 1,
    provider_ref_count: 1,
    audit_count: 1,
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

export function makeSupabaseLeadBridgeExecutorManifest() {
  return {
    schema: 'riosystems.make-supabase-lead-bridge-executor.v1',
    make_must_restore_inactive_before_persist: true,
    max_supabase_persist_attempts: 2,
    dead_letter_required: true,
    idempotency_required: true,
    cross_provider_secret_sharing: false,
    synthetic_test_data_only: true,
    zero_variable_cost_required: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
