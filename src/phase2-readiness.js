import { projectOperatingLayerManifest } from './project-operating-layer.js';
import { projectBlueprintManifest } from './project-blueprint.js';
import { projectControlPlaneManifest } from './project-control-plane.js';
import { projectPortfolioManifest } from './project-portfolio.js';
import { projectDeliveryGateManifest } from './project-delivery-gate.js';
import { evaluatePhase1Readiness } from './runtime-readiness.js';

export function evaluatePhase2Readiness() {
  const phase1 = evaluatePhase1Readiness();
  const project = projectOperatingLayerManifest();
  const blueprint = projectBlueprintManifest();
  const control = projectControlPlaneManifest();
  const portfolio = projectPortfolioManifest();
  const delivery = projectDeliveryGateManifest();
  const checks = {
    phase1_runtime_foundation: phase1.status === 'ARCHITECTURE_COMPLETE',
    customer_project_lifecycle: project.customer_project_isolation === true && project.mission_binding === true,
    objective_to_capabilities: blueprint.deterministic_capability_mapping === true,
    governed_project_missions: control.phase1_runtime_governance_required_by_default === true,
    single_operator_portfolio: portfolio.single_operator_multi_customer === true,
    dashboard_snapshot_ready: portfolio.dashboard_snapshot_ready === true,
    structural_delivery_gate: delivery.external_activation_separate === true,
    production_disabled: phase1.production_deploy === false && [project, blueprint, control, portfolio, delivery].every((manifest) => manifest.production_deploy === false)
  };
  const blockers = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  return {
    ok: true,
    phase: 2,
    status: blockers.length ? 'INCOMPLETE' : 'ARCHITECTURE_COMPLETE',
    checks,
    blockers,
    ready: blockers.length === 0,
    production_deploy: false
  };
}

export function phase2ReadinessManifest() {
  return {
    version: 'riosystems.phase2.readiness.v1',
    scope: ['customer_project_operating_layer','capability_blueprints','governed_mission_binding','operator_portfolio','delivery_gate'],
    first_reference_flow: 'baeckerei-mueller',
    dashboard_contract_ready: true,
    real_provider_activation_required: false,
    production_deploy: false
  };
}
