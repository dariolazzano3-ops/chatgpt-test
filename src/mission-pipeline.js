import { compileMissionPackage } from './mission-compiler.js';
import { evaluateMissionActivation } from './mission-activation-gate.js';
import { superviseMission } from './mission-supervisor.js';
import { aggregateMissionDelivery } from './mission-delivery-aggregator.js';

const clone = (value) => structuredClone(value ?? null);

function supervisorOptions(pkg, options = {}) {
  return {
    ...options.supervisor,
    business_contracts: clone(pkg.contracts?.business_contracts || {}),
    automation_contracts: clone(pkg.contracts?.automation_contracts || {}),
    ai_contracts: clone(pkg.contracts?.ai_contracts || {}),
    project_name: pkg.contracts?.web?.project_name || null,
    ai_runner: options.ai_runner || options.supervisor?.ai_runner,
    transport: options.automation_transport || options.supervisor?.transport,
    policy: options.automation_policy || options.supervisor?.policy,
    dispatch_web: options.dispatch_web || options.supervisor?.dispatch_web,
    observe_web: options.observe_web || options.supervisor?.observe_web,
    persist: options.persist || options.supervisor?.persist
  };
}

export async function runMissionPipeline(input = {}, options = {}) {
  const compiled = compileMissionPackage(input);
  if (!compiled.ok) return { ok: false, stage: 'compile', error: compiled.error };
  const pkg = compiled.package;
  const activationConfig = options.activation || {};
  const activation = evaluateMissionActivation(pkg, activationConfig);
  if (!activation.ok) return { ok: false, stage: 'activation_readiness', error: activation.error, package: pkg };

  const approvals = activationConfig.adapter_approvals || {};
  if (!activation.ready_for_supervised_execution) {
    return {
      ok: true,
      stage: 'waiting_for_approval',
      package: pkg,
      mission: pkg.mission,
      activation,
      delivery: aggregateMissionDelivery(pkg.mission, { activation }),
      user_action_required: true,
      production_deploy: false
    };
  }

  const supervised = await superviseMission(pkg.mission, approvals, supervisorOptions(pkg, options));
  const delivery = aggregateMissionDelivery(supervised.mission, { activation });
  const pending = supervised.pending_web_tasks?.length || supervised.ready_but_not_executed?.length;
  const stage = delivery.structural_completion ? 'completed' : pending ? 'waiting_for_external_or_resume' : 'stopped';

  return {
    ok: true,
    stage,
    package: pkg,
    mission: supervised.mission,
    activation,
    supervision: supervised,
    delivery,
    completed: delivery.structural_completion === true,
    external_activation_separate: delivery.external_activation_ready !== true,
    production_deploy: false
  };
}

export function missionPipelineManifest() {
  return {
    version: '5.0',
    input: 'single_high_level_mission',
    stages: ['compile', 'activation_readiness', 'supervise', 'aggregate_delivery'],
    engines: ['web', 'automation', 'ai', 'business'],
    durable_resume_supported: true,
    explicit_adapter_approvals_required: true,
    external_activation_separate: true,
    automatic_production_deploy: false,
    production_deploy: false
  };
}
