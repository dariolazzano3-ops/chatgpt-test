import { normalizeAIContract, normalizeAIResultContract } from './ai-factory.js';
import { parseAndValidateStructuredOutput, validateStructuredOutput } from './ai-structured-output.js';
import { buildAIRepairDirective, shouldRetryAIFailure } from './ai-retry-policy.js';

const MAX_ERROR_CHARS = 500;
const clean = (value, max = MAX_ERROR_CHARS) => String(value || '').trim().slice(0, max);
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

function failed(code, message, attempts, trace = [], classification = null) {
  const result = normalizeAIResultContract({ status: 'FAILED', error: { code, message: clean(message), retryable: classification?.retryable === true, category: classification?.category || null }, attempts, production_deploy: false, external_side_effects: false });
  if (result.ok) {
    result.result.execution_trace = clone(trace);
    result.result.execution_mode = 'injected_runner';
    result.result.automatic_execution = false;
  }
  return result;
}

function validateOutput(contract, rawOutput) {
  if (contract.output.format === 'text') {
    if (typeof rawOutput !== 'string') return { ok: false, code: 'AI_TEXT_OUTPUT_TYPE_INVALID', errors: [] };
    if (rawOutput.length > contract.output.max_chars) return { ok: false, code: 'AI_OUTPUT_LIMIT_EXCEEDED', errors: [] };
    return { ok: true, value: rawOutput };
  }
  if (typeof rawOutput === 'string') {
    if (rawOutput.length > contract.output.max_chars) return { ok: false, code: 'AI_OUTPUT_LIMIT_EXCEEDED', errors: [] };
    const parsed = parseAndValidateStructuredOutput(rawOutput, contract.output.schema);
    if (!parsed.ok) {
      const firstCode = parsed.errors?.[0]?.code || 'AI_STRUCTURED_OUTPUT_INVALID';
      return { ok: false, code: firstCode, errors: parsed.errors || [] };
    }
    return { ok: true, value: parsed.value };
  }
  let size = Infinity;
  try { size = JSON.stringify(rawOutput).length; } catch {}
  if (size > contract.output.max_chars) return { ok: false, code: 'AI_OUTPUT_LIMIT_EXCEEDED', errors: [] };
  const validated = validateStructuredOutput(rawOutput, contract.output.schema);
  if (!validated.ok) return { ok: false, code: 'AI_STRUCTURED_OUTPUT_INVALID', errors: validated.errors };
  return { ok: true, value: clone(rawOutput) };
}

export async function executeAIContract(contract = {}, options = {}) {
  const normalized = normalizeAIContract(contract);
  if (!normalized.ok) return failed('AI_CONTRACT_INVALID', normalized.errors.join(', '), 0, []);
  const task = normalized.contract;
  const runner = options.runner;
  if (typeof runner !== 'function') return failed('AI_RUNNER_NOT_CONFIGURED', 'A provider-neutral runner function is required.', 0, []);

  const trace = [];
  let lastFailure = null;
  let repairDirective = null;

  for (let attempt = 1; attempt <= task.execution.max_attempts; attempt += 1) {
    const request = Object.freeze({
      contract_version: task.contract_version,
      task_type: task.task_type,
      goal: task.goal,
      input: clone(task.input),
      context: clone(task.context),
      output: clone(task.output),
      attempt,
      previous_failure: lastFailure ? clone(lastFailure) : null,
      repair_directive: repairDirective ? clone(repairDirective) : null,
      constraints: Object.freeze({ allow_tools: false, allow_external_data: false, automatic_execution: false, production_deploy: false, external_side_effects: false })
    });

    try {
      const response = await runner(request);
      if (!response || typeof response !== 'object' || !Object.prototype.hasOwnProperty.call(response, 'output')) {
        lastFailure = { code: 'AI_RUNNER_RESPONSE_INVALID', message: 'Runner response must contain output.' };
      } else if (response.external_side_effects === true || response.production_deploy === true) {
        const policy = shouldRetryAIFailure({ code: 'AI_SIDE_EFFECT_DECLARATION_REJECTED' }, attempt, task.execution.max_attempts);
        return failed('AI_SIDE_EFFECT_DECLARATION_REJECTED', 'Runner declared an external or Production side effect.', attempt, [...trace, { attempt, status: 'BLOCKED', code: 'AI_SIDE_EFFECT_DECLARATION_REJECTED' }], policy.classification);
      } else {
        const outputValidation = validateOutput(task, response.output);
        if (outputValidation.ok) {
          const result = normalizeAIResultContract({ status: 'COMPLETED', output: outputValidation.value, provider: clean(response.provider, 120) || clean(options.provider, 120) || 'injected-runner', model: clean(response.model, 160) || clean(options.model, 160) || null, attempts: attempt, production_deploy: false, external_side_effects: false });
          if (!result.ok) return result;
          result.result.execution_trace = [...trace, { attempt, status: 'COMPLETED' }];
          result.result.execution_mode = 'injected_runner';
          result.result.automatic_execution = false;
          return result;
        }
        lastFailure = { code: outputValidation.code, message: (outputValidation.errors || []).map((error) => `${error.code}:${error.path}`).join(', ') || outputValidation.code };
      }
    } catch (error) {
      lastFailure = { code: 'AI_RUNNER_ERROR', message: clean(error?.message || error) };
    }

    const policy = shouldRetryAIFailure(lastFailure, attempt, task.execution.max_attempts);
    trace.push({ attempt, status: 'FAILED', code: lastFailure.code, retryable: policy.classification.retryable, repairable: policy.classification.repairable });
    if (!policy.retry) return failed(lastFailure.code, lastFailure.message, attempt, trace, policy.classification);
    const repair = buildAIRepairDirective(lastFailure, attempt + 1);
    repairDirective = repair.ok ? repair.directive : null;
  }

  const policy = shouldRetryAIFailure(lastFailure || {}, task.execution.max_attempts, task.execution.max_attempts);
  return failed(lastFailure?.code || 'AI_EXECUTION_FAILED', lastFailure?.message || 'AI execution failed.', task.execution.max_attempts, trace, policy.classification);
}
