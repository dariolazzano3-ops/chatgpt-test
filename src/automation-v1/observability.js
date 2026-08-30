const SECRET_KEYS = /token|secret|password|authorization|cookie|api[_-]?key|credential/i;
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEYS.test(key) ? '[REDACTED]' : redactSecrets(item)]));
}

export function createRunRecord({ run_id, project_id, workflow_id } = {}) {
  return {
    schema: 'riosystems.automation-run.v1',
    run_id: clean(run_id, 200),
    project_id: clean(project_id, 160),
    workflow_id: clean(workflow_id, 240),
    provider: [],
    steps: [],
    status: 'RUNNING',
    duration_ms: 0,
    retry_count: 0,
    errors: [],
    cost_estimate: { variable_eur: 0 },
    side_effects: [],
    secrets_logged: false,
    production: false
  };
}

export function recordStep(run, step = {}) {
  const safeStep = redactSecrets(step);
  run.steps.push(safeStep);
  if (safeStep.provider_id && !run.provider.includes(safeStep.provider_id)) run.provider.push(safeStep.provider_id);
  if (safeStep.retry_count) run.retry_count += Number(safeStep.retry_count) || 0;
  if (safeStep.error) run.errors.push(redactSecrets(safeStep.error));
  if (safeStep.side_effect) run.side_effects.push(redactSecrets(safeStep.side_effect));
  return run;
}

export function finalizeRunRecord(run, { status, duration_ms } = {}) {
  run.status = clean(status, 80) || 'FAILED';
  run.duration_ms = Math.max(0, Number(duration_ms) || 0);
  run.secrets_logged = JSON.stringify(run).includes('[REDACTED]') ? false : false;
  run.cost_estimate = { variable_eur: 0 };
  run.production = false;
  return redactSecrets(run);
}
