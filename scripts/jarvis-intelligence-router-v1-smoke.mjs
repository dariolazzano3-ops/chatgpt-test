import assert from 'node:assert/strict';
import { createJarvisIntelligenceRouterV1 } from '../src/jarvis/intelligence-router-v1.js';
import {
  createJarvisOpenAiBrainClientV1,
  estimateJarvisOpenAiCostV1
} from '../src/jarvis/openai-brain-client-v1.js';

assert.equal(estimateJarvisOpenAiCostV1('gpt-6-luna', 13, 8), 0.0000053);

{
  const calls = [];
  const fetchImpl = async (_url, init) => {
    calls.push(init);
    return new Response(JSON.stringify({
      model: 'gpt-6-luna',
      choices: [{ message: { content: 'OK' } }],
      usage: { prompt_tokens: 13, completion_tokens: 8, total_tokens: 21 }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createJarvisOpenAiBrainClientV1({
    api_key: 'sk-test-abcdefghijklmnopqrstuvwxyz',
    fetch_impl: fetchImpl,
    allowed_models: ['gpt-6-luna']
  });
  const out = await client.complete({
    model: 'gpt-6-luna',
    messages: [{ role: 'user', content: 'hello' }],
    max_completion_tokens: 16,
    reasoning_effort: 'none',
    idempotency_key: 'job-1'
  });
  assert.equal(out.estimated_cost_usd, 0.0000053);
  assert.equal(calls[0].headers.authorization, 'Bearer sk-test-abcdefghijklmnopqrstuvwxyz');
  assert.equal(calls[0].headers['idempotency-key'], 'job-1');
  assert.equal(JSON.stringify(out).includes('sk-test-'), false);
  await assert.rejects(() => client.complete({
    model: 'gpt-unknown',
    messages: [{ role: 'user', content: 'x' }]
  }), /JARVIS_OPENAI_MODEL_NOT_ALLOWED/);
}

{
  let apiCalls = 0;
  const hermes = {
    configured: true,
    chatCompletion: async () => ({
      ok: true,
      model: 'jarvis-orchestrator',
      text: JSON.stringify({
        complexity: 'STANDARD',
        rationale: 'moderate multi-file task',
        execution_brief: 'Inspect the two modules, patch the bug, run focused tests.'
      })
    })
  };
  const openai = {
    configured: true,
    complete: async () => { apiCalls += 1; throw new Error('should not call'); }
  };
  const router = createJarvisIntelligenceRouterV1({
    hermes_client: hermes,
    openai_client: openai,
    api_fallback_enabled: true,
    max_job_cost_usd: 0.25
  });
  const plan = await router.plan({ goal: 'Fix internal module bug.', request_id: 'r1' });
  assert.equal(plan.ok, true);
  assert.equal(plan.provider, 'HERMES_OPENAI_CODEX');
  assert.equal(plan.lane, 'STANDARD');
  assert.equal(plan.api_fallback_used, false);
  assert.equal(plan.api_cost_usd, 0);
  assert.equal(apiCalls, 0);
}

{
  const models = [];
  const hermes = {
    configured: true,
    chatCompletion: async () => ({
      ok: true,
      model: 'jarvis-orchestrator',
      text: 'API call failed after 1 retries: HTTP 429: The usage limit has been reached'
    })
  };
  const openai = {
    configured: true,
    complete: async ({ model }) => {
      models.push(model);
      if (models.length === 1) {
        return {
          requested_model: model,
          text: JSON.stringify({ complexity: 'HEAVY', rationale: 'cross-system architecture' }),
          estimated_cost_usd: 0.00001
        };
      }
      return {
        requested_model: model,
        text: JSON.stringify({ execution_brief: 'Map boundaries, preserve invariants, implement bounded changes, verify independently.' }),
        estimated_cost_usd: 0.04
      };
    }
  };
  const router = createJarvisIntelligenceRouterV1({
    hermes_client: hermes,
    openai_client: openai,
    api_fallback_enabled: true,
    max_job_cost_usd: 0.25,
    light_model: 'gpt-6-luna',
    standard_model: 'gpt-6-sol',
    heavy_model: 'gpt-6-astra'
  });
  const plan = await router.plan({ goal: 'Refactor the internal architecture across several subsystems.', request_id: 'r2' });
  assert.equal(plan.ok, true);
  assert.equal(plan.provider, 'OPENAI_API');
  assert.equal(plan.primary_failure_reason, 'HERMES_USAGE_LIMIT');
  assert.equal(plan.lane, 'HEAVY');
  assert.deepEqual(models, ['gpt-6-luna', 'gpt-6-astra']);
  assert.equal(plan.api_fallback_used, true);
  assert.ok(plan.api_cost_usd < 0.25);
  assert.equal(plan.original_goal_authoritative, true);
}

{
  const hermes = {
    configured: true,
    chatCompletion: async () => ({ text: 'HTTP 429 usage_limit_reached' })
  };
  const router = createJarvisIntelligenceRouterV1({
    hermes_client: hermes,
    openai_client: null,
    api_fallback_enabled: false
  });
  const plan = await router.plan({ goal: 'Fix X.', request_id: 'r3' });
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'JARVIS_AI_API_FALLBACK_DISABLED');
  assert.equal(plan.primary_failure_reason, 'HERMES_USAGE_LIMIT');
}

{
  let apiCalls = 0;
  const hermes = {
    configured: true,
    chatCompletion: async () => ({ text: 'HTTP 429 usage limit reached' })
  };
  const openai = {
    configured: true,
    complete: async () => { apiCalls += 1; throw new Error('budget should block first'); }
  };
  const router = createJarvisIntelligenceRouterV1({
    hermes_client: hermes,
    openai_client: openai,
    api_fallback_enabled: true,
    max_job_cost_usd: 0.000001
  });
  const plan = await router.plan({ goal: 'Architect a large subsystem.', request_id: 'r4' });
  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'JARVIS_AI_BUDGET_BLOCKED');
  assert.equal(apiCalls, 0);
}

console.log('JARVIS_INTELLIGENCE_ROUTER_V1_SMOKE_PASS');
