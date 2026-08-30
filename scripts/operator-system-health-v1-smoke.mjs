#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildAuthoritativeOperatorSystemHealth, operatorSystemHealthManifest } from '../src/operator-system-health-v1.js';

const EXACT_SHA = 'ac82bbeb6bc3a1ff83c350329987ea6d85423233';
const STEP_NAMES = [
  'Validate JavaScript',
  'Integrated RIOSYSTEMS regression gate',
  'Private Operator Dashboard V1 acceptance',
  'Universal Mission V1 acceptance'
];

function baseHealth(verifiedAt = '2026-08-30T12:00:00Z') {
  return {
    factories: ['web','automation','ai','business'].map((factory) => ({
      factory,
      status: 'LIVE_STAGING_VERIFIED',
      evidence: { verified_at: verifiedAt }
    }))
  };
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(data); }
  };
}

function githubFetch({ head = EXACT_SHA, runHead = EXACT_SHA, conclusion = 'success', updatedAt = '2026-08-30T13:55:00Z', omitStep = null } = {}) {
  return async (url) => {
    const value = String(url);
    if (value.includes('/branches/factory-control')) {
      return jsonResponse({ commit: { sha: head } });
    }
    if (value.includes('/actions/runs?')) {
      return jsonResponse({
        workflow_runs: [{
          id: 9001,
          name: 'CI',
          head_sha: runHead,
          status: 'completed',
          conclusion,
          updated_at: updatedAt,
          created_at: updatedAt,
          run_number: 783,
          jobs_url: 'https://api.github.com/mock/jobs/9001'
        }]
      });
    }
    if (value.includes('/mock/jobs/9001')) {
      return jsonResponse({
        jobs: [{
          steps: STEP_NAMES
            .filter((name) => name !== omitStep)
            .map((name) => ({ name, status: 'completed', conclusion }))
        }]
      });
    }
    return jsonResponse({ error: 'unexpected mock URL', url: value }, 404);
  };
}

const durableService = {
  async handle(request) {
    assert.equal(request.method, 'GET');
    assert.equal(request.path, '/snapshot');
    return { ok: true, status: 200, runtime: { revision: 17 }, body: { schema: 'mock.snapshot' } };
  }
};

const healthy = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth(),
  env: { RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase' },
  runtime_service: durableService,
  fetch_impl: githubFetch(),
  now: new Date('2026-08-30T14:00:00Z')
});
assert.equal(healthy.status, 'HEALTHY');
assert.equal(healthy.branch_truth.status, 'HEALTHY');
assert.equal(healthy.branch_truth.head_sha, EXACT_SHA);
assert.equal(healthy.signals.core_ci.status, 'HEALTHY');
assert.equal(healthy.signals.integrated_regression_gate.status, 'HEALTHY');
assert.equal(healthy.signals.dashboard_ci.status, 'HEALTHY');
assert.equal(healthy.signals.universal_mission_ci.status, 'HEALTHY');
assert.equal(healthy.signals.factory_readiness.status, 'HEALTHY');
assert.equal(healthy.signals.provider_evidence_freshness.status, 'HEALTHY');
assert.equal(healthy.signals.runtime_persistence.status, 'HEALTHY');
assert.equal(healthy.signals.staging_availability.status, 'HEALTHY');
assert.equal(healthy.production_deploy, false);

const stale = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth('2026-08-30T12:00:00Z'),
  env: { RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase' },
  runtime_service: durableService,
  fetch_impl: githubFetch({ updatedAt: '2026-09-08T13:55:00Z' }),
  now: new Date('2026-09-08T14:00:00Z')
});
assert.equal(stale.signals.provider_evidence_freshness.status, 'STALE');
assert.equal(stale.status, 'STALE');

const failedCi = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth(),
  env: { RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase' },
  runtime_service: durableService,
  fetch_impl: githubFetch({ conclusion: 'failure' }),
  now: new Date('2026-08-30T14:00:00Z')
});
assert.equal(failedCi.signals.core_ci.status, 'BLOCKED');
assert.equal(failedCi.status, 'BLOCKED');

const wrongHead = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth(),
  env: { RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase' },
  runtime_service: durableService,
  fetch_impl: githubFetch({ runHead: 'deadbeef' }),
  now: new Date('2026-08-30T14:00:00Z')
});
assert.equal(wrongHead.branch_truth.head_sha, EXACT_SHA);
assert.equal(wrongHead.signals.core_ci.status, 'NOT_VERIFIED');
assert.equal(wrongHead.status, 'NOT_VERIFIED');

const missingGate = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth(),
  env: { RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase' },
  runtime_service: durableService,
  fetch_impl: githubFetch({ omitStep: 'Universal Mission V1 acceptance' }),
  now: new Date('2026-08-30T14:00:00Z')
});
assert.equal(missingGate.signals.universal_mission_ci.status, 'NOT_VERIFIED');
assert.equal(missingGate.status, 'NOT_VERIFIED');

const badPersistence = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth(),
  env: { RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'memory' },
  runtime_service: durableService,
  fetch_impl: githubFetch(),
  now: new Date('2026-08-30T14:00:00Z')
});
assert.equal(badPersistence.signals.runtime_persistence.status, 'BLOCKED');
assert.equal(badPersistence.signals.staging_availability.status, 'BLOCKED');
assert.equal(badPersistence.status, 'BLOCKED');

const nonStaging = await buildAuthoritativeOperatorSystemHealth({
  base_health: baseHealth(),
  env: { RIOSYSTEMS_ENVIRONMENT: 'development', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'memory' },
  runtime_service: durableService,
  fetch_impl: githubFetch(),
  now: new Date('2026-08-30T14:00:00Z')
});
assert.equal(nonStaging.signals.core_ci.status, 'NOT_VERIFIED');
assert.equal(nonStaging.signals.runtime_persistence.status, 'NOT_VERIFIED');
assert.equal(nonStaging.status, 'NOT_VERIFIED');

const manifest = operatorSystemHealthManifest();
assert.deepEqual(manifest.states, ['HEALTHY','DEGRADED','BLOCKED','STALE','NOT_VERIFIED']);
assert.equal(manifest.github_token_required, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-system-health-v1',
  healthy_status: healthy.status,
  stale_status: stale.status,
  failed_ci_status: failedCi.status,
  wrong_head_status: wrongHead.status,
  persistence_failure_status: badPersistence.status,
  production_deploy: false
}, null, 2));
