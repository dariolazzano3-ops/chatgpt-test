const RETRYABLE = new Set([
  'AI_RUNNER_ERROR',
  'AI_RUNNER_RESPONSE_INVALID',
  'AI_OUTPUT_JSON_PARSE_FAILED',
  'AI_STRUCTURED_OUTPUT_INVALID',
  'AI_TEXT_OUTPUT_TYPE_INVALID'
]);

const NON_RETRYABLE = new Set([
  'AI_CONTRACT_INVALID',
  'AI_RUNNER_NOT_CONFIGURED',
  'AI_OUTPUT_LIMIT_EXCEEDED',
  'AI_SIDE_EFFECT_DECLARATION_REJECTED'
]);

export function classifyAIFailure(code = '') {
  const normalized = String(code || '').trim().toUpperCase();
  if (NON_RETRYABLE.has(normalized)) return { code: normalized, retryable: false, repairable: false, category: 'terminal' };
  if (normalized === 'AI_OUTPUT_JSON_PARSE_FAILED' || normalized === 'AI_STRUCTURED_OUTPUT_INVALID' || normalized === 'AI_TEXT_OUTPUT_TYPE_INVALID') {
    return { code: normalized, retryable: true, repairable: true, category: 'output_contract' };
  }
  if (RETRYABLE.has(normalized)) return { code: normalized, retryable: true, repairable: false, category: 'provider_or_transport' };
  return { code: normalized || 'AI_EXECUTION_FAILED', retryable: false, repairable: false, category: 'unknown' };
}

export function buildAIRepairDirective(failure = {}, attempt = 1) {
  const classification = classifyAIFailure(failure.code);
  if (!classification.repairable) return { ok: false, reason: 'AI_FAILURE_NOT_REPAIRABLE', classification };
  return {
    ok: true,
    directive: {
      version: 'ai.repair.v1',
      attempt,
      failure_code: classification.code,
      instruction: classification.code === 'AI_OUTPUT_JSON_PARSE_FAILED'
        ? 'Return only valid JSON matching the required output schema. Do not add prose or markdown fences.'
        : classification.code === 'AI_TEXT_OUTPUT_TYPE_INVALID'
          ? 'Return plain text only.'
          : 'Correct the previous output so it exactly satisfies the required output schema. Preserve supported facts and remove unsupported fields.',
      production_deploy: false,
      tool_access: false,
      external_data_access: false
    }
  };
}

export function shouldRetryAIFailure(failure = {}, attempt = 1, maxAttempts = 1) {
  const classification = classifyAIFailure(failure.code);
  return {
    retry: classification.retryable && attempt < maxAttempts,
    classification,
    attempts_remaining: Math.max(0, Number(maxAttempts || 1) - Number(attempt || 0))
  };
}
