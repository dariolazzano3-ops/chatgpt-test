const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function valueText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return clean(value, 320);
  try { return clean(JSON.stringify(value), 320); } catch { return ''; }
}

function calendarAnswer(runtime = {}, options = {}) {
  const execution = runtime.connector_execution;
  if (!execution) {
    return {
      text: 'Der Calendar-Read-Pfad ist vorbereitet, aber der eigenständige JARVIS-Worker hat noch keine Google-OAuth-Verbindung. Es wurde nichts verändert.',
      tone: 'attention'
    };
  }
  if (execution.status === 'UNBOUND') {
    return {
      text: 'Google Calendar ist in dieser JARVIS-Runtime noch nicht gebunden. Der Zugriff bleibt read-only und es wurde nichts verändert.',
      tone: 'attention'
    };
  }
  if (execution.status !== 'COMPLETED') {
    return { text: 'Der Kalender konnte gerade nicht gelesen werden. Es wurde nichts verändert.', tone: 'attention' };
  }

  const events = Array.isArray(execution.result?.events) ? execution.result.events : [];
  if (!events.length) return { text: 'Für den abgefragten Zeitraum stehen keine Termine im Kalender.', tone: 'ready' };

  const timezone = clean(options.timezone, 120) || 'Europe/Berlin';
  const lines = events.slice(0, 8).map((event) => {
    let when = clean(event.start, 100);
    try {
      when = new Intl.DateTimeFormat('de-DE', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(event.start));
    } catch {}
    return '• ' + when + ' · ' + clean(event.summary, 300);
  });
  const extra = events.length > 8 ? '\n+' + (events.length - 8) + ' weitere' : '';
  return { text: 'Dein Kalender:\n' + lines.join('\n') + extra, tone: 'ready' };
}

export function presentJarvisRuntimeResponseV1(runtime = {}, options = {}) {
  const action = clean(runtime.core?.intent?.action, 120).toUpperCase();

  if (action === 'READ_CALENDAR') return { ...calendarAnswer(runtime, options), schema: 'aurentara.jarvis.presentation.v1' };

  if (action === 'READ_MEMORY') {
    const items = Array.isArray(runtime.core?.memory_retrieval?.items) ? runtime.core.memory_retrieval.items : [];
    if (!items.length) return { schema: 'aurentara.jarvis.presentation.v1', tone: 'neutral', text: 'Dazu habe ich aktuell keine relevante Erinnerung geladen.' };
    const lines = items.slice(0, 6).map((item) => '• ' + clean(item.subject, 220) + (valueText(item.value) ? ': ' + valueText(item.value) : ''));
    return { schema: 'aurentara.jarvis.presentation.v1', tone: 'ready', text: 'Relevante Erinnerungen:\n' + lines.join('\n') };
  }

  if (action === 'READ_STATUS') {
    return {
      schema: 'aurentara.jarvis.presentation.v1',
      tone: 'ready',
      text: 'JARVIS Core ist online. Private Session aktiv, Memory isoliert, Production/Billing/Finanzaktionen aus. Calendar Write bleibt gesperrt.'
    };
  }

  const intent = clean(runtime.core?.intent?.intent_type || runtime.core?.intent?.type, 120);
  return {
    schema: 'aurentara.jarvis.presentation.v1',
    tone: 'neutral',
    text: intent
      ? 'Anfrage verstanden (' + intent + '). Der private Runtime-Pfad ist aktiv. Freie generative Antworten werden erst über einen separat freigegebenen AI-Provider zugeschaltet.'
      : 'Anfrage verstanden. Der private Runtime-Pfad ist aktiv.'
  };
}
