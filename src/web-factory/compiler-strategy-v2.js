import { slugifyProject, validateWebsiteMission } from './contracts.js';
import { getIndustryPattern } from './industry-brain.js';

const arr = (v) => Array.isArray(v) ? v : [];
const uniq = (v) => [...new Set(arr(v).filter(Boolean))];
const text = (v, max = 800) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const RECIPE_LIBRARY = Object.freeze({
  local_business: { match:/local|bakery|bäckerei|handwerk|plumber|electric|cleaning|local service/i, pages:['home','services','about','contact','faq'], trust:['local_presence','reviews','service_area','contact_data'], ctas:['contact','call','quote'], seo:['service + location','brand + location'], warnings:['Do not invent reviews, opening hours, addresses or service areas.'] },
  consulting: { match:/consult|beratung|advisory/i, pages:['home','services','about','insights','contact','faq'], trust:['expertise','methodology','case_evidence','testimonials_if_supplied'], ctas:['discovery_call','qualified_enquiry'], seo:['service expertise','industry problem intent'], warnings:['Do not fabricate client logos, case results or credentials.'] },
  agency: { match:/agency|agentur|studio/i, pages:['home','services','work','about','contact','faq'], trust:['portfolio','process','team','case_evidence'], ctas:['project_enquiry','discovery_call'], seo:['service + market','capability themes'], warnings:['Portfolio work must have explicit rights and provenance.'] },
  restaurant: { match:/restaurant|cafe|café|food|bistro/i, pages:['home','menu','about','gallery','contact','faq'], trust:['reviews_if_supplied','location','opening_hours_if_supplied','food_imagery'], ctas:['booking','call','directions'], seo:['cuisine + location','restaurant + location'], warnings:['Menu, prices and opening hours must come from supplied data.'] },
  hospitality: { match:/hotel|hospitality|resort|guesthouse/i, pages:['home','stay','experience','gallery','contact','faq'], trust:['reviews_if_supplied','location','amenities','policies'], ctas:['booking','availability'], seo:['stay + location','experience + location'], warnings:['Do not invent availability, amenities or policy details.'] },
  real_estate: { match:/real estate|immobil|realtor/i, pages:['home','services','properties','about','contact','faq'], trust:['local_expertise','listings_if_supplied','credentials','reviews_if_supplied'], ctas:['valuation','viewing','contact'], seo:['property service + location','valuation intent'], warnings:['Listings and market claims must be sourced.'] },
  dentist: { match:/dentist|dental|zahnarzt/i, pages:['home','services','team','contact','faq'], trust:['qualifications','clinic_information','reviews_if_supplied','contact_data'], ctas:['appointment','phone'], seo:['treatment + location','dentist + location'], warnings:['No medical outcome guarantees or invented qualifications.'] },
  law_firm: { match:/law|legal|anwalt|kanzlei/i, pages:['home','services','about','contact','faq'], trust:['credentials','scope','privacy','experience_if_supplied'], ctas:['consultation','phone'], seo:['practice area + location','legal service intent'], warnings:['No guaranteed legal outcomes or invented case results.'] },
  fitness: { match:/fitness|gym|training|coach/i, pages:['home','programs','about','contact','faq'], trust:['coach_credentials','testimonials_if_supplied','program_clarity','location'], ctas:['trial','consultation'], seo:['program + location','fitness goal intent'], warnings:['No unsupported health or transformation claims.'] },
  ecommerce: { match:/ecommerce|e-commerce|shop|retail/i, pages:['home','shop','about','contact','faq'], trust:['shipping','returns','reviews_if_supplied','checkout_security_intent'], ctas:['shop','product_view'], seo:['category intent','product intent'], warnings:['Prices, stock, shipping and returns require authoritative commerce data.'] },
  saas: { match:/saas|software|platform|app\b/i, pages:['home','product','pricing','security','contact','faq'], trust:['product_proof','security','customer_logos_if_supplied','use_cases'], ctas:['demo','trial'], seo:['product category','use-case intent'], warnings:['Do not invent customers, certifications, uptime or security claims.'] },
  professional_services: { match:/professional|accounting|finance|engineering|architecture|architect|tax|steuer/i, pages:['home','services','about','projects','contact','faq'], trust:['credentials','methodology','project_evidence','team'], ctas:['enquiry','consultation'], seo:['professional service','expertise + location'], warnings:['Credentials and project evidence must be supplied or explicitly marked placeholders.'] }
});

function detectRecipe(industry = '') {
  const source = text(industry, 200);
  for (const [key, recipe] of Object.entries(RECIPE_LIBRARY)) if (recipe.match.test(source)) return key;
  return 'professional_services';
}

export function getWebsiteRecipe(industry = '') {
  const key = detectRecipe(industry);
  const recipe = RECIPE_LIBRARY[key];
  const legacy = getIndustryPattern(industry);
  return {
    schema:'riosystems.website-recipe.v2', recipe_id:key,
    recommended_pages:uniq([...recipe.pages,...(legacy.recommended_pages || [])]),
    content_patterns:uniq([...(legacy.content_blocks || []),'value_proposition','proof','objection_handling','conversion_cta']),
    trust_patterns:uniq([...recipe.trust,...(legacy.trust_patterns || [])]),
    CTA_patterns:uniq([...recipe.ctas,...(legacy.cta_patterns || [])]),
    SEO_topics:uniq([...recipe.seo,`${text(industry,120)} intent`]),
    conversion_patterns:uniq(legacy.conversion_goals || ['qualified_enquiry']),
    common_FAQs:uniq(legacy.common_faqs || []),
    industry_warnings:[...recipe.warnings],
    provider_neutral:true,
    hardcoded_UI:false
  };
}

function detectIndustry(request = '') {
  const q = text(request, 2000).toLowerCase();
  const candidates = [
    ['consulting',/consult|beratung|unternehmensberatung|advisory/],['agency',/agency|agentur/],['restaurant',/restaurant|cafe|café|bistro/],
    ['hospitality',/hotel|hospitality|resort/],['real estate',/real estate|immobil/],['dentist',/dentist|dental|zahnarzt/],
    ['law firm',/law firm|legal|kanzlei|anwalt/],['fitness',/fitness|gym|coach/],['ecommerce',/ecommerce|e-commerce|shop/],['SaaS',/saas|software platform|software/],
    ['professional services',/architecture|architect|accounting|engineering|professional service/],['local services',/local business|lokal|bäckerei|bakery|handwerk/]
  ];
  return candidates.find(([,rx]) => rx.test(q))?.[0] || 'professional services';
}

function detectBusinessName(request = '', explicit = '') {
  if (text(explicit, 200)) return text(explicit, 200);
  const q = text(request, 2000);
  const matches = [q.match(/(?:für|for)\s+([A-ZÄÖÜ][\p{L}0-9&.-]+(?:\s+[A-ZÄÖÜ][\p{L}0-9&.-]+){0,3})/u), q.match(/(?:website|site)\s+(?:for|für)\s+([^,.]+)/i)];
  return text(matches.find(Boolean)?.[1] || '', 200);
}

function detectLanguages(request = '', explicit = []) {
  const q = text(request, 2000).toLowerCase();
  const found = [];
  const map = [['de',/deutsch|german/],['en',/englisch|english/],['fr',/französisch|french/],['it',/italienisch|italian/]];
  for (const [code,rx] of map) if (rx.test(q)) found.push(code);
  return uniq([...arr(explicit),...found]).length ? uniq([...arr(explicit),...found]) : ['de'];
}

function detectPageCount(request = '') {
  const q = text(request, 1000).toLowerCase();
  const m = q.match(/(\d{1,2})\s*(?:seiten|pages)/);
  return m ? Math.min(20, Math.max(1, Number(m[1]))) : null;
}

export function compileWebsiteRequest(request, context = {}) {
  const prompt = text(request, 6000);
  const industry = text(context.industry, 200) || detectIndustry(prompt);
  const businessName = detectBusinessName(prompt, context.business_name);
  const recipe = getWebsiteRecipe(industry);
  const languages = detectLanguages(prompt, context.languages || context.localization?.languages);
  const pageCount = detectPageCount(prompt);
  const premium = /premium|hochwertig|high[- ]?end|luxur/i.test(prompt);
  const highFidelity = /high[_ -]?fidelity|sehr nah|pixel/i.test(prompt);
  const contactForm = /kontaktformular|contact form|lead form/i.test(prompt);
  const crm = /crm|lead/i.test(prompt);
  const useFramer = /framer/i.test(prompt);
  const useWebflow = /webflow|complex cms|komplex.*cms/i.test(prompt);
  const useLovable = /lovable|rapid prototype|prototype/i.test(prompt);
  const requiredPages = pageCount ? recipe.recommended_pages.slice(0, pageCount) : recipe.recommended_pages;
  const missionCandidate = {
    business_name:businessName,
    project_slug:slugifyProject(context.project_id || businessName),
    industry,
    primary_goal:text(context.website_goal,300) || (/lead/i.test(prompt) ? 'Generate qualified leads' : 'Create a clear conversion-focused website'),
    services:arr(context.services).length ? context.services : ['Primary offer'],
    target_audience:text(context.target_audience,500) || 'Prospective customers evaluating the business',
    conversion_goal:text(context.primary_conversion,300) || (crm ? 'Generate qualified enquiries' : 'Drive the primary customer action'),
    required_pages:requiredPages,
    required_features:uniq([...(contactForm ? ['contact_form'] : []),...(crm ? ['lead_capture'] : [])]),
    existing_brand:context.brand_inputs || context.existing_brand || null,
    visual_references:arr(context.visual_references),
    competitor_references:arr(context.competitor_references),
    localization:{ primary_language:languages[0], languages, currency:context.currency || 'EUR' },
    integration_requirements:crm ? { crm:'business-factory', automation:'automation-factory', analytics:'posthog' } : (context.business_integrations || {}),
    quality_level:highFidelity ? 'HIGH_FIDELITY' : premium ? 'PREMIUM' : 'STANDARD',
    provider_preferences:{ ...(context.provider_preferences || {}), ...(useFramer ? {design_provider:'framer'}:{}), ...(useWebflow ? {cms_provider:'webflow'}:{}), ...(useLovable ? {prototype_provider:'lovable'}:{}) },
    synthetic_test_data_only:context.synthetic_test_data_only === true
  };
  const validation = validateWebsiteMission(missionCandidate);
  return {
    schema:'riosystems.natural-language-website-compiler.v2',
    status:validation.ok ? 'COMPILED' : 'REQUIREMENTS_REQUIRED',
    source_request:prompt,
    project_id:validation.mission.project_slug,
    business:businessName || null,
    industry,
    website_goal:missionCandidate.primary_goal,
    target_audience:missionCandidate.target_audience,
    conversion_goals:[missionCandidate.conversion_goal],
    required_pages:requiredPages,
    optional_pages:recipe.recommended_pages.filter((p) => !requiredPages.includes(p)),
    brand_inputs:missionCandidate.existing_brand,
    visual_references:missionCandidate.visual_references,
    competitor_references:missionCandidate.competitor_references,
    content_requirements:{ structured:true, ai_factory_handoff_allowed:true, fabricated_claims_allowed:false },
    SEO_requirements:{ topics:recipe.SEO_topics, local_intent:/local|bakery|bäckerei|restaurant|dentist|real estate/i.test(industry) },
    localization:missionCandidate.localization,
    business_integrations:missionCandidate.integration_requirements,
    quality_level:missionCandidate.quality_level,
    provider_preferences:missionCandidate.provider_preferences,
    cost_class:'ZERO_COST_DEVELOPMENT',
    deployment_requirements:{ environment:'preview', production:false, preferred_hosting:'cloudflare', custom_domain:false, dns_changes:false },
    compiled_mission:validation.mission,
    requirements:validation.requirements,
    provider_coupling:false
  };
}

export function createWebsiteStrategy(mission = {}) {
  const recipe = getWebsiteRecipe(mission.industry);
  const goal = text(mission.primary_goal,400);
  const local = recipe.recipe_id === 'local_business' || ['restaurant','dentist','real_estate','hospitality'].includes(recipe.recipe_id);
  const saas = recipe.recipe_id === 'saas';
  return {
    schema:'riosystems.website-strategy.v2',
    website_role:local ? 'local trust and conversion hub' : saas ? 'product education and acquisition surface' : 'authority, understanding and lead generation surface',
    primary_goal:goal,
    secondary_goals:local ? ['build trust','make contact effortless','support local discovery'] : ['build authority','reduce objections','support evaluation'],
    target_audience:mission.target_audience,
    primary_conversion:mission.conversion_goal,
    secondary_conversion:local ? 'phone_or_email_contact' : saas ? 'product_evaluation' : 'deeper_service_evaluation',
    trust_requirements:recipe.trust_patterns,
    content_priorities:recipe.content_patterns,
    recommended_pages:uniq([...(mission.required_pages || []),...recipe.recommended_pages]),
    industry_warnings:recipe.industry_warnings,
    no_fabricated_trust:true
  };
}

export function createInformationArchitecture(strategy = {}, mission = {}) {
  const pages = uniq(strategy.recommended_pages || mission.required_pages || ['home','services','about','contact','faq']);
  const normalized = pages.map((id,index) => ({ page_id:id, path:id === 'home' ? '/' : `/${id}/`, parent:null, depth:1, order:index }));
  const nav = normalized.filter((p) => !['privacy','legal-notice'].includes(p.page_id)).map((p) => ({ page_id:p.page_id, path:p.path }));
  const footer = { primary:nav.map((p) => p.page_id), utility:uniq(['privacy','legal-notice'].filter((id) => pages.includes(id))), contact_required:true };
  const internalLinks = normalized.flatMap((page) => page.page_id === 'home'
    ? normalized.filter((p) => p.page_id !== 'home').map((target) => ({ from:page.page_id, to:target.page_id, intent:'discover' }))
    : [{ from:page.page_id, to:'contact', intent:'convert' },{ from:page.page_id, to:'home', intent:'orient' }].filter((l) => pages.includes(l.to)));
  const inbound = new Map(pages.map((p) => [p,0]));
  for (const link of internalLinks) inbound.set(link.to,(inbound.get(link.to) || 0)+1);
  const orphanPages = pages.filter((p) => p !== 'home' && (inbound.get(p) || 0) === 0 && !nav.some((n) => n.page_id === p));
  const deadEnds = pages.filter((p) => !internalLinks.some((l) => l.from === p) && p !== 'contact');
  return {
    schema:'riosystems.information-architecture.v2', site_map:normalized, page_hierarchy:normalized,
    navigation:nav, footer_structure:footer, internal_links:internalLinks,
    conversion_paths:[{ id:'primary', steps:['home','understand_offer','trust','evaluate','contact'].filter(Boolean), target:mission.conversion_goal || strategy.primary_conversion }],
    diagnostics:{ orphan_pages:orphanPages, navigation_depth:Math.max(...normalized.map((p) => p.depth),1), duplicate_pages:pages.filter((p,i) => pages.indexOf(p)!==i), dead_end_journeys:deadEnds },
    status:orphanPages.length || deadEnds.length ? 'WARN' : 'PASS'
  };
}

export function createUserJourneys(strategy = {}, mission = {}) {
  const audience = mission.target_audience || strategy.target_audience || 'prospective customer';
  return {
    schema:'riosystems.user-journey-plan.v2',
    journeys:[{
      journey_id:'primary-evaluation', audience, entry_point:'home_or_search_landing',
      questions:['What is offered?','Is this relevant to me?','Can I trust this business?','What happens next?'],
      objections:['unclear fit','insufficient proof','unclear process','contact friction'],
      trust_requirements:strategy.trust_requirements || [],
      CTA_path:['understand_offer','review_proof','resolve_objections','primary_conversion'],
      desired_outcome:strategy.primary_conversion || mission.conversion_goal
    }]
  };
}

export function createPageIntentContracts(architecture = {}, strategy = {}, mission = {}) {
  const pages = architecture.site_map || [];
  return {
    schema:'riosystems.page-intent-collection.v2',
    pages:pages.map((page) => {
      const id = page.page_id;
      const contact = id === 'contact';
      const faq = id === 'faq';
      const home = id === 'home';
      return {
        page_id:id,
        page_type:id,
        goal:contact ? 'convert with low friction' : faq ? 'resolve objections' : home ? 'orient, build trust and route to conversion' : `support evaluation of ${id}`,
        audience:mission.target_audience,
        primary_message:home ? mission.brand_positioning || mission.primary_goal : `${id} information supporting ${strategy.primary_goal || mission.primary_goal}`,
        primary_CTA:contact ? 'submit_enquiry' : faq ? 'contact' : strategy.primary_conversion || mission.conversion_goal,
        secondary_CTA:contact ? 'phone_or_email' : 'learn_more',
        required_sections:home ? ['hero','proof','services','process','faq','cta'] : contact ? ['hero','form','contact_options'] : faq ? ['hero','faq','cta'] : ['hero',id,'proof','cta'],
        SEO_intent:`${id} | ${mission.industry} | ${mission.seo_location || mission.country || ''}`,
        conversion_role:contact ? 'primary_conversion' : home ? 'journey_entry' : faq ? 'objection_resolution' : 'evaluation'
      };
    }),
    decorative_pages_allowed:false
  };
}

export function createProposalMode(input = {}) {
  const compiled = input.compiled || compileWebsiteRequest(input.request || '', input.context || {});
  if (compiled.status !== 'COMPILED') return { schema:'riosystems.website-proposal.v2', status:'REQUIREMENTS_REQUIRED', requirements:compiled.requirements, production:false };
  const strategy = createWebsiteStrategy(compiled.compiled_mission);
  const architecture = createInformationArchitecture(strategy, compiled.compiled_mission);
  return {
    schema:'riosystems.website-proposal.v2', status:'READY', project_id:compiled.project_id,
    proposed_site_plan:architecture.site_map,
    design_direction:compiled.quality_level === 'STANDARD' ? 'clear native design system' : 'premium provider-neutral design intent',
    page_list:architecture.site_map.map((p) => p.page_id),
    estimated_complexity:architecture.site_map.length > 8 ? 'HIGH' : architecture.site_map.length > 5 ? 'MEDIUM' : 'LOW',
    provider_route_hint:compiled.provider_preferences,
    cost_class:compiled.cost_class,
    build_executed:false,
    production:false
  };
}
