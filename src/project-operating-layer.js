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
  const next = clone(project);
  next.deliveries = [...(next.deliveries || []), {
    delivery_id: deliveryId,
    mission_id: clean(delivery.mission_id, 180) || null,
    structural_completion: delivery.structural_completion === true,
    external_activation_ready: delivery.external_activation_ready === true,
    production_deploy: false
  }];
  next.audit = [...(next.audit || []), { event: 'PROJECT_DELIVERY_RECORDED', delivery_id: deliveryId, actor: 'system' }];
  return { ok: true, project: next };
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
    production_deploy: false
  };
}
