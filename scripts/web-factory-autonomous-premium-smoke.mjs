import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AUTONOMOUS_QUALITY_LEVELS,
  STANDARD_WEBSITE_EVENTS,
  analyzeCompetitorReferences,
  buildAutonomousPremiumWebsite,
  createExperimentContract,
  createLocalizationArchitecture,
  createMigrationPlan,
  createMotionDesignContract,
  evaluateReferenceOriginality,
  executeWebFactoryTask,
  fuseVisualReferences,
  getIndustryPattern,
  runScreenshotComparison,
  runVisualRepairLoop,
  screenshotToDesignSpecManifest,
  selectWebBuildRoute,
  validateWebsiteMission,
  websiteMissionContractManifest
} from '../src/web-factory/index.js';

const load = async (name) => JSON.parse(await readFile(new URL(`../fixtures/web-factory/${name}`, import.meta.url), 'utf8'));
const architectureFixture = await load('autonomous-premium-architecture.json');
const bakeryFixture = await load('autonomous-local-service-bakery.json');
const migrationFixture = await load('autonomous-migration-consulting.json');

const contractManifest = websiteMissionContractManifest();
assert.ok(contractManifest.optional.includes('visual_references'));
assert.ok(contractManifest.optional.includes('competitor_references'));
assert.equal(contractManifest.blind_pixel_clone_allowed, false);

const screenshotSpec = screenshotToDesignSpecManifest();
assert.equal(screenshotSpec.provider_neutral, true);
assert.equal(screenshotSpec.pixel_clone_allowed, false);
assert.ok(screenshotSpec.extractable_fields.includes('visual_hierarchy'));

const conflictFusion = fuseVisualReferences([
  { reference_id:'low', role:'spacing', priority:40, match_strength:1, analysis:{ spacing_rhythm:{section:'4rem'} } },
  { reference_id:'high', role:'spacing', priority:90, match_strength:1, analysis:{ spacing_rhythm:{section:'7rem'} } }
]);
assert.equal(conflictFusion.fused_attributes.spacing_rhythm.section, '7rem');
assert.equal(conflictFusion.provenance.spacing_rhythm.reference_id, 'high');
assert.ok(conflictFusion.conflicts.some((item) => item.attribute === 'spacing_rhythm'));

const architecture = buildAutonomousPremiumWebsite(architectureFixture, { now:'2026-08-30T15:00:00.000Z' });
assert.equal(architecture.ok, true);
assert.equal(architecture.status, 'VERIFIED_AUTONOMOUS_PREMIUM_WEB_DELIVERABLE');
assert.equal(architecture.provider_route.selected.route_id, 'native-premium-cloudflare');
assert.equal(architecture.provider_route.selected.hosting_provider, 'cloudflare');
assert.equal(architecture.variable_cost_eur, 0);
assert.equal(architecture.production_deploy, false);
assert.equal(architecture.technical_QA.status, 'PASS');
assert.equal(architecture.visual_fidelity.status, 'PASS');
assert.ok(architecture.visual_fidelity.visual_fidelity_score >= AUTONOMOUS_QUALITY_LEVELS.PREMIUM.fidelity_target);
assert.equal(architecture.visual_fidelity.pixel_comparison_executed, false);
assert.equal(architecture.visual_fidelity.no_fake_score, true);
assert.equal(architecture.visual_quality.status, 'PASS');
assert.equal(architecture.CRO_result.status, 'PASS');
assert.equal(architecture.design_intent.intent.card_geometry.radius, '0.25rem');
assert.match(architecture.design_intent.intent.decorative_patterns, /minimal/);
assert.equal(architecture.competitor_intelligence.competitors_analyzed, 1);
assert.ok(architecture.originality.replacement_required.some((item) => item.element_type === 'photography'));
assert.ok(architecture.originality.replacement_required.some((item) => item.element_type === 'custom_icon'));
assert.equal(architecture.delivery_manifest.production_status, 'DISABLED');
assert.equal(architecture.delivery_manifest.business_integration_hooks.cross_factory_execution, false);
assert.equal(architecture.delivery_manifest.cost_metadata.estimated_build_cost, 0);
assert.equal(architecture.delivery_manifest.cost_metadata.estimated_monthly_provider_cost, 0);
assert.ok(architecture.observability.some((item) => item.event === 'references_analyzed'));
assert.ok(architecture.observability.some((item) => item.event === 'CRO_changes'));
assert.ok(Object.keys(architecture.artifact.files).every((file) => file.startsWith(`${architecture.artifact.project_root}/`)));

const singleReference = buildAutonomousPremiumWebsite(bakeryFixture, { now:'2026-08-30T15:00:00.000Z' });
assert.equal(singleReference.ok, true);
assert.equal(singleReference.visual_reference_fusion.analyses.filter((item) => item.observed).length, 1);
assert.equal(singleReference.industry_pattern.industry_key, 'local services');
assert.equal(singleReference.CRO_result.status, 'PASS');
assert.ok(singleReference.business_integration_hooks.standard_events.some((item) => item.event === 'lead_created_request'));
assert.ok(singleReference.business_integration_hooks.standard_events.every((item) => item.raw_form_payload_in_analytics === false));
assert.equal(singleReference.localization.primary_language, 'de');
assert.equal(singleReference.localization.currency_policy.currency, 'EUR');
assert.equal(singleReference.localization.currency_policy.automatic_currency_change, false);

const migration = buildAutonomousPremiumWebsite(migrationFixture, { now:'2026-08-30T15:00:00.000Z' });
assert.equal(migration.ok, true);
assert.equal(migration.visual_reference_fusion.status, 'NO_ANALYZED_REFERENCES');
assert.equal(migration.migration.status, 'READY_FOR_STAGED_ANALYSIS');
assert.equal(migration.migration.content_inventory.length, 3);
assert.equal(migration.migration.rights_gate.status, 'PASS');
assert.equal(migration.localization.languages.length, 4);
assert.equal(migration.industry_pattern.industry_key, 'consulting');
assert.equal(migration.competitor_intelligence.competitors_analyzed, 1);
assert.ok(migration.website_strategy.recommended_pages.includes('insights'));

const brandOnlyMission = validateWebsiteMission(migrationFixture.mission);
assert.equal(brandOnlyMission.ok, true);
assert.equal(brandOnlyMission.mission.visual_references.length, 0);
assert.ok(brandOnlyMission.mission.existing_brand);

const rights = evaluateReferenceOriginality(architectureFixture.mission.visual_references);
assert.equal(rights.blind_pixel_clone, false);
assert.equal(rights.high_fidelity_overrides_rights, false);
assert.equal(rights.originality_status, 'REPLACEMENT_REQUIRED');

const motion = createMotionDesignContract([{ type:'parallax', purpose:'Create depth around a spatial diagram', trigger:'scroll', duration:0, intensity:'low' }]);
assert.equal(motion.items[0].reduced_motion_required, true);
assert.ok(motion.items[0].accessibility_fallback);

const localization = createLocalizationArchitecture(architectureFixture.mission, { primary_language:'en', languages:['en','de','fr','it'], currency:'EUR' });
assert.deepEqual(localization.languages, ['en','de','fr','it']);
assert.equal(localization.hreflang_ready, true);

const migrationPlan = createMigrationPlan(migrationFixture.mission.existing_website);
assert.equal(migrationPlan.design_structure_audit.external_fetch_executed, false);
assert.equal(migrationPlan.design_structure_audit.screenshot_runtime_executed, false);

const competitor = analyzeCompetitorReferences([{ reference_id:'no-analysis', source:'synthetic' }]);
assert.equal(competitor.competitors_analyzed, 0);
assert.equal(competitor.competitor_insights[0].evidence_status, 'EXTERNAL_ANALYSIS_REQUIRED');

const tampered = structuredClone(architecture.premium_build.artifact.visual_implementation);
tampered.layout.container_width = '120rem';
tampered.layout.navigation_behavior = 'static';
tampered.typography.heading_scale = { xl:'1rem' };
tampered.responsive = [];
tampered.components.find((item) => item.component === 'Hero').geometry = { content_max_width:'40ch' };
tampered.pages.find((item) => item.id === 'home').section_order = ['cta','hero'];
const repair = runVisualRepairLoop(
  { artifact:{ ...architecture.artifact, files:{ ...architecture.artifact.files } }, implementation:tampered },
  architecture.premium_build.interpretation.structured_spec,
  { level:'PREMIUM', max_attempts:3 }
);
assert.equal(repair.fidelity_report.status, 'PASS');
assert.ok(repair.repair_history.length >= 1);
assert.ok(repair.repair_history[0].before_state);
assert.ok(repair.repair_history[0].after_state);
assert.equal(repair.fail_closed, false);

const screenshot = await runScreenshotComparison(architecture.premium_build.screenshot_comparison.job);
assert.equal(screenshot.executed, false);
assert.equal(screenshot.pixel_comparison_claimed, false);
assert.equal(screenshot.status, 'NOT_EXECUTED_RUNTIME_UNAVAILABLE');

const highFidelity = buildAutonomousPremiumWebsite({ ...architectureFixture, quality_level:'HIGH_FIDELITY', mission:{ ...architectureFixture.mission, quality_level:'HIGH_FIDELITY' } }, { now:'2026-08-30T15:00:00.000Z' });
assert.equal(highFidelity.ok, false);
assert.equal(highFidelity.visual_fidelity.status, 'FAIL');
assert.ok(highFidelity.visual_fidelity.blocking_differences.some((item) => item.code === 'SCREENSHOT_EVIDENCE_REQUIRED_FOR_HIGH_FIDELITY'));

const framerRoute = selectWebBuildRoute({ premium_visual:true, native_premium:false, quality_level:'PREMIUM', synthetic_test_data_only:true, environment:'staging' });
assert.equal(framerRoute.selected.route_id, 'framer-design-native-cloudflare');
assert.equal(framerRoute.selected.design_provider, 'framer');
assert.equal(framerRoute.selected.build_provider, 'riosystems-native-web-builder');
assert.equal(framerRoute.selected.hosting_provider, 'cloudflare');
assert.equal(framerRoute.selected.constraints.framer_hosting_default, false);

const experiment = createExperimentContract({ variant_id:'hero-proof-first', metric:'cta_clicked' });
assert.equal(experiment.rollout_status, 'DRAFT_NO_PRODUCTION_ROLLOUT');
assert.equal(experiment.automatic_production_switch, false);
assert.ok(STANDARD_WEBSITE_EVENTS.includes('page_view'));
assert.ok(STANDARD_WEBSITE_EVENTS.includes('form_submitted'));

const viaAdapter = executeWebFactoryTask({ capability:'web.autonomous.premium.build', website_mission:bakeryFixture.mission, quality_level:'STANDARD', use_framer_visual_specialist:false }, { now:'2026-08-30T15:00:00.000Z' });
assert.equal(viaAdapter.ok, true);
assert.equal(viaAdapter.status, 'VERIFIED_AUTONOMOUS_PREMIUM_WEB_DELIVERABLE');

console.log(JSON.stringify({
  ok:true,
  suite:'web-factory-autonomous-premium-intelligence-v1',
  use_cases:['premium-architecture-multi-reference','local-service-single-reference','consulting-migration-brand-only'],
  architecture_pages:architecture.artifact.pages.length,
  bakery_pages:singleReference.artifact.pages.length,
  migration_pages:migration.artifact.pages.length,
  architecture_fidelity:architecture.visual_fidelity.visual_fidelity_score,
  visual_repair_attempts:repair.repair_history.length,
  screenshot_comparison_executed:screenshot.executed,
  high_fidelity_without_screenshot:highFidelity.status,
  variable_cost_eur:0,
  production_deploy:false
}, null, 2));
