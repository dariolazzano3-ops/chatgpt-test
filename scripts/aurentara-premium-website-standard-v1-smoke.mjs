import assert from 'node:assert/strict';
import {
  PREMIUM_QUALITY_DIMENSIONS, PREMIUM_HARD_GATES, premiumWebsiteStandardManifest,
  evaluatePremiumWebsiteStandard, createPremiumBrandReadiness, normalizePremiumAssets,
  normalizePremiumTrustEvidence, evaluatePremiumCopyQuality, validatePremiumConversionPlan,
  normalizePremiumPerformanceEvidence, evaluatePrimaryJourneyAccessibility, normalizePremiumLegalReadiness,
  evaluatePremiumHumanReview, classifyPremiumRevision, createPremiumOwnershipHandover, normalizePremiumCare,
  compileWebsiteRequest, createWebsiteStrategy, createInformationArchitecture, createPageIntentContracts, runWebsiteQa,
  PREMIUM_INDUSTRY_QUALITY_PROFILES, getPremiumIndustryQualityProfile
} from '../src/web-factory/index.js';
import { createProjectSourceIntakeState, upsertProjectFact, evaluatePremiumDiscoveryReadiness } from '../src/project-source-intake-v1.js';
import { evaluateProjectDelivery, createProjectHandoff } from '../src/project-delivery-gate.js';
import { createAurentaraPublicWebsitePortfolioEntry, buildOperatorProjectWorkspace } from '../src/operator-project-workspace-v1.js';

const weights=PREMIUM_QUALITY_DIMENSIONS.reduce((sum,item)=>sum+item.weight,0);
assert.equal(weights,100);
assert.equal(premiumWebsiteStandardManifest().total_weight,100);
assert.equal(premiumWebsiteStandardManifest().existing_web_quality_score_replaced,false);

const scores=(score=90)=>Object.fromEntries(PREMIUM_QUALITY_DIMENSIONS.map((item)=>[item.id,score]));
const hardPass=()=>Object.fromEntries(PREMIUM_HARD_GATES.map((code)=>[code,true]));
const humanPass=()=>({
  state:'APPROVED_FOR_PREMIUM_DELIVERY',
  areas:Object.fromEntries(['business_relevance','brand_fit','visual_quality','individuality','copy','trust','conversion','mobile','polish','consistency','customer_relevance','template_ai_genericness'].map((key)=>[key,true])),
  evidence:Object.fromEntries(['desktop','tablet','mobile','small_mobile','primary_conversion_flow','representative_pages'].map((key)=>[key,true]))
});
const launchPass=()=>Object.fromEntries(['domain','dns_plan_state','ssl','redirects','canonicals','robots','sitemap','analytics','search_console_readiness','forms','email_delivery','404','monitoring','backup_strategy','rollback','production_smoke','production_verification'].map((key)=>[key,true]));
const a11yPass=()=>({automated:true,human_checks:Object.fromEntries(['keyboard','focus','form_errors','navigation','semantic_basics','screenreader_basics','zoom_reflow','touch_interaction'].map((key)=>[key,true]))});
const readyInput=(score=90)=>({
  project_ref:{project_id:'premium-test',scope_key:'customer:premium-test'},industry:'B2B Service',
  dimension_scores:scores(score),hard_gates:hardPass(),
  input_readiness:{values:{business_identity:'Example GmbH',business_model:'B2B service',products_services:['Consulting'],target_customers:'SMEs',primary_conversion:'enquiry'}},
  brand_readiness:{path:'USE_EXISTING_BRAND',branding_complete:true},
  preview_qa:true,responsive_qa:true,customer_review:{required_review_content_present:true},
  performance_evidence:{prelaunch_lab:{status:'PASS'},post_launch_field_cwv:{status:'PASS',real_field_evidence:true,evidence_refs:['rum:field-cwv']}},
  accessibility_evidence:a11yPass(),legal_readiness:{state:'CUSTOMER_APPROVED',technical_readiness:true},
  launch_checklist:launchPass(),launch_governance:true,human_review:humanPass(),
  ownership:Object.fromEntries(['domain_ownership','content_ownership','customer_asset_rights','source_export','analytics_ownership','search_console_ownership','provider_account_ownership','credentials_transfer_process','third_party_license_restrictions','care_dependency','retention_deletion_notes'].map((key)=>[key,true])),
  care:{state:'OPTIONAL'},evaluated_at:'2026-09-04T02:00:00.000Z'
});

const build=evaluatePremiumWebsiteStandard({
  input_readiness:{values:{business_identity:'Example',business_model:'service',products_services:['x'],target_customers:'buyers',primary_conversion:'contact'}},
  brand_readiness:{path:'LIGHT_REFINE',branding_complete:true}
});
assert.equal(build.delivery_readiness.state,'BUILD READY');
assert.equal(build.delivery_readiness.premium_delivery_ready,false);
assert.ok(build.not_verified_hard_gates.length>0);

const customer=evaluatePremiumWebsiteStandard({...readyInput(82),human_review:{state:'CHANGES_REQUIRED'}});
assert.equal(customer.delivery_readiness.customer_review_ready,true);
assert.equal(customer.delivery_readiness.state,'CUSTOMER REVIEW READY');

const deliveryReady=evaluatePremiumWebsiteStandard({...readyInput(90),launch_governance:false});
assert.equal(deliveryReady.delivery_readiness.premium_delivery_ready,true);
assert.equal(deliveryReady.delivery_readiness.state,'PREMIUM DELIVERY READY');
assert.equal(deliveryReady.launch_readiness.public_launch_ready,false);

const publicReady=evaluatePremiumWebsiteStandard(readyInput(92));
assert.equal(publicReady.delivery_readiness.premium_delivery_ready,true);
assert.equal(publicReady.launch_readiness.public_launch_ready,true);
assert.equal(publicReady.delivery_readiness.state,'PUBLIC LAUNCH READY');
assert.equal(publicReady.production_deploy,false);
assert.equal(publicReady.launch_readiness.deploy_executed,false);

const highWithHardFail=evaluatePremiumWebsiteStandard({...readyInput(100),hard_gates:{...hardPass(),fabricated_review:false}});
assert.equal(highWithHardFail.weighted_score,100);
assert.equal(highWithHardFail.delivery_readiness.premium_delivery_ready,false);
assert.ok(highWithHardFail.hard_failures.some((item)=>item.code==='fabricated_review'));

const incompleteHard=hardPass(); delete incompleteHard.critical_security_failure;
const notVerified=evaluatePremiumWebsiteStandard({...readyInput(100),hard_gates:incompleteHard});
assert.equal(notVerified.delivery_readiness.premium_delivery_ready,false);
assert.ok(notVerified.not_verified_hard_gates.some((item)=>item.code==='critical_security_failure'));
assert.equal(notVerified.not_verified_can_be_compensated_by_score,false);

const branding=createPremiumBrandReadiness({path:'SEPARATE_BRANDING_REQUIRED',branding_complete:false});
assert.equal(branding.status,'BLOCKED');
assert.equal(branding.silent_brand_masking_allowed,false);

const assetReadiness=normalizePremiumAssets([{asset_id:'hero',usage_role:'HERO_PHOTO',central:true,rights_status:'OWNED_CONFIRMED',publishable:false,quality_state:'MISSING'}]);
assert.equal(assetReadiness.central_real_images_missing,true);
assert.equal(assetReadiness.photo_brief.required,true);
assert.equal(assetReadiness.rights_and_quality_separate,true);

const trust=normalizePremiumTrustEvidence([{claim:'Verified claim',source_refs:['fact:1'],verification_status:'VERIFIED',placement:['home.hero']}]);
assert.equal(trust.status,'PASS');
assert.deepEqual(trust.chain,['claim','source','verification','placement']);

const copy=evaluatePremiumCopyQuality({specificity:true,value_proposition_clarity:true,claim_provenance:true,objection_handling:true,cta_clarity:true,brand_voice:true,fact_consistency:true,repetition:false,empty_superlatives:false,generic_ai_style_filler:false,unsupported_assertions:false});
assert.equal(copy.status,'PASS');
assert.equal(copy.ai_detection_claimed,false);

const conversion=validatePremiumConversionPlan({primary_cta:'Enquire',secondary_cta:'Call',conversion_channels:['form','phone'],contact_friction:'low',mobile_cta:'Call',form_field_rationale:['email needed for reply'],confirmation:'thank-you',error_states:'inline',trust_near_cta:['privacy']});
assert.equal(conversion.status,'PASS');

const labOnly=normalizePremiumPerformanceEvidence({prelaunch_lab:{status:'PASS'}});
assert.equal(labOnly.lab_status,'PASS');
assert.equal(labOnly.field_status,'NOT_VERIFIED');
assert.equal(labOnly.field_cwv_claimed,false);

const accessibility=evaluatePrimaryJourneyAccessibility(a11yPass());
assert.equal(accessibility.status,'PASS');
assert.equal(accessibility.target,'WCAG 2.2 AA');
assert.equal(accessibility.certification_claimed,false);

const legal=normalizePremiumLegalReadiness({state:'TECHNICALLY_READY',technical_readiness:true});
assert.equal(legal.technical_readiness_is_legal_advice,false);
assert.equal(legal.legal_review_claimed,false);

const automatedHuman=evaluatePremiumHumanReview({...humanPass(),automated:true});
assert.equal(automatedHuman.state,'BLOCKED');
assert.equal(automatedHuman.automated_approval_attempt_blocked,true);

assert.equal(classifyPremiumRevision({type:'BUG'}).billable_customer_revision,false);
assert.equal(classifyPremiumRevision({type:'QUALITY_GAP'}).billable_customer_revision,false);
assert.equal(classifyPremiumRevision({type:'SCOPE_EXPANSION',automatic_execution:true}).automatic_execution,false);
assert.equal(normalizePremiumCare({state:'ONGOING_CARE'}).platform_created,false);
assert.equal(createPremiumOwnershipHandover(readyInput().ownership).artificial_vendor_lock_in,false);

assert.equal(Object.keys(PREMIUM_INDUSTRY_QUALITY_PROFILES).length,5);
for(const name of ['Handwerk local service','Gastronomy','Praxis','B2B service','Professional services']){
  const profile=getPremiumIndustryQualityProfile(name);
  assert.equal(profile.rigid_sitemap,false); assert.equal(profile.rigid_layout,false); assert.equal(profile.template_copy,false);
}

const compiled=compileWebsiteRequest('Baue eine Premium Website mit 3 Seiten für Example Studio.',{
  business_name:'Example Studio',industry:'professional services',services:['Design'],target_audience:'Businesses',primary_conversion:'enquiry',synthetic_test_data_only:true
});
assert.equal(compiled.status,'COMPILED');
assert.equal(compiled.compiled_mission.required_pages.length,3);
const strategy=createWebsiteStrategy(compiled.compiled_mission);
const architecture=createInformationArchitecture(strategy,compiled.compiled_mission);
assert.equal(architecture.site_map.length,3);
assert.equal(architecture.expected_page_set.length,3);
assert.equal(architecture.fixed_minimum_page_count,false);
const intents=createPageIntentContracts(architecture,strategy,compiled.compiled_mission);
for(const page of intents.pages){
  for(const key of ['business_purpose','audience','journey_role','search_intent','conversion_role','trust_role','page_rationale']) assert.ok(page[key],key);
}

const root='projects/premium-three-page';
const page=(title)=>'<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+title+'</title><meta name="description" content="A sufficiently descriptive staging description for premium acceptance testing."><meta property="og:title" content="'+title+'"><meta property="og:description" content="Premium acceptance test"></head><body><header>Nav</header><main><h1>'+title+'</h1></main><footer>Footer</footer></body></html>';
const artifact={project_root:root,environment:'staging',production_deploy:false,real_customer_data:false,variable_cost_eur:0,paid_fallback_allowed:false,design_system:{tokens:{colors:{text:'#111111',background:'#ffffff',accent:'#111111',accent_text:'#ffffff'}}},files:{
  [root+'/index.html']:page('Home'),[root+'/services/index.html']:page('Services'),[root+'/contact/index.html']:page('Contact'),
  [root+'/assets/styles.css']:'img{max-width:100%}button{min-height:var(--target)}@media(max-width:768px){main{width:100%}}',
  [root+'/robots.txt']:'User-agent: *\nDisallow: /',[root+'/sitemap.xml']:'<urlset></urlset>',[root+'/_headers']:'/*\n  X-Content-Type-Options: nosniff'
}};
const qa=runWebsiteQa(artifact,{expected_page_set:architecture.expected_page_set});
assert.equal(qa.blocking_issues.some((item)=>item.code==='EXPECTED_PAGE_SET_MISMATCH'),false);
assert.equal(qa.blocking_issues.some((item)=>item.code==='MULTI_PAGE_REQUIRED'),false);

let intake=createProjectSourceIntakeState({operator_id:'operator',customer_id:'customer',project_id:'premium-test',scope_key:'customer:premium-test'}).state;
for(const [field_path,value] of [['business.name','Example GmbH'],['business.offerings',['Consulting']],['target.customers','SMEs'],['website.primary_conversion','enquiry']]){
  const next=upsertProjectFact(intake,{field_path,value,origin:'MANUAL',verification_status:'VERIFIED'}); assert.equal(next.ok,true); intake=next.state;
}
const discovery=evaluatePremiumDiscoveryReadiness(intake,{required_asset_roles:['HERO_PHOTO'],legal_required:true});
assert.equal(discovery.ok,true);
assert.equal(discovery.projection.critical_customer_facts_verified_only,true);
assert.equal(discovery.projection.missing_asset_roles[0],'HERO_PHOTO');
assert.equal(discovery.projection.photo_brief.required,true);
assert.equal(discovery.projection.research_policy.unverified_research_may_become_customer_fact,false);
assert.equal(discovery.projection.research_policy.unverified_research_may_become_trust_claim,false);

const project={customer_id:'customer',project_id:'premium-test',scope_key:'customer:premium-test',name:'Premium Test',capabilities:[{id:'website'}],missions:[{id:'mission-1'}],deliveries:[],premium_website_standard_required:true};
const baseEvidence={capabilities:[{id:'website',completed:true}],qa_passed:true,scope_verified:true,costs_reconciled:true,production_deploy:false};
const missingPremium=evaluateProjectDelivery(project,baseEvidence);
assert.ok(missingPremium.blockers.some((item)=>item.code==='PREMIUM_WEBSITE_STANDARD_EVIDENCE_REQUIRED'));
const deliveryGate=evaluateProjectDelivery(project,{...baseEvidence,premium_standard:publicReady});
assert.equal(deliveryGate.ready_for_structural_delivery,true);
const handoff=createProjectHandoff(project,{...baseEvidence,premium_standard:publicReady});
assert.equal(handoff.ok,true);
assert.equal(handoff.handoff.premium_website_standard.premium_delivery_ready,true);
assert.equal(handoff.handoff.production_deploy,false);

const workspace=buildOperatorProjectWorkspace({project:createAurentaraPublicWebsitePortfolioEntry(),premium_standard:publicReady});
assert.equal(workspace.ok,true);
assert.equal(workspace.premium_standard.enabled,true);
assert.equal(workspace.premium_standard.score,92);
assert.equal(workspace.premium_standard.state,'PUBLIC LAUNCH READY');
assert.equal(workspace.governance.production,'OFF');

const faultMap={
  fake_review:'fabricated_review',fake_qualification:'fabricated_qualification',fake_location:'fake_location',
  critical_source_conflict:'critical_source_conflict_in_rendered_content',unknown_asset_rights:'blocked_or_unknown_rights_on_published_asset',
  broken_form:'broken_primary_conversion',missing_form_label:'critical_accessibility_failure',keyboard_failure:'critical_accessibility_failure',
  low_contrast:'critical_accessibility_failure',horizontal_mobile_overflow:'broken_responsive_primary_journey',
  wrong_canonical:'critical_canonical_redirect_route_failure',public_noindex:'incorrect_production_indexing_state',
  pii_analytics_payload:'pii_analytics_leakage',tracking_without_required_consent:'tracking_outside_required_consent_policy',
  missing_legal_input:'missing_required_public_legal_input',missing_customer_approval:'missing_required_customer_approval',
  missing_human_approval:'missing_final_human_approval',project_isolation_failure:'project_isolation_violation'
};
for(const [scenario,gate] of Object.entries(faultMap)){
  const result=evaluatePremiumWebsiteStandard({...readyInput(100),faults:{[gate]:true}});
  assert.equal(result.delivery_readiness.premium_delivery_ready,false,scenario);
  assert.ok(result.hard_failures.some((item)=>item.code===gate),scenario);
}

console.log(JSON.stringify({
  ok:true,suite:'aurentara-premium-website-standard-v1',total_weight:weights,
  readiness_states:['BUILD READY','CUSTOMER REVIEW READY','PREMIUM DELIVERY READY','PUBLIC LAUNCH READY'],
  fault_injections:Object.keys(faultMap).length,architecture_driven_pages:architecture.site_map.length,
  production_deploy:false,paid_provider_calls:0
},null,2));
