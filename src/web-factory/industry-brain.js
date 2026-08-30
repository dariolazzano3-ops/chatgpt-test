const DEFAULT = {
  pattern_id: 'general-service-business',
  recommended_pages: ['home','services','about','contact','faq'],
  trust_patterns: ['clear_credentials','specific_process','social_proof','transparent_contact'],
  cta_patterns: ['primary_enquiry','contact'],
  content_blocks: ['value_proposition','services','proof','process','faq','cta'],
  common_faqs: ['What do you offer?','How does the process work?','How can I get started?'],
  conversion_goals: ['qualified_enquiry'],
  lead_types: ['contact_request']
};

const PATTERNS = {
  restaurant: { recommended_pages:['home','menu','about','contact','faq'], trust_patterns:['reviews','location','opening_hours','food_imagery'], cta_patterns:['booking','call','directions'], content_blocks:['hero','menu_highlights','reviews','location','faq'], common_faqs:['Do you take reservations?','What are your opening hours?','Do you support dietary requirements?'], conversion_goals:['booking','phone_call'], lead_types:['booking_request'] },
  'law firm': { recommended_pages:['home','services','about','contact','faq'], trust_patterns:['credentials','case_experience','privacy','clear_scope'], cta_patterns:['consultation','phone'], content_blocks:['practice_areas','credentials','process','faq','consultation_cta'], common_faqs:['What matters can you advise on?','What happens in the first consultation?','What information should I prepare?'], conversion_goals:['consultation_request'], lead_types:['legal_enquiry'] },
  dentist: { recommended_pages:['home','services','team','contact','faq'], trust_patterns:['qualifications','reviews','clinic_information','emergency_contact'], cta_patterns:['booking','phone'], content_blocks:['treatments','team','reviews','faq','booking_cta'], common_faqs:['How can I book?','Do you accept new patients?','What should I bring?'], conversion_goals:['appointment_request'], lead_types:['patient_enquiry'] },
  consulting: { recommended_pages:['home','services','about','insights','contact','faq'], trust_patterns:['expertise','methodology','outcomes','testimonials'], cta_patterns:['discovery_call','enquiry'], content_blocks:['outcomes','services','method','proof','faq','cta'], common_faqs:['Who is this for?','How do engagements work?','What outcomes can we expect?'], conversion_goals:['qualified_enquiry'], lead_types:['consulting_lead'] },
  saas: { recommended_pages:['home','product','pricing','security','contact','faq'], trust_patterns:['product_proof','security','customer_logos','use_cases'], cta_patterns:['demo','trial'], content_blocks:['product_value','features','use_cases','proof','pricing','faq'], common_faqs:['How is pricing structured?','How is data handled?','How quickly can we start?'], conversion_goals:['demo_request','trial_start'], lead_types:['product_lead'] },
  'real estate': { recommended_pages:['home','services','properties','about','contact','faq'], trust_patterns:['local_expertise','reviews','listings','credentials'], cta_patterns:['valuation','viewing','call'], content_blocks:['local_value','properties','services','proof','faq'], common_faqs:['Which areas do you cover?','How does a valuation work?','How do I arrange a viewing?'], conversion_goals:['valuation_request','viewing_request'], lead_types:['property_lead'] },
  fitness: { recommended_pages:['home','programs','about','contact','faq'], trust_patterns:['coach_credentials','testimonials','program_clarity','location'], cta_patterns:['trial','consultation'], content_blocks:['outcomes','programs','coach','proof','faq'], common_faqs:['Who are the programs for?','Can I try a session?','What should I bring?'], conversion_goals:['trial_request'], lead_types:['fitness_lead'] },
  ecommerce: { recommended_pages:['home','shop','about','contact','faq'], trust_patterns:['shipping','returns','reviews','secure_checkout'], cta_patterns:['shop','product_view'], content_blocks:['featured_products','benefits','reviews','faq'], common_faqs:['How does shipping work?','What is the return policy?','How can I contact support?'], conversion_goals:['product_view','checkout_start'], lead_types:['commerce_interest'] },
  'local services': { recommended_pages:['home','services','about','contact','faq'], trust_patterns:['local_presence','reviews','service_area','phone'], cta_patterns:['call','quote','contact'], content_blocks:['service_area','services','proof','process','faq','contact'], common_faqs:['Which areas do you serve?','How can I request a quote?','How quickly do you respond?'], conversion_goals:['local_enquiry','phone_call'], lead_types:['local_service_lead'] },
  hospitality: { recommended_pages:['home','stay','experience','gallery','contact','faq'], trust_patterns:['reviews','location','amenities','policies'], cta_patterns:['booking','availability'], content_blocks:['experience','rooms','amenities','gallery','reviews','faq'], common_faqs:['How can I book?','What is included?','What are check-in and check-out times?'], conversion_goals:['booking_click'], lead_types:['hospitality_enquiry'] }
};

function normalizeIndustry(value = '') {
  const name = String(value).toLowerCase();
  if (/restaurant|cafe|food/.test(name)) return 'restaurant';
  if (/bakery|bäckerei|local|service|handwerk|architecture|architect/.test(name)) return 'local services';
  if (/law|legal|anwalt/.test(name)) return 'law firm';
  if (/dental|dentist|zahnarzt/.test(name)) return 'dentist';
  if (/consult/.test(name)) return 'consulting';
  if (/saas|software/.test(name)) return 'saas';
  if (/real estate|immobil/.test(name)) return 'real estate';
  if (/fitness|gym|training/.test(name)) return 'fitness';
  if (/ecommerce|e-commerce|shop|retail/.test(name)) return 'ecommerce';
  if (/hotel|hospitality|resort/.test(name)) return 'hospitality';
  return 'general';
}

export function getIndustryPattern(industry = '') {
  const key = normalizeIndustry(industry);
  const specialized = PATTERNS[key] || {};
  return {
    schema: 'riosystems.web-industry-pattern.v1', industry_key: key,
    ...structuredClone(DEFAULT), ...structuredClone(specialized),
    pattern_id: specialized.pattern_id || key,
    hardcoded_core_branching: false, extensible_pattern_layer: true
  };
}
