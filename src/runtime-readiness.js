import { runtimeGovernanceManifest } from './runtime-governance.js';
import { runtimeCostLedgerManifest } from './runtime-cost-ledger.js';
import { runtimeApprovalManifest } from './runtime-approvals.js';
import { runtimeProjectBoundaryManifest } from './runtime-project-boundary.js';
import { providerRuntimeManifest } from './provider-runtime.js';
import { runtimeControlPlaneManifest } from './runtime-control-plane.js';
import { missionPipelineManifest } from './mission-pipeline.js';

export function evaluatePhase1Readiness() {
  const governance = runtimeGovernanceManifest();
  const costs = runtimeCostLedgerManifest();
  const approvals = runtimeApprovalManifest();
  const boundary = runtimeProjectBoundaryManifest();
  const providers = providerRuntimeManifest();
  const controlPlane = runtimeControlPlaneManifest();
  const pipeline = missionPipelineManifest();

  const checks = {
    provider_registry: governance.features?.includes('provider_registry') === true,
    provider_fallback: governance.features?.includes('provider_fallback') === true && providers.health_aware_fallback === true,
    cost_budget_gate: governance.features?.includes('cost_budget_gate') === true,
    durable_cost_ledger: costs.supports?.includes('reserve') === true && costs.supports?.includes('settle') === true && costs.supports?.includes('release') === true,
    scoped_approvals: approvals.scope === 'customer_project' && approvals.supports_expiry === true,
    customer_project_isolation: governance.features?.includes('customer_project_isolation') === true && boundary.customer_project_isolation === true,
    code_owner_enforcement: boundary.code_owner_enforcement === true,
    shared_core_write_gate: boundary.shared_core_write_requires_approval === true,
    mission_pipeline_integration: controlPlane.mission_pipeline_integration === true && pipeline.runtime_governance_supported === true,
    fail_closed_runtime_gate: pipeline.runtime_governance_fail_closed_when_enabled === true,
    no_implicit_external_activation: governance.automatic_external_activation === false && controlPlane.automatic_external_activation === false && providers.implicit_external_execution === false,
    production_disabled: [governance, costs, approvals, boundary, providers, controlPlane, pipeline].every((item) => item.production_deploy === false)
  };

  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  return {
    ok: failed.length === 0,
    phase: 'RIOSYSTEMS_PHASE_1',
    status: failed.length === 0 ? 'ARCHITECTURE_COMPLETE' : 'NOT_READY',
    checks,
    failed_checks: failed,
    manifests: { governance, costs, approvals, boundary, providers, control_plane: controlPlane, mission_pipeline: pipeline },
    real_provider_activation_complete: false,
    production_deploy: false
  };
}

export function phase1ReadinessManifest() {
  return {
    version: 'riosystems.phase1.readiness.v1',
    completion_definition: 'runtime_architecture_and_governance_complete',
    excludes: ['real_provider_credentials', 'paid_provider_activation', 'production_deployment'],
    production_deploy: false
  };
}
