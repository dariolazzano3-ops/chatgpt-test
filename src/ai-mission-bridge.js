import { buildTaskExecutionContract, transitionMissionTask } from './orchestration-state.js';
import { authorizeAdapterDispatch, buildAdapterDispatchEnvelope, validateAdapterResult } from './execution-adapters.js';
import { buildAIMissionDispatch, aiResultToMissionResult } from './ai-mission-adapter.js';
import { executeAIContract } from './ai-executor.js';

export function prepareAIMissionTask(mission, taskId, approval = {}, options = {}) {
  const contract = buildTaskExecutionContract(mission, taskId);
  if (!contract.ok) return contract;
  const rawEnvelope = buildAdapterDispatchEnvelope(contract);
  if (!rawEnvelope.ok) return rawEnvelope;
  if (rawEnvelope.engine !== 'ai') return { ok: false, error: 'AI_ADAPTER_REQUIRED', engine: rawEnvelope.engine };
  const authorized = authorizeAdapterDispatch(rawEnvelope, approval);
  if (!authorized.ok) return authorized;

  const dispatch = buildAIMissionDispatch({
    ...contract,
    input: options.input ?? contract.dependency_outputs ?? {},
    dependency_outputs: contract.dependency_outputs ?? {}
  }, options.ai_contract || options);
  if (!dispatch.ok) return dispatch;

  const started = transitionMissionTask(mission, taskId, 'start', {
    inputs: {
      adapter_id: authorized.envelope.adapter_id,
      dispatch_envelope: authorized.envelope,
      ai_contract: dispatch.contract,
      execution_mode: 'injected_runner',
      automatic_execution: false,
      external_side_effects: false,
      production_deploy: false
    },
    external_job_id: null
  });
  if (!started.ok) return started;

  return {
    ok: true,
    mission: started.mission,
    contract,
    envelope: authorized.envelope,
    ai_contract: dispatch.contract,
    execution_mode: 'injected_runner',
    automatic_execution: false,
    external_side_effects: false,
    production_deploy: false
  };
}

export async function executeAIMissionTask(mission, taskId, approval = {}, options = {}) {
  const prepared = prepareAIMissionTask(mission, taskId, approval, options);
  if (!prepared.ok) return prepared;
  if (typeof options.runner !== 'function') {
    return { ok: false, error: 'AI_RUNNER_NOT_CONFIGURED', mission: prepared.mission, production_deploy: false };
  }

  const aiResult = await executeAIContract(prepared.ai_contract, {
    runner: options.runner,
    provider: options.provider,
    model: options.model
  });
  const adapterResult = aiResultToMissionResult(aiResult);
  const validated = validateAdapterResult(prepared.envelope, adapterResult);
  if (!validated.ok) return { ...validated, mission: prepared.mission, ai_result: aiResult };

  const transition = validated.result.status === 'COMPLETED'
    ? transitionMissionTask(prepared.mission, taskId, 'complete', { outputs: validated.result.outputs })
    : transitionMissionTask(prepared.mission, taskId, 'fail', {
        code: validated.result.error?.code || 'AI_EXECUTION_FAILED',
        message: validated.result.error?.message || null,
        retryable: validated.result.error?.retryable === true
      });

  return {
    ...transition,
    ai_result: aiResult,
    adapter_result: validated.result,
    execution_mode: 'injected_runner',
    automatic_execution: false,
    external_side_effects: false,
    production_deploy: false
  };
}

export function aiMissionBridgeManifest() {
  return {
    version: '4.7',
    adapter: 'ai-factory-v1',
    mission_execution: 'injected_runner_only',
    explicit_dispatch_approval: true,
    provider_activation_required: true,
    tool_access: false,
    external_data_access: false,
    external_side_effects: false,
    automatic_execution: false,
    production_deploy: false
  };
}
