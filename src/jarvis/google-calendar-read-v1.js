const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

async function tokenFrom(provider) {
  if (typeof provider !== 'function') throw new Error('JARVIS_GOOGLE_CALENDAR_TOKEN_PROVIDER_REQUIRED');
  const token = clean(await provider(), 12000);
  if (!token) throw new Error('JARVIS_GOOGLE_CALENDAR_ACCESS_TOKEN_REQUIRED');
  return token;
}

function validateWindow(payload = {}) {
  const timeMin = clean(payload.time_min, 80);
  const timeMax = clean(payload.time_max, 80);
  if (!RFC3339.test(timeMin) || !RFC3339.test(timeMax)) {
    return { ok: false, error: 'JARVIS_CALENDAR_RFC3339_WINDOW_REQUIRED' };
  }
  const start = Date.parse(timeMin);
  const end = Date.parse(timeMax);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ok: false, error: 'JARVIS_CALENDAR_WINDOW_INVALID' };
  }
  if (end - start > 31 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: 'JARVIS_CALENDAR_WINDOW_TOO_LARGE' };
  }
  return {
    ok: true,
    time_min: timeMin,
    time_max: timeMax,
    calendar_id: clean(payload.calendar_id, 300) || 'primary',
    max_results: Math.max(1, Math.min(50, Number(payload.max_results) || 25))
  };
}

function normalizeEvent(event = {}) {
  return {
    id: clean(event.id, 300) || null,
    summary: clean(event.summary, 500) || 'Untitled event',
    start: clean(event.start?.dateTime || event.start?.date, 100) || null,
    end: clean(event.end?.dateTime || event.end?.date, 100) || null,
    location: clean(event.location, 500) || null,
    status: clean(event.status, 80) || null,
    html_link: clean(event.htmlLink, 2000) || null
  };
}

export function createGoogleCalendarReadConnectorV1({
  access_token_provider,
  fetch_impl = globalThis.fetch
} = {}) {
  if (typeof access_token_provider !== 'function') throw new Error('JARVIS_GOOGLE_CALENDAR_TOKEN_PROVIDER_REQUIRED');
  if (typeof fetch_impl !== 'function') throw new Error('JARVIS_GOOGLE_CALENDAR_FETCH_REQUIRED');

  const handler = async ({ capability, payload = {} } = {}) => {
    if (capability !== 'calendar.read') throw new Error('JARVIS_GOOGLE_CALENDAR_READ_ONLY');
    const window = validateWindow(payload);
    if (!window.ok) throw new Error(window.error);

    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: window.time_min,
      timeMax: window.time_max,
      maxResults: String(window.max_results)
    });
    const token = await tokenFrom(access_token_provider);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(window.calendar_id)}/events?${params.toString()}`;
    const response = await fetch_impl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' }
    });

    if (!response.ok) throw new Error(`JARVIS_GOOGLE_CALENDAR_READ_FAILED:${response.status}`);
    let body;
    try { body = await response.json(); } catch { throw new Error('JARVIS_GOOGLE_CALENDAR_RESPONSE_INVALID'); }

    return {
      schema: 'aurentara.jarvis.google-calendar-read-result.v1',
      calendar_id: window.calendar_id,
      time_min: window.time_min,
      time_max: window.time_max,
      count: Array.isArray(body?.items) ? body.items.length : 0,
      events: Array.isArray(body?.items) ? body.items.map(normalizeEvent) : [],
      next_page_token: clean(body?.nextPageToken, 1000) || null,
      read_only: true,
      external_effect: false,
      credentials_returned: false
    };
  };

  return {
    connector_id: 'jarvis.google-calendar.read.v1',
    family: 'CALENDAR',
    provider: 'GOOGLE_CALENDAR',
    capabilities: ['calendar.read'],
    required_permissions: ['CALENDAR_READ'],
    risk_level: 'LOW',
    write_scope: 'NONE',
    authentication_state: 'AUTHENTICATED',
    availability: 'AVAILABLE',
    cost_profile: 'ZERO',
    handler
  };
}

export function jarvisGoogleCalendarReadManifestV1() {
  return {
    schema: 'aurentara.jarvis.google-calendar-read.v1',
    capability: 'calendar.read',
    write_capabilities: [],
    oauth_token_persisted: false,
    event_fields_minimized: true,
    max_window_days: 31,
    max_results: 50,
    external_writes: false,
    production_deploy: false
  };
}
