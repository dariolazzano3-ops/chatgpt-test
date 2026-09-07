import { buildWebsiteProject } from './factory.js';
import { reconstructPremiumWebsite } from './native-reconstruction.js';
import { buildAutonomousPremiumWebsite } from './autonomous-premium.js';
import { runWebOperatingSystemV2 } from './operating-system-v2.js';
import { webProviderRoleModel } from './provider-roles.js';
import { selectWebBuildRoute } from './routing.js';
import { adaptProjectContextToWebMission } from './project-context-adapter-v1.js';
import { executeReferenceStudioTask } from './reference-studio-v1.js';
import { createReferenceDesignContract, verifyReferenceDesignContract, diffReferenceDesignContracts } from './reference-design-contract-v1.js';
import { premiumComponentRegistry, getPremiumComponentContract, validatePremiumComponentPayload, selectPremiumComponent } from './premium-component-registry-v1.js';
import { createAssetMediaPipeline, createImageMediaContract, createVideoMediaContract, validateAssetMediaPipeline } from './asset-media-pipeline-v1.js';
import { createMotionDesignContract, createMotionRuntimePlan } from './motion-localization.js';
import { createMotionQualityGate } from './lifecycle-governance-v2.js';
import { createEvidenceSafeContentContract, runContentRenderGuard, createSeoEvidenceBundle, applySeoStaticArtifacts, contentSeoEvidenceManifest } from './content-seo-evidence-v2.js';
import { createVisualClosureContract, segmentVisualDeltas, createVisualRootCauseReport, createBoundedVisualRepairPlan, visualClosureLoopManifest } from './visual-closure-loop-v1.js';

const CAPABILITIES = new Set(['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal', 'web.reference.studio.v1', 'web.reference.design-contract.v1', 'web.components.registry.v1', 'web.assets.media.v1', 'web.motion.contract.v1', 'web.content-seo.v2', 'web.visual.closure.v1', 'web_generate', 'web_rebuild', 'web_evolve']);

function resolveMission(task = {}) {
  const raw = task.website_mission || task.input || task.mission || {};
  const projectContext = task.project_context || raw.project_mission_context || task.mission_package?.project_context || null;
  if (!projectContext) return { ok: true, mission: raw, project_context_bound: false };
  return adaptProjectContextToWebMission(projectContext, raw);
}

export function executeWebFactoryTask(task = {}, options = {}) {
  const capability = String(task.capability || 'web.build');
  if (!CAPABILITIES.has(capability)) return { ok: false, status: 'UNSUPPORTED_WEB_CAPABILITY', capability, production_deploy: false, variable_cost_eur: 0 };
  if (capability === 'web.reference.studio.v1') return executeReferenceStudioTask(task, options);
  if (capability === 'web.visual.closure.v1') {
    const operation=String(task.operation || 'contract').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'VISUAL_CLOSURE_MANIFEST_READY', manifest:visualClosureLoopManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'segment') return { ok:true, status:'VISUAL_DELTAS_SEGMENTED', segmentation:segmentVisualDeltas(task.report || {}, task), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'repair_plan') {
      const segmentation=task.segmentation || segmentVisualDeltas(task.report || {},task);
      const root_cause=task.root_cause || createVisualRootCauseReport(segmentation);
      return { ok:true, status:'BOUNDED_VISUAL_REPAIR_PLAN_READY', plan:createBoundedVisualRepairPlan(segmentation,root_cause,task), production_deploy:false, variable_cost_eur:0 };
    }
    return createVisualClosureContract(task);
  }
  if (capability === 'web.content-seo.v2') {
    const operation=String(task.operation || 'content').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'CONTENT_SEO_EVIDENCE_MANIFEST_READY', manifest:contentSeoEvidenceManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'render_guard') return runContentRenderGuard(task.artifact || {}, task.contract || {});
    if (operation === 'seo') return createSeoEvidenceBundle(task);
    if (operation === 'apply_seo_artifacts') return applySeoStaticArtifacts(task.build || {}, task.bundle || {}, task);
    const contract=createEvidenceSafeContentContract(task);
    return { ok:contract.status!=='BLOCK', status:contract.status==='BLOCK'?'CONTENT_EVIDENCE_BLOCKED':'CONTENT_EVIDENCE_READY', contract, production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.motion.contract.v1') {
    const contract=createMotionDesignContract(task.motion_intent || task.items || [], { quality_level:task.quality_level || 'PREMIUM' });
    const runtime=createMotionRuntimePlan(contract);
    const quality=createMotionQualityGate(contract);
    return { ok:quality.status!=='BLOCK', status:quality.status==='BLOCK'?'MOTION_CONTRACT_BLOCKED':'MOTION_CONTRACT_READY', contract, runtime, quality, production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.assets.media.v1') {
    const operation=String(task.operation || 'pipeline').toLowerCase();
    if (operation === 'image') return createImageMediaContract(task.asset || task);
    if (operation === 'video') return createVideoMediaContract(task.asset || task);
    if (operation === 'validate') return validateAssetMediaPipeline(task.manifest || task);
    return createAssetMediaPipeline(task);
  }
  if (capability === 'web.components.registry.v1') {
    const operation=String(task.operation || 'registry').toLowerCase();
    if (operation === 'get') return { ok:true, status:'COMPONENT_CONTRACT_READY', contract:getPremiumComponentContract(task.component_id), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'validate') return validatePremiumComponentPayload(task.component_id, task.payload || task);
    if (operation === 'select') return { ...selectPremiumComponent(task), production_deploy:false, variable_cost_eur:0 };
    return { ok:true, status:'PREMIUM_COMPONENT_REGISTRY_READY', registry:premiumComponentRegistry(), production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.reference.design-contract.v1') {
    const operation=String(task.operation || 'create').toLowerCase();
    if (operation === 'verify') return verifyReferenceDesignContract(task.contract);
    if (operation === 'diff') return diffReferenceDesignContracts(task.before, task.after);
    return createReferenceDesignContract(task);
  }
  const resolved = resolveMission(task);
  if (!resolved.ok) return { ok: false, status: resolved.error, project_context_bound: true, production_deploy: false, variable_cost_eur: 0 };
  const mission = resolved.mission;
  if (capability === 'web.os.v2.build' || capability === 'web.os.v2.proposal') return runWebOperatingSystemV2({ ...task, mission, project_context: mission.project_mission_context || task.project_context || null, mode: capability === 'web.os.v2.proposal' ? 'proposal' : task.mode }, options);
  if (capability === 'web.autonomous.premium.build') return buildAutonomousPremiumWebsite({ ...task, mission, project_context: mission.project_mission_context || task.project_context || null, quality_level: task.quality_level || task.routing_context?.quality_level || mission.quality_level || 'PREMIUM' }, options);

  const routingContext = task.routing_context || {};
  const route = selectWebBuildRoute({ ...routingContext, premium_visual: capability === 'web.premium.build' || routingContext.premium_visual === true, quality_level: routingContext.quality_level || (capability === 'web.premium.build' ? 'PREMIUM' : 'STANDARD'), synthetic_test_data_only: mission.synthetic_test_data_only === true, environment: 'staging' });
  if (route.selected.route_id === 'framer-design-native-cloudflare') {
    if (!task.design_contract) return { ok: false, status: 'VISUAL_DESIGN_CONTRACT_REQUIRED', route, next_stage: 'framer_visual_design_or_provider_neutral_design_handoff', production_deploy: false, variable_cost_eur: 0 };
    return reconstructPremiumWebsite({ mission, project_context: mission.project_mission_context || task.project_context || null, design_contract: task.design_contract, routing_context: routingContext, framer_status: task.framer_status || {} }, options);
  }
  if (['webflow-cms-specialist-candidate', 'lovable-rapid-prototype-candidate'].includes(route.selected.route_id)) return { ok: false, status: 'SPECIALIST_REVIEW_REQUIRED', route, production_deploy: false, variable_cost_eur: 0 };
  return buildWebsiteProject(mission, options);
}


export function executeCanonicalNativeWebTask(task = {}, options = {}) {
  const execution = executeWebFactoryTask(task, options);
  const actualCost = Number(execution?.variable_cost_eur ?? 0);
  if (!execution?.ok) {
    return {
      ok: false,
      status: 'FAILED',
      error: execution?.status || execution?.error || 'NATIVE_WEB_FACTORY_EXECUTION_FAILED',
      message: execution?.validation?.requirements?.map((item) => item.message).filter(Boolean).join(', ') || null,
      actual_provider: 'riosystems-native-web',
      executor_id: 'web-factory-native-v1',
      actual_cost_eur: Number.isFinite(actualCost) ? actualCost : 0,
      provider_call_count: 0,
      external_write_state: 'NO_EXTERNAL_CUSTOMER_WRITE',
      internal_project_artifact: false,
      external_side_effect_performed: false,
      production_deploy: false,
      factory_result: execution || null
    };
  }

  return {
    ok: true,
    status: 'COMPLETED',
    outputs: {
      build_id: execution.artifact?.build_id || null,
      artifact_ref: execution.artifact?.project_root || null,
      preview_url: execution.delivery_manifest?.preview_url || null,
      qa_status: execution.qa_result?.status || null,
      qa_score: execution.qa_result?.score ?? null,
      file_count: Object.keys(execution.artifact?.files || {}).length,
      delivery_status: execution.delivery_manifest?.deployment_status || null
    },
    actual_provider: 'riosystems-native-web',
    executor_id: 'web-factory-native-v1',
    actual_cost_eur: Number.isFinite(actualCost) ? actualCost : 0,
    provider_call_count: 0,
    external_write_state: 'NO_EXTERNAL_CUSTOMER_WRITE',
    internal_project_artifact: true,
    external_side_effect_performed: false,
    production_deploy: false,
    factory_result: execution
  };
}

export function webFactoryProviderManifest() {
  return {
    schema: 'riosystems.web-factory-provider.v2', provider_id: 'riosystems-native-web-builder', capabilities: ['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal', 'web.reference.studio.v1', 'web.reference.design-contract.v1', 'web.components.registry.v1', 'web.assets.media.v1', 'web.motion.contract.v1', 'web.content-seo.v2', 'web.visual.closure.v1'], aliases: ['web_generate', 'web_rebuild', 'web_evolve'],
    roles: { 'riosystems-native-web-builder': 'native_builder', framer: 'visual_specialist', webflow: 'cms_specialist', lovable: 'rapid_prototyper', cloudflare: 'hosting_provider' }, role_specializations: { framer: 'premium_visual_specialist' }, role_model: webProviderRoleModel(),
    strategy: { operating_system: 'riosystems-web-operating-system-v2', primary: ['riosystems-native-web-builder', 'github', 'cloudflare-pages-preview'], visual_specialist: ['framer'], cms_specialist: ['webflow'], rapid_prototyper: ['lovable'], hosting_provider: ['cloudflare'], optional_accelerators: ['lovable'], specialists: ['framer', 'webflow'] },
    premium_visual_path: ['framer', 'riosystems-native-web-builder', 'cloudflare'], autonomous_premium_path: ['riosystems-autonomous-design-intelligence', 'riosystems-native-web-builder', 'cloudflare'], web_os_v2_path: ['business-intent', 'strategy', 'architecture', 'design-intent', 'native-build', 'multi-domain-QA', 'self-healing', 'integration-contracts', 'delivery'],
    project_context_adapter: 'aurentara.project-context-web-adapter.v1', provider_routing_authority_unchanged: true, framer_hosting_default: false, deterministic_zero_cost_mode: true, ai_provider_required: false, automatic_paid_fallback: false, variable_cost_ceiling_eur: 0, production_deploy: false
  };
}
