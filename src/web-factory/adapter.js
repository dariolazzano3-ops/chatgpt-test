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
import { runApprovedReferenceVisualClosure, visualClosureLoopManifest, verifyApprovedReferenceVisualAsset } from './visual-closure-loop-v1.js';
import { evaluateJ9BrowserMatrix, evaluateJ9Accessibility, evaluateJ9Performance, compileJ9Acceptance, j9BrowserAccessibilityPerformanceManifest } from './browser-accessibility-performance-v2.js';
import { createJ10RevisionLedger, verifyJ10RevisionLedger, createJ10Revision, diffJ10Revisions, analyzeJ10ChangeImpact, createJ10RegressionPlan, createJ10RollbackPlan, runJ10Rollback, j10VersioningDiffRollbackManifest } from './versioning-diff-rollback-v1.js';
import { createJ11WebFactoryControlPlane, deriveJ11ActionMatrix, j11WebFactoryControlPlaneManifest } from './dashboard-control-plane-v1.js';
import { deriveJ12NextBestAction, j12NextBestActionManifest } from './next-best-action-v1.js';
import { createJ13DeliveryLifecycle, registerJ13PrivatePreview, submitJ13CustomerFeedback, recordJ13CustomerRevision, approveJ13CustomerReview, evaluateJ13Delivery, createJ13Handoff, createJ13DeliveryPackage, verifyJ13DeliveryPackage, inspectJ13DeliveryLifecycle, j13DeliveryLifecycleManifest } from './delivery-lifecycle-v1.js';

const CAPABILITIES = new Set(['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal', 'web.reference.studio.v1', 'web.reference.design-contract.v1', 'web.components.registry.v1', 'web.assets.media.v1', 'web.motion.contract.v1', 'web.content-seo.v2', 'web.visual.closure.v1', 'web.acceptance.j9.v2', 'web.versioning.rollback.v1', 'web.dashboard.control-plane.v1', 'web.next-best-action.v1', 'web.delivery.lifecycle.v1', 'web_generate', 'web_rebuild', 'web_evolve']);

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
  if (capability === 'web.delivery.lifecycle.v1') {
    const operation=String(task.operation || 'inspect').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'J13_DELIVERY_LIFECYCLE_MANIFEST_READY', manifest:j13DeliveryLifecycleManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'create') return createJ13DeliveryLifecycle(task.project || task.input?.project || {}, task.input || task, task.options || {});
    if (operation === 'register_private_preview') return registerJ13PrivatePreview(task.state || {}, task.input || task, task.options || {});
    if (operation === 'submit_feedback') return submitJ13CustomerFeedback(task.state || {}, task.input || task, task.options || {});
    if (operation === 'record_revision') return recordJ13CustomerRevision(task.state || {}, task.input || task, task.options || {});
    if (operation === 'approve_customer_review') return approveJ13CustomerReview(task.state || {}, task.input || task, task.options || {});
    if (operation === 'evaluate') return evaluateJ13Delivery(task.state || {}, task.evidence || task.input || {}, task.options || {});
    if (operation === 'handoff') return createJ13Handoff(task.state || {}, task.evidence || task.input || {}, task.options || {});
    if (operation === 'package') return createJ13DeliveryPackage(task.state || {}, task.input || task, task.options || {});
    if (operation === 'verify_package') return verifyJ13DeliveryPackage(task.delivery_package || task.input || task);
    if (operation === 'inspect') return inspectJ13DeliveryLifecycle(task.state || task.input || {}, task.options || {});
    return { ok:false, status:'J13_DELIVERY_LIFECYCLE_OPERATION_UNSUPPORTED', production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.next-best-action.v1') {
    const operation=String(task.operation || 'derive').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'J12_NEXT_BEST_ACTION_MANIFEST_READY', manifest:j12NextBestActionManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'derive') {
      const next_best_action=deriveJ12NextBestAction(task.input || task);
      return { ok:next_best_action.status==='READY', status:next_best_action.status==='READY'?'J12_NEXT_BEST_ACTION_READY':'J12_NEXT_BEST_ACTION_BLOCKED', next_best_action, production_deploy:false, variable_cost_eur:0 };
    }
    return { ok:false, status:'J12_NEXT_BEST_ACTION_OPERATION_UNSUPPORTED', production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.dashboard.control-plane.v1') {
    const operation=String(task.operation || 'project').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'J11_CONTROL_PLANE_MANIFEST_READY', manifest:j11WebFactoryControlPlaneManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'actions') {
      const actions=deriveJ11ActionMatrix(task.input || task);
      return { ok:true, status:'J11_ACTION_MATRIX_READY', actions, production_deploy:false, variable_cost_eur:0 };
    }
    if (operation === 'project') {
      const control_plane=createJ11WebFactoryControlPlane(task.input || task);
      return { ok:control_plane.status==='READY', status:control_plane.status==='READY'?'J11_CONTROL_PLANE_READY':'J11_CONTROL_PLANE_BLOCKED', control_plane, production_deploy:false, variable_cost_eur:0 };
    }
    return { ok:false, status:'J11_CONTROL_PLANE_OPERATION_UNSUPPORTED', production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.versioning.rollback.v1') {
    const operation=String(task.operation || 'manifest').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'J10_VERSIONING_MANIFEST_READY', manifest:j10VersioningDiffRollbackManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'ledger') return createJ10RevisionLedger(task.input || task);
    if (operation === 'verify') {
      const report=verifyJ10RevisionLedger(task.ledger || task.input || task);
      return { ok:report.status==='PASS', status:report.status==='PASS'?'J10_LEDGER_PASS':'J10_LEDGER_FAIL', report, production_deploy:false, variable_cost_eur:0 };
    }
    if (operation === 'append') return createJ10Revision(task.ledger || {}, task.revision || task.input || task);
    if (operation === 'diff') return diffJ10Revisions(task.before || {}, task.after || {});
    if (operation === 'impact') return analyzeJ10ChangeImpact(task.change || task.input || task, task.model || {});
    if (operation === 'regression') return createJ10RegressionPlan(task.previous || {}, task.current || {}, task.change || {}, task.model || {});
    if (operation === 'rollback_plan') return createJ10RollbackPlan(task.ledger || {}, task.input || task);
    if (operation === 'rollback') return runJ10Rollback(task.ledger || {}, task.input || task, task.adapters || options.adapters || {});
    return { ok:false, status:'J10_VERSIONING_OPERATION_UNSUPPORTED', production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.acceptance.j9.v2') {
    const operation=String(task.operation || 'compile').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'J9_ACCEPTANCE_MANIFEST_READY', manifest:j9BrowserAccessibilityPerformanceManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'browser') {
      const report=evaluateJ9BrowserMatrix(task.input || task.browser || task);
      return { ok:report.status==='PASS', status:report.status==='PASS'?'J9_BROWSER_PASS':'J9_BROWSER_FAIL', report, production_deploy:false, variable_cost_eur:0 };
    }
    if (operation === 'accessibility') {
      const report=evaluateJ9Accessibility(task.input || task.accessibility || task);
      return { ok:report.status==='PASS', status:report.status==='PASS'?'J9_ACCESSIBILITY_AUTOMATED_PASS':'J9_ACCESSIBILITY_FAIL', report, production_deploy:false, variable_cost_eur:0 };
    }
    if (operation === 'performance') {
      const report=evaluateJ9Performance(task.input || task.performance || task);
      return { ok:report.status==='PASS', status:report.status==='PASS'?'J9_PERFORMANCE_PASS':'J9_PERFORMANCE_FAIL', report, production_deploy:false, variable_cost_eur:0 };
    }
    if (operation === 'compile') {
      const report=compileJ9Acceptance(task.input || task);
      return { ok:report.status==='PASS', status:report.status==='PASS'?'J9_ACCEPTANCE_PASS':'J9_ACCEPTANCE_FAIL', report, production_deploy:false, variable_cost_eur:0 };
    }
    return { ok:false, status:'J9_ACCEPTANCE_OPERATION_UNSUPPORTED', production_deploy:false, variable_cost_eur:0 };
  }
  if (capability === 'web.visual.closure.v1') {
    const operation=String(task.operation || 'manifest').toLowerCase();
    if (operation === 'manifest') return { ok:true, status:'VISUAL_CLOSURE_MANIFEST_READY', manifest:visualClosureLoopManifest(), production_deploy:false, variable_cost_eur:0 };
    if (operation === 'verify_reference') return verifyApprovedReferenceVisualAsset(task);
    if (operation === 'run') return runApprovedReferenceVisualClosure(task, task.adapters || options.adapters || {});
    return { ok:false, status:'VISUAL_CLOSURE_OPERATION_UNSUPPORTED', production_deploy:false, variable_cost_eur:0 };
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
    schema: 'riosystems.web-factory-provider.v2', provider_id: 'riosystems-native-web-builder', capabilities: ['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal', 'web.reference.studio.v1', 'web.reference.design-contract.v1', 'web.components.registry.v1', 'web.assets.media.v1', 'web.motion.contract.v1', 'web.content-seo.v2', 'web.visual.closure.v1', 'web.acceptance.j9.v2', 'web.versioning.rollback.v1', 'web.dashboard.control-plane.v1', 'web.next-best-action.v1', 'web.delivery.lifecycle.v1'], aliases: ['web_generate', 'web_rebuild', 'web_evolve'],
    roles: { 'riosystems-native-web-builder': 'native_builder', framer: 'visual_specialist', webflow: 'cms_specialist', lovable: 'rapid_prototyper', cloudflare: 'hosting_provider' }, role_specializations: { framer: 'premium_visual_specialist' }, role_model: webProviderRoleModel(),
    strategy: { operating_system: 'riosystems-web-operating-system-v2', primary: ['riosystems-native-web-builder', 'github', 'cloudflare-pages-preview'], visual_specialist: ['framer'], cms_specialist: ['webflow'], rapid_prototyper: ['lovable'], hosting_provider: ['cloudflare'], optional_accelerators: ['lovable'], specialists: ['framer', 'webflow'] },
    premium_visual_path: ['framer', 'riosystems-native-web-builder', 'cloudflare'], autonomous_premium_path: ['riosystems-autonomous-design-intelligence', 'riosystems-native-web-builder', 'cloudflare'], web_os_v2_path: ['business-intent', 'strategy', 'architecture', 'design-intent', 'native-build', 'multi-domain-QA', 'self-healing', 'integration-contracts', 'delivery'],
    project_context_adapter: 'aurentara.project-context-web-adapter.v1', provider_routing_authority_unchanged: true, framer_hosting_default: false, deterministic_zero_cost_mode: true, ai_provider_required: false, automatic_paid_fallback: false, variable_cost_ceiling_eur: 0, production_deploy: false
  };
}
