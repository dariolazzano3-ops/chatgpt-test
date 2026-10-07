import assert from 'node:assert/strict';
import {
  AUTONOMOUS_DELIVERY_LOOP_MAX_CYCLES,
  autonomousDeliveryLoopManifest,
  executeWebFactoryAsyncTask,
  runAutonomousDeliveryLoop,
  validateAutonomousDeliveryLoopRequest,
  webFactoryProviderManifest
} from '../src/web-factory/index.js';

const baseInput = {
  project_scope: 'gelato-donatello:web-v6',
  mission_id: 'webfactory-loop-smoke-v1',
  project_path: 'projects/gelato-donatello',
  target_branch: 'factory/gelato-donatello-v6',
  max_cycles: 3,
  quality_level: 'PREMIUM',
  policy: {
    max_variable_cost_eur: 0,
    private_preview_deploy: true,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_merge: false,
    automatic_paid_activation: false,
    external_customer_writes: false
  }
};

let browserCalls = 0;
let repairCalls = 0;
let previewCalls = 0;
const adapters = {
  async build() {
    return {
      status: 'PASS',
      commit_sha: 'build-commit-1',
      changed_files: ['projects/gelato-donatello/index.html'],
      variable_cost_eur: 0
    };
  },
  async technical_qa({ commit_sha }) {
    return { status: 'PASS', evidence_ref: 'evidence://technical/' + commit_sha, variable_cost_eur: 0 };
  },
  async visual_closure({ commit_sha }) {
    return {
      schema: 'riosystems.j7-visual-closure-result.v1',
      status: 'PASS',
      iterations: commit_sha === 'build-commit-1' ? 2 : 0,
      human_decision_required: false,
      final_candidate: { commit_sha },
      variable_cost_eur: 0
    };
  },
  async browser_acceptance({ commit_sha }) {
    browserCalls += 1;
    if (browserCalls === 1) {
      return {
        schema: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
        status: 'FAIL',
        full_accessibility_accepted: false,
        blocking_issues: [{ area: 'BROWSER', code: 'MOBILE_OVERFLOW' }],
        variable_cost_eur: 0
      };
    }
    return {
      schema: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
      status: 'PASS',
      accessibility: { status: 'PASS' },
      full_accessibility_accepted: false,
      human_accessibility_review_pending: true,
      blocking_issues: [],
      evidence_ref: 'evidence://j9/' + commit_sha,
      variable_cost_eur: 0
    };
  },
  async repair({ reason }) {
    repairCalls += 1;
    assert.equal(reason, 'J9_ACCEPTANCE_FAILED');
    return {
      status: 'PASS',
      commit_sha: 'repair-commit-1',
      changed_files: ['projects/gelato-donatello/assets/styles.css'],
      variable_cost_eur: 0
    };
  },
  async private_preview({ commit_sha }) {
    previewCalls += 1;
    return {
      status: 'PASS',
      preview_url: 'https://private-preview.example.invalid',
      source_commit_sha: commit_sha,
      private_access_verified: true,
      public_access: false,
      production_deploy: false,
      dns_change: false,
      variable_cost_eur: 0
    };
  }
};

const validation = validateAutonomousDeliveryLoopRequest(baseInput, adapters);
assert.equal(validation.ok, true);
assert.equal(validation.max_cycles, 3);

const asyncManifest = await executeWebFactoryAsyncTask({
  capability: 'web.autonomous.delivery-loop.v1',
  operation: 'manifest'
});
assert.equal(asyncManifest.ok, true);
assert.equal(asyncManifest.manifest.schema, 'riosystems.autonomous-delivery-loop-manifest.v1');
assert.ok(webFactoryProviderManifest().capabilities.includes('web.autonomous.delivery-loop.v1'));

const refsMain = validateAutonomousDeliveryLoopRequest({ ...baseInput, target_branch: 'refs/heads/main' }, adapters);
assert.equal(refsMain.ok, false);
assert.ok(refsMain.issues.includes('CANONICAL_BRANCH_WRITE_FORBIDDEN'));

const result = await runAutonomousDeliveryLoop(baseInput, adapters);
assert.equal(result.ok, true);
assert.equal(result.status, 'PRIVATE_PREVIEW_READY');
assert.equal(result.final_commit_sha, 'repair-commit-1');
assert.equal(result.cycles_completed, 2);
assert.equal(result.private_preview.private_access_verified, true);
assert.equal(result.accessibility.automated_pass, true);
assert.equal(result.accessibility.full_accessibility_accepted, false);
assert.equal(result.accessibility.human_review_pending, true);
assert.equal(result.next_action.code, 'REVIEW_PRIVATE_PREVIEW');
assert.equal(browserCalls, 2);
assert.equal(repairCalls, 1);
assert.equal(previewCalls, 1);
assert.equal(result.total_variable_cost_eur, 0);
assert.equal(result.production_deploy, false);
assert.equal(result.public_launch, false);
assert.equal(result.automatic_merge, false);

const unsafe = await runAutonomousDeliveryLoop({
  ...baseInput,
  policy: { ...baseInput.policy, production_deploy: true }
}, adapters);
assert.equal(unsafe.ok, false);
assert.equal(unsafe.status, 'BLOCKED');
assert.ok(unsafe.validation.issues.includes('UNSAFE_POLICY:production_deploy'));
assert.equal(previewCalls, 1);

const leakingAdapters = {
  ...adapters,
  async browser_acceptance() {
    return {
      schema: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
      status: 'PASS',
      accessibility: { status: 'PASS' },
      full_accessibility_accepted: false,
      human_accessibility_review_pending: true,
      blocking_issues: [],
      variable_cost_eur: 0
    };
  },
  async private_preview({ commit_sha }) {
    return {
      status: 'PASS',
      preview_url: 'https://public.example.invalid',
      source_commit_sha: commit_sha,
      private_access_verified: false,
      public_access: true,
      production_deploy: false,
      dns_change: false,
      variable_cost_eur: 0
    };
  }
};
const leaking = await runAutonomousDeliveryLoop(baseInput, leakingAdapters);
assert.equal(leaking.ok, false);
assert.equal(leaking.reason, 'PRIVATE_PREVIEW_SAFETY_VERIFICATION_FAILED');

const accessibilityBlockedAdapters = {
  ...adapters,
  async browser_acceptance() {
    return {
      schema: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
      status: 'PASS',
      accessibility: { status: 'FAIL' },
      full_accessibility_accepted: false,
      human_accessibility_review_pending: true,
      blocking_issues: [],
      variable_cost_eur: 0
    };
  }
};
const accessibilityBlocked = await runAutonomousDeliveryLoop(baseInput, accessibilityBlockedAdapters);
assert.equal(accessibilityBlocked.ok, false);
assert.equal(accessibilityBlocked.status, 'HUMAN_DECISION_REQUIRED');
assert.equal(accessibilityBlocked.reason, 'BOUNDED_DELIVERY_CYCLES_EXHAUSTED');

let exhaustedRepairs = 0;
const exhaustedAdapters = {
  ...adapters,
  async browser_acceptance() {
    return {
      schema: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
      status: 'FAIL',
      full_accessibility_accepted: false,
      blocking_issues: [{ area: 'PERFORMANCE', code: 'LIGHTHOUSE_BELOW_TARGET' }],
      variable_cost_eur: 0
    };
  },
  async repair({ cycle }) {
    exhaustedRepairs += 1;
    return {
      status: 'PASS',
      commit_sha: 'exhaust-repair-' + cycle,
      changed_files: ['projects/gelato-donatello/assets/styles.css'],
      variable_cost_eur: 0
    };
  },
  async private_preview() {
    throw new Error('preview must not run when acceptance never passes');
  }
};
const exhausted = await runAutonomousDeliveryLoop({ ...baseInput, max_cycles: 2 }, exhaustedAdapters);
assert.equal(exhausted.ok, false);
assert.equal(exhausted.status, 'HUMAN_DECISION_REQUIRED');
assert.equal(exhausted.reason, 'BOUNDED_DELIVERY_CYCLES_EXHAUSTED');
assert.equal(exhaustedRepairs, 2);

const manifest = autonomousDeliveryLoopManifest();
assert.equal(manifest.max_cycles, AUTONOMOUS_DELIVERY_LOOP_MAX_CYCLES);
assert.equal(manifest.visual_engine, 'riosystems.j7-visual-closure-result.v1');
assert.equal(manifest.browser_acceptance_engine, 'riosystems.j9-browser-accessibility-performance-acceptance.v2');
assert.equal(manifest.private_preview_before_owner_review, true);
assert.equal(manifest.owner_review_required_before_delivery, true);
assert.equal(manifest.automatic_merge, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.public_launch, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'webfactory-autonomous-delivery-loop-v1',
  pipeline: manifest.pipeline,
  happy_path_cycles: result.cycles_completed,
  bounded_repair: 'PASS',
  j7_contract_required: true,
  j9_contract_required: true,
  private_preview_safety: 'PASS',
  canonical_branch_write: 'BLOCKED',
  automatic_merge: false,
  production_deploy: false,
  public_launch: false,
  variable_cost_eur: 0
}, null, 2));
