const MODEL = '@cf/zai-org/glm-4.7-flash';
const TRACE_ID = 'block6-e2e-staging-001';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/__riosystems/block6-ai-once') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.BLOCK6_AI_NONCE || request.headers.get('authorization') !== `Bearer ${env.BLOCK6_AI_NONCE}`) return new Response('Forbidden', { status: 403 });
    if (!env.AI) return Response.json({ ok: false, error: 'AI_BINDING_MISSING' }, { status: 500 });

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'Synthetic staging connectivity check. Reply OK only.' },
          { role: 'user', content: 'Block 6 trace verified?' }
        ],
        max_tokens: 4
      });
      const usage = result?.usage || result?.meta?.usage || {};
      const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
      const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
      const totalTokens = Number(usage.total_tokens ?? (promptTokens + completionTokens));
      const neuronsRaw = usage.neurons ?? result?.neurons ?? result?.meta?.neurons ?? null;
      const neurons = neuronsRaw === null ? null : Number(neuronsRaw);
      return Response.json({
        ok: true,
        trace_id: TRACE_ID,
        model: MODEL,
        prompt_tokens: Number.isFinite(promptTokens) ? promptTokens : 0,
        completion_tokens: Number.isFinite(completionTokens) ? completionTokens : 0,
        total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
        neurons: Number.isFinite(neurons) ? neurons : null,
        synthetic_test_data_only: true,
        real_customer_data: false,
        openai_fallback_used: false,
        secrets_returned: false,
        production_deploy: false
      });
    } catch (error) {
      return Response.json({
        ok: false,
        error: 'WORKERS_AI_INFERENCE_FAILED',
        trace_id: TRACE_ID,
        openai_fallback_used: false,
        secrets_returned: false,
        production_deploy: false
      }, { status: 502 });
    }
  }
};
