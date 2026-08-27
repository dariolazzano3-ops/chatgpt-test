import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const TERMINAL = new Set(['READY_FOR_REVIEW', 'WORKSHOP_REQUIRED', 'FAILED']);
const MAX_EVENTS = 80;
const STALE_JOB_MS = 45 * 60 * 1000;

function headers() {
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  return { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' };
}

function safeId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{7,127}$/.test(id)) throw new Error('JOB_ID_INVALID');
  return id;
}

function finiteMs(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}

function compactStringArray(value, max = 12) {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, max);
}

function normalizeEvent(event, now, sequence) {
  if (!event || typeof event !== 'object') return null;
  const type = String(event.type || '').trim().toUpperCase();
  if (!/^[A-Z0-9_]{3,48}$/.test(type)) return null;
  const normalized = { sequence, at: now, type };
  if (Number.isInteger(Number(event.attempt)) && Number(event.attempt) >= 0) normalized.attempt = Number(event.attempt);
  if (event.outcome) normalized.outcome = String(event.outcome).slice(0, 48);
  if (event.stage) normalized.stage = String(event.stage).slice(0, 64);
  if (event.commit_sha && /^[0-9a-f]{40}$/i.test(String(event.commit_sha))) normalized.commit_sha = String(event.commit_sha);
  if (event.preview_url && /^https:\/\//i.test(String(event.preview_url))) normalized.preview_url = String(event.preview_url).slice(0, 500);
  const issueCodes = compactStringArray(event.issue_codes);
  if (issueCodes) normalized.issue_codes = issueCodes;
  const repairProfiles = compactStringArray(event.repair_profiles);
  if (repairProfiles) normalized.repair_profiles = repairProfiles;
  const durations = {};
  for (const key of ['preview_ms', 'qa_ms', 'repair_ms', 'total_ms']) {
    const value = finiteMs(event[key]);
    if (value !== undefined) durations[key] = value;
  }
  if (Object.keys(durations).length) normalized.durations_ms = durations;
  if (event.note) normalized.note = String(event.note).slice(0, 320);
  return normalized;
}

function classifyFailureKind({ error = '', stage = '' } = {}) {
  const text = `${stage} ${error}`.toLowerCase();
  if (/ambiguous|clarification|no_verified_updates|no verified updates/.test(text)) return 'request_ambiguity';
  if (/visual.?qa|qa_failure|overflow|page_error/.test(text)) return 'project_quality';
  if (/fulfillment|request_fulfillment/.test(text)) return 'request_fulfillment';
  if (/cloudflare|wrangler|github|token|credential|network|timeout|workflow|checkout|fetch|push|api|runner|artifact/.test(text)) return 'infrastructure';
  return 'pipeline_unknown';
}

function classifyRecovery(existing, now) {
  if (!existing?.job_id) return { status: 'fresh', attempt: 0, reason: null, from: null };
  const updated = Date.parse(String(existing.updated_at || existing.created_at || ''));
  const stale = Number.isFinite(updated) && Date.parse(now) - updated >= STALE_JOB_MS;
  const status = String(existing.status || 'UNKNOWN');
  if (status === 'READY_FOR_REVIEW') return { status: 'complete', attempt: Number(existing.recovery_attempt || 0), reason: 'ALREADY_READY_FOR_REVIEW', from: status };
  if (status === 'WORKSHOP_REQUIRED') return { status: 'manual_review', attempt: Number(existing.recovery_attempt || 0), reason: 'REQUEST_FULFILLMENT_REQUIRES_WORKSHOP', from: status };
  if (status === 'FAILED') {
    const kind = String(existing.failure_kind || classifyFailureKind({ error: existing.last_error, stage: existing.failure_stage }));
    const recoverable = kind === 'infrastructure' || kind === 'pipeline_unknown';
    return { status: recoverable ? 'resuming' : 'manual_review', attempt: Number(existing.recovery_attempt || 0) + (recoverable ? 1 : 0), reason: `FAILED_${kind.toUpperCase()}`, from: status };
  }
  if (!TERMINAL.has(status) && stale) return { status: 'resuming', attempt: Number(existing.recovery_attempt || 0) + 1, reason: 'STALE_INCOMPLETE_JOB', from: status };
  return { status: 'in_progress', attempt: Number(existing.recovery_attempt || 0), reason: 'JOB_STILL_ACTIVE', from: status };
}

async function readJson(path, required = false) {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=${encodeURIComponent(controlRef)}`, { headers: headers() });
  if (response.status === 404 && !required) return { sha: null, value: null };
  if (!response.ok) throw new Error(`JOB_STATE_READ_FAILED_${response.status}:${(await response.text()).slice(0,240)}`);
  const body = await response.json();
  return { sha: body.sha, value: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) };
}

async function writeJson(path, value, sha, message) {
  const payload = { message, content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64'), branch: controlRef };
  if (sha) payload.sha = sha;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`JOB_STATE_WRITE_FAILED_${response.status}:${(await response.text()).slice(0,360)}`);
}

function currentGitSha() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
  } catch { return null; }
}

export function deriveJobId(requestKey, requestFile = '') {
  if (requestKey) return safeId(requestKey);
  return crypto.createHash('sha256').update(String(requestFile)).digest('hex');
}

export async function updateFactoryJob(jobId, patch = {}) {
  const id = safeId(jobId);
  const path = `factory-state/jobs/${id}.json`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const current = await readJson(path, false);
    const now = new Date().toISOString();
    const existing = current.value && typeof current.value === 'object' ? current.value : {};
    const { __event, ...publicPatch } = patch || {};
    const recovery = publicPatch.status === 'REQUESTED' ? classifyRecovery(existing, now) : null;
    if (publicPatch.status === 'REQUESTED' && recovery?.status === 'manual_review') {
      throw new Error(`RECOVERY_MANUAL_REVIEW_REQUIRED:${recovery.reason}`);
    }
    const recoveryEvent = recovery?.status === 'resuming' ? { type: 'RECOVERY_STARTED', stage: 'queue', outcome: 'safe_retry', note: recovery.reason } : null;
    const retryReset = publicPatch.status === 'REQUESTED' ? {
      qa_attempt: 0, qa_status: 'pending', last_error: null, failure_stage: null, failure_kind: null, retry_exhausted: false,
      qa_result: null, preview_url: null, commit_sha: null, branch: null, project_slug: null, revision: null,
      run_started_at: now, run_number: Number(existing.run_number || 0) + 1,
      recovery_status: recovery.status, recovery_attempt: recovery.attempt, recovery_reason: recovery.reason,
      recovery_from_status: recovery.from, recovery_previous_updated_at: existing.updated_at || null
    } : {};
    const terminalCleanup = publicPatch.status === 'READY_FOR_REVIEW' ? {
      last_error: null, failure_stage: null, failure_kind: null, retry_exhausted: false,
      recovery_status: existing.recovery_status === 'resuming' ? 'recovered' : (existing.recovery_status || 'not_needed')
    } : {};
    const inferredSha = publicPatch.status === 'READY_FOR_REVIEW' && !publicPatch.commit_sha ? currentGitSha() : null;
    const previousEvents = Array.isArray(existing.events) ? existing.events : [];
    const firstEvent = normalizeEvent(recoveryEvent, now, Number(previousEvents.at(-1)?.sequence || 0) + 1);
    const eventBase = firstEvent ? [...previousEvents, firstEvent] : previousEvents;
    const normalizedEvent = normalizeEvent(__event, now, Number(eventBase.at(-1)?.sequence || 0) + 1);
    const events = normalizedEvent ? [...eventBase, normalizedEvent].slice(-MAX_EVENTS) : eventBase.slice(-MAX_EVENTS);
    const next = {
      version: 3, telemetry_version: 2, recovery_version: 1, job_id: id, created_at: existing.created_at || now,
      max_qa_attempts: 3, qa_attempt: 0, production_deploy: false, run_number: Number(existing.run_number || 0),
      recovery_status: existing.recovery_status || 'not_needed', recovery_attempt: Number(existing.recovery_attempt || 0),
      ...existing, ...retryReset, ...publicPatch, ...terminalCleanup, ...(inferredSha ? { commit_sha: inferredSha } : {}),
      events, event_count: events.length, job_id: id, production_deploy: false, updated_at: now
    };
    try {
      await writeJson(path, next, current.sha, `Factory job ${id.slice(0,12)}: ${next.status || 'update'}`);
      return next;
    } catch (error) {
      if (!String(error?.message || error).includes('409') || attempt === 4) throw error;
    }
  }
}

export async function recordFactoryJobEvent(jobId, event, patch = {}) {
  return updateFactoryJob(jobId, { ...patch, __event: event });
}

export async function failFactoryJobUnlessTerminal(jobId, patch = {}) {
  const id = safeId(jobId);
  const current = await readJson(`factory-state/jobs/${id}.json`, false);
  if (TERMINAL.has(String(current.value?.status || ''))) return current.value;
  const failureKind = patch.failure_kind || classifyFailureKind({ error: patch.last_error, stage: patch.failure_stage });
  const recoverable = failureKind === 'infrastructure' || failureKind === 'pipeline_unknown';
  return updateFactoryJob(id, {
    ...patch,
    failure_kind: failureKind,
    recovery_status: recoverable ? (current.value?.recovery_status || 'retry_available') : 'manual_review',
    recovery_reason: recoverable ? (current.value?.recovery_reason || `FAILED_${failureKind.toUpperCase()}`) : `FAILED_${failureKind.toUpperCase()}`,
    status: 'FAILED',
    qa_status: patch.qa_status || current.value?.qa_status || 'not_run',
    production_deploy: false,
    __event: patch.__event || { type: 'JOB_FAILED', stage: patch.failure_stage || 'workflow', outcome: failureKind }
  });
}

export async function resolveCandidateRevision(projectSlug, qaOnly = false) {
  const current = await readJson('factory-state/projects.json', false);
  const base = Number(current.value?.projects?.[projectSlug]?.edit_revision || 0);
  return qaOnly ? base : base + 1;
}

if (process.argv[1]?.endsWith('factory-job-state.mjs') && process.argv[2]) {
  const [jobId, status, patchRaw = '{}'] = process.argv.slice(2);
  const patch = JSON.parse(patchRaw);
  const result = status === 'FAIL_SAFE' ? await failFactoryJobUnlessTerminal(jobId, patch) : await updateFactoryJob(jobId, { ...patch, status });
  console.log(JSON.stringify(result, null, 2));
}
