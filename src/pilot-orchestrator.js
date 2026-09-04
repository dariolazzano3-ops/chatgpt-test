import { createZeroCostPilot, evaluatePilotAction } from './zero-cost-pilot.js';
import { createPilotEnvironment, evaluatePilotEnvironment } from './pilot-environment.js';
import { createZeroCostMockProviders } from './pilot-mock-providers.js';
import { prepareCustomerProject } from './project-control-plane.js';
import { evaluateMissionRuntime } from './runtime-control-plane.js';

export function prepareZeroCostPilot(input = {}) {
  const pilot = createZeroCostPilot(input);
  if (!pilot.ok) return pilot;
  const environment = createPilotEnvironment(input);
  if (!environment.ok) return environment;
  const envReadiness = evaluatePilotEnvironment(environment.environment);
  if (!envReadiness.ready) return { ok: false, error: 'PILOT_ENVIRONMENT_BLOCKED', environment: environment.environment, readiness: envReadiness, production_deploy: false };

  const project = prepareCustomerProject({
    customer_id: input.customer_id,
    project_id: input.project_id,
    name: input.name || input.project_id,
    objective: input.objective || input.prompt || input.goal,
    budget_cost_units: 0,
    customer_review_required: false,
    actor: input.actor || 'operator'
  });
  if (!project.ok) return project;

  return {
    ok: true,
    pilot: pilot.pilot,
    environment: environment.environment,
    project: project.project,
    blueprint: project.blueprint,
    providers: createZeroCostMockProviders(),
    customer_review_exclusion: 'INTERNAL_SYNTHETIC_ZERO_COST_PILOT',
    production_deploy: false
  };
}

export function evaluateZeroCostMissionPackage(pkg = {}, prepared = {}) {
  const actionGate = evaluatePilotAction(prepared.pilot, { estimated_cost: 0, paid: false, external_write: false, production: false, public_access: false });
  if (!actionGate.ok) return { ok: false, stage: 'pilot_gate', gate: actionGate, production_deploy: false };
  const runtime = evaluateMissionRuntime(pkg, {
    project: { customer_id: prepared.project?.customer_id, project_id: prepared.project?.project_id },
    providers: prepared.providers || [],
    limit_cost_units: 0,
    approvals: [],
    project_root: prepared.project?.project_root
  });
  return {
    ok: runtime.ok === true && runtime.blocked !== true,
    stage: runtime.blocked ? 'waiting_for_runtime_governance' : 'zero_cost_runtime_ready',
    runtime,
    cost_units_reserved: runtime.ledger?.reserved_cost_units || 0,
    external_side_effects_allowed: false,
    production_deploy: false
  };
}

export function pilotOrchestratorManifest() {
  return {
    version: 'riosystems.pilot-orchestrator.v1',
    source_revision_pinned: true,
    mock_provider_coverage: ['web','automation','ai','business'],
    paid_budget: 0,
    external_writes: false,
    public_access: false,
    customer_review_required: false,
    customer_review_exclusion: 'INTERNAL_SYNTHETIC_ZERO_COST_PILOT',
    production_deploy: false
  };
}
