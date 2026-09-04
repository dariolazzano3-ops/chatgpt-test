import { getPremiumIndustryQualityProfile } from './industry-brain.js';

const arr=(v)=>Array.isArray(v)?v:[];
const clone=(v)=>v==null?v:structuredClone(v);
const clean=(v,max=1200)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const uniq=(v=[])=>[...new Set(v.filter(Boolean))];
const clamp=(v)=>Math.max(0,Math.min(100,Number.isFinite(Number(v))?Number(v):0));

export const PREMIUM_WEBSITE_STANDARD_SCHEMA='aurentara.premium-website-standard.v1';
export const PREMIUM_QUALITY_DIMENSIONS=Object.freeze([
  {id:'business_understanding',label:'Business Understanding',weight:8},
  {id:'brand_foundation_fit',label:'Brand Foundation & Fit',weight:6},
  {id:'content_copy',label:'Content & Copy',weight:10},
  {id:'information_architecture_ux',label:'Information Architecture & UX',weight:8},
  {id:'visual_design_art_direction',label:'Visual Design & Art Direction',weight:10},
  {id:'conversion',label:'Conversion',weight:8},
  {id:'trust',label:'Trust',weight:8},
  {id:'seo_discoverability',label:'SEO & Discoverability',weight:7},
  {id:'performance',label:'Performance',weight:6},
  {id:'accessibility',label:'Accessibility',weight:7},
  {id:'technical_quality_security',label:'Technical Quality & Security',weight:7},
  {id:'mobile_responsive',label:'Mobile & Responsive',weight:5},
  {id:'legal_rights_readiness',label:'Legal / Rights Readiness',weight:5},
  {id:'launch_handover_readiness',label:'Launch & Handover Readiness',weight:5}
]);
export const PREMIUM_HARD_GATES=Object.freeze([
  'fabricated_trust_claim','fabricated_review','fabricated_qualification','fabricated_certification',
  'fabricated_customer_project_evidence','fake_location','critical_source_conflict_in_rendered_content',
  'blocked_or_unknown_rights_on_published_asset','broken_primary_conversion','critical_accessibility_failure',
  'broken_responsive_primary_journey','secret_leakage','pii_analytics_leakage','critical_security_failure',
  'tracking_outside_required_consent_policy','incorrect_production_indexing_state',
  'critical_canonical_redirect_route_failure','missing_required_public_legal_input','missing_final_human_approval',
  'missing_required_customer_approval','project_isolation_violation','production_action_without_existing_operator_approval'
]);
export const PREMIUM_BRAND_PATHS=Object.freeze(['USE_EXISTING_BRAND','LIGHT_REFINE','SEPARATE_BRANDING_REQUIRED']);
export const PREMIUM_ASSET_QUALITY_STATES=Object.freeze(['VERIFIED','MISSING','OPTIONAL','LOW_QUALITY','NOT_APPROVED']);
export const PREMIUM_LEGAL_STATES=Object.freeze(['CUSTOMER_INPUT','TEMPLATE','LEGAL_REVIEW_REQUIRED','CUSTOMER_APPROVED','TECHNICALLY_READY']);
export const PREMIUM_HUMAN_STATES=Object.freeze(['APPROVED_FOR_CUSTOMER_REVIEW','CHANGES_REQUIRED','APPROVED_FOR_PREMIUM_DELIVERY','BLOCKED']);
export const PREMIUM_REVISION_CLASSES=Object.freeze(['BUG','QUALITY_GAP','CONTENT_CORRECTION','REVISION','SCOPE_EXPANSION']);
export const PREMIUM_CARE_STATES=Object.freeze(['PROJECT_INCLUDED','OPTIONAL','ONGOING_CARE']);

const HUMAN_AREAS=['business_relevance','brand_fit','visual_quality','individuality','copy','trust','conversion','mobile','polish','consistency','customer_relevance','template_ai_genericness'];
const HUMAN_EVIDENCE=['desktop','tablet','mobile','small_mobile','primary_conversion_flow','representative_pages'];
const A11Y_HUMAN=['keyboard','focus','form_errors','navigation','semantic_basics','screenreader_basics','zoom_reflow','touch_interaction'];
const LAUNCH_CHECKS=['domain','dns_plan_state','ssl','redirects','canonicals','robots','sitemap','analytics','search_console_readiness','forms','email_delivery','404','monitoring','backup_strategy','rollback','production_smoke','production_verification'];
const OWNERSHIP_CHECKS=['domain_ownership','content_ownership','customer_asset_rights','source_export','analytics_ownership','search_console_ownership','provider_account_ownership','credentials_transfer_process','third_party_license_restrictions','care_dependency','retention_deletion_notes'];

function state(v,fallback='NOT_VERIFIED'){
  if(v===true)return 'PASS'; if(v===false)return 'FAIL';
  const raw=typeof v==='object'?(v.status??v.verification??v.state):v;
  const x=clean(raw,80).toUpperCase();
  if(['PASS','FAIL','NOT_VERIFIED'].includes(x))return x;
  if(['VERIFIED','APPROVED','READY','CUSTOMER_CONFIRMED','OPERATOR_CONFIRMED'].includes(x))return 'PASS';
  if(['BLOCK','BLOCKED','ERROR','FAILED'].includes(x))return 'FAIL';
  return fallback;
}
function normalizeDimensions(input={}){
  const supplied=input.quality_dimensions||input.dimension_scores||{};
  const list=Array.isArray(supplied)?supplied:[];
  const byId=new Map(list.map((x)=>[x.id||x.dimension_id||x.label,x]));
  const dimensions=PREMIUM_QUALITY_DIMENSIONS.map((d)=>{
    const raw=byId.get(d.id)??byId.get(d.label)??supplied[d.id]??supplied[d.label];
    const detail=typeof raw==='number'?{score:raw,verification:'VERIFIED'}:(raw&&typeof raw==='object'?raw:{});
    const score=clamp(detail.score);
    const verification=state(detail.verification??detail.status??(typeof raw==='number'?'VERIFIED':null));
    return {...d,score,verification,evidence_refs:uniq(arr(detail.evidence_refs).map((x)=>clean(x,320))),weighted_points:Math.round(score*d.weight)/100};
  });
  return {dimensions,weighted_score:Math.round(dimensions.reduce((n,x)=>n+x.weighted_points,0)*100)/100,all_verified:dimensions.every((x)=>x.verification==='PASS')};
}
function normalizeHardGates(input={}){
  const supplied=input.hard_gates||input.hard_gate_evidence||{};
  const list=Array.isArray(supplied)?supplied:[];
  const byCode=new Map(list.map((x)=>[x.code||x.id,x]));
  const gates=PREMIUM_HARD_GATES.map((code)=>{
    const raw=byCode.get(code)??supplied[code];
    const detail=raw&&typeof raw==='object'?raw:{};
    return {code,status:input.faults?.[code]===true?'FAIL':state(raw),evidence_refs:uniq(arr(detail.evidence_refs).map((x)=>clean(x,320))),override_allowed:false};
  });
  return {gates,failures:gates.filter((x)=>x.status==='FAIL'),not_verified:gates.filter((x)=>x.status==='NOT_VERIFIED'),all_pass:gates.every((x)=>x.status==='PASS')};
}
export function createPremiumInputReadiness(input={}){
  const required=arr(input.required_inputs).length?arr(input.required_inputs):['business_identity','business_model','products_services','target_customers','primary_conversion'];
  const values=input.values||input.discovery||{};
  const missing=required.filter((key)=>values[key]==null||(typeof values[key]==='string'&&clean(values[key],1)===''));
  const blockers=clone(arr(input.blockers));
  if(missing.length)blockers.push({code:'PREMIUM_REQUIRED_INPUT_MISSING',fields:missing});
  if(input.critical_source_conflict===true)blockers.push({code:'CRITICAL_SOURCE_CONFLICT'});
  const warnings=clone(arr(input.warnings));
  return {schema:'aurentara.premium-input-readiness.v1',status:blockers.length?'BLOCKED':warnings.length?'READY_WITH_WARNINGS':'READY',required_inputs:required,missing_inputs:missing,blockers,warnings,critical_customer_facts_require_verification:true};
}
export function createPremiumBrandReadiness(input={}){
  const requested=clean(input.path||input.brand_path,80).toUpperCase();
  const path=PREMIUM_BRAND_PATHS.includes(requested)?requested:'USE_EXISTING_BRAND';
  const issues=clone(arr(input.issues));
  if(path==='SEPARATE_BRANDING_REQUIRED'&&input.branding_complete!==true)issues.push({code:'SEPARATE_BRANDING_REQUIRED_BEFORE_PREMIUM_DELIVERY',severity:'BLOCK'});
  return {schema:'aurentara.premium-brand-readiness.v1',path,status:issues.some((x)=>clean(x.severity,40).toUpperCase()==='BLOCK')?'BLOCKED':issues.length?'READY_WITH_WARNINGS':'READY',issues,silent_brand_masking_allowed:false};
}
export function normalizePremiumAssets(assets=[],qualityById={}){
  const items=arr(assets).map((asset,index)=>{
    const asset_id=clean(asset.asset_id||asset.id||('asset-'+(index+1)),200);
    const q=clean(asset.quality_state||qualityById[asset_id],80).toUpperCase();
    const quality_state=PREMIUM_ASSET_QUALITY_STATES.includes(q)?q:(asset.publishable===true?'NOT_APPROVED':'MISSING');
    return {asset_id,role:clean(asset.usage_role||asset.role||'visual',120),central:asset.central===true,quality_state,rights_state:clean(asset.rights_status||asset.rights_state||'UNKNOWN',80).toUpperCase(),publishable:asset.publishable===true};
  });
  const missingCentral=items.filter((x)=>x.central&&['MISSING','LOW_QUALITY','NOT_APPROVED'].includes(x.quality_state));
  return {schema:'aurentara.premium-asset-readiness.v1',items,missing_assets:items.filter((x)=>x.quality_state==='MISSING').map((x)=>x.asset_id),central_real_images_missing:missingCentral.length>0,photo_brief:missingCentral.length?{required:true,roles:missingCentral.map((x)=>x.role)}:null,shot_list:missingCentral.length?missingCentral.map((x)=>({role:x.role,requirement:'real customer-owned or licensed image'})):[],customer_asset_guide:missingCentral.length?{required:true,fake_company_photography_allowed:false}:null,rights_and_quality_separate:true};
}
export function normalizePremiumTrustEvidence(items=[]){
  const evidence=arr(items).map((x,index)=>({evidence_id:clean(x.evidence_id||('trust-'+(index+1)),160),claim:clean(x.claim,800),source_refs:uniq(arr(x.source_refs).map((v)=>clean(v,320))),verification:state(x.verification_status||x.verification),placement:clone(x.placement||[])}));
  const invalid=evidence.filter((x)=>!x.claim||!x.source_refs.length||x.verification!=='PASS'||!arr(x.placement).length);
  return {schema:'aurentara.premium-trust-evidence.v1',status:invalid.length?'NOT_VERIFIED':'PASS',items:evidence,invalid_evidence:invalid.map((x)=>x.evidence_id),chain:['claim','source','verification','placement'],fabrication_allowed:false};
}
export function evaluatePremiumCopyQuality(input={}){
  const positive=['specificity','value_proposition_clarity','claim_provenance','objection_handling','cta_clarity','brand_voice','fact_consistency'];
  const negative=['repetition','empty_superlatives','generic_ai_style_filler','unsupported_assertions'];
  const result=Object.fromEntries(positive.map((key)=>[key,state(input[key])]));
  for(const key of negative){const value=input[key];result[key]=value===false?'PASS':value===true?'FAIL':state(value);}
  return {schema:'aurentara.premium-copy-quality.v1',status:Object.values(result).includes('FAIL')?'FAIL':Object.values(result).includes('NOT_VERIFIED')?'NOT_VERIFIED':'PASS',checks:result,ai_detection_claimed:false,deterministic_quality_rules_only:true};
}
export function validatePremiumConversionPlan(input={}){
  const required=['primary_cta','secondary_cta','conversion_channels','contact_friction','mobile_cta','form_field_rationale','confirmation','error_states','trust_near_cta'];
  const missing=required.filter((key)=>input[key]==null||(typeof input[key]==='string'&&!clean(input[key],1)));
  return {schema:'aurentara.premium-conversion-plan.v1',status:missing.length?'NOT_VERIFIED':'PASS',missing,plan:clone(input),primary_conversion_must_work:true};
}
export function normalizePremiumPerformanceEvidence(input={}){
  const lab=clone(input.prelaunch_lab||null);
  const field=clone(input.post_launch_field_cwv||null);
  const hasRealField=Boolean(field&&field.real_field_evidence===true&&arr(field.evidence_refs).length);
  return {schema:'aurentara.premium-performance-evidence.v1',prelaunch_lab:lab,post_launch_field_cwv:field,lab_status:state(lab),field_status:hasRealField?state(field):'NOT_VERIFIED',field_cwv_claimed:hasRealField&&state(field)==='PASS',lab_measurement_presented_as_field_cwv:false};
}
export function evaluatePrimaryJourneyAccessibility(input={}){
  const automated=state(input.automated);
  const human=Object.fromEntries(A11Y_HUMAN.map((key)=>[key,state(input.human_checks?.[key]??input[key])]));
  const all=Object.values(human).every((x)=>x==='PASS');
  return {schema:'aurentara.premium-accessibility-evidence.v1',target:'WCAG 2.2 AA',engineering_target_not_certification:true,automated_status:automated,human_checks:human,status:automated==='FAIL'||Object.values(human).includes('FAIL')?'FAIL':automated==='PASS'&&all?'PASS':'NOT_VERIFIED',certification_claimed:false};
}
export function normalizePremiumLegalReadiness(input={}){
  const raw=clean(input.state,80).toUpperCase();
  const legal_state=PREMIUM_LEGAL_STATES.includes(raw)?raw:'LEGAL_REVIEW_REQUIRED';
  return {schema:'aurentara.premium-legal-readiness.v1',legal_state,missing_required_inputs:clone(arr(input.missing_required_inputs)),technical_readiness:state(input.technical_readiness),legal_review_claimed:false,technical_readiness_is_legal_advice:false};
}
export function evaluatePremiumLaunchChecklist(input={}){
  const checks=Object.fromEntries(LAUNCH_CHECKS.map((key)=>[key,state(input[key])]));
  const values=Object.values(checks);
  return {schema:'aurentara.premium-launch-checklist.v1',status:values.includes('FAIL')?'FAIL':values.every((x)=>x==='PASS')?'PASS':'NOT_VERIFIED',checks,operator_gate_required:true,deploy_executed:false};
}
export function evaluatePremiumHumanReview(input={}){
  let review_state=PREMIUM_HUMAN_STATES.includes(clean(input.state,80).toUpperCase())?clean(input.state,80).toUpperCase():'CHANGES_REQUIRED';
  const areas=Object.fromEntries(HUMAN_AREAS.map((key)=>[key,state(input.areas?.[key]??input[key])]));
  const evidence=Object.fromEntries(HUMAN_EVIDENCE.map((key)=>[key,state(input.evidence?.[key])]));
  const allAreas=Object.values(areas).every((x)=>x==='PASS');
  const allEvidence=Object.values(evidence).every((x)=>x==='PASS');
  const attempted=input.automated===true&&review_state.startsWith('APPROVED_');
  if(attempted)review_state='BLOCKED';
  if(review_state==='APPROVED_FOR_PREMIUM_DELIVERY'&&(!allAreas||!allEvidence))review_state='CHANGES_REQUIRED';
  return {schema:'aurentara.premium-human-quality-gate.v1',question:'WOULD A TOP PROFESSIONAL WEB STUDIO PUT ITS NAME ON THIS WEBSITE?',state:review_state,areas,evidence,all_areas_pass:allAreas,all_evidence_present:allEvidence,automatic_human_approval:false,automated_approval_attempt_blocked:attempted};
}
export function classifyPremiumRevision(input={}){
  const requested=clean(input.classification||input.type,80).toUpperCase();
  const classification=PREMIUM_REVISION_CLASSES.includes(requested)?requested:'REVISION';
  return {schema:'aurentara.premium-revision-classification.v1',classification,billable_customer_revision:!['BUG','QUALITY_GAP'].includes(classification),automatic_execution:classification==='SCOPE_EXPANSION'?false:input.automatic_execution===true,scope_expansion_requires_explicit_approval:classification==='SCOPE_EXPANSION'};
}
export function createPremiumOwnershipHandover(input={}){
  const checks=Object.fromEntries(OWNERSHIP_CHECKS.map((key)=>[key,state(input[key])]));
  const missing=Object.entries(checks).filter(([,value])=>value!=='PASS').map(([key])=>key);
  return {schema:'aurentara.premium-ownership-handover.v1',status:missing.length?'NOT_VERIFIED':'PASS',checks,missing,artificial_vendor_lock_in:false};
}
export function normalizePremiumCare(input={}){
  const requested=clean(input.state||input,80).toUpperCase();
  const care_state=PREMIUM_CARE_STATES.includes(requested)?requested:'OPTIONAL';
  return {schema:'aurentara.premium-care-state.v1',state:care_state,platform_created:false,cro_after_launch_requires_real_analytics:true,new_ab_testing_infrastructure:false};
}
export function createPremiumCustomerDeliverySummary(input={}){
  return {schema:'aurentara.premium-customer-delivery-summary.v1',what_was_built:clone(input.what_was_built||[]),business_goals_addressed:clone(input.business_goals_addressed||[]),pages:clone(input.pages||[]),major_features:clone(input.major_features||[]),quality_checks:clone(input.quality_checks||[]),premium_score:Number(input.premium_score??0),remaining_limitations:clone(input.remaining_limitations||[]),customer_approvals:clone(input.customer_approvals||[]),launch_state:clean(input.launch_state||'NOT_READY',120),ownership_accounts:clone(input.ownership_accounts||[]),next_actions:clone(input.next_actions||[]),care_options:clone(input.care_options||[]),human_readable_first:true,raw_logs_secondary:true};
}
export function evaluatePremiumWebsiteStandard(input={}){
  const quality=normalizeDimensions(input), hard=normalizeHardGates(input);
  const by=Object.fromEntries(quality.dimensions.map((x)=>[x.id,x]));
  const input_readiness=input.input_readiness?.schema?clone(input.input_readiness):createPremiumInputReadiness(input.input_readiness||{});
  const brand=input.brand_readiness?.schema?clone(input.brand_readiness):createPremiumBrandReadiness(input.brand_readiness||{});
  const assets=input.asset_readiness?.schema?clone(input.asset_readiness):normalizePremiumAssets(input.assets||[],input.asset_quality||{});
  const trust=input.trust_evidence?.schema?clone(input.trust_evidence):normalizePremiumTrustEvidence(input.trust_evidence||[]);
  const performance=input.performance_evidence?.schema?clone(input.performance_evidence):normalizePremiumPerformanceEvidence(input.performance_evidence||{});
  const accessibility=input.accessibility_evidence?.schema?clone(input.accessibility_evidence):evaluatePrimaryJourneyAccessibility(input.accessibility_evidence||{});
  const legal=input.legal_readiness?.schema?clone(input.legal_readiness):normalizePremiumLegalReadiness(input.legal_readiness||{});
  const launch=input.launch_checklist?.schema?clone(input.launch_checklist):evaluatePremiumLaunchChecklist(input.launch_checklist||{});
  const human=input.human_review?.schema?clone(input.human_review):evaluatePremiumHumanReview(input.human_review||{});
  const ownership=input.ownership?.schema?clone(input.ownership):createPremiumOwnershipHandover(input.ownership||{});
  const care=input.care?.schema?clone(input.care):normalizePremiumCare(input.care||{});
  const customer_review=clone(input.customer_review||{});
  const launchGovernance=state(input.launch_governance?.status??input.launch_governance);
  const no60=quality.dimensions.every((x)=>x.score>=60),no70=quality.dimensions.every((x)=>x.score>=70);
  const premium80=['brand_foundation_fit','content_copy','information_architecture_ux','visual_design_art_direction','conversion','trust','mobile_responsive'].every((id)=>by[id]?.score>=80);
  const customer_review_ready=quality.weighted_score>=80&&quality.all_verified&&no60&&hard.all_pass&&state(input.preview_qa)==='PASS'&&state(input.responsive_qa)==='PASS'&&customer_review.required_review_content_present===true;
  const premium_delivery_ready=quality.weighted_score>=88&&quality.all_verified&&no70&&premium80&&hard.all_pass&&human.state==='APPROVED_FOR_PREMIUM_DELIVERY';
  const public_launch_ready=premium_delivery_ready&&launch.status==='PASS'&&launchGovernance==='PASS';
  const build_ready=['READY','READY_WITH_WARNINGS'].includes(input_readiness.status)&&brand.status!=='BLOCKED'&&hard.failures.length===0;
  const readiness_state=public_launch_ready?'PUBLIC LAUNCH READY':premium_delivery_ready?'PREMIUM DELIVERY READY':customer_review_ready?'CUSTOMER REVIEW READY':build_ready?'BUILD READY':'BLOCKED';
  const evidence_refs=uniq([...arr(input.evidence_refs).map((x)=>clean(x,320)),...quality.dimensions.flatMap((x)=>x.evidence_refs),...hard.gates.flatMap((x)=>x.evidence_refs)]);
  return {
    schema:PREMIUM_WEBSITE_STANDARD_SCHEMA,project_ref:clone(input.project_ref||null),
    industry_profile:clone(input.industry_profile||getPremiumIndustryQualityProfile(input.industry||'')),
    input_readiness,brand_readiness:brand,asset_readiness:assets,quality_dimensions:quality.dimensions,weighted_score:quality.weighted_score,
    hard_gates:hard.gates,hard_failures:hard.failures,not_verified_hard_gates:hard.not_verified,
    missing_assets:uniq([...(assets.missing_assets||[]),...arr(input.missing_assets)]),
    missing_legal_inputs:uniq([...(legal.missing_required_inputs||[]),...arr(input.missing_legal_inputs)]),
    trust_evidence:trust,legal_readiness:legal,
    technical_evidence:{existing_web_quality_score:clone(input.existing_web_quality_score||null),preview_qa:state(input.preview_qa),responsive_qa:state(input.responsive_qa),seo:clone(input.seo_evidence||null),local_seo:clone(input.local_seo_evidence||null),performance,accessibility,privacy:clone(input.privacy_evidence||null),security:clone(input.security_evidence||null),project_isolation:clone(input.project_isolation||null),launch_checklist:launch,field_cwv_claimed:performance.field_cwv_claimed===true},
    customer_review:{...customer_review,ready:customer_review_ready},human_review:human,ownership,care,
    delivery_readiness:{build_ready,customer_review_ready,premium_delivery_ready,state:readiness_state},
    launch_readiness:{public_launch_ready,launch_checklist_status:launch.status,existing_launch_governance:launchGovernance,deploy_executed:false},
    evidence_refs,score_override_can_disable_hard_gates:false,not_verified_can_be_compensated_by_score:false,public_launch_ready_executes_deploy:false,production_deploy:false,
    evaluated_at:clean(input.evaluated_at||input.at,80)||new Date().toISOString()
  };
}
export function premiumWebsiteStandardManifest(){
  return {schema:PREMIUM_WEBSITE_STANDARD_SCHEMA,type:'QUALITY_CONTRACT_EVIDENCE_AGGREGATOR',pillars:['STRATEGY','BRAND','EXPERIENCE','ENGINEERING','GROWTH & CARE'],horizontal:'EVIDENCE & GOVERNANCE',dimension_weights:Object.fromEntries(PREMIUM_QUALITY_DIMENSIONS.map((x)=>[x.label,x.weight])),total_weight:PREMIUM_QUALITY_DIMENSIONS.reduce((n,x)=>n+x.weight,0),hard_gates:[...PREMIUM_HARD_GATES],readiness_states:['BUILD READY','CUSTOMER REVIEW READY','PREMIUM DELIVERY READY','PUBLIC LAUNCH READY'],existing_web_quality_score_replaced:false,duplicate_qa_engine:false,automatic_human_approval:false,automatic_public_deploy:false,paid_provider_calls:0,production_deploy:false};
}
