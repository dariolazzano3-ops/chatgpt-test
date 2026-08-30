import { buildWebsiteProject } from './factory.js';

const CAPABILITIES = new Set(['web.build', 'web_generate', 'web_rebuild', 'web_evolve']);

export function executeWebFactoryTask(task = {}, options = {}) {
  const capability = String(task.capability || 'web.build');
  if (!CAPABILITIES.has(capability)) {
    return { ok: false, status: 'UNSUPPORTED_WEB_CAPABILITY', capability, production_deploy: false, variable_cost_eur: 0 };
  }
  const mission = task.website_mission || task.input || task.mission || {};
  return buildWebsiteProject(mission, options);
}

export function webFactoryProviderManifest() {
  return {
    schema: 'riosystems.web-factory-provider.v1',
    provider_id: 'riosystems-native-web-builder',
    capabilities: ['web.build'],
    aliases: ['web_generate', 'web_rebuild', 'web_evolve'],
    strategy: {
      primary: ['riosystems-native-web-builder', 'github', 'cloudflare-pages-preview'],
      optional_accelerators: ['lovable'],
      specialists: ['framer', 'webflow']
    },
    deterministic_zero_cost_mode: true,
    ai_provider_required: false,
    automatic_paid_fallback: false,
    variable_cost_ceiling_eur: 0,
    production_deploy: false
  };
}
