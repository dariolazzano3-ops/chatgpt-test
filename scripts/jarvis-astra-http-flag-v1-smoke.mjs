import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';

const store = createMemoryJarvisStoreV1();
const authorize = async () => ({
  ok: true,
  operator_id: 'jarvis-operator:astra-http@example.invalid',
  email: 'astra-http@example.invalid'
});

let planCalls = 0;
let reviewCalls = 0;
const intelligenceRouter = {
  api_fallback_enabled: true,
  async plan({ goal }) {
    planCalls += 1;
    assert.match(goal, /Bugfix/i);
    return {
      ok: true,
      provider: 'HERMES_OPENAI_CODEX',
      lane: 'LIGHT',
      model: 'jarvis-orchestrator',
      execution_brief: 'Patch only the bounded internal bug and preserve the owner goal.',
      api_fallback_used: false,
      api_cost_usd: 0,
      original_goal_authoritative: true
    };
  },
  async review({ system_verified }) {
    reviewCalls += 1;
    assert.equal(system_verified, true);
    return {
      ok: true,
      provider: 'HERMES_OPENAI_CODEX',
      model: 'jarvis-orchestrator',
      decision: 'PASS',
      rationale: 'Verified implementation satisfies the bounded owner goal.',
      repair_brief: '',
      api_fallback_used: false,
      api_cost_usd: 0
    };
  }
};

let bridgeCalls = 0;
const bridge = {
  bound: true,
  submit() {
    bridgeCalls += 1;
    return {
      result: Promise.resolve({
        state: 'COMPLETE',
        exit_code: 0,
        external_effect: true,
        evidence: {
          evidence_id: 'astra-http-evidence',
          verification: {
            repo_dir: '/tmp/astra-http-fixture',
            branch: 'factory/astra-http-flag',
            branch_drift: false,
            files_changed: ['src/fix.js'],
            syntax_check: { passed: true, checked: 1, results: [] }
          }
        }
      })
    };
  }
};

let background = null;
const response = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Implementiere einen kleinen internen Bugfix im Modul X.',
      correlation_id: '77777777-7777-4777-8777-777777777777'
    })
  }),
  {
    JARVIS_ASTRA_POST_REVIEW_ENABLED: 'true'
  },
  {
    waitUntil(promise) { background = promise; }
  },
  {
    authorize,
    memory_store: store,
    intelligence_router: intelligenceRouter,
    claude_bridge: bridge,
    owner_chat_job_max_repair_attempts: 0
  }
);

assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.chat_work_classification, 'ACTIONABLE_WORK');
assert.equal(body.run_state, 'RUNNING');
assert.ok(background, 'HTTP route must schedule the background owner-chat job');
await background;

assert.equal(planCalls, 1);
assert.equal(reviewCalls, 1, 'env feature flag must enable ASTRA post review');
assert.equal(bridgeCalls, 1);

// The route-level proof is deliberately dependency-observed rather than
// re-reading the in-memory store without its private owner scope: if the
// feature flag were not propagated, reviewCalls would remain zero.
assert.equal(planCalls, 1);
assert.equal(reviewCalls, 1);
assert.equal(bridgeCalls, 1);

console.log('JARVIS_ASTRA_HTTP_FLAG_V1_SMOKE_PASS');
