#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  createAurentaraPublicWebsitePortfolioEntry,
  buildOperatorProjectWorkspace,
  AURENTARA_REGISTERED_CANONICAL_SHA
} from '../src/operator-project-workspace-v1.js';
import {
  resolveAurentaraProjectCurrentTruth,
  reconcileOperatorProjectWorkspace
} from '../src/operator-project-workspace-reconciliation-v1.js';

const REPOSITORY_HEAD = 'c61e5c4060f826df020d5c7ae59caf84ee54b890';
const PROJECT_HEAD = 'ef631d35036518e5da69bec0ebec6c67b0f02301';
const ITERATION_HEAD = '05f1aa5f4572d2b6dec8b048582b73b804b3ba8c';

const base = buildOperatorProjectWorkspace({
  project: createAurentaraPublicWebsitePortfolioEntry(),
  ui_audit: [],
  preview_url: null,
  preview_status: 'NOT_AVAILABLE'
});

assert.equal(base.project.canonical_sha, AURENTARA_REGISTERED_CANONICAL_SHA, 'fixture must reproduce old registration-time canonical SHA');
assert.equal(base.project.working_branch, 'factory/operator-project-workspace-v1', 'fixture must reproduce old registration working branch');
assert.equal(base.project.qa_status, 'ACCEPTED_RC_PASS', 'fixture must reproduce registration-time QA state');

const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  requests.push({ url, method: String(init.method || 'GET').toUpperCase() });
  const body = (() => {
    if (url.includes('/git/ref/heads/factory-control')) {
      return { object: { sha: REPOSITORY_HEAD } };
    }
    if (url.includes('/commits?') && url.includes('path=projects%2Friosystems-public-website-v1')) {
      return [{
        sha: PROJECT_HEAD,
        commit: {
          committer: { date: '2026-09-02T17:47:41Z' },
          message: 'AURENTARA Public Website first real workspace iteration (#353)\n\nAccessibility semantics.'
        }
      }];
    }
    if (url.includes(`/commits/${PROJECT_HEAD}/pulls`)) {
      return [{
        number: 353,
        title: 'AURENTARA Public Website first real workspace iteration',
        state: 'closed',
        merged_at: '2026-09-02T17:47:41Z',
        merge_commit_sha: PROJECT_HEAD,
        head: { ref: 'aurentara/first-real-workspace-run-v1', sha: ITERATION_HEAD },
        base: { ref: 'factory-control' }
      }];
    }
    if (url.includes(`/commits/${ITERATION_HEAD}/check-runs`)) {
      return {
        check_runs: [
          { name: 'acceptance', status: 'completed', conclusion: 'success', app: { slug: 'github-actions' } },
          { name: 'validate', status: 'completed', conclusion: 'success', app: { slug: 'github-actions' } },
          { name: 'Workers Builds: chatgpt-test', status: 'completed', conclusion: 'failure', app: { slug: 'cloudflare-workers-and-pages' } }
        ]
      };
    }
    throw new Error(`Unexpected GitHub read: ${url}`);
  })();
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};

const runtimeService = {
  async handle(request = {}) {
    assert.equal(request.method, 'GET');
    assert.equal(request.path, '/missions');
    return {
      ok: true,
      body: {
        durable: [],
        universal: [{
          mission_id: 'workspace-real-project-iteration-353',
          project_id: 'riosystems-public-website-v1',
          status: 'SIMULATED_HANDOFF_READY',
          quality_score: 100,
          variable_cost_eur: 0,
          production_deploy: false
        }],
        live_staging: []
      }
    };
  }
};

let truth;
try {
  truth = await resolveAurentaraProjectCurrentTruth({
    GITHUB_TOKEN: 'synthetic-test-token',
    GITHUB_REPOSITORY: 'dariolazzano3-ops/chatgpt-test',
    FACTORY_CONTROL_BRANCH: 'factory-control'
  }, runtimeService);
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal(truth.ok, true);
assert.equal(truth.status, 'RECONCILED');
assert.equal(truth.canonical.repository_head_sha, REPOSITORY_HEAD, 'global canonical repository HEAD must remain observable');
assert.equal(truth.canonical.project_sha, PROJECT_HEAD, 'current project SHA must be the latest canonical commit touching the project path');
assert.notEqual(truth.canonical.project_sha, truth.canonical.repository_head_sha, 'project canonical SHA must not be confused with later unrelated repository commits');
assert.equal(truth.iteration.pr_number, 353);
assert.equal(truth.iteration.status, 'MERGED');
assert.equal(truth.delivery.status, 'MERGED');
assert.equal(truth.delivery.merge_sha, PROJECT_HEAD);
assert.equal(truth.quality.status, 'PASS', 'real GitHub Actions project checks must drive quality');
assert.deepEqual(truth.quality.checks.map((item) => item.name).sort(), ['acceptance', 'validate']);
assert.equal(truth.mission.mission_id, 'workspace-real-project-iteration-353');
assert.ok(requests.length >= 4);
assert.equal(requests.every((item) => item.method === 'GET'), true, 'reconciliation must remain read-only');

const reloaded = reconcileOperatorProjectWorkspace(base, truth);
assert.equal(reloaded.registration_state.canonical_sha_at_registration, AURENTARA_REGISTERED_CANONICAL_SHA, 'registration SHA must remain historical provenance');
assert.equal(reloaded.project.canonical_sha, PROJECT_HEAD, 'workspace reload must display current project truth instead of registration snapshot');
assert.equal(reloaded.project.canonical_sha_state, 'RECONCILED_PROJECT_PATH_HEAD');
assert.equal(reloaded.project.canonical_source, 'github_remote_project_path_history');
assert.equal(reloaded.project.working_branch, 'aurentara/first-real-workspace-run-v1');
assert.equal(reloaded.project.qa_status, 'PASS');
assert.equal(reloaded.latest_iteration.pr_number, 353);
assert.equal(reloaded.latest_delivery.status, 'MERGED');
assert.equal(reloaded.latest_mission.mission_id, 'workspace-real-project-iteration-353');
assert.equal(reloaded.quality.status, 'PASS');
assert.equal(reloaded.preview.status, 'NOT_AVAILABLE');
assert.equal(reloaded.current_state.preview_status, 'NOT_AVAILABLE');
assert.equal(reloaded.next_action, 'HUMAN_REVIEW');
assert.equal(reloaded.current_state.next_action, 'HUMAN_REVIEW');
assert.equal(reloaded.current_state.canonical_project_sha, PROJECT_HEAD);
assert.equal(reloaded.current_state.canonical_repository_head_sha, REPOSITORY_HEAD);
assert.equal(reloaded.iteration_history.at(-1).git_sha, PROJECT_HEAD);
assert.equal(reloaded.iteration_history.at(-1).qa_status, 'PASS');
assert.equal(reloaded.reconciliation.stale_registration_values_used_as_current_truth, false);
assert.equal(reloaded.reconciliation.external_write_performed, false);
assert.equal(reloaded.reconciliation.variable_cost_eur, 0);
assert.equal(reloaded.production_deploy, false);

const unavailable = reconcileOperatorProjectWorkspace(base, {
  ok: false,
  status: 'NOT_RECONCILED',
  quality: { status: 'NOT_RECONCILED', checks: [] }
});
assert.equal(unavailable.registration_state.canonical_sha_at_registration, AURENTARA_REGISTERED_CANONICAL_SHA);
assert.equal(unavailable.project.canonical_sha, null, 'stale registration SHA must never be shown as current when current truth cannot be verified');
assert.equal(unavailable.project.canonical_sha_state, 'NOT_RECONCILED');
assert.equal(unavailable.project.working_branch, null);
assert.equal(unavailable.project.qa_status, 'NOT_RECONCILED');
assert.equal(unavailable.next_action, 'RECONCILE_PROJECT_STATE');

console.log('AURENTARA Project Workspace State Reconciliation V1 stale-state regression: PASS');
