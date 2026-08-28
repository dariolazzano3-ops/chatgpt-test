import { compileMissionPackage } from './mission-compiler.js';
import { evaluateMissionActivation } from './mission-activation-gate.js';
import { superviseMission } from './mission-supervisor.js';
import { aggregateMissionDelivery } from './mission-delivery-aggregator.js';
import { resolveAndValidateSourceOfTruth } from './source-of-truth.js';
import { evaluateMissionRuntime } from './runtime-control-plane.js';
import { buildFactoryIntegrationPlan } from './factory-integration-bridge.js';

const clone = (value) => structuredClone(value ?? null);

function supervisorOptions(pkg, options = {}) {
  const base = options.supervisor || {};
  const aiRunner = options.ai_runner || base.ai_runner || base.ai?.runner;
  const automationTransport = options.automation_transport || base.transport || base.automation?.transport;
  const automationPolicy = options.automation_policy || base.policy || base.automation?.policy;
  return {
    ...base,
    business_contracts: clone(pkg.contracts?.business_contracts || {}),
    automation_contracts: clone(pkg.contracts?.automation_contracts || {}),
    ai_contracts: clone(pkg.contracts?.ai_contracts || {}),
    project_name: pkg.contracts?.web?.project_name || null,
    ai: { ...(base.ai || {}), runner: aiRunner },
    automation: { ...(base.automation || {}), transport: automationTransport, policy: automationPolicy },
    dispatch_web: options.dispatch_web || base.dispatch_web,
    observe_web: options.observe_web || base.observe_web,
    persist: options.persist || base.persist
  };
}

async function validateMissionRevision(pkg, options = {}) {
  const revision = options.revision || {};
  return resolveAndValidateSourceOfTruth(pkg.source_of_truth || pkg.mission?.source_of_truth || {}, {
    observed: {
      project_head: options.project_head || revision.project_head || null,
      active_revision: options.active_revision || revision.active_revision || null
    },
    resolve_project_head: options.resolve_project_head || revision.resolve_project_head
  });
}

export async function runMissionPipeline(input = {}, options = {}) {
  const compiled = compileMissionPackage(input);
  if (!compiled.ok) return { ok: false, stage: 'compile', error: compiled.error, details: compiled };
  const pkg = compiled.package;

  const revisionCheck = await validateMissionRevision(pkg, options);
  if (!revisionCheck.ok) {
    return {
      ok: false,
      stage: 'source_of_truth',
      error: revisionCheck.code || revisionCheck.error || 'SOURCE_OF_TRUTH_BLOCKED',
      package: pkg,
      source_of_truth: revisionCheck,
      user_action_required: true,
      completed: false,
      production_deploy: false
    };
  }

  let runtime = null;
  if (options.runtime?.enabled === true) {
    runtime = evaluateMissionRuntime(pkg, options.runtime);
    if (!runtime.ok || runtime.blocked) {
      return {
        ok: runtime.ok === true,
        stage: 'waiting_for_runtime_governance',
        error: runtime.ok ? null : runtime.error,
        package: pkg,
        mission: pkg.mission,
        source_of_truth: revisionCheck,
        runtime,
        user_action_required: true,
        completed: false,
        production_deploy: false
      };
    }
  }

  let integrations = null;
  if (options.integrations?.enabled === true) {
    const integrationConfig = options.integrations;
    if (!integrationConfig.catalog?.catalog_version) {
      return { ok: false, stage: 'integration_planning', error: 'INTEGRATION_CATALOG_REQUIRED', package: pkg, mission: pkg.mission, source_of_truth: revisionCheck, runtime, completed: false, production_deploy: false };
    }
    integrations = buildFactoryIntegrationPlan(pkg.mission, integrationConfig.catalog, {
      credentials_required: integrationConfig.credentials_required,
      cost_approved: integrationConfig.cost_approved === true,
      external_write_approved: integrationConfig.external_write_approved === true,
      provider_activation_approved: integrationConfig.provider_activation_approved === true,
      supervised_execution_approved: false,
      provider_requirements: integrationConfig.provider_requirements || {},
      preferred_integrations: integrationConfig.preferred_integrations || {},
      execution_mode: 'dry_run',
      production_deploy: false
    });
    if (!integrations.ready_for_supervised_integrations) {
      return { ok: true, stage: 'waiting_for_provider_activation', package: pkg, mission: pkg.mission, source_of_truth: revisionCheck, runtime, integrations, user_action_required: true, completed: false, production_deploy: false };
    }
  }

  const activationConfig = options.activation || {};
  const activation = evaluateMissionActivation(pkg, activationConfig);
  if (!activation.ok) return { ok: false, stage: 'activation_readiness', error: activation.error, package: pkg, source_of_truth: revisionCheck, runtime, integrations, production_deploy: false };
  const approvals = activationConfig.adapter_approvals || {};
  if (!activation.ready_for_supervised_execution) return { ok: true, stage: 'waiting_for_approval', package: pkg, mission: pkg.mission, source_of_truth: revisionCheck, runtime, integrations, activation, delivery: aggregateMissionDelivery(pkg.mission, { activation }), user_action_required: true, production_deploy: false };
  const supervised = await superviseMission(pkg.mission, approvals, supervisorOptions(pkg, options));
  if (!supervised?.ok) {
    return { ok: false, stage: 'supervision_failed', error: supervised?.error || 'MISSION_SUPERVISION_FAILED', package: pkg, mission: supervised?.mission || pkg.mission, source_of_truth: revisionCheck, runtime, integrations, activation, supervision: supervised || null, completed: false, production_deploy: false };
  }
  const delivery = aggregateMissionDelivery(supervised.mission, { activation });
  const pending = supervised.pending_web_tasks?.length || supervised.ready_but_not_executed?.length;
  return { ok: true, stage: delivery.structural_completion ? 'completed' : pending ? 'waiting_for_external_or_resume' : 'stopped', package: pkg, mission: supervised.mission, source_of_truth: revisionCheck, runtime, integrations, activation, supervision: supervised, delivery, completed: delivery.structural_completion === true, external_activation_separate: delivery.external_activation_ready !== true, production_deploy: false };
}

export function missionPipelineManifest() {
  return {
    version: '5.0',
    engine_revision: 'max-source-of-truth-1+riosystems-real-provider-bridge-v2',
    input: 'single_high_level_mission',
    stages: ['compile','source_of_truth','runtime_governance_optional','real_provider_planning_optional','activation_readiness','supervise','aggregate_delivery'],
    engines: ['web','automation','ai','business'],
    durable_resume_supported: true,
    revision_bound_execution_supported: true,
    stale_revision_execution_blocked: true,
    runtime_governance_supported: true,
    runtime_governance_fail_closed_when_enabled: true,
    real_provider_planning_supported: true,
    real_provider_execution_implicit: false,
    supervisor_failures_propagated: true,
    explicit_adapter_approvals_required: true,
    external_activation_separate: true,
    automatic_production_deploy: false,
    production_deploy: false
  };
}
