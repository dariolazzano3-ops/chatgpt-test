const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const SECRET_KEY = /(password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|cookie|credential|secret)/i;
const SECRET_TEXT = /(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,})/gi;

export function redactJarvisSensitiveDataV1(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return clean(value.replace(SECRET_TEXT, '[REDACTED]'));
  if (Array.isArray(value)) return value.map((item) => redactJarvisSensitiveDataV1(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactJarvisSensitiveDataV1(v, k)]));
  }
  return value ?? null;
}

export function createJarvisAuditEventV1(input = {}) {
  return {
    schema: 'aurentara.jarvis.audit-event.v1',
    timestamp: clean(input.timestamp, 80) || null,
    owner_ref: clean(input.owner_ref, 200) || null,
    request: redactJarvisSensitiveDataV1(clean(input.request, 600)),
    intent: redactJarvisSensitiveDataV1(input.intent || null),
    tools_used: Array.isArray(input.tools_used) ? input.tools_used.map((v) => clean(v, 180)).filter(Boolean) : [],
    permissions: Array.isArray(input.permissions) ? input.permissions.map((v) => clean(v, 160)).filter(Boolean) : [],
    action: clean(input.action, 120) || null,
    result: redactJarvisSensitiveDataV1(input.result || null),
    approval: redactJarvisSensitiveDataV1(input.approval || null),
    cost: redactJarvisSensitiveDataV1(input.cost || { estimated_eur: 0, actual_eur: null }),
    memory_updates: redactJarvisSensitiveDataV1(input.memory_updates || { accepted: 0, proposed: 0, rejected: 0 }),
    isolation: {
      namespace: 'jarvis.personal',
      hamyren_memory_access: false,
      hamyren_memory_write: false,
      external_secret_logging: false
    }
  };
}

export function appendJarvisAuditEventV1(events = [], event = {}, max = 1000) {
  const next = [...(Array.isArray(events) ? events : []), structuredClone(event)];
  return next.slice(Math.max(0, next.length - Math.max(1, Number(max) || 1000)));
}
