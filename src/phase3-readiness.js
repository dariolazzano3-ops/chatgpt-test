import { executionDeliveryOperationsManifest } from './execution-delivery-operations.js';
import { phase2ReadinessManifest } from './phase2-readiness.js';
import { projectDeliveryGateManifest } from './project-delivery-gate.js';
import { missionPipelineManifest } from './mission-pipeline.js';

export function evaluatePhase3Readiness() {
  const phase2 = phase2ReadinessManifest();
  const execution = executionDeliveryOperationsManifest();
  const delivery = projectDeliveryGateManifest();
  const pipeline = missionPipelineManifest();
  const checks = {
    phase2_complete_contract: phase2.production_deploy === false,
    execution_runs: execution.supports?.includes('execution_runs') === true,
    checkpoints: execution.supports?.includes('checkpoints') === true,
    bounded_recovery: execution.supports?.includes('bounded_recovery') === true,
    qa_gate: execution.supports?.includes('qa_gate') === true,
    delivery_handoff: execution.supports?.includes('delivery_handoff') === true,
    durable_resume: execution.durable_resume_contract === true && pipeline.durable_resume_supported === true,
    structural_delivery_gate: delivery.checks?.includes('qa') === true && delivery.checks?.includes('cost_reconciliation') === true,
    external_activation_separate: execution.external_activation_separate === true && delivery.external_activation_separate === true,
    production_disabled: [phase2, execution, delivery, pipeline].every((item) => item.production_deploy === false)
  };
  const blockers = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  return { ok: true, phase: 3, status: blockers.length ? 'INCOMPLETE' : 'ARCHITECTURE_COMPLETE', ready: blockers.length === 0, checks, blockers, production_deploy: false };
}

export function phase3ReadinessManifest() {
  return {
    version: 'riosystems.phase3.readiness.v1',
    scope: ['execution_runs','checkpoints','recovery','qa','delivery_handoffs'],
    external_activation_separate: true,
    production_deploy: false
  };
}
