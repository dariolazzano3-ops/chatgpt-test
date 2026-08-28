const clean = (value, max = 200) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export function createIntegrationCatalog(entries = []) {
  const integrations = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = clean(entry.id, 120);
    const capability = clean(entry.capability, 120);
    const kind = clean(entry.kind, 80);
    if (!id || !capability || !kind || integrations.some((item) => item.id === id)) continue;
    integrations.push({
      id,
      capability,
      kind,
      provider: clean(entry.provider, 120) || id,
      credential_ref: clean(entry.credential_ref, 240) || null,
      endpoint: clean(entry.endpoint, 500) || null,
      allowed_hosts: Array.isArray(entry.allowed_hosts) ? entry.allowed_hosts.map((v) => clean(v, 240)).filter(Boolean) : [],
      enabled: entry.enabled === true,
      external_write: entry.external_write === true,
      paid: entry.paid === true,
      health: ['healthy','degraded','offline','unknown'].includes(entry.health) ? entry.health : 'unknown',
      runner: typeof entry.runner === 'function' ? entry.runner : null,
      real_provider: entry.real_provider === true,
      provider_candidate: entry.real_provider === true && entry.provider_candidate && typeof entry.provider_candidate === 'object' ? clone(entry.provider_candidate) : null,
      production_deploy: false
    });
  }
  return { catalog_version: 'riosystems.integrations.v1', integrations };
}

export function listIntegrationCatalog(catalog = {}) {
  return (catalog.integrations || []).map(({ runner, ...item }) => ({ ...clone(item), runner_configured: typeof runner === 'function' }));
}

export function selectIntegration(catalog = {}, request = {}) {
  const capability = clean(request.capability, 120);
  if (!capability) return { ok: false, error: 'INTEGRATION_CAPABILITY_REQUIRED', production_deploy: false };
  const candidates = (catalog.integrations || [])
    .filter((item) => item.enabled && item.capability === capability)
    .filter((item) => item.health !== 'offline')
    .sort((a, b) => {
      const rank = { healthy: 0, unknown: 1, degraded: 2 };
      return (rank[a.health] ?? 9) - (rank[b.health] ?? 9) || a.id.localeCompare(b.id);
    });
  if (!candidates.length) return { ok: false, error: 'INTEGRATION_NOT_AVAILABLE', capability, production_deploy: false };
  const preferred = clean(request.preferred_integration, 120);
  const selected = preferred ? candidates.find((item) => item.id === preferred) : candidates[0];
  if (!selected) return { ok: false, error: 'PREFERRED_INTEGRATION_UNAVAILABLE', capability, production_deploy: false };
  return { ok: true, capability, integration: selected, production_deploy: false };
}

export function integrationCatalogManifest() {
  return {
    version: 'riosystems.integrations.v1',
    kinds: ['ai_provider','crm','email','automation','cloud_platform','payments','analytics','storage','generic_api'],
    credential_reference_only: true,
    health_aware_selection: true,
    real_provider_metadata_supported: true,
    production_deploy: false
  };
}
