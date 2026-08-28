import { evaluateMissionActivation } from './mission-activation-gate.js';

const clone = (value) => structuredClone(value ?? null);

function field(id, label, engine, reason, kind = 'choice', sensitive = false) {
  return { id, label, engine, reason, kind, sensitive, required: true, value: null };
}

export function buildMissionActivationHandoff(pkg = {}, currentActivation = {}) {
  const readiness = evaluateMissionActivation(pkg, currentActivation);
  if (!readiness.ok) return readiness;

  const requiredInputs = [];
  const codes = new Set(readiness.blockers.map((item) => item.code));

  if (codes.has('ADAPTER_DISPATCH_APPROVAL_REQUIRED')) {
    for (const approval of readiness.approvals.filter((item) => !item.approved)) {
      requiredInputs.push(field(`approve_${approval.engine}`, `Approve ${approval.engine} mission execution`, approval.engine, 'Explicit adapter dispatch authorization is required before this engine may execute.', 'approval'));
    }
  }
  if (codes.has('AI_RUNNER_NOT_CONFIGURED')) requiredInputs.push(field('ai_provider', 'AI provider / runner', 'ai', 'Choose the provider-backed runner that will execute AI Factory contracts.', 'provider'));
  if (codes.has('AI_PROVIDER_CREDENTIALS_REQUIRED')) requiredInputs.push(field('ai_credentials', 'AI provider credentials', 'ai', 'Provider credentials must be configured outside mission state. Do not store raw credentials in mission JSON.', 'secret_reference', true));
  if (codes.has('AI_PROVIDER_COST_APPROVAL_REQUIRED')) requiredInputs.push(field('ai_cost_approval', 'AI provider cost approval', 'ai', 'Explicit cost approval is required before real provider calls.', 'approval'));
  if (codes.has('AUTOMATION_TRANSPORT_REQUIRED')) requiredInputs.push(field('automation_transport', 'Automation external transport / integration adapter', 'automation', 'Choose the injected transport or connector for the intended external integration.', 'integration'));
  if (codes.has('AUTOMATION_EXTERNAL_POLICY_APPROVAL_REQUIRED')) requiredInputs.push(field('automation_policy_approval', 'Automation external-action policy approval', 'automation', 'Explicit authorization is required for supervised external actions.', 'approval'));
  if (codes.has('AUTOMATION_ALLOWED_HOSTS_REQUIRED')) requiredInputs.push(field('automation_allowed_hosts', 'Exact allowed automation hostnames', 'automation', 'Provide exact HTTPS hostnames that the supervised transport may contact.', 'host_allowlist'));
  if (codes.has('AUTOMATION_INLINE_SECRETS_REJECTED')) requiredInputs.push(field('automation_secret_reference', 'Automation credential reference', 'automation', 'Move credentials out of inline request data and provide a secure reference/injected credential source.', 'secret_reference', true));
  if (codes.has('BUSINESS_TARGET_ADAPTER_REQUIRED')) requiredInputs.push(field('business_target', 'CRM / Business target system', 'business', 'Choose the real target adapter for CRM or business-system writes.', 'integration'));
  if (codes.has('BUSINESS_EXTERNAL_WRITE_APPROVAL_REQUIRED')) requiredInputs.push(field('business_write_approval', 'Business external-write approval', 'business', 'Explicit approval is required before writing the local Business configuration to an external CRM.', 'approval'));

  const production = field('production_release_approval', 'Production release approval', 'web', 'Production deployment is intentionally separate from mission execution and remains disabled until a dedicated release approval.', 'approval');
  production.required = false;

  const grouped = {};
  for (const item of requiredInputs) {
    if (!grouped[item.engine]) grouped[item.engine] = [];
    grouped[item.engine].push(item);
  }

  return {
    ok: true,
    handoff_version: 'mission.activation.handoff.v1',
    builder_version: '4.13',
    mission_id: pkg.mission?.mission_id || null,
    readiness: clone(readiness),
    required_inputs: requiredInputs,
    required_inputs_by_engine: grouped,
    required_input_count: requiredInputs.length,
    user_input_unavoidable: requiredInputs.length > 0,
    optional_later: [production],
    completion_boundary: requiredInputs.length
      ? 'STRUCTURAL_SYSTEM_COMPLETE_ACTIVATION_INPUT_REQUIRED'
      : 'ACTIVATION_CONFIGURATION_COMPLETE_PRODUCTION_SEPARATE',
    instructions: {
      raw_secrets_in_mission_state: false,
      exact_hosts_only_for_automation: true,
      production_release_separate: true
    },
    production_deploy: false,
    mutates_external_systems: false
  };
}

export function missionActivationHandoffManifest() {
  return {
    version: '4.13',
    input: 'mission_package_plus_current_activation_configuration',
    output: 'minimal_explicit_user_activation_inputs',
    secret_values_persisted: false,
    mutates_external_systems: false,
    production_release_separate: true,
    production_deploy: false
  };
}
