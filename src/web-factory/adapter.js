import { buildWebsiteProject } from './factory.js';
import { reconstructPremiumWebsite } from './native-reconstruction.js';
import { buildAutonomousPremiumWebsite } from './autonomous-premium.js';
import { runWebOperatingSystemV2 } from './operating-system-v2.js';
import { webProviderRoleModel } from './provider-roles.js';
import { selectWebBuildRoute } from './routing.js';
import { runFramerVisualProvider } from './framer-live-provider.js';
import { connectTrackedFramer } from './framer-server-connection.js';

const CAPABILITIES = new Set(['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal', 'web_generate', 'web_rebuild', 'web_evolve']);

export function executeWebFactoryTask(task = {}, options = {}) {
  const capability = String(task.capability || 'web.build');
  if (!CAPABILITIES.has(capability)) {
    return { ok: false, status: 'UNSUPPORTED_WEB_CAPABILITY', capability, production_deploy: false, variable_cost_eur: 0 };
  }

  const mission = task.website_mission || task.input || task.mission || {};
  if (capability === 'web.os.v2.build' || capability === 'web.os.v2.proposal') {
    return runWebOperatingSystemV2({
      ...task,
      mission,
      mode: capability === 'web.os.v2.proposal' ? 'proposal' : task.mode
    }, options);
  }
  if (capability === 'web.autonomous.premium.build') {
    return buildAutonomousPremiumWebsite({
      ...task,
      mission,
      quality_level: task.quality_level || task.routing_context?.quality_level || mission.quality_level || 'PREMIUM'
    }, options);
  }

  const routingContext = task.routing_context || {};
  const route = selectWebBuildRoute({
    ...routingContext,
    premium_visual: capability === 'web.premium.build' || routingContext.premium_visual === true,
    quality_level: routingContext.quality_level || (capability === 'web.premium.build' ? 'PREMIUM' : 'STANDARD'),
    synthetic_test_data_only: mission.synthetic_test_data_only === true,
    environment: 'staging'
  });

  if (route.selected.route_id === 'framer-design-native-cloudflare') {
    if (!task.design_contract) {
      return {
        ok: false,
        status: 'VISUAL_DESIGN_CONTRACT_REQUIRED',
        route,
        next_stage: 'framer_visual_design_or_provider_neutral_design_handoff',
        production_deploy: false,
        variable_cost_eur: 0
      };
    }
    return reconstructPremiumWebsite({
      mission,
      design_contract: task.design_contract,
      routing_context: routingContext,
      framer_status: task.framer_status || {}
    }, options);
  }

  if (['webflow-cms-specialist-candidate', 'lovable-rapid-prototype-candidate'].includes(route.selected.route_id)) {
    return {
      ok: false,
      status: 'SPECIALIST_REVIEW_REQUIRED',
      route,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  return buildWebsiteProject(mission, options);
}

export async function executeWebFactoryTaskWithVisualProvider(task = {}, options = {}) {
  const capability = String(task.capability || 'web.premium.build');
  const mission = task.website_mission || task.input || task.mission || {};
  const routingContext = task.routing_context || {};
  const route = selectWebBuildRoute({
    ...routingContext,
    premium_visual: capability === 'web.premium.build' || routingContext.premium_visual === true,
    quality_level: routingContext.quality_level || (capability === 'web.premium.build' ? 'PREMIUM' : 'STANDARD'),
    synthetic_test_data_only: mission.synthetic_test_data_only === true,
    environment: 'staging'
  });

  if (route.selected.route_id !== 'framer-design-native-cloudflare') {
    return executeWebFactoryTask(task, options);
  }

  if (!task.framer_visual_request) {
    if (task.design_contract) return executeWebFactoryTask(task, options);
    return {
      ok: false,
      status: 'FRAMER_VISUAL_REQUEST_REQUIRED',
      route,
      next_stage: 'guarded_framer_visual_provider',
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  const rawProviderOptions = options.framer || options.visualProvider || {};
  const providerOptions = { ...rawProviderOptions };
  if (typeof providerOptions.connectFn !== 'function') providerOptions.connectFn = connectTrackedFramer;

  const visualProvider = await runFramerVisualProvider(task.framer_visual_request, providerOptions);
  if (!visualProvider.ok) {
    return {
      ok: false,
      status: visualProvider.status,
      route,
      visual_provider: visualProvider,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  const designContract = task.design_contract || visualProvider.design_contract;
  const build = reconstructPremiumWebsite({
    mission,
    design_contract: designContract,
    routing_context: routingContext,
    framer_status: { design_verified: true, connection_verified: true, free_plan_ready: true }
  }, options);

  return {
    ...build,
    route,
    visual_provider_evidence: {
      schema: 'riosystems.framer-visual-provider-evidence.v1',
      status: visualProvider.status,
      provider: visualProvider.provider,
      mode: visualProvider.mode,
      operation_count: visualProvider.operations.length,
      operations: visualProvider.operations,
      snapshot_schema: visualProvider.snapshot_after?.schema || null,
      design_contract_status: visualProvider.design_contract_validation?.status || null,
      portability_required: true,
      native_reconstruction_required: true,
      framer_runtime_dependency_in_final_site: false,
      production_publish: false,
      production_deploy: false,
      domain_change: false,
      paid_action: false,
      variable_cost_eur: 0
    }
  };
}

export function webFactoryProviderManifest() {
  return {
    schema: 'riosystems.web-factory-provider.v2',
    provider_id: 'riosystems-native-web-builder',
    capabilities: ['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal'],
    aliases: ['web_generate', 'web_rebuild', 'web_evolve'],
    roles: {
      'riosystems-native-web-builder': 'native_builder',
      framer: 'visual_specialist',
      webflow: 'cms_specialist',
      lovable: 'rapid_prototyper',
      cloudflare: 'hosting_provider'
    },
    role_specializations: { framer: 'premium_visual_specialist' },
    role_model: webProviderRoleModel(),
    strategy: {
      operating_system: 'riosystems-web-operating-system-v2',
      primary: ['riosystems-native-web-builder', 'github', 'cloudflare-pages-preview'],
      visual_specialist: ['framer'],
      cms_specialist: ['webflow'],
      rapid_prototyper: ['lovable'],
      hosting_provider: ['cloudflare'],
      optional_accelerators: ['lovable'],
      specialists: ['framer', 'webflow']
    },
    premium_visual_path: ['framer', 'riosystems-native-web-builder', 'cloudflare'],
    autonomous_premium_path: ['riosystems-autonomous-design-intelligence', 'riosystems-native-web-builder', 'cloudflare'],
    web_os_v2_path: ['business-intent', 'strategy', 'architecture', 'design-intent', 'native-build', 'multi-domain-QA', 'self-healing', 'integration-contracts', 'delivery'],
    framer_live_visual_provider: {
      transport: 'framer-server-api',
      credential_policy: 'runtime-secret-only',
      visual_writes_guarded: true,
      tracked_insertions: ['TextNode', 'SVGNode'],
      native_reconstruction_required: true,
      publish_allowed: false,
      deploy_allowed: false,
      destructive_actions_allowed: false
    },
    framer_hosting_default: false,
    deterministic_zero_cost_mode: true,
    ai_provider_required: false,
    automatic_paid_fallback: false,
    variable_cost_ceiling_eur: 0,
    production_deploy: false
  };
}
