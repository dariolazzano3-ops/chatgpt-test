const text = (value, max = 600) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (value, limit = 24) => [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, 160)).filter(Boolean))].slice(0, limit);

export function slugifyProject(value) {
  return text(value, 120)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'website-project';
}

const DEFAULT_PAGES = ['home', 'services', 'about', 'contact', 'faq'];

export function validateWebsiteMission(input = {}) {
  const requirements = [];
  const warnings = [];
  const requireText = (field, label = field) => {
    const value = text(input[field], 500);
    if (!value) requirements.push({ field, code: 'REQUIRED_INFORMATION_MISSING', message: `${label} is required` });
    return value;
  };

  const businessName = requireText('business_name', 'business_name');
  const industry = requireText('industry', 'industry');
  const primaryGoal = requireText('primary_goal', 'primary_goal');
  const services = list(input.services, 20);
  if (!services.length) requirements.push({ field: 'services', code: 'SERVICES_REQUIRED', message: 'At least one service or offer is required' });

  const country = text(input.country, 80) || 'Germany';
  const language = text(input.language, 16) || 'de';
  const targetAudience = text(input.target_audience, 400) || `Prospective customers of ${businessName || 'the business'}`;
  const brandPositioning = text(input.brand_positioning, 500) || `Clear, trustworthy specialist in ${industry || 'its market'}`;
  const tone = text(input.tone, 160) || 'clear, trustworthy, modern';
  const requiredPages = list(input.required_pages, 20).map((page) => slugifyProject(page));
  const pages = [...new Set([...(requiredPages.length ? requiredPages : DEFAULT_PAGES), ...DEFAULT_PAGES])];
  const conversionGoal = text(input.conversion_goal, 300) || primaryGoal || 'Generate qualified enquiries';
  const seoLocation = text(input.seo_location, 160) || (country === 'Germany' ? 'Germany' : country);

  if (!input.country) warnings.push({ field: 'country', code: 'DEFAULT_APPLIED', value: country });
  if (!input.language) warnings.push({ field: 'language', code: 'DEFAULT_APPLIED', value: language });
  if (!input.target_audience) warnings.push({ field: 'target_audience', code: 'DEFAULT_APPLIED', value: targetAudience });
  if (!input.brand_positioning) warnings.push({ field: 'brand_positioning', code: 'DEFAULT_APPLIED', value: brandPositioning });
  if (!input.tone) warnings.push({ field: 'tone', code: 'DEFAULT_APPLIED', value: tone });

  const mission = {
    schema: 'riosystems.web-mission.v1',
    business_name: businessName,
    project_slug: slugifyProject(input.project_slug || businessName),
    industry,
    country,
    language,
    target_audience: targetAudience,
    primary_goal: primaryGoal,
    services,
    brand_positioning: brandPositioning,
    tone,
    required_pages: pages,
    required_features: list(input.required_features, 20),
    seo_location: seoLocation,
    conversion_goal: conversionGoal,
    existing_brand: input.existing_brand && typeof input.existing_brand === 'object' ? structuredClone(input.existing_brand) : null,
    existing_content: input.existing_content && typeof input.existing_content === 'object' ? structuredClone(input.existing_content) : null,
    existing_domain: text(input.existing_domain, 240) || null,
    reference_sites: list(input.reference_sites, 10),
    special_requirements: list(input.special_requirements, 20),
    synthetic_test_data_only: input.synthetic_test_data_only === true,
    real_customer_data: false,
    production_deploy: false,
    variable_cost_ceiling_eur: 0,
    paid_fallback_allowed: false
  };

  return {
    ok: requirements.length === 0,
    status: requirements.length ? 'REQUIREMENTS_REQUIRED' : 'MISSION_VALID',
    mission,
    requirements,
    warnings
  };
}

export function websiteMissionContractManifest() {
  return {
    schema: 'riosystems.web-mission.v1',
    required: ['business_name', 'industry', 'primary_goal', 'services'],
    defaultable: ['country', 'language', 'target_audience', 'brand_positioning', 'tone', 'required_pages', 'seo_location', 'conversion_goal'],
    optional: ['existing_brand', 'existing_content', 'existing_domain', 'reference_sites', 'special_requirements', 'required_features'],
    production_deploy: false,
    variable_cost_ceiling_eur: 0
  };
}
