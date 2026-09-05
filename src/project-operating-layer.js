const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const PROJECT_STATES = ['DRAFT','READY','ACTIVE','PAUSED','DELIVERED','ARCHIVED'];
const ALLOWED_TRANSITIONS = {
  DRAFT: ['READY','ARCHIVED'],
  READY: ['ACTIVE','PAUSED','ARCHIVED'],
  ACTIVE: ['PAUSED','DELIVERED'],
  PAUSED: ['READY','ACTIVE','ARCHIVED'],
  DELIVERED: ['ARCHIVED'],
  ARCHIVED: []
};

export function createCustomerProject(input = {}) {
  const customerId = clean(input.customer_id, 120);
  const projectId = clean(input.project_id, 120);
  const name = clean(input.name || input.project_name, 180);
  if (!customerId || !projectId || !name) return { ok: false, error: 'CUSTOMER_PROJECT_IDENTITY_REQUIRED' };
  const budget = Math.max(0, finite(input.budget_cost_units, 0));
  return {
    ok: true,
    project: {
      schema_version: 'riosystems.customer-project.v1',
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      name,
      state: 'DRAFT',
      objective: clean(input.objective, 2000) || null,
      project_root: clean(input.project_root, 500) || `projects/${projectId}`,
      budget_cost_units: budget,
      capabilities: [],
      missions: [],
      deliveries: [],
      customer_review: null,
      audit: [{ event: 'PROJECT_CREATED', state: 'DRAFT', actor: clean(input.actor, 160) || 'system' }],
      production_deploy: false
    }
  };
}

export function transitionCustomerProject(project = {}, transition = {}) {
  const target = clean(transition.state, 40).toUpperCase();
  if (!PROJECT_STATES.includes(target)) return { ok: false, error: 'PROJECT_STATE_INVALID', state: target };
  const current = project.state || 'DRAFT';
  if (!(ALLOWED_TRANSITIONS[current] || []).includes(target)) return { ok: false, error: 'PROJECT_STATE_TRANSITION_NOT_ALLOWED', from: current, to: target };
  const next = clone(project);
  next.state = target;
  next.audit = [...(next.audit || []), { event: 'PROJECT_STATE_CHANGED', from: current, state: target, actor: clean(transition.actor, 160) || 'system', reason: clean(transition.reason, 500) || null }];
  return { ok: true, project: next };
}

export function assignProjectCapabilities(project = {}, capabilities = []) {
  const normalized = [];
  for (const item of capabilities) {
    if (!item || typeof item !== 'object') continue;
    const id = clean(item.id || item.capability, 120);
    if (!id || normalized.some((entry) => entry.id === id)) continue;
    normalized.push({
      id,
      factory: clean(item.factory || item.engine, 80) || null,
      required: item.required !== false,
      status: clean(item.status, 40).toUpperCase() || 'PLANNED',
      external_activation_required: item.external_activation_required === true,
      production_deploy: false
    });
  }
  const next = clone(project);
  next.capabilities = normalized;
  next.audit = [...(next.audit || []), { event: 'PROJECT_CAPABILITIES_ASSIGNED', count: normalized.length, actor: 'system' }];
  return { ok: true, project: next };
}

export function attachProjectMission(project = {}, mission = {}) {
  const missionId = clean(mission.mission_id, 180);
  if (!missionId) return { ok: false, error: 'MISSION_ID_REQUIRED' };
  if (mission.customer_id && mission.customer_id !== project.customer_id) return { ok: false, error: 'MISSION_CUSTOMER_SCOPE_MISMATCH' };
  if (mission.project_id && mission.project_id !== project.project_id) return { ok: false, error: 'MISSION_PROJECT_SCOPE_MISMATCH' };
  const next = clone(project);
  if (!(next.missions || []).some((entry) => entry.mission_id === missionId)) {
    next.missions = [...(next.missions || []), { mission_id: missionId, status: clean(mission.status, 60) || 'ATTACHED', source_revision: clean(mission.source_revision, 80) || null }];
    next.audit = [...(next.audit || []), { event: 'PROJECT_MISSION_ATTACHED', mission_id: missionId, actor: 'system' }];
  }
  return { ok: true, project: next };
}

export function recordProjectDelivery(project = {}, delivery = {}) {
  const deliveryId = clean(delivery.delivery_id || delivery.id, 180);
  if (!deliveryId) return { ok: false, error: 'DELIVERY_ID_REQUIRED' };
  const existing = (project.deliveries || []).find((item) => item.delivery_id === deliveryId);
  if (existing) {
    const sameMission = (existing.mission_id || null) === (clean(delivery.mission_id, 180) || null);
    if (!sameMission) return { ok: false, error: 'DELIVERY_IDEMPOTENCY_CONFLICT', delivery_id: deliveryId, production_deploy: false };
    return { ok: true, project: clone(project), changed: false, duplicate: true, delivery: clone(existing), production_deploy: false };
  }
  const next = clone(project);
  const record = {
    delivery_id: deliveryId,
    mission_id: clean(delivery.mission_id, 180) || null,
    structural_completion: delivery.structural_completion === true,
    external_activation_ready: delivery.external_activation_ready === true,
    standard_results: clone(delivery.standard_results || delivery.standard_delivery_results || []),
    actual_cost_eur: Number.isFinite(Number(delivery.actual_cost_eur)) ? Number(delivery.actual_cost_eur) : null,
    qa_result: clone(delivery.qa_result || delivery.quality || null),
    customer_review_state: clean(delivery.customer_review_state, 120) || null,
    preview: clean(delivery.preview, 2000) || null,
    evidence_refs: clone(delivery.evidence_refs || []),
    production_deploy: false
  };
  next.deliveries = [...(next.deliveries || []), record];
  next.audit = [...(next.audit || []), { event: 'PROJECT_DELIVERY_RECORDED', delivery_id: deliveryId, mission_id: record.mission_id, actor: 'system' }];
  return { ok: true, project: next, changed: true, duplicate: false, delivery: clone(record), production_deploy: false };
}

export function writeBackProjectDeliveryState(project = {}, delivery = {}, options = {}) {
  if (!project.customer_id || !project.project_id || !project.scope_key) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED', production_deploy: false };
  const deliveryProject = delivery.project || {};
  if (deliveryProject.customer_id && deliveryProject.customer_id !== project.customer_id) return { ok: false, error: 'DELIVERY_CUSTOMER_SCOPE_MISMATCH', production_deploy: false };
  if (deliveryProject.project_id && deliveryProject.project_id !== project.project_id) return { ok: false, error: 'DELIVERY_PROJECT_SCOPE_MISMATCH', production_deploy: false };
  if (deliveryProject.scope_key && deliveryProject.scope_key !== project.scope_key) return { ok: false, error: 'DELIVERY_SCOPE_KEY_MISMATCH', production_deploy: false };
  const deliveryId = clean(delivery.delivery_id || delivery.id, 180);
  if (!deliveryId) return { ok: false, error: 'DELIVERY_ID_REQUIRED', production_deploy: false };
  const beforeRevision = Math.max(0, Number(project.project_revision || 0));
  const recorded = recordProjectDelivery(project, {
    ...delivery,
    delivery_id: deliveryId,
    standard_results: delivery.standard_results || delivery.standard_delivery_results || []
  });
  if (!recorded.ok) return recorded;
  if (recorded.duplicate) {
    return {
      ok: true,
      project: recorded.project,
      changed: false,
      duplicate: true,
      project_revision_before: beforeRevision,
      project_revision_after: beforeRevision,
      delivery_ref: deliveryId,
      production_deploy: false
    };
  }
  const next = recorded.project;
  const standardResults = Array.isArray(delivery.standard_results || delivery.standard_delivery_results)
    ? clone(delivery.standard_results || delivery.standard_delivery_results)
    : [];
  next.capabilities = (next.capabilities || []).map((capability) => {
    const matches = standardResults.filter((result) =>
      result?.capability === capability.id
      || (capability.factory && result?.factory === capability.factory)
    );
    if (!matches.length) return capability;
    const completed = matches.every((result) =>
      result?.quality?.status === 'PASS'
      && result?.provider_truth_valid !== false
      && result?.next_action !== 'PROVIDER_TRUTH_REQUIRED'
    );
    return completed ? { ...capability, status: 'COMPLETED' } : capability;
  });
  if (delivery.mission_id) {
    next.missions = (next.missions || []).map((mission) =>
      mission.mission_id === delivery.mission_id
        ? { ...mission, status: delivery.structural_completion === true ? 'DELIVERED' : (mission.status || 'ATTACHED') }
        : mission
    );
  }
  const totalActualCost = standardResults.reduce((sum, result) => sum + (Number.isFinite(Number(result?.actual_cost_eur)) ? Number(result.actual_cost_eur) : 0), 0);
  next.project_revision = beforeRevision + 1;
  next.last_delivery_ref = deliveryId;
  next.last_actual_cost_eur = Number.isFinite(Number(delivery.actual_cost_eur)) ? Number(delivery.actual_cost_eur) : totalActualCost;
  next.last_quality = clone(delivery.qa_result || delivery.quality || null);
  if (delivery.structural_completion === true && next.state === 'ACTIVE') next.state = 'DELIVERED';
  next.audit = [...(next.audit || []), {
    event: 'PROJECT_DELIVERY_STATE_WRITTEN_BACK',
    delivery_id: deliveryId,
    mission_id: clean(delivery.mission_id, 180) || null,
    project_revision_before: beforeRevision,
    project_revision_after: next.project_revision,
    actor: clean(options.actor, 160) || 'system'
  }];
  return {
    ok: true,
    project: next,
    changed: true,
    duplicate: false,
    project_revision_before: beforeRevision,
    project_revision_after: next.project_revision,
    delivery_ref: deliveryId,
    production_deploy: false
  };
}

export function recordProjectCustomerReview(project = {}, review = {}, options = {}) {
  if (review?.schema !== 'aurentara.customer-review-lifecycle.v1') return { ok: false, error: 'CUSTOMER_REVIEW_LIFECYCLE_REQUIRED', production_deploy: false };
  if (review.customer_id !== project.customer_id || review.project_id !== project.project_id || review.scope_key !== project.scope_key) {
    return { ok: false, error: 'CUSTOMER_REVIEW_PROJECT_SCOPE_MISMATCH', production_deploy: false };
  }
  const next = clone(project);
  next.customer_review = clone(review);
  next.audit = [...(next.audit || []), {
    event: 'PROJECT_CUSTOMER_REVIEW_RECORDED',
    status: clean(review.status, 80) || null,
    review_revision: Number(review.review_revision || 0),
    actor: clean(options.actor, 160) || 'system'
  }];
  return { ok: true, project: next, production_deploy: false };
}

export function evaluateProjectReadiness(project = {}) {
  const blockers = [];
  if (!project.customer_id || !project.project_id) blockers.push('PROJECT_SCOPE_MISSING');
  if (!(project.capabilities || []).length) blockers.push('PROJECT_CAPABILITIES_MISSING');
  const required = (project.capabilities || []).filter((item) => item.required);
  if (required.some((item) => !item.factory)) blockers.push('CAPABILITY_FACTORY_BINDING_MISSING');
  if (project.budget_cost_units < 0) blockers.push('PROJECT_BUDGET_INVALID');
  return {
    ok: true,
    scope_key: project.scope_key || null,
    blockers,
    ready: blockers.length === 0,
    production_deploy: false
  };
}

export function projectOperatingLayerManifest() {
  return {
    version: 'riosystems.phase2.project-operating-layer.v1',
    lifecycle_states: PROJECT_STATES,
    customer_project_isolation: true,
    capability_portfolio: true,
    mission_binding: true,
    delivery_history: true,
    idempotent_delivery_writeback: true,
    standard_delivery_result_writeback: true,
    project_revision_writeback: true,
    customer_review_binding: true,
    production_deploy: false
  };
}
