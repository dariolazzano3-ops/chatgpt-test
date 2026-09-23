import assert from 'node:assert/strict';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import {
  dispatchJarvisOwnerChatJobV1,
  runJarvisOwnerChatJobV1
} from '../src/jarvis/owner-chat-job-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:intelligence-smoke@example.invalid';
const originalGoal = 'Read-only: inspect the internal parser bug and report the verified root cause.';
let capturedTask = null;

const store = createMemoryJarvisStoreV1();
const dispatch = await dispatchJarvisOwnerChatJobV1({
  owner_id: OWNER_ID,
  owner_ref: OWNER_REF,
  message: originalGoal,
  now: '2026-09-23T12:00:00.000Z'
}, { memory_store: store });
assert.equal(dispatch.ok, true);

const intelligence = {
  plan: async ({ goal }) => {
    assert.equal(goal, originalGoal);
    return {
      ok: true,
      provider: 'OPENAI_API',
      lane: 'STANDARD',
      model: 'gpt-6-sol',
      execution_brief: 'Inspect parser entry points and tests. Do not modify files. Report exact evidence.',
      api_fallback_used: true,
      api_cost_usd: 0.002,
      max_job_cost_usd: 0.25,
      primary_failure_reason: 'HERMES_USAGE_LIMIT',
      original_goal_authoritative: true
    };
  }
};

const bridge = {
  bound: true,
  submit(input) {
    capturedTask = input.task;
    return {
      result: Promise.resolve({
        state: 'COMPLETE',
        exit_code: 0,
        external_effect: false,
        evidence: {
          evidence_id: 'intelligence-smoke-evidence',
          verification: {
            filesystem_evidence: { complete: true, unchanged: true },
            git_evidence: { head_unchanged: true },
            tool_audit: {
              complete: true,
              is_error: false,
              tool_uses: [],
              forbidden_tool_uses: [],
              outside_workspace_targets: [],
              sensitive_targets: [],
              permission_denials: []
            }
          }
        }
      })
    };
  }
};

const result = await runJarvisOwnerChatJobV1(dispatch.job, {
  memory_store: store,
  intelligence_router: intelligence,
  claude_bridge: bridge
});

assert.equal(result.ok, true);
assert.equal(result.status, 'COMPLETE');
assert.ok(capturedTask);
assert.ok(capturedTask.includes(originalGoal), 'original owner goal must reach Claude unchanged');
assert.ok(capturedTask.includes('[JARVIS INTELLIGENCE EXECUTION BRIEF - ADVISORY ONLY]'));
assert.ok(capturedTask.includes('Inspect parser entry points and tests.'));
assert.ok(capturedTask.includes('[AUTHORITY RULE]'));
assert.ok(capturedTask.indexOf(originalGoal) < capturedTask.indexOf('[JARVIS INTELLIGENCE EXECUTION BRIEF - ADVISORY ONLY]'));
assert.equal(result.intelligence_route.provider, 'OPENAI_API');
assert.equal(result.intelligence_route.lane, 'STANDARD');
assert.equal(result.intelligence_route.model, 'gpt-6-sol');
assert.equal(result.intelligence_route.api_fallback_used, true);
assert.equal(result.intelligence_route.api_cost_usd, 0.002);
assert.equal(result.intelligence_route.primary_failure_reason, 'HERMES_USAGE_LIMIT');

const rows = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 100 });
const notification = rows.find((row) =>
  row.request_id === dispatch.request_id &&
  row.intent?.intent_type === 'OWNER_CHAT_JOB_NOTIFICATION'
);
assert.ok(notification);
assert.equal(notification.result.intelligence_route.provider, 'OPENAI_API');
assert.equal(notification.result.intelligence_route.original_goal_authoritative, true);
assert.equal(notification.cost.actual_usd, 0.002);
assert.equal(notification.cost.actual_eur, null);

console.log('JARVIS_OWNER_CHAT_INTELLIGENCE_V1_SMOKE_PASS');
