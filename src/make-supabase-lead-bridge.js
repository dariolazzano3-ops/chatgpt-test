import { isMakeLiveStagingVerified, makeLiveStagingActivationEvidence } from './make-live-staging-evidence.js';
import { buildSupabaseStagingCrmWritePlan } from './business-staging-write-plan.js';
import { businessStagingWriteEvidence, isBusinessStagingWriteVerified } from './business-staging-write-evidence.js';

const SCOPE = Object.freeze({
  customer_id: 'bakery-muller',
  project_id: 'digital-system-v1',
  project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
  scope_key: 'bakery-muller:digital-system-v1'
});

const CONFIRMATIONS = Object.freeze({
  bridge: 'RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE',
  make: 'RUN_STAGING_ONCE',
  supabase: 'APPLY_SUPABASE_STAGING_CRM_ONCE'
});

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

function exactScope(input = {}) {
  const scope = {
    customer_id: clean(input.customer_id || SCOPE.customer_id, 80).toLowerCase(),
    project_id: clean(input.project_id || SCOPE.project_id, 80).toLowerCase(),
    project_uuid: clean(input.project_uuid || SCOPE.project_uuid, 80).toLowerCase()
  };
  scope.scope_key = `${scope.customer_id}:${scope.project_id}`;
  return scope;
}

function scopeMatches(scope) {
  return scope.customer_id === SCOPE.customer_id
    && scope.project_id === SCOPE.project_id
    && scope.project_uuid === SCOPE.project_uuid
    && scope.scope_key === SCOPE.scope_key;
}

export function canonicalMakeSupabaseSyntheticLead() {
  return {
    schema: 'riosystems.synthetic-lead-envelope.v1',
    source: 'make-core',
    source_kind: 'automation',
    environment: 'staging',
    project_scope: SCOPE.scope_key,
    contact: {
      external_ref: 'bakery-muller-digital-system-v1-synthetic-contact-001',
      email: 'synthetic.lead@example.invalid',
      full_name: 'Synthetic Bakery Lead'
    },
    lead: {
      idempotency_key: 'bakery-muller-digital-system-v1-synthetic-lead-001',
      status: 'validated',
      message: 'Synthetic Make to Supabase staging lead only'
    },
    synthetic: true,
    real_customer_data: false,
    production: false
  };
}

export function buildMakeSupabaseLeadBridgePlan(input = {}) {
  if (input.production_deploy === true) {
    return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  }

  const scope = exactScope(input);
  if (!scopeMatches(scope)) {
    return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_SCOPE_REJECTED', expected_scope: clone(SCOPE), production_deploy: false };
  }
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.real_customer_data === true) {
    return { ok: false, error: 'MAKE_SUPABASE_BRIDGE_SYNTHETIC_STAGING_REQUIRED', production_deploy: false };
  }

  const makeEvidence = makeLiveStagingActivationEvidence();
  const supabaseEvidence = businessStagingWriteEvidence();
  const blockers = [];
  if (!isMakeLiveStagingVerified()) blockers.push({ code: 'MAKE_STAGING_VERIFICATION_REQUIRED' });
  if (!isBusinessStagingWriteVerified()) blockers.push({ code: 'SUPABASE_STAGING_FOUNDATION_VERIFICATION_REQUIRED' });
  if (makeEvidence.scenario?.production_deploy === true) blockers.push({ code: 'MAKE_PRODUCTION_EVIDENCE_REJECTED' });
  if (supabaseEvidence.safety?.production_deploy === true) blockers.push({ code: 'SUPABASE_PRODUCTION_EVIDENCE_REJECTED' });
  if (Number(supabaseEvidence.safety?.variable_cost_eur) !== 0) blockers.push({ code: 'SUPABASE_ZERO_COST_EVIDENCE_REQUIRED' });

  const supabasePlan = buildSupabaseStagingCrmWritePlan({
    customer_id: scope.customer_id,
    project_id: scope.project_id,
    project_uuid: scope.project_uuid,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    production_deploy: false
  });
  if (!supabasePlan.ok) blockers.push({ code: supabasePlan.error || 'SUPABASE_STAGING_WRITE_PLAN_REQUIRED' });

  return {
    ok: true,
    schema: 'riosystems.make-supabase-lead-bridge-plan.v1',
    state: blockers.length === 0 ? 'BRIDGE_PLAN_READY_APPROVAL_REQUIRED' : 'BLOCKED',
    blockers,
    scope: clone(scope),
    providers: {
      automation: {
        provider_id: 'make-core',
        verified_scenario_id: makeEvidence.scenario.scenario_id,
        latest_verified_execution_id: makeEvidence.execution.execution_id,
        existing_staging_activation_verified: isMakeLiveStagingVerified(),
        new_supervised_run_required: true
      },
      business: {
        provider_id: 'supabase-free',
        project_ref: supabaseEvidence.project_ref,
        foundation_verified: isBusinessStagingWriteVerified(),
        foundation_schema: supabaseEvidence.foundation.schema_name,
        foundation_tables: clone(supabaseEvidence.foundation.tables),
        write_plan: supabasePlan.ok ? supabasePlan : null
      }
    },
    bridge_contract: {
      input: canonicalMakeSupabaseSyntheticLead(),
      make_output_required: {
        synthetic: true,
        environment: 'staging',
        project_scope: SCOPE.scope_key,
        execution_id_required: true
      },
      supabase_persistence: {
        reuse_existing_foundation: true,
        create_new_schema: false,
        idempotency_scope: 'project_id_plus_idempotency_key',
        audit_required: true,
        provider_execution_reference_required: true
      }
    },
    required_confirmations: clone(CONFIRMATIONS),
    execution_authorized: false,
    execute_make: false,
    execute_supabase: false,
    external_write: true,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    max_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

function canonicalPlan(plan = {}) {
  if (plan.schema !== 'riosystems.make-supabase-lead-bridge-plan.v1') return null;
  const rebuilt = buildMakeSupabaseLeadBridgePlan({
    customer_id: plan.scope?.customer_id,
    project_id: plan.scope?.project_id,
    project_uuid: plan.scope?.project_uuid,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    production_deploy: false
  });
  if (!rebuilt.ok || rebuilt.state !== 'BRIDGE_PLAN_READY_APPROVAL_REQUIRED') return null;
  return rebuilt;
}

export function evaluateMakeSupabaseLeadBridgeExecution(plan = {}, approvals = {}) {
  if (plan.production_deploy === true || approvals.production_deploy === true) {
    return { ok: false, execution_ready: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  }

  const canonical = canonicalPlan(plan);
  if (!canonical) {
    return { ok: false, execution_ready: false, error: 'MAKE_SUPABASE_BRIDGE_PLAN_REQUIRED', production_deploy: false };
  }

  const blockers = [];
  if (approvals.bridge_confirmation !== CONFIRMATIONS.bridge) blockers.push({ code: 'MAKE_SUPABASE_BRIDGE_CONFIRMATION_REQUIRED', expected: CONFIRMATIONS.bridge });
  if (approvals.make_confirmation !== CONFIRMATIONS.make) blockers.push({ code: 'MAKE_STAGING_RUN_CONFIRMATION_REQUIRED', expected: CONFIRMATIONS.make });
  if (approvals.supabase_confirmation !== CONFIRMATIONS.supabase) blockers.push({ code: 'SUPABASE_STAGING_WRITE_CONFIRMATION_REQUIRED', expected: CONFIRMATIONS.supabase });
  if (approvals.external_write_execution_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_EXECUTION_APPROVAL_REQUIRED' });
  if (approvals.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED' });
  if (approvals.make_provider_approved !== true) blockers.push({ code: 'MAKE_PROVIDER_EXECUTION_APPROVAL_REQUIRED' });
  if (approvals.project_isolation_approved !== true || clean(approvals.approved_scope_key, 180) !== SCOPE.scope_key) blockers.push({ code: 'PROJECT_ISOLATION_APPROVAL_REQUIRED' });
  if (approvals.staging_only !== true || approvals.synthetic_test_data_only !== true) blockers.push({ code: 'SYNTHETIC_STAGING_APPROVAL_REQUIRED' });
  if (approvals.zero_cost_confirmed !== true || Number(approvals.max_variable_cost_eur) !== 0) blockers.push({ code: 'ZERO_VARIABLE_COST_CONFIRMATION_REQUIRED' });

  return {
    ok: blockers.length === 0,
    schema: 'riosystems.make-supabase-lead-bridge-execution-gate.v1',
    state: blockers.length === 0 ? 'BRIDGE_EXECUTION_APPROVED_NOT_EXECUTED' : 'BLOCKED',
    execution_ready: blockers.length === 0,
    blockers,
    scope: clone(SCOPE),
    required_confirmations: clone(CONFIRMATIONS),
    execute_make: false,
    execute_supabase: false,
    external_write: true,
    max_variable_cost_eur: 0,
    production_deploy: false
  };
}

export function makeSupabaseLeadBridgeManifest() {
  return {
    schema: 'riosystems.make-supabase-lead-bridge-manifest.v1',
    scope: clone(SCOPE),
    providers: ['make-core', 'supabase-free'],
    reuse_verified_make_staging_scenario: true,
    reuse_verified_supabase_crm_foundation: true,
    synthetic_test_data_only: true,
    exact_scope_required: true,
    explicit_external_write_execution_approval_required: true,
    supervised_execution_required: true,
    make_provider_execution_approval_required: true,
    zero_variable_cost_confirmation_required: true,
    required_confirmations: clone(CONFIRMATIONS),
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
