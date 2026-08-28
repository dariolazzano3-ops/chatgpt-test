import crypto from 'node:crypto';

const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);
const nowMs = (options = {}) => Number(options.now_ms ?? Date.now());
const iso = (ms) => new Date(ms).toISOString();
const clone = (value) => structuredClone(value ?? null);
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function assertExpectedRevision(mission = {}, expectedRevision) {
  const actual = Number(mission.revision || 0);
  if (expectedRevision === undefined || expectedRevision === null) return { ok: true, actual_revision: actual };
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected < 0) return { ok: false, code: 'INVALID_EXPECTED_REVISION', retryable: false, expected_revision: expectedRevision, actual_revision: actual };
  if (actual !== expected) return { ok: false, code: 'MISSION_REVISION_CONFLICT', retryable: true, expected_revision: expected, actual_revision: actual };
  return { ok: true, expected_revision: expected, actual_revision: actual };
}

export function missionRecoveryKey(mission = {}, task = {}) {
  return `recovery-${digest({
    mission_id: mission.mission_id || null,
    mission_revision: mission.mission_revision || mission.source_of_truth?.mission_revision || null,
    project_head: mission.source_of_truth?.project_head || null,
    expected_parent_sha: mission.source_of_truth?.expected_parent_sha || null,
    task_id: task.task_id || null,
    attempt: Number(task.attempt || 0)
  }).slice(0, 32)}`;
}

export function acquireMissionLease(missionInput = {}, ownerInput, options = {}) {
  const revisionCheck = assertExpectedRevision(missionInput, options.expected_revision);
  if (!revisionCheck.ok) return revisionCheck;
  const owner = clean(ownerInput, 200);
  if (!owner) return { ok: false, code: 'LEASE_OWNER_REQUIRED', retryable: false };
  const ttlMs = Math.max(1000, Math.min(Number(options.ttl_ms) || 30000, 15 * 60 * 1000));
  const atMs = nowMs(options);
  const existing = missionInput.execution_lease || null;
  if (existing && Number(existing.expires_at_ms || 0) > atMs && existing.owner !== owner) {
    return { ok: false, code: 'MISSION_LEASE_HELD', retryable: true, owner: existing.owner, lease_id: existing.lease_id, expires_at: existing.expires_at };
  }
  const mission = clone(missionInput);
  const leaseId = existing?.owner === owner && Number(existing.expires_at_ms || 0) > atMs
    ? existing.lease_id
    : `lease-${digest({ mission_id: mission.mission_id || null, owner, revision: mission.revision || 0, at_ms: atMs }).slice(0, 24)}`;
  mission.execution_lease = { lease_id: leaseId, owner, acquired_at: existing?.owner === owner ? existing.acquired_at : iso(atMs), renewed_at: iso(atMs), expires_at: iso(atMs + ttlMs), expires_at_ms: atMs + ttlMs };
  mission.revision = Number(mission.revision || 0) + 1;
  mission.updated_at = iso(atMs);
  mission.events = [...(mission.events || []), { type: 'MISSION_LEASE_ACQUIRED', at: mission.updated_at, owner, lease_id: leaseId, revision: mission.revision }].slice(-200);
  return { ok: true, mission, lease: clone(mission.execution_lease), previous_revision: revisionCheck.actual_revision };
}

export function renewMissionLease(missionInput = {}, leaseIdInput, ownerInput, options = {}) {
  const revisionCheck = assertExpectedRevision(missionInput, options.expected_revision);
  if (!revisionCheck.ok) return revisionCheck;
  const leaseId = clean(leaseIdInput, 200);
  const owner = clean(ownerInput, 200);
  const existing = missionInput.execution_lease || null;
  const atMs = nowMs(options);
  if (!existing || existing.lease_id !== leaseId || existing.owner !== owner) return { ok: false, code: 'MISSION_LEASE_MISMATCH', retryable: false };
  if (Number(existing.expires_at_ms || 0) <= atMs) return { ok: false, code: 'MISSION_LEASE_EXPIRED', retryable: true };
  const ttlMs = Math.max(1000, Math.min(Number(options.ttl_ms) || 30000, 15 * 60 * 1000));
  const mission = clone(missionInput);
  mission.execution_lease = { ...existing, renewed_at: iso(atMs), expires_at: iso(atMs + ttlMs), expires_at_ms: atMs + ttlMs };
  mission.revision = Number(mission.revision || 0) + 1;
  mission.updated_at = iso(atMs);
  mission.events = [...(mission.events || []), { type: 'MISSION_LEASE_RENEWED', at: mission.updated_at, owner, lease_id: leaseId, revision: mission.revision }].slice(-200);
  return { ok: true, mission, lease: clone(mission.execution_lease), previous_revision: revisionCheck.actual_revision };
}

export function releaseMissionLease(missionInput = {}, leaseIdInput, ownerInput, options = {}) {
  const revisionCheck = assertExpectedRevision(missionInput, options.expected_revision);
  if (!revisionCheck.ok) return revisionCheck;
  const leaseId = clean(leaseIdInput, 200);
  const owner = clean(ownerInput, 200);
  const existing = missionInput.execution_lease || null;
  if (!existing || existing.lease_id !== leaseId || existing.owner !== owner) return { ok: false, code: 'MISSION_LEASE_MISMATCH', retryable: false };
  const atMs = nowMs(options);
  const mission = clone(missionInput);
  mission.execution_lease = null;
  mission.revision = Number(mission.revision || 0) + 1;
  mission.updated_at = iso(atMs);
  mission.events = [...(mission.events || []), { type: 'MISSION_LEASE_RELEASED', at: mission.updated_at, owner, lease_id: leaseId, revision: mission.revision }].slice(-200);
  return { ok: true, mission, previous_revision: revisionCheck.actual_revision };
}

export function validateMissionLease(mission = {}, leaseIdInput, ownerInput, options = {}) {
  const existing = mission.execution_lease || null;
  if (!existing) return { ok: false, code: 'MISSION_LEASE_REQUIRED', retryable: true };
  if (existing.lease_id !== clean(leaseIdInput, 200) || existing.owner !== clean(ownerInput, 200)) return { ok: false, code: 'MISSION_LEASE_MISMATCH', retryable: false };
  if (Number(existing.expires_at_ms || 0) <= nowMs(options)) return { ok: false, code: 'MISSION_LEASE_EXPIRED', retryable: true };
  return { ok: true, lease: clone(existing) };
}

export function stateConcurrencyManifest() {
  return { version: 'max-state-cas-1', optimistic_cas: true, bounded_execution_leases: true, deterministic_recovery_keys: true, stale_writer_rejected: true, production_deploy: false };
}
