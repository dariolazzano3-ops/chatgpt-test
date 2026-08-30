const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);

const recipe = (ICP_patterns, positioning_patterns, offer_patterns, channels, SEO_patterns, trust_patterns, conversion_patterns, KPIs) => ({ ICP_patterns, positioning_patterns, offer_patterns, channels, SEO_patterns, trust_patterns, conversion_patterns, KPIs });

const RECIPES = Object.freeze({
  local_service: recipe(['local buyer with urgent or recurring service need'], ['local','trust','specialist'], ['clear service package','low-friction quote or booking'], ['Local SEO','Google Business','referrals','SEO'], ['service+location','problem+location','service-specific pages'], ['real reviews','local proof','credentials where applicable'], ['phone or form path','clear service area','proof near CTA'], ['qualified_leads','conversion_rate','review_velocity']),
  consulting: recipe(['decision-maker with costly business problem'], ['specialist','authority','trust'], ['diagnostic','project','retainer'], ['SEO','content','outbound','referrals','partnerships'], ['problem-led commercial intent','case-led proof'], ['case studies','credentials','expertise proof'], ['diagnostic CTA','qualification form'], ['qualified_leads','meeting_rate','deal_conversion']),
  agency: recipe(['business needing execution capacity or specialist expertise'], ['specialist','speed','trust'], ['package','retainer'], ['content','outbound','referrals','partnerships','SEO'], ['service+industry','problem+solution'], ['portfolio','case studies','results with proof'], ['audit or consultation CTA'], ['qualified_leads','meeting_rate','pipeline_value']),
  restaurant: recipe(['local diner by occasion cuisine and convenience'], ['local','trust','convenience'], ['core menu experience','occasion offer'], ['Google Business','Local SEO','organic social','referrals'], ['cuisine+location','occasion+location'], ['real reviews','photos','menu clarity'], ['booking','directions','call'], ['traffic','conversion_rate','review_velocity']),
  real_estate: recipe(['buyer seller landlord or investor by geography and intent'], ['local','specialist','trust'], ['valuation','consultation','listing service'], ['Local SEO','Google Business','referrals','content','partnerships'], ['property intent+location','valuation+location'], ['credentials','verified transactions','reviews'], ['valuation or consultation CTA'], ['qualified_leads','meeting_rate','deal_conversion']),
  SaaS: recipe(['role or company segment with recurring software job'], ['specialist','innovation','convenience'], ['subscription','trial or demo'], ['SEO','content','community','partnerships'], ['problem','category','comparison','integration'], ['product proof','case studies','security proof'], ['signup or demo path'], ['paid_customers','conversion_rate','customer_acquisition_cost']),
  professional_services: recipe(['client with expert or trust-heavy need'], ['specialist','trust','local'], ['consultation','fixed scope','retainer'], ['SEO','Local SEO','referrals','partnerships'], ['service+problem+location'], ['credentials','reviews','process clarity'], ['consultation CTA'], ['qualified_leads','meeting_rate','deal_conversion']),
  hospitality: recipe(['traveler by occasion location and experience preference'], ['local','premium','convenience'], ['stay package','direct-booking value'], ['SEO','Local SEO','Google Business','organic social','partnerships'], ['stay+location','experience+location'], ['real photos','reviews','amenity clarity'], ['availability and booking path'], ['traffic','conversion_rate','revenue_attributed']),
  ecommerce_light: recipe(['shopper by use case problem and product category'], ['specialist','trust','convenience'], ['product','bundle','repeat purchase'], ['SEO','content','organic social','email','referrals'], ['product','category','comparison','use case'], ['reviews','product proof','delivery clarity'], ['product page','cart','checkout'], ['conversion_rate','customer_acquisition_cost','revenue_attributed'])
});

export function getGtmRecipe(name) {
  const key = clean(name, 80);
  const found = RECIPES[key];
  if (!found) return { ok: false, error: 'GTM_RECIPE_NOT_FOUND', available: Object.keys(RECIPES) };
  return { ok: true, recipe: { schema: 'riosystems.gtm-recipe.v1', recipe_id: key, ...clone(found), evidence_state: 'ASSUMED', source: 'deterministic_recipe_heuristic', requires_business_customization: true } };
}

export function compileGtmRecipe(input = {}) {
  const text = clean(input.request, 500).toLowerCase();
  let id = input.recipe_id;
  if (!id) {
    if (/bäckerei|reinigung|handwerk|lokal|local service|dienstleistung/.test(text)) id = 'local_service';
    else if (/restaurant|gastronomie|cafe|café/.test(text)) id = 'restaurant';
    else if (/consult|beratung/.test(text)) id = 'consulting';
    else if (/agentur|agency/.test(text)) id = 'agency';
    else if (/immobil|real estate/.test(text)) id = 'real_estate';
    else if (/saas|software/.test(text)) id = 'SaaS';
    else if (/hotel|hospitality|unterkunft/.test(text)) id = 'hospitality';
    else if (/shop|ecommerce|e-commerce/.test(text)) id = 'ecommerce_light';
    else id = 'professional_services';
  }
  const found = getGtmRecipe(id);
  if (!found.ok) return found;
  return { ok: true, strategy_seed: { ...found.recipe, customization: { project_id: clean(input.project_id, 80), business: clean(input.business, 160), industry: clean(input.industry, 120), geography: clone(input.geography || null), constraints: clone(input.constraints || []) } } };
}
