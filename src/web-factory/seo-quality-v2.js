const arr=(v)=>Array.isArray(v)?v:[];
const uniq=(v)=>[...new Set(arr(v).filter(Boolean))];
const text=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);

export function createSeoArchitecture(pageIntents = [], mission = {}, architecture = {}) {
  const pages=arr(pageIntents).map((page)=>({
    page_id:page.page_id,
    title:`${page.page_id === 'home' ? mission.business_name : page.page_id.replace(/-/g,' ')} | ${mission.business_name}`.slice(0,60),
    description:text(page.primary_message || page.goal,155),
    canonical_intent:page.page_id === 'home' ? '/' : `/${page.page_id}/`,
    heading_hierarchy:{ h1_count:1, ordered:true },
    indexing_rule:['privacy','legal-notice'].includes(page.page_id) ? 'operator_policy_required' : 'index_candidate',
    internal_links:arr(architecture.internal_links).filter((l)=>l.from===page.page_id),
    structured_data_intent:structuredDataTypesFor(page.page_type, mission),
    social_metadata:{ title:true, description:true, image:'asset_required_or_omit' }
  }));
  return { schema:'riosystems.seo-architecture.v2', pages, robots_intent:'staging_noindex_production_policy_separate', sitemap_intent:'generated_from_indexable_pages', provider_neutral:true };
}

function structuredDataTypesFor(pageType, mission={}) {
  const types=['Organization'];
  const local=/local|bakery|bäckerei|restaurant|dentist|real estate|hospitality/i.test(String(mission.industry||''));
  if (local) types.push('LocalBusiness');
  if (pageType==='services') types.push('Service');
  if (pageType==='product') types.push('Product');
  if (pageType==='faq') types.push('FAQ');
  if (pageType==='article'||pageType==='insights') types.push('Article');
  types.push('Breadcrumb');
  return uniq(types);
}

export function createStructuredDataContract(type, data = {}) {
  const supported=new Set(['Organization','LocalBusiness','Product','Service','FAQ','Breadcrumb','Article']);
  if (!supported.has(type)) return { schema:'riosystems.structured-data-contract.v2', status:'UNSUPPORTED', type, fields:{}, fabricated_values_allowed:false };
  const fields=Object.fromEntries(Object.entries(data).filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!==''));
  return { schema:'riosystems.structured-data-contract.v2', status:Object.keys(fields).length ? 'READY' : 'DATA_REQUIRED', type, fields, fabricated_values_allowed:false };
}

export function runTechnicalSeoQa(seo = {}, architecture = {}, options = {}) {
  const issues=[]; const titles=new Map(); const pageIds=new Set((architecture.site_map||[]).map((p)=>p.page_id));
  for (const page of arr(seo.pages)) {
    if (!page.title) issues.push({severity:'BLOCK',code:'MISSING_TITLE',page_id:page.page_id,repairable:true});
    else { const key=page.title.toLowerCase(); if (titles.has(key)) issues.push({severity:'BLOCK',code:'DUPLICATE_TITLE',page_id:page.page_id,other:titles.get(key),repairable:true}); else titles.set(key,page.page_id); }
    if (!page.description) issues.push({severity:'WARN',code:'MISSING_DESCRIPTION',page_id:page.page_id,repairable:true});
    if (page.heading_hierarchy?.h1_count !== 1) issues.push({severity:'BLOCK',code:'H1_COUNT_INVALID',page_id:page.page_id,repairable:true});
    if (!String(page.canonical_intent||'').startsWith('/')) issues.push({severity:'BLOCK',code:'BROKEN_CANONICAL_INTENT',page_id:page.page_id,repairable:true});
    for (const link of arr(page.internal_links)) if (!pageIds.has(link.to)) issues.push({severity:'BLOCK',code:'BROKEN_INTERNAL_LINK',page_id:page.page_id,target:link.to,repairable:true});
    if (options.environment==='staging' && page.indexing_rule==='force_index') issues.push({severity:'BLOCK',code:'STAGING_NOINDEX_MISTAKE',page_id:page.page_id,repairable:true});
  }
  const linked=new Set(arr(architecture.internal_links).map((l)=>l.to));
  for (const p of pageIds) if (p!=='home'&&!linked.has(p)&&!arr(architecture.navigation).some((n)=>n.page_id===p)) issues.push({severity:'WARN',code:'ORPHAN_PAGE',page_id:p,repairable:false});
  const blocking=issues.filter((i)=>i.severity==='BLOCK');
  return { schema:'riosystems.technical-seo-qa.v2', status:blocking.length?'BLOCK':issues.length?'WARN':'PASS', issues, blocking_issues:blocking, verified:true };
}

export function createLocalSeoContract(mission = {}, supplied = {}) {
  const local=/local|bakery|bäckerei|restaurant|dentist|real estate|hospitality/i.test(String(mission.industry||''));
  const fields={ name:supplied.name||mission.business_name||null, address:supplied.address||null, service_area:supplied.service_area||mission.seo_location||null, opening_hours:supplied.opening_hours||null, contact:supplied.contact||null };
  const missing=Object.entries(fields).filter(([,v])=>!v).map(([k])=>k);
  return { schema:'riosystems.local-seo-contract.v2', status:local ? (missing.length?'PARTIAL_DATA':'READY') : 'NOT_APPLICABLE', local_business:local, fields, local_pages:arr(supplied.local_pages), location_intent:local ? mission.seo_location||mission.country||null : null, missing_fields:missing, fabricated_local_data_allowed:false };
}

export function createProgrammaticSeoContract(input = {}) {
  const templates=arr(input.templates); const duplicateGuard=input.duplicate_content_guard !== false; const threshold=Number(input.quality_threshold ?? 80);
  return { schema:'riosystems.programmatic-seo-contract.v2', status:templates.length?'DRAFT':'NOT_REQUESTED', templates, allowed_page_types:['location','service','category'], duplicate_content_guard:duplicateGuard, quality_threshold:threshold, indexability_policy:'index_only_when_unique_value_and_quality_threshold_pass', thin_content_generation_allowed:false, automatic_mass_publish:false };
}

const LOCALES={de:{language:'de',prefix:'de'},en:{language:'en',prefix:'en'},fr:{language:'fr',prefix:'fr'},it:{language:'it',prefix:'it'}};
export function createLocalizationV2(mission = {}, config = {}, pageIntents = []) {
  const primary=String(config.primary_language||mission.localization?.primary_language||mission.language||'de').toLowerCase().slice(0,2);
  const languages=uniq([primary,...arr(config.languages||mission.localization?.languages)]).filter((l)=>/^[a-z]{2}$/.test(l));
  const pages=arr(pageIntents);
  const localeMappings=languages.map((locale)=>({
    locale, language:LOCALES[locale]?.language||locale,
    pages:pages.map((p)=>({ page_id:p.page_id, slug:p.page_id==='home' ? `/${locale}/` : `/${locale}/${p.page_id}/`, metadata:{ title:`${p.page_id} | ${mission.business_name}`, description:text(p.primary_message,155) }, SEO_intent:p.SEO_intent, market_context:mission.country||null, terminology:'locale-specific-approved-terminology-required' }))
  }));
  const hreflang=[];
  for (const p of pages) for (const locale of languages) hreflang.push({ page_id:p.page_id, locale, href:p.page_id==='home'?`/${locale}/`:`/${locale}/${p.page_id}/`, canonical_group:`page:${p.page_id}` });
  return { schema:'riosystems.localization-architecture.v2', primary_locale:primary, locales:languages, locale_mappings:localeMappings, hreflang_relationships:hreflang, hreflang_ready:true, translation_policy:'localized intent and terminology; not word-for-word only', currency:{ value:config.currency||mission.localization?.currency||'EUR', automatic_change:false } };
}

export function createResponsiveContract(designSystem = {}) {
  const b=designSystem.design_tokens?.breakpoints||{};
  return { schema:'riosystems.responsive-contract.v2', breakpoints:{ mobile:b.mobile||480, tablet:b.tablet||768, desktop:b.desktop||1200 }, rules:{ horizontal_overflow:false, navigation:'collapse_or_wrap', grids:{mobile:1,tablet:2,desktop:'design-dependent'}, media_max_width:'100%', touch_target_min_px:44, section_spacing:'responsive-token', text_scaling:'clamp-preferred' } };
}

export function runResponsiveQa(model = {}) {
  const issues=[];
  if (model.horizontal_overflow===true) issues.push({severity:'BLOCK',code:'HORIZONTAL_OVERFLOW',repairable:true});
  if (model.heading_overflow===true) issues.push({severity:'BLOCK',code:'OVERSIZED_HEADING',repairable:true});
  if (Number(model.mobile_grid_columns||1)>1) issues.push({severity:'BLOCK',code:'BAD_GRID_COLLAPSE',repairable:true});
  if (model.button_clipping===true) issues.push({severity:'BLOCK',code:'BUTTON_CLIPPING',repairable:true});
  if (model.navigation_overlap===true) issues.push({severity:'BLOCK',code:'NAVIGATION_OVERLAP',repairable:true});
  if (model.image_overflow===true) issues.push({severity:'BLOCK',code:'IMAGE_OVERFLOW',repairable:true});
  return { schema:'riosystems.responsive-qa.v2', status:issues.length?'BLOCK':'PASS', issues, verified_from_structured_layout:true };
}

export function repairResponsiveModel(model = {}, maxAttempts = 2) {
  const state=clone(model); const history=[]; let qa=runResponsiveQa(state);
  for (let attempt=1;attempt<=Math.min(4,Math.max(0,maxAttempts))&&qa.status!=='PASS';attempt++) {
    const before=clone(state); const applied=[];
    for (const issue of qa.issues) {
      if (issue.code==='HORIZONTAL_OVERFLOW') {state.horizontal_overflow=false;state.max_width='100%';applied.push(issue.code);}
      if (issue.code==='OVERSIZED_HEADING') {state.heading_overflow=false;state.heading_scale='clamp(2rem,8vw,4.5rem)';applied.push(issue.code);}
      if (issue.code==='BAD_GRID_COLLAPSE') {state.mobile_grid_columns=1;applied.push(issue.code);}
      if (issue.code==='BUTTON_CLIPPING') {state.button_clipping=false;state.button_max_width='100%';applied.push(issue.code);}
      if (issue.code==='NAVIGATION_OVERLAP') {state.navigation_overlap=false;state.navigation_behavior='collapse_or_wrap';applied.push(issue.code);}
      if (issue.code==='IMAGE_OVERFLOW') {state.image_overflow=false;state.media_max_width='100%';applied.push(issue.code);}
    }
    history.push({attempt,before_state:before,after_state:clone(state),applied}); qa=runResponsiveQa(state); if (!applied.length) break;
  }
  return { schema:'riosystems.responsive-repair.v2', model:state, qa, repair_history:history, attempts:history.length, fail_closed:qa.status!=='PASS' };
}

export function runAccessibilityQa(model = {}) {
  const issues=[];
  if (model.semantic_structure===false) issues.push({severity:'BLOCK',code:'SEMANTIC_STRUCTURE_MISSING',repairable:false});
  if (model.missing_label===true) issues.push({severity:'BLOCK',code:'MISSING_FORM_LABEL',repairable:true});
  if (model.missing_alt===true) issues.push({severity:'BLOCK',code:'ALT_REQUIREMENT_MISSING',repairable:true});
  if (model.keyboard_intent===false) issues.push({severity:'BLOCK',code:'KEYBOARD_INTENT_MISSING',repairable:false});
  if (model.focus_state===false) issues.push({severity:'BLOCK',code:'FOCUS_STATE_MISSING',repairable:true});
  if (model.low_contrast===true) issues.push({severity:'BLOCK',code:'LOW_CONTRAST',repairable:true});
  if (Number(model.touch_target_px||44)<44) issues.push({severity:'BLOCK',code:'TOUCH_TARGET_TOO_SMALL',repairable:true});
  if (model.heading_nesting==='invalid') issues.push({severity:'BLOCK',code:'HEADING_NESTING_INVALID',repairable:true});
  if (model.form_error_intent===false) issues.push({severity:'BLOCK',code:'FORM_ERROR_INTENT_MISSING',repairable:true});
  if (model.reduced_motion===false) issues.push({severity:'BLOCK',code:'REDUCED_MOTION_MISSING',repairable:true});
  return { schema:'riosystems.accessibility-qa.v2', status:issues.length?'BLOCK':'PASS', issues, wcag_certification_claimed:false };
}

export function repairAccessibilityModel(model = {}, maxAttempts = 2) {
  const state=clone(model); const history=[]; let qa=runAccessibilityQa(state);
  for(let attempt=1;attempt<=Math.min(4,Math.max(0,maxAttempts))&&qa.status!=='PASS';attempt++){
    const before=clone(state); const applied=[];
    for(const issue of qa.issues){
      if(issue.code==='MISSING_FORM_LABEL'){state.missing_label=false;state.label_requirement='explicit-associated-label';applied.push(issue.code);}
      if(issue.code==='ALT_REQUIREMENT_MISSING'){state.missing_alt=false;state.alt_policy='meaningful-media-requires-author-supplied-alt; decorative-media-empty-alt';applied.push(issue.code);}
      if(issue.code==='FOCUS_STATE_MISSING'){state.focus_state=true;applied.push(issue.code);}
      if(issue.code==='LOW_CONTRAST'){state.low_contrast=false;state.contrast_token='verified-high-contrast-token';applied.push(issue.code);}
      if(issue.code==='TOUCH_TARGET_TOO_SMALL'){state.touch_target_px=44;applied.push(issue.code);}
      if(issue.code==='HEADING_NESTING_INVALID'){state.heading_nesting='valid';applied.push(issue.code);}
      if(issue.code==='FORM_ERROR_INTENT_MISSING'){state.form_error_intent=true;applied.push(issue.code);}
      if(issue.code==='REDUCED_MOTION_MISSING'){state.reduced_motion=true;applied.push(issue.code);}
    }
    history.push({attempt,before_state:before,after_state:clone(state),applied});qa=runAccessibilityQa(state);if(!applied.length)break;
  }
  return { schema:'riosystems.accessibility-repair.v2', model:state, qa, repair_history:history, fail_closed:qa.status!=='PASS' };
}

export function createImageOptimizationContract(asset = {}) {
  return { schema:'riosystems.image-optimization-contract.v2', asset_id:text(asset.asset_id||'image',120), source:text(asset.source||'project-owned-or-generated',500), dimensions:{width:asset.width||null,height:asset.height||null}, format:text(asset.format||'auto-modern',40), quality:asset.quality??'balanced', responsive_variants:arr(asset.responsive_variants).length?asset.responsive_variants:[480,768,1200,1600], alt:asset.alt??null, lazy_policy:asset.above_fold===true?'eager':'lazy', oversized_original_disallowed:true };
}

export function createAssetInventory(assets = []) {
  const allowedKinds=new Set(['logo','photo','illustration','icon','background','video','font','document']);
  const items=arr(assets).map((a,i)=>({ asset_id:text(a.asset_id||`asset-${i+1}`,120), type:allowedKinds.has(a.type)?a.type:'document', source:text(a.source||'unknown',500), license_status:text(a.license_status||'unknown',80), project_ownership:text(a.project_ownership||a.ownership||'unknown',100), usage:arr(a.usage), allowed:a.allowed_for_reimplementation===true }));
  return { schema:'riosystems.asset-pipeline.v2', items, unsafe:items.filter((a)=>!a.allowed||a.license_status==='unknown').map((a)=>a.asset_id), project_scoped:true };
}

export function runPerformanceQa(model = {}) {
  const issues=[]; const warn=[];
  if (Number(model.total_asset_kb||0)>5000) issues.push({severity:'BLOCK',code:'ASSET_BUDGET_EXCEEDED',repairable:false});
  if (arr(model.images).some((i)=>!i.width||!i.height)) warn.push({severity:'WARN',code:'IMAGE_DIMENSIONS_MISSING',repairable:false});
  if (arr(model.images).some((i)=>i.above_fold!==true&&i.lazy!==true)) warn.push({severity:'WARN',code:'LAZY_LOADING_MISSING',repairable:true});
  if (Number(model.js_kb||0)>300) warn.push({severity:'WARN',code:'JS_WEIGHT_HIGH',repairable:false});
  if (Number(model.render_blocking_resources||0)>2) warn.push({severity:'WARN',code:'RENDER_BLOCKING_INTENT_HIGH',repairable:false});
  if (Number(model.third_party_scripts||0)>5) warn.push({severity:'WARN',code:'THIRD_PARTY_SCRIPT_COUNT_HIGH',repairable:false});
  if (model.duplicate_assets===true) warn.push({severity:'WARN',code:'DUPLICATE_ASSETS',repairable:true});
  return { schema:'riosystems.performance-qa.v2', status:issues.length?'BLOCK':warn.length?'WARN':'PASS', issues:[...issues,...warn], blocking_issues:issues, verified_from_declared_build_metrics:true, lighthouse_claimed:false };
}
