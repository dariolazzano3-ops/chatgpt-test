const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function createResiliencePolicy(input = {}) {
  const backupIntervalHours = Math.max(1, finite(input.backup_interval_hours, 24));
  const rpoHours = Math.max(0, finite(input.rpo_hours, backupIntervalHours));
  const rtoHours = Math.max(0, finite(input.rto_hours, 4));
  return {
    schema_version: 'riosystems.resilience-policy.v1',
    backup: { interval_hours: backupIntervalHours, encrypted: input.backup_encrypted !== false, retention_days: Math.max(1, finite(input.retention_days, 30)) },
    recovery: { rpo_hours: rpoHours, rto_hours: rtoHours, restore_test_required: true },
    rollback: { immutable_revision_required: true, previous_known_good_required: true },
    incident: { runbook: clean(input.incident_runbook, 500) || null, severity_levels: ['SEV1','SEV2','SEV3'] },
    production_deploy: false
  };
}

export function evaluateResilienceEvidence(policy = {}, evidence = {}) {
  const checks = {
    backup_recent: evidence.backup_recent === true,
    backup_encrypted: policy.backup?.encrypted === true && evidence.backup_encrypted === true,
    restore_test_passed: evidence.restore_test_passed === true,
    rollback_revision_verified: evidence.rollback_revision_verified === true,
    incident_runbook_verified: Boolean(policy.incident?.runbook) && evidence.incident_runbook_verified === true,
    observability_alerts_verified: evidence.observability_alerts_verified === true
  };
  const blockers = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  return { ok: blockers.length === 0, checks, blockers, production_deploy: false };
}
