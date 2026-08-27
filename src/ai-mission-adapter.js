import { normalizeAIContract } from './ai-factory.js';

const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

export function missionTaskToAIContract(task = {}, options = {}) {
  const capability = clean(task.capability, 120);
  if (!['ai', 'support_ai', 'ai_system_build'].includes(capability)) return { ok: false, error: 'AI_MISSION_CAPABILITY_UNSUPPORTED', capability };
  const output = options.output || task.ai_output || { format: 'text', max_chars: 100000 };
  return normalizeAIContract({
    contract_version: 'ai.task.v1',
    task_type: options.task_type || task.ai_task_type || 'generate',
    goal: clean(task.goal || task.prompt),
    input: Object.prototype.hasOwnProperty.call(task, 'input') ? clone(task.input) : clone(task.dependency_outputs || {}),
    context: Array.isArray(options.context) ? clone(options.context) : [],
    output: clone(output),
    execution: {
      max_attempts: Number(options.max_attempts || task.max_attempts || 1),
      allow_tools: false,
      allow_external_data: false,
      production_deploy: false
    },
    metadata: {
      mission_id: task.mission_id || null,
      task_id: task.task_id || null,
      capability
    }
  });
}

export function aiResultToMissionResult(aiResult = {}) {
  const result = aiResult.result || aiResult;
  if (result.status === 'COMPLETED') {
    return {
      status: 'COMPLETED',
      outputs: { ai_output: clone(result.output), provider: result.provider || null, model: result.model || null, attempts: result.attempts || 0 },
      production_deploy: false
    };
  }
  return {
    status: 'FAILED',
    error: { code: result.error?.code || 'AI_EXECUTION_FAILED', message: result.error?.message || null, retryable: result.error?.retryable === true },
    production_deploy: false
  };
}

export function buildAIMissionDispatch(task = {}, options = {}) {
  const normalized = missionTaskToAIContract(task, options);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    dispatch_version: 'ai.mission.dispatch.v1',
    adapter_id: 'ai-factory-v1',
    contract: normalized.contract,
    automatic_dispatch: false,
    provider_activation_required: true,
    production_deploy: false,
    external_side_effects: false
  };
}
