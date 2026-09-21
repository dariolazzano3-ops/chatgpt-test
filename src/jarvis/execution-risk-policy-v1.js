const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

export const YSRIO_EXECUTION_EFFECT = Object.freeze({
  CODE_WRITE: 'CODE_WRITE',
  TEST: 'TEST',
  GIT_WRITE: 'GIT_WRITE',
  PRIVATE_DEPLOY: 'PRIVATE_DEPLOY',
  SERVICE_RELOAD: 'SERVICE_RELOAD',
  LIVE_VERIFY: 'LIVE_VERIFY',
  ROLLBACK: 'ROLLBACK',
  PUBLIC_DEPLOY: 'PUBLIC_DEPLOY',
  PUBLIC_RELEASE: 'PUBLIC_RELEASE',
  DNS_MUTATION: 'DNS_MUTATION',
  BILLING: 'BILLING',
  SECRET_ACCESS: 'SECRET_ACCESS',
  SECRET_MUTATION: 'SECRET_MUTATION',
  DESTRUCTIVE_ACTION: 'DESTRUCTIVE_ACTION',
  PRODUCTION_ACTIVATION: 'PRODUCTION_ACTIVATION',
  MERGE: 'MERGE',
  FORCE_PUSH: 'FORCE_PUSH'
});

const AUTONOMOUS_PRIVATE_EFFECTS = new Set([
  'CODE_WRITE', 'TEST', 'GIT_WRITE', 'PRIVATE_DEPLOY',
  'SERVICE_RELOAD', 'LIVE_VERIFY', 'ROLLBACK'
]);

const PRIVATE_ENVIRONMENTS = new Set([
  'local', 'development', 'dev', 'test', 'staging', 'preview', 'private', 'internal'
]);
function privateTargetVerified(input = {}) {
  const environment = clean(input.environment, 80).toLowerCase();
  const visibility = clean(input.visibility, 80).toUpperCase();
  const privateEnvironment = PRIVATE_ENVIRONMENTS.has(environment)
    || /(^|[-_])(private|internal|staging|preview|dev|development|test)([-_]|$)/.test(environment);
  return privateEnvironment
    && ['PRIVATE', 'INTERNAL'].includes(visibility)
    && input.public_access === false
    && input.production !== true
    && input.private_access_verified === true;
}

function protectedReason(input = {}, effect = '') {
  if (input.public_access === true || input.production === true || ['PUBLIC_DEPLOY', 'PUBLIC_RELEASE', 'PRODUCTION_ACTIVATION'].includes(effect)) return 'PUBLIC_OR_PRODUCTION_ACTION';
  if (input.dns_change === true || effect === 'DNS_MUTATION') return 'DNS_MUTATION';
  if (input.billing_change === true || effect === 'BILLING') return 'BILLING';
  if (input.secret_access === true || effect === 'SECRET_ACCESS') return 'SECRET_ACCESS';
  if (input.secret_change === true || effect === 'SECRET_MUTATION') return 'SECRET_MUTATION';
  if (input.destructive === true || effect === 'DESTRUCTIVE_ACTION') return 'DESTRUCTIVE_ACTION';
  if (input.merge === true || effect === 'MERGE') return 'MERGE';
  if (input.force_push === true || effect === 'FORCE_PUSH') return 'FORCE_PUSH';
  if (input.protected_branch === true) return 'PROTECTED_BRANCH_WRITE';
  if (Number(input.estimated_cost_eur || 0) > 0) return 'PAID_EXTERNAL_ACTION';
  return null;
}

function approvalDecision(reason, explicitApproval) {
  return {
    ok: true,
    status: explicitApproval === true ? 'AUTHORIZED' : 'AWAITING_APPROVAL',
    execution_authorized: explicitApproval === true,
    approval_required: true,
    reason
  };
}
export function evaluateYsrioExecutionRiskV1(input = {}) {
  const effect = clean(input.effect, 80).toUpperCase();
  if (!Object.values(YSRIO_EXECUTION_EFFECT).includes(effect)) {
    return { ok: false, status: 'BLOCKED', execution_authorized: false, approval_required: true, reason: 'UNKNOWN_EFFECT' };
  }

  const protectedBy = protectedReason(input, effect);
  if (protectedBy) {
    return {
      policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1',
      effect,
      ...approvalDecision(protectedBy, input.explicit_approval)
    };
  }

  if (!AUTONOMOUS_PRIVATE_EFFECTS.has(effect)) {
    return {
      policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1',
      effect,
      ...approvalDecision('NON_PRIVATE_EFFECT', input.explicit_approval)
    };
  }

  if (!privateTargetVerified(input)) {
    return {
      policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1',
      effect,
      ...approvalDecision('PRIVATE_TARGET_NOT_VERIFIED', input.explicit_approval)
    };
  }
  if (effect === 'GIT_WRITE' && !clean(input.branch, 240)) {
    return { ok: false, status: 'BLOCKED', execution_authorized: false, approval_required: true, reason: 'GIT_BRANCH_REQUIRED', policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1', effect };
  }

  if (effect === 'PRIVATE_DEPLOY') {
    if (input.existing_target !== true) {
      return { policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1', effect, ...approvalDecision('PRIVATE_DEPLOY_EXISTING_TARGET_REQUIRED', input.explicit_approval) };
    }
    if (input.rollback_available !== true) {
      return { policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1', effect, ...approvalDecision('PRIVATE_DEPLOY_ROLLBACK_REQUIRED', input.explicit_approval) };
    }
  }

  return {
    ok: true,
    status: 'AUTHORIZED',
    execution_authorized: true,
    approval_required: false,
    reason: null,
    policy: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1',
    effect,
    private_target_verified: true
  };
}

export function ysrioExecutionRiskPolicyManifestV1() {
  return {
    schema: 'ysrio.execution-risk-policy.v1',
    default_mode: 'PRIVATE_INTERNAL_AUTONOMOUS_EXTERNAL_RISK_GATED',
    autonomous_private_effects: [...AUTONOMOUS_PRIVATE_EFFECTS],
    approval_required_effects: ['PUBLIC_DEPLOY','PUBLIC_RELEASE','PRODUCTION_ACTIVATION','DNS_MUTATION','BILLING','SECRET_ACCESS','SECRET_MUTATION','DESTRUCTIVE_ACTION','MERGE','FORCE_PUSH','PROTECTED_BRANCH_WRITE','PAID_EXTERNAL_ACTION'],
    private_environments: [...PRIVATE_ENVIRONMENTS],
    fail_closed_when_target_privacy_unverified: true,
    secret_reference_use_may_execute_without_secret_value_access: true
  };
}
