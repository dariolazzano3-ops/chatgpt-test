import { buildTaskExecutionContract, transitionMissionTask } from './orchestration-state.js';
import { authorizeAdapterDispatch, buildAdapterDispatchEnvelope, validateAdapterResult } from './execution-adapters.js';
import { executeBusinessContract } from './business-executor.js';

export function prepareBusinessMissionTask(mission, taskId, businessContract = {}, approval = {}) {
  const contract = buildTaskExecutionContract(mission, taskId);
  if (!contract.ok) return contract;
  const rawEnvelope = buildAdapterDispatchEnvelope(contract);
  if (!rawEnvelope.ok) return rawEnvelope;
  if (rawEnvelope.engine !== 'business') return { ok: false, error: 'BUSINESS_ADAPTER_REQUIRED', engine: rawEnvelope.engine };
  const authorized = authorizeAdapterDispatch(rawEnvelope, approval);
  if (!authorized.ok) return authorized;
  const started = transitionMissionTask(mission, taskId, 'start', {
    inputs: {
      adapter_id: authorized.envelope.adapter_id,
      dispatch_envelope: authorized.envelope,
      business_contract: businessContract,
      automatic_execution: false,
      external_writes: false,
      production_deploy: false
    }
  });
  if (!started.ok) return started;
  return { ok: true, mission: started.mission, contract, envelope: authorized.envelope, business_contract: businessContract };
}

export async function executeBusinessMissionTask(mission, taskId, businessContract = {}, approval = {}, options = {}) {
  const prepared = prepareBusinessMissionTask(mission, taskId, businessContract, approval);
  if (!prepared.ok) return prepared;
  const runnerResult = await executeBusinessContract(businessContract, { input: options.input || prepared.contract.dependency_outputs || {}, production_deploy: false, external_write: false });
  const adapterResult = runnerResult.ok
    ? { status: 'COMPLETED', outputs: { ...(runnerResult.outputs || {}), business_trace: runnerResult.trace || [] }, production_deploy: false }
    : { status: 'FAILED', error: { code: runnerResult.error || 'BUSINESS_EXECUTION_FAILED', message: runnerResult.error || null, retryable: false }, production_deploy: false };
  const validated = validateAdapterResult(prepared.envelope, adapterResult);
  if (!validated.ok) return { ...validated, mission: prepared.mission, runner_result: runnerResult };
  const transition = validated.result.status === 'COMPLETED'
    ? transitionMissionTask(prepared.mission, taskId, 'complete', { outputs: validated.result.outputs })
    : transitionMissionTask(prepared.mission, taskId, 'fail', { code: validated.result.error?.code, message: validated.result.error?.message, retryable: false });
  return { ...transition, runner_result: runnerResult, adapter_result: validated.result, automatic_execution: false, external_writes: false, production_deploy: false };
}

export function businessMissionBridgeManifest() {
  return { version: '4.8', adapter: 'business-factory-v1', mission_execution: 'bounded_local_configuration', explicit_dispatch_approval: true, external_writes: false, automatic_execution: false, production_deploy: false };
}
