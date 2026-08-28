const clone = (value) => structuredClone(value ?? null);

export function validateMissionPersistence(current = {}, next = {}, metadata = {}) {
  const expected = Number(metadata.expected_revision);
  const announced = Number(metadata.new_revision);
  const currentRevision = Number(current.revision || 0);
  const nextRevision = Number(next.revision || 0);
  if (!Number.isInteger(expected) || expected < 0) return { ok: false, code: 'PERSIST_EXPECTED_REVISION_REQUIRED', retryable: false };
  if (!Number.isInteger(announced) || announced < 1) return { ok: false, code: 'PERSIST_NEW_REVISION_REQUIRED', retryable: false };
  if (!current.mission_id || current.mission_id !== next.mission_id) return { ok: false, code: 'PERSIST_MISSION_ID_MISMATCH', retryable: false };
  if (currentRevision !== expected) return { ok: false, code: 'MISSION_PERSIST_CONFLICT', retryable: true, expected_revision: expected, actual_revision: currentRevision };
  if (nextRevision !== announced || nextRevision <= expected) return { ok: false, code: 'PERSIST_REVISION_TRANSITION_INVALID', retryable: false, expected_revision: expected, announced_revision: announced, next_revision: nextRevision };
  return { ok: true, expected_revision: expected, new_revision: nextRevision, mission_id: next.mission_id, next: clone(next), production_deploy: false };
}

export function missionPersistenceGuardManifest() {
  return { version: 'riosystems.mission-persistence-guard.v1', optimistic_cas_required: true, mission_identity_pinned: true, monotonic_revision_required: true, stale_writer_rejected: true, production_deploy: false };
}
