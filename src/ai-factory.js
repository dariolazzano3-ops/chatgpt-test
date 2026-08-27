const AI_TASK_TYPES = new Set([
  'analyze',
  'structure',
  'classify',
  'extract',
  'summarize',
  'generate',
  'decision_support'
]);

const OUTPUT_FORMATS = new Set(['structured_json', 'text']);
const CONTEXT_KINDS = new Set(['instruction', 'reference', 'example']);
const MAX_INPUT_CHARS = 100_000;
const MAX_CONTEXT_ITEMS = 32;
const MAX_CONTEXT_ITEM_CHARS = 8_000;
const MAX_OUTPUT_CHARS = 100_000;
const MAX_ATTEMPTS = 3;

const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function jsonSize(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Infinity;
  }
}

function cloneJson(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

export function aiFactoryManifest() {
  return {
    id: 'ai-factory-v1',
    version: '1.0.0',
    contract_version: 'ai.task.v1',
    result_contract_version: 'ai.result.v1',
    status: 'foundation',
    available: true,
    execution_mode: 'contract_only',
    automatic_execution: false,
    provider_agnostic: true,
    model_routing: false,
    tool_access: false,
    external_data_access: false,
    external_side_effects: false,
    production_deploy: false,
    supported_task_types: [...AI_TASK_TYPES],
    supported_output_formats: [...OUTPUT_FORMATS],
    limits: {
      max_input_chars: MAX_INPUT_CHARS,
      max_context_items: MAX_CONTEXT_ITEMS,
      max_context_item_chars: MAX_CONTEXT_ITEM_CHARS,
      max_output_chars: MAX_OUTPUT_CHARS,
      max_attempts: MAX_ATTEMPTS
    }
  };
}

export function validateAIContract(contract = {}) {
  const errors = [];
  const version = clean(contract.contract_version, 80) || 'ai.task.v1';
  const taskType = clean(contract.task_type, 80).toLowerCase();
  const goal = clean(contract.goal, 4000);
  const context = contract.context === undefined ? [] : contract.context;
  const output = contract.output;
  const execution = isObject(contract.execution) ? contract.execution : {};

  if (version !== 'ai.task.v1') errors.push('AI_CONTRACT_VERSION_UNSUPPORTED');
  if (!goal) errors.push('AI_GOAL_REQUIRED');
  if (!AI_TASK_TYPES.has(taskType)) errors.push(`AI_TASK_TYPE_UNSUPPORTED:${taskType || 'missing'}`);

  if (!Object.prototype.hasOwnProperty.call(contract, 'input') || contract.input === null || contract.input === undefined) {
    errors.push('AI_INPUT_REQUIRED');
  } else if (jsonSize(contract.input) > MAX_INPUT_CHARS) {
    errors.push('AI_INPUT_LIMIT_EXCEEDED');
  }

  if (!Array.isArray(context)) {
    errors.push('AI_CONTEXT_INVALID');
  } else {
    if (context.length > MAX_CONTEXT_ITEMS) errors.push('AI_CONTEXT_ITEM_LIMIT_EXCEEDED');
    for (const [index, item] of context.entries()) {
      if (!isObject(item)) {
        errors.push(`AI_CONTEXT_ITEM_INVALID:${index + 1}`);
        continue;
      }
      const kind = clean(item.kind, 40).toLowerCase() || 'reference';
      const content = String(item.content || '');
      if (!CONTEXT_KINDS.has(kind)) errors.push(`AI_CONTEXT_KIND_UNSUPPORTED:${index + 1}`);
      if (!content.trim()) errors.push(`AI_CONTEXT_CONTENT_REQUIRED:${index + 1}`);
      if (content.length > MAX_CONTEXT_ITEM_CHARS) errors.push(`AI_CONTEXT_ITEM_LIMIT_EXCEEDED:${index + 1}`);
    }
  }

  if (!isObject(output)) {
    errors.push('AI_OUTPUT_CONTRACT_REQUIRED');
  } else {
    const format = clean(output.format, 80).toLowerCase();
    if (!OUTPUT_FORMATS.has(format)) errors.push(`AI_OUTPUT_FORMAT_UNSUPPORTED:${format || 'missing'}`);
    if (format === 'structured_json' && !isObject(output.schema)) errors.push('AI_OUTPUT_SCHEMA_REQUIRED');
    const maxOutputChars = Number(output.max_chars ?? MAX_OUTPUT_CHARS);
    if (!Number.isInteger(maxOutputChars) || maxOutputChars < 1 || maxOutputChars > MAX_OUTPUT_CHARS) {
      errors.push('AI_OUTPUT_LIMIT_INVALID');
    }
  }

  const maxAttempts = Number(execution.max_attempts ?? 1);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) errors.push('AI_MAX_ATTEMPTS_INVALID');
  if (execution.allow_tools === true) errors.push('AI_TOOL_ACCESS_NOT_AVAILABLE');
  if (execution.allow_external_data === true) errors.push('AI_EXTERNAL_DATA_ACCESS_NOT_AVAILABLE');
  if (execution.production_deploy === true) errors.push('PRODUCTION_SIDE_EFFECT_REJECTED');

  return {
    ok: errors.length === 0,
    errors,
    contract_version: version,
    task_type: taskType || null,
    provider_agnostic: true,
    automatic_execution: false,
    tool_access: false,
    external_data_access: false,
    production_deploy: false
  };
}

export function normalizeAIContract(contract = {}) {
  const validation = validateAIContract(contract);
  if (!validation.ok) return validation;

  const context = (contract.context || []).map((item, index) => ({
    id: clean(item.id, 120) || `context-${index + 1}`,
    kind: clean(item.kind, 40).toLowerCase() || 'reference',
    content: String(item.content).trim()
  }));

  const format = clean(contract.output.format, 80).toLowerCase();
  return {
    ok: true,
    contract: {
      contract_version: 'ai.task.v1',
      task_type: validation.task_type,
      goal: clean(contract.goal, 4000),
      input: cloneJson(contract.input),
      context,
      output: {
        format,
        schema: format === 'structured_json' ? cloneJson(contract.output.schema) : null,
        max_chars: Number(contract.output.max_chars ?? MAX_OUTPUT_CHARS)
      },
      execution: {
        max_attempts: Number(contract.execution?.max_attempts ?? 1),
        allow_tools: false,
        allow_external_data: false,
        automatic: false,
        production_deploy: false
      },
      metadata: isObject(contract.metadata) ? cloneJson(contract.metadata) : {}
    }
  };
}

export function validateAIResultContract(result = {}) {
  const errors = [];
  const version = clean(result.result_contract_version, 80) || 'ai.result.v1';
  const status = clean(result.status, 40).toUpperCase();

  if (version !== 'ai.result.v1') errors.push('AI_RESULT_CONTRACT_VERSION_UNSUPPORTED');
  if (!['COMPLETED', 'FAILED'].includes(status)) errors.push('AI_RESULT_STATUS_INVALID');
  if (status === 'COMPLETED' && !Object.prototype.hasOwnProperty.call(result, 'output')) errors.push('AI_RESULT_OUTPUT_REQUIRED');
  if (status === 'FAILED' && (!isObject(result.error) || !clean(result.error.code, 120))) errors.push('AI_RESULT_ERROR_REQUIRED');
  if (result.production_deploy === true) errors.push('PRODUCTION_SIDE_EFFECT_REJECTED');
  if (result.external_side_effects === true) errors.push('AI_EXTERNAL_SIDE_EFFECT_REJECTED');

  return {
    ok: errors.length === 0,
    errors,
    result_contract_version: version,
    status: status || null,
    production_deploy: false,
    external_side_effects: false
  };
}

export function normalizeAIResultContract(result = {}) {
  const validation = validateAIResultContract(result);
  if (!validation.ok) return validation;

  return {
    ok: true,
    result: {
      result_contract_version: 'ai.result.v1',
      status: validation.status,
      output: validation.status === 'COMPLETED' ? cloneJson(result.output) : null,
      error: validation.status === 'FAILED' ? cloneJson(result.error) : null,
      provider: clean(result.provider, 120) || null,
      model: clean(result.model, 160) || null,
      attempts: Number.isInteger(result.attempts) && result.attempts >= 0 ? result.attempts : 0,
      production_deploy: false,
      external_side_effects: false
    }
  };
}
