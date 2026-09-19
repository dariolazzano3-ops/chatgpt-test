const clean = (value, max = 4000) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function normalizeJarvisWatchRequestV1(body = {}) {
  const message = clean(body.utterance || body.message, 2000);
  if (!message) return { ok: false, error: 'JARVIS_WATCH_MESSAGE_REQUIRED' };

  const localeRaw = clean(body.locale || 'de-DE', 32);
  const locale = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(localeRaw) ? localeRaw : 'de-DE';

  const sourceRaw = clean(body.source || 'WATCH_APP', 40).toUpperCase();
  const allowedSources = new Set(['WATCH_APP', 'SIRI_APP_INTENT', 'SHORTCUT']);
  const source = allowedSources.has(sourceRaw) ? sourceRaw : 'WATCH_APP';

  const correlationId = clean(body.correlation_id || body.request_id, 80);

  return {
    ok: true,
    message,
    locale,
    source,
    correlation_id: correlationId || null
  };
}

function splitSentences(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
}

export function compactJarvisWatchAnswerV1(answer, {
  max_chars = 320,
  max_sentences = 2
} = {}) {
  const cleanAnswer = clean(answer, 4000);
  if (!cleanAnswer) return '';

  const sentences = splitSentences(cleanAnswer)
    .map(x => x.trim())
    .filter(Boolean);

  let candidate = sentences.slice(0, Math.max(1, max_sentences)).join(' ').trim();
  if (!candidate) candidate = cleanAnswer;
  if (candidate.length <= max_chars) return candidate;

  const clipped = candidate.slice(0, Math.max(1, max_chars - 1));
  const lastSpace = clipped.lastIndexOf(' ');
  const safe = (lastSpace >= Math.floor(max_chars * 0.6) ? clipped.slice(0, lastSpace) : clipped).trim();
  return safe.replace(/[,:;\-]+$/g, '') + '…';
}

export function projectJarvisWatchResponseV1(chat = {}, request = {}) {
  const answer = compactJarvisWatchAnswerV1(chat.answer, {
    max_chars: 320,
    max_sentences: 2
  });

  return {
    ok: chat.ok === true,
    schema: 'aurentara.jarvis.apple-watch-response.v1',
    request_id: chat.request_id || request.correlation_id || null,
    correlation_id: chat.correlation_id || request.correlation_id || null,
    answer,
    display_text: answer,
    speak_text: answer,
    locale: request.locale || 'de-DE',
    source: request.source || 'WATCH_APP',
    run_state: chat.run_state || null,
    intent: chat.intent || null,
    action: chat.action || null,
    approval_required: chat.approval_required === true,
    blocked: chat.blocked === true,
    memory_loaded: Number(chat.memory_loaded || 0),
    audit_persisted: chat.audit_persisted === true,
    external_effect: chat.external_effect === true,
    same_private_runtime: true,
    same_memory_namespace: true,
    server_audio_generated: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}

export function jarvisWatchGatewayManifestV1() {
  return {
    schema: 'aurentara.jarvis.apple-watch-gateway.v1',
    status: 'BACKEND_READY',
    private: true,
    authentication: 'CLOUDFLARE_ACCESS_PLUS_JARVIS_SESSION',
    dedicated_device_secret_required: false,
    long_lived_bridge_secret_on_watch: false,
    same_private_runtime: true,
    same_memory_namespace: true,
    same_action_gates: true,
    same_audit_path: true,
    max_input_chars: 2000,
    max_output_chars: 320,
    max_output_sentences: 2,
    supported_sources: ['WATCH_APP', 'SIRI_APP_INTENT', 'SHORTCUT'],
    server_audio_generated: false,
    production_deploy: false,
    public_access: false,
    external_writes_enabled_by_gateway: false
  };
}
