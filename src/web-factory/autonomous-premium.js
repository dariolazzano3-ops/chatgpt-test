import { validateWebsiteMission } from './contracts.js';
import { fuseVisualReferences, evaluateReferenceOriginality } from './reference-intelligence.js';
import { getIndustryPattern } from './industry-brain.js';
import { analyzeCompetitorReferences } from './competitor-intelligence.js';
import { createDesignIntent, designIntentToVisualContract } from './design-intent-engine.js';
import { directVisualQuality, reviewCro, applyCroMissionRepairs } from './quality-cro.js';
import { createMotionDesignContract, createLocalizationArchitecture } from './motion-localization.js';
import { createMigrationPlan, createBusinessIntegrationPlan, createExperimentContract } from './migration-integration.js';
import { reconstructPremiumWebsite } from './native-reconstruction.js';

export const AUTONOMOUS_QUALITY_LEVELS = Object.freeze({
  STANDARD:{ fidelity_target:85, max_visual_repair_attempts:2, design_depth:'standard', motion_depth:'low', default_visual_specialist:false },
  PREMIUM:{ fidelity_target:93, max_visual_repair_attempts:3, design_depth:'deep', motion_depth:'medium', default_visual_specialist:false },
  HIGH_FIDELITY:{ fidelity_target:97, max_visual_repair_attempts:4, design_depth:'deep', motion_depth:'high-controlled', default_visual_specialist:true, screenshot_evidence_required:true }
});

function qualityLevel(value) {
  const key = String(value || 'PREMIUM').toUpperCase();
  return AUTONOMOUS_QUALITY_LEVELS[key] ? key : 'PREMIUM';
}

function websiteStrategy(mission, industry, competitor) {
  return {
    schema:'riosystems.website-strategy.v1',
    primary_goal:mission.primary_goal,
    conversion_goal:mission.conversion_goal,
    target_audience:mission.target_audience,
    positioning:mission.brand_positioning,
    recommended_pages:[...new Set([...(mission.required_pages || []), ...(industry.recommended_pages || [])])],
    trust_patterns:industry.trust_patterns,
    cta_patterns:industry.cta_patterns,
    content_blocks:industry.content_blocks,
    differentiation:competitor.recommended_differentiation,
    strategy_principles:['clarity_before_complexity','original_owned_implementation','privacy_safe_conversion','low_lock_in_hosting']
  };
}

function createObserver(buildId, at) {
  const events = []; let sequence = 0;
  return {
    emit(event, payload = {}) { sequence += 1; events.push({ sequence, build_id:buildId, at, event, payload }); },
    events
  };
}

function enrichedManifest({ build, strategy, intent, fusion, competitor, industry, motion, localization, visualQuality, cro, integration, migration, experiment, originality, observer, quality }) {
  const base = build.delivery_manifest || build.artifact?.delivery_manifest || {};
  return {
    ...base,
    schema:'riosystems.web-delivery-manifest.v2',
    website_strategy:strategy,
    design_intent:intent,
    visual_references:{ references:fusion.references, analyses:fusion.analyses, fusion:{ status:fusion.status, provenance:fusion.provenance, conflicts:fusion.conflicts } },
    competitor_insights:competitor,
    industry_pattern:industry,
    design_system:build.design_system || build.artifact?.design_system || base.design_system,
    pages:build.base_build?.blueprint?.pages || base.pages || [],
    components:build.artifact?.components_used || base.components_used || [],
    motion,
    localization,
    visual_quality:visualQuality,
    visual_fidelity:build.visual_fidelity,
    CRO_result:cro,
    SEO_result:build.website_qa?.categories?.seo || null,
    accessibility_result:build.website_qa?.categories?.accessibility || null,
    technical_QA:build.website_qa,
    repair_history:{ technical:build.base_build?.repair_history || [], visual:build.visual_repair_history || [], cro:cro.repair_history || [] },
    business_integration_hooks:integration,
    migration,
    experiment_architecture:experiment,
    provider_route:build.route,
    cost_metadata:build.route?.selected?.cost_metadata || base.cost_metadata || null,
    originality_status:originality.originality_status,
    replacement_required:originality.replacement_required,
    asset_warnings:originality.asset_warnings,
    deployment_status:build.base_build?.deployment?.status || base.deployment_status || 'READY_FOR_STAGING',
    warnings:[...(base.warnings || []), ...(originality.asset_warnings || []), ...((visualQuality.warnings || []).map((item) => item.repair_instruction).filter(Boolean))],
    quality_level:quality,
    observability:{ event_count:observer.events.length, events_file:`${build.artifact.project_root}/autonomous-build-observability.json` },
    production_status:'DISABLED', production_deploy:false
  };
}

export function buildAutonomousPremiumWebsite(input = {}, options = {}) {
  const rawMission = input.mission || input.website_mission || input;
  const validation = validateWebsiteMission(rawMission);
  if (!validation.ok) return { ok:false, status:'REQUIREMENTS_REQUIRED', validation, variable_cost_eur:0, production_deploy:false };

  const quality = qualityLevel(input.quality_level || rawMission.quality_level || options.quality_level);
  const qualityPolicy = AUTONOMOUS_QUALITY_LEVELS[quality];
  const now = options.now || new Date().toISOString();
  const buildId = options.build_id || `wf-auto-${validation.mission.project_slug}-${String(now).replace(/[^0-9]/g,'').slice(0,14)}`;
  const observer = createObserver(buildId, now);
  observer.emit('mission_received',{ project_id:validation.mission.project_slug, quality_level:quality });

  const industry = getIndustryPattern(validation.mission.industry);
  const croPreparation = applyCroMissionRepairs(validation.mission, industry);
  const mission = croPreparation.mission;
  const references = mission.visual_references || input.visual_references || [];
  observer.emit('references_received',{ count:references.length });
  const fusion = fuseVisualReferences(references);
  observer.emit('references_analyzed',{ analyzed:fusion.analyses.filter((item) => item.observed).length, unresolved:fusion.analyses.filter((item) => !item.observed).length });
  const originality = evaluateReferenceOriginality(references);

  const competitor = analyzeCompetitorReferences(mission.competitor_references || input.competitor_references || []);
  observer.emit('competitors_analyzed',{ count:competitor.competitors_analyzed });
  const strategy = websiteStrategy(mission, industry, competitor);
  const intent = createDesignIntent({ mission, fusion, industry_pattern:industry, operator_intent:mission.operator_design_intent || input.operator_design_intent || {}, brand:mission.existing_brand });
  observer.emit('design_intent',{ status:intent.status, precedence:intent.precedence });

  const motion = createMotionDesignContract(mission.motion_intent || input.motion_intent || [], { quality_level:quality });
  const localization = createLocalizationArchitecture(mission, mission.localization || input.localization || {});
  const migration = createMigrationPlan(mission.existing_website || input.existing_website || {});
  const integration = createBusinessIntegrationPlan(mission, mission.integration_requirements || input.integration_requirements || {});
  observer.emit('integration_hooks',{ hooks:integration.hooks.map((item) => item.hook_id) });
  const experiment = createExperimentContract(input.experiment || {});

  const designContract = designIntentToVisualContract({ mission, design_intent:intent, industry_pattern:industry, references:fusion.references, motion });
  const useFramer = input.use_framer_visual_specialist === true || mission.provider_preferences?.design_provider === 'framer' || qualityPolicy.default_visual_specialist === true;
  const routingContext = {
    ...(input.routing_context || {}),
    premium_visual:true,
    native_premium:!useFramer,
    use_framer_visual_specialist:useFramer,
    quality_level:quality,
    synthetic_test_data_only:mission.synthetic_test_data_only === true,
    environment:'staging'
  };
  observer.emit('provider_route',{ requested_visual_specialist:useFramer ? 'framer' : 'native' });

  const build = reconstructPremiumWebsite({ mission, design_contract:designContract, routing_context:routingContext, framer_status:input.framer_status || {} }, {
    ...options,
    build_id:buildId,
    fidelity_level:quality,
    max_visual_repair_attempts:options.max_visual_repair_attempts ?? qualityPolicy.max_visual_repair_attempts,
    screenshot_report:input.screenshot_report || options.screenshot_report
  });
  if (!build.artifact) return { ...build, website_strategy:strategy, design_intent:intent, originality_status:originality, variable_cost_eur:0, production_deploy:false };
  observer.emit('pages_generated',{ count:build.artifact.pages?.length || 0 });
  observer.emit('QA_runs',{ website:build.website_qa?.status, visual_fidelity:build.visual_fidelity?.status });
  observer.emit('repair_attempts',{ technical:build.base_build?.repair_history?.length || 0, visual:build.visual_repair_history?.length || 0, cro:croPreparation.repair_history.length });

  const visualQuality = directVisualQuality({ design_intent:intent, visual_contract:designContract, implementation:build.artifact.visual_implementation });
  const cro = reviewCro({ build, mission, industry_pattern:industry, integration_plan:integration });
  cro.repair_history = croPreparation.repair_history;
  observer.emit('CRO_changes',{ repairs:croPreparation.repair_history.length, status:cro.status });

  const blockingRights = build.asset_rights?.status === 'BLOCKED';
  const ok = build.ok && visualQuality.status !== 'BLOCK' && cro.status === 'PASS' && !blockingRights;
  observer.emit('final_status',{ status:ok ? 'VERIFIED_AUTONOMOUS_PREMIUM_WEB_DELIVERABLE' : 'BLOCKED_AUTONOMOUS_PREMIUM_QA' });

  const delivery = enrichedManifest({ build, strategy, intent, fusion, competitor, industry, motion, localization, visualQuality, cro, integration, migration, experiment, originality, observer, quality });
  const root = build.artifact.project_root;
  const files = build.artifact.files;
  files[`${root}/website-strategy.json`] = JSON.stringify(strategy,null,2);
  files[`${root}/design-intent.json`] = JSON.stringify(intent,null,2);
  files[`${root}/reference-fusion.json`] = JSON.stringify(fusion,null,2);
  files[`${root}/competitor-intelligence.json`] = JSON.stringify(competitor,null,2);
  files[`${root}/industry-pattern.json`] = JSON.stringify(industry,null,2);
  files[`${root}/motion-contract.json`] = JSON.stringify(motion,null,2);
  files[`${root}/localization.json`] = JSON.stringify(localization,null,2);
  files[`${root}/cro-review.json`] = JSON.stringify(cro,null,2);
  files[`${root}/visual-quality.json`] = JSON.stringify(visualQuality,null,2);
  files[`${root}/business-integration-hooks.json`] = JSON.stringify(integration,null,2);
  files[`${root}/migration-plan.json`] = JSON.stringify(migration,null,2);
  files[`${root}/experiment-contract.json`] = JSON.stringify(experiment,null,2);
  files[`${root}/originality-report.json`] = JSON.stringify(originality,null,2);
  files[`${root}/autonomous-build-observability.json`] = JSON.stringify(observer.events,null,2);
  files[`${root}/delivery-manifest.json`] = JSON.stringify(delivery,null,2);
  build.artifact.delivery_manifest = delivery;

  return {
    ok,
    status:ok ? 'VERIFIED_AUTONOMOUS_PREMIUM_WEB_DELIVERABLE' : 'BLOCKED_AUTONOMOUS_PREMIUM_QA',
    build_id:buildId,
    quality_level:quality,
    validation,
    website_strategy:strategy,
    visual_reference_fusion:fusion,
    competitor_intelligence:competitor,
    design_intent:intent,
    industry_pattern:industry,
    motion,
    localization,
    migration,
    business_integration_hooks:integration,
    experiment_architecture:experiment,
    originality,
    design_contract:designContract,
    premium_build:build,
    artifact:build.artifact,
    visual_quality:visualQuality,
    visual_fidelity:build.visual_fidelity,
    CRO_result:cro,
    technical_QA:build.website_qa,
    repair_history:delivery.repair_history,
    provider_route:build.route,
    cost_metadata:delivery.cost_metadata,
    delivery_manifest:delivery,
    observability:observer.events,
    variable_cost_eur:0,
    production_deploy:false
  };
}
