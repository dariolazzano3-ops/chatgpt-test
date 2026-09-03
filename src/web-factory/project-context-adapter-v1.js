const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const list = (value) => Array.isArray(value) ? value.filter((item) => item != null) : [];

function first(values, keys) {
  for (const key of keys) if (values[key] != null && values[key] !== '') return values[key];
  return null;
}

function cleanList(value, fallback = []) {
  const source = Array.isArray(value) ? value : value != null && value !== '' ? [value] : list(fallback);
  return source.map((item) => clean(item, 500)).filter(Boolean);
}

export function adaptProjectContextToWebMission(projectContext = {}, existing = {}) {
  if (projectContext?.schema !== 'aurentara.project-mission-context.v1') return { ok: false, error: 'PROJECT_MISSION_CONTEXT_INVALID' };
  if (projectContext.readiness_ref?.status === 'BLOCKED') return { ok: false, error: 'PROJECT_CONTENT_READINESS_BLOCKED' };
  const values = projectContext.verified_content || {};
  const project = projectContext.project || {};
  const servicesRaw = first(values, ['business.services', 'business.offerings', 'business.products']);
  const websiteSources = list(projectContext.website_sources);
  const sourceBound = websiteSources.length > 0;
  const designWebsiteRefs = websiteSources.filter((source) => source.effective_usage?.design_reference === true).map((source) => clean(source.locator, 2000)).filter(Boolean);
  const structureWebsiteRefs = websiteSources.filter((source) => source.effective_usage?.structure_reference === true).map((source) => clean(source.locator, 2000)).filter(Boolean);
  const visualRefs = list(projectContext.visual_references || projectContext.visual_context?.reference_sites || projectContext.visual_context?.visual_references).filter((ref) => {
    if (!ref?.source_id) return true;
    const source = websiteSources.find((item) => item.source_id === ref.source_id);
    return !source || source.effective_usage?.design_reference === true;
  });
  const visualRefUrls = visualRefs.map((ref) => clean(ref?.original_url || ref?.url || ref, 2000)).filter(Boolean);
  const allowedDesignRefs = [...new Set([...designWebsiteRefs, ...visualRefUrls])];
  const approvedAssets = list(projectContext.assets).filter((asset) => asset.publishable === true);
  const canonicalContent = {
    ...(existing.existing_content || {}),
    headline: clean(first(values, ['content.headline', 'website.headline', 'brand.headline']) || existing.existing_content?.headline, 500) || undefined,
    subheadline: clean(first(values, ['content.subheadline', 'website.subheadline', 'business.description']) || existing.existing_content?.subheadline, 1200) || undefined,
    body: clean(first(values, ['content.body', 'content.summary', 'business.description']) || existing.existing_content?.body, 4000) || undefined,
    benefits: cleanList(first(values, ['content.benefits']), existing.existing_content?.benefits),
    services: cleanList(servicesRaw, existing.existing_content?.services),
    faq: clone(first(values, ['content.faq', 'faq']) || existing.existing_content?.faq || []),
    cta: clean(first(values, ['content.cta', 'website.cta']) || existing.existing_content?.cta, 500) || undefined,
    canonical_values: clone(values),
    content_pack_ref: clone(projectContext.content_pack_ref),
    content_provenance: clone(projectContext.content_provenance || [])
  };
  const mission = {
    ...clone(existing || {}),
    business_name: clean(first(values, ['business.name', 'business.identity']) || existing.business_name, 500),
    project_slug: clean(existing.project_slug || project.project_id, 160) || undefined,
    industry: clean(first(values, ['business.industry']) || existing.industry || 'local-business', 160),
    target_audience: clean(first(values, ['business.target_audience', 'website.target_audience']) || existing.target_audience, 400) || undefined,
    primary_goal: clean(first(values, ['website.primary_goal']) || existing.primary_goal, 500),
    services: cleanList(servicesRaw, existing.services),
    brand_positioning: clean(first(values, ['brand.positioning', 'business.positioning']) || existing.brand_positioning, 500) || undefined,
    tone: clean(first(values, ['brand.tone', 'content.tone']) || existing.tone, 160) || undefined,
    existing_brand: clone(existing.existing_brand || projectContext.visual_context || {}),
    existing_content: canonicalContent,
    existing_domain: clean(first(values, ['website.domain', 'business.domain']) || existing.existing_domain, 240) || null,
    reference_sites: sourceBound ? clone(allowedDesignRefs) : (list(existing.reference_sites).length ? clone(existing.reference_sites) : clone(visualRefUrls)),
    design_reference_sites: clone(allowedDesignRefs),
    structure_reference_sites: clone(structureWebsiteRefs),
    visual_references: sourceBound ? clone(visualRefs) : clone(existing.visual_references || visualRefs),
    existing_website: sourceBound && !structureWebsiteRefs.length && !allowedDesignRefs.length ? null : clone(existing.existing_website || first(values, ['website.existing_website']) || null),
    operator_design_intent: clone(existing.operator_design_intent || {}),
    special_requirements: [...new Set([...(list(existing.special_requirements)), 'PROJECT_CONTENT_PACK_BOUND', 'PROJECT_RIGHTS_ENFORCEMENT_REQUIRED', 'PROJECT_WEBSITE_USAGE_ENFORCEMENT_REQUIRED', 'REFERENCE_COPY_FORBIDDEN', 'REFERENCE_LOGO_CLONE_FORBIDDEN', 'REFERENCE_PIXEL_CLONE_FORBIDDEN'])],
    website_sources: clone(websiteSources),
    website_reference_policy: { content_copy_allowed: false, publishable_reference_assets: false, logo_clone_allowed: false, pixel_clone_allowed: false },
    project_scope_key: clean(project.scope_key, 320) || null,
    project_mission_context: clone(projectContext),
    approved_project_assets: clone(approvedAssets),
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
    preserves_project_scope: true,
    preserves_content_provenance: true,
    preserves_approved_assets: true,
    enforces_website_source_usage: true,
    reference_copy_allowed: false,
    creates_new_factory: false,
    changes_provider_routing: false,
    production_deploy: false
  };
}
