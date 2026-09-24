import assert from 'node:assert/strict';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisIntelligenceRouterV1 } from '../src/jarvis/intelligence-router-v1.js';
import {
  dispatchJarvisOwnerChatJobV1,
  runJarvisOwnerChatJobV1
} from '../src/jarvis/owner-chat-job-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:astra-codex-review@example.invalid';

{
  let hermesInput = null;
  const hermes = {
    configured: true,
    async chatCompletion(input) {
      hermesInput = input;
      return {
        ok: true,
        model: 'jarvis-orchestrator',
        text: JSON.stringify({
          decision: 'PASS',
          rationale: 'Verified implementation satisfies the bounded owner goal.',
          repair_brief: ''
        })
      };
    }
  };
  const router = createJarvisIntelligenceRouterV1({
    hermes_client: hermes,
    api_fallback_enabled: false
  });
  const review = await router.review({
    goal: 'Fix the parser bug without broadening scope.',
    execution_brief: 'Inspect parser code and patch the bounded bug.',
    verification: {
      repo_dir: '/tmp/fixture',
      branch: 'factory/astra-review',
      branch_drift: false,
      files_changed: ['src/parser.js'],
      syntax_check: { passed: true, checked: 1, results: [] }
    },
    system_verified: true,
    request_id: 'astra-review-1',
    hermes_session_key: 'jarvis-owner-' + OWNER_ID,
    memory_context: '- [PROJECTS] Parser: bounded internal repair'
  });

  assert.equal(review.ok, true);
  assert.equal(review.provider, 'HERMES_OPENAI_CODEX');
  assert.equal(review.decision, 'PASS');
  assert.equal(review.system_verification_authoritative, true);
  assert.equal(hermesInput.session_key, 'jarvis-owner-' + OWNER_ID);
  assert.ok(hermesInput.messages.some((row) => row.content.includes('ASTRA')));
  assert.ok(hermesInput.messages.some((row) => row.content.includes('BRIDGE_VERIFICATION_EVIDENCE')));
}

{
  const store = createMemoryJarvisStoreV1();
  const originalGoal = 'Fix the internal parser module and keep the change bounded to the feature branch.';
  const dispatch = await dispatchJarvisOwnerChatJobV1({
    owner_id: OWNER_ID,
    owner_ref: OWNER_REF,
    message: originalGoal,
    now: '2026-09-24T15:40:00.000Z'
  }, { memory_store: store });
  assert.equal(dispatch.ok, true);

  let bridgeCalls = 0;
  const bridgeTasks = [];
  const bridge = {
    bound: true,
    submit(input) {
      bridgeCalls += 1;
      bridgeTasks.push(input.task);
      return {
        result: Promise.resolve({
          state: 'COMPLETE',
          exit_code: 0,
          external_effect: true,
          evidence: {
            evidence_id: 'astra-loop-evidence-' + bridgeCalls,
            verification: {
              repo_dir: '/tmp/fixture',
              branch: 'factory/astra-loop',
              branch_drift: false,
              files_changed: ['src/parser.js'],
              syntax_check: { passed: true, checked: 1, results: [] }
            }
          }
        })
      };
    }
  };

  let reviewCalls = 0;
  const intelligence = {
    async plan({ goal }) {
      assert.equal(goal, originalGoal);
      return {
        ok: true,
        provider: 'HERMES_OPENAI_CODEX',
        lane: 'STANDARD',
        model: 'jarvis-orchestrator',
        execution_brief: 'Inspect parser and patch only the bounded bug.',
        api_fallback_used: false,
        api_cost_usd: 0,
        original_goal_authoritative: true
      };
    },
    async review({ goal, system_verified }) {
      assert.equal(goal, originalGoal);
      assert.equal(system_verified, true);
      reviewCalls += 1;
      if (reviewCalls === 1) {
        return {
          ok: true,
          provider: 'HERMES_OPENAI_CODEX',
          model: 'jarvis-orchestrator',
          decision: 'REPAIR',
          rationale: 'semantic edge case still missing',
          repair_brief: 'Handle the missing parser edge case only.',
          api_fallback_used: false,
          api_cost_usd: 0
        };
      }
      return {
        ok: true,
        provider: 'HERMES_OPENAI_CODEX',
        model: 'jarvis-orchestrator',
        decision: 'PASS',
        rationale: 'goal satisfied',
        repair_brief: '',
        api_fallback_used: false,
        api_cost_usd: 0
      };
    }
  };

  const result = await runJarvisOwnerChatJobV1(dispatch.job, {
    memory_store: store,
    intelligence_router: intelligence,
    claude_bridge: bridge,
    max_repair_attempts: 1,
    astra_post_review_enabled: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.repair_attempts, 1);
  assert.equal(reviewCalls, 2);
  assert.equal(bridgeCalls, 2);
  assert.equal(result.attempt_chain[0].system_verified, true);
  assert.equal(result.attempt_chain[0].astra_post_review.decision, 'REPAIR');
  assert.equal(result.attempt_chain[1].system_verified, true);
  assert.equal(result.attempt_chain[1].astra_post_review.decision, 'PASS');
  assert.equal(result.astra_post_review.decision, 'PASS');
  assert.ok(bridgeTasks[1].includes('[ASTRA POST REVIEW REPAIR 1/1]'));
  assert.ok(bridgeTasks[1].includes('Handle the missing parser edge case only.'));
  assert.ok(bridgeTasks[1].includes(originalGoal));
}

{
  const store = createMemoryJarvisStoreV1();
  const dispatch = await dispatchJarvisOwnerChatJobV1({
    owner_id: OWNER_ID,
    owner_ref: OWNER_REF,
    message: 'Fix the bounded parser module.',
    now: '2026-09-24T15:50:00.000Z'
  }, { memory_store: store });

  const bridge = {
    bound: true,
    submit() {
      return {
        result: Promise.resolve({
          state: 'COMPLETE',
          exit_code: 0,
          external_effect: true,
          evidence: {
            evidence_id: 'astra-block-evidence',
            verification: {
              repo_dir: '/tmp/fixture',
              branch: 'factory/astra-block',
              branch_drift: false,
              files_changed: ['src/parser.js'],
              syntax_check: { passed: true, checked: 1, results: [] }
            }
          }
        })
      };
    }
  };
  const intelligence = {
    async plan() {
      return {
        ok: true,
        provider: 'HERMES_OPENAI_CODEX',
        lane: 'LIGHT',
        model: 'jarvis-orchestrator',
        execution_brief: 'Make the bounded parser change.',
        api_fallback_used: false,
        api_cost_usd: 0,
        original_goal_authoritative: true
      };
    },
    async review() {
      return {
        ok: true,
        provider: 'HERMES_OPENAI_CODEX',
        model: 'jarvis-orchestrator',
        decision: 'BLOCK',
        rationale: 'Evidence contradicts the bounded safety scope.',
        repair_brief: '',
        api_fallback_used: false,
        api_cost_usd: 0
      };
    }
  };

  const result = await runJarvisOwnerChatJobV1(dispatch.job, {
    memory_store: store,
    intelligence_router: intelligence,
    claude_bridge: bridge,
    astra_post_review_enabled: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAILED');
  assert.match(result.reason, /^ASTRA_POST_REVIEW_BLOCK:/);
  assert.equal(result.attempt_chain[0].system_verified, true);
  assert.equal(result.attempt_chain[0].astra_post_review.decision, 'BLOCK');
}

console.log('JARVIS_ASTRA_CODEX_POST_REVIEW_V1_SMOKE_PASS');
