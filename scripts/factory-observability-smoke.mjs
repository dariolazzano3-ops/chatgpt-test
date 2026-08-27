import assert from 'node:assert/strict';
import { buildObservabilitySnapshot } from './factory-observability.mjs';

const jobs = [
  {
    status: 'READY_FOR_REVIEW',
    production_deploy: false,
    events: [
      { type: 'QA_ATTEMPT_RESULT', outcome: 'repair_planned', issue_codes: ['GEOMETRIC_OVERFLOW'], repair_profiles: ['MEDIA_CONTAINMENT'], durations_ms: { preview_ms: 1000, qa_ms: 500 } },
      { type: 'REPAIR_RESULT', outcome: 'committed', repair_profiles: ['MEDIA_CONTAINMENT'], durations_ms: { repair_ms: 250 } },
      { type: 'QA_ATTEMPT_RESULT', outcome: 'passed', issue_codes: [], durations_ms: { preview_ms: 900, qa_ms: 450 } },
      { type: 'FULFILLMENT_RESULT', outcome: 'passed', issue_codes: [], durations_ms: { total_ms: 80 } }
    ]
  },
  {
    status: 'FAILED',
    production_deploy: false,
    events: [
      { type: 'QA_ATTEMPT_RESULT', outcome: 'unsafe_failure', issue_codes: ['PAGE_ERROR'], durations_ms: { preview_ms: 1100, qa_ms: 600 } }
    ]
  },
  {
    status: 'WORKSHOP_REQUIRED',
    production_deploy: false,
    events: [
      { type: 'QA_CACHE_REUSED', outcome: 'passed_cached' },
      { type: 'FULFILLMENT_RESULT', outcome: 'failed', issue_codes: ['FULFILLMENT_PROJECT_DELTA'], durations_ms: { total_ms: 70 } }
    ]
  }
];

const snapshot = buildObservabilitySnapshot(jobs, { factory_version: '3.3', generated_at: '2026-08-27T00:00:00.000Z' });
assert.equal(snapshot.version, 2);
assert.equal(snapshot.production_deploy, false);
assert.equal(snapshot.sample.jobs_total, 3);
assert.equal(snapshot.sample.jobs_ready_for_review, 1);
assert.equal(snapshot.sample.jobs_workshop_required, 1);
assert.equal(snapshot.sample.jobs_failed, 1);
assert.equal(snapshot.sample.terminal_success_rate_pct, 33.3);
assert.equal(snapshot.sample.jobs_with_auto_repair, 1);
assert.equal(snapshot.sample.jobs_recovered_by_auto_repair, 1);
assert.equal(snapshot.sample.auto_repair_recovery_rate_pct, 100);
assert.equal(snapshot.qa.attempt_events, 3);
assert.equal(snapshot.qa.passed_attempts, 1);
assert.equal(snapshot.qa.nonpassing_attempts, 2);
assert.equal(snapshot.qa.cache_reuses, 1);
assert.equal(snapshot.fulfillment.checks, 2);
assert.equal(snapshot.fulfillment.failures, 1);
assert.equal(snapshot.fulfillment.pass_rate_pct, 50);
assert.equal(snapshot.repair.committed_repairs, 1);
assert.equal(snapshot.repair.profiles.MEDIA_CONTAINMENT, 1);
assert.equal(snapshot.failures.codes.GEOMETRIC_OVERFLOW, 1);
assert.equal(snapshot.failures.codes.PAGE_ERROR, 1);
assert.equal(snapshot.failures.codes.FULFILLMENT_PROJECT_DELTA, 1);
assert.equal(snapshot.qa.average_preview_ms, 1000);
assert.equal(snapshot.qa.average_qa_ms, 516.7);
assert.equal(snapshot.repair.average_repair_ms, 250);

console.log(JSON.stringify({ ok: true, factory_version: snapshot.factory_version, jobs: snapshot.sample.jobs_total, cache_reuses: snapshot.qa.cache_reuses, repair_recovery_rate: snapshot.sample.auto_repair_recovery_rate_pct }, null, 2));
