import { JARVIS_ACTIONS, JARVIS_AUTONOMY, normalizeJarvisPolicy } from './contracts-v1.js';

export function evaluateJarvisActionGateV1(input = {}) {
  const policy = normalizeJarvisPolicy(input.policy || {});
  const action = JARVIS_ACTIONS[input.action];
  if (!action) return { ok: false, status: 'BLOCKED', error: 'JARVIS_ACTION_UNKNOWN', execution_authorized: false };

  if (input.action === 'FINANCIAL_ACTION') {
    return { ok: false, status: 'BLOCKED', error: 'JARVIS_FINANCIAL_ACTIONS_DISABLED_V1', action, policy, execution_authorized: false };
  }

  if (action.risk === 'CRITICAL') {
    return { ok: false, status: 'BLOCKED', error: 'JARVIS_CRITICAL_ACTION_BLOCKED_V1', action, policy, execution_authorized: false };
  }

  if (action.class === 'READ' || action.class === 'PREPARE') {
    return { ok: true, status: 'ALLOWED', action, policy, execution_authorized: true, approval_required: false };
  }

  if (policy.autonomy_level < JARVIS_AUTONOMY.PREPARE_ACTION) {
    return { ok: true, status: 'PREPARE_ONLY', action, policy, execution_authorized: false, approval_required: true };
  }

  if (action.class === 'PERSONAL_WRITE' && policy.allow_personal_writes !== true) {
    return { ok: true, status: 'PREPARE_ONLY', action, policy, execution_authorized: false, approval_required: true };
  }

  if (action.class === 'EXTERNAL_WRITE' && policy.allow_external_writes !== true) {
    return { ok: true, status: 'PREPARE_ONLY', action, policy, execution_authorized: false, approval_required: true };
  }

  if (policy.require_explicit_approval_for_writes && input.explicit_approval !== true) {
    return { ok: true, status: 'AWAITING_APPROVAL', action, policy, execution_authorized: false, approval_required: true };
  }

  const minLevel = action.class === 'PERSONAL_WRITE'
    ? JARVIS_AUTONOMY.SAFE_PERSONAL_ACTION
    : JARVIS_AUTONOMY.APPROVAL_GATED_EXTERNAL_ACTION;

  if (policy.autonomy_level < minLevel) {
    return { ok: true, status: 'PREPARE_ONLY', action, policy, execution_authorized: false, approval_required: true };
  }

  return {
    ok: true,
    status: 'AUTHORIZED',
    action,
    policy,
    execution_authorized: true,
    approval_required: action.approval_required === true
  };
}
