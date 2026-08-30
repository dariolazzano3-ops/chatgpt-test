const TRANSIENT_CODES = new Set(['ETIMEDOUT','ECONNRESET','EAI_AGAIN','429','500','502','503','504','TRANSIENT_PROVIDER_ERROR']);
const VALIDATION_CODES = new Set(['VALIDATION_ERROR','SCHEMA_INVALID','OUTPUT_INVALID']);

export function classifyExecutionError(error = {}) {
  const code = String(error?.code || error?.status || '').trim().toUpperCase();
  if (TRANSIENT_CODES.has(code)) return 'TRANSIENT';
  if (VALIDATION_CODES.has(code)) return 'VALIDATION';
  if (String(error?.type || '').toUpperCase() === 'PROVIDER') return 'PROVIDER';
  return 'PERMANENT';
}

export function recoveryDecision({ error, attempt = 1, retry_limit = 2, repair_attempted = false, fallback_available = false, fallback_allowed = false } = {}) {
  const kind = classifyExecutionError(error);
  if (kind === 'TRANSIENT' && attempt <= retry_limit) return { action: 'RETRY', kind, fail_closed: false };
  if (kind === 'VALIDATION' && repair_attempted !== true) return { action: 'REPAIR', kind, fail_closed: false };
  if (kind === 'PROVIDER' && fallback_available === true && fallback_allowed === true) return { action: 'FALLBACK', kind, fail_closed: false };
  return { action: 'FAIL_CLOSED', kind, fail_closed: true };
}

export function boundedRetryPolicy(node = {}) {
  return {
    retry_limit: Math.min(Math.max(Number(node.retry_limit ?? 2), 0), 3),
    repair_limit: 1,
    provider_fallback_limit: 1,
    infinite_loop_possible: false,
    fail_closed: true
  };
}
