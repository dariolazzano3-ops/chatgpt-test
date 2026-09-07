import { createHash } from 'node:crypto';
import {
  createCustomerReviewLifecycleV1,
  registerPrivatePreviewV1,
  submitCustomerFeedbackV1,
  recordCustomerRevisionV1,
  approveCustomerReviewV1,
  evaluateCustomerReviewLifecycleV1
} from '../customer-review-lifecycle-v1.js';
import {
  evaluateProjectDelivery,
  createProjectHandoff
} from '../project-delivery-gate.js';
import { deriveJ12NextBestAction } from './next-best-action-v1.js';

export const J13_DELIVERY_STATES = Object.freeze([
  'PRE_DELIVERY_BLOCKED',
  'AWAITING_PRIVATE_PREVIEW',
  'CUSTOMER_REVIEW',
  'REVISION_REQUIRED',
  'SCOPE_REASSESSMENT_REQUIRED',
  'CUSTOMER_APPROVED',
  'STRUCTURAL_DELIVERY_READY',
  'HANDOFF_READY',
  'DELIVERY_PACKAGE_READY'
]);

export const J13_OPERATIONS = Object.freeze([
  'CREATE',
  'REGISTER_PRIVATE_PREVIEW',
  'SUBMIT_FEEDBACK',
  'RECORD_REVISION',
  'APPROVE_CUSTOMER_REVIEW',
  'EVALUATE_DELIVERY',
  'CREATE_HANDOFF',
  'CREATE_PACKAGE',
  'VERIFY_PACKAGE'
]);

const clean = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const clone = (v) => v == null ? v : structuredClone(v);
const arr = (v) => Array.isArray(v) ? v : [];

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((key) => [key, stable(v[key])]));
  }
  return v;
}

function sha256(v) {
  return createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
}

function projectIdentity(project = {}) {
  const customerId = clean(project.customer_id, 160);
  const projectId = clean(project.project_id, 160);
  const scopeKey = clean(project.scope_key, 320);
  if (!customerId || !projectId || scopeKey !== customerId + ':' + projectId) {
    return { ok: false, error: 'J13_PROJECT_SCOPE_REQUIRED' };
  }
  return { ok: true, customer_id: customerId, project_id: projectId, scope_key: scopeKey };
}

function lifecycleResult(ok, status, extra = {}) {
  return {
    ok,
    status,
    ...extra,
    automatic_customer_communication: false,
    automatic_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false,
    variable_cost_eur: 0
  };
}

function assertLifecycle(state = {}) {
  if (state?.schema !== 'riosystems.j13-delivery-lifecycle.v1') {
    return { ok: false, error: 'J13_DELIVERY_LIFECYCLE_REQUIRED' };
  }
  const identity = projectIdentity(state.project || {});
  if (!identity.ok || identity.scope_key !== state.scope_key) {
    return { ok: false, error: 'J13_DELIVERY_LIFECYCLE_SCOPE_INVALID' };
  }
  return { ok: true, identity };
}

function stateFromReview(reviewState = {}) {
  const s = clean(reviewState.status, 120).toUpperCase();
  if (J13_DELIVERY_STATES.includes(s)) return s;
  if (s === 'AWAITING_PRIVATE_PREVIEW') return 'AWAITING_PRIVATE_PREVIEW';
  if (s === 'CUSTOMER_REVIEW') return 'CUSTOMER_REVIEW';
  if (s === 'REVISION_REQUIRED') return 'REVISION_REQUIRED';
  if (s === 'SCOPE_REASSESSMENT_REQUIRED') return 'SCOPE_REASSESSMENT_REQUIRED';
  if (s === 'CUSTOMER_APPROVED') return 'CUSTOMER_APPROVED';
  return 'PRE_DELIVERY_BLOCKED';
}

function audit(state, event, detail = {}, options = {}) {
  const next = clone(state);
  next.updated_at = clean(options.at || new Date().toISOString(), 100);
  next.audit = [
    ...(next.audit || []),
    {
      event,
      at: next.updated_at,
      actor: clean(options.actor, 160) || null,
      scope_key: next.scope_key,
      ...clone(detail)
    }
  ];
  return next;
}

export function createJ13DeliveryLifecycle(project = {}, input = {}, options = {}) {
  const identity = projectIdentity(project);
  if (!identity.ok) return lifecycleResult(false, 'J13_PROJECT_SCOPE_REQUIRED', { error: identity.error });

  const preDeliveryEvidence = {
    ...(clone(input.pre_delivery_evidence || {})),
    project: {
      ...(clone(input.pre_delivery_evidence?.project || {})),
      ...clone(project),
      scope_key: identity.scope_key
    }
  };
  const j12 = input.j12?.schema === 'riosystems.j12-next-best-action.v1'
    ? clone(input.j12)
    : deriveJ12NextBestAction(preDeliveryEvidence);

  if (j12.status !== 'READY' || j12.primary_action?.code !== 'READY_FOR_DELIVERY_LIFECYCLE') {
    return lifecycleResult(false, 'PRE_DELIVERY_BLOCKED', {
      error: 'J13_J12_DELIVERY_HANDOFF_REQUIRED',
      scope_key: identity.scope_key,
      j12_next_best_action: clone(j12.primary_action || null),
      j12_status: j12.status || null
    });
  }

  const created = createCustomerReviewLifecycleV1({
    ...clone(project),
    delivery_contract: clone(project.delivery_contract || input.delivery_contract || null)
  }, options);
  if (!created.ok) {
    return lifecycleResult(false, 'J13_CUSTOMER_REVIEW_CREATE_FAILED', {
      error: created.error,
      customer_review_result: created
    });
  }

  const createdAt = clean(options.at || new Date().toISOString(), 100);
  const state = {
    schema: 'riosystems.j13-delivery-lifecycle.v1',
    scope_key: identity.scope_key,
    customer_id: identity.customer_id,
    project_id: identity.project_id,
    project: clone(project),
    status: 'AWAITING_PRIVATE_PREVIEW',
    review_state: clone(created.state),
    delivery_gate: null,
    handoff: null,
    delivery_package: null,
    j12_entry_evidence: clone(j12),
    created_at: createdAt,
    updated_at: createdAt,
    audit: [{
      event: 'J13_DELIVERY_LIFECYCLE_CREATED',
      at: createdAt,
      actor: clean(options.actor, 160) || null,
      scope_key: identity.scope_key,
      j12_action: j12.primary_action?.code || null
    }],
    safety: {
      automatic_customer_communication: false,
      automatic_execution: false,
      production_deploy: false,
      public_launch: false,
      dns_change: false,
      billing_activation: false,
      external_writes: false
    }
  };

  return lifecycleResult(true, 'AWAITING_PRIVATE_PREVIEW', { state });
}

export function registerJ13PrivatePreview(state = {}, input = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });
  const result = registerPrivatePreviewV1(state.review_state, {
    ...clone(input),
    customer_id: state.customer_id,
    project_id: state.project_id,
    scope_key: state.scope_key
  }, options);
  if (!result.ok) return lifecycleResult(false, 'J13_PRIVATE_PREVIEW_BLOCKED', { error: result.error, review_result: result });

  let next = audit(state, 'J13_PRIVATE_PREVIEW_REGISTERED', {
    preview_id: result.preview?.preview_id || null,
    source_revision: result.preview?.source_revision || null
  }, options);
  next.review_state = clone(result.state);
  next.status = stateFromReview(result.state);
  next.delivery_gate = null;
  next.handoff = null;
  next.delivery_package = null;
  return lifecycleResult(true, next.status, { state: next, preview: clone(result.preview) });
}

export function submitJ13CustomerFeedback(state = {}, input = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });
  const result = submitCustomerFeedbackV1(state.review_state, {
    ...clone(input),
    customer_id: state.customer_id,
    project_id: state.project_id,
    scope_key: state.scope_key
  }, options);
  if (!result.ok) return lifecycleResult(false, 'J13_FEEDBACK_BLOCKED', { error: result.error, review_result: result });

  let next = audit(state, 'J13_CUSTOMER_FEEDBACK_RECORDED', {
    feedback_id: result.feedback?.feedback_id || null,
    feedback_type: result.feedback?.type || null
  }, options);
  next.review_state = clone(result.state);
  next.status = stateFromReview(result.state);
  next.delivery_gate = null;
  next.handoff = null;
  next.delivery_package = null;
  return lifecycleResult(true, next.status, {
    state: next,
    feedback: clone(result.feedback),
    scope_expansion: result.scope_expansion === true
  });
}

export function recordJ13CustomerRevision(state = {}, input = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });
  const result = recordCustomerRevisionV1(state.review_state, {
    ...clone(input),
    customer_id: state.customer_id,
    project_id: state.project_id,
    scope_key: state.scope_key
  }, options);
  if (!result.ok) {
    return lifecycleResult(false,
      result.error === 'SCOPE_EXPANSION_REQUIRES_DELIVERY_CONTRACT_REASSESSMENT'
        ? 'SCOPE_REASSESSMENT_REQUIRED'
        : 'J13_REVISION_BLOCKED',
      { error: result.error, review_result: result }
    );
  }

  let next = audit(state, 'J13_CUSTOMER_REVISION_RECORDED', {
    revision_id: result.revision?.revision_id || null,
    source_revision: result.revision?.source_revision || null
  }, options);
  next.review_state = clone(result.state);
  next.status = stateFromReview(result.state);
  next.delivery_gate = null;
  next.handoff = null;
  next.delivery_package = null;
  return lifecycleResult(true, next.status, { state: next, revision: clone(result.revision) });
}

export function approveJ13CustomerReview(state = {}, input = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });
  const result = approveCustomerReviewV1(state.review_state, {
    ...clone(input),
    customer_id: state.customer_id,
    project_id: state.project_id,
    scope_key: state.scope_key
  }, options);
  if (!result.ok) return lifecycleResult(false, 'J13_CUSTOMER_APPROVAL_BLOCKED', { error: result.error, review_result: result });

  let next = audit(state, 'J13_CUSTOMER_REVIEW_APPROVED', {
    approval_id: result.approval?.approval_id || null
  }, options);
  next.review_state = clone(result.state);
  next.status = stateFromReview(result.state);
  next.delivery_gate = null;
  next.handoff = null;
  next.delivery_package = null;
  return lifecycleResult(true, next.status, { state: next, approval: clone(result.approval) });
}

export function evaluateJ13Delivery(state = {}, evidence = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });

  const customerReview = evaluateCustomerReviewLifecycleV1(state.review_state, {
    now: options.now || evidence.now || new Date()
  });
  const gate = evaluateProjectDelivery(state.project, {
    ...clone(evidence),
    customer_review: customerReview,
    production_deploy: false
  });

  let next = audit(state, 'J13_DELIVERY_GATE_EVALUATED', {
    ready: gate.ready_for_structural_delivery === true,
    blocker_count: arr(gate.blockers).length
  }, options);
  next.delivery_gate = clone(gate);
  if (gate.ready_for_structural_delivery) next.status = 'STRUCTURAL_DELIVERY_READY';
  else next.status = stateFromReview(next.review_state);

  return lifecycleResult(true, next.status, {
    state: next,
    customer_review_evidence: customerReview,
    gate
  });
}

export function createJ13Handoff(state = {}, evidence = {}, options = {}) {
  const evaluated = evaluateJ13Delivery(state, evidence, options);
  if (!evaluated.ok) return evaluated;
  if (evaluated.gate.ready_for_structural_delivery !== true) {
    return lifecycleResult(false, 'J13_DELIVERY_NOT_READY', {
      error: 'PROJECT_DELIVERY_NOT_READY',
      gate: evaluated.gate,
      state: evaluated.state
    });
  }

  const handoff = createProjectHandoff(evaluated.state.project, {
    ...clone(evidence),
    customer_review: evaluated.state.review_state,
    production_deploy: false
  });
  if (!handoff.ok) {
    return lifecycleResult(false, 'J13_HANDOFF_BLOCKED', {
      error: handoff.error,
      gate: handoff.gate || evaluated.gate
    });
  }

  let next = audit(evaluated.state, 'J13_HANDOFF_CREATED', {
    handoff_version: handoff.handoff?.handoff_version || null
  }, options);
  next.handoff = clone(handoff.handoff);
  next.status = 'HANDOFF_READY';

  return lifecycleResult(true, 'HANDOFF_READY', {
    state: next,
    handoff: clone(handoff.handoff),
    gate: clone(evaluated.gate)
  });
}

export function createJ13DeliveryPackage(state = {}, input = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });
  if (state.status !== 'HANDOFF_READY' || !state.handoff) {
    return lifecycleResult(false, 'J13_HANDOFF_REQUIRED', { error: 'J13_HANDOFF_REQUIRED' });
  }

  const artifacts = arr(input.artifacts).map((item) => ({
    artifact_ref: clean(item.artifact_ref || item.ref, 1200),
    sha256: clean(item.sha256 || item.artifact_hash, 128).toLowerCase(),
    kind: clean(item.kind || item.type, 120) || 'ARTIFACT',
    revision: clean(item.revision, 240) || null
  })).filter((item) => item.artifact_ref && /^[a-f0-9]{64}$/.test(item.sha256));

  if (!artifacts.length) {
    return lifecycleResult(false, 'J13_DELIVERY_ARTIFACTS_REQUIRED', {
      error: 'J13_ACCEPTED_DELIVERY_ARTIFACT_REF_AND_HASH_REQUIRED'
    });
  }

  const customerReview = evaluateCustomerReviewLifecycleV1(state.review_state, {
    now: options.now || new Date()
  });
  if (customerReview.ready_for_delivery !== true) {
    return lifecycleResult(false, 'J13_CUSTOMER_APPROVAL_REQUIRED', {
      error: 'J13_CUSTOMER_REVIEW_NOT_READY',
      customer_review: customerReview
    });
  }

  const createdAt = clean(options.at || new Date().toISOString(), 100);
  const payload = {
    schema: 'riosystems.j13-delivery-package.v1',
    package_id: clean(input.package_id, 240) || state.scope_key + ':delivery-package:' + String(state.review_state?.review_revision || 1),
    scope_key: state.scope_key,
    customer_id: state.customer_id,
    project_id: state.project_id,
    handoff: clone(state.handoff),
    customer_review: clone(customerReview),
    artifacts,
    source_revision: clean(input.source_revision, 240) || null,
    knowledge_revision: clean(input.knowledge_revision, 240) || null,
    reference_version: clean(input.reference_version, 240) || null,
    j10_revision_id: clean(input.j10_revision_id, 240) || null,
    j9_acceptance_ref: clean(input.j9_acceptance_ref, 1000) || null,
    visual_acceptance_ref: clean(input.visual_acceptance_ref, 1000) || null,
    created_at: createdAt,
    immutable: true,
    external_activation_separate: true,
    automatic_customer_communication: false,
    production_deploy: false,
    public_launch: false
  };
  const packageHash = sha256(payload);
  const deliveryPackage = { ...payload, package_sha256: packageHash };

  let next = audit(state, 'J13_DELIVERY_PACKAGE_CREATED', {
    package_id: deliveryPackage.package_id,
    package_sha256: packageHash,
    artifact_count: artifacts.length
  }, options);
  next.delivery_package = clone(deliveryPackage);
  next.status = 'DELIVERY_PACKAGE_READY';

  return lifecycleResult(true, 'DELIVERY_PACKAGE_READY', {
    state: next,
    delivery_package: clone(deliveryPackage)
  });
}

export function verifyJ13DeliveryPackage(deliveryPackage = {}) {
  if (deliveryPackage?.schema !== 'riosystems.j13-delivery-package.v1') {
    return lifecycleResult(false, 'J13_DELIVERY_PACKAGE_INVALID', { error: 'J13_DELIVERY_PACKAGE_REQUIRED' });
  }
  const expected = clean(deliveryPackage.package_sha256, 128).toLowerCase();
  const payload = clone(deliveryPackage);
  delete payload.package_sha256;
  const actual = sha256(payload);
  const artifactIssues = arr(deliveryPackage.artifacts).filter((item) =>
    !clean(item.artifact_ref, 1200) || !/^[a-f0-9]{64}$/.test(clean(item.sha256, 128).toLowerCase())
  );
  const valid = expected === actual && artifactIssues.length === 0;
  return lifecycleResult(valid, valid ? 'J13_DELIVERY_PACKAGE_VERIFIED' : 'J13_DELIVERY_PACKAGE_TAMPERED', {
    expected_sha256: expected || null,
    actual_sha256: actual,
    artifact_issue_count: artifactIssues.length,
    immutable: true
  });
}

export function inspectJ13DeliveryLifecycle(state = {}, options = {}) {
  const valid = assertLifecycle(state);
  if (!valid.ok) return lifecycleResult(false, 'J13_INVALID_STATE', { error: valid.error });
  const customerReview = evaluateCustomerReviewLifecycleV1(state.review_state, {
    now: options.now || new Date()
  });
  return lifecycleResult(true, state.status, {
    scope_key: state.scope_key,
    review_status: state.review_state?.status || null,
    customer_review_ready: customerReview.ready_for_delivery === true,
    customer_review_blockers: clone(customerReview.blockers || []),
    structural_delivery_ready: state.delivery_gate?.ready_for_structural_delivery === true,
    handoff_ready: Boolean(state.handoff),
    delivery_package_ready: Boolean(state.delivery_package),
    delivery_package_verified: state.delivery_package
      ? verifyJ13DeliveryPackage(state.delivery_package).ok
      : false
  });
}

export function j13DeliveryLifecycleManifest() {
  return {
    schema: 'riosystems.j13-delivery-lifecycle-manifest.v1',
    states: [...J13_DELIVERY_STATES],
    operations: [...J13_OPERATIONS],
    j12_entry_gate_required: 'READY_FOR_DELIVERY_LIFECYCLE',
    existing_customer_review_lifecycle_reused: true,
    existing_customer_feedback_classifier_reused: true,
    existing_customer_approval_engine_reused: true,
    existing_project_delivery_gate_reused: true,
    existing_project_handoff_reused: true,
    scope_expansion_returns_to_delivery_contract: true,
    normal_revision_loop_supported: true,
    private_preview_required: true,
    human_outcome_acceptance_required: true,
    immutable_delivery_package: true,
    delivery_package_sha256: true,
    accepted_artifact_ref_and_hash_required: true,
    external_activation_separate: true,
    automatic_customer_communication: false,
    automatic_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}
