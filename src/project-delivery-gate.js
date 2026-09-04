import { evaluateCustomerReviewLifecycleV1 } from './customer-review-lifecycle-v1.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

function customerReviewEvidence(project = {}, evidence = {}) {
  const reviewRequired = project.delivery_contract?.customer_review_required === true;
  if (!reviewRequired) return { required: false, ready: true, evidence: null, blockers: [] };

  const supplied = evidence.customer_review || null;
  if (!supplied) return { required: true, ready: false, evidence: null, blockers: ['CUSTOMER_REVIEW_REQUIRED'] };

  const review = supplied.schema === 'aurentara.customer-review-lifecycle-evidence.v1'
    ? supplied
    : evaluateCustomerReviewLifecycleV1(supplied, { now: evidence.now || new Date() });

  if (review.ok === false) return { required: true, ready: false, evidence: review, blockers: ['CUSTOMER_REVIEW_EVIDENCE_INVALID'] };
  if (review.scope_key !== project.scope_key) return { required: true, ready: false, evidence: review, blockers: ['CUSTOMER_REVIEW_SCOPE_MISMATCH'] };
  if (review.ready_for_delivery !== true) return { required: true, ready: false, evidence: review, blockers: review.blockers || ['CUSTOMER_APPROVAL_REQUIRED'] };
  return { required: true, ready: true, evidence: review, blockers: [] };
}

export function evaluateProjectDelivery(project = {}, evidence = {}) {
  const blockers = [];
  const requiredCapabilities = (project.capabilities || []).filter((item) => item.required !== false);
  const capabilityEvidence = Array.isArray(evidence.capabilities) ? evidence.capabilities : [];
  for (const capability of requiredCapabilities) {
    const match = capabilityEvidence.find((item) => item.id === capability.id);
    if (!match || match.completed !== true) blockers.push({ code: 'CAPABILITY_DELIVERY_INCOMPLETE', capability: capability.id });
  }
  if (!(project.missions || []).length) blockers.push({ code: 'PROJECT_MISSION_HISTORY_MISSING' });
  if (evidence.qa_passed !== true) blockers.push({ code: 'PROJECT_QA_REQUIRED' });
  if (evidence.scope_verified !== true) blockers.push({ code: 'PROJECT_SCOPE_VERIFICATION_REQUIRED' });
  if (evidence.costs_reconciled !== true) blockers.push({ code: 'PROJECT_COST_RECONCILIATION_REQUIRED' });
  if (evidence.production_deploy === true) blockers.push({ code: 'PRODUCTION_DEPLOY_NOT_PART_OF_PROJECT_DELIVERY_GATE' });
  const premiumRequired = project.premium_website_standard_required === true || project.quality_contract?.premium_website_standard_required === true || project.website_standard === 'aurentara.premium-website-standard.v1';
  const premiumEvidence = evidence.premium_standard || evidence.premium_website_standard || null;
  if (premiumRequired) {
    if (!premiumEvidence) blockers.push({ code: 'PREMIUM_WEBSITE_STANDARD_EVIDENCE_REQUIRED' });
    else if (premiumEvidence.schema !== 'aurentara.premium-website-standard.v1') blockers.push({ code: 'PREMIUM_WEBSITE_STANDARD_SCHEMA_INVALID' });
    else if (premiumEvidence.delivery_readiness?.premium_delivery_ready !== true) blockers.push({ code: 'PREMIUM_WEBSITE_STANDARD_DELIVERY_NOT_READY', state: premiumEvidence.delivery_readiness?.state || 'NOT_VERIFIED', hard_failures: (premiumEvidence.hard_failures || []).map((item) => item.code) });
  }

  const customerReview = customerReviewEvidence(project, evidence);
  for (const code of customerReview.blockers) blockers.push({ code });

  return {
    ok: true,
    scope_key: project.scope_key || null,
    blockers,
    customer_review_required: customerReview.required,
    customer_review_ready: customerReview.ready,
    ready_for_structural_delivery: blockers.length === 0,
    external_activation_separate: true,
    production_deploy: false
  };
}

export function createProjectHandoff(project = {}, evidence = {}) {
  const gate = evaluateProjectDelivery(project, evidence);
  if (!gate.ready_for_structural_delivery) return { ok: false, error: 'PROJECT_DELIVERY_NOT_READY', gate, production_deploy: false };
  const customerReview = customerReviewEvidence(project, evidence);
  return {
    ok: true,
    handoff: {
      handoff_version: 'riosystems.project-handoff.v1',
      customer_id: project.customer_id,
      project_id: project.project_id,
      scope_key: project.scope_key,
      project_name: project.name,
      delivered_capabilities: (project.capabilities || []).map((item) => item.id),
      mission_count: (project.missions || []).length,
      delivery_count: (project.deliveries || []).length,
      structural_delivery_ready: true,
      external_activation_separate: true,
      customer_review: {
        required: customerReview.required,
        ready: customerReview.ready,
        status: customerReview.evidence?.status || null,
        review_revision: customerReview.evidence?.review_revision || null,
        normal_revision_count: customerReview.evidence?.normal_revision_count || 0,
        approved_preview_id: customerReview.evidence?.current_preview?.preview_id || null,
        approval_id: customerReview.evidence?.approval?.approval_id || null
      },
      premium_website_standard: {
        required: project.premium_website_standard_required === true || project.quality_contract?.premium_website_standard_required === true || project.website_standard === 'aurentara.premium-website-standard.v1',
        schema: evidence.premium_standard?.schema || evidence.premium_website_standard?.schema || null,
        weighted_score: evidence.premium_standard?.weighted_score ?? evidence.premium_website_standard?.weighted_score ?? null,
        state: evidence.premium_standard?.delivery_readiness?.state || evidence.premium_website_standard?.delivery_readiness?.state || null,
        premium_delivery_ready: evidence.premium_standard?.delivery_readiness?.premium_delivery_ready === true || evidence.premium_website_standard?.delivery_readiness?.premium_delivery_ready === true
      },
      production_deploy: false
    }
  };
}

export function projectDeliveryGateManifest() {
  return {
    version: 'riosystems.project-delivery-gate.v1',
    checks: ['capability_completion','mission_history','qa','scope','cost_reconciliation','premium_website_standard_when_required','customer_review_when_required'],
    customer_approval_uses_existing_runtime_approval: true,
    external_activation_separate: true,
    production_deploy: false
  };
}
