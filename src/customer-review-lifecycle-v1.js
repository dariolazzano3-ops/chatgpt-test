import { classifyCustomerFeedbackV1 } from './customer-delivery-contract-v1.js';
import { evaluateHumanOutcomeAcceptance } from './human-outcome-acceptance-v1.js';
import { createApprovalRecord, evaluateApproval } from './runtime-approvals.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const at = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export const CUSTOMER_DELIVERY_APPROVAL_TYPE_V1 = 'CUSTOMER_DELIVERY_APPROVAL';

function assertState(state = {}, input = {}) {
  if (state?.schema !== 'aurentara.customer-review-lifecycle.v1') {
    return { ok: false, error: 'CUSTOMER_REVIEW_LIFECYCLE_REQUIRED' };
  }
  const customerId = clean(input.customer_id, 160) || state.customer_id;
  const projectId = clean(input.project_id, 160) || state.project_id;
  const scopeKey = clean(input.scope_key, 320) || state.scope_key;
  if (customerId !== state.customer_id || projectId !== state.project_id || scopeKey !== state.scope_key) {
    return { ok: false, error: 'CUSTOMER_REVIEW_CROSS_SCOPE_REJECTED' };
  }
  return { ok: true };
}

function mutate(state, event, options = {}, details = {}) {
  const next = clone(state);
  next.review_revision = Number(next.review_revision || 1) + 1;
  next.updated_at = at(options.at);
  next.audit = [...(next.audit || []), {
    event,
    at: next.updated_at,
    actor: clean(options.actor, 160) || null,
    scope_key: next.scope_key,
    ...details
  }];
  return next;
}

function resolveHumanOutcome(input = {}) {
  const supplied = input.human_outcome_acceptance;
  if (supplied?.schema === 'aurentara.real-human-outcome-acceptance.v1') return clone(supplied);
  if (supplied?.human_outcome?.schema === 'aurentara.real-human-outcome-acceptance.v1') return clone(supplied.human_outcome);
  return evaluateHumanOutcomeAcceptance(input.human_outcome || {});
}

function revokeApprovals(approvals = [], reason, reviewRevision) {
  return approvals.map((approval) => approval?.approval_type === CUSTOMER_DELIVERY_APPROVAL_TYPE_V1 && approval.granted === true
    ? {
        ...approval,
        granted: false,
        metadata: {
          ...(approval.metadata || {}),
          revoked_reason: reason,
          revoked_at_review_revision: reviewRevision
        }
      }
    : approval);
}

export function createCustomerReviewLifecycleV1(project = {}, options = {}) {
  const customerId = clean(project.customer_id, 160);
  const projectId = clean(project.project_id, 160);
  const scopeKey = clean(project.scope_key, 320) || (customerId && projectId ? `${customerId}:${projectId}` : '');
  if (!customerId || !projectId || scopeKey !== `${customerId}:${projectId}`) {
    return { ok: false, error: 'CUSTOMER_REVIEW_PROJECT_SCOPE_REQUIRED', production_deploy: false };
  }

  const createdAt = at(options.at);
  return {
    ok: true,
    state: {
      schema: 'aurentara.customer-review-lifecycle.v1',
      customer_id: customerId,
      project_id: projectId,
      scope_key: scopeKey,
      delivery_contract_schema: project.delivery_contract?.schema || null,
      customer_review_required: project.delivery_contract?.customer_review_required !== false,
      status: 'AWAITING_PRIVATE_PREVIEW',
      review_revision: 1,
      normal_revision_count: 0,
      current_preview: null,
      previews: [],
      feedback: [],
      revisions: [],
      approvals: [],
      created_at: createdAt,
      updated_at: createdAt,
      audit: [{ event: 'CUSTOMER_REVIEW_LIFECYCLE_CREATED', at: createdAt, actor: clean(options.actor, 160) || null, scope_key: scopeKey }],
      safety: {
        production_deploy: false,
        public_launch: false,
        automatic_customer_communication: false,
        uncontrolled_external_writes: false
      }
    },
    production_deploy: false
  };
}

export function registerPrivatePreviewV1(state = {}, input = {}, options = {}) {
  const scope = assertState(state, input);
  if (!scope.ok) return { ...scope, production_deploy: false };
  if (!['AWAITING_PRIVATE_PREVIEW', 'PREVIEW_REPAIR_REQUIRED'].includes(state.status)) {
    return { ok: false, error: 'CUSTOMER_REVIEW_PREVIEW_NOT_EXPECTED', status: state.status, production_deploy: false };
  }

  const previewUrl = clean(input.preview_url, 1600);
  const sourceRevision = clean(input.source_revision, 160);
  if (!previewUrl) return { ok: false, error: 'PRIVATE_PREVIEW_URL_REQUIRED', production_deploy: false };
  if (!sourceRevision) return { ok: false, error: 'PRIVATE_PREVIEW_SOURCE_REVISION_REQUIRED', production_deploy: false };
  if (input.private_access_verified !== true) return { ok: false, error: 'PRIVATE_PREVIEW_ACCESS_VERIFICATION_REQUIRED', production_deploy: false };
  if (input.qa_passed !== true) return { ok: false, error: 'PRIVATE_PREVIEW_QA_REQUIRED', production_deploy: false };

  const humanOutcome = resolveHumanOutcome(input);
  if (humanOutcome.human_outcome_accepted !== true) {
    return {
      ok: false,
      error: 'PRIVATE_PREVIEW_HUMAN_OUTCOME_REQUIRED',
      human_outcome: humanOutcome,
      production_deploy: false
    };
  }

  const next = mutate(state, 'PRIVATE_PREVIEW_REGISTERED', options, { source_revision: sourceRevision });
  const preview = {
    preview_id: clean(input.preview_id, 200) || `${state.scope_key}:preview:${next.review_revision}`,
    review_revision: next.review_revision,
    preview_url: previewUrl,
    source_revision: sourceRevision,
    private_access_verified: true,
    qa_passed: true,
    human_outcome_schema: humanOutcome.schema,
    human_outcome_verdict: humanOutcome.verdict,
    human_outcome_accepted: true,
    created_at: next.updated_at,
    production_deploy: false
  };
  next.current_preview = preview;
  next.previews = [...(next.previews || []), preview];
  next.status = 'CUSTOMER_REVIEW';

  return { ok: true, state: next, preview: clone(preview), production_deploy: false };
}

export function submitCustomerFeedbackV1(state = {}, input = {}, options = {}) {
  const scope = assertState(state, input);
  if (!scope.ok) return { ...scope, production_deploy: false };
  if (state.status !== 'CUSTOMER_REVIEW') {
    return { ok: false, error: 'CUSTOMER_FEEDBACK_REVIEW_NOT_OPEN', status: state.status, production_deploy: false };
  }

  const classified = classifyCustomerFeedbackV1(input);
  if (!classified.ok) return classified;

  const next = mutate(state, 'CUSTOMER_FEEDBACK_RECORDED', options, { feedback_type: classified.feedback.type });
  const feedback = {
    feedback_id: clean(input.feedback_id, 200) || `${state.scope_key}:feedback:${next.review_revision}`,
    review_revision: next.review_revision,
    preview_id: state.current_preview?.preview_id || null,
    ...classified.feedback,
    submitted_by: clean(input.submitted_by || options.actor, 160) || null,
    created_at: next.updated_at,
    resolved: false,
    resolved_by_revision_id: null
  };

  next.feedback = [...(next.feedback || []), feedback];
  next.approvals = revokeApprovals(next.approvals, classified.feedback.type, next.review_revision);

  if (classified.feedback.type === 'SCOPE_EXPANSION') {
    next.status = 'SCOPE_REASSESSMENT_REQUIRED';
    next.scope_reassessment = {
      required: true,
      feedback_id: feedback.feedback_id,
      cost_reestimate_required: true,
      new_scope_approval_required: true,
      return_to_delivery_contract: true
    };
  } else {
    next.status = 'REVISION_REQUIRED';
  }

  return {
    ok: true,
    state: next,
    feedback: clone(feedback),
    scope_expansion: classified.feedback.type === 'SCOPE_EXPANSION',
    production_deploy: false
  };
}

export function recordCustomerRevisionV1(state = {}, input = {}, options = {}) {
  const scope = assertState(state, input);
  if (!scope.ok) return { ...scope, production_deploy: false };
  if (state.status === 'SCOPE_REASSESSMENT_REQUIRED') {
    return {
      ok: false,
      error: 'SCOPE_EXPANSION_REQUIRES_DELIVERY_CONTRACT_REASSESSMENT',
      cost_reestimate_required: true,
      new_scope_approval_required: true,
      production_deploy: false
    };
  }
  if (state.status !== 'REVISION_REQUIRED') {
    return { ok: false, error: 'CUSTOMER_REVISION_NOT_REQUIRED', status: state.status, production_deploy: false };
  }

  const sourceRevision = clean(input.source_revision, 160);
  const summary = clean(input.summary || input.change_summary, 4000);
  if (!sourceRevision) return { ok: false, error: 'CUSTOMER_REVISION_SOURCE_REVISION_REQUIRED', production_deploy: false };
  if (!summary) return { ok: false, error: 'CUSTOMER_REVISION_SUMMARY_REQUIRED', production_deploy: false };

  const next = mutate(state, 'CUSTOMER_REVISION_RECORDED', options, { source_revision: sourceRevision });
  const revision = {
    revision_id: clean(input.revision_id, 200) || `${state.scope_key}:revision:${Number(state.normal_revision_count || 0) + 1}`,
    round: Number(state.normal_revision_count || 0) + 1,
    source_revision: sourceRevision,
    summary,
    feedback_ids: (state.feedback || []).filter((item) => item.resolved !== true && item.type !== 'SCOPE_EXPANSION').map((item) => item.feedback_id),
    created_at: next.updated_at,
    production_deploy: false
  };
  next.normal_revision_count = revision.round;
  next.revisions = [...(next.revisions || []), revision];
  next.feedback = (next.feedback || []).map((item) => revision.feedback_ids.includes(item.feedback_id)
    ? { ...item, resolved: true, resolved_by_revision_id: revision.revision_id }
    : item);
  next.current_preview = null;
  next.approvals = revokeApprovals(next.approvals, 'REVISION_RECORDED', next.review_revision);
  next.status = 'AWAITING_PRIVATE_PREVIEW';

  return { ok: true, state: next, revision: clone(revision), production_deploy: false };
}

export function approveCustomerReviewV1(state = {}, input = {}, options = {}) {
  const scope = assertState(state, input);
  if (!scope.ok) return { ...scope, production_deploy: false };
  if (state.status !== 'CUSTOMER_REVIEW') {
    return { ok: false, error: 'CUSTOMER_REVIEW_NOT_READY_FOR_APPROVAL', status: state.status, production_deploy: false };
  }
  if (!state.current_preview?.private_access_verified || !state.current_preview?.human_outcome_accepted) {
    return { ok: false, error: 'CUSTOMER_REVIEW_ACCEPTABLE_PREVIEW_REQUIRED', production_deploy: false };
  }
  const unresolved = (state.feedback || []).filter((item) => item.resolved !== true);
  if (unresolved.length) {
    return { ok: false, error: 'CUSTOMER_REVIEW_UNRESOLVED_FEEDBACK', feedback_ids: unresolved.map((item) => item.feedback_id), production_deploy: false };
  }

  const actorId = clean(input.actor_id || input.customer_actor_id, 160);
  const approval = createApprovalRecord({
    customer_id: state.customer_id,
    project_id: state.project_id,
    approval_type: CUSTOMER_DELIVERY_APPROVAL_TYPE_V1,
    actor_id: actorId,
    approval_id: clean(input.approval_id, 200) || `${state.scope_key}:${CUSTOMER_DELIVERY_APPROVAL_TYPE_V1}:${state.review_revision}:${actorId}`,
    granted: true,
    expires_at: input.expires_at || null,
    metadata: {
      review_revision: state.review_revision,
      preview_id: state.current_preview.preview_id,
      source_revision: state.current_preview.source_revision,
      normal_revision_count: state.normal_revision_count,
      approved_at: at(options.at)
    }
  });
  if (!approval.ok) return { ...approval, production_deploy: false };

  const next = mutate(state, 'CUSTOMER_REVIEW_APPROVED', options, { approval_id: approval.approval.approval_id });
  next.approvals = [...(next.approvals || []), approval.approval];
  next.status = 'CUSTOMER_APPROVED';
  next.customer_approved_preview_id = state.current_preview.preview_id;

  return { ok: true, state: next, approval: clone(approval.approval), production_deploy: false };
}

export function evaluateCustomerReviewLifecycleV1(state = {}, options = {}) {
  const scope = assertState(state);
  if (!scope.ok) return { ...scope, ready_for_delivery: false, production_deploy: false };

  const unresolved = (state.feedback || []).filter((item) => item.resolved !== true);
  const scopedApproval = evaluateApproval(state.approvals || [], {
    customer_id: state.customer_id,
    project_id: state.project_id,
    approval_type: CUSTOMER_DELIVERY_APPROVAL_TYPE_V1
  }, options.now || new Date());

  const blockers = [];
  if (!state.current_preview?.private_access_verified) blockers.push('PRIVATE_PREVIEW_REQUIRED');
  if (!state.current_preview?.human_outcome_accepted) blockers.push('HUMAN_OUTCOME_ACCEPTANCE_REQUIRED');
  if (unresolved.length) blockers.push('CUSTOMER_FEEDBACK_UNRESOLVED');
  if (state.status === 'SCOPE_REASSESSMENT_REQUIRED') blockers.push('SCOPE_REASSESSMENT_REQUIRED');
  if (state.status !== 'CUSTOMER_APPROVED') blockers.push('CUSTOMER_APPROVAL_REQUIRED');
  if (!scopedApproval.approved) blockers.push('SCOPED_CUSTOMER_APPROVAL_REQUIRED');

  return {
    ok: true,
    schema: 'aurentara.customer-review-lifecycle-evidence.v1',
    customer_id: state.customer_id,
    project_id: state.project_id,
    scope_key: state.scope_key,
    status: state.status,
    review_revision: state.review_revision,
    normal_revision_count: state.normal_revision_count,
    current_preview: clone(state.current_preview),
    unresolved_feedback_ids: unresolved.map((item) => item.feedback_id),
    approval: scopedApproval.approved ? scopedApproval.approval : null,
    approvals: clone(state.approvals || []),
    ready_for_delivery: blockers.length === 0,
    blockers,
    production_deploy: false
  };
}

export function customerReviewLifecycleV1Manifest() {
  return {
    schema: 'aurentara.customer-review-lifecycle.v1',
    flow: ['PRIVATE_PREVIEW', 'CUSTOMER_FEEDBACK', 'REVISION', 'CUSTOMER_APPROVAL'],
    private_preview_requires_human_outcome_acceptance: true,
    scope_expansion_is_normal_revision: false,
    scope_expansion_returns_to_delivery_contract: true,
    customer_approval_uses: 'riosystems.approval.v1',
    production_deploy: false,
    automatic_customer_communication: false
  };
}
