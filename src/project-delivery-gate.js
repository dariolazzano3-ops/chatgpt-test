const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

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
  return {
    ok: true,
    scope_key: project.scope_key || null,
    blockers,
    ready_for_structural_delivery: blockers.length === 0,
    external_activation_separate: true,
    production_deploy: false
  };
}

export function createProjectHandoff(project = {}, evidence = {}) {
  const gate = evaluateProjectDelivery(project, evidence);
  if (!gate.ready_for_structural_delivery) return { ok: false, error: 'PROJECT_DELIVERY_NOT_READY', gate, production_deploy: false };
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
      production_deploy: false
    }
  };
}

export function projectDeliveryGateManifest() {
  return { version: 'riosystems.project-delivery-gate.v1', checks: ['capability_completion','mission_history','qa','scope','cost_reconciliation'], external_activation_separate: true, production_deploy: false };
}
