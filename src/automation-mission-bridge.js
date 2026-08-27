import { buildTaskExecutionContract, transitionMissionTask } from './orchestration-state.js';
import { authorizeAdapterDispatch, buildAdapterDispatchEnvelope, validateAdapterResult } from './execution-adapters.js';
import { executeSupervisedAutomation } from './automation-supervised-runner.js';

const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);

export function prepareAutomationMissionTask(mission, taskId, automationContract = {}, approval = {}, options = {}) {
  const contract = buildTaskExecutionContract(mission, taskId);
  if (!contract.ok) return contract;
  const rawEnvelope = buildAdapterDispatchEnvelope(contract);
  if (!rawEnvelope.ok) return rawEnvelope;
  if (rawEnvelope.engine !== 'automation') return { ok: false, error: 'AUTOMATION_ADAPTER_REQUIRED', engine: rawEnvelope.engine };
  const authorized = authorizeAdapterDispatch(rawEnvelope, approval);
  if (!authorized.ok) return authorized;
  if (!automationContract || typeof automationContract !== 'object' || Array.isArray(automationContract)) return { ok: false, error: 'AUTOMATION_CONTRACT_REQUIRED' };

  const started = transitionMissionTask(mission, taskId, 'start', {
    inputs: {
      adapter_id: authorized.envelope.adapter_id,
      dispatch_envelope: authorized.envelope,
      automation_contract: automationContract,
      dependency_outputs: contract.dependency_outputs || {},
      supervised: true,
      automatic_execution: false,
      production_deploy: false,
    },
    external_job_id: options.external_job_id || null,
  });
  if (!started.ok) return started;
  return { ok: true, mission: started.mission, contract, envelope: authorized.envelope, automation_contract: automationContract, supervised: true, automatic_execution: false, production_deploy: false };
}

export function automationRunnerToAdapterResult(result = {}) {
  if (result.ok === true && result.status === 'COMPLETED') {
    return { status: 'COMPLETED', outputs: { ...(result.outputs || {}), automation_trace: result.trace || [] }, production_deploy: false };
  }
  const blocked = result.status === 'BLOCKED' || result.status === 'BLOCKED_EXTERNAL_SIDE_EFFECT';
  return {
    status: 'FAILED',
    error: {
      code: blocked ? 'AUTOMATION_SUPERVISION_BLOCKED' : 'AUTOMATION_EXECUTION_FAILED',
      message: clean(result.error || result.errors?.join(', ') || result.status, 500) || null,
      retryable: false,
    },
    production_deploy: false,
  };
}

export async function executeAutomationMissionTask(mission, taskId, automationContract = {}, approval = {}, options = {}) {
  const prepared = prepareAutomationMissionTask(mission, taskId, automationContract, approval, options);
  if (!prepared.ok) return prepared;
  const executionInput = options.input ?? prepared.contract.dependency_outputs ?? {};
  const result = await executeSupervisedAutomation(automationContract, executionInput, {
    transport: options.transport,
    policy: options.policy || {},
  });
  const adapterResult = automationRunnerToAdapterResult(result);
  const validated = validateAdapterResult(prepared.envelope, adapterResult);
  if (!validated.ok) return { ...validated, mission: prepared.mission, runner_result: result };
  const transition = validated.result.status === 'COMPLETED'
    ? transitionMissionTask(prepared.mission, taskId, 'complete', { outputs: validated.result.outputs })
    : transitionMissionTask(prepared.mission, taskId, 'fail', { code: validated.result.error?.code, message: validated.result.error?.message, retryable: validated.result.error?.retryable === true });
  return { ...transition, runner_result: result, adapter_result: validated.result, supervised: true, automatic_execution: false, production_deploy: false };
}

export function automationMissionBridgeManifest() {
  return { version: '4.8', adapter: 'automation-factory-v1', mission_execution: 'supervised_only', explicit_dispatch_approval: true, dependency_output_handoff: true, external_policy_required_per_v43: true, injected_transport_only: true, automatic_execution: false, production_deploy: false };
}
