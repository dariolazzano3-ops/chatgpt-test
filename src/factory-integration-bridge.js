import { prepareIntegrationExecution } from './integration-runtime.js';

const clean = (value, max = 160) => String(value || '').trim().slice(0, max);

const ENGINE_CAPABILITIES = {
  ai: ['ai.generate', 'ai.analyze', 'ai.classify', 'ai.extract'],
  automation: ['automation.run', 'automation.webhook', 'automation.email'],
  business: ['business.configure', 'business.crm.write', 'business.email.send', 'business.payment'],
  web: ['web.build', 'web.deploy', 'web.analytics']
};

const LEGACY_CAPABILITY_ALIASES = {
  web_generate: 'web.build',
  web_rebuild: 'web.build',
  web_evolve: 'web.build',
  automation_build: 'automation.run',
  ai_system_build: 'ai.generate',
  business_system_build: 'business.configure'
};

export function integrationCapabilityForTask(task = {}) {
  const engine = ['web','automation','ai','business'].includes(task.domain) ? task.domain : clean(task.engine, 80);
  const explicit = clean(task.capability, 120);
  if (explicit) return LEGACY_CAPABILITY_ALIASES[explicit] || explicit;
  const fallback = {
    ai: 'ai.generate',
    automation: 'automation.run',
    business: 'business.configure',
    web: 'web.build'
  };
  return fallback[engine] || `${engine || 'unknown'}.execute`;
}

export function buildFactoryIntegrationPlan(mission = {}, catalog = {}, context = {}) {
  const tasks = [];
  const blockers = [];
  for (const task of mission.tasks || []) {
    const capability = integrationCapabilityForTask(task);
    const prepared = prepareIntegrationExecution(catalog, { capability, preferred_integration: context.preferred_integrations?.[capability] }, {
      credentials_required: context.credentials_required,
      cost_approved: context.cost_approved === true,
      external_write_approved: context.external_write_approved === true,
      provider_activation_approved: context.provider_activation_approved === true,
      supervised_execution_approved: context.supervised_execution_approved === true,
      provider_requirements: context.provider_requirements?.[capability] || context.provider_requirements?.default || {},
      execution_mode: context.execution_mode || 'dry_run',
      production_deploy: false
    });
    const safePrepared = prepared.integration ? { ...prepared, integration: { ...prepared.integration, runner: undefined } } : prepared;
    tasks.push({ task_id: task.task_id, engine: task.domain || task.engine, capability, integration: safePrepared });
    if (!prepared.ok) blockers.push({ task_id: task.task_id, capability, code: prepared.error });
    else if (prepared.user_action_required) {
      for (const item of prepared.activation?.blockers || []) blockers.push({ task_id: task.task_id, capability, code: item.code });
    }
  }
  return {
    ok: true,
    plan_version: 'riosystems.factory-integrations.v1',
    tasks,
    blockers,
    ready_for_supervised_integrations: blockers.length === 0,
    production_deploy: false
  };
}

export function factoryIntegrationBridgeManifest() {
  return {
    version: 'riosystems.factory-integrations.v1',
    engines: Object.keys(ENGINE_CAPABILITIES),
    capability_matrix: ENGINE_CAPABILITIES,
    supports_supervised_real_integrations: true,
    legacy_capability_aliases: { ...LEGACY_CAPABILITY_ALIASES },
    hard_provider_eligibility_supported: true,
    production_deploy: false
  };
}
