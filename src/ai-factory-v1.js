import { compilePromptContract } from './ai-prompt-registry-v1.js';

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const nowMs = () => Date.now();

export const AI_FACTORY_V1_SAFETY = Object.freeze({
  production: false,
  real_customer_data: false,
  automatic_paid_overflow: false,
  variable_cost_ceiling_eur: 0,
  secrets_in_repo: false
});

export const AI_FACTORY_V1_TASK_TYPES = Object.freeze([
  'classification', 'extraction', 'summarization', 'generation',
  'analysis', 'decision_support', 'rewriting', 'structured_planning'
]);
const TASK_SET = new Set(AI_FACTORY_V1_TASK_TYPES);
const QUALITY = new Set(['Luna', 'Terra', 'Sol']);
const LATENCY = new Set(['interactive', 'standard', 'batch']);
const DATA = new Set(['synthetic', 'internal', 'customer', 'sensitive']);
const MAX_ATTEMPTS = 3;
const MAX_INPUT_CHARS = 120_000;
const MAX_SCHEMA_DEPTH = 12;
const MAX_ERRORS = 64;

function jsonChars(value) {
  try { return JSON.stringify(value).length; } catch { return Infinity; }
}

function makeRunId(seed = '') {
  let hash = 2166136261;
  const text = `${seed}|${Date.now()}|${Math.random()}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `airun_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function aiFactoryV1Manifest() {
  return {
    id: 'riosystems-ai-factory-v1',
    schema: 'riosystems.ai-factory.v1',
    task_contract: 'riosystems.ai-task.v1',
    prompt_contract: 'riosystems.ai.prompt.v1',
    provider_abstraction: true,
    model_ladder: ['Luna', 'Terra', 'Sol'],
    structured_output_required: true,
    validation_required: true,
    repair_retry: true,
    provider_fallback: 'explicit_only',
    quality_gate: 'task_specific',
    prompt_versioning: true,
    evaluation_harness: true,
    cost_engine: true,
    privacy_routing: true,
    observability: 'redacted_metadata_only',
    deterministic_zero_cost_provider: true,
    automation_capability: 'automation.ai_step',
    web_capabilities: ['web.site_architecture', 'web.copy', 'web.seo_metadata', 'web.faq', 'web.service_descriptions', 'web.content_refinement'],
    business_capabilities: ['business.lead_classification', 'business.crm_enrichment', 'business.summary', 'business.next_action'],
    safety: clone(AI_FACTORY_V1_SAFETY)
  };
}

export function validateAITaskContract(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['AI_TASK_OBJECT_REQUIRED'] };
  const taskType = clean(input.task_type, 80).toLowerCase();
  const project = clean(input.project, 160);
  const qualityLevel = clean(input.quality_level || 'Luna', 20);
  const latencyClass = clean(input.latency_class || 'standard', 40).toLowerCase();
  const dataSensitivity = clean(input.data_sensitivity || 'synthetic', 40).toLowerCase();
  const costLimit = Number(input.cost_limit ?? 0);

  if (!project) errors.push('AI_PROJECT_REQUIRED');
  if (!TASK_SET.has(taskType)) errors.push(`AI_TASK_TYPE_UNSUPPORTED:${taskType || 'missing'}`);
  if (!Object.prototype.hasOwnProperty.call(input, 'input')) errors.push('AI_INPUT_REQUIRED');
  else if (jsonChars(input.input) > MAX_INPUT_CHARS) errors.push('AI_INPUT_LIMIT_EXCEEDED');
  if (!input.expected_output_schema || typeof input.expected_output_schema !== 'object' || Array.isArray(input.expected_output_schema)) errors.push('AI_OUTPUT_SCHEMA_REQUIRED');
  if (!QUALITY.has(qualityLevel)) errors.push('AI_QUALITY_LEVEL_INVALID');
  if (!LATENCY.has(latencyClass)) errors.push('AI_LATENCY_CLASS_INVALID');
  if (!DATA.has(dataSensitivity)) errors.push('AI_DATA_SENSITIVITY_INVALID');
  if (!Number.isFinite(costLimit) || costLimit < 0) errors.push('AI_COST_LIMIT_INVALID');
  if (typeof input.fallback_allowed !== 'boolean') errors.push('AI_FALLBACK_FLAG_REQUIRED');
  const preferredProvider = input.preferred_provider == null ? null : clean(input.preferred_provider, 120);
  if (input.preferred_provider != null && !preferredProvider) errors.push('AI_PREFERRED_PROVIDER_INVALID');
  const maxAttempts = Number(input.max_attempts ?? 2);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) errors.push('AI_MAX_ATTEMPTS_INVALID');

  return {
    ok: errors.length === 0,
    errors,
    normalized: errors.length ? null : {
      contract: 'riosystems.ai-task.v1',
      task_id: clean(input.task_id, 160) || null,
      fixture_id: clean(input.fixture_id, 160) || null,
      project,
      task_type: taskType,
      capability: clean(input.capability, 120) || null,
      objective: clean(input.objective, 4000) || `Complete ${taskType} task.`,
      input: clone(input.input),
      context: Array.isArray(input.context) ? clone(input.context) : [],
      constraints: Array.isArray(input.constraints) ? input.constraints.map((x) => clean(x, 500)).filter(Boolean) : [],
      quality_rules: Array.isArray(input.quality_rules) ? input.quality_rules.map((x) => clean(x, 500)).filter(Boolean) : [],
      semantic_constraints: input.semantic_constraints && typeof input.semantic_constraints === 'object' ? clone(input.semantic_constraints) : {},
      expected_output_schema: clone(input.expected_output_schema),
      quality_level: qualityLevel,
      latency_class: latencyClass,
      cost_limit: costLimit,
      data_sensitivity: dataSensitivity,
      preferred_provider: preferredProvider,
      fallback_allowed: input.fallback_allowed,
      max_attempts: maxAttempts,
      deterministic_output: clone(input.deterministic_output)
    }
  };
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

export function validateSchemaValue(value, schema = {}) {
  const errors = [];
  const push = (error) => { if (errors.length < MAX_ERRORS) errors.push(error); };

  function walk(current, node, path, depth) {
    if (depth > MAX_SCHEMA_DEPTH) return push({ code: 'AI_SCHEMA_DEPTH_EXCEEDED', path });
    if (!node || typeof node !== 'object' || Array.isArray(node) || typeof node.type !== 'string') return push({ code: 'AI_SCHEMA_NODE_INVALID', path });
    const expected = node.type;
    const actual = valueType(current);
    const matches = expected === 'number' ? typeof current === 'number' && Number.isFinite(current)
      : expected === 'integer' ? Number.isInteger(current)
      : expected === 'object' ? current && typeof current === 'object' && !Array.isArray(current)
      : expected === 'array' ? Array.isArray(current)
      : expected === 'null' ? current === null
      : actual === expected;
    if (!matches) return push({ code: 'AI_OUTPUT_TYPE_MISMATCH', path, expected, actual });
    if (Array.isArray(node.enum) && !node.enum.some((x) => JSON.stringify(x) === JSON.stringify(current))) push({ code: 'AI_OUTPUT_ENUM_MISMATCH', path });
    if (Object.prototype.hasOwnProperty.call(node, 'const') && JSON.stringify(node.const) !== JSON.stringify(current)) push({ code: 'AI_OUTPUT_CONST_MISMATCH', path });

    if (expected === 'object') {
      const properties = node.properties && typeof node.properties === 'object' ? node.properties : {};
      for (const key of Array.isArray(node.required) ? node.required : []) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) push({ code: 'AI_OUTPUT_REQUIRED_PROPERTY_MISSING', path: `${path}.${key}` });
      }
      if (node.additionalProperties === false) {
        for (const key of Object.keys(current)) if (!Object.prototype.hasOwnProperty.call(properties, key)) push({ code: 'AI_OUTPUT_ADDITIONAL_PROPERTY', path: `${path}.${key}` });
      }
      for (const [key, child] of Object.entries(properties)) if (Object.prototype.hasOwnProperty.call(current, key)) walk(current[key], child, `${path}.${key}`, depth + 1);
    }
    if (expected === 'array') {
      if (Number.isInteger(node.minItems) && current.length < node.minItems) push({ code: 'AI_OUTPUT_MIN_ITEMS', path });
      if (Number.isInteger(node.maxItems) && current.length > node.maxItems) push({ code: 'AI_OUTPUT_MAX_ITEMS', path });
      if (node.items) current.forEach((item, index) => walk(item, node.items, `${path}[${index}]`, depth + 1));
    }
    if (expected === 'string') {
      if (Number.isInteger(node.minLength) && current.length < node.minLength) push({ code: 'AI_OUTPUT_MIN_LENGTH', path });
      if (Number.isInteger(node.maxLength) && current.length > node.maxLength) push({ code: 'AI_OUTPUT_MAX_LENGTH', path });
    }
    if (expected === 'number' || expected === 'integer') {
      if (Number.isFinite(node.minimum) && current < node.minimum) push({ code: 'AI_OUTPUT_MINIMUM', path });
      if (Number.isFinite(node.maximum) && current > node.maximum) push({ code: 'AI_OUTPUT_MAXIMUM', path });
    }
  }
  walk(value, schema, '$', 0);
  return { ok: errors.length === 0, errors };
}

export function validateSemanticConstraints(value, constraints = {}) {
  const errors = [];
  const requiredNonEmpty = Array.isArray(constraints.non_empty_fields) ? constraints.non_empty_fields : [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const field of requiredNonEmpty) {
      const current = value[field];
      if (current == null || (typeof current === 'string' && !current.trim()) || (Array.isArray(current) && current.length === 0)) {
        errors.push({ code: 'AI_SEMANTIC_NON_EMPTY_REQUIRED', field });
      }
    }
  }
  const forbidden = Array.isArray(constraints.forbidden_terms) ? constraints.forbidden_terms.map((x) => String(x).toLowerCase()) : [];
  if (forbidden.length) {
    const serialized = JSON.stringify(value).toLowerCase();
    for (const term of forbidden) if (term && serialized.includes(term)) errors.push({ code: 'AI_SEMANTIC_FORBIDDEN_TERM', term });
  }
  return { ok: errors.length === 0, errors };
}

export function runQualityGate(task, value) {
  const errors = [];
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (!serialized || !serialized.trim() || serialized === '{}' || serialized === '[]') errors.push({ code: 'AI_QUALITY_EMPTY_DELIVERABLE' });
  if (task.task_type === 'summarization' && serialized.length > jsonChars(task.input) * 1.5 && jsonChars(task.input) > 40) errors.push({ code: 'AI_QUALITY_SUMMARY_NOT_CONCISE' });
  if (task.task_type === 'classification' && value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (!keys.length) errors.push({ code: 'AI_QUALITY_CLASSIFICATION_EMPTY' });
  }
  if (task.task_type === 'structured_planning' && value && typeof value === 'object' && !Array.isArray(value)) {
    const hasArray = Object.values(value).some(Array.isArray);
    if (!hasArray) errors.push({ code: 'AI_QUALITY_PLAN_STRUCTURE_MISSING' });
  }
  return { ok: errors.length === 0, errors, task_type: task.task_type };
}

function complexityScore(task) {
  let score = 0;
  const chars = jsonChars(task.input);
  if (chars > 10_000) score += 2; else if (chars > 2_000) score += 1;
  if (['analysis', 'decision_support', 'structured_planning'].includes(task.task_type)) score += 2;
  if (task.task_type === 'generation') score += 1;
  if (Object.keys(task.expected_output_schema?.properties || {}).length > 8) score += 1;
  return score;
}

export function selectLogicalModel(task) {
  const requested = task.quality_level || 'Luna';
  const complexity = complexityScore(task);
  const floor = complexity >= 4 ? 'Sol' : complexity >= 2 ? 'Terra' : 'Luna';
  const rank = { Luna: 0, Terra: 1, Sol: 2 };
  return rank[requested] >= rank[floor] ? requested : floor;
}

function estimateTokens(task) {
  const inputChars = jsonChars(task.input) + jsonChars(task.context) + jsonChars(task.expected_output_schema) + task.objective.length;
  const inputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const outputTokens = Math.max(32, Math.ceil(Math.min(16_000, jsonChars(task.expected_output_schema) * 4 + 600) / 4));
  return { input_tokens: inputTokens, output_tokens: outputTokens };
}

function privacyCompatible(provider, task) {
  if (['customer', 'sensitive'].includes(task.data_sensitivity) && AI_FACTORY_V1_SAFETY.real_customer_data === false) return false;
  return Array.isArray(provider.data_classes) && provider.data_classes.includes(task.data_sensitivity);
}

function providerReady(provider, task, logicalModel, runtimePolicy = {}) {
  const blockers = [];
  if (!provider?.enabled) blockers.push('AI_PROVIDER_DISABLED');
  if (typeof provider?.infer !== 'function') blockers.push('AI_PROVIDER_INFER_NOT_CONFIGURED');
  if (!provider?.capabilities?.includes(task.task_type)) blockers.push('AI_PROVIDER_CAPABILITY_MISMATCH');
  if (!provider?.logical_models?.includes(logicalModel)) blockers.push('AI_PROVIDER_MODEL_MISMATCH');
  if (!provider?.latency_classes?.includes(task.latency_class)) blockers.push('AI_PROVIDER_LATENCY_MISMATCH');
  if (!privacyCompatible(provider, task)) blockers.push('AI_PROVIDER_PRIVACY_MISMATCH');
  if (provider.requires_credential && !provider.credential_present) blockers.push('AI_PROVIDER_CREDENTIAL_REQUIRED');
  if (provider.paid && !provider.paid_execution_approved) blockers.push('AI_PROVIDER_PAID_APPROVAL_REQUIRED');
  if (provider.paid && runtimePolicy.variable_cost_ceiling_eur <= 0) blockers.push('AI_VARIABLE_COST_CEILING_ZERO');
  if (provider.external && provider.paid === false && provider.zero_cost_verified !== true) blockers.push('AI_ZERO_COST_EXTERNAL_NOT_VERIFIED');
  return { ready: blockers.length === 0, blockers };
}

export function routeAIModelAndProvider(task, providers = [], runtimePolicy = {}) {
  const logicalModel = selectLogicalModel(task);
  const variableCostCeiling = Math.min(
    Number.isFinite(runtimePolicy.variable_cost_ceiling_eur) ? Math.max(0, runtimePolicy.variable_cost_ceiling_eur) : AI_FACTORY_V1_SAFETY.variable_cost_ceiling_eur,
    task.cost_limit
  );
  const policy = { variable_cost_ceiling_eur: variableCostCeiling };
  const preferred = task.preferred_provider;
  let candidates = providers.map((provider) => ({ provider, readiness: providerReady(provider, task, logicalModel, policy) }));
  if (preferred) candidates = [...candidates].sort((a, b) => (a.provider.id === preferred ? -1 : b.provider.id === preferred ? 1 : 0));
  const ready = candidates.filter((x) => x.readiness.ready);
  if (!ready.length) {
    return {
      ok: false,
      error: 'AI_PROVIDER_ROUTE_NOT_FOUND',
      logical_model: logicalModel,
      candidates: candidates.map((x) => ({ provider: x.provider.id, blockers: x.readiness.blockers }))
    };
  }
  const selected = ready[0].provider;
  if (preferred && selected.id !== preferred && !task.fallback_allowed) return { ok: false, error: 'AI_PREFERRED_PROVIDER_UNAVAILABLE_NO_FALLBACK', logical_model: logicalModel };
  return {
    ok: true,
    logical_model: logicalModel,
    provider: selected,
    fallback_candidates: task.fallback_allowed ? ready.slice(1).map((x) => x.provider) : [],
    variable_cost_ceiling_eur: variableCostCeiling
  };
}

function costPreflight(task, provider, logicalModel, variableCostCeiling) {
  const tokenEstimate = estimateTokens(task);
  const estimate = typeof provider.estimateCost === 'function' ? provider.estimateCost({ ...tokenEstimate, logical_model: logicalModel }) : { estimated_cost_eur: null };
  const estimated = Number.isFinite(estimate?.estimated_cost_eur) ? Number(estimate.estimated_cost_eur) : null;
  const blockers = [];
  if (provider.paid && estimated == null) blockers.push('AI_PAID_COST_ESTIMATE_REQUIRED');
  if (estimated != null && estimated > task.cost_limit) blockers.push('AI_TASK_COST_LIMIT_EXCEEDED');
  if (estimated != null && estimated > variableCostCeiling) blockers.push('AI_GLOBAL_COST_CEILING_EXCEEDED');
  if (provider.paid && variableCostCeiling <= 0) blockers.push('AI_PAID_EXECUTION_BLOCKED_ZERO_CEILING');
  return { ok: blockers.length === 0, blockers, estimated_tokens: tokenEstimate, estimated_cost_eur: estimated, pricing_source: estimate?.pricing_source || null };
}

function safeTraceEvent(event = {}) {
  return {
    at: new Date().toISOString(),
    type: clean(event.type, 80),
    provider: clean(event.provider, 120) || null,
    model: clean(event.model, 160) || null,
    prompt_version: clean(event.prompt_version, 80) || null,
    attempt: Number.isInteger(event.attempt) ? event.attempt : null,
    validation_ok: typeof event.validation_ok === 'boolean' ? event.validation_ok : null,
    quality_ok: typeof event.quality_ok === 'boolean' ? event.quality_ok : null,
    latency_ms: Number.isFinite(event.latency_ms) ? Number(event.latency_ms) : null,
    cost_eur: Number.isFinite(event.cost_eur) ? Number(event.cost_eur) : null,
    code: clean(event.code, 160) || null,
    fallback_from: clean(event.fallback_from, 120) || null
  };
}

function normalizeProviderOutput(response) {
  if (!response || response.ok === false) return { ok: false, error: response?.error || 'AI_PROVIDER_ERROR', retryable: response?.retryable === true };
  let value = response.output;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); }
    catch { return { ok: false, error: 'AI_OUTPUT_JSON_PARSE_FAILED', retryable: true }; }
  }
  return { ok: true, value: clone(value) };
}

function repairDirective(validation, quality, attempt) {
  return {
    repair_contract: 'riosystems.ai.repair.v1',
    attempt,
    instruction: 'Repair only the returned deliverable. Preserve valid fields, fix validation and quality failures, and return schema-valid JSON only.',
    validation_errors: clone(validation?.errors || []),
    quality_errors: clone(quality?.errors || [])
  };
}

async function executeOnProvider({ task, provider, logicalModel, aiRunId, trace, maxAttempts, budget }) {
  let repair = null;
  let lastFailure = null;
  let attempts = 0;
  let repairs = 0;
  let actualCost = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    const compiled = compilePromptContract(task, { repair });
    if (!compiled.ok) return { ok: false, error: compiled.error, attempts, repairs, actual_cost_eur: actualCost };
    const started = nowMs();
    let response;
    try {
      response = await provider.infer({ ai_run_id: aiRunId, task: clone(task), prompt: compiled.prompt, route: { logical_model: logicalModel }, attempt });
    } catch (error) {
      response = { ok: false, error: clean(error?.message || error, 300) || 'AI_PROVIDER_THROW', retryable: true };
    }
    const latency = Math.max(0, nowMs() - started);
    const thisCost = Number.isFinite(response?.actual_cost_eur) ? Math.max(0, Number(response.actual_cost_eur)) : 0;
    actualCost += thisCost;
    if (actualCost > budget) {
      trace.push(safeTraceEvent({ type: 'cost_block', provider: provider.id, model: logicalModel, prompt_version: compiled.metadata.version, attempt, latency_ms: latency, cost_eur: thisCost, code: 'AI_ACTUAL_COST_CEILING_EXCEEDED' }));
      return { ok: false, error: 'AI_ACTUAL_COST_CEILING_EXCEEDED', attempts, repairs, actual_cost_eur: actualCost };
    }
    if (response?.ok === false) {
      trace.push(safeTraceEvent({ type: 'provider_failure', provider: provider.id, model: logicalModel, prompt_version: compiled.metadata.version, attempt, latency_ms: latency, cost_eur: thisCost, code: response.error }));
      lastFailure = response.error || 'AI_PROVIDER_ERROR';
      if (response.retryable !== true || attempt >= maxAttempts) break;
      continue;
    }

    const normalized = normalizeProviderOutput(response);
    if (!normalized.ok) {
      trace.push(safeTraceEvent({ type: 'validation_failure', provider: provider.id, model: logicalModel, prompt_version: compiled.metadata.version, attempt, latency_ms: latency, cost_eur: thisCost, code: normalized.error, validation_ok: false }));
      lastFailure = normalized.error;
      if (attempt >= maxAttempts) break;
      repair = repairDirective({ errors: [{ code: normalized.error }] }, null, attempt + 1);
      repairs += 1;
      continue;
    }

    const validation = validateSchemaValue(normalized.value, task.expected_output_schema);
    const semantic = validateSemanticConstraints(normalized.value, task.semantic_constraints);
    const mergedValidation = { ok: validation.ok && semantic.ok, errors: [...validation.errors, ...semantic.errors] };
    const quality = runQualityGate(task, normalized.value);
    trace.push(safeTraceEvent({ type: mergedValidation.ok && quality.ok ? 'completed' : 'repair_required', provider: provider.id, model: logicalModel, prompt_version: compiled.metadata.version, attempt, validation_ok: mergedValidation.ok, quality_ok: quality.ok, latency_ms: latency, cost_eur: thisCost, code: mergedValidation.ok && quality.ok ? null : 'AI_OUTPUT_GATE_FAILED' }));
    if (mergedValidation.ok && quality.ok) {
      return { ok: true, output: normalized.value, attempts, repairs, actual_cost_eur: actualCost, prompt: compiled.metadata, provider_model: response.provider_model || null };
    }
    lastFailure = 'AI_OUTPUT_GATE_FAILED';
    if (attempt >= maxAttempts) break;
    repair = repairDirective(mergedValidation, quality, attempt + 1);
    repairs += 1;
  }
  return { ok: false, error: lastFailure || 'AI_EXECUTION_FAILED', attempts, repairs, actual_cost_eur: actualCost };
}

export async function runAIFactoryTask(input = {}, options = {}) {
  const validation = validateAITaskContract(input);
  const aiRunId = clean(options.ai_run_id, 160) || makeRunId(input.task_id || input.project || 'task');
  const trace = [];
  if (!validation.ok) return { ok: false, ai_run_id: aiRunId, status: 'FAILED', error: 'AI_TASK_CONTRACT_INVALID', validation_errors: validation.errors, trace, production: false };
  const task = validation.normalized;
  if (options.production === true) return { ok: false, ai_run_id: aiRunId, status: 'BLOCKED', error: 'PRODUCTION_EXECUTION_DISABLED', trace, production: false };
  if (['customer', 'sensitive'].includes(task.data_sensitivity) && AI_FACTORY_V1_SAFETY.real_customer_data === false) {
    return { ok: false, ai_run_id: aiRunId, status: 'BLOCKED', error: 'REAL_CUSTOMER_DATA_DISABLED', trace, production: false };
  }

  const providers = Array.isArray(options.providers) ? options.providers : [];
  const route = routeAIModelAndProvider(task, providers, { variable_cost_ceiling_eur: AI_FACTORY_V1_SAFETY.variable_cost_ceiling_eur });
  if (!route.ok) return { ok: false, ai_run_id: aiRunId, status: 'BLOCKED', error: route.error, route, trace, production: false };

  const providerQueue = [route.provider, ...route.fallback_candidates];
  let budgetRemaining = Math.min(task.cost_limit, route.variable_cost_ceiling_eur);
  let totalAttempts = 0;
  let totalRepairs = 0;
  let totalActualCost = 0;
  let previousProvider = null;
  const started = nowMs();

  for (const provider of providerQueue) {
    if (previousProvider && !task.fallback_allowed) break;
    const preflight = costPreflight(task, provider, route.logical_model, budgetRemaining);
    trace.push(safeTraceEvent({ type: preflight.ok ? 'cost_preflight_ok' : 'cost_preflight_blocked', provider: provider.id, model: route.logical_model, cost_eur: preflight.estimated_cost_eur, code: preflight.blockers[0] || null, fallback_from: previousProvider }));
    if (!preflight.ok) {
      previousProvider = provider.id;
      continue;
    }
    if (previousProvider) trace.push(safeTraceEvent({ type: 'fallback', provider: provider.id, model: route.logical_model, fallback_from: previousProvider }));
    const execution = await executeOnProvider({ task, provider, logicalModel: route.logical_model, aiRunId, trace, maxAttempts: task.max_attempts, budget: budgetRemaining });
    totalAttempts += execution.attempts || 0;
    totalRepairs += execution.repairs || 0;
    totalActualCost += execution.actual_cost_eur || 0;
    budgetRemaining = Math.max(0, budgetRemaining - (execution.actual_cost_eur || 0));
    if (execution.ok) {
      return {
        ok: true,
        ai_run_id: aiRunId,
        status: 'COMPLETED',
        project: task.project,
        task_type: task.task_type,
        provider: provider.id,
        model: route.logical_model,
        provider_model: execution.provider_model,
        prompt_id: execution.prompt.id,
        prompt_version: execution.prompt.version,
        attempts: totalAttempts,
        repair_count: totalRepairs,
        fallback_count: trace.filter((x) => x.type === 'fallback').length,
        validation_result: 'passed',
        quality_gate: 'passed',
        latency_ms: Math.max(0, nowMs() - started),
        cost: {
          estimated_tokens: preflight.estimated_tokens,
          estimated_cost_eur: preflight.estimated_cost_eur,
          actual_provider_cost_eur: totalActualCost,
          budget_consumed_eur: totalActualCost,
          budget_remaining_eur: budgetRemaining,
          variable_cost_ceiling_eur: route.variable_cost_ceiling_eur
        },
        output: execution.output,
        trace,
        redaction: { input_logged: false, prompt_content_logged: false, secrets_logged: false },
        production: false
      };
    }
    previousProvider = provider.id;
  }

  return {
    ok: false,
    ai_run_id: aiRunId,
    status: 'FAILED',
    error: 'AI_EXECUTION_EXHAUSTED',
    attempts: totalAttempts,
    repair_count: totalRepairs,
    fallback_count: trace.filter((x) => x.type === 'fallback').length,
    latency_ms: Math.max(0, nowMs() - started),
    cost: { actual_provider_cost_eur: totalActualCost, budget_consumed_eur: totalActualCost, budget_remaining_eur: budgetRemaining, variable_cost_ceiling_eur: route.variable_cost_ceiling_eur },
    trace,
    redaction: { input_logged: false, prompt_content_logged: false, secrets_logged: false },
    production: false
  };
}

function subsetMatch(actual, expected) {
  if (expected == null || typeof expected !== 'object') return JSON.stringify(actual) === JSON.stringify(expected);
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every((value, index) => subsetMatch(actual[index], value));
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.entries(expected).every(([key, value]) => Object.prototype.hasOwnProperty.call(actual, key) && subsetMatch(actual[key], value));
}

export async function evaluateAIFactory(cases = [], options = {}) {
  const repetitions = Number.isInteger(options.repetitions) && options.repetitions >= 2 ? Math.min(options.repetitions, 5) : 2;
  const rows = [];
  let totalRuns = 0;
  let totalRepairs = 0;
  for (const testCase of cases) {
    const results = [];
    for (let i = 0; i < repetitions; i += 1) {
      const result = await runAIFactoryTask(testCase.task, { ...options, ai_run_id: `${clean(testCase.id, 80)}_${i + 1}` });
      results.push(result);
      totalRuns += 1;
      totalRepairs += result.repair_count || 0;
    }
    const first = results[0];
    const consistency = results.every((result) => result.ok === first.ok && JSON.stringify(result.output ?? null) === JSON.stringify(first.output ?? null));
    rows.push({
      id: clean(testCase.id, 120),
      correctness: first.ok && (testCase.expected_subset === undefined || subsetMatch(first.output, testCase.expected_subset)),
      schema_compliance: first.validation_result === 'passed',
      consistency,
      estimated_cost_eur: first.cost?.estimated_cost_eur ?? null,
      actual_cost_eur: first.cost?.actual_provider_cost_eur ?? null,
      latency_ms: first.latency_ms ?? null,
      repair_count: first.repair_count || 0,
      provider: first.provider || null,
      model: first.model || null
    });
  }
  const denominator = rows.length || 1;
  return {
    ok: rows.every((row) => row.correctness && row.schema_compliance && row.consistency),
    metrics: {
      correctness_rate: rows.filter((x) => x.correctness).length / denominator,
      schema_compliance_rate: rows.filter((x) => x.schema_compliance).length / denominator,
      consistency_rate: rows.filter((x) => x.consistency).length / denominator,
      repair_rate: totalRuns ? totalRepairs / totalRuns : 0,
      total_actual_cost_eur: rows.reduce((sum, x) => sum + (Number(x.actual_cost_eur) || 0), 0)
    },
    cases: rows
  };
}

export const AI_FACTORY_V1_REFERENCE_TASKS = Object.freeze([
  Object.freeze({
    id: 'business-lead-classification',
    task: Object.freeze({
      task_id: 'ref-business-classification', fixture_id: 'ref-business-classification', project: 'synthetic-bakery', task_type: 'classification', capability: 'business.lead_classification',
      input: { message: 'Synthetic prospect asks for a new website and CRM setup next month.' },
      expected_output_schema: { type: 'object', required: ['class', 'next_action'], properties: { class: { type: 'string', enum: ['qualified', 'nurture', 'reject'] }, next_action: { type: 'string', minLength: 3 } }, additionalProperties: false },
      quality_level: 'Luna', latency_class: 'interactive', cost_limit: 0, data_sensitivity: 'synthetic', preferred_provider: 'deterministic-local', fallback_allowed: false, max_attempts: 2,
      semantic_constraints: { non_empty_fields: ['class', 'next_action'] }
    }),
    expected_subset: Object.freeze({ class: 'qualified' })
  }),
  Object.freeze({
    id: 'web-site-architecture',
    task: Object.freeze({
      task_id: 'ref-web-plan', fixture_id: 'ref-web-plan', project: 'synthetic-consultancy', task_type: 'structured_planning', capability: 'web.site_architecture',
      input: { goal: 'Create a clear five-page website architecture for a synthetic consulting business.' },
      expected_output_schema: { type: 'object', required: ['pages'], properties: { pages: { type: 'array', minItems: 2, items: { type: 'object', required: ['slug', 'purpose'], properties: { slug: { type: 'string', minLength: 1 }, purpose: { type: 'string', minLength: 3 } }, additionalProperties: false } } }, additionalProperties: false },
      quality_level: 'Terra', latency_class: 'standard', cost_limit: 0, data_sensitivity: 'synthetic', preferred_provider: 'deterministic-local', fallback_allowed: false, max_attempts: 2,
      semantic_constraints: { non_empty_fields: ['pages'] }
    }),
    expected_subset: Object.freeze({ pages: [{ slug: '/' }] })
  })
]);
