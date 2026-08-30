const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

const CORE_FACTORIES = Object.freeze(['web', 'automation', 'ai', 'business']);
const CI_STEPS = Object.freeze({
  core_ci: 'Validate JavaScript',
  integrated_regression_gate: 'Integrated RIOSYSTEMS regression gate',
  dashboard_ci: 'Private Operator Dashboard V1 acceptance',
  universal_mission_ci: 'Universal Mission V1 acceptance'
});

function signal(status, label, extras = {}) {
  return { status, raw: status, label, ...extras };
}

function mapActionState(step = {}, run = {}) {
  const conclusion = clean(step.conclusion || run.conclusion, 80).toLowerCase();
  const status = clean(step.status || run.status, 80).toLowerCase();
  if (conclusion === 'success') return 'HEALTHY';
  if (['failure','timed_out','action_required','startup_failure'].includes(conclusion)) return 'BLOCKED';
  if (['cancelled','skipped','neutral'].includes(conclusion)) return 'NOT_VERIFIED';
  if (['queued','in_progress','waiting','pending','requested'].includes(status)) return 'DEGRADED';
  return 'NOT_VERIFIED';
}

function dateMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function applyFreshness(baseStatus, timestamp, nowMs, maxAgeMs) {
  if (baseStatus !== 'HEALTHY') return baseStatus;
  const at = dateMs(timestamp);
  if (!at) return 'NOT_VERIFIED';
  return nowMs - at > maxAgeMs ? 'STALE' : 'HEALTHY';
}

function collectEvidenceDates(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceDates(item, output);
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && /(verified_at|completed_at|executed_at|observed_at|captured_at|recorded_at|timestamp)$/i.test(key)) {
      const parsed = dateMs(item);
      if (parsed) output.push({ key, value: item, ms: parsed });
    } else if (item && typeof item === 'object') {
      collectEvidenceDates(item, output);
    }
  }
  return output;
}

function factoryHealth(baseHealth = {}) {
  const items = Array.isArray(baseHealth.factories) ? baseHealth.factories : baseHealth.factories?.items || [];
  const core = CORE_FACTORIES.map((name) => items.find((item) => item.factory === name)).filter(Boolean);
  if (core.length !== CORE_FACTORIES.length) {
    return signal('NOT_VERIFIED', 'Core factory readiness is incomplete', { verified_factories: core.map((item) => item.factory), required_factories: [...CORE_FACTORIES] });
  }
  const statuses = core.map((item) => clean(item.status, 120).toUpperCase());
  if (statuses.every((status) => status === 'LIVE_STAGING_VERIFIED')) {
    return signal('HEALTHY', 'Core factories are live-staging verified', { factories: clone(core) });
  }
  if (statuses.some((status) => ['NOT_READY','BLOCKED','FAILED'].includes(status))) {
    return signal('BLOCKED', 'At least one core factory is blocked', { factories: clone(core) });
  }
  return signal('DEGRADED', 'Core factories are not all live-staging verified', { factories: clone(core) });
}

function providerFreshness(baseHealth = {}, nowMs, maxAgeMs) {
  const items = Array.isArray(baseHealth.factories) ? baseHealth.factories : baseHealth.factories?.items || [];
  const core = CORE_FACTORIES.map((name) => items.find((item) => item.factory === name)).filter(Boolean);
  if (core.length !== CORE_FACTORIES.length) return signal('NOT_VERIFIED', 'Provider evidence set is incomplete');
  const records = [];
  for (const factory of core) {
    const dates = collectEvidenceDates(factory.evidence || {});
    if (!dates.length) {
      records.push({ factory: factory.factory, status: 'NOT_VERIFIED', evidence_at: null, age_ms: null });
      continue;
    }
    const newest = dates.sort((a, b) => b.ms - a.ms)[0];
    const age = Math.max(0, nowMs - newest.ms);
    records.push({ factory: factory.factory, status: age > maxAgeMs ? 'STALE' : 'HEALTHY', evidence_at: newest.value, age_ms: age });
  }
  if (records.some((item) => item.status === 'NOT_VERIFIED')) return signal('NOT_VERIFIED', 'Provider evidence freshness cannot be verified for all core factories', { items: records, max_age_ms: maxAgeMs });
  if (records.some((item) => item.status === 'STALE')) return signal('STALE', 'At least one core provider evidence record is stale', { items: records, max_age_ms: maxAgeMs });
  return signal('HEALTHY', 'Core provider evidence is fresh', { items: records, max_age_ms: maxAgeMs });
}

async function fetchJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'RIOSYSTEMS-System-Health-V1', 'x-github-api-version': '2022-11-28' } });
  } catch (error) {
    return { ok: false, error: `GITHUB_HEALTH_UNAVAILABLE:${clean(error?.message || error, 240)}` };
  }
  if (!response.ok) return { ok: false, error: `GITHUB_HEALTH_HTTP_${response.status}` };
  try { return { ok: true, data: await response.json() }; }
  catch { return { ok: false, error: 'GITHUB_HEALTH_INVALID_JSON' }; }
}

async function githubSignals({ fetch_impl, owner, repo, branch, now_ms, ci_max_age_ms }) {
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const branchResponse = await fetchJson(fetch_impl, `${api}/branches/${encodeURIComponent(branch)}`);
  if (!branchResponse.ok) {
    const unavailable = signal('NOT_VERIFIED', 'GitHub branch truth could not be verified', { error: branchResponse.error });
    return { branch_head: unavailable, core_ci: unavailable, integrated_regression_gate: unavailable, dashboard_ci: unavailable, universal_mission_ci: unavailable };
  }
  const headSha = branchResponse.data?.commit?.sha || null;
  if (!headSha) {
    const missing = signal('NOT_VERIFIED', 'GitHub branch head is missing');
    return { branch_head: missing, core_ci: missing, integrated_regression_gate: missing, dashboard_ci: missing, universal_mission_ci: missing };
  }
  const branchSignal = signal('HEALTHY', 'factory-control branch head verified', { head_sha: headSha, source: 'github_actions_api' });
  const runsResponse = await fetchJson(fetch_impl, `${api}/actions/runs?head_sha=${encodeURIComponent(headSha)}&event=push&per_page=20`);
  if (!runsResponse.ok) {
    const unavailable = signal('NOT_VERIFIED', 'GitHub CI run could not be verified', { head_sha: headSha, error: runsResponse.error });
    return { branch_head: branchSignal, core_ci: unavailable, integrated_regression_gate: unavailable, dashboard_ci: unavailable, universal_mission_ci: unavailable };
  }
  const runs = Array.isArray(runsResponse.data?.workflow_runs) ? runsResponse.data.workflow_runs : [];
  const run = runs.find((item) => item.name === 'CI' && item.head_sha === headSha) || null;
  if (!run) {
    const missing = signal('NOT_VERIFIED', 'No exact-head CI push run exists yet', { head_sha: headSha });
    return { branch_head: branchSignal, core_ci: missing, integrated_regression_gate: missing, dashboard_ci: missing, universal_mission_ci: missing };
  }
  const runTimestamp = run.updated_at || run.created_at || null;
  const runBaseStatus = applyFreshness(mapActionState({}, run), runTimestamp, now_ms, ci_max_age_ms);
  if (runBaseStatus === 'BLOCKED') {
    const blocked = signal('BLOCKED', 'Exact-head CI push run failed', { head_sha: headSha, run_id: run.id, conclusion: run.conclusion, updated_at: runTimestamp });
    return { branch_head: branchSignal, core_ci: blocked, integrated_regression_gate: blocked, dashboard_ci: blocked, universal_mission_ci: blocked };
  }
  if (!run.jobs_url) {
    const missing = signal(runBaseStatus === 'HEALTHY' ? 'NOT_VERIFIED' : runBaseStatus, 'CI job details are unavailable', { head_sha: headSha, run_id: run.id });
    return { branch_head: branchSignal, core_ci: missing, integrated_regression_gate: missing, dashboard_ci: missing, universal_mission_ci: missing };
  }
  const jobsResponse = await fetchJson(fetch_impl, run.jobs_url);
  if (!jobsResponse.ok) {
    const unavailable = signal('NOT_VERIFIED', 'CI job details could not be verified', { head_sha: headSha, run_id: run.id, error: jobsResponse.error });
    return { branch_head: branchSignal, core_ci: unavailable, integrated_regression_gate: unavailable, dashboard_ci: unavailable, universal_mission_ci: unavailable };
  }
  const jobs = Array.isArray(jobsResponse.data?.jobs) ? jobsResponse.data.jobs : [];
  const steps = jobs.flatMap((job) => Array.isArray(job.steps) ? job.steps : []);
  const output = { branch_head: branchSignal };
  for (const [key, stepName] of Object.entries(CI_STEPS)) {
    const step = steps.find((item) => item.name === stepName);
    if (!step) {
      output[key] = signal('NOT_VERIFIED', `${stepName} is not present on the exact-head CI run`, { head_sha: headSha, run_id: run.id });
      continue;
    }
    let status = mapActionState(step, run);
    status = applyFreshness(status, runTimestamp, now_ms, ci_max_age_ms);
    output[key] = signal(status, `${stepName}: ${step.conclusion || step.status || 'unknown'}`, {
      head_sha: headSha,
      run_id: run.id,
      run_number: run.run_number,
      step: stepName,
      conclusion: step.conclusion || null,
      updated_at: runTimestamp,
      source: 'github_actions_exact_factory_control_head'
    });
  }
  return output;
}

async function runtimePersistenceSignal({ env, runtime_service }) {
  const environment = clean(env?.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase();
  const storeMode = clean(env?.RIOSYSTEMS_OPERATOR_RUNTIME_STORE, 80).toLowerCase();
  if (environment !== 'staging') return signal('NOT_VERIFIED', 'Durable runtime persistence is only authoritatively classified in staging', { environment: environment || 'unknown', store_mode: storeMode || 'unknown' });
  if (storeMode !== 'supabase') return signal('BLOCKED', 'Staging runtime is not configured for Supabase durability', { environment, store_mode: storeMode || 'missing' });
  if (!runtime_service || typeof runtime_service.handle !== 'function') return signal('BLOCKED', 'Staging runtime service is unavailable', { environment, store_mode: storeMode });
  try {
    const snapshot = await runtime_service.handle({ method: 'GET', path: '/snapshot' });
    if (!snapshot?.ok) return signal('BLOCKED', 'Durable runtime snapshot could not be loaded', { environment, store_mode: storeMode, status: snapshot?.status || null });
    return signal('HEALTHY', 'Supabase-backed runtime snapshot loaded successfully', { environment, store_mode: storeMode, runtime_revision: snapshot.runtime?.revision ?? null });
  } catch (error) {
    return signal('BLOCKED', 'Durable runtime store is unreachable', { environment, store_mode: storeMode, error: clean(error?.message || error, 240) });
  }
}

function stagingAvailabilitySignal({ env, runtimePersistence }) {
  const environment = clean(env?.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase();
  if (environment !== 'staging') return signal('NOT_VERIFIED', 'Staging availability is not proven by a non-staging request', { environment: environment || 'unknown' });
  if (runtimePersistence.status === 'BLOCKED') return signal('BLOCKED', 'Staging operator request is serving but runtime persistence is blocked', { source: 'current_authenticated_operator_request' });
  return signal('HEALTHY', 'Authenticated staging operator endpoint is serving this health request', { source: 'current_authenticated_operator_request' });
}

function overallStatus(signals = {}) {
  const statuses = Object.values(signals).map((item) => item?.status).filter(Boolean);
  if (statuses.includes('BLOCKED')) return 'BLOCKED';
  if (statuses.includes('NOT_VERIFIED')) return 'NOT_VERIFIED';
  if (statuses.includes('STALE')) return 'STALE';
  if (statuses.includes('DEGRADED')) return 'DEGRADED';
  return statuses.length ? 'HEALTHY' : 'NOT_VERIFIED';
}

export async function buildAuthoritativeOperatorSystemHealth({ base_health = {}, env = {}, runtime_service = null, fetch_impl = globalThis.fetch, now = new Date(), owner = 'dariolazzano3-ops', repo = 'chatgpt-test', branch = 'factory-control', ci_max_age_ms = 12 * 60 * 60 * 1000, provider_max_age_ms = 7 * 24 * 60 * 60 * 1000 } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const environment = clean(env?.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase();
  const github = environment === 'staging'
    ? await githubSignals({ fetch_impl, owner, repo, branch, now_ms: safeNow, ci_max_age_ms })
    : {
        branch_head: signal('NOT_VERIFIED', 'GitHub exact-head health is only polled by staging runtime'),
        core_ci: signal('NOT_VERIFIED', 'Core CI is not polled outside staging runtime'),
        integrated_regression_gate: signal('NOT_VERIFIED', 'Integrated regression is not polled outside staging runtime'),
        dashboard_ci: signal('NOT_VERIFIED', 'Dashboard CI is not polled outside staging runtime'),
        universal_mission_ci: signal('NOT_VERIFIED', 'Universal Mission CI is not polled outside staging runtime')
      };
  const persistence = await runtimePersistenceSignal({ env, runtime_service });
  const signals = {
    core_ci: github.core_ci,
    integrated_regression_gate: github.integrated_regression_gate,
    dashboard_ci: github.dashboard_ci,
    universal_mission_ci: github.universal_mission_ci,
    factory_readiness: factoryHealth(base_health),
    provider_evidence_freshness: providerFreshness(base_health, safeNow, provider_max_age_ms),
    runtime_persistence: persistence,
    staging_availability: stagingAvailabilitySignal({ env, runtimePersistence: persistence })
  };
  return {
    schema: 'riosystems.operator-system-health.v3',
    status: overallStatus(signals),
    checked_at: new Date(safeNow).toISOString(),
    branch_truth: github.branch_head,
    signals,
    production: signal('HEALTHY', 'Production remains locked', { production_deploy: false }),
    rules: {
      no_inferred_green_states: true,
      exact_factory_control_head_required_for_ci_health: true,
      ci_max_age_ms,
      provider_evidence_max_age_ms: provider_max_age_ms
    },
    base_health: clone(base_health),
    production_deploy: false
  };
}

export function operatorSystemHealthManifest() {
  return {
    schema: 'riosystems.operator-system-health.v3',
    states: ['HEALTHY','DEGRADED','BLOCKED','STALE','NOT_VERIFIED'],
    authoritative_sources: ['github_actions_exact_factory_control_head','operator_runtime_store','factory_readiness_matrix','provider_evidence','current_authenticated_staging_request'],
    github_token_required: false,
    public_repository_read_only: true,
    production_deploy: false
  };
}
