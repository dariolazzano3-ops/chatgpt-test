const clean = (value, max = 160) => String(value || '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => structuredClone(value ?? null);

function normalizeProject(project = {}) {
  const customerId = clean(project.customer_id, 120);
  const projectId = clean(project.project_id, 120);
  if (!customerId || !projectId) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED' };
  return {
    ok: true,
    scope: {
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      production_deploy: false
    }
  };
}

export function createProviderRegistry(entries = []) {
  const providers = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = clean(entry.id, 120);
    const capability = clean(entry.capability, 120);
    if (!id || !capability || providers.some((item) => item.id === id)) continue;
    providers.push({
      id,
      capability,
      priority: finite(entry.priority, 100),
      enabled: entry.enabled === true,
      external: entry.external !== false,
      paid: entry.paid === true,
      estimated_cost_units: Math.max(0, finite(entry.estimated_cost_units, 0)),
      runner: typeof entry.runner === 'function' ? entry.runner : null,
      fallback_ids: Array.isArray(entry.fallback_ids) ? entry.fallback_ids.map((v) => clean(v, 120)).filter(Boolean) : [],
      production_deploy: false
    });
  }
  return { registry_version: 'riosystems.providers.v1', providers };
}

function eligible(registry = {}, capability) {
  return (registry.providers || [])
    .filter((entry) => entry.enabled && entry.capability === capability && typeof entry.runner === 'function')
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function routeProvider(registry = {}, request = {}) {
  const capability = clean(request.capability, 120);
  if (!capability) return { ok: false, error: 'CAPABILITY_REQUIRED' };
  const candidates = eligible(registry, capability);
  if (!candidates.length) return { ok: false, error: 'PROVIDER_ROUTE_NOT_FOUND', capability };

  const preferred = clean(request.preferred_provider, 120);
  const primary = preferred ? candidates.find((entry) => entry.id === preferred) : candidates[0];
  if (!primary) return { ok: false, error: 'PREFERRED_PROVIDER_UNAVAILABLE', provider: preferred, capability };

  const fallbackSet = new Set(primary.fallback_ids);
  const fallback = candidates.filter((entry) => entry.id !== primary.id && (fallbackSet.size === 0 || fallbackSet.has(entry.id)));
  return {
    ok: true,
    capability,
    primary: primary.id,
    runner: primary.runner,
    provider: clone({ id: primary.id, external: primary.external, paid: primary.paid, estimated_cost_units: primary.estimated_cost_units }),
    fallbacks: fallback.map((entry) => clone({ id: entry.id, external: entry.external, paid: entry.paid, estimated_cost_units: entry.estimated_cost_units })),
    production_deploy: false
  };
}

export function evaluateRuntimeGovernance(input = {}) {
  const project = normalizeProject(input.project);
  if (!project.ok) return project;

  const provider = input.provider || {};
  const budget = input.budget || {};
  const approvals = input.approvals || {};
  const blockers = [];

  const estimated = Math.max(0, finite(provider.estimated_cost_units, 0));
  const remaining = Math.max(0, finite(budget.remaining_cost_units, 0));
  if (estimated > remaining) blockers.push({ code: 'PROJECT_BUDGET_EXCEEDED', estimated_cost_units: estimated, remaining_cost_units: remaining });
  if (provider.paid === true && approvals.cost_approved !== true) blockers.push({ code: 'PAID_PROVIDER_COST_APPROVAL_REQUIRED' });
  if (provider.external !== false && approvals.external_provider_approved !== true) blockers.push({ code: 'EXTERNAL_PROVIDER_APPROVAL_REQUIRED' });
  if (input.production_deploy === true) blockers.push({ code: 'PRODUCTION_DEPLOY_NOT_ALLOWED_IN_RUNTIME_FOUNDATION' });

  return {
    ok: true,
    scope: project.scope,
    estimated_cost_units: estimated,
    remaining_cost_units: remaining,
    blockers,
    blocked: blockers.length > 0,
    ready_for_supervised_execution: blockers.length === 0,
    production_deploy: false
  };
}

export function runtimeGovernanceManifest() {
  return {
    version: 'phase1.runtime.v1',
    features: ['provider_registry', 'provider_fallback', 'cost_budget_gate', 'external_provider_approval', 'customer_project_isolation'],
    automatic_external_activation: false,
    automatic_production_deploy: false,
    production_deploy: false
  };
}
