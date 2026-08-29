const clean = (value, max = 160) => String(value || '').trim().slice(0, max);
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function createOperatorBudgetPolicy(input = {}) {
  const ceiling = money(Number.isFinite(Number(input.monthly_ceiling_eur)) ? Number(input.monthly_ceiling_eur) : 0);
  const warnAt = money(Number.isFinite(Number(input.warn_at_eur)) ? Number(input.warn_at_eur) : ceiling * 0.75);
  return {
    schema: 'riosystems.operator-budget-policy.v1',
    policy_id: clean(input.policy_id || 'default-budget-policy'),
    monthly_ceiling_eur: Math.max(0, ceiling),
    warn_at_eur: Math.max(0, Math.min(warnAt, ceiling)),
    require_explicit_approval_for_paid_action: input.require_explicit_approval_for_paid_action !== false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function evaluateBudgetAction(policy = {}, state = {}, action = {}) {
  const spent = money(Number(state.spent_eur || 0));
  const reserved = money(Number(state.reserved_eur || 0));
  const estimate = money(Number(action.estimated_cost_eur || 0));
  const projected = money(spent + reserved + estimate);
  const blockers = [];

  if (estimate < 0) blockers.push({ code: 'NEGATIVE_COST_INVALID' });
  if (projected > Number(policy.monthly_ceiling_eur || 0)) blockers.push({ code: 'MONTHLY_BUDGET_CEILING_EXCEEDED', projected_eur: projected, ceiling_eur: policy.monthly_ceiling_eur });
  if (estimate > 0 && policy.require_explicit_approval_for_paid_action !== false && action.cost_approved !== true) blockers.push({ code: 'PAID_ACTION_REQUIRES_USER_APPROVAL', estimated_cost_eur: estimate });
  if (action.production === true || action.production_deploy === true) blockers.push({ code: 'PRODUCTION_NOT_AUTHORIZED' });

  return {
    ok: blockers.length === 0,
    blockers,
    user_action_required: blockers.some((item) => item.code === 'PAID_ACTION_REQUIRES_USER_APPROVAL'),
    spent_eur: spent,
    reserved_eur: reserved,
    estimated_cost_eur: estimate,
    projected_eur: projected,
    warning: projected >= Number(policy.warn_at_eur || 0),
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function reserveBudget(state = {}, action = {}, evaluation = {}) {
  if (evaluation.ok !== true) return { ok: false, error: 'BUDGET_ACTION_NOT_APPROVED', state: { ...state }, production_deploy: false };
  const estimate = money(Number(action.estimated_cost_eur || 0));
  return {
    ok: true,
    state: {
      spent_eur: money(Number(state.spent_eur || 0)),
      reserved_eur: money(Number(state.reserved_eur || 0) + estimate)
    },
    production_deploy: false
  };
}

export function settleBudget(state = {}, reservationEur = 0, actualEur = 0) {
  const reserved = Math.max(0, money(Number(state.reserved_eur || 0) - Number(reservationEur || 0)));
  const spent = money(Number(state.spent_eur || 0) + Number(actualEur || 0));
  return { ok: true, state: { spent_eur: spent, reserved_eur: reserved }, production_deploy: false };
}

export function operatorBudgetPolicyManifest() {
  return {
    version: 'riosystems.operator-budget-policy.v1',
    monthly_ceiling: true,
    paid_action_approval_gate: true,
    warning_threshold: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
