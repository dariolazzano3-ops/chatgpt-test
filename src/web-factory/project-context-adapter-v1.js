const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const list = (value) => Array.isArray(value) ? value.filter((item) => item != null) : [];

function first(values, keys) {
  for (const key of keys) if (values[key] != null && values[key] !== '') return values[key];
  return null;
}

export function adaptProjectContextToWebMission(projectContext = {}, existing = {}) {
  if (projectContext?.schema !== 'aurentara.project-mission-context.v1') return { ok: false, error: 'PROJECT_MISSION_CONTEXT_INVALID' };
  if (projectContext.readiness_ref?.status === 'BLOCKED') return { ok: false, error: 'PROJECT_CONTENT_READINESS_BLOCKED' };
  const values = projectContext.verified_content || {};
  const project = projectContext.project || {};
  const servicesRaw = first(values, ['business.services', 'business.offerings', 'business.products']);
  const visualRefs = list(projectContext.visual_context?.reference_sites || projectContext.visual_context?.visual_references);
  const approvedAssets = list(projectContext.assets).filter((asset) => asset.publishable === true);
  const mission = {
    ...clone(existing || {}),
    business_name: clean(first(values, ['business.name', 'business.identity']) || existing.business_name, 500),
    project_slug: clean(existing.project_slug || project.project_id, 160) || undefined,
    industry: clean(first(values, ['business.industry']) || existing.industry || 'local-business', 160),
    primary_goal: clean(first(values, ['website.primary_goal']) || existing.primary_goal, 500),
    services: Array.isArray(servicesRaw) ? servicesRaw.map((item) => clean(item, 200)).filter(Boolean) : servicesRaw ? [clean(servicesRaw, 200)] : list(existing.services),
    existing_brand: clone(existing.existing_brand || projectContext.visual_context || {}),
    existing_content: clone({ ...(existing.existing_content || {}), canonical_values: values, content_pack_ref: projectContext.content_pack_ref }),
    existing_domain: clean(first(values, ['website.domain', 'business.domain']) || existing.existing_domain, 240) || null,
    reference_sites: list(existing.reference_sites).length ? clone(existing.reference_sites) : visualRefs,
    visual_references: clone(existing.visual_references || []),
    existing_website: clone(existing.existing_website || first(values, ['website.existing_website']) || null),
    operator_design_intent: clone(existing.operator_design_intent || {}),
    special_requirements: [...new Set([...(list(existing.special_requirements)), 'PROJECT_CONTENT_PACK_BOUND', 'PROJECT_RIGHTS_ENFORCEMENT_REQUIRED'])],
    project_mission_context: clone(projectContext),
    approved_project_assets: approvedAssets,
    real_customer_data: false,
    production_deploy: false
  };
  return { ok: true, mission, project_context_bound: true, production_deploy: false };
}

export function projectContextWebAdapterManifest() {
  return {
    schema: 'aurentara.project-context-web-adapter.v1',
    input: 'aurentara.project-mission-context.v1',
    output: 'riosystems.web-mission.v1-compatible-fields',
    creates_new_factory: false,
    changes_provider_routing: false,
    production_deploy: false
  };
}
