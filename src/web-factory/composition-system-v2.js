const arr = (v) => Array.isArray(v) ? v : [];
const uniq = (v) => [...new Set(arr(v).filter(Boolean))];
const text = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const clone = (v) => v == null ? v : structuredClone(v);

const SYSTEM_FONTS = ['system-ui','ui-sans-serif','ui-serif','sans-serif','serif','monospace'];

export const CANONICAL_WEB_COMPONENTS = Object.freeze([
  'header','navigation','hero','section','cta','button','card','feature','testimonial','logo_cloud','stats','pricing','faq','form','contact','footer','media','gallery','comparison','team','process','timeline'
]);

export const COMPONENT_VARIANTS = Object.freeze({
  hero:['centered','split','visual-heavy','minimal','editorial'],
  cta:['primary','secondary','inline','sticky'],
  card:['flat','bordered','elevated','editorial'],
  navigation:['standard','compact','transparent','sticky'],
  section:['contained','full-width','split','editorial'],
  media:['image','video-placeholder','gallery'],
  form:['contact','lead-capture','booking-request','multi-step-contract-only']
});

function safePalette(colors = {}) {
  return {
    background:text(colors.background || colors.bg || '#f7f7f4',40), surface:text(colors.surface || '#ffffff',40),
    text:text(colors.text || '#171717',40), muted:text(colors.muted || '#646464',40), accent:text(colors.accent || colors.primary || '#24403a',40),
    accent_text:text(colors.accent_text || '#ffffff',40), border:text(colors.border || '#deded8',40)
  };
}

export function createBrandWebsiteDirection(mission = {}, operator = {}) {
  const brand = mission.existing_brand || operator.brand || {};
  const tone = text(operator.tone || brand.tone || mission.tone || 'clear, trustworthy, modern',300);
  const positioning = text(mission.brand_positioning || brand.description || mission.primary_goal,700);
  const premium = ['PREMIUM','HIGH_FIDELITY'].includes(String(mission.quality_level || operator.quality_level || '').toUpperCase());
  return {
    schema:'riosystems.brand-to-website.v2', project_id:mission.project_slug,
    design_direction:premium ? `premium, restrained, ${tone}` : `clear, scalable, ${tone}`,
    typography_direction:text(brand.typography_character || (premium ? 'editorial headings with highly readable body typography' : 'neutral readable system typography'),500),
    color_system:safePalette(brand.colors || {}),
    image_direction:text(brand.image_direction || 'authentic project-owned imagery; no unlicensed stock or copied competitor assets',500),
    component_style:premium ? 'calm geometry, consistent radii, deliberate whitespace' : 'simple repeatable geometry and clear hierarchy',
    section_style:premium ? 'low-to-medium density with strong hierarchy and proof' : 'contained sections with predictable rhythm',
    motion_style:premium ? 'subtle purposeful transitions with reduced-motion fallback' : 'minimal motion only when it clarifies interaction',
    positioning, audience:mission.target_audience,
    source_assets:arr(brand.assets), provider_neutral:true
  };
}

export function generateDesignSystemV2(brandDirection = {}, designIntent = {}, qualityLevel = 'STANDARD') {
  const intent = designIntent.intent || designIntent || {};
  const palette = safePalette({ ...(brandDirection.color_system || {}), ...(intent.color_palette || {}) });
  const premium = ['PREMIUM','HIGH_FIDELITY'].includes(String(qualityLevel).toUpperCase());
  return {
    schema:'riosystems.web-design-system.v2', version:'2.0.0',
    design_tokens:{
      colors:palette,
      typography:{
        roles:{ display:'heading', heading:'heading', body:'body', meta:'body' },
        heading_family:text(intent.typography_character?.includes('editorial') ? 'ui-serif, serif' : 'system-ui, sans-serif',120),
        body_family:'system-ui, sans-serif',
        heading_scale:intent.heading_scale || { h1:'clamp(2.5rem,6vw,5.5rem)', h2:'clamp(2rem,4vw,3.5rem)', h3:'clamp(1.4rem,2vw,2rem)' },
        body_scale:intent.body_scale || { lg:'1.125rem', md:'1rem', sm:'0.875rem' },
        line_height:{ heading:1.08, body:1.65 }, tracking:{ heading:'-0.02em', body:'0em' }, measure:{ body:'68ch', display:'18ch' }, responsive_scaling:true
      },
      spacing:{ xs:'0.5rem', sm:'0.75rem', md:'1rem', lg:'1.5rem', xl:'2rem', section:intent.spacing_rhythm?.section || (premium ? 'clamp(4rem,9vw,8rem)' : 'clamp(3rem,7vw,6rem)') },
      radii:{ sm:'0.375rem', md:intent.card_geometry?.radius || (premium ? '0.5rem' : '0.75rem'), lg:'1rem', pill:'999px' },
      borders:{ subtle:`1px solid ${palette.border}` },
      shadows:{ card:intent.shadows?.card || '0 16px 48px rgba(0,0,0,.08)' },
      containers:{ content:intent.containers?.content || '76rem', narrow:intent.containers?.narrow || '48rem', gutter:'clamp(1rem,3vw,2rem)' },
      breakpoints:{ mobile:480, tablet:768, desktop:1200 },
      motion:{ fast:'160ms', normal:'240ms', slow:'420ms', easing:'cubic-bezier(.2,.8,.2,1)', reduced_motion:'disable-nonessential' }
    },
    component_variants:clone(COMPONENT_VARIANTS), reproducible:true, provider_neutral:true
  };
}

function hexRgb(hex) {
  const h = String(hex || '').replace('#','');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0,2,4].map((i) => parseInt(h.slice(i,i+2),16)/255).map((c) => c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4);
}
function contrast(a,b) {
  const A=hexRgb(a), B=hexRgb(b); if (!A || !B) return null;
  const lum=(v)=>.2126*v[0]+.7152*v[1]+.0722*v[2]; const l1=lum(A),l2=lum(B); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}

export function validateDesignTokens(system = {}) {
  const t = system.design_tokens || {};
  const issues=[]; const warnings=[];
  const ratio=contrast(t.colors?.text,t.colors?.background);
  if (ratio != null && ratio < 4.5) issues.push({ code:'LOW_TEXT_CONTRAST', ratio:Math.round(ratio*100)/100, repair:'use a higher-contrast text/background token pair' });
  for (const [name,value] of Object.entries(t.spacing || {})) if (typeof value !== 'string') issues.push({ code:'INVALID_SPACING_TOKEN', token:name });
  const roles=Object.values(t.typography?.roles || {}); if (roles.length && new Set(roles).size < 2) warnings.push({ code:'TYPOGRAPHY_ROLES_COLLAPSED' });
  if (String(t.spacing?.section || '').includes('20rem')) warnings.push({ code:'EXTREME_SECTION_SPACING' });
  if (!t.breakpoints?.mobile || !t.breakpoints?.tablet || !t.breakpoints?.desktop) issues.push({ code:'BREAKPOINTS_INCOMPLETE' });
  return { schema:'riosystems.design-token-validation.v2', status:issues.length ? 'BLOCK' : warnings.length ? 'WARN' : 'PASS', issues, warnings, verified:true };
}

export function createTypographyContract(designSystem = {}) {
  const t=designSystem.design_tokens?.typography || {};
  return { schema:'riosystems.typography-contract.v2', font_roles:t.roles || {}, heading_hierarchy:t.heading_scale || {}, body_hierarchy:t.body_scale || {}, line_height:t.line_height || {}, tracking:t.tracking || {}, measure:t.measure || {}, responsive_scaling:t.responsive_scaling === true, random_component_font_sizes_allowed:false };
}

export function createLayoutContract(designSystem = {}) {
  const t=designSystem.design_tokens || {};
  return { schema:'riosystems.layout-contract.v2', containers:t.containers, breakpoints:t.breakpoints, supported_layouts:['container','grid','stack','split','feature_grid','card_grid','editorial','full_width_section'], constraints:{ max_content_width:t.containers?.content, mobile_grid_columns:1, tablet_grid_columns:2, desktop_grid_columns:12, horizontal_overflow_allowed:false } };
}

export function componentSystemManifest() {
  return { schema:'riosystems.component-system.v2', canonical_components:[...CANONICAL_WEB_COMPONENTS], variants:clone(COMPONENT_VARIANTS), provider_neutral:true, copy_paste_component_flood_allowed:false };
}

export function validateComponentSpec(component = {}, designSystem = {}) {
  const issues=[]; const name=text(component.component || component.type,100).toLowerCase();
  if (!CANONICAL_WEB_COMPONENTS.includes(name)) issues.push({ code:'UNKNOWN_COMPONENT', component:name });
  if (component.variant && COMPONENT_VARIANTS[name] && !COMPONENT_VARIANTS[name].includes(component.variant)) issues.push({ code:'UNKNOWN_VARIANT', component:name, variant:component.variant });
  if (component.inline_style === true) issues.push({ code:'TOKEN_BYPASS', component:name });
  if (component.semantic_intent === false) issues.push({ code:'SEMANTIC_INTENT_MISSING', component:name });
  if (component.responsive === false) issues.push({ code:'RESPONSIVE_BEHAVIOR_MISSING', component:name });
  if (component.accessible === false) issues.push({ code:'ACCESSIBILITY_INTENT_MISSING', component:name });
  if (component.content_overflow === true) issues.push({ code:'CONTENT_OVERFLOW', component:name });
  return { schema:'riosystems.component-quality.v2', component:name, status:issues.length ? 'BLOCK' : 'PASS', issues, design_token_usage_required:Boolean(designSystem.design_tokens) };
}

export function createStructuredContentContract(pageIntent = {}, supplied = {}) {
  return {
    schema:'riosystems.page-content-contract.v2', page_id:pageIntent.page_id,
    headline:text(supplied.headline || pageIntent.primary_message,240),
    subheadline:text(supplied.subheadline || '',400), body:text(supplied.body || '',2000),
    proof:arr(supplied.proof).map((p) => ({ type:text(p.type || 'proof',80), value:text(p.value || p,600), verified:p.verified === true })),
    CTA:{ primary:text(supplied.primary_CTA || pageIntent.primary_CTA,160), secondary:text(supplied.secondary_CTA || pageIntent.secondary_CTA,160) },
    FAQ:arr(supplied.FAQ || supplied.faq),
    metadata:{ title:text(supplied.metadata?.title || '',200), description:text(supplied.metadata?.description || '',320) },
    meaning_separated_from_presentation:true
  };
}

export function planPageContent(pageIntent = {}, recipe = {}, supplied = {}) {
  return {
    schema:'riosystems.content-plan.v2', page_id:pageIntent.page_id,
    message_hierarchy:[pageIntent.primary_message,'proof','details','objection_handling','CTA'],
    section_order:uniq(pageIntent.required_sections || ['hero','proof','cta']),
    content_purpose:pageIntent.goal,
    proof_requirements:recipe.trust_patterns || [],
    objections:pageIntent.page_type === 'faq' ? ['all_known_objections'] : ['fit','trust','process','next_step'],
    CTA_placement:['hero_or_intro','after_proof','end_of_page'],
    supplied_content_keys:Object.keys(supplied || {})
  };
}

export function createAiContentRequest(mission = {}, pageIntents = [], plans = []) {
  return {
    schema:'riosystems.ai-content-request.v1', target_factory:'ai-factory', execution_owner:'ai-factory',
    project_id:mission.project_slug, language:mission.language, tone:mission.tone, audience:mission.target_audience, positioning:mission.brand_positioning,
    pages:arr(pageIntents).map((page) => ({ page_id:page.page_id, goal:page.goal, primary_message:page.primary_message, required_sections:page.required_sections, content_plan:arr(plans).find((p) => p.page_id === page.page_id) || null })),
    expected_output_schema:'riosystems.structured-web-content-blocks.v1', fabricated_claims_allowed:false, external_execution:false, variable_cost_eur:0
  };
}

export function checkBrandVoice(contentBlocks = [], mission = {}, rules = {}) {
  const forbidden=arr(rules.forbidden_phrases || mission.existing_brand?.forbidden_phrases).map((x)=>String(x).toLowerCase());
  const violations=[];
  for (const block of arr(contentBlocks)) {
    const corpus=JSON.stringify(block).toLowerCase();
    for (const phrase of forbidden) if (phrase && corpus.includes(phrase)) violations.push({ page_id:block.page_id, code:'FORBIDDEN_PHRASE', phrase });
  }
  return { schema:'riosystems.brand-voice-check.v2', status:violations.length ? 'BLOCK' : 'PASS', tone:mission.tone, audience:mission.target_audience, positioning:mission.brand_positioning, terminology:arr(rules.terminology), violations, verified_from_structured_content:true };
}

export function checkContentConsistency(contentBlocks = [], canonical = {}) {
  const fields=['business_name','phone','email','pricing_reference']; const inconsistencies=[];
  for (const field of fields) {
    const values=uniq(arr(contentBlocks).map((b)=>b?.facts?.[field]).filter(Boolean));
    if (canonical[field]) values.push(canonical[field]);
    if (uniq(values).length > 1) inconsistencies.push({ code:'INCONSISTENT_FACT', field, values:uniq(values) });
  }
  return { schema:'riosystems.content-consistency.v2', status:inconsistencies.length ? 'BLOCK' : 'PASS', checks:['product_names','service_names','pricing_references','claims','terminology','tone','contact_information'], inconsistencies };
}

export function createTrustPlan(recipe = {}, suppliedEvidence = {}) {
  const available=new Set(arr(suppliedEvidence.available || suppliedEvidence));
  return {
    schema:'riosystems.trust-plan.v2',
    recommended:arr(recipe.trust_patterns).map((pattern)=>({ pattern, evidence_available:available.has(pattern), action:available.has(pattern) ? 'USE_VERIFIED' : 'REQUEST_OR_OMIT' })),
    fabricated_trust_signals_allowed:false
  };
}

export function createFormContract(input = {}) {
  const rawFields=arr(input.fields).length ? input.fields : [{id:'name',type:'text',required:true},{id:'email',type:'email',required:true},{id:'message',type:'textarea',required:true}];
  const fields=rawFields.map((f)=>({ id:text(f.id,80), type:text(f.type || 'text',60), required:f.required === true, validation:f.validation || (f.type === 'email' ? 'email_format' : 'nonempty_if_required'), pii:['name','email','phone','message'].includes(String(f.id)) }));
  return {
    schema:'riosystems.web-form-contract.v2', form_id:text(input.form_id || 'contact-form',120), goal:text(input.goal || 'qualified enquiry',300), fields,
    required_fields:fields.filter((f)=>f.required).map((f)=>f.id), consent:{ required:Boolean(input.consent_required), purpose:text(input.consent_purpose || 'project-specific consent rules supplied by operator',300) },
    destination_event:text(input.destination_event || 'website.form_submitted',120), success_state:'confirmed_without_leaking_submitted_data', error_state:'field_level_errors_and_retry',
    minimization:{ unnecessary_fields_forbidden:true, field_count:fields.length }, provider_neutral:true
  };
}

export function composePageModel(pageIntent = {}, content = {}, designSystem = {}, contentPlan = {}) {
  const sections=arr(contentPlan.section_order || pageIntent.required_sections).map((type,index)=>({
    section_id:`${pageIntent.page_id}-${type}-${index+1}`, type,
    component:type === 'hero' ? 'hero' : type === 'faq' ? 'faq' : type === 'form' ? 'form' : type === 'cta' ? 'cta' : type === 'proof' ? 'testimonial' : 'section',
    variant:type === 'hero' ? 'editorial' : type === 'cta' ? 'primary' : 'contained',
    content_ref:`content:${pageIntent.page_id}:${type}`, design_token_ref:'riosystems.web-design-system.v2', semantic_intent:true, responsive:true, accessible:true
  }));
  return { schema:'riosystems.page-composition.v2', page_id:pageIntent.page_id, goal:pageIntent.goal, sections, content, design_system_version:designSystem.version || '2.0.0', planned_before_render:true };
}
