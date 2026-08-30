import { selectWebBuildRoute } from './routing.js';
import { createMigrationPlan } from './migration-integration.js';

const arr=(v)=>Array.isArray(v)?v:[];
const uniq=(v)=>[...new Set(arr(v).filter(Boolean))];
const text=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);

export const WEB_PROVIDER_CAPABILITY_MATRIX = Object.freeze({
  'riosystems-native-web-builder':{ role:'native_builder', design_flexibility:5, CMS:2, exportability:5, hosting:'portable', animation:4, custom_code:5, SEO:5, forms:4, localization:5, cost_class:'LOW', lock_in:'LOW', maintenance:'LOW' },
  framer:{ role:'premium_visual_specialist', design_flexibility:5, CMS:3, exportability:3, hosting:'optional', animation:5, custom_code:3, SEO:4, forms:3, localization:3, cost_class:'PROJECT_DEPENDENT', lock_in:'DESIGN_STAGE_LOW_WHEN_RECONSTRUCTED', maintenance:'MEDIUM' },
  lovable:{ role:'rapid_prototyper', design_flexibility:4, CMS:2, exportability:3, hosting:'optional', animation:3, custom_code:4, SEO:3, forms:3, localization:3, cost_class:'PROJECT_DEPENDENT', lock_in:'PROJECT_DEPENDENT', maintenance:'PROJECT_DEPENDENT' },
  webflow:{ role:'cms_specialist', design_flexibility:5, CMS:5, exportability:2, hosting:'provider_runtime_common', animation:5, custom_code:3, SEO:5, forms:4, localization:4, cost_class:'RECURRING', lock_in:'MEDIUM_HIGH', maintenance:'MEDIUM' },
  cloudflare:{ role:'hosting_provider', design_flexibility:0, CMS:0, exportability:5, hosting:'edge_static_workers', animation:0, custom_code:5, SEO:0, forms:0, localization:0, cost_class:'LOW', lock_in:'LOW_FOR_STATIC', maintenance:'LOW' }
});

export function providerCapabilityMatrix() {
  return { schema:'riosystems.web-provider-capability-matrix.v2', providers:clone(WEB_PROVIDER_CAPABILITY_MATRIX), provider_neutral_routing:true, paid_activation_automatic:false };
}

export function createCmsContract(input = {}) {
  return { schema:'riosystems.cms-contract.v2', collections:arr(input.collections).map((c)=>({ collection_id:text(c.collection_id||c.name,120), fields:arr(c.fields), relations:arr(c.relations), editing_requirements:arr(c.editing_requirements), publishing_workflow:text(c.publishing_workflow||'operator-controlled',200) })), editing_frequency:text(input.editing_frequency||'low',40), editors:Number(input.editors||1), workflow_complexity:Number(input.workflow_complexity||0), provider_preference:text(input.provider_preference||'',80)||null };
}

export function detectCmsNecessity(requirements = {}) {
  const collections=arr(requirements.collections); const dynamic=collections.length;
  const relations=collections.reduce((n,c)=>n+arr(c.relations).length,0); const editors=Number(requirements.editors||1); const frequency=String(requirements.editing_frequency||'low');
  const score=dynamic*2+relations*2+(editors>2?2:0)+(/daily|high/.test(frequency)?2:0)+Number(requirements.workflow_complexity||0);
  const classification=score>=8?'complex_cms':score>=3?'light_cms':'static';
  return { schema:'riosystems.cms-necessity.v2', classification, complexity_score:score, route_hint:classification==='complex_cms'?'webflow_specialist_candidate':classification==='light_cms'?'native_or_specialist_review':'native_static', reasons:{collections:dynamic,relations,editors,editing_frequency:frequency} };
}

export function selectLifecycleProviderRoute(input = {}) {
  const cms=detectCmsNecessity(input.cms_requirements||{}); const pref=input.operator_overrides?.provider||input.provider_preferences?.design_provider||null;
  const request={ complex_cms:cms.classification==='complex_cms', cms_complexity:cms.complexity_score, rapid_experiment:pref==='lovable'||input.rapid_experiment===true, premium_visual:input.quality_level!=='STANDARD', native_premium:pref!=='framer'&&input.native_premium!==false, quality_level:input.quality_level||'STANDARD', synthetic_test_data_only:input.synthetic_test_data_only===true, environment:'staging' };
  if(pref==='webflow'){request.complex_cms=true;request.cms_complexity=5;}
  if(pref==='framer'){request.native_premium=false;request.premium_visual=true;}
  if(pref==='riosystems-native-web-builder'){request.native_premium=input.quality_level!=='STANDARD';request.complex_cms=false;request.rapid_experiment=false;}
  const route=selectWebBuildRoute(request);
  return { ...route, schema:'riosystems.web-provider-route.v2', cms_assessment:cms, operator_override:pref?{provider:pref,audited:true}:null, provider_matrix:providerCapabilityMatrix(), cost_governance:createCostGovernance(route,input) };
}

export function createCostGovernance(route = {}, input = {}) {
  return { schema:'riosystems.web-cost-governance.v2', build_cost_class:input.synthetic_test_data_only?'ZERO':'QUOTE_REQUIRED', hosting_cost_class:route.selected?.hosting_provider==='cloudflare'?'LOW':'PROJECT_DEPENDENT', provider_cost_class:route.selected?.design_provider==='riosystems-native-web-builder'?'ZERO_BUILD_RUNTIME':'PROJECT_DEPENDENT', AI_content_cost_class:'NOT_EXECUTED_BY_WEB_FACTORY', visual_analysis_cost_class:'DETERMINISTIC_FIXTURE_OR_EXTERNAL_APPROVAL_REQUIRED', variable_development_cost_ceiling_eur:0, automatic_paid_provider_usage:false, automatic_paid_overflow:false };
}

export function createAdvancedInteractionContract(items = []) {
  const supported=new Set(['tabs','accordions','carousels','filters','modals','menus','interactive_calculators','multi-step_forms']);
  return { schema:'riosystems.advanced-interaction-contract.v2', items:arr(items).map((i,index)=>({ interaction_id:text(i.interaction_id||`interaction-${index+1}`,120), type:text(i.type,80), supported:supported.has(String(i.type)), purpose:text(i.purpose,300), state_model:i.state_model||{}, keyboard_intent:i.keyboard_intent!==false, reduced_motion:i.reduced_motion!==false, provider_runtime_required:Boolean(i.provider_runtime_required) })), provider_neutral:true };
}

export function createMotionQualityGate(motion = {}) {
  const issues=[]; const items=arr(motion.items);
  if(items.length>12) issues.push({severity:'WARN',code:'EXCESSIVE_ANIMATION_COUNT'});
  for(const item of items){ if(!item.purpose) issues.push({severity:'BLOCK',code:'MOTION_PURPOSE_MISSING',item:item.motion_id||item.type}); if(!item.accessibility_fallback&&!item.reduced_motion_required) issues.push({severity:'BLOCK',code:'MOTION_FALLBACK_MISSING',item:item.motion_id||item.type}); if(String(item.intensity).toLowerCase()==='high'&&String(item.type).toLowerCase()==='parallax') issues.push({severity:'WARN',code:'PARALLAX_INTENSITY_HIGH'}); }
  return { schema:'riosystems.motion-quality-gate.v2', status:issues.some((i)=>i.severity==='BLOCK')?'BLOCK':issues.length?'WARN':'PASS', issues, checks:['excessive_animation','accessibility','performance','interaction_conflict','mobile_behavior'] };
}

export function createMigrationIntelligence(input = {}) {
  const base=createMigrationPlan(input);
  const pages=arr(input.structured_content_dump?.pages);
  const routeMap=pages.map((p)=>({ old_path:text(p.source_path||p.path||'/',300), new_path:text(p.new_path||p.source_path||p.path||'/',300), status_intent:Number(p.redirect_status||301), reason:text(p.redirect_reason||'preserve verified route intent during modernization',300) }));
  const seoInventory=pages.map((p)=>({ path:text(p.source_path||p.path||'/',300), title:text(p.metadata?.title||p.title||'',200), description:text(p.metadata?.description||'',320), h1:text(p.metadata?.h1||'',300), preserve:Boolean(p.preserve_seo!==false) }));
  const broken=arr(input.broken_links).map(String);
  return { ...base, schema:'riosystems.web-migration-intelligence.v2', structure_audit:{ page_count:pages.length, navigation_supplied:Boolean(input.navigation), mobile_quality:text(input.mobile_quality||'unknown',80), visual_age:text(input.visual_age||'unknown',80) }, SEO_inventory:seoInventory, redirect_plan:routeMap, content_migration_safety:{ page_count:pages.length, preserve_content_ids:pages.filter((p)=>p.migrate_copy!==false).map((p)=>p.content_id||p.path), broken_links:broken, silent_content_loss_allowed:false }, legacy_audit:{ outdated_layout:input.outdated_layout===true, poor_mobile:input.poor_mobile===true, weak_SEO:input.weak_SEO===true, poor_accessibility:input.poor_accessibility===true, broken_links:broken, slow_assets:input.slow_assets===true, weak_conversion:input.weak_conversion===true, inconsistent_branding:input.inconsistent_branding===true }, modernization_plan:uniq([...(base.modernization_plan||[]),'Preserve validated metadata and route intent','Emit redirect plan without applying production redirects']), reverse_engineering:{ pages:pages.map((p)=>p.source_path||p.path), components:arr(input.detected_components), design_tokens:input.design_tokens||{}, content_structure:pages.map((p)=>({path:p.source_path||p.path,content_type:p.content_type||'page'})), navigation:input.navigation||null, integrations:arr(input.integrations), proprietary_source_reuse_allowed:false } };
}

export function createWebsiteVersion(input = {}) {
  return { schema:'riosystems.website-version.v2', website_spec:text(input.website_spec||'website-spec-v2',120), website_version:text(input.website_version||'2.0.0',80), source_revision:text(input.source_revision||'unknown',120), design_version:text(input.design_version||'2.0.0',80), content_version:text(input.content_version||'1.0.0',80), page_structure_version:text(input.page_structure_version||'2.0.0',80), provider_route_version:text(input.provider_route_version||'2.0.0',80), integration_contracts_version:text(input.integration_contracts_version||'2.0.0',80) };
}

export function createBuildVersion(input = {}) {
  return { schema:'riosystems.web-build-version.v2', build_id:text(input.build_id||'build-v2',160), website_version:text(input.website_version||'2.0.0',80), source_revision:text(input.source_revision||'unknown',120), design_version:text(input.design_version||'2.0.0',80), content_version:text(input.content_version||'1.0.0',80), provider_route:clone(input.provider_route||null), QA_status:text(input.QA_status||'PENDING',80), previous_known_good:text(input.previous_known_good||'',160)||null, production:false };
}

export function analyzeChangeImpact(change = {}, model = {}) {
  const type=String(change.type||'unknown'); const target=String(change.target||''); const pages=arr(model.pages); const components=arr(model.components); const affectedPages=[];
  if(type==='component') for(const p of pages) if(arr(p.components).includes(target)||arr(p.sections).some((s)=>s.component===target)) affectedPages.push(p.page_id);
  if(type==='content') affectedPages.push(target);
  if(type==='design_token') affectedPages.push(...pages.map((p)=>p.page_id));
  const integrations=[]; if(type==='form_schema') integrations.push('business-factory','automation-factory','analytics-contract');
  return { schema:'riosystems.change-impact-analysis.v2', change:clone(change), affected_pages:uniq(affectedPages), affected_components:type==='component'?[target]:[], SEO_impact:['content','route','page'].includes(type), forms_impact:type==='form_schema', analytics_impact:['form_schema','cta'].includes(type), business_integrations:integrations, localizations_affected:['content','route','page'].includes(type), redirects_affected:type==='route', requires_retest:true };
}

export function calculateBlastRadius(change = {}, model = {}) {
  const impact=analyzeChangeImpact(change,model);
  return { schema:'riosystems.blast-radius.v2', target:change.target||null, affected_page_count:impact.affected_pages.length, affected_pages:impact.affected_pages, cross_factory_dependencies:impact.business_integrations, severity:impact.business_integrations.length?'CROSS_FACTORY':impact.affected_pages.length>10?'HIGH':impact.affected_pages.length>3?'MEDIUM':'LOW', production_change_allowed:false };
}

export function createRegressionContracts(previous = {}, current = {}) {
  const visual={ schema:'riosystems.visual-regression-contract.v2', golden_snapshots:arr(previous.golden_snapshots), comparison_requested:true, executed:false, status:'RUNTIME_OR_FIXTURE_REQUIRED', automatic_approval:false };
  const content={ schema:'riosystems.content-regression.v2', checks:['missing_sections','lost_CTA','changed_phone_email','pricing_inconsistency','lost_SEO_metadata'], previous_version:previous.content_version||null, current_version:current.content_version||null };
  const technical={ schema:'riosystems.technical-regression.v2', checks:['broken_route','broken_component','build_failure','asset_missing','form_contract_broken','responsive_regression'], previous_build:previous.build_id||null, current_build:current.build_id||null };
  return { schema:'riosystems.web-regression-suite.v2', visual, content, technical };
}

export function createRollbackContract(input = {}) {
  return { schema:'riosystems.safe-rollback-contract.v2', previous_known_good:text(input.previous_known_good||'',160)||null, failed_build:text(input.failed_build||'',160)||null, rollback_plan:input.previous_known_good?[`restore artifact ${text(input.previous_known_good,160)}`,'re-run preview QA','require operator approval before production change']:['NO_KNOWN_GOOD_BUILD'], automatic_production_switch:false, production:false };
}

export function createPreviewEnvironmentContract(input = {}) {
  return { schema:'riosystems.preview-environment-contract.v2', project_id:text(input.project_id,160), build_id:text(input.build_id,160), environment:'preview', URL_reference:text(input.URL_reference||'',500)||null, expiration:input.expiration||null, production:false, custom_domain:false, dns_changes:false };
}

export function createSecurityHeadersContract(input = {}) {
  return { schema:'riosystems.security-headers-contract.v2', CSP_intent:input.CSP_intent||"default-src 'self'; object-src 'none'; base-uri 'self'", frame_policy:input.frame_policy||'DENY_OR_FRAME_ANCESTORS_NONE', referrer_policy:input.referrer_policy||'strict-origin-when-cross-origin', permissions_policy:input.permissions_policy||'disable-unneeded-powerful-features', HSTS_intent:'production-provider-policy-only', content_type_protections:'nosniff', provider_translates_intent:true };
}

export function createDeploymentContract(input = {}) {
  return { schema:'riosystems.web-deployment-contract.v2', build_output:text(input.build_output||input.project_root||'',400), routing:clone(input.routing||{}), headers_intent:createSecurityHeadersContract(input.headers||{}), redirects:arr(input.redirects), environment:text(input.environment||'preview',40), provider:text(input.provider||'cloudflare',100), custom_domain_requirement:Boolean(input.custom_domain_requirement), DNS_requirement:Boolean(input.DNS_requirement), production:false, safe_cloudflare_gate_required:true, direct_deploy_executed:false };
}

export function reviewFormSecurity(form = {}) {
  const issues=[]; if(!arr(form.fields).length) issues.push({code:'FORM_FIELDS_MISSING'}); if(arr(form.fields).some((f)=>f.required&&!f.validation)) issues.push({code:'REQUIRED_FIELD_VALIDATION_MISSING'}); if(form.server_side_validation_required===false) issues.push({code:'SERVER_VALIDATION_DISABLED'});
  return { schema:'riosystems.form-security-review.v2', status:issues.length?'BLOCK':'PASS', issues, input_validation:true, spam_protection_contract:'provider_or_backend_required', rate_limit_intent:'required_for_public_submission', CSRF_requirements:'backend-runtime-dependent', server_side_validation_requirement:true, PII_minimization:true };
}

export function governThirdPartyScripts(scripts = []) {
  const items=arr(scripts).map((s,i)=>({ script_id:text(s.script_id||`script-${i+1}`,120), provider:text(s.provider||'unknown',120), purpose:text(s.purpose||'',300), data_collected:arr(s.data_collected), required:s.required===true, optional:s.required!==true, performance_impact:text(s.performance_impact||'unknown',80), consent_requirement:text(s.consent_requirement||'evaluate',80) }));
  return { schema:'riosystems.third-party-script-governance.v2', items, unnecessary_trackers_allowed:false, review_required:items.filter((i)=>i.data_collected.length||i.provider==='unknown').map((i)=>i.script_id) };
}

export function createConsentContract(input = {}) {
  return { schema:'riosystems.cookie-consent-contract.v2', categories:{ essential:{enabled:true,consent_required:false}, analytics:{enabled:Boolean(input.analytics),consent_required:true}, marketing:{enabled:Boolean(input.marketing),consent_required:true}, preferences:{enabled:Boolean(input.preferences),consent_required:true} }, legal_compliance_claimed:false, technical_foundation_only:true };
}

export function reviewAnalyticsQuality(events = []) {
  const seen=new Set(); const issues=[];
  for(const event of arr(events)){const name=String(event.event||event.name||''); if(seen.has(name)) issues.push({code:'DUPLICATE_EVENT',event:name}); seen.add(name); const payload=event.payload||{}; for(const key of Object.keys(payload)) if(/email|phone|name|message|address|raw/i.test(key)) issues.push({code:'PII_LEAKAGE_RISK',event:name,key}); if(!/^[a-z0-9_.]+$/.test(name)) issues.push({code:'EVENT_NAMING_INVALID',event:name});}
  return { schema:'riosystems.web-analytics-quality.v2', status:issues.length?'BLOCK':'PASS', issues, project_isolation_required:true, raw_form_payload_allowed:false };
}

export function createPosthogExperimentContract(input = {}) {
  return { schema:'riosystems.posthog-experiment-handoff.v2', experiment_id:text(input.experiment_id||'experiment-draft',120), variant:text(input.variant||'variant-a',120), goal:text(input.goal||'improve_conversion',200), metric:text(input.metric||'cta_clicked',120), traffic_split:input.traffic_split??null, expected_results:['conversion_metrics','behavior_metrics','confidence'], web_factory_output:'change_suggestions_only', automatic_production_promotion:false, external_execution:false };
}

export function createLearningContracts() {
  return { schema:'riosystems.web-learning-contracts.v2', performance:{ inputs:['component_metrics','image_strategy_metrics','layout_metrics'], only_real_measurements:true, automatic_self_change:false }, conversion:{ inputs:['CTA_patterns','section_ordering','form_length','trust_placement'], only_real_measurements:true, automatic_self_change:false } };
}
