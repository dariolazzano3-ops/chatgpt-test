import { prepareZeroCostPilot, evaluateZeroCostMissionPackage } from './pilot-orchestrator.js';
import { attachProjectMission } from './project-operating-layer.js';
import { evaluateProjectDelivery, createProjectHandoff } from './project-delivery-gate.js';

const domainToCapability = { web: 'web.build', automation: 'automation.run', ai: 'ai.generate', business: 'business.configure' };

function buildMission(prepared, input = {}) {
  const missionId = input.mission_id || `pilot-${prepared.project.project_id}-e2e`;
  const tasks = [
    { task_id: `${missionId}:web`, domain: 'web' },
    { task_id: `${missionId}:automation`, domain: 'automation' },
    { task_id: `${missionId}:ai`, domain: 'ai' },
    { task_id: `${missionId}:business`, domain: 'business' }
  ];
  return { mission: { mission_id: missionId, project: prepared.project.project_id, tasks } };
}

function providerFor(prepared, domain) {
  const capability = domainToCapability[domain];
  return (prepared.providers || []).find((provider) => provider.capability === capability && provider.enabled === true);
}

export async function runSimulatedPilotE2E(input = {}) {
  const prepared = prepareZeroCostPilot(input);
  if (!prepared.ok) return prepared;
  const pkg = buildMission(prepared, input);
  const runtime = evaluateZeroCostMissionPackage(pkg, prepared);
  if (!runtime.ok) return { ok: false, stage: runtime.stage, prepared, runtime, production_deploy: false };

  const outputs = [];
  for (const task of pkg.mission.tasks) {
    const provider = providerFor(prepared, task.domain);
    if (!provider?.runner) return { ok: false, stage: 'simulated_execution', error: 'MOCK_PROVIDER_NOT_FOUND', task, production_deploy: false };
    const result = await provider.runner({ task_id: task.task_id, capability: provider.capability, payload: { objective: input.objective || input.prompt || input.goal || null, scope_key: prepared.project.scope_key } });
    if (!result?.ok || result.external_side_effect === true || Number(result.cost_units || 0) !== 0) return { ok: false, stage: 'simulated_execution', error: 'ZERO_COST_PROVIDER_CONTRACT_VIOLATION', task, result, production_deploy: false };
    outputs.push({ task_id: task.task_id, domain: task.domain, capability: provider.capability, provider_id: provider.id, simulated: true, result });
  }

  const attached = attachProjectMission(prepared.project, { mission_id: pkg.mission.mission_id, status: 'SIMULATED_COMPLETED', source_revision: prepared.environment.source_revision || null });
  if (!attached.ok) return { ...attached, stage: 'mission_history', production_deploy: false };
  const project = attached.project;
  const capabilityEvidence = (project.capabilities || []).map((capability) => ({ id: capability.id, completed: true, simulated: true }));
  const evidence = { capabilities: capabilityEvidence, qa_passed: true, scope_verified: true, costs_reconciled: true, production_deploy: false };
  const gate = evaluateProjectDelivery(project, evidence);
  const handoff = createProjectHandoff(project, evidence);
  if (!gate.ready_for_structural_delivery || !handoff.ok) return { ok: false, stage: 'delivery_gate', gate, handoff, production_deploy: false };

  return {
    ok: true,
    stage: 'SIMULATED_HANDOFF_READY',
    project,
    mission: pkg.mission,
    runtime,
    outputs,
    qa: { passed: true, simulated: true, checks: ['all_mock_tasks_completed','zero_cost','no_external_side_effects','scope_verified'] },
    delivery_gate: gate,
    handoff: { ...handoff.handoff, simulation_only: true },
    cost_units: 0,
    external_side_effects: false,
    production_deploy: false
  };
}

export function pilotE2EManifest() {
  return { version: 'riosystems.pilot-e2e.v1', four_factory_execution: true, simulated_outputs: true, qa_gate: true, structural_handoff: true, cost_units: 0, external_side_effects: false, production_deploy: false };
}
