/* JARVIS Command Center — real read bindings (Wave 4 + Wave 5).

   Projects genuine persisted JARVIS audit events (store.readAudit) into the
   read-only source envelopes consumed by createJarvisCommandCenterTruthSnapshotV1:

     - activity   REAL     — the audit events themselves (real persisted timestamps)
     - runs       DERIVED  — grouped by request_id
     - approvals  DERIVED  — audit events that required an approval gate
     - evidence   DERIVED  — commit / audit / verification references carried by events

   If the store cannot read audit history the bindings are simply absent, so the
   adapter fails those domains closed to NOT_CONNECTED. Nothing here fabricates a
   run, an event, a timestamp, an approval or an evidence record. */

const clean = (value, max = 800) => String(value ?? '').trim().slice(0, max);
const isoOrNull = (value) => {
  const text = clean(value, 80);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
};

const RESULT_TO_RUN_STATE = {
  COMPLETED: 'COMPLETE',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  ERROR: 'FAILED',
  BLOCKED: 'BLOCKED',
  SECURITY_VIOLATION: 'BLOCKED',
  INVALID_PLAN: 'FAILED',
  INTERRUPTED: 'INTERRUPTED',
  RESUMED: 'RESUMED',
  QUEUED: 'QUEUED',
  NOT_EXECUTED: 'QUEUED',
  PREPARED: 'WAITING_APPROVAL',
  PENDING: 'RUNNING',
  RUNNING: 'RUNNING'
};

function workerFromTools(tools = []) {
  const list = Array.isArray(tools) ? tools.map((t) => clean(t, 180).toLowerCase()) : [];
  if (list.some((t) => t.includes('claude'))) return 'Claude Code';
  if (list.some((t) => t.includes('codex'))) return 'Codex';
  if (list.some((t) => t.includes('calendar') || t.includes('google') || t.includes('connector'))) return 'JARVIS Connector';
  return 'JARVIS Runtime';
}

function approvalState(approval = {}) {
  const gate = clean(approval?.gate_status, 80).toUpperCase();
  if (/REJECT|DENIED|DENY|REVOK/.test(gate)) return 'REVOKED';
  if (/EXPIRE/.test(gate)) return 'EXPIRED';
  if (approval?.explicit === true || /^APPROVED|APPROVED_BY|GRANTED|^COMPLETE/.test(gate)) return 'GRANTED';
  return 'PENDING';
}

function runStateFor(events = []) {
  const latest = events[events.length - 1] || {};
  const anyApprovalPending = events.some(
    (e) => e?.approval?.required === true && approvalState(e.approval) === 'PENDING'
  );
  const terminal = events
    .map((e) => RESULT_TO_RUN_STATE[clean(e?.result?.status, 80).toUpperCase()])
    .filter((s) => s === 'COMPLETE' || s === 'FAILED' || s === 'BLOCKED');
  if (terminal.length) return terminal[terminal.length - 1];
  if (anyApprovalPending) return 'WAITING_APPROVAL';
  return RESULT_TO_RUN_STATE[clean(latest?.result?.status, 80).toUpperCase()] || 'RUNNING';
}

function evidenceRefFor(event = {}) {
  const result = event?.result || {};
  return (
    clean(result.evidence_ref || result.evidence_id || result.commit_sha || result.commit || event.evidence_ref, 300) ||
    (event.event_id ? `audit:${clean(event.event_id, 120)}` : null)
  );
}

/** Normalise one store.readAudit row into a stable internal shape. Rows without a
 *  real persisted timestamp are rejected (returns null). */
function normalizeAuditRow(row = {}) {
  const at = isoOrNull(row.occurred_at || row.timestamp);
  if (!at) return null;
  const intent = row.intent && typeof row.intent === 'object' ? row.intent : {};
  const hasContent =
    clean(row.action, 120) ||
    clean(row.request, 600) ||
    clean(row.request_id, 200) ||
    Object.keys(intent).length > 0 ||
    (row.result && typeof row.result === 'object' && Object.keys(row.result).length > 0);
  if (!hasContent) return null;
  return {
    event_id: clean(row.event_id, 120) || null,
    at,
    request_id: clean(row.request_id, 200) || null,
    action: clean(row.action, 120) || null,
    request:
      clean(row.request, 600) ||
      clean([intent.domain, intent.action].filter(Boolean).join(' · '), 600) ||
      null,
    tools_used: Array.isArray(row.tools_used) ? row.tools_used.map((t) => clean(t, 180)).filter(Boolean) : [],
    permissions: Array.isArray(row.permissions) ? row.permissions.map((p) => clean(p, 160)).filter(Boolean) : [],
    result: row.result && typeof row.result === 'object' ? row.result : {},
    approval: row.approval && typeof row.approval === 'object' ? row.approval : {},
    evidence_ref: evidenceRefFor(row)
  };
}

async function loadNormalizedAudit(store, ownerId, ownerRef, limit) {
  const rows = await store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit });
  if (!Array.isArray(rows)) throw new Error('JARVIS_AUDIT_READ_INVALID');
  return rows.map(normalizeAuditRow).filter(Boolean);
}

export function createJarvisCommandCenterReadBindingsV1(config = {}) {
  const store = config.store;
  const ownerId = clean(config.owner_id, 80);
  const ownerRef = clean(config.owner_ref, 320);
  const limit = Math.max(1, Math.min(200, Number(config.limit) || 60));
  const nowIso = () => (config.now ? new Date(config.now).toISOString() : new Date().toISOString());

  if (!store || typeof store.readAudit !== 'function' || !ownerId || !ownerRef) {
    // No real read path -> no binding -> adapter fails these domains closed.
    return {};
  }

  const activity = async () => {
    const audit = await loadNormalizedAudit(store, ownerId, ownerRef, limit);
    return {
      classification: 'REAL',
      source_id: 'jarvis-audit-reader-v1',
      observed_at: nowIso(),
      data: audit.map((row) => ({
        at: row.at,
        event: row.action || 'RUNTIME_EVENT',
        summary: row.request || row.action || null,
        run_id: row.request_id,
        evidence_ref: row.evidence_ref,
        status: clean(row.result.status, 100).toUpperCase() || null
      }))
    };
  };

  const runs = async () => {
    const audit = await loadNormalizedAudit(store, ownerId, ownerRef, limit);
    const groups = new Map();
    for (const row of audit) {
      if (!row.request_id) continue;
      if (!groups.has(row.request_id)) groups.set(row.request_id, []);
      groups.get(row.request_id).push(row);
    }
    const items = [];
    for (const [requestId, events] of groups) {
      events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const first = events[0];
      const last = events[events.length - 1];
      items.push({
        id: requestId,
        title: events.map((e) => e.request).find(Boolean) || events.map((e) => e.action).find(Boolean) || requestId,
        worker: workerFromTools(events.flatMap((e) => e.tools_used)),
        status: runStateFor(events),
        started_at: first.at,
        updated_at: last.at,
        progress: null,
        progress_verified: false,
        approval_state: events.some((e) => e.approval?.required === true) ? approvalState(last.approval) : null,
        evidence_ref: events.map((e) => e.evidence_ref).find(Boolean) || null
      });
    }
    return {
      classification: 'DERIVED',
      source_id: 'jarvis-run-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: nowIso(),
      data: items
    };
  };

  const approvals = async () => {
    const audit = await loadNormalizedAudit(store, ownerId, ownerRef, limit);
    const items = audit
      .filter((row) => row.approval?.required === true)
      .map((row) => ({
        approval_id: `${row.request_id || row.event_id || 'req'}:approval`,
        run_id: row.request_id,
        scope_key: ownerRef,
        approval_type: row.action || 'RUNTIME_ACTION',
        capability: row.permissions[0] || null,
        reason: clean(row.approval?.reason, 600) || null,
        risk: clean(row.approval?.risk, 40).toLowerCase() || null,
        state: approvalState(row.approval),
        requested_at: row.at,
        expires_at: null,
        actor_id: ownerRef
      }));
    return {
      classification: 'DERIVED',
      source_id: 'jarvis-approval-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: nowIso(),
      data: items
    };
  };

  const evidence = async () => {
    const audit = await loadNormalizedAudit(store, ownerId, ownerRef, limit);
    const seen = new Set();
    const items = [];
    for (const row of audit) {
      const ref = row.evidence_ref;
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      const result = row.result || {};
      const status = clean(result.status, 80).toUpperCase() || null;
      // A worker self-reporting result.verified === true is NOT independent
      // acceptance. Independent acceptance only when a distinct decision /
      // acceptance / bridge reference is carried by the persisted result.
      const independent = Boolean(
        clean(result.acceptance_ref || result.independent_acceptance_ref || result.bridge_decision || result.review_ref, 240)
      );
      items.push({
        evidence_id: ref,
        kind: (result.commit_sha || result.commit) ? 'GIT_COMMIT' : (row.action ? `ACTION:${row.action}` : 'AUDIT'),
        status,
        observed_at: row.at,
        url: null,
        path: null,
        summary: row.request || row.action || null,
        run_ref: row.request_id || null,
        worker_verified: result.verified === true,
        independent_acceptance: independent,
        acceptance_ref: independent
          ? clean(result.acceptance_ref || result.independent_acceptance_ref || result.bridge_decision || result.review_ref, 240)
          : null
      });
    }
    return {
      classification: 'DERIVED',
      source_id: 'jarvis-evidence-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: nowIso(),
      data: items
    };
  };

  return { activity, runs, approvals, evidence };
}

export function jarvisCommandCenterReadBindingsManifestV1() {
  return {
    schema: 'aurentara.jarvis.command-center.read-bindings.v1',
    source: 'store.readAudit (owner-scoped, bounded, read-only)',
    activity_classification: 'REAL',
    runs_classification: 'DERIVED',
    approvals_classification: 'DERIVED',
    evidence_classification: 'DERIVED',
    fabricates_data: false,
    progress_ever_synthesised: false,
    worker_self_acceptance_treated_as_independent: false,
    approval_state_from_canonical_gate_only: true,
    fail_closed_when_unavailable: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
