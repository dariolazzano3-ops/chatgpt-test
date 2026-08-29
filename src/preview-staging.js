const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const REF = /^(?:account|project|binding|env|secret|revision):\/\/[a-z0-9][a-z0-9._:/-]*$/i;

export function createPreviewStagingContract(input = {}) {
  const blockers = [];
  const contract = {
    schema: 'riosystems.preview-staging.v1',
    environment: 'preview-staging',
    source_revision: clean(input.source_revision, 120),
    cloudflare_account_ref: clean(input.cloudflare_account_ref),
    worker_ref: clean(input.worker_ref),
    d1_ref: clean(input.d1_ref),
    ai_binding_ref: clean(input.ai_binding_ref),
    monthly_budget_eur: Number.isFinite(Number(input.monthly_budget_eur)) ? Number(input.monthly_budget_eur) : 0,
    paid_overflow_allowed: false,
    external_writes_allowed: false,
    public_custom_domain: false,
    production_deploy: false
  };

  if (!contract.source_revision) blockers.push({ code: 'SOURCE_REVISION_REQUIRED' });
  for (const [field, value] of [
    ['cloudflare_account_ref', contract.cloudflare_account_ref],
    ['worker_ref', contract.worker_ref],
    ['d1_ref', contract.d1_ref]
  ]) if (!REF.test(value)) blockers.push({ code: 'REFERENCE_INVALID', field });
  if (contract.ai_binding_ref && !REF.test(contract.ai_binding_ref)) blockers.push({ code: 'REFERENCE_INVALID', field: 'ai_binding_ref' });
  if (contract.monthly_budget_eur < 0) blockers.push({ code: 'BUDGET_INVALID' });

  return { ok: blockers.length === 0, contract, blockers, production_deploy: false };
}

export function buildPreviewDeploymentPlan(contract = {}, input = {}) {
  const blockers = [];
  if (contract.environment !== 'preview-staging') blockers.push({ code: 'PREVIEW_ENVIRONMENT_REQUIRED' });
  if (!contract.source_revision) blockers.push({ code: 'SOURCE_REVISION_REQUIRED' });
  if (input.production === true || input.production_deploy === true) blockers.push({ code: 'PRODUCTION_NOT_AUTHORIZED' });
  if (input.custom_domain === true) blockers.push({ code: 'CUSTOM_DOMAIN_NOT_AUTHORIZED' });
  if (input.external_write === true && input.external_write_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_APPROVAL_REQUIRED' });
  if (Number(input.estimated_cost_eur || 0) > contract.monthly_budget_eur) blockers.push({ code: 'PREVIEW_BUDGET_EXCEEDED' });
  if (Number(input.estimated_cost_eur || 0) > 0 && input.cost_approved !== true) blockers.push({ code: 'PAID_ACTION_REQUIRES_USER_APPROVAL' });

  return {
    ok: blockers.length === 0,
    stage: blockers.length ? 'WAITING_FOR_PREVIEW_APPROVAL' : 'PREVIEW_PLAN_READY',
    blockers,
    user_action_required: blockers.some((item) => ['EXTERNAL_WRITE_APPROVAL_REQUIRED','PAID_ACTION_REQUIRES_USER_APPROVAL'].includes(item.code)),
    deployment: {
      source_revision: contract.source_revision || null,
      target: 'cloudflare-worker-preview',
      worker_ref: contract.worker_ref || null,
      d1_ref: contract.d1_ref || null,
      ai_binding_ref: contract.ai_binding_ref || null,
      dry_run: input.execute !== true,
      supervised_execute: input.execute === true && input.supervised_execution_approved === true,
      custom_domain: false,
      external_writes: input.external_write === true && input.external_write_approved === true,
      automatic_paid_overflow: false,
      production_deploy: false
    },
    production_deploy: false
  };
}

export function evaluatePreviewPromotion(contract = {}, evidence = {}) {
  const blockers = [];
  if (evidence.ci_green !== true) blockers.push({ code: 'CI_NOT_GREEN' });
  if (evidence.smoke_passed !== true) blockers.push({ code: 'PREVIEW_SMOKE_NOT_PASSED' });
  if (evidence.scope_verified !== true) blockers.push({ code: 'SCOPE_NOT_VERIFIED' });
  if (evidence.costs_reconciled !== true) blockers.push({ code: 'COSTS_NOT_RECONCILED' });
  if (evidence.external_side_effects === true) blockers.push({ code: 'UNEXPECTED_EXTERNAL_SIDE_EFFECT' });
  return {
    ok: blockers.length === 0,
    ready_for_operator_review: blockers.length === 0,
    blockers,
    next_stage: blockers.length ? 'PREVIEW_REPAIR_REQUIRED' : 'PREVIEW_OPERATOR_REVIEW_READY',
    automatic_production_promotion: false,
    production_deploy: false,
    source_revision: contract.source_revision || null
  };
}

export function previewStagingManifest() {
  return {
    version: 'riosystems.preview-staging.v1',
    revision_pinned: true,
    custom_domain_disabled: true,
    external_writes_approval_gated: true,
    paid_actions_approval_gated: true,
    automatic_paid_overflow: false,
    automatic_production_promotion: false,
    production_deploy: false
  };
}
