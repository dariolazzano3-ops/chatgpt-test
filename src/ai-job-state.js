const TERMINAL = new Set(['COMPLETED', 'FAILED', 'BLOCKED']);
const MAX_EVENTS = 50;
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

export function createAIJob(task = {}) {
  return {
    job_version: 'ai.job.v1',
    job_id: String(task.job_id || `ai-${Date.now()}`),
    status: 'QUEUED',
    task_type: task.task_type || null,
    provider: null,
    model: null,
    attempts: 0,
    failure: null,
    result: null,
    metrics: { runner_calls: 0, repair_directives: 0, validation_failures: 0 },
    events: [{ type: 'QUEUED', at: new Date().toISOString() }],
    production_deploy: false,
    external_side_effects: false
  };
}

export function recordAIJobEvent(job = {}, event = {}) {
  const next = clone(job);
  const type = String(event.type || '').trim().toUpperCase();
  if (!type) return { ok: false, error: 'AI_JOB_EVENT_TYPE_REQUIRED' };
  if (TERMINAL.has(String(job.status || '').toUpperCase())) return { ok: false, error: 'AI_JOB_TERMINAL' };
  next.events = [...(next.events || []), { ...clone(event), type, at: event.at || new Date().toISOString() }].slice(-MAX_EVENTS);
  if (type === 'STARTED') next.status = 'RUNNING';
  if (type === 'ATTEMPT') next.attempts = Math.max(next.attempts || 0, Number(event.attempt || 0));
  if (type === 'PROVIDER_SELECTED') { next.provider = event.provider || null; next.model = event.model || null; }
  if (type === 'RUNNER_CALL') next.metrics.runner_calls += 1;
  if (type === 'REPAIR_DIRECTIVE') next.metrics.repair_directives += 1;
  if (type === 'VALIDATION_FAILED') next.metrics.validation_failures += 1;
  return { ok: true, job: next };
}

export function completeAIJob(job = {}, result = {}) {
  if (TERMINAL.has(String(job.status || '').toUpperCase())) return { ok: false, error: 'AI_JOB_TERMINAL' };
  const next = clone(job);
  next.status = 'COMPLETED';
  next.result = clone(result);
  next.failure = null;
  next.production_deploy = false;
  next.external_side_effects = false;
  next.events = [...(next.events || []), { type: 'COMPLETED', at: new Date().toISOString() }].slice(-MAX_EVENTS);
  return { ok: true, job: next };
}

export function failAIJob(job = {}, failure = {}, blocked = false) {
  if (TERMINAL.has(String(job.status || '').toUpperCase())) return { ok: false, error: 'AI_JOB_TERMINAL' };
  const next = clone(job);
  next.status = blocked ? 'BLOCKED' : 'FAILED';
  next.failure = clone(failure);
  next.production_deploy = false;
  next.external_side_effects = false;
  next.events = [...(next.events || []), { type: next.status, code: failure.code || null, at: new Date().toISOString() }].slice(-MAX_EVENTS);
  return { ok: true, job: next };
}

export function summarizeAIJob(job = {}) {
  return {
    job_id: job.job_id || null,
    status: job.status || null,
    attempts: job.attempts || 0,
    provider: job.provider || null,
    model: job.model || null,
    failure_code: job.failure?.code || null,
    metrics: clone(job.metrics || {}),
    production_deploy: false,
    external_side_effects: false
  };
}
