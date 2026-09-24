/* JARVIS ↔ Hermes Core HTTP client V1.
   Private/internal only. The bearer secret never leaves this module's request headers.
   Plain HTTP is accepted only for literal private/loopback addresses. */

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const RUN_ID_RE = /^run_[0-9a-f]+$/i;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RESPONSE_CHARS = 2_000_000;
const MAX_SESSION_KEY_CHARS = 256;

function validSessionKey(value) {
  const key = clean(value, MAX_SESSION_KEY_CHARS + 1);
  return key.length > 0
    && key.length <= MAX_SESSION_KEY_CHARS
    && !/[\r\n\x00]/.test(key)
    ? key
    : '';
}

function isPrivateIpv4(host) {
  const m = String(host || '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return a === 10
    || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

export function isJarvisHermesPrivateUrlV1(value) {
  let url;
  try { url = new URL(clean(value, 2000)); } catch { return false; }
  if (url.username || url.password || url.search || url.hash) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '::1' || isPrivateIpv4(host);
}

function nowIso(clock) {
  try { return new Date(typeof clock === 'function' ? clock() : Date.now()).toISOString(); }
  catch { return new Date().toISOString(); }
}
async function responseJson(response) {
  const len = Number(response.headers?.get?.('content-length') || 0);
  if (Number.isFinite(len) && len > MAX_RESPONSE_CHARS) {
    const error = new Error('HERMES_RESPONSE_TOO_LARGE');
    error.code = 'HERMES_RESPONSE_TOO_LARGE';
    throw error;
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) {
    const error = new Error('HERMES_RESPONSE_TOO_LARGE');
    error.code = 'HERMES_RESPONSE_TOO_LARGE';
    throw error;
  }
  try { return text ? JSON.parse(text) : {}; }
  catch {
    const error = new Error('HERMES_RESPONSE_INVALID_JSON');
    error.code = 'HERMES_RESPONSE_INVALID_JSON';
    throw error;
  }
}

function boundedTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(30000, Math.round(parsed))
    : DEFAULT_TIMEOUT_MS;
}

function makeError(code, status = 0) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}
export function createJarvisHermesCoreClientV1(config = {}) {
  const baseUrl = clean(config.base_url, 2000).replace(/\/$/, '');
  const apiKey = clean(config.api_key, 4000);
  const fetchImpl = typeof config.fetch_impl === 'function' ? config.fetch_impl : globalThis.fetch;
  const timeoutMs = boundedTimeout(config.timeout_ms);
  const clock = config.clock;

  const configured = isJarvisHermesPrivateUrlV1(baseUrl)
    && apiKey.length >= 16
    && typeof fetchImpl === 'function';

  async function request(path, options = {}) {
    if (!configured) throw makeError('HERMES_CORE_NOT_CONFIGURED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      accept: 'application/json',
      ...(options.auth === false ? {} : { authorization: 'Bearer ' + apiKey }),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.idempotency_key ? { 'idempotency-key': options.idempotency_key } : {}),
      ...(validSessionKey(options.session_key) ? { 'x-hermes-session-key': validSessionKey(options.session_key) } : {})
    };
    let response;
    try {
      response = await fetchImpl(baseUrl + path, {
        method: options.method || 'GET',
        headers,
        signal: controller.signal,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    } catch (error) {
      clearTimeout(timer);
      throw makeError(error?.name === 'AbortError' ? 'HERMES_CORE_TIMEOUT' : 'HERMES_CORE_UNREACHABLE');
    }
    clearTimeout(timer);
    const body = await responseJson(response);
    const expected = Array.isArray(options.expected) ? options.expected : [200];
    if (!expected.includes(response.status)) throw makeError('HERMES_HTTP_' + response.status, response.status);
    return body;
  }
  async function health() {
    const body = await request('/health', { auth: false });
    if (body?.status !== 'ok' || body?.platform !== 'hermes-agent') {
      throw makeError('HERMES_HEALTH_INVALID');
    }
    return body;
  }

  async function capabilities() {
    const body = await request('/v1/capabilities');
    if (body?.object !== 'hermes.api_server.capabilities' || body?.platform !== 'hermes-agent') {
      throw makeError('HERMES_CAPABILITIES_INVALID');
    }
    return body;
  }

  async function toolsets() {
    const body = await request('/v1/toolsets');
    if (body?.object !== 'list' || body?.platform !== 'api_server' || !Array.isArray(body?.data)) {
      throw makeError('HERMES_TOOLSETS_INVALID');
    }
    return body;
  }

  async function chatCompletion(input = {}) {
    const messages = Array.isArray(input.messages)
      ? input.messages.slice(0, 32).map((row) => ({
          role: ['system', 'user', 'assistant'].includes(row?.role) ? row.role : 'user',
          content: clean(row?.content, 65536)
        })).filter((row) => row.content)
      : [];
    if (!messages.length) throw makeError('HERMES_CHAT_MESSAGES_REQUIRED');

    const body = await request('/v1/chat/completions', {
      method: 'POST',
      expected: [200],
      idempotency_key: clean(input.idempotency_key, 255) || undefined,
      session_key: validSessionKey(input.session_key) || undefined,
      body: {
        model: clean(input.model, 120) || 'jarvis-orchestrator',
        messages,
        stream: false
      }
    });
    const text = clean(body?.choices?.[0]?.message?.content, 65536);
    if (!text) throw makeError('HERMES_CHAT_EMPTY_RESPONSE');
    return {
      ok: true,
      provider: 'HERMES_OPENAI_CODEX',
      model: clean(body?.model, 120) || 'jarvis-orchestrator',
      text,
      usage: body?.usage || {},
      external_effect: false
    };
  }

  async function startRun(input = {}) {
    const text = clean(input.input, 65536);
    if (!text) throw makeError('HERMES_RUN_INPUT_REQUIRED');
    const sessionId = clean(input.session_id, 200);
    const idempotencyKey = clean(input.idempotency_key, 255);
    const body = await request('/v1/runs', {
      method: 'POST',
      expected: [202],
      idempotency_key: idempotencyKey || undefined,
      session_key: validSessionKey(input.session_key) || undefined,
      body: { input: text, ...(sessionId ? { session_id: sessionId } : {}) }
    });
    if (!RUN_ID_RE.test(clean(body?.run_id, 120)) || body?.status !== 'started') {
      throw makeError('HERMES_RUN_START_INVALID');
    }
    return body;
  }
  async function getRun(runId) {
    const id = clean(runId, 120);
    if (!RUN_ID_RE.test(id)) throw makeError('HERMES_RUN_ID_INVALID');
    const body = await request('/v1/runs/' + encodeURIComponent(id));
    if (body?.object !== 'hermes.run' || body?.run_id !== id || !clean(body?.status, 40)) {
      throw makeError('HERMES_RUN_STATUS_INVALID');
    }
    return body;
  }

  async function liveProbe() {
    try {
      const [healthBody, caps] = await Promise.all([health(), capabilities()]);
      if ((caps?.features || {}).run_submission !== true) return null;
      return {
        live: true,
        state: 'ONLINE',
        source_id: 'jarvis-hermes-core:authenticated-api',
        observed_at: nowIso(clock),
        stale_after_ms: 60000,
        version: clean(healthBody?.version, 80) || null
      };
    } catch {
      return null;
    }
  }

  return {
    schema: 'aurentara.jarvis.hermes-core-http-client.v1',
    configured,
    base_url: configured ? baseUrl : null,
    health,
    capabilities,
    toolsets,
    chatCompletion,
    startRun,
    getRun,
    liveProbe
  };
}

export function createJarvisHermesCoreClientFromEnvV1(env = {}, options = {}) {
  return createJarvisHermesCoreClientV1({
    base_url: env.JARVIS_HERMES_API_URL,
    api_key: env.JARVIS_HERMES_API_KEY,
    timeout_ms: env.JARVIS_HERMES_TIMEOUT_MS,
    fetch_impl: options.fetch_impl,
    clock: options.clock
  });
}
