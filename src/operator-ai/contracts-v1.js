const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const uniq = (items = []) => [...new Set((Array.isArray(items) ? items : []).filter(Boolean))];

export const OPERATOR_AI_CONTEXT_SCHEMA = 'aurentara.operator-ai.context-snapshot.v1';
export const OPERATOR_AI_EXECUTION_BRIEF_SCHEMA = 'aurentara.operator-ai.execution-brief.v1';
export const OPERATOR_AI_RESULT_SCHEMA = 'aurentara.operator-ai.result-interpreter.v1';

export const OPERATOR_AI_INTENTS = Object.freeze([
  'INFORMATION_REQUEST','STATUS_REQUEST','ANALYSIS_REQUEST','PLANNING_REQUEST','PROMPT_GENERATION_REQUEST',
  'EXECUTION_PREPARATION_REQUEST','EXECUTION_REQUEST','APPROVAL_REQUEST','REVISION_REQUEST',
  'QUALITY_IMPROVEMENT_REQUEST','PROJECT_CREATION_REQUEST','CUSTOMER_CHANGE_REQUEST','RELEASE_REQUEST',
  'LAUNCH_REQUEST','PROVIDER_REQUEST','COST_REQUEST','BLOCKER_REQUEST','UNSAFE_OR_BLOCKED_REQUEST'
]);

export const OPERATOR_AI_AUTONOMY = Object.freeze({
  READ_ONLY: 0,
  ADVISE: 1,
  PLAN_GENERATE: 2,
  PREPARE_EXECUTION: 3,
  SAFE_INTERNAL_EXECUTION: 4,
  APPROVAL_GATED_EXTERNAL_ACTION: 5
});

export const OPERATOR_AI_EVIDENCE = Object.freeze(['VERIFIED','SUPPORTED','INFERRED','UNKNOWN','CONFLICTED']);
export const OPERATOR_AI_FRESHNESS = Object.freeze(['FRESH','STALE','UNKNOWN_FRESHNESS']);
export const OPERATOR_AI_TASK_CLASSES = Object.freeze([
  'INTERNALLY_SOLVABLE','OPERATOR_REQUIRED','CUSTOMER_REQUIRED','PROVIDER_REQUIRED','PAID_APPROVAL_REQUIRED',
  'PRODUCTION_APPROVAL_REQUIRED','EXTERNAL_BLOCKER','COMPLETED'
]);
export const EXECUTION_BRIEF_STATUSES = Object.freeze([
  'DRAFT','READY_FOR_OPERATOR_REVIEW','READY_FOR_APPROVAL','READY_FOR_EXECUTION','BLOCKED','BRIEF_STALE'
]);

export function normalizeAutonomyLevel(value, fallback = 0) {
  const level = Number(value);
  return Number.isInteger(level) ? Math.max(0, Math.min(5, level)) : fallback;
}

export function normalizeExecutionPolicy(input = {}) {
  const autonomy = normalizeAutonomyLevel(input.autonomy_level, 0);
  const maxRepairRounds = Math.max(0, Math.min(8, Number.isInteger(Number(input.max_repair_rounds)) ? Number(input.max_repair_rounds) : 2));
  const maxAttempts = Math.max(1, Math.min(8, Number.isInteger(Number(input.max_execution_attempts)) ? Number(input.max_execution_attempts) : 3));
  const maxProviderCalls = Math.max(0, Math.min(50, Number.isInteger(Number(input.max_provider_calls)) ? Number(input.max_provider_calls) : 0));
  const maxCost = Number.isFinite(Number(input.max_cost)) ? Math.max(0, Number(input.max_cost)) : 0;
  return {
    autonomy_level: autonomy,
    execution_mode: clean(input.execution_mode, 80) || (autonomy >= 4 ? 'SAFE_INTERNAL' : autonomy >= 3 ? 'PREPARE_ONLY' : 'NO_EXECUTION'),
    repair_loop: input.repair_loop !== false,
    max_repair_rounds: maxRepairRounds,
    max_execution_attempts: maxAttempts,
    max_provider_calls: maxProviderCalls,
    max_cost: maxCost,
    max_scope: uniq(input.max_scope || []),
    merge_authorized: input.merge_authorized === true,
    production_authorized: false,
    external_writes_authorized: false
  };
}

export function operatorAiContractsManifest() {
  return {
    schema: 'aurentara.operator-ai.contracts.v1',
    one_ai_rule: true,
    intents: [...OPERATOR_AI_INTENTS],
    autonomy_levels: { ...OPERATOR_AI_AUTONOMY },
    evidence_states: [...OPERATOR_AI_EVIDENCE],
    freshness_states: [...OPERATOR_AI_FRESHNESS],
    task_classes: [...OPERATOR_AI_TASK_CLASSES],
    context_schema: OPERATOR_AI_CONTEXT_SCHEMA,
    execution_brief_schema: OPERATOR_AI_EXECUTION_BRIEF_SCHEMA,
    result_schema: OPERATOR_AI_RESULT_SCHEMA,
    second_state_system: false,
    production_deploy: false,
    external_writes: false
  };
}
