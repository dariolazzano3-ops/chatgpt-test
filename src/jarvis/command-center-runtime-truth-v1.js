import { deriveRemoteGitStatus } from '../source-of-truth.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export const JARVIS_TRUTH_CLASSIFICATION = Object.freeze({
  REAL: 'REAL',
  MOCK: 'MOCK',
  STATIC: 'STATIC',
  DERIVED: 'DERIVED',
  UNKNOWN: 'UNKNOWN'
});

export const JARVIS_SOURCE_STATE = Object.freeze({
  CONNECTED: 'CONNECTED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  UNAVAILABLE: 'UNAVAILABLE',
  STALE: 'STALE',
  REJECTED: 'REJECTED',
  UNKNOWN: 'UNKNOWN'
});

export const JARVIS_RUN_STATE = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  INTERRUPTED: 'INTERRUPTED',
  RESUMED: 'RESUMED',
  BLOCKED: 'BLOCKED'
});

export const JARVIS_SYSTEM_STATUS = Object.freeze({
  JARVIS: Object.freeze(['ONLINE', 'DEGRADED', 'UNKNOWN']),
  HERMES: Object.freeze(['ONLINE', 'OFFLINE', 'UNKNOWN']),
  ASTRA: Object.freeze(['AVAILABLE', 'DEGRADED', 'UNKNOWN']),
  CLAUDE: Object.freeze(['AVAILABLE', 'BUSY', 'UNAVAILABLE', 'UNKNOWN']),
  CODEX: Object.freeze(['STANDBY', 'ACTIVE', 'UNAVAILABLE', 'UNKNOWN']),
  BRIDGE: Object.freeze(['HEALTHY', 'DEGRADED', 'OFFLINE', 'UNKNOWN']),
  GIT: Object.freeze(['SYNCED', 'CHANGED', 'UNKNOWN'])
});

export const JARVIS_COMMAND_CENTER_DATA_SOURCE_MAP_V1 = Object.freeze([
  Object.freeze({ domain: 'JARVIS', classification: 'DERIVED', source: 'src/jarvis/http-v1.js + src/jarvis/runtime-v1.js', binding_state: 'PARTIAL', note: 'Session, memory and connector facts exist. core_online is currently a static true and is not accepted as liveness proof.' }),
  Object.freeze({ domain: 'HERMES', classification: 'UNKNOWN', source: null, binding_state: 'NOT_CONNECTED', note: 'No inspected live health reader proves Hermes process/container state.' }),
  Object.freeze({ domain: 'ASTRA', classification: 'UNKNOWN', source: null, binding_state: 'NOT_CONNECTED', note: 'No inspected runtime availability source is bound to the Command Center.' }),
  Object.freeze({ domain: 'CLAUDE', classification: 'STATIC', source: 'src/jarvis/integration-layer-v1.js', binding_state: 'POLICY_ONLY', note: 'Capability registry proves policy, not Claude Code availability or busy state.' }),
  Object.freeze({ domain: 'CODEX', classification: 'UNKNOWN', source: null, binding_state: 'NOT_CONNECTED', note: 'No inspected Codex fallback runtime status source is bound.' }),
  Object.freeze({ domain: 'BRIDGE', classification: 'UNKNOWN', source: null, binding_state: 'NOT_CONNECTED', note: 'No dedicated live Bridge health reader was established by the audit.' }),
  Object.freeze({ domain: 'GIT', classification: 'REAL', source: 'src/source-of-truth.js + github.remote_truth.read contract', binding_state: 'ADAPTER_REQUIRED', note: 'Git revision validation exists, but a live project-head resolver must be explicitly injected.' }),
  Object.freeze({ domain: 'RUNS', classification: 'REAL', source: 'src/ai-job-state.js + command-center execution_runs contract', binding_state: 'ADAPTER_REQUIRED', note: 'Real job states exist. Screenshot demo runs are not accepted as runtime truth.' }),
  Object.freeze({ domain: 'APPROVALS', classification: 'REAL', source: 'src/runtime-approvals.js', binding_state: 'ADAPTER_REQUIRED', note: 'Canonical scoped approval records exist; a read source must supply current records.' }),
  Object.freeze({ domain: 'ACTIVITY', classification: 'REAL', source: 'src/jarvis/audit-v1.js + JARVIS audit store', binding_state: 'READ_PATH_MISSING', note: 'Real events are persisted, but the inspected Supabase memory store exposes appendAudit without an audit read method.' }),
  Object.freeze({ domain: 'EVIDENCE', classification: 'UNKNOWN', source: null, binding_state: 'NOT_CONNECTED', note: 'Evidence must be explicitly resolved from a real evidence source, never synthesized from UI state.' }),
  Object.freeze({ domain: 'PROJECTS', classification: 'DERIVED', source: 'src/command-center.js portfolio snapshot', binding_state: 'STATE_DEPENDENT', note: 'Valid only when the supplied portfolio itself is authoritative runtime state.' }),
  Object.freeze({ domain: 'MEMORY', classification: 'REAL', source: 'src/jarvis/memory-store-supabase-v1.js', binding_state: 'READ_CAPABLE', note: 'Private JARVIS memory has a real read path when the durable store is configured.' }),
  Object.freeze({ domain: 'COSTS', classification: 'UNKNOWN', source: null, binding_state: 'NOT_CONNECTED', note: 'No complete JARVIS cost truth reader is established. Runtime audit defaults must not be presented as total spend.' }),
  Object.freeze({ domain: 'V2_PROGRESS', classification: 'DERIVED', source: 'src/jarvis/v2-progress-v1.js + src/jarvis/engineering-mission-v1.js', binding_state: 'READ_CAPABLE', note: 'Verified only from persisted Engineering Mission audit rows carrying independent_acceptance + acceptance_ref for JARVIS_MASTERARCHITECTURE_V2; never from elapsed time, chat activity, run count, or worker self-report.' })
]);

const SYSTEMS = Object.freeze(Object.keys(JARVIS_SYSTEM_STATUS));
const REALISH = new Set([JARVIS_TRUTH_CLASSIFICATION.REAL, JARVIS_TRUTH_CLASSIFICATION.DERIVED]);
const RUN_ALIASES = Object.freeze({ COMPLETED: 'COMPLETE' });

function validIso(value) {
  const text = clean(value, 80);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

function unknownSource(domain, state = JARVIS_SOURCE_STATE.NOT_CONNECTED, extra = {}) {
  return {
    domain,
    classification: JARVIS_TRUTH_CLASSIFICATION.UNKNOWN,
    source_state: state,
    source_id: null,
    observed_at: null,
    ...extra
  };
}

function normalizeSourceEnvelope(domain, raw = {}, nowMs = Date.now()) {
  if (!raw || typeof raw !== 'object') return { accepted: false, source: unknownSource(domain, JARVIS_SOURCE_STATE.REJECTED, { error_code: 'SOURCE_ENVELOPE_INVALID' }), data: null };

  const classification = clean(raw.classification, 40).toUpperCase();
  const sourceId = clean(raw.source_id, 240) || null;
  const observedAt = validIso(raw.observed_at);

  if (!REALISH.has(classification)) {
    return {
      accepted: false,
      source: unknownSource(domain, JARVIS_SOURCE_STATE.REJECTED, {
        error_code: 'NON_RUNTIME_TRUTH_REJECTED',
        rejected_classification: classification || JARVIS_TRUTH_CLASSIFICATION.UNKNOWN,
        source_id: sourceId,
        observed_at: observedAt
      }),
      data: null
    };
  }

  if (!sourceId || !observedAt) {
    return {
      accepted: false,
      source: unknownSource(domain, JARVIS_SOURCE_STATE.REJECTED, {
        error_code: 'RUNTIME_PROVENANCE_REQUIRED',
        source_id: sourceId,
        observed_at: observedAt
      }),
      data: null
    };
  }

  if (classification === JARVIS_TRUTH_CLASSIFICATION.DERIVED && !Array.isArray(raw.derived_from)) {
    return {
      accepted: false,
      source: unknownSource(domain, JARVIS_SOURCE_STATE.REJECTED, {
        error_code: 'DERIVED_PROVENANCE_REQUIRED',
        source_id: sourceId,
        observed_at: observedAt
      }),
      data: null
    };
  }

  const staleAfterMs = Number(raw.stale_after_ms);
  if (Number.isFinite(staleAfterMs) && staleAfterMs >= 0 && nowMs - Date.parse(observedAt) > staleAfterMs) {
    return {
      accepted: false,
      source: {
        domain,
        classification: JARVIS_TRUTH_CLASSIFICATION.UNKNOWN,
        source_state: JARVIS_SOURCE_STATE.STALE,
        source_id: sourceId,
        observed_at: observedAt,
        stale_after_ms: staleAfterMs,
        error_code: 'RUNTIME_SOURCE_STALE'
      },
      data: null
    };
  }

  return {
    accepted: true,
    source: {
      domain,
      classification,
      source_state: JARVIS_SOURCE_STATE.CONNECTED,
      source_id: sourceId,
      observed_at: observedAt,
      derived_from: classification === JARVIS_TRUTH_CLASSIFICATION.DERIVED ? clone(raw.derived_from) : undefined
    },
    data: clone(raw.data)
  };
}

async function safeRead(domain, reader, nowMs) {
  if (typeof reader !== 'function') return { accepted: false, source: unknownSource(domain), data: null };
  try {
    const raw = await reader();
    return normalizeSourceEnvelope(domain, raw, nowMs);
  } catch (error) {
    return {
      accepted: false,
      source: unknownSource(domain, JARVIS_SOURCE_STATE.UNAVAILABLE, {
        error_code: clean(error?.code || error?.name || 'SOURCE_READ_FAILED', 120)
      }),
      data: null
    };
  }
}

function normalizeSystemStatus(data = {}) {
  const result = {};
  for (const system of SYSTEMS) {
    const value = clean(data?.[system] ?? data?.[system.toLowerCase()], 40).toUpperCase();
    result[system] = JARVIS_SYSTEM_STATUS[system].includes(value) ? value : 'UNKNOWN';
  }
  return result;
}

function normalizeRunStatus(value) {
  const raw = clean(value, 80).toUpperCase();
  const normalized = RUN_ALIASES[raw] || raw;
  return Object.values(JARVIS_RUN_STATE).includes(normalized) ? normalized : null;
}

function normalizeRun(item = {}) {
  const id = clean(item.id || item.run_id || item.job_id, 200);
  const title = clean(item.title || item.order || item.request || item.task_type, 600);
  const status = normalizeRunStatus(item.status);
  if (!id || !title || !status) return null;

  const progress = Number(item.progress);
  const progressVerified = item.progress_verified === true;
  const progressBasis = clean(item.progress_basis, 600);

  return {
    id,
    title,
    worker: clean(item.worker || item.provider, 120) || null,
    status,
    started_at: validIso(item.started_at || item.start_time || item.created_at),
    updated_at: validIso(item.updated_at),
    progress: Number.isFinite(progress) && progress >= 0 && progress <= 100 && progressVerified && progressBasis ? progress : null,
    progress_basis: Number.isFinite(progress) && progress >= 0 && progress <= 100 && progressVerified && progressBasis ? progressBasis : null,
    result: item.result === undefined ? null : clone(item.result),
    evidence_ref: clean(item.evidence_ref || item.evidence_id, 300) || null,
    approval_state: clean(item.approval_state, 80).toUpperCase() || null
  };
}

function normalizeRuns(data) {
  const input = Array.isArray(data) ? data : [];
  const items = input.map(normalizeRun).filter(Boolean);
  return { items, accepted_count: items.length, rejected_count: input.length - items.length };
}

function normalizeApproval(item = {}) {
  const id = clean(item.approval_id || item.id, 200);
  if (!id) return null;
  const explicitState = clean(item.state || item.status, 80).toUpperCase();
  const state = ['PENDING', 'GRANTED', 'REVOKED', 'EXPIRED', 'UNKNOWN'].includes(explicitState)
    ? explicitState
    : item.granted === true ? 'GRANTED' : item.granted === false ? 'PENDING' : 'UNKNOWN';
  const risk = clean(item.risk, 40).toLowerCase();
  return {
    approval_id: id,
    run_id: clean(item.run_id || item.request_id, 200) || null,
    scope_key: clean(item.scope_key, 300) || null,
    approval_type: clean(item.approval_type, 120) || null,
    capability: clean(item.capability, 160) || null,
    reason: clean(item.reason, 600) || null,
    risk: ['niedrig', 'mittel', 'hoch', 'low', 'medium', 'high', 'critical'].includes(risk) ? risk : null,
    state,
    requested_at: validIso(item.requested_at || item.at),
    expires_at: validIso(item.expires_at),
    actor_id: clean(item.actor_id, 160) || null
  };
}

function normalizeApprovals(data) {
  const input = Array.isArray(data) ? data : [];
  const items = input.map(normalizeApproval).filter(Boolean);
  return { items, pending_count: items.filter((item) => item.state === 'PENDING').length, accepted_count: items.length, rejected_count: input.length - items.length };
}

function normalizeActivity(item = {}) {
  const at = validIso(item.at || item.timestamp || item.occurred_at);
  const event = clean(item.event || item.type || item.action, 160);
  if (!at || !event) return null;
  return {
    event,
    at,
    summary: clean(item.summary || item.message || item.request, 800) || null,
    run_id: clean(item.run_id || item.job_id || item.request_id, 200) || null,
    evidence_ref: clean(item.evidence_ref || item.evidence_id, 300) || null,
    status: clean(item.status || item.result?.status, 100).toUpperCase() || null
  };
}

function normalizeActivityList(data) {
  const input = Array.isArray(data) ? data : [];
  const items = input.map(normalizeActivity).filter(Boolean).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { items, accepted_count: items.length, rejected_count: input.length - items.length };
}

function normalizeEvidence(item = {}) {
  const id = clean(item.evidence_id || item.id || item.ref, 300);
  if (!id) return null;
  return {
    evidence_id: id,
    kind: clean(item.kind || item.type, 120) || null,
    status: clean(item.status, 80).toUpperCase() || null,
    observed_at: validIso(item.observed_at || item.at || item.created_at),
    url: clean(item.url, 1200) || null,
    path: clean(item.path, 800) || null,
    summary: clean(item.summary, 800) || null,
    run_ref: clean(item.run_ref || item.run_id, 200) || null,
    worker_verified: item.worker_verified === true,
    independent_acceptance: item.independent_acceptance === true,
    acceptance_ref: clean(item.acceptance_ref, 240) || null
  };
}

function normalizeEvidenceList(data) {
  const input = Array.isArray(data) ? data : [];
  const items = input.map(normalizeEvidence).filter(Boolean);
  return { items, accepted_count: items.length, rejected_count: input.length - items.length };
}

const V2_PROGRESS_FALLBACK = Object.freeze({
  program: null, current_wave: 0, completed_waves: [], blocked_wave: null,
  verified_progress_percent: 0, updated_at: null, evidence_refs: []
});

function normalizeV2Progress(data = {}) {
  const completedWaves = Array.isArray(data.completed_waves)
    ? data.completed_waves.filter((n) => Number.isInteger(n) && n >= 0 && n <= 12)
    : [];
  const percent = Number(data.verified_progress_percent);
  return {
    program: clean(data.program, 80) || null,
    current_wave: Number.isInteger(data.current_wave) && data.current_wave >= 0 && data.current_wave <= 12 ? data.current_wave : 0,
    completed_waves: completedWaves,
    blocked_wave: Number.isInteger(data.blocked_wave) && data.blocked_wave >= 0 && data.blocked_wave <= 12 ? data.blocked_wave : null,
    verified_progress_percent: Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : 0,
    updated_at: validIso(data.updated_at),
    evidence_refs: Array.isArray(data.evidence_refs) ? data.evidence_refs.map((v) => clean(v, 300)).filter(Boolean) : []
  };
}

function domainPayload(read, normalize, fallback) {
  return {
    source: read.source,
    data: read.accepted ? normalize(read.data) : clone(fallback)
  };
}

export async function createJarvisCommandCenterTruthSnapshotV1(bindings = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) throw new Error('JARVIS_COMMAND_CENTER_TRUTH_NOW_INVALID');

  const [systemsRead, runsRead, approvalsRead, activityRead, evidenceRead, projectsRead, memoryRead, costsRead, v2ProgressRead] = await Promise.all([
    safeRead('SYSTEM_STATUS', bindings.system_status, nowMs),
    safeRead('RUNS', bindings.runs, nowMs),
    safeRead('APPROVALS', bindings.approvals, nowMs),
    safeRead('ACTIVITY', bindings.activity, nowMs),
    safeRead('EVIDENCE', bindings.evidence, nowMs),
    safeRead('PROJECTS', bindings.projects, nowMs),
    safeRead('MEMORY', bindings.memory, nowMs),
    safeRead('COSTS', bindings.costs, nowMs),
    safeRead('V2_PROGRESS', bindings.v2_progress, nowMs)
  ]);

  const snapshot = {
    schema: 'aurentara.jarvis.command-center.runtime-truth.v1',
    generated_at: now.toISOString(),
    visual_baseline: 'ACCEPTED',
    operational_truth_policy: 'NO_MOCK_TRUTH',
    systems: domainPayload(systemsRead, normalizeSystemStatus, normalizeSystemStatus({})),
    runs: domainPayload(runsRead, normalizeRuns, { items: [], accepted_count: 0, rejected_count: 0 }),
    approvals: domainPayload(approvalsRead, normalizeApprovals, { items: [], pending_count: 0, accepted_count: 0, rejected_count: 0 }),
    activity: domainPayload(activityRead, normalizeActivityList, { items: [], accepted_count: 0, rejected_count: 0 }),
    evidence: domainPayload(evidenceRead, normalizeEvidenceList, { items: [], accepted_count: 0, rejected_count: 0 }),
    projects: { source: projectsRead.source, data: projectsRead.accepted ? clone(projectsRead.data) : null },
    memory: { source: memoryRead.source, data: memoryRead.accepted ? clone(memoryRead.data) : null },
    costs: { source: costsRead.source, data: costsRead.accepted ? clone(costsRead.data) : null },
    v2_progress: domainPayload(v2ProgressRead, normalizeV2Progress, V2_PROGRESS_FALLBACK),
    safeguards: {
      read_only: true,
      command_dispatch_enabled: false,
      production_deploy: false,
      dns_write: false,
      billing_write: false,
      secret_rotation: false,
      destructive_db_write: false,
      canonical_merge: false,
      public_release: false,
      docker_socket_exposed: false,
      hamyren_data_flow: false
    }
  };

  const validation = validateJarvisCommandCenterTruthSnapshotV1(snapshot);
  return { ...snapshot, validation };
}

// --- Wave 3: explicit live read bindings -------------------------------------
// JARVIS / HERMES / ASTRA / CLAUDE / CODEX / BRIDGE stay UNKNOWN unless a
// genuine live probe returns { live: true, state, source_id, observed_at }.
// GIT status is derived only from genuine remote truth (remote head vs local head).

const SYSTEM_PROBE_KEYS = Object.freeze(['jarvis', 'hermes', 'astra', 'claude', 'codex', 'bridge']);
const SYSTEM_LIVE_STATES = Object.freeze(Object.fromEntries(
  SYSTEMS.filter((system) => system !== 'GIT').map((system) => [
    system,
    JARVIS_SYSTEM_STATUS[system].filter((value) => value !== 'UNKNOWN')
  ])
));

function probeIsFresh(observedAt, staleAfterMs, nowMs) {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs < 0) return true;
  return nowMs - Date.parse(observedAt) <= staleAfterMs;
}

async function runSystemLiveProbe(domain, probe, nowMs) {
  if (typeof probe !== 'function') return null;
  let raw;
  try {
    raw = await probe();
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || raw.live !== true) return null;
  const state = clean(raw.state ?? raw.status, 40).toUpperCase();
  if (!SYSTEM_LIVE_STATES[domain] || !SYSTEM_LIVE_STATES[domain].includes(state)) return null;
  const observedAt = validIso(raw.observed_at);
  const sourceId = clean(raw.source_id, 240);
  if (!observedAt || !sourceId) return null;
  if (!probeIsFresh(observedAt, Number(raw.stale_after_ms), nowMs)) return null;
  return { domain, state, observed_at: observedAt, source_id: sourceId };
}

async function runGitRemoteTruthProbe(probe, nowMs) {
  if (typeof probe !== 'function') return null;
  let raw;
  try {
    raw = await probe();
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const observedAt = validIso(raw.observed_at);
  if (observedAt && !probeIsFresh(observedAt, Number(raw.stale_after_ms), nowMs)) return null;
  const derived = deriveRemoteGitStatus({
    remote_head: raw.remote_head ?? raw.remote_project_head ?? raw.genuine_remote_head,
    local_head: raw.local_head ?? raw.project_head ?? raw.observed_project_head,
    source_id: raw.source_id,
    observed_at: raw.observed_at
  });
  if (derived.status !== 'SYNCED' && derived.status !== 'CHANGED') return null;
  return { domain: 'GIT', state: derived.status, observed_at: derived.observed_at, source_id: derived.source_id };
}

export function createJarvisCommandCenterLiveProbeBindingsV1(probes = {}, options = {}) {
  const config = probes && typeof probes === 'object' ? probes : {};
  const hasSystemBinding = SYSTEM_PROBE_KEYS.some((key) => typeof config[key] === 'function')
    || typeof config.git === 'function';

  const bindings = {};

  if (hasSystemBinding) {
    bindings.system_status = async () => {
      const parsedNow = options.now ? new Date(options.now).getTime() : Date.now();
      const nowMs = Number.isNaN(parsedNow) ? Date.now() : parsedNow;

      const results = await Promise.all([
        ...SYSTEM_PROBE_KEYS.map((key) => runSystemLiveProbe(key.toUpperCase(), config[key], nowMs)),
        runGitRemoteTruthProbe(config.git, nowMs)
      ]);
      const proven = results.filter(Boolean);

      const data = {};
      for (const item of proven) data[item.domain] = item.state;

      const observedAt = proven.length
        ? new Date(Math.max(...proven.map((item) => Date.parse(item.observed_at)))).toISOString()
        : new Date(nowMs).toISOString();

      return {
        classification: JARVIS_TRUTH_CLASSIFICATION.DERIVED,
        source_id: 'jarvis-command-center-live-probes-v1',
        observed_at: observedAt,
        derived_from: proven.map((item) => `${item.domain.toLowerCase()}:${item.source_id}`),
        data
      };
    };
  }

  for (const key of ['runs', 'approvals', 'activity', 'evidence', 'projects', 'memory', 'costs', 'v2_progress']) {
    if (typeof config[key] === 'function') bindings[key] = config[key];
  }

  return bindings;
}

export function jarvisCommandCenterLiveProbeContractV1() {
  return {
    schema: 'aurentara.jarvis.command-center.live-probe.v1',
    wave: 3,
    system_probe_domains: SYSTEM_PROBE_KEYS.map((key) => key.toUpperCase()),
    system_probe_envelope: { live: true, state: 'ENUM', source_id: 'string', observed_at: 'ISO-8601', stale_after_ms: 'optional' },
    git_status_source: 'genuine_remote_truth_only',
    git_status_states: JARVIS_SYSTEM_STATUS.GIT,
    unproven_system_result: 'UNKNOWN',
    fail_closed: true,
    writes_enabled: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}

export function validateJarvisCommandCenterTruthSnapshotV1(snapshot = {}) {
  const violations = [];
  const domains = ['systems', 'runs', 'approvals', 'activity', 'evidence', 'projects', 'memory', 'costs', 'v2_progress'];
  for (const domain of domains) {
    const classification = snapshot?.[domain]?.source?.classification;
    if (classification === JARVIS_TRUTH_CLASSIFICATION.MOCK || classification === JARVIS_TRUTH_CLASSIFICATION.STATIC) {
      violations.push({ domain, code: 'NON_RUNTIME_OPERATIONAL_TRUTH_VISIBLE', classification });
    }
  }

  for (const run of snapshot?.runs?.data?.items || []) {
    if (run.progress !== null && (!run.progress_verified && !run.progress_basis)) {
      violations.push({ domain: 'RUNS', code: 'UNVERIFIED_PROGRESS_VISIBLE', run_id: run.id });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    mock_operational_truth_visible: violations.some((item) => item.code === 'NON_RUNTIME_OPERATIONAL_TRUTH_VISIBLE')
  };
}

export function jarvisCommandCenterRuntimeTruthManifestV1() {
  return {
    schema: 'aurentara.jarvis.command-center.runtime-truth.v1',
    wave: 3,
    mode: 'READ_ONLY',
    live_probe_bindings: true,
    git_status_requires_remote_truth: true,
    visual_baseline: 'ACCEPTED',
    data_classifications: Object.values(JARVIS_TRUTH_CLASSIFICATION),
    run_states: Object.values(JARVIS_RUN_STATE),
    systems: SYSTEMS,
    fail_closed_unknown: true,
    mock_operational_truth_allowed: false,
    progress_requires_verified_basis: true,
    writes_enabled: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
