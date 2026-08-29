import { buildPreviewDeploymentPlan, evaluatePreviewPromotion } from './preview-staging.js';
import { evaluateD1StagingReadiness } from './d1-runtime-store.js';
import { evaluateBudgetAction } from './operator-budget-policy.js';

export function prepareStagingRelease(input = {}) {
  const preview = buildPreviewDeploymentPlan(input.preview_contract || {}, {
    estimated_cost_eur: Number(input.estimated_cost_eur || 0),
    cost_approved: input.cost_approved === true,
    external_write: input.external_write === true,
    external_write_approved: input.external_write_approved === true,
    execute: input.execute === true,
    supervised_execution_approved: input.supervised_execution_approved === true,
    production: false,
    custom_domain: false
  });

  const d1 = evaluateD1StagingReadiness({
    binding_present: input.d1_binding_present === true,
    migration_declared: input.d1_migration_declared === true,
    migration_applied: input.d1_migration_applied === true,
    external_write_approved: input.external_write_approved === true,
    production: false
  });

  const budget = evaluateBudgetAction(input.budget_policy || {}, input.budget_state || {}, {
    estimated_cost_eur: Number(input.estimated_cost_eur || 0),
    cost_approved: input.cost_approved === true,
    production: false
  });

  const blockers = [...(preview.blockers || []), ...(d1.blockers || []), ...(budget.blockers || [])];
  const unique = blockers.filter((item, index, list) => list.findIndex((other) => other.code === item.code) === index);

  return {
    ok: unique.length === 0,
    schema: 'riosystems.staging-release-control.v1',
    stage: unique.length ? 'WAITING_FOR_STAGING_RELEASE' : 'STAGING_RELEASE_PACKAGE_READY',
    source_revision: input.preview_contract?.source_revision || null,
    preview,
    d1,
    budget,
    blockers: unique,
    user_action_required: unique.some((item) => ['PAID_ACTION_REQUIRES_USER_APPROVAL','EXTERNAL_WRITE_APPROVAL_REQUIRED','D1_MIGRATION_WRITE_REQUIRES_APPROVAL'].includes(item.code)),
    execute_requested: input.execute === true,
    automatic_deploy: false,
    automatic_migration_apply: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function evaluateStagingReleaseEvidence(release = {}, evidence = {}) {
  const previewEvidence = evaluatePreviewPromotion(release.preview?.deployment ? {
    source_revision: release.source_revision
  } : {}, evidence);
  const blockers = [...(previewEvidence.blockers || [])];
  if (release.ok !== true) blockers.push({ code: 'STAGING_RELEASE_PACKAGE_NOT_READY' });
  if (evidence.revision_verified !== true) blockers.push({ code: 'SOURCE_REVISION_NOT_VERIFIED' });
  if (evidence.provider_health_verified !== true) blockers.push({ code: 'PROVIDER_HEALTH_NOT_VERIFIED' });
  return {
    ok: blockers.length === 0,
    stage: blockers.length ? 'STAGING_RELEASE_REPAIR_REQUIRED' : 'STAGING_OPERATOR_REVIEW_READY',
    blockers,
    ready_for_operator_review: blockers.length === 0,
    production_authorized: false,
    automatic_deploy: false,
    production_deploy: false
  };
}

export function stagingReleaseControlManifest() {
  return {
    version: 'riosystems.staging-release-control.v1',
    preview_gate: true,
    d1_gate: true,
    budget_gate: true,
    revision_evidence_gate: true,
    provider_health_evidence_gate: true,
    automatic_deploy: false,
    automatic_migration_apply: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
