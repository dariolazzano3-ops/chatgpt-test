export const WEB_PROVIDER_ROLES = Object.freeze({
  NATIVE_BUILDER: 'native_builder',
  VISUAL_SPECIALIST: 'visual_specialist',
  CMS_SPECIALIST: 'cms_specialist',
  RAPID_PROTOTYPER: 'rapid_prototyper',
  HOSTING_PROVIDER: 'hosting_provider'
});

export const WEB_PROVIDER_REGISTRY = Object.freeze({
  'riosystems-native-web-builder': {
    provider_id: 'riosystems-native-web-builder',
    role: WEB_PROVIDER_ROLES.NATIVE_BUILDER,
    lock_in: 'low',
    exportability: 'native_owned_code',
    recurring_cost_class: 'none_for_build_runtime',
    production_activation: false
  },
  framer: {
    provider_id: 'framer',
    role: WEB_PROVIDER_ROLES.VISUAL_SPECIALIST,
    lock_in: 'design_stage_only_when_reconstructed',
    exportability: 'structured_design_specification',
    recurring_cost_class: 'avoid_by_default',
    production_activation: false
  },
  webflow: {
    provider_id: 'webflow',
    role: WEB_PROVIDER_ROLES.CMS_SPECIALIST,
    lock_in: 'specialist_runtime_possible',
    exportability: 'project_dependent',
    recurring_cost_class: 'project_dependent',
    production_activation: false
  },
  lovable: {
    provider_id: 'lovable',
    role: WEB_PROVIDER_ROLES.RAPID_PROTOTYPER,
    lock_in: 'project_dependent',
    exportability: 'project_dependent',
    recurring_cost_class: 'project_dependent',
    production_activation: false
  },
  cloudflare: {
    provider_id: 'cloudflare',
    role: WEB_PROVIDER_ROLES.HOSTING_PROVIDER,
    lock_in: 'low_for_static_artifacts',
    exportability: 'portable_static_artifact',
    recurring_cost_class: 'low',
    production_activation: false
  }
});

export function webProviderRoleModel() {
  return {
    schema: 'riosystems.web-provider-role-model.v1',
    providers: Object.values(WEB_PROVIDER_REGISTRY),
    rules: {
      framer_default_role: WEB_PROVIDER_ROLES.VISUAL_SPECIALIST,
      framer_default_hosting: false,
      cloudflare_preferred_when_native_artifact_exists: true,
      automatic_paid_activation: false,
      automatic_paid_overflow: false,
      production_deploy: false
    }
  };
}
