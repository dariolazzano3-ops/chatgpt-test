import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compileWebsiteRequest, createWebsiteStrategy, createInformationArchitecture, createUserJourneys, createPageIntentContracts, getWebsiteRecipe,
  createBrandWebsiteDirection, generateDesignSystemV2, validateDesignTokens, componentSystemManifest, createFormContract, createAiContentRequest,
  fuseVisualReferences, screenshotToDesignSpecManifest, analyzeCompetitorReferences, evaluateReferenceOriginality,
  createSeoArchitecture, runTechnicalSeoQa, repairResponsiveModel, repairAccessibilityModel, createLocalizationV2, createStructuredDataContract,
  createMigrationIntelligence, providerCapabilityMatrix, createCmsContract, detectCmsNecessity, selectLifecycleProviderRoute,
  createWebsiteVersion, analyzeChangeImpact, calculateBlastRadius, createRollbackContract, createDeploymentContract, createSecurityHeadersContract,
  reviewAnalyticsQuality, createPosthogExperimentContract, runGeneralSelfHealingWebsiteLoop, createVisualRegressionFixture,
  runVisualRepairLoop, runScreenshotComparison, runWebOperatingSystemV2, executeWebFactoryTask
} from '../src/web-factory/index.js';

const load = async (name) => JSON.parse(await readFile(new URL(`../fixtures/web-factory/${name}`, import.meta.url), 'utf8'));
const architectureFixture = await load('autonomous-premium-architecture.json');
const bakeryFixture = await load('autonomous-local-service-bakery.json');
const migrationFixture = await load('autonomous-migration-consulting.json');

const results=[];
const pass=(name,extra={})=>results.push({scenario:name,status:'PASS',...extra});
const requireBuild=(name,result)=>{
  if(!result.ok) throw new Error(`${name} failed: ${JSON.stringify({status:result.status,token:result.design_token_validation,component:result.composition?.component_quality,self_healing:result.self_healing?.status,security:result.security?.status,quality:result.quality_score,visual:result.premium_build?.visual_quality,cro:result.premium_build?.CRO_result},null,2)}`);
  assert.equal(result.production_deploy,false);assert.equal(result.variable_cost_eur,0);assert.equal(result.project_isolation.status,'PASS');return result;
};

// A — premium consulting full lifecycle + natural-language compiler
const compiler=compileWebsiteRequest('Baue eine hochwertige Premium-Website für Müller Consulting mit fünf Seiten, Kontaktformular und Lead-Anbindung. Deutsch und Englisch.',{
  business_name:'Müller Consulting',industry:'consulting',services:['Strategy consulting','Operating model design'],target_audience:'Owners and managing directors',synthetic_test_data_only:true,
  visual_references:architectureFixture.mission.visual_references,competitor_references:architectureFixture.mission.competitor_references,
  brand_inputs:{description:'Calm authority for complex business decisions',tone:'precise and trustworthy',colors:{background:'#f4f1ea',surface:'#ffffff',text:'#161616',muted:'#66615c',accent:'#173f39',accent_text:'#ffffff',border:'#d9d4cb'},assets:[{asset_id:'mc-mark',source:'synthetic',kind:'brand-mark',license_status:'generated',ownership:'synthetic-test',allowed_for_reimplementation:true,replacement_required:false}]}
});
assert.equal(compiler.status,'COMPILED');assert.equal(compiler.business,'Müller Consulting');assert.equal(compiler.quality_level,'PREMIUM');assert.deepEqual(compiler.localization.languages,['de','en']);
const consulting=requireBuild('A-premium-consulting',runWebOperatingSystemV2({request:compiler.source_request,context:{business_name:'Müller Consulting',industry:'consulting',services:['Strategy consulting','Operating model design'],target_audience:'Owners and managing directors',synthetic_test_data_only:true,visual_references:architectureFixture.mission.visual_references,competitor_references:architectureFixture.mission.competitor_references,brand_inputs:compiler.brand_inputs,languages:['de','en']},trust_evidence:{available:['expertise','methodology']},localization:{primary_language:'de',languages:['de','en'],currency:'EUR'}},{now:'2026-08-30T05:20:00.000Z',build_duration_ms:18}));
assert.equal(consulting.status,'VERIFIED_WEB_OS_V2_DELIVERABLE');assert.equal(consulting.quality_score.status,'PASS');assert.equal(consulting.delivery_manifest.production_status,'DISABLED');assert.equal(consulting.observability.build_duration.measured,true);assert.ok(consulting.delivery_manifest.AI_content_request);pass('A-premium-consulting',{pages:consulting.delivery_manifest.pages.length});

// B — bakery local trust/local SEO/business hooks
const bakery=requireBuild('B-bakery',runWebOperatingSystemV2({...bakeryFixture,local_business_data:{name:'Bäckerei Müller',address:'Synthetic Hauptstraße 1',service_area:'Synthetic Saarland',opening_hours:'fixture-only',contact:'fixture@example.invalid'}},{now:'2026-08-30T05:20:00.000Z'}));
assert.equal(bakery.recipe.recipe_id,'local_business');assert.equal(bakery.SEO.local.status,'READY');assert.equal(bakery.integrations.external_side_effects,false);assert.ok(bakery.integrations.standard_events.some((e)=>e.event==='pricing_viewed'));pass('B-bakery-local');

// C — multi-reference fusion/operator influence remains coherent
const fusion=fuseVisualReferences(architectureFixture.mission.visual_references);
assert.equal(fusion.status,'FUSED');assert.ok(Object.keys(fusion.provenance).length>0);assert.equal(screenshotToDesignSpecManifest().pixel_clone_allowed,false);
assert.match(consulting.premium_build.design_intent.intent.decorative_patterns,/minimal/i);pass('C-multi-reference');

// D — visual fidelity repair
const visualBase=architectureFixture;
const visualBuilt=runWebOperatingSystemV2({...visualBase,mission:{...visualBase.mission,project_slug:'v2-visual-repair'}},{now:'2026-08-30T05:20:00.000Z'});
requireBuild('D-visual-base',visualBuilt);
const tampered=structuredClone(visualBuilt.premium_build.premium_build.artifact.visual_implementation);
tampered.layout.container_width='120rem';tampered.spacing.section='1rem';tampered.radius.card='3rem';
const visualRepair=runVisualRepairLoop({artifact:{...visualBuilt.artifact,files:{...visualBuilt.artifact.files}},implementation:tampered},visualBuilt.premium_build.premium_build.interpretation.structured_spec,{level:'PREMIUM',max_attempts:3});
assert.equal(visualRepair.fidelity_report.status,'PASS');assert.ok(visualRepair.repair_history.length>=1);pass('D-visual-repair',{attempts:visualRepair.repair_history.length});

// E — responsive failure and bounded repair
const responsive=repairResponsiveModel({horizontal_overflow:true,heading_overflow:true,mobile_grid_columns:3,button_clipping:true,navigation_overlap:true,image_overflow:true},3);
assert.equal(responsive.qa.status,'PASS');assert.ok(responsive.repair_history.length>=1);assert.equal(responsive.fail_closed,false);pass('E-responsive-repair');

// F — SEO failure and general self-healing
const strategy=createWebsiteStrategy(consulting.mission);const ia=createInformationArchitecture(strategy,consulting.mission);const pageIntents=createPageIntentContracts(ia,strategy,consulting.mission);const seo=createSeoArchitecture(pageIntents.pages,consulting.mission,ia);
seo.pages[0].title='';seo.pages[0].heading_hierarchy.h1_count=2;seo.pages[0].internal_links.push({from:'home',to:'missing-page'});
assert.equal(runTechnicalSeoQa(seo,ia,{environment:'staging'}).status,'BLOCK');
const healSeo=runGeneralSelfHealingWebsiteLoop({seo,architecture:ia,responsive_model:{mobile_grid_columns:1},accessibility_model:{semantic_structure:true,keyboard_intent:true,focus_state:true,touch_target_px:44,heading_nesting:'valid',form_error_intent:true,reduced_motion:true},performance_model:{total_asset_kb:100,js_kb:20,images:[],third_party_scripts:0},technical_QA:{status:'PASS'},security_QA:{status:'PASS'},CRO_QA:{status:'PASS'},visual_QA:{status:'PASS'}},{max_attempts:3});
assert.equal(healSeo.final_QA.seo.status,'PASS');pass('F-seo-repair');

// G — accessibility failure and safe repair
const a11y=repairAccessibilityModel({semantic_structure:true,missing_label:true,missing_alt:true,keyboard_intent:true,focus_state:false,low_contrast:true,touch_target_px:32,heading_nesting:'invalid',form_error_intent:false,reduced_motion:false},3);
assert.equal(a11y.qa.status,'PASS');assert.match(a11y.model.alt_policy,/requires-author-supplied-alt/);pass('G-accessibility-repair');

// H — competitor intelligence + differentiation without copying
const competitor=analyzeCompetitorReferences(architectureFixture.mission.competitor_references);
assert.equal(competitor.competitors_analyzed,1);assert.ok(competitor.recommended_differentiation.length>0);assert.equal(consulting.differentiation.competitor_copying_allowed,false);pass('H-competitor-intelligence');

// I — migration/redirect/content safety
const migration=createMigrationIntelligence({...migrationFixture.mission.existing_website,poor_mobile:true,weak_SEO:true,outdated_layout:true,broken_links:['/old-missing']});
assert.equal(migration.status,'READY_FOR_STAGED_ANALYSIS');assert.equal(migration.content_migration_safety.silent_content_loss_allowed,false);assert.ok(migration.redirect_plan.length>=1);assert.equal(migration.reverse_engineering.proprietary_source_reuse_allowed,false);pass('I-migration');

// J — cross-factory contracts only, no writes
assert.ok(consulting.integrations.correlation_id.startsWith('corr-web-'));assert.equal(consulting.integrations.website_to_business.mutation_owner,'business-factory');assert.equal(consulting.integrations.website_to_automation.execution_owner,'automation-factory');assert.equal(consulting.integrations.external_side_effects,false);assert.equal(consulting.delivery_manifest.AI_content_request.external_execution,false);pass('J-cross-factory');

// K — DE/EN/FR/IT localization + hreflang
const loc=createLocalizationV2(consulting.mission,{primary_language:'de',languages:['de','en','fr','it'],currency:'EUR'},pageIntents.pages);
assert.deepEqual(loc.locales,['de','en','fr','it']);assert.equal(loc.hreflang_ready,true);assert.equal(loc.currency.automatic_change,false);assert.ok(loc.hreflang_relationships.length>=pageIntents.pages.length*4);pass('K-localization');

// L — rights/originality: generic layout influence allowed conceptually, foreign assets replacement required
const rights=evaluateReferenceOriginality([{reference_id:'rights',source:'synthetic',role:'global_style',priority:90,allowed_influence:['layout','spacing'],excluded_elements:['logo','photography'],match_strength:.8,analysis:{visual_style:'minimal'},elements:[{element_id:'layout',element_type:'generic_design_principle',rights_status:'unknown',allowed_for_reimplementation:false},{element_id:'foreign-logo',element_type:'logo',rights_status:'unknown',allowed_for_reimplementation:false},{element_id:'foreign-photo',element_type:'photography',rights_status:'unknown',allowed_for_reimplementation:false}]}]);
assert.equal(rights.blind_pixel_clone,false);assert.ok(rights.replacement_required.some((e)=>e.element_type==='logo'));assert.ok(rights.replacement_required.some((e)=>e.element_type==='photography'));pass('L-rights-safety');

// Broad architecture coverage beyond the 12 scenarios
for(const industry of ['local services','consulting','agency','restaurant','hospitality','real estate','dentist','law firm','fitness','ecommerce','SaaS','professional services']) assert.ok(getWebsiteRecipe(industry).recommended_pages.length>=5);
assert.equal(componentSystemManifest().canonical_components.includes('pricing'),true);
assert.equal(createFormContract({fields:[{id:'email',type:'email',required:true}]}).required_fields[0],'email');
assert.equal(createStructuredDataContract('LocalBusiness',{}).status,'DATA_REQUIRED');
assert.equal(providerCapabilityMatrix().providers.webflow.CMS,5);
const cms=createCmsContract({collections:[{name:'articles',fields:['title'],relations:['author']},{name:'authors',fields:['name'],relations:[]}],editors:4,editing_frequency:'daily',workflow_complexity:2});
assert.equal(detectCmsNecessity(cms).classification,'complex_cms');
assert.equal(selectLifecycleProviderRoute({cms_requirements:cms,quality_level:'STANDARD',synthetic_test_data_only:true}).selected.route_id,'webflow-cms-specialist-candidate');
assert.equal(selectLifecycleProviderRoute({operator_overrides:{provider:'framer'},quality_level:'PREMIUM',synthetic_test_data_only:true}).selected.route_id,'framer-design-native-cloudflare');
assert.equal(selectLifecycleProviderRoute({operator_overrides:{provider:'lovable'},quality_level:'STANDARD',synthetic_test_data_only:true}).selected.route_id,'lovable-rapid-prototype-candidate');
assert.equal(createWebsiteVersion({website_version:'2.1.0'}).website_version,'2.1.0');
const impact=analyzeChangeImpact({type:'component',target:'hero'},{pages:[{page_id:'home',components:['hero']},{page_id:'about',components:['hero']}],components:[{component:'hero'}]});assert.equal(impact.affected_pages.length,2);assert.equal(calculateBlastRadius({type:'form_schema',target:'lead-form'},{pages:[],components:[]}).severity,'CROSS_FACTORY');
assert.equal(createRollbackContract({previous_known_good:'build-good',failed_build:'build-bad'}).automatic_production_switch,false);
assert.equal(createDeploymentContract({build_output:'projects/test',provider:'cloudflare'}).safe_cloudflare_gate_required,true);assert.equal(createSecurityHeadersContract().content_type_protections,'nosniff');
assert.equal(reviewAnalyticsQuality([{event:'page_view',payload:{project_id:'x'}}]).status,'PASS');assert.equal(createPosthogExperimentContract().automatic_production_promotion,false);
assert.equal(createVisualRegressionFixture({x:1},{x:1}).equal,true);
const screenshot=await runScreenshotComparison(consulting.premium_build.premium_build.screenshot_comparison.job);assert.equal(screenshot.executed,false);assert.equal(screenshot.pixel_comparison_claimed,false);
const proposal=executeWebFactoryTask({capability:'web.os.v2.proposal',website_mission:bakeryFixture.mission},{now:'2026-08-30T05:20:00.000Z'});assert.equal(proposal.status,'PROPOSAL_READY');
const adapterBuild=executeWebFactoryTask({capability:'web.os.v2.build',website_mission:{...bakeryFixture.mission,project_slug:'bakery-v2-adapter'}},{now:'2026-08-30T05:20:00.000Z'});assert.equal(adapterBuild.ok,true);
assert.equal(results.length,12);assert.ok(results.every((r)=>r.status==='PASS'));

console.log(JSON.stringify({ok:true,suite:'web-factory-operating-system-v2',scenarios:results,quality_score:consulting.quality_score.score,provider_route:consulting.provider_route.selected.route_id,screenshot_comparison_executed:screenshot.executed,variable_cost_eur:0,production_deploy:false},null,2));
