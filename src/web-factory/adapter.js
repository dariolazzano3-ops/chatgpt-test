import { buildWebsiteProject } from './factory.js';
import { reconstructPremiumWebsite } from './native-reconstruction.js';
import { buildAutonomousPremiumWebsite } from './autonomous-premium.js';
import { runWebOperatingSystemV2 } from './operating-system-v2.js';
import { webProviderRoleModel } from './provider-roles.js';
import { selectWebBuildRoute } from './routing.js';
import { adaptProjectContextToWebMission } from './project-context-adapter-v1.js';

const CAPABILITIES = new Set(['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal', 'web_generate', 'web_rebuild', 'web_evolve']);

function resolveMission(task = {}) {
  const raw = task.website_mission || task.input || task.mission || {};
  const projectContext = task.project_context || raw.project_mission_context || task.mission_package?.project_context || null;
  if (!projectContext) return { ok: true, mission: raw, project_context_bound: false };
  return adaptProjectContextToWebMission(projectContext, raw);
}

export function executeWebFactoryTask(task = {}, options = {}) {
  const capability = String(task.capability || 'web.build');
  if (!CAPABILITIES.has(capability)) return { ok: false, status: 'UNSUPPORTED_WEB_CAPABILITY', capability, production_deploy: false, variable_cost_eur: 0 };
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

export function webFactoryProviderManifest() {
  return {
    schema: 'riosystems.web-factory-provider.v2', provider_id: 'riosystems-native-web-builder', capabilities: ['web.build', 'web.premium.build', 'web.autonomous.premium.build', 'web.os.v2.build', 'web.os.v2.proposal'], aliases: ['web_generate', 'web_rebuild', 'web_evolve'],
    roles: { 'riosystems-native-web-builder': 'native_builder', framer: 'visual_specialist', webflow: 'cms_specialist', lovable: 'rapid_prototyper', cloudflare: 'hosting_provider' }, role_specializations: { framer: 'premium_visual_specialist' }, role_model: webProviderRoleModel(),
    strategy: { operating_system: 'riosystems-web-operating-system-v2', primary: ['riosystems-native-web-builder', 'github', 'cloudflare-pages-preview'], visual_specialist: ['framer'], cms_specialist: ['webflow'], rapid_prototyper: ['lovable'], hosting_provider: ['cloudflare'], optional_accelerators: ['lovable'], specialists: ['framer', 'webflow'] },
    premium_visual_path: ['framer', 'riosystems-native-web-builder', 'cloudflare'], autonomous_premium_path: ['riosystems-autonomous-design-intelligence', 'riosystems-native-web-builder', 'cloudflare'], web_os_v2_path: ['business-intent', 'strategy', 'architecture', 'design-intent', 'native-build', 'multi-domain-QA', 'self-healing', 'integration-contracts', 'delivery'],
    project_context_adapter: 'aurentara.project-context-web-adapter.v1', provider_routing_authority_unchanged: true, framer_hosting_default: false, deterministic_zero_cost_mode: true, ai_provider_required: false, automatic_paid_fallback: false, variable_cost_ceiling_eur: 0, production_deploy: false
  };
}
