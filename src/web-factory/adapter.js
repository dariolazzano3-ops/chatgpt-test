import { buildWebsiteProject } from './factory.js';
import { reconstructPremiumWebsite } from './native-reconstruction.js';
import { buildAutonomousPremiumWebsite } from './autonomous-premium.js';
import { webProviderRoleModel } from './provider-roles.js';
import { selectWebBuildRoute } from './routing.js';

const CAPABILITIES = new Set(['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web_generate', 'web_rebuild', 'web_evolve']);

export function executeWebFactoryTask(task = {}, options = {}) {
  const capability = String(task.capability || 'web.build');
  if (!CAPABILITIES.has(capability)) {
    return { ok: false, status: 'UNSUPPORTED_WEB_CAPABILITY', capability, production_deploy: false, variable_cost_eur: 0 };
  }

  const mission = task.website_mission || task.input || task.mission || {};
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

export function webFactoryProviderManifest() {
  return {
    schema: 'riosystems.web-factory-provider.v1',
    provider_id: 'riosystems-native-web-builder',
    capabilities: ['web.build', 'web.premium.build', 'web.autonomous.premium.build'],
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
    framer_hosting_default: false,
    deterministic_zero_cost_mode: true,
    ai_provider_required: false,
    automatic_paid_fallback: false,
    variable_cost_ceiling_eur: 0,
    production_deploy: false
  };
}
