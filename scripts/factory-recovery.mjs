const TERMINAL = new Set(['READY_FOR_REVIEW', 'WORKSHOP_REQUIRED', 'FAILED']);
const DEFAULT_STALE_MS = 45 * 60 * 1000;

function time(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyFailureKind({ error = '', stage = '' } = {}) {
  const text = `${stage} ${error}`.toLowerCase();
  if (/visual.?qa|qa_failure|overflow|page_error/.test(text)) return 'project_quality';
  if (/fulfillment|request_fulfillment/.test(text)) return 'request_fulfillment';
  if (/cloudflare|wrangler|github|token|credential|network|timeout|workflow|checkout|fetch|push|api|runner|artifact/.test(text)) return 'infrastructure';
  return 'pipeline_unknown';
}

export function classifyJobRecovery(job, options = {}) {
  if (!job || typeof job !== 'object' || !job.job_id) {
    return { state: 'fresh', recoverable: false, reason: 'NO_PRIOR_JOB', stale: false };
  }

  const nowMs = time(options.now) ?? Date.now();
  const staleAfterMs = Math.max(60_000, Number(options.stale_after_ms || DEFAULT_STALE_MS));
  const updatedMs = time(job.updated_at) ?? time(job.created_at);
  const ageMs = updatedMs === null ? null : Math.max(0, nowMs - updatedMs);
  const stale = ageMs !== null && ageMs >= staleAfterMs;
  const status = String(job.status || 'UNKNOWN');

  if (status === 'READY_FOR_REVIEW') {
    return { state: 'complete', recoverable: false, reason: 'ALREADY_READY_FOR_REVIEW', stale: false, age_ms: ageMs };
  }

  if (status === 'WORKSHOP_REQUIRED') {
    return { state: 'manual_review', recoverable: false, reason: 'REQUEST_FULFILLMENT_REQUIRES_WORKSHOP', stale: false, age_ms: ageMs };
  }

  if (status === 'FAILED') {
    const kind = String(job.failure_kind || classifyFailureKind({ error: job.last_error, stage: job.failure_stage }));
    if (kind === 'infrastructure' || kind === 'pipeline_unknown') {
      return { state: 'safe_retry', recoverable: true, reason: `FAILED_${kind.toUpperCase()}`, stale: false, age_ms: ageMs, failure_kind: kind };
    }
    return { state: 'manual_review', recoverable: false, reason: `FAILED_${kind.toUpperCase()}`, stale: false, age_ms: ageMs, failure_kind: kind };
  }

  if (!TERMINAL.has(status) && stale) {
    return { state: 'safe_retry', recoverable: true, reason: 'STALE_INCOMPLETE_JOB', stale: true, age_ms: ageMs };
  }

  return { state: 'in_progress', recoverable: false, reason: 'JOB_STILL_ACTIVE', stale: false, age_ms: ageMs };
}

export function buildRecoveryPatch(previousJob, options = {}) {
  const decision = classifyJobRecovery(previousJob, options);
  if (decision.state === 'fresh') {
    return { recovery_status: 'fresh', recovery_attempt: 0, recovery_reason: null, recovery_from_status: null };
  }
  return {
    recovery_status: decision.recoverable ? 'resuming' : decision.state,
    recovery_attempt: Number(previousJob?.recovery_attempt || 0) + (decision.recoverable ? 1 : 0),
    recovery_reason: decision.reason,
    recovery_from_status: previousJob?.status || null,
    recovery_previous_updated_at: previousJob?.updated_at || null
  };
}
