import { createCustomerProject, assignProjectCapabilities, evaluateProjectReadiness, attachProjectMission, recordProjectDelivery } from './project-operating-layer.js';
import { compileProjectBlueprint } from './project-blueprint.js';
import { runMissionPipeline } from './mission-pipeline.js';
import { createCustomerDeliveryContractV1 } from './customer-delivery-contract-v1.js';

const clone = (value) => structuredClone(value ?? null);

export function prepareCustomerProject(input = {}) {
  const created = createCustomerProject(input);
  if (!created.ok) return created;
  const blueprint = compileProjectBlueprint({ objective: input.objective || input.prompt || input.goal });
  if (!blueprint.ok) return blueprint;
  const assigned = assignProjectCapabilities(created.project, blueprint.blueprint.capabilities);

  const requestedCapabilities = Array.isArray(input.requested_capabilities) && input.requested_capabilities.length
    ? input.requested_capabilities
    : (assigned.project.capabilities || []).map((item) => item.id).filter(Boolean);
  const requiredCapabilities = Array.isArray(input.required_capabilities) && input.required_capabilities.length
    ? input.required_capabilities
    : (assigned.project.capabilities || []).filter((item) => item.required !== false).map((item) => item.id).filter(Boolean);

  const deliveryContract = createCustomerDeliveryContractV1({
    ...input,
    customer_id: assigned.project.customer_id,
    project_id: assigned.project.project_id,
    scope_key: assigned.project.scope_key,
    customer_problem: input.customer_problem || input.customer_wish || input.objective || input.prompt || input.goal,
    requested_capabilities: requestedCapabilities,
    required_capabilities: requiredCapabilities
  });
  if (!deliveryContract.ok) return deliveryContract;

  const project = { ...assigned.project, delivery_contract: deliveryContract.contract };
  const readiness = evaluateProjectReadiness(project);
  return {
    ok: true,
    project,
    blueprint: blueprint.blueprint,
    readiness,
    delivery_contract_readiness: deliveryContract.readiness,
    production_deploy: false
  };
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
  return {
    version: 'riosystems.phase2.project-control-plane.v1',
    project_to_mission_binding: true,
    customer_delivery_contract: 'aurentara.customer-delivery-contract.v1',
    customer_delivery_contract_draft_authoritative: false,
    phase1_runtime_governance_required_by_default: true,
    delivery_backpropagation: true,
    production_deploy: false
  };
}
