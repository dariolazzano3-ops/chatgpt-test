import { buildTaskExecutionContract, transitionMissionTask } from './orchestration-state.js';
import { buildAdapterDispatchEnvelope, validateAdapterResult } from './execution-adapters.js';

export async function executeMissionTask(missionInput, taskId, options = {}) {
  const contract = buildTaskExecutionContract(missionInput, taskId);
  if (!contract.ok) return contract;

  const envelope = buildAdapterDispatchEnvelope(contract);
  if (!envelope.ok) return envelope;

  if (options.authorize_dispatch !== true) {
    return {
      ok: false,
      error: 'ADAPTER_DISPATCH_NOT_AUTHORIZED',
      envelope,
      mission: missionInput,
    };
  }

  if (typeof options.runner !== 'function') {
    return { ok: false, error: 'ADAPTER_RUNNER_REQUIRED', envelope, mission: missionInput };
  }

  const started = transitionMissionTask(missionInput, taskId, 'start', {
    inputs: {
      dependency_outputs: envelope.dependency_outputs,
      project: envelope.project,
      goal: envelope.goal,
    },
    external_job_id: options.external_job_id || null,
  });
  if (!started.ok) return started;

  let rawResult;
  try {
    rawResult = await options.runner(envelope);
  } catch (error) {
    rawResult = {
      status: 'FAILED',
      error: {
        code: 'ADAPTER_RUNNER_EXCEPTION',
        message: String(error?.message || error),
        retryable: true,
      },
      production_deploy: false,
    };
  }

  const validated = validateAdapterResult(envelope, rawResult || {});
  if (!validated.ok) {
    const failed = transitionMissionTask(started.mission, taskId, 'fail', {
      code: validated.error,
      message: 'Execution adapter returned an invalid result.',
      retryable: false,
    });
    return { ok: false, error: validated.error, mission: failed.ok ? failed.mission : started.mission, envelope };
  }

  const result = validated.result;
  if (result.status === 'COMPLETED') {
    const completed = transitionMissionTask(started.mission, taskId, 'complete', { outputs: result.outputs });
    return { ok: completed.ok, mission: completed.mission, envelope, result };
  }

  const failed = transitionMissionTask(started.mission, taskId, 'fail', {
    code: result.error?.code || 'ADAPTER_EXECUTION_FAILED',
    message: result.error?.message || null,
    retryable: result.error?.retryable === true,
  });
  return { ok: false, error: result.error?.code || 'ADAPTER_EXECUTION_FAILED', mission: failed.mission, envelope, result };
}
