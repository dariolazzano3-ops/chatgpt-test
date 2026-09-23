/* JARVIS OpenAI Brain Client V1.
   Direct API fallback only. No tools, no external actions, no arbitrary model ids.
   Standard-mode pricing snapshot verified 2026-09-23 against OpenAI model docs. */

const clean = (value, max = 65536) => String(value ?? '').trim().slice(0, max);
const API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_RESPONSE_CHARS = 2_000_000;

export const JARVIS_OPENAI_MODEL_PRICES_V1 = Object.freeze({
  'gpt-6-luna': Object.freeze({ input_per_million: 0.10, output_per_million: 0.50 }),
  'gpt-6-sol': Object.freeze({ input_per_million: 2.00, output_per_million: 10.00 }),
  'gpt-6-astra': Object.freeze({ input_per_million: 10.00, output_per_million: 50.00 })
});

function makeError(code, status = 0) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function boundedPositive(value, fallback, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.round(parsed)) : fallback;
}

export function estimateJarvisOpenAiCostV1(model, inputTokens, outputTokens) {
  const price = JARVIS_OPENAI_MODEL_PRICES_V1[model];
  if (!price) throw makeError('JARVIS_OPENAI_MODEL_NOT_ALLOWED');
  const input = Math.max(0, Number(inputTokens) || 0);
  const output = Math.max(0, Number(outputTokens) || 0);
  return ((input * price.input_per_million) + (output * price.output_per_million)) / 1_000_000;
}

export function conservativeTokenEstimateV1(messages = []) {
  const chars = messages.reduce((sum, row) => sum + clean(row?.content, 65536).length + 40, 0);
  return Math.max(1, Math.ceil(chars / 2));
}

export function createJarvisOpenAiBrainClientV1(config = {}) {
  const apiKey = clean(config.api_key, 4000);
  const fetchImpl = typeof config.fetch_impl === 'function' ? config.fetch_impl : globalThis.fetch;
  const timeoutMs = boundedPositive(config.timeout_ms, 30000, 120000);
  const allowedModels = new Set(
    (Array.isArray(config.allowed_models) ? config.allowed_models : Object.keys(JARVIS_OPENAI_MODEL_PRICES_V1))
      .map((x) => clean(x, 120))
      .filter((x) => JARVIS_OPENAI_MODEL_PRICES_V1[x])
  );
  const configured = apiKey.startsWith('sk-') && apiKey.length >= 20 && typeof fetchImpl === 'function';

  async function complete(input = {}) {
    if (!configured) throw makeError('JARVIS_OPENAI_API_NOT_CONFIGURED');
    const model = clean(input.model, 120);
    if (!allowedModels.has(model)) throw makeError('JARVIS_OPENAI_MODEL_NOT_ALLOWED');

    const messages = Array.isArray(input.messages)
      ? input.messages.slice(0, 32).map((row) => ({
          role: ['system', 'user', 'assistant'].includes(row?.role) ? row.role : 'user',
          content: clean(row?.content, 65536)
        })).filter((row) => row.content)
      : [];
    if (!messages.length) throw makeError('JARVIS_OPENAI_MESSAGES_REQUIRED');

    const maxCompletionTokens = boundedPositive(input.max_completion_tokens, 800, 4000);
    const reasoningEffort = clean(input.reasoning_effort, 20);
    const payload = {
      model,
      messages,
      max_completion_tokens: maxCompletionTokens,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {})
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
          ...(clean(input.idempotency_key, 255) ? { 'idempotency-key': clean(input.idempotency_key, 255) } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timer);
      throw makeError(error?.name === 'AbortError' ? 'JARVIS_OPENAI_API_TIMEOUT' : 'JARVIS_OPENAI_API_UNREACHABLE');
    }
    clearTimeout(timer);

    const length = Number(response.headers?.get?.('content-length') || 0);
    if (Number.isFinite(length) && length > MAX_RESPONSE_CHARS) throw makeError('JARVIS_OPENAI_RESPONSE_TOO_LARGE');

    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_CHARS) throw makeError('JARVIS_OPENAI_RESPONSE_TOO_LARGE');

    let body;
    try { body = raw ? JSON.parse(raw) : {}; }
    catch { throw makeError('JARVIS_OPENAI_RESPONSE_INVALID_JSON', response.status); }

    if (!response.ok) throw makeError('JARVIS_OPENAI_HTTP_' + response.status, response.status);

    const text = clean(body?.choices?.[0]?.message?.content, 65536);
    if (!text) throw makeError('JARVIS_OPENAI_EMPTY_RESPONSE');

    const usage = body?.usage || {};
    const promptTokens = Math.max(0, Number(usage.prompt_tokens) || 0);
    const completionTokens = Math.max(0, Number(usage.completion_tokens) || 0);
    const totalTokens = Math.max(0, Number(usage.total_tokens) || promptTokens + completionTokens);
    const costUsd = estimateJarvisOpenAiCostV1(model, promptTokens, completionTokens);

    return {
      ok: true,
      provider: 'OPENAI_API',
      model: clean(body?.model, 120) || model,
      requested_model: model,
      text,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      },
      estimated_cost_usd: costUsd,
      external_effect: false
    };
  }

  return {
    schema: 'aurentara.jarvis.openai-brain-client.v1',
    configured,
    allowed_models: [...allowedModels],
    complete
  };
}

export function createJarvisOpenAiBrainClientFromEnvV1(env = {}, options = {}) {
  return createJarvisOpenAiBrainClientV1({
    api_key: env.OPENAI_API_KEY,
    allowed_models: [
      env.JARVIS_AI_LIGHT_MODEL || 'gpt-6-luna',
      env.JARVIS_AI_STANDARD_MODEL || 'gpt-6-sol',
      env.JARVIS_AI_HEAVY_MODEL || 'gpt-6-astra'
    ],
    timeout_ms: env.JARVIS_AI_API_TIMEOUT_MS,
    fetch_impl: options.fetch_impl
  });
}
