const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const clean = (value, max = 160) => String(value || '').trim().slice(0, max);

export function createAIProviderRegistry(entries = []) {
  const providers = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = clean(entry.id, 120);
    if (!id || providers.some((item) => item.id === id)) continue;
    providers.push({
      id,
      model: clean(entry.model, 160) || null,
      task_types: Array.isArray(entry.task_types) ? entry.task_types.map((v) => clean(v, 80)).filter(Boolean) : ['*'],
      output_formats: Array.isArray(entry.output_formats) ? entry.output_formats.map((v) => clean(v, 80)).filter(Boolean) : ['text', 'structured_json'],
      priority: Number.isFinite(entry.priority) ? Number(entry.priority) : 100,
      enabled: entry.enabled === true,
      runner: typeof entry.runner === 'function' ? entry.runner : null,
      requires_credentials: entry.requires_credentials !== false,
      paid_external_call: entry.paid_external_call !== false,
      production_deploy: false,
      tool_access: false,
      external_data_access: false
    });
  }
  return { registry_version: 'ai.providers.v1', providers };
}

export function routeAIProvider(registry = {}, task = {}, preferences = {}) {
  const taskType = clean(task.task_type, 80);
  const outputFormat = clean(task.output?.format, 80);
  const preferred = clean(preferences.provider, 120);
  const candidates = (registry.providers || [])
    .filter((entry) => entry.enabled && typeof entry.runner === 'function')
    .filter((entry) => entry.task_types.includes('*') || entry.task_types.includes(taskType))
    .filter((entry) => entry.output_formats.includes(outputFormat));

  if (preferred) {
    const match = candidates.find((entry) => entry.id === preferred);
    if (!match) return { ok: false, error: 'AI_PREFERRED_PROVIDER_UNAVAILABLE', provider: preferred };
    return { ok: true, provider: match.id, model: match.model, runner: match.runner, policy: clone({ requires_credentials: match.requires_credentials, paid_external_call: match.paid_external_call }) };
  }

  candidates.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  if (!candidates.length) return { ok: false, error: 'AI_PROVIDER_ROUTE_NOT_FOUND' };
  const selected = candidates[0];
  return { ok: true, provider: selected.id, model: selected.model, runner: selected.runner, policy: clone({ requires_credentials: selected.requires_credentials, paid_external_call: selected.paid_external_call }) };
}

export function listAIProviders(registry = {}) {
  return (registry.providers || []).map(({ runner, ...entry }) => ({ ...clone(entry), runner_configured: typeof runner === 'function' }));
}
