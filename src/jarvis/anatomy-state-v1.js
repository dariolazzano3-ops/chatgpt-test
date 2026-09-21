/* JARVIS Anatomy View — anatomy state contract V1.

   Pure derivation only: takes the already-produced runtime-truth domain
   envelopes (systems / runs / evidence / memory — the exact shapes returned
   by createJarvisCommandCenterTruthSnapshotV1) and projects them onto the
   nine JARVIS "body" zones. Nothing here reads a store, calls a network, or
   invents a value that the caller did not already prove.

   Body mapping (see BODY MAPPING in the mission brief):
     core            = JARVIS CORE                       <- systems.JARVIS
     brain           = Reasoning / Operator Logic         <- systems.ASTRA
                        (ASTRA is this codebase's own "Reasoning & Kontrolle"
                        node — see command-center-worker-binding-v1.js — so
                        this reuses an existing, self-described source rather
                        than inventing a new semantic binding.)
     eyes            = Perception / Monitoring            <- no genuine source yet
     ears            = Voice / Input                      <- no genuine source yet
     mouth           = Communication / Output              <- no genuine source yet
     right_hand      = Claude Code / Engineering Execution <- systems.CLAUDE +
                        systems.BRIDGE + persisted runs/evidence
     left_hand       = Browser / Desktop Execution         <- no genuine source yet
     nervous_system  = Bridge / integrations & connectors  <- systems.BRIDGE
     infrastructure  = VPS/service/runtime/git/storage     <- systems.GIT +
                        memory + systems.JARVIS

   eyes / ears / mouth / left_hand stay fixed NOT_CONNECTED: no existing
   runtime-truth source genuinely proves perception, voice input,
   communication output, or a browser/desktop execution binding today. That
   is a deliberate absence, not an oversight — inventing a mapping onto an
   unrelated existing signal (e.g. HERMES health -> "ears") would be exactly
   the kind of fabricated operational state this contract forbids. */

export const JARVIS_ANATOMY_STATUS = Object.freeze({
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
  NOT_CONNECTED: 'NOT_CONNECTED'
});

export const JARVIS_ANATOMY_MODULES = Object.freeze([
  'core', 'brain', 'eyes', 'ears', 'mouth', 'right_hand', 'left_hand', 'nervous_system', 'infrastructure'
]);

export const JARVIS_AUTONOMY_STAGE = Object.freeze({
  IDLE: 'IDLE',
  WORK_DETECTED: 'WORK_DETECTED',
  JOB_CREATED: 'JOB_CREATED',
  EXECUTING: 'EXECUTING',
  VERIFYING: 'VERIFYING',
  REPAIRING: 'REPAIRING',
  COMPLETE: 'COMPLETE',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN'
});

export const JARVIS_AUTONOMY_STAGES = Object.freeze([
  'IDLE', 'WORK_DETECTED', 'JOB_CREATED', 'EXECUTING', 'VERIFYING', 'REPAIRING', 'COMPLETE', 'BLOCKED', 'FAILED'
]);

const STATUS_VALUES = new Set(Object.values(JARVIS_ANATOMY_STATUS));

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const isoOrNull = (value) => {
  const text = clean(value, 80);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
};

const NOT_PROVEN_MODULES = Object.freeze({
  eyes: {
    label: 'Eyes — Perception / Monitoring',
    capability: 'Perception & monitoring signal',
    reason: 'NO_GENUINE_SOURCE_BOUND'
  },
  ears: {
    label: 'Ears — Voice / Input',
    capability: 'Voice & input channel',
    reason: 'NO_GENUINE_SOURCE_BOUND'
  },
  mouth: {
    label: 'Mouth — Communication / Output',
    capability: 'Communication & output channel',
    reason: 'NO_GENUINE_SOURCE_BOUND'
  },
  left_hand: {
    label: 'Left Hand — Browser / Desktop Execution',
    capability: 'Browser / desktop execution',
    reason: 'NO_GENUINE_SOURCE_BOUND'
  }
});

function baseModule({
  status, label, capability, source = null, observed_at = null,
  last_success = null, reason = null, evidence_ref = null, detail = {}
}) {
  const resolvedStatus = STATUS_VALUES.has(status) ? status : JARVIS_ANATOMY_STATUS.UNKNOWN;
  return {
    status: resolvedStatus,
    label,
    capability,
    source,
    observed_at,
    last_success,
    reason,
    // `error` / `degraded_reason` are the explicit typed views of `reason`
    // (kept for compatibility) — each derive* function already only ever
    // populates `reason` with a concrete proven cause on the matching
    // FAILED/DEGRADED branch, so no new reason is invented here.
    error: resolvedStatus === JARVIS_ANATOMY_STATUS.FAILED ? reason : null,
    degraded_reason: resolvedStatus === JARVIS_ANATOMY_STATUS.DEGRADED ? reason : null,
    evidence_ref,
    detail
  };
}

function notProvenModule(key) {
  const meta = NOT_PROVEN_MODULES[key];
  return baseModule({ status: JARVIS_ANATOMY_STATUS.NOT_CONNECTED, label: meta.label, capability: meta.capability, reason: meta.reason });
}

/** Reads the `systems` domain envelope exactly as produced by
 *  createJarvisCommandCenterTruthSnapshotV1 (domainPayload(systemsRead, ...)):
 *  { source: {classification, source_state, source_id, observed_at, ...}, data: {...} }.
 *  Only source_state === 'CONNECTED' is trusted; STALE / REJECTED / UNAVAILABLE /
 *  NOT_CONNECTED / UNKNOWN all fail closed the same way (no proof). */
function systemsEnvelope(domains) {
  const systems = domains?.systems;
  const source = (systems && typeof systems === 'object' && systems.source) || {};
  const sourceState = clean(source.source_state, 40).toUpperCase() || 'UNKNOWN';
  const connected = sourceState === 'CONNECTED';
  return {
    connected,
    data: connected && systems.data && typeof systems.data === 'object' ? systems.data : {},
    sourceId: connected ? (clean(source.source_id, 240) || null) : null,
    observedAt: connected ? isoOrNull(source.observed_at) : null,
    sourceState
  };
}

function sysValue(sys, key) {
  return clean(sys.data?.[key], 40).toUpperCase();
}

function deriveCore(domains) {
  const sys = systemsEnvelope(domains);
  const label = 'JARVIS Core';
  const capability = 'Central JARVIS runtime core';
  if (!sys.connected) {
    return baseModule({ status: JARVIS_ANATOMY_STATUS.NOT_CONNECTED, label, capability, reason: `SYSTEMS_SOURCE_${sys.sourceState}` });
  }
  const value = sysValue(sys, 'JARVIS');
  const status = value === 'ONLINE' ? JARVIS_ANATOMY_STATUS.HEALTHY
    : value === 'DEGRADED' ? JARVIS_ANATOMY_STATUS.DEGRADED
    : JARVIS_ANATOMY_STATUS.UNKNOWN;
  return baseModule({
    status, label, capability,
    source: sys.sourceId, observed_at: sys.observedAt,
    last_success: status === JARVIS_ANATOMY_STATUS.HEALTHY ? sys.observedAt : null,
    reason: status === JARVIS_ANATOMY_STATUS.DEGRADED ? 'JARVIS_SYSTEM_DEGRADED' : null,
    evidence_ref: sys.sourceId,
    detail: { jarvis: value || 'UNKNOWN' }
  });
}

function deriveBrain(domains) {
  const sys = systemsEnvelope(domains);
  const label = 'Brain — Reasoning / Operator Logic';
  const capability = 'Astra reasoning & policy control';
  if (!sys.connected) {
    return baseModule({ status: JARVIS_ANATOMY_STATUS.NOT_CONNECTED, label, capability, reason: `SYSTEMS_SOURCE_${sys.sourceState}` });
  }
  const value = sysValue(sys, 'ASTRA');
  const status = value === 'AVAILABLE' ? JARVIS_ANATOMY_STATUS.HEALTHY
    : value === 'DEGRADED' ? JARVIS_ANATOMY_STATUS.DEGRADED
    : JARVIS_ANATOMY_STATUS.UNKNOWN;
  return baseModule({
    status, label, capability,
    source: sys.sourceId, observed_at: sys.observedAt,
    last_success: status === JARVIS_ANATOMY_STATUS.HEALTHY ? sys.observedAt : null,
    reason: status === JARVIS_ANATOMY_STATUS.DEGRADED ? 'ASTRA_DEGRADED' : null,
    evidence_ref: sys.sourceId,
    detail: { astra: value || 'UNKNOWN' }
  });
}

function deriveNervousSystem(domains) {
  const sys = systemsEnvelope(domains);
  const label = 'Nervous System — Bridge';
  const capability = 'Bridge integrations & connectors';
  if (!sys.connected) {
    return baseModule({ status: JARVIS_ANATOMY_STATUS.NOT_CONNECTED, label, capability, reason: `SYSTEMS_SOURCE_${sys.sourceState}` });
  }
  const value = sysValue(sys, 'BRIDGE');
  const status = value === 'HEALTHY' ? JARVIS_ANATOMY_STATUS.HEALTHY
    : value === 'DEGRADED' ? JARVIS_ANATOMY_STATUS.DEGRADED
    : value === 'OFFLINE' ? JARVIS_ANATOMY_STATUS.FAILED
    : JARVIS_ANATOMY_STATUS.UNKNOWN;
  return baseModule({
    status, label, capability,
    source: sys.sourceId, observed_at: sys.observedAt,
    last_success: status === JARVIS_ANATOMY_STATUS.HEALTHY ? sys.observedAt : null,
    reason: status === JARVIS_ANATOMY_STATUS.DEGRADED ? 'BRIDGE_DEGRADED' : status === JARVIS_ANATOMY_STATUS.FAILED ? 'BRIDGE_OFFLINE' : null,
    evidence_ref: sys.sourceId,
    detail: { bridge: value || 'UNKNOWN' }
  });
}

const SEVERITY = Object.freeze({
  FAILED: 4, DEGRADED: 3, HEALTHY: 2, UNKNOWN: 1, NOT_CONNECTED: 0
});

/** Right Hand combines two genuinely independent signals, but they are not
 *  symmetric:
 *    - the live CLAUDE + BRIDGE system-status probes (is execution available
 *      right now) — this is the primary signal, and HEALTHY requires BOTH
 *      CLAUDE=AVAILABLE and BRIDGE=HEALTHY to be genuinely, currently proven.
 *      An unproven/UNKNOWN Bridge never lets Claude-only proof read as
 *      HEALTHY — that would fabricate proof this code never received.
 *    - persisted runs/evidence attributed to the "Claude Code" worker (what
 *      actually happened last time it ran) — this can only ever WORSEN the
 *      live signal (a proven FAILED/BLOCKED run forces FAILED; a proven
 *      in-progress/waiting run degrades a currently-healthy live signal) or
 *      contribute supporting data (last_success/evidence/detail). A run that
 *      merely COMPLETEd historically can never upgrade an unproven/absent
 *      live status (UNKNOWN/NOT_CONNECTED) to HEALTHY. */
function deriveRightHand(domains) {
  const sys = systemsEnvelope(domains);
  const label = 'Right Hand — Claude Code / Engineering Execution';
  const capability = 'Claude Code engineering execution';

  let liveStatus = JARVIS_ANATOMY_STATUS.NOT_CONNECTED;
  let liveReason = null;
  let claudeValue = null;
  let bridgeValue = null;
  if (sys.connected) {
    claudeValue = sysValue(sys, 'CLAUDE');
    bridgeValue = sysValue(sys, 'BRIDGE');
    if (claudeValue === 'UNAVAILABLE') {
      liveStatus = JARVIS_ANATOMY_STATUS.FAILED; liveReason = 'CLAUDE_UNAVAILABLE';
    } else if (claudeValue === 'BUSY') {
      liveStatus = JARVIS_ANATOMY_STATUS.DEGRADED; liveReason = 'CLAUDE_BUSY';
    } else if (claudeValue === 'AVAILABLE') {
      if (bridgeValue === 'HEALTHY') { liveStatus = JARVIS_ANATOMY_STATUS.HEALTHY; liveReason = null; }
      else if (bridgeValue === 'OFFLINE') { liveStatus = JARVIS_ANATOMY_STATUS.DEGRADED; liveReason = 'BRIDGE_OFFLINE_EXECUTION_UNVERIFIABLE'; }
      else if (bridgeValue === 'DEGRADED') { liveStatus = JARVIS_ANATOMY_STATUS.DEGRADED; liveReason = 'BRIDGE_DEGRADED'; }
      else { liveStatus = JARVIS_ANATOMY_STATUS.UNKNOWN; liveReason = 'BRIDGE_UNPROVEN'; }
    } else {
      liveStatus = JARVIS_ANATOMY_STATUS.UNKNOWN;
    }
  }

  const runsEnvelope = domains?.runs;
  const runsConnected = clean(runsEnvelope?.source?.source_state, 40).toUpperCase() === 'CONNECTED';
  const runItems = Array.isArray(runsEnvelope?.data?.items) ? runsEnvelope.data.items : [];
  const claudeRuns = runItems
    .filter((run) => clean(run?.worker, 120) === 'Claude Code')
    .slice()
    .sort((a, b) => Date.parse(b.updated_at || b.started_at || 0) - Date.parse(a.updated_at || a.started_at || 0));
  const lastRun = claudeRuns[0] || null;
  const lastSuccessRun = claudeRuns.find((run) => run.status === 'COMPLETE') || null;

  const evidenceItems = Array.isArray(domains?.evidence?.data?.items) ? domains.evidence.data.items : [];
  const executionEvidenceFor = (run) => run ? evidenceItems
    .filter((item) => clean(item?.run_ref, 200) === clean(run.id, 200))
    .filter((item) => /^claude-code:/i.test(clean(item?.evidence_id, 300)) || /IMPLEMENTATION_MISSION/i.test(clean(item?.kind, 160)))
    .slice()
    .sort((a, b) => Date.parse(b.observed_at || 0) - Date.parse(a.observed_at || 0))[0] || null : null;
  const lastRunEvidence = executionEvidenceFor(lastRun)
    || (lastRun?.evidence_ref ? evidenceItems.find((item) => item.evidence_id === lastRun.evidence_ref) || null : null);
  const lastSuccessEvidence = executionEvidenceFor(lastSuccessRun);

  let runStatus = JARVIS_ANATOMY_STATUS.NOT_CONNECTED;
  let runReason = null;
  if (runsConnected) {
    if (!lastRun) {
      runStatus = JARVIS_ANATOMY_STATUS.UNKNOWN;
    } else if (lastRun.status === 'FAILED' || lastRun.status === 'BLOCKED') {
      runStatus = JARVIS_ANATOMY_STATUS.FAILED; runReason = `LAST_RUN_${lastRun.status}`;
    } else if (lastRun.status === 'COMPLETE') {
      runStatus = JARVIS_ANATOMY_STATUS.HEALTHY;
    } else {
      runStatus = JARVIS_ANATOMY_STATUS.DEGRADED; runReason = `LAST_RUN_${lastRun.status}`;
    }
  }

  // Only ever worsen the live status with proven run evidence; a run can
  // never upgrade it to HEALTHY. If the run source itself is genuinely
  // connected, however, a proven Claude execution means the capability is
  // not literally "not connected" — current availability is UNKNOWN until
  // a live Claude+Bridge probe proves it.
  let status = liveStatus;
  let reason = liveReason;
  if (status === JARVIS_ANATOMY_STATUS.NOT_CONNECTED && runsConnected) {
    status = JARVIS_ANATOMY_STATUS.UNKNOWN;
    reason = 'LIVE_EXECUTION_STATUS_UNPROVEN';
  } else if (status === JARVIS_ANATOMY_STATUS.UNKNOWN && !reason && lastSuccessRun) {
    reason = 'LIVE_EXECUTION_STATUS_UNPROVEN';
  }
  if (runStatus === JARVIS_ANATOMY_STATUS.FAILED && SEVERITY[status] < SEVERITY.FAILED) {
    status = JARVIS_ANATOMY_STATUS.FAILED;
    reason = runReason;
  } else if (runStatus === JARVIS_ANATOMY_STATUS.DEGRADED && status === JARVIS_ANATOMY_STATUS.HEALTHY) {
    status = JARVIS_ANATOMY_STATUS.DEGRADED;
    reason = runReason;
  }

  const executionObservedAt = isoOrNull(lastRunEvidence?.observed_at);
  const runObservedAt = executionObservedAt || isoOrNull(lastRun?.updated_at || lastRun?.started_at);
  const observed_at = sys.connected ? sys.observedAt : (runObservedAt || null);
  const last_success = isoOrNull(lastSuccessEvidence?.observed_at)
    || isoOrNull(lastSuccessRun?.updated_at || lastSuccessRun?.started_at)
    || (liveStatus === JARVIS_ANATOMY_STATUS.HEALTHY ? sys.observedAt : null);
  const evidence_ref = clean(lastRunEvidence?.evidence_id, 300) || clean(lastRun?.evidence_ref, 300) || null;
  const source = sys.connected ? sys.sourceId : (runsConnected ? clean(runsEnvelope?.source?.source_id, 240) || null : null);

  return baseModule({
    status, label, capability, source, observed_at, last_success, reason, evidence_ref,
    detail: {
      live: { status: liveStatus, reason: liveReason, claude: claudeValue, bridge: bridgeValue },
      last_run: lastRun ? { id: lastRun.id, status: lastRun.status, updated_at: executionObservedAt || lastRun.updated_at, evidence_ref: clean(lastRunEvidence?.evidence_id, 300) || lastRun.evidence_ref || null } : null,
      last_success_run: lastSuccessRun ? { id: lastSuccessRun.id, updated_at: isoOrNull(lastSuccessEvidence?.observed_at) || lastSuccessRun.updated_at } : null
    }
  });
}

/** Infrastructure only becomes HEALTHY when every tracked foundation signal
 *  (git, memory, jarvis runtime) is genuinely proven good. Anything less than
 *  all-of-them-proven-good is DEGRADED, never HEALTHY — a partial foundation
 *  is not a healthy one. */
function deriveInfrastructure(domains) {
  const sys = systemsEnvelope(domains);
  const label = 'Infrastructure — Runtime Foundation';
  const capability = 'VPS / service / runtime / git / storage / network foundation';

  const memorySource = (domains?.memory && typeof domains.memory === 'object' && domains.memory.source) || {};
  const memoryConnected = clean(memorySource.source_state, 40).toUpperCase() === 'CONNECTED' && domains?.memory?.data != null;

  const gitValue = sys.connected ? sysValue(sys, 'GIT') : null;
  const jarvisValue = sys.connected ? sysValue(sys, 'JARVIS') : null;

  const gitOk = gitValue === 'SYNCED';
  const gitPartial = gitValue === 'CHANGED';
  const jarvisOk = jarvisValue === 'ONLINE';
  const jarvisPartial = jarvisValue === 'DEGRADED';

  const provenGood = [gitOk, memoryConnected, jarvisOk].filter(Boolean).length;
  const anyProven = provenGood > 0 || gitPartial || jarvisPartial;

  let status = JARVIS_ANATOMY_STATUS.NOT_CONNECTED;
  let reason = null;
  if (anyProven) {
    if (provenGood === 3) {
      status = JARVIS_ANATOMY_STATUS.HEALTHY;
    } else {
      status = JARVIS_ANATOMY_STATUS.DEGRADED;
      reason = 'PARTIAL_INFRASTRUCTURE_PROVENANCE';
    }
  }

  const sourceParts = [];
  if (gitOk || gitPartial) sourceParts.push('systems:GIT');
  if (memoryConnected) sourceParts.push(clean(memorySource.source_id, 200) || 'memory');
  if (jarvisOk || jarvisPartial) sourceParts.push('systems:JARVIS');

  const observed_at = sys.connected ? sys.observedAt : (memoryConnected ? isoOrNull(memorySource.observed_at) : null);

  return baseModule({
    status, label, capability,
    source: sourceParts.length ? sourceParts.join('+') : null,
    observed_at,
    last_success: status === JARVIS_ANATOMY_STATUS.HEALTHY ? observed_at : null,
    reason,
    evidence_ref: sys.connected ? sys.sourceId : (memoryConnected ? clean(memorySource.source_id, 200) || null : null),
    detail: { git: gitValue, memory_connected: memoryConnected, jarvis: jarvisValue }
  });
}

function autonomyRunTimestamp(run) {
  return isoOrNull(run?.updated_at || run?.started_at);
}

function isOwnerAutonomyRun(run) {
  return clean(run?.program, 80).toUpperCase() === 'JARVIS_OWNER_CHAT'
    || clean(run?.worker, 120) === 'Claude Code';
}

function latestForRun(items, runId) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => clean(item?.run_id, 200) === clean(runId, 200))
    .slice()
    .sort((a, b) => Date.parse(b.at || b.observed_at || 0) - Date.parse(a.at || a.observed_at || 0))[0] || null;
}

/** Read-only projection of the existing owner work loop. It never starts,
 *  advances or accepts work. The only active stage comes from persisted
 *  runtime-truth rows. Stages with no durable discriminator remain part of
 *  the UI vocabulary but are never guessed from elapsed time. */
export function deriveJarvisAutonomyStateV1(domains = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const generated_at = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();

  const runsEnvelope = domains?.runs;
  const runsConnected = clean(runsEnvelope?.source?.source_state, 40).toUpperCase() === 'CONNECTED';
  const sourceId = runsConnected ? clean(runsEnvelope?.source?.source_id, 240) || null : null;
  const sourceObservedAt = runsConnected ? isoOrNull(runsEnvelope?.source?.observed_at) : null;
  const allRuns = Array.isArray(runsEnvelope?.data?.items) ? runsEnvelope.data.items : [];
  const runs = allRuns
    .filter(isOwnerAutonomyRun)
    .slice()
    .sort((a, b) => Date.parse(b.updated_at || b.started_at || 0) - Date.parse(a.updated_at || a.started_at || 0));

  if (!runsConnected) {
    return {
      schema: 'aurentara.jarvis.autonomy-view.v1',
      generated_at,
      stage: JARVIS_AUTONOMY_STAGE.UNKNOWN,
      source: null,
      observed_at: null,
      current_run: null,
      last_activity: null,
      last_success: null,
      evidence_ref: null,
      reason: 'RUN_SOURCE_NOT_CONNECTED',
      operator_acceptance_fabricated: false,
      stages: JARVIS_AUTONOMY_STAGES
    };
  }

  const run = runs[0] || null;
  if (!run) {
    return {
      schema: 'aurentara.jarvis.autonomy-view.v1',
      generated_at,
      stage: JARVIS_AUTONOMY_STAGE.IDLE,
      source: sourceId,
      observed_at: sourceObservedAt,
      current_run: null,
      last_activity: null,
      last_success: null,
      evidence_ref: null,
      reason: null,
      operator_acceptance_fabricated: false,
      stages: JARVIS_AUTONOMY_STAGES
    };
  }

  const title = clean(run.title, 600);
  const runStatus = clean(run.status, 80).toUpperCase();
  const repair = /^\[REPAIR\s+\d+\]/i.test(title);
  let stage = JARVIS_AUTONOMY_STAGE.UNKNOWN;
  let reason = null;

  if (runStatus === 'QUEUED') stage = JARVIS_AUTONOMY_STAGE.JOB_CREATED;
  else if (runStatus === 'RUNNING' || runStatus === 'RESUMED') stage = repair ? JARVIS_AUTONOMY_STAGE.REPAIRING : JARVIS_AUTONOMY_STAGE.EXECUTING;
  else if (runStatus === 'WAITING_APPROVAL' || runStatus === 'BLOCKED') {
    stage = JARVIS_AUTONOMY_STAGE.BLOCKED;
    reason = runStatus;
  } else if (runStatus === 'FAILED' || runStatus === 'INTERRUPTED') {
    stage = JARVIS_AUTONOMY_STAGE.FAILED;
    reason = runStatus;
  } else if (runStatus === 'COMPLETE') stage = JARVIS_AUTONOMY_STAGE.COMPLETE;

  const activityItems = Array.isArray(domains?.activity?.data?.items) ? domains.activity.data.items : [];
  const evidenceItems = Array.isArray(domains?.evidence?.data?.items) ? domains.evidence.data.items : [];
  const runActivities = activityItems
    .filter((item) => clean(item?.run_id, 200) === clean(run.id, 200))
    .slice()
    .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
  const activity = runActivities.find((item) => clean(item?.event, 160).toUpperCase() === 'IMPLEMENTATION_MISSION')
    || runActivities[0]
    || latestForRun(activityItems, run.id);
  const executionEvidence = evidenceItems
    .filter((item) => clean(item?.run_ref, 200) === clean(run.id, 200))
    .filter((item) => /^claude-code:/i.test(clean(item?.evidence_id, 300)) || /IMPLEMENTATION_MISSION/i.test(clean(item?.kind, 160)))
    .slice()
    .sort((a, b) => Date.parse(b.observed_at || 0) - Date.parse(a.observed_at || 0))[0] || null;
  const evidence = executionEvidence
    || (clean(run.evidence_ref, 300) ? evidenceItems.find((item) => clean(item?.evidence_id, 300) === clean(run.evidence_ref, 300)) || null : null);
  const lastSuccessRun = runs.find((item) => clean(item.status, 80).toUpperCase() === 'COMPLETE') || null;
  const approvalItems = Array.isArray(domains?.approvals?.data?.items) ? domains.approvals.data.items : [];
  const runApprovals = approvalItems
    .filter((item) => clean(item?.run_id, 200) === clean(run.id, 200))
    .slice()
    .sort((a, b) => Date.parse(b.requested_at || 0) - Date.parse(a.requested_at || 0));
  const approval = runApprovals[0] || null;
  const displayTitle = /APPROVAL_DECISION/i.test(title) ? clean(activity?.summary, 600) || title : title;

  return {
    schema: 'aurentara.jarvis.autonomy-view.v1',
    generated_at,
    stage,
    source: sourceId,
    observed_at: isoOrNull(activity?.at) || autonomyRunTimestamp(run) || sourceObservedAt,
    current_run: {
      id: clean(run.id, 200) || null,
      title: displayTitle || null,
      worker: clean(run.worker, 120) || null,
      status: runStatus || null,
      program: clean(run.program, 80) || null,
      started_at: isoOrNull(run.started_at),
      updated_at: isoOrNull(run.updated_at),
      approval_state: clean(run.approval_state, 80).toUpperCase() || null,
      acceptance_state: clean(run.acceptance_state, 80).toUpperCase() || null
    },
    last_activity: activity ? {
      event: clean(activity.event, 160) || null,
      status: clean(activity.status, 100).toUpperCase() || null,
      at: isoOrNull(activity.at),
      summary: clean(activity.summary, 800) || null
    } : null,
    last_success: stage === JARVIS_AUTONOMY_STAGE.COMPLETE
      ? isoOrNull(evidence?.observed_at) || isoOrNull(activity?.at) || autonomyRunTimestamp(lastSuccessRun)
      : autonomyRunTimestamp(lastSuccessRun),
    evidence_ref: clean(evidence?.evidence_id, 300) || clean(run.evidence_ref, 300) || null,
    verification_result: evidence?.worker_verified === true && clean(evidence?.status, 80).toUpperCase() === 'COMPLETED' ? 'PROVEN' : null,
    human_approval_required: runApprovals.length > 0,
    human_approval_state: approval ? clean(approval.state, 80).toUpperCase() || null : null,
    reason,
    operator_acceptance_fabricated: false,
    stages: JARVIS_AUTONOMY_STAGES
  };
}

/** Pure derivation: domains -> { core, brain, eyes, ears, mouth, right_hand,
 *  left_hand, nervous_system, infrastructure }. `domains` carries the exact
 *  `systems` / `runs` / `evidence` / `memory` envelopes already produced by
 *  createJarvisCommandCenterTruthSnapshotV1 — this function reads them, it
 *  never fetches or re-derives them itself. */
export function deriveJarvisAnatomyStateV1(domains = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const generated_at = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();

  return {
    schema: 'aurentara.jarvis.anatomy.v1',
    generated_at,
    core: deriveCore(domains),
    brain: deriveBrain(domains),
    eyes: notProvenModule('eyes'),
    ears: notProvenModule('ears'),
    mouth: notProvenModule('mouth'),
    right_hand: deriveRightHand(domains),
    left_hand: notProvenModule('left_hand'),
    nervous_system: deriveNervousSystem(domains),
    infrastructure: deriveInfrastructure(domains)
  };
}

export function jarvisAnatomyStateManifestV1() {
  return {
    schema: 'aurentara.jarvis.anatomy.v1',
    modules: JARVIS_ANATOMY_MODULES,
    statuses: Object.values(JARVIS_ANATOMY_STATUS),
    default_status: JARVIS_ANATOMY_STATUS.NOT_CONNECTED,
    derives_from: ['systems', 'runs', 'evidence', 'memory'],
    fabricates_data: false,
    fail_closed: true,
    core_source: 'systems.JARVIS',
    brain_source: 'systems.ASTRA',
    nervous_system_source: 'systems.BRIDGE',
    right_hand_source: 'systems.CLAUDE + systems.BRIDGE + runs(worker=Claude Code) + evidence',
    infrastructure_source: 'systems.GIT + memory + systems.JARVIS',
    autonomy_source: 'runs(program=JARVIS_OWNER_CHAT or worker=Claude Code) + activity + evidence',
    autonomy_stages: JARVIS_AUTONOMY_STAGES,
    unproven_modules: ['eyes', 'ears', 'mouth', 'left_hand'],
    unproven_reason: 'NO_GENUINE_SOURCE_BOUND',
    production_deploy: false,
    hamyren_data_flow: false
  };
}
