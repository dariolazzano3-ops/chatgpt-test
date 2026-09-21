const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MIME_EXT = Object.freeze({
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a'
});

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createJarvisOpenAiVoiceTranscriberV1(env = {}, options = {}) {
  const apiKey = String(options.api_key || env.OPENAI_API_KEY || '');
  const model = clean(options.model || env.JARVIS_VOICE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe', 120);
  const prompt = clean(options.prompt || env.JARVIS_VOICE_TRANSCRIBE_PROMPT ||
    'Natürliche deutsche Sprache an JARVIS. Eigennamen und Begriffe: JARVIS, Dario, YSRIO, AURENTARA, HAMYREN, RIOSYSTEMS, LUNARA, Gelato Donatello, Claude, Cloudflare, Supabase.', 800);
  const fetchImpl = options.fetch_impl || globalThis.fetch;
  const configured = Boolean(apiKey && typeof fetchImpl === 'function');
  return {
    configured,
    provider: 'OPENAI_AUDIO_TRANSCRIPTION',
    model,
    async transcribe(input = {}) {
      if (!configured) return { ok: false, error: 'JARVIS_VOICE_TRANSCRIBER_NOT_CONFIGURED' };
      const mimeType = clean(input.mime_type, 80).split(';')[0].toLowerCase();
      if (!MIME_EXT[mimeType]) return { ok: false, error: 'JARVIS_VOICE_MIME_UNSUPPORTED' };

      let bytes;
      try { bytes = decodeBase64(String(input.audio_base64 || '')); }
      catch { return { ok: false, error: 'JARVIS_VOICE_AUDIO_INVALID' }; }
      if (!bytes.length) return { ok: false, error: 'JARVIS_VOICE_AUDIO_REQUIRED' };
      if (bytes.length > MAX_AUDIO_BYTES) return { ok: false, error: 'JARVIS_VOICE_AUDIO_TOO_LARGE' };

      const form = new FormData();
      form.append('file', new Blob([bytes], { type: mimeType }), `jarvis-voice.${MIME_EXT[mimeType]}`);
      form.append('model', model);
      form.append('language', clean(input.language, 12) || 'de');
      if (prompt) form.append('prompt', prompt);
      let response;
      try {
        response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(30000)
        });
      } catch {
        return { ok: false, error: 'JARVIS_VOICE_TRANSCRIPTION_UNREACHABLE' };
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) return { ok: false, error: `JARVIS_VOICE_TRANSCRIPTION_HTTP_${response.status}` };
      const text = clean(body?.text, 4000);
      if (!text) return { ok: false, error: 'JARVIS_VOICE_TRANSCRIPTION_EMPTY' };
      return { ok: true, text, provider: this.provider, model, external_effect: false, paid_inference_calls: 1 };
    }
  };
}
