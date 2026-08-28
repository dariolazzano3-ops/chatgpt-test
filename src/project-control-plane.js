import { createCustomerProject, assignProjectCapabilities, evaluateProjectReadiness, attachProjectMission, recordProjectDelivery } from './project-operating-layer.js';
import { compileProjectBlueprint } from './project-blueprint.js';
import { runMissionPipeline } from './mission-pipeline.js';

const clone = (value) => structuredClone(value ?? null);

export function prepareCustomerProject(input = {}) {
  const created = createCustomerProject(input);
  if (!created.ok) return created;
  const blueprint = compileProjectBlueprint({ objective: input.objective || input.prompt || input.goal });
  if (!blueprint.ok) return blueprint;
  const assigned = assignProjectCapabilities(created.project, blueprint.blueprint.capabilities);
  const readiness = evaluateProjectReadiness(assigned.project);
  return { ok: true, project: assigned.project, blueprint: blueprint.blueprint, readiness, production_deploy: false };
}

export async function runCustomerProjectMission(project = {}, missionInput = {}, options = {}) {
  const readiness = evaluateProjectReadiness(project);
  if (!readiness.ready) return { ok: false, stage: 'project_readiness', readiness, project, production_deploy: false };
  const input = {
    ...missionInput,
    project: missionInput.project || project.project_id,
    project_name: missionInput.project_name || project.name,
    customer_id: project.customer_id,
    project_id: project.project_id
  };
  const runtime = {
    ...(options.runtime || {}),
    enabled: options.runtime?.enabled !== false,
    project: { customer_id: project.customer_id, project_id: project.project_id },
    budget: options.runtime?.budget || { remaining_cost_units: project.budget_cost_units }
  };
  const result = await runMissionPipeline(input, { ...options, runtime });
  let next = clone(project);
  if (result.mission?.mission_id) {
    const attached = attachProjectMission(next, { mission_id: result.mission.mission_id, status: result.stage, source_revision: result.source_of_truth?.expected_project_head || null });
    if (attached.ok) next = attached.project;
  }
  if (result.delivery) {
    const deliveryId = result.delivery.delivery_id || `${result.mission?.mission_id || 'mission'}:delivery`;
    const recorded = recordProjectDelivery(next, { delivery_id: deliveryId, mission_id: result.mission?.mission_id, structural_completion: result.delivery.structural_completion, external_activation_ready: result.delivery.external_activation_ready });
    if (recorded.ok) next = recorded.project;
  }
  return { ok: result.ok !== false, project: next, mission_result: result, production_deploy: false };
}

export function projectControlPlaneManifest() {
  return { version: 'riosystems.phase2.project-control-plane.v1', project_to_mission_binding: true, phase1_runtime_governance_required_by_default: true, delivery_backpropagation: true, production_deploy: false };
}
