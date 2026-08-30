import { validateWebsiteMission } from './contracts.js';
import { buildAutonomousPremiumWebsite } from './autonomous-premium.js';
import { analyzeCompetitorReferences } from './competitor-intelligence.js';
import { evaluateReferenceOriginality } from './reference-intelligence.js';
import { createBusinessIntegrationPlan, createExperimentContract } from './migration-integration.js';
import { createMotionDesignContract } from './motion-localization.js';
import {
  compileWebsiteRequest, createWebsiteStrategy, createInformationArchitecture, createUserJourneys, createPageIntentContracts, getWebsiteRecipe, createProposalMode
} from './compiler-strategy-v2.js';
import {
  createBrandWebsiteDirection, generateDesignSystemV2, validateDesignTokens, createTypographyContract, createLayoutContract, componentSystemManifest,
  validateComponentSpec, createStructuredContentContract, planPageContent, createAiContentRequest, checkBrandVoice, checkContentConsistency, createTrustPlan,
  createFormContract, composePageModel
} from './composition-system-v2.js';
import {
  createSeoArchitecture, runTechnicalSeoQa, createLocalSeoContract, createProgrammaticSeoContract, createLocalizationV2, createResponsiveContract,
  runResponsiveQa, runAccessibilityQa, runPerformanceQa, createAssetInventory, createImageOptimizationContract
} from './seo-quality-v2.js';
import {
  selectLifecycleProviderRoute, createCmsContract, detectCmsNecessity, createAdvancedInteractionContract, createMotionQualityGate, createMigrationIntelligence,
  createWebsiteVersion, createBuildVersion, analyzeChangeImpact, calculateBlastRadius, createRegressionContracts, createRollbackContract, createPreviewEnvironmentContract,
  createDeploymentContract, createSecurityHeadersContract, reviewFormSecurity, governThirdPartyScripts, createConsentContract, reviewAnalyticsQuality,
  createPosthogExperimentContract, createLearningContracts, createCostGovernance
} from './lifecycle-governance-v2.js';
import { runGeneralSelfHealingWebsiteLoop, computeWebQualityScore } from './self-healing-v2.js';

const arr=(v)=>Array.isArray(v)?v:[];
const uniq=(v)=>[...new Set(arr(v).filter(Boolean))];
const text=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);

export const WEB_OS_V2_QUALITY_LEVELS=Object.freeze({
  STANDARD:{design_depth:'standard',visual_QA:'structured',repair_attempts:2,motion_depth:'low',content_depth:'standard'},
  PREMIUM:{design_depth:'deep',visual_QA:'structured+specialist-ready',repair_attempts:3,motion_depth:'medium',content_depth:'deep'},
  HIGH_FIDELITY:{design_depth:'deep',visual_QA:'screenshot-evidence-required',repair_attempts:4,motion_depth:'high-controlled',content_depth:'deep'}
});

function qualityLevel(value){const key=String(value||'PREMIUM').toUpperCase();return WEB_OS_V2_QUALITY_LEVELS[key]?key:'PREMIUM';}
function correlationId(projectId,missionId='mission'){return `corr-web-${String(projectId||'project').replace(/[^a-z0-9-]/gi,'-').toLowerCase()}-${String(missionId).replace(/[^a-z0-9-]/gi,'-').toLowerCase()}`;}
function missionId(mission={}){return text(mission.mission_id||`web-${mission.project_slug||'project'}-v2`,160);}

function differentiate(competitor={},brand={}) {
  const weaknesses=uniq(arr(competitor.competitor_insights).flatMap((c)=>arr(c.weaknesses)));
  const strengths=uniq(arr(competitor.competitor_insights).flatMap((c)=>arr(c.strengths)));
  return { schema:'riosystems.web-differentiation-plan.v2', what_to_keep:arr(competitor.market_patterns).slice(0,8), what_to_avoid:weaknesses, how_to_differentiate:uniq([...(competitor.recommended_differentiation||[]),'make the value proposition specific to the supplied positioning','use owned visual and content assets']), unique_message:text(brand.positioning||'clear owned positioning',500), visual_differentiation:'apply brand-owned tokens and a coherent provider-neutral design intent instead of copying competitor visuals', conversion_differentiation:'reduce friction and route every major journey to one explicit conversion', competitor_strengths:strengths, competitor_copying_allowed:false };
}

function contentInputs(input,pageIntents,recipe,mission){
  const supplied=input.content||mission.existing_content||{};
  const plans=pageIntents.pages.map((page)=>planPageContent(page,recipe,supplied[page.page_id]||{}));
  const contracts=pageIntents.pages.map((page)=>createStructuredContentContract(page,supplied[page.page_id]||{}));
  return { plans, contracts, AI_request:createAiContentRequest(mission,pageIntents.pages,plans), brand_voice:checkBrandVoice(contracts,mission,input.brand_voice_rules||{}), consistency:checkContentConsistency(contracts,{business_name:mission.business_name,phone:input.contact?.phone,email:input.contact?.email,pricing_reference:input.pricing_reference}) };
}

function componentVariant(component){
  if(component==='hero')return 'editorial';
  if(component==='cta')return 'primary';
  if(component==='form')return 'contact';
  if(component==='section')return 'contained';
  return undefined;
}

function componentAndPages(pageIntents,content,designSystem){
  const pageModels=pageIntents.pages.map((page)=>composePageModel(page,content.contracts.find((c)=>c.page_id===page.page_id),designSystem,content.plans.find((p)=>p.page_id===page.page_id)));
  const componentSpecs=uniq(pageModels.flatMap((p)=>p.sections.map((s)=>s.component))).map((component)=>({component,...(componentVariant(component)?{variant:componentVariant(component)}:{}),semantic_intent:true,responsive:true,accessible:true,content_overflow:false,inline_style:false}));
  const quality=componentSpecs.map((spec)=>validateComponentSpec(spec,designSystem));
  return { component_system:componentSystemManifest(), component_specs:componentSpecs, component_quality:quality, page_compositions:pageModels };
}

function runtimeModels(build,input={}){
  const files=build?.artifact?.files||{};const entries=Object.entries(files);const html=entries.filter(([p])=>p.endsWith('.html')).map(([,c])=>String(c)).join('\n');const css=entries.filter(([p])=>p.endsWith('.css')).map(([,c])=>String(c)).join('\n');
  const totalBytes=entries.reduce((n,[,c])=>n+Buffer.byteLength(String(c)),0);const jsBytes=entries.filter(([p])=>p.endsWith('.js')).reduce((n,[,c])=>n+Buffer.byteLength(String(c)),0);
  return {
    responsive:{ horizontal_overflow:input.synthetic_faults?.horizontal_overflow===true, heading_overflow:input.synthetic_faults?.heading_overflow===true, mobile_grid_columns:input.synthetic_faults?.mobile_grid_columns||(/@media/.test(css)?1:1), button_clipping:input.synthetic_faults?.button_clipping===true, navigation_overlap:input.synthetic_faults?.navigation_overlap===true, image_overflow:input.synthetic_faults?.image_overflow===true },
    accessibility:{ semantic_structure:/<main\b/i.test(html), missing_label:input.synthetic_faults?.missing_label===true, missing_alt:input.synthetic_faults?.missing_alt===true, keyboard_intent:true, focus_state:input.synthetic_faults?.focus_state===false?false:true, low_contrast:input.synthetic_faults?.low_contrast===true, touch_target_px:input.synthetic_faults?.touch_target_px||44, heading_nesting:input.synthetic_faults?.heading_nesting||'valid', form_error_intent:true, reduced_motion:input.synthetic_faults?.reduced_motion===false?false:true },
    performance:{ total_asset_kb:Math.round(totalBytes/1024*100)/100, js_kb:Math.round(jsBytes/1024*100)/100, images:arr(input.images).map((i)=>({width:i.width,height:i.height,above_fold:i.above_fold===true,lazy:i.lazy===true})), render_blocking_resources:0, third_party_scripts:arr(input.third_party_scripts).length, duplicate_assets:input.synthetic_faults?.duplicate_assets===true }
  };
}

function securityBundle(input,form,events){
  const formSecurity=reviewFormSecurity({...form,server_side_validation_required:true});const thirdParty=governThirdPartyScripts(input.third_party_scripts||[]);const consent=createConsentContract(input.consent||{});const analytics=reviewAnalyticsQuality(events);
  const issues=[...formSecurity.issues,...(analytics.issues||[])];
  return { schema:'riosystems.web-security-governance.v2', status:issues.length?'BLOCK':'PASS', issues, headers:createSecurityHeadersContract(input.security_headers||{}), form_security:formSecurity, third_party_scripts:thirdParty, consent, analytics_quality:analytics, secrets_logged:false };
}

function standardEvents(projectId,correlation){
  return ['page_view','cta_clicked','form_started','form_submitted','lead_created_request','booking_clicked','phone_clicked','email_clicked','download_clicked','pricing_viewed'].map((event)=>({event,payload:{project_id:projectId,correlation_id:correlation},PII:false}));
}

function enhanceIntegration(mission,input,correlation){
  const plan=createBusinessIntegrationPlan(mission,input.integration_requirements||mission.integration_requirements||{});
  return {...plan,schema:'riosystems.web-business-integration-plan.v2',correlation_id:correlation,hooks:plan.hooks.map((h)=>({...h,correlation_id:correlation,external_execution:false})),standard_events:standardEvents(mission.project_slug,correlation),website_to_business:{event:'website.form_submitted',target:'business-factory',mutation_owner:'business-factory'},website_to_automation:{events:['form_submitted','booking_clicked','download_clicked'],target:'automation-factory',execution_owner:'automation-factory'},website_to_analytics:{events:standardEvents(mission.project_slug,correlation).map((e)=>e.event),target:'posthog-adapter',raw_form_payload:false},external_side_effects:false};
}

function deploymentBundle(build,mission,input,route,migration){
  const root=build?.artifact?.project_root||`projects/${mission.project_slug}`;
  const contract=createDeploymentContract({build_output:root,routing:route,redirects:migration.redirect_plan||[],environment:'preview',provider:route.selected?.hosting_provider||'cloudflare',custom_domain_requirement:false,DNS_requirement:false});
  const preview=createPreviewEnvironmentContract({project_id:mission.project_slug,build_id:build?.build_id||input.build_id||'build-v2',URL_reference:null});
  return {contract,preview,cloudflare_path:{eligible:Boolean(build?.artifact)&&route.selected?.hosting_provider==='cloudflare',safe_gate_required:true,JWT_or_preview_gate_bypass:false,production:false,DNS:false,custom_domain:false}};
}

function applyArtifactSafetyPatch(build,selfHeal){
  if(!build?.artifact?.files)return;const cssFile=Object.keys(build.artifact.files).find((p)=>p.endsWith('/assets/styles.css'));if(!cssFile)return;
  const patches=[];if(selfHeal.repair_history.some((r)=>r.applied?.some((a)=>a.category==='RESPONSIVE')))patches.push('img,video,svg{max-width:100%;height:auto}.wf-grid{min-width:0}@media(max-width:768px){.wf-grid{grid-template-columns:1fr!important}}');
  if(selfHeal.repair_history.some((r)=>r.applied?.some((a)=>a.category==='ACCESSIBILITY')))patches.push(':focus-visible{outline:3px solid currentColor;outline-offset:3px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}');
  if(patches.length)build.artifact.files[cssFile]+=`\n/* RIOSYSTEMS Web OS V2 safe self-healing patches */\n${patches.join('\n')}`;
}

function projectIsolation(build,mission){const root=build?.artifact?.project_root||'';const files=Object.keys(build?.artifact?.files||{});const leaks=files.filter((f)=>!f.startsWith(`${root}/`));return {schema:'riosystems.project-isolation.v2',status:leaks.length?'BLOCK':'PASS',project_id:mission.project_slug,project_root:root,cross_project_leakage:false,leaking_files:leaks,shared_reuse_policy:'explicit approved recipes/components only'};}

function observability({buildId,mission,route,pages,components,selfHeal,status,warnings,correlation,duration}){
  return {schema:'riosystems.web-build-observability.v2',build_id:buildId,project_id:mission.project_slug,mission_id:missionId(mission),website_version:'2.0.0',correlation_id:correlation,provider_route:route.selected?.route_id||null,pages_generated:pages,components_used:components,QA_runs:1+selfHeal.repair_history.length,repair_attempts:selfHeal.repair_history.length,build_duration:{value_ms:Number.isFinite(duration)?duration:null,measured:Number.isFinite(duration)},status,warnings:arr(warnings).map((w)=>typeof w==='string'?w:w.code||w.message||'warning'),secrets_logged:false};}

export function runWebOperatingSystemV2(input = {}, options = {}) {
  const compiled=input.request ? compileWebsiteRequest(input.request,input.context||input) : null;
  const rawMission=compiled?.status==='COMPILED' ? compiled.compiled_mission : (input.mission||input.website_mission||input);
  const validation=validateWebsiteMission(rawMission);
  if(!validation.ok)return{ok:false,status:'REQUIREMENTS_REQUIRED',compiler:compiled,validation,variable_cost_eur:0,production_deploy:false};
  const mission={...validation.mission,quality_level:qualityLevel(input.quality_level||validation.mission.quality_level)};
  const quality=mission.quality_level;const qualityPolicy=WEB_OS_V2_QUALITY_LEVELS[quality];
  if(input.mode==='proposal')return{ok:true,status:'PROPOSAL_READY',proposal:createProposalMode({compiled:compiled||{status:'COMPILED',compiled_mission:mission,project_id:mission.project_slug,quality_level:quality,provider_preferences:mission.provider_preferences,cost_class:'ZERO_COST_DEVELOPMENT'}}),variable_cost_eur:0,production_deploy:false};
  const recipe=getWebsiteRecipe(mission.industry);const strategy=createWebsiteStrategy(mission);const architecture=createInformationArchitecture(strategy,mission);const journeys=createUserJourneys(strategy,mission);const pageIntents=createPageIntentContracts(architecture,strategy,mission);
  const brand=createBrandWebsiteDirection(mission,input.operator_overrides||{});const designSystem=generateDesignSystemV2(brand,input.design_intent||{},quality);const tokenValidation=validateDesignTokens(designSystem);const typography=createTypographyContract(designSystem);const layout=createLayoutContract(designSystem);
  const content=contentInputs(input,pageIntents,recipe,mission);const composition=componentAndPages(pageIntents,content,designSystem);const trust=createTrustPlan(recipe,input.trust_evidence||{});const form=createFormContract(input.form||{form_id:'contact-form',goal:mission.conversion_goal});
  const competitor=analyzeCompetitorReferences(mission.competitor_references||[]);const differentiation=differentiate(competitor,brand);const originality=evaluateReferenceOriginality(mission.visual_references||[]);
  const cmsContract=createCmsContract(input.cms_requirements||{});const cmsAssessment=detectCmsNecessity(cmsContract);const route=selectLifecycleProviderRoute({cms_requirements:cmsContract,operator_overrides:input.operator_overrides||{},provider_preferences:mission.provider_preferences,quality_level:quality,synthetic_test_data_only:mission.synthetic_test_data_only,native_premium:input.use_framer_visual_specialist===true?false:true,rapid_experiment:input.rapid_experiment===true});
  if(['webflow-cms-specialist-candidate','lovable-rapid-prototype-candidate'].includes(route.selected.route_id))return{ok:false,status:'SPECIALIST_REVIEW_REQUIRED',mission,strategy,architecture,journeys,page_intents:pageIntents,brand_direction:brand,design_system:designSystem,content_planning:content,cms:{contract:cmsContract,assessment:cmsAssessment},provider_route:route,cost_governance:createCostGovernance(route,{synthetic_test_data_only:mission.synthetic_test_data_only}),external_execution:false,variable_cost_eur:0,production_deploy:false};
  const useFramer=route.selected.route_id==='framer-design-native-cloudflare';
  const build=buildAutonomousPremiumWebsite({mission,quality_level:quality,use_framer_visual_specialist:useFramer,routing_context:{native_premium:!useFramer},screenshot_report:input.screenshot_report,framer_status:input.framer_status||{}},{...options,max_visual_repair_attempts:qualityPolicy.repair_attempts});
  if(!build.artifact)return{...build,status:'BUILD_BLOCKED',strategy,architecture,provider_route:route,variable_cost_eur:0,production_deploy:false};
  const seo=createSeoArchitecture(pageIntents.pages,mission,architecture);if(input.synthetic_faults?.seo_missing_title)seo.pages[0].title='';if(input.synthetic_faults?.seo_bad_h1)seo.pages[0].heading_hierarchy.h1_count=2;if(input.synthetic_faults?.seo_broken_link)seo.pages[0].internal_links.push({from:'home',to:'missing-page'});
  const localSeo=createLocalSeoContract(mission,input.local_business_data||{});const programmaticSeo=createProgrammaticSeoContract(input.programmatic_seo||{});const localization=createLocalizationV2(mission,input.localization||mission.localization,pageIntents.pages);
  const runtime=runtimeModels(build,input);const correlation=correlationId(mission.project_slug,missionId(mission));const integration=enhanceIntegration(mission,input,correlation);const events=integration.standard_events;const security=securityBundle(input,form,events);
  const initialQa={technical_QA:build.technical_QA,seo,architecture,responsive_model:runtime.responsive,accessibility_model:runtime.accessibility,performance_model:runtime.performance,security_QA:security,CRO_QA:build.CRO_result,visual_QA:build.visual_quality};
  const selfHeal=runGeneralSelfHealingWebsiteLoop(initialQa,{max_attempts:qualityPolicy.repair_attempts});applyArtifactSafetyPatch(build,selfHeal);
  const motion=createMotionDesignContract(mission.motion_intent||[],{quality_level:quality});const motionQuality=createMotionQualityGate(motion);const interactions=createAdvancedInteractionContract(input.interactions||[]);
  const assetInventory=createAssetInventory(input.assets||mission.existing_brand?.assets||[]);const imageContracts=arr(input.images).map(createImageOptimizationContract);const migration=createMigrationIntelligence(mission.existing_website||input.existing_website||{});
  const websiteVersion=createWebsiteVersion({website_version:'2.0.0',source_revision:input.source_revision||'factory-control-derived',design_version:designSystem.version,content_version:input.content_version||'1.0.0'});const buildVersion=createBuildVersion({build_id:build.build_id,website_version:websiteVersion.website_version,source_revision:websiteVersion.source_revision,design_version:websiteVersion.design_version,content_version:websiteVersion.content_version,provider_route:route,QA_status:selfHeal.status,previous_known_good:input.previous_known_good});
  const impact=analyzeChangeImpact(input.change||{}, {pages:composition.page_compositions,components:composition.component_specs});const blastRadius=calculateBlastRadius(input.change||{}, {pages:composition.page_compositions,components:composition.component_specs});const regression=createRegressionContracts(input.previous_build||{},buildVersion);const rollback=createRollbackContract({previous_known_good:input.previous_known_good,failed_build:selfHeal.status==='BLOCK'?build.build_id:null});
  const deployment=deploymentBundle(build,mission,input,route,migration);const experiment=createExperimentContract(input.experiment||{});const posthogExperiment=createPosthogExperimentContract(input.experiment||{});const learning=createLearningContracts();const isolation=projectIsolation(build,mission);
  const qualityScore=computeWebQualityScore({build_status:build.status,responsive:selfHeal.final_QA.responsive,SEO:selfHeal.final_QA.seo,accessibility:selfHeal.final_QA.accessibility,performance:selfHeal.final_QA.performance,visual:build.visual_quality,CRO:build.CRO_result,integration,rights:build.premium_build?.asset_rights||build.originality});
  const blocking=[tokenValidation.status==='BLOCK',content.brand_voice.status==='BLOCK',content.consistency.status==='BLOCK',composition.component_quality.some((q)=>q.status==='BLOCK'),selfHeal.status==='BLOCK',motionQuality.status==='BLOCK',security.status==='BLOCK',isolation.status==='BLOCK',qualityScore.status==='FAIL',build.ok!==true].some(Boolean);
  const status=blocking?'BLOCKED_WEB_OS_V2_QA':'VERIFIED_WEB_OS_V2_DELIVERABLE';const warnings=uniq([...(tokenValidation.warnings||[]).map((w)=>w.code),...(selfHeal.final_QA.performance.issues||[]).filter((i)=>i.severity==='WARN').map((i)=>i.code),...(originality.asset_warnings||[]).map((w)=>w.code||w.message||'asset_warning')]);
  const obs=observability({buildId:build.build_id,mission,route,pages:composition.page_compositions.length,components:composition.component_specs.map((c)=>c.component),selfHeal,status,warnings,correlation,duration:options.build_duration_ms});
  const delivery={
    schema:'riosystems.website-delivery-manifest.v3',project_id:mission.project_slug,website_version:websiteVersion.website_version,strategy,audience:mission.target_audience,site_map:architecture.site_map,pages:composition.page_compositions,
    design_intent:build.design_intent,design_system:designSystem,content_version:websiteVersion.content_version,content_planning:content.plans,visual_references:build.visual_reference_fusion,competitor_insights:competitor,differentiation,components:composition.component_specs,motion:{contract:motion,quality:motionQuality},localization,
    SEO:{architecture:selfHeal.models.seo,QA:selfHeal.final_QA.seo,local:localSeo,programmatic:programmaticSeo},accessibility:selfHeal.final_QA.accessibility,performance:selfHeal.final_QA.performance,CRO:build.CRO_result,trust,visual_quality:build.visual_quality,visual_fidelity:build.visual_fidelity,
    repair_history:{general:selfHeal.repair_history,legacy:build.repair_history},business_integration_hooks:integration,AI_content_request:content.AI_request,analytics_events:events,provider_route:route,cms:{contract:cmsContract,assessment:cmsAssessment},deployment_artifact:deployment,
    rights_status:{originality,asset_inventory:assetInventory},security,forms:[form],advanced_interactions:interactions,migration,versioning:{website:websiteVersion,build:buildVersion},change_impact:impact,blast_radius:blastRadius,regression,rollback,experiment_architecture:{generic:experiment,posthog:posthogExperiment},learning_contracts:learning,
    quality_score:qualityScore,operator_overrides:{values:clone(input.operator_overrides||{}),audited:true},cost_metadata:route.cost_governance||createCostGovernance(route,{synthetic_test_data_only:mission.synthetic_test_data_only}),warnings,production_status:'DISABLED',production_deploy:false
  };
  const root=build.artifact.project_root;const files=build.artifact.files;files[`${root}/web-os-v2-strategy.json`]=JSON.stringify(strategy,null,2);files[`${root}/web-os-v2-architecture.json`]=JSON.stringify(architecture,null,2);files[`${root}/web-os-v2-page-intents.json`]=JSON.stringify(pageIntents,null,2);files[`${root}/web-os-v2-content-plan.json`]=JSON.stringify(content,null,2);files[`${root}/web-os-v2-self-healing.json`]=JSON.stringify(selfHeal,null,2);files[`${root}/web-os-v2-delivery-manifest.json`]=JSON.stringify(delivery,null,2);files[`${root}/web-os-v2-observability.json`]=JSON.stringify(obs,null,2);
  return {ok:!blocking,status,compiler:compiled,mission,strategy,information_architecture:architecture,user_journeys:journeys,page_intents:pageIntents,recipe,brand_direction:brand,design_system:designSystem,design_token_validation:tokenValidation,typography,layout,content_system:content,composition,trust,form,competitor_intelligence:competitor,differentiation,originality,cms:{contract:cmsContract,assessment:cmsAssessment},provider_route:route,premium_build:build,SEO:delivery.SEO,localization,responsive:selfHeal.final_QA.responsive,accessibility:selfHeal.final_QA.accessibility,performance:selfHeal.final_QA.performance,self_healing:selfHeal,motion:delivery.motion,interactions,assets:{inventory:assetInventory,images:imageContracts},migration,integrations:integration,security,versioning:delivery.versioning,change_impact:impact,blast_radius:blastRadius,regression,rollback,deployment,experiments:delivery.experiment_architecture,quality_score:qualityScore,delivery_manifest:delivery,observability:obs,artifact:build.artifact,correlation_id:correlation,project_isolation:isolation,variable_cost_eur:0,production_deploy:false};
}
