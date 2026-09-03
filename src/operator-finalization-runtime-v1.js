import {
  CONTROLLED_PAID_STAGING_CONFIRMATION,
  controlledPaidStagingSnapshot,
  reserveControlledPaidStagingCost,
  settleControlledPaidStagingCost,
  releaseControlledPaidStagingCost
} from './operator-controlled-paid-staging-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const nowIso = (input) => clean(input, 80) || new Date().toISOString();

function validRuntime(runtime = {}) {
  return runtime?.schema === 'riosystems.operator-runtime.v1'
    && clean(runtime.operator_id, 160)
    && Number.isInteger(runtime.revision)
    && runtime.revision >= 1
    && runtime.command_center_state;
}

function checkRevision(runtime, expectedRevision) {
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected)) return { ok: false, error: 'RUNTIME_EXPECTED_REVISION_REQUIRED' };
  if (runtime.revision !== expected) return { ok: false, error: 'RUNTIME_REVISION_CONFLICT', expected_revision: expected, actual_revision: runtime.revision };
  return { ok: true };
}

function projectByScope(runtime, scopeKey) {
  return (runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey) || null;
}

function projectIndexByScope(runtime, scopeKey) {
  return (runtime.command_center_state?.portfolio?.projects || []).findIndex((item) => item.scope_key === scopeKey);
}

function advance(runtime, event, options = {}) {
  const next = clone(runtime);
  next.revision += 1;
  next.updated_at = nowIso(options.at);
  next.audit = [...(next.audit || []), {
    event,
    actor: runtime.operator_id,
    scope_key: clean(options.scope_key, 300) || null,
    mission_id: clean(options.mission_id, 220) || null,
    plan_token: clean(options.plan_token, 360) || null,
    execution_id: clean(options.execution_id, 220) || null,
    at: next.updated_at
  }];
  return next;
}

function safePlanRecord(input = {}, runtimeRevision) {
  const review = clone(input.review || {});
  const mission = review.mission || {};
  const missionId = clean(mission.mission_id || input.mission_id, 220);
  const scopeKey = clean(input.scope_key, 300);
  if (!missionId || !scopeKey) return null;
  const token = `dplan:${missionId}:r${runtimeRevision}`;
  return {
    schema: 'riosystems.operator-mission-plan.v1',
    plan_token: token,
    scope_key: scopeKey,
    mission_id: missionId,
    business_name: clean(mission.business_name || input.business_name, 220),
    mission_text: clean(mission.mission_text || input.mission_text, 4000),
    review,
    safe_input: clone(input.safe_input || {}),
    status: 'APPROVAL_REQUIRED',
    runtime_revision: runtimeRevision,
    created_at: nowIso(input.created_at),
    expires_at: clean(input.expires_at, 80) || null,
    confirmation_text: 'CONFIRM_SYNTHETIC_STAGING',
    live_confirmation_text: 'CONFIRM_LIVE_STAGING_ZERO_COST',
    controlled_paid_confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
    production_deploy: false
  };
}

export function persistOperatorMissionPlan(runtime = {}, input = {}, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return { ...revision, production_deploy: false };
  const scopeKey = clean(input.scope_key, 300);
  if (!projectByScope(runtime, scopeKey)) return { ok: false, error: 'MISSION_PROJECT_SCOPE_REQUIRED', production_deploy: false };
  const nextRevision = runtime.revision + 1;
  const record = safePlanRecord(input, nextRevision);
  if (!record) return { ok: false, error: 'MISSION_PLAN_RECORD_INVALID', production_deploy: false };
  const existing = (runtime.mission_plans || []).find((item) => item.mission_id === record.mission_id && item.status === 'APPROVAL_REQUIRED');
  if (existing) return { ok: true, changed: false, runtime: clone(runtime), plan: clone(existing), production_deploy: false };
  const next = advance(runtime, 'MISSION_PLAN_DURABLY_RECORDED', { ...options, scope_key: scopeKey, mission_id: record.mission_id, plan_token: record.plan_token });
  next.mission_plans = [...(runtime.mission_plans || []), record];
  return { ok: true, changed: true, runtime: next, plan: record, production_deploy: false };
}

export function findOperatorMissionPlan(runtime = {}, planToken = '') {
  const token = clean(planToken, 360);
  return clone((runtime.mission_plans || []).find((item) => item.plan_token === token) || null);
}

export function listOperatorMissionPlans(runtime = {}, options = {}) {
  const now = Date.parse(options.at || new Date().toISOString());
  return clone((runtime.mission_plans || []).filter((item) => {
    if (!item.expires_at) return true;
    const expiry = Date.parse(item.expires_at);
    return !Number.isFinite(expiry) || expiry > now || !['APPROVAL_REQUIRED','DEFERRED'].includes(item.status);
  }));
}

export function decideOperatorMissionPlan(runtime = {}, planToken = '', decision = '', expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return { ...revision, production_deploy: false };
  const token = clean(planToken, 360);
  const action = clean(decision, 80).toLowerCase();
  const index = (runtime.mission_plans || []).findIndex((item) => item.plan_token === token);
  if (index < 0) return { ok: false, error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false };
  const plan = runtime.mission_plans[index];
  if (Number(plan.runtime_revision) !== runtime.revision) {
    return { ok: false, error: 'PLAN_RUNTIME_REVISION_CONFLICT', expected_revision: plan.runtime_revision, actual_revision: runtime.revision, production_deploy: false };
  }
  if (plan.expires_at && Date.parse(plan.expires_at) <= Date.parse(options.at || new Date().toISOString())) {
    return { ok: false, error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false };
  }
  if (!['reject','defer'].includes(action)) return { ok: false, error: 'MISSION_PLAN_DECISION_UNSUPPORTED', production_deploy: false };
  const next = advance(runtime, action === 'reject' ? 'MISSION_PLAN_REJECTED' : 'MISSION_PLAN_DEFERRED', { ...options, scope_key: plan.scope_key, mission_id: plan.mission_id, plan_token: token });
  next.mission_plans = clone(runtime.mission_plans || []);
  next.mission_plans[index] = { ...clone(plan), status: action === 'reject' ? 'REJECTED' : 'DEFERRED', runtime_revision: next.revision, decided_at: next.updated_at, production_deploy: false };
  return { ok: true, changed: true, runtime: next, plan: clone(next.mission_plans[index]), production_deploy: false };
}

function liveContract(runtime, plan, input, idempotencyKey) {
  const project = projectByScope(runtime, plan.scope_key);
  if (!project) return { ok: false, error: 'LIVE_STAGING_PROJECT_SCOPE_MISMATCH' };
  if (runtime.selected_project_scope && runtime.selected_project_scope !== plan.scope_key) return { ok: false, error: 'LIVE_STAGING_SELECTED_PROJECT_SCOPE_MISMATCH' };
  if (input.provider_eligibility_pass !== true || input.project_scope_pass !== true) return { ok: false, error: 'LIVE_STAGING_ELIGIBILITY_GATE_REJECTED' };

  const paid = controlledPaidStagingSnapshot(project);
  if (paid.active) {
    const requested = Number(input.variable_cost_ceiling_eur);
    const safe = input.environment === 'staging'
      && Number.isFinite(requested)
      && requested >= 0
      && requested <= paid.remaining_budget_eur
      && input.production_authorized === false
      && input.paid_overflow === false
      && input.external_customer_writes !== true
      && input.public_deploy !== true
      && input.dns_change !== true
      && input.billing !== true
      && input.checkout !== true
      && input.public_indexing !== true
      && input.real_customer_data !== true;
    if (!safe) return { ok: false, error: 'CONTROLLED_PAID_STAGING_SAFETY_GATE_REJECTED' };
    return {
      ok: true,
      controlled_paid_staging: true,
      project,
      contract: {
        schema: 'riosystems.operator-live-staging-execution-contract.v1',
        operator_id: runtime.operator_id,
        scope_key: plan.scope_key,
        customer_id: project.customer_id,
        project_id: project.project_id,
        mission_id: plan.mission_id,
        plan_token: plan.plan_token,
        idempotency_key: idempotencyKey,
        mission: clone(plan.review?.mission || {}),
        selected_capabilities: clone(plan.review?.plan?.selected_capabilities || []),
        provider_routes: clone(input.provider_routes || []),
        environment: 'staging',
        data_mode: 'controlled-prelaunch',
        synthetic_only: false,
        operator_approved_company_information_only: true,
        real_customer_data: false,
        external_customer_writes: false,
        variable_cost_ceiling_eur: requested,
        project_budget_ceiling_eur: paid.project_budget_ceiling_eur,
        current_project_spend_eur: paid.current_spend_eur,
        remaining_project_budget_eur: paid.remaining_budget_eur,
        paid_provider_calls: 'ALLOWED_WITHIN_PROJECT_BUDGET',
        paid_overflow: false,
        automatic_budget_increase: false,
        provider_native_hard_cap_guaranteed: false,
        production_authorized: false,
        public_deploy: false,
        dns_change: false,
        billing: false,
        checkout: false,
        public_indexing: false,
        production_deploy: false
      }
    };
  }

  if (input.environment !== 'staging' || input.synthetic_only !== true || input.production_authorized !== false || Number(input.variable_cost_ceiling_eur) !== 0 || input.paid_overflow !== false) {
    return { ok: false, error: 'LIVE_STAGING_SAFETY_GATE_REJECTED' };
  }
  return {
    ok: true,
    controlled_paid_staging: false,
    project,
    contract: {
      schema: 'riosystems.operator-live-staging-execution-contract.v1',
      operator_id: runtime.operator_id,
      scope_key: plan.scope_key,
      customer_id: project.customer_id,
      project_id: project.project_id,
      mission_id: plan.mission_id,
      plan_token: plan.plan_token,
      idempotency_key: idempotencyKey,
      mission: clone(plan.review?.mission || {}),
      selected_capabilities: clone(plan.review?.plan?.selected_capabilities || []),
      provider_routes: clone(input.provider_routes || []),
      environment: 'staging',
      data_mode: 'synthetic_only',
      synthetic_only: true,
      real_customer_data: false,
      external_customer_writes: false,
      variable_cost_ceiling_eur: 0,
      paid_provider_calls: 'NOT_AUTHORIZED',
      paid_overflow: false,
      production_authorized: false,
      public_deploy: false,
      dns_change: false,
      billing: false,
      checkout: false,
      public_indexing: false,
      production_deploy: false
    }
  };
}

export function reserveOperatorLiveStagingExecution(runtime = {}, input = {}, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return { ...revision, production_deploy: false };
  const token = clean(input.plan_token, 360);
  const planIndex = (runtime.mission_plans || []).findIndex((item) => item.plan_token === token);
  if (planIndex < 0) return { ok: false, error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false };
  const plan = runtime.mission_plans[planIndex];
  if (plan.status !== 'APPROVAL_REQUIRED') return { ok: false, error: 'MISSION_PLAN_NOT_APPROVABLE', status: plan.status, production_deploy: false };
  if (plan.runtime_revision !== runtime.revision) return { ok: false, error: 'PLAN_RUNTIME_REVISION_CONFLICT', expected_revision: plan.runtime_revision, actual_revision: runtime.revision, production_deploy: false };
  const idempotencyKey = clean(input.idempotency_key, 300);
  if (!idempotencyKey) return { ok: false, error: 'LIVE_STAGING_IDEMPOTENCY_KEY_REQUIRED', production_deploy: false };
  const existing = (runtime.live_staging_runs || []).find((item) => item.idempotency_key === idempotencyKey);
  if (existing) return { ok: true, changed: false, idempotent_replay: true, runtime: clone(runtime), run: clone(existing), production_deploy: false };
  const built = liveContract(runtime, plan, input, idempotencyKey);
  if (!built.ok) return { ...built, production_deploy: false };
  const expectedConfirmation = built.controlled_paid_staging ? CONTROLLED_PAID_STAGING_CONFIRMATION : 'CONFIRM_LIVE_STAGING_ZERO_COST';
  if (clean(input.confirmation_text, 200) !== expectedConfirmation) return { ok: false, error: 'LIVE_STAGING_CONFIRMATION_REQUIRED', production_deploy: false };

  const executionId = `live:${plan.mission_id}:${runtime.revision + 1}`;
  let reservedProject = built.project;
  if (built.controlled_paid_staging) {
    const reservation = reserveControlledPaidStagingCost(built.project, {
      reservation_id: executionId,
      estimated_cost_eur: built.contract.variable_cost_ceiling_eur,
      mission_id: plan.mission_id,
      provider_id: clean(input.provider_routes?.[0]?.provider_id || input.provider_routes?.[0]?.id, 120) || null,
      capability: clean(input.provider_routes?.[0]?.capability, 120) || null
    });
    if (!reservation.ok) return { ok: false, error: reservation.error || 'PROJECT_BUDGET_EXCEEDED', budget_gate: reservation.gate || null, production_deploy: false };
    reservedProject = reservation.project;
    built.contract.current_project_spend_eur = reservation.snapshot.current_spend_eur;
    built.contract.remaining_project_budget_eur = reservation.snapshot.remaining_budget_eur;
    built.contract.reserved_project_budget_eur = reservation.snapshot.reserved_eur;
  }

  const next = advance(runtime, built.controlled_paid_staging ? 'CONTROLLED_PAID_STAGING_EXECUTION_RESERVED' : 'LIVE_STAGING_EXECUTION_RESERVED', { ...options, scope_key: plan.scope_key, mission_id: plan.mission_id, plan_token: token, execution_id: executionId });
  next.mission_plans = clone(runtime.mission_plans || []);
  next.mission_plans[planIndex] = { ...clone(plan), status: 'APPROVED', decision: built.controlled_paid_staging ? 'approve_controlled_paid_staging' : 'approve_live_staging', approved_at: next.updated_at, runtime_revision: next.revision, production_deploy: false };
  if (built.controlled_paid_staging) {
    const projectIndex = projectIndexByScope(next, plan.scope_key);
    if (projectIndex < 0) return { ok: false, error: 'LIVE_STAGING_PROJECT_SCOPE_MISMATCH', production_deploy: false };
    next.command_center_state.portfolio.projects[projectIndex] = reservedProject;
  }
  const run = {
    schema: 'riosystems.operator-live-staging-run.v1',
    execution_id: executionId,
    idempotency_key: idempotencyKey,
    plan_token: token,
    mission_id: plan.mission_id,
    scope_key: plan.scope_key,
    status: 'EXECUTING',
    controlled_paid_staging: built.controlled_paid_staging,
    contract: built.contract,
    evidence: null,
    reserved_variable_cost_eur: built.controlled_paid_staging ? Number(built.contract.variable_cost_ceiling_eur) : 0,
    variable_cost_eur: 0,
    production_deploy: false,
    created_at: next.updated_at,
    updated_at: next.updated_at
  };
  next.live_staging_runs = [...(runtime.live_staging_runs || []), run];
  return { ok: true, changed: true, runtime: next, run: clone(run), contract: clone(built.contract), production_deploy: false };
}

export function finalizeOperatorLiveStagingExecution(runtime = {}, executionId = '', result = {}, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return { ...revision, production_deploy: false };
  const id = clean(executionId, 220);
  const index = (runtime.live_staging_runs || []).findIndex((item) => item.execution_id === id);
  if (index < 0) return { ok: false, error: 'LIVE_STAGING_EXECUTION_NOT_FOUND', production_deploy: false };
  const current = runtime.live_staging_runs[index];
  if (current.status !== 'EXECUTING') return { ok: true, changed: false, runtime: clone(runtime), run: clone(current), idempotent_replay: true, production_deploy: false };
  const safe = result && typeof result === 'object' ? clone(result) : {};
  const controlled = current.controlled_paid_staging === true;
  const actualCost = Math.max(0, Number(safe.variable_cost_eur || 0));
  const commonSafetyPass = safe.production_deploy !== true
    && safe.real_customer_data !== true
    && safe.paid_overflow !== true
    && safe.external_customer_writes !== true
    && safe.public_deploy !== true
    && safe.dns_change !== true
    && safe.billing !== true
    && safe.checkout !== true
    && safe.public_indexing !== true;
  const safetyPass = controlled
    ? commonSafetyPass && actualCost <= Number(current.contract?.project_budget_ceiling_eur || 0)
    : commonSafetyPass && actualCost === 0 && safe.synthetic_only !== false;

  let nextProject = projectByScope(runtime, current.scope_key);
  let budgetError = null;
  if (controlled && nextProject) {
    const accounting = actualCost > 0
      ? settleControlledPaidStagingCost(nextProject, { reservation_id: id, actual_cost_units: actualCost })
      : releaseControlledPaidStagingCost(nextProject, { reservation_id: id, reason: safe.ok === true ? 'ZERO_ACTUAL_COST' : 'EXECUTION_FAILED_WITHOUT_REPORTED_COST' });
    if (!accounting.ok) budgetError = accounting.error || 'PROJECT_BUDGET_SETTLEMENT_FAILED';
    else nextProject = accounting.project;
  }

  const verified = safe.ok === true && safetyPass && !budgetError && safe.qa?.passed === true && ['LIVE_STAGING_VERIFIED','LIVE_STAGING_E2E_VERIFIED','LIVE_PROVIDER_VERIFIED','DELIVERED'].includes(clean(safe.status, 100));
  const next = advance(runtime, verified ? (controlled ? 'CONTROLLED_PAID_STAGING_EXECUTION_VERIFIED' : 'LIVE_STAGING_EXECUTION_VERIFIED') : 'LIVE_STAGING_EXECUTION_FAILED', { ...options, scope_key: current.scope_key, mission_id: current.mission_id, plan_token: current.plan_token, execution_id: id });
  if (controlled && nextProject) {
    const projectIndex = projectIndexByScope(next, current.scope_key);
    if (projectIndex >= 0) next.command_center_state.portfolio.projects[projectIndex] = nextProject;
  }
  next.live_staging_runs = clone(runtime.live_staging_runs || []);
  next.live_staging_runs[index] = {
    ...clone(current),
    status: verified ? 'LIVE_STAGING_VERIFIED' : 'FAILED',
    evidence: safe,
    variable_cost_eur: controlled ? actualCost : 0,
    project_budget: controlled && nextProject ? controlledPaidStagingSnapshot(nextProject) : null,
    production_deploy: false,
    updated_at: next.updated_at,
    completed_at: next.updated_at
  };
  return { ok: verified, changed: true, runtime: next, run: clone(next.live_staging_runs[index]), error: verified ? null : budgetError || clean(safe.error, 240) || 'LIVE_STAGING_EXECUTION_NOT_VERIFIED', production_deploy: false };
}

export function operatorFinalizationRuntimeManifest() {
  return {
    schema: 'riosystems.operator-finalization-runtime.v1',
    durable_mission_plans: true,
    durable_approval_decisions: true,
    live_staging_two_phase_reservation: true,
    controlled_paid_staging_project_scoped: true,
    existing_cost_ledger_reused: true,
    idempotency_required: true,
    optimistic_concurrency: true,
    safe_default_variable_cost_ceiling_eur: 0,
    automatic_paid_overflow: false,
    automatic_budget_increase: false,
    production_deploy: false
  };
}
