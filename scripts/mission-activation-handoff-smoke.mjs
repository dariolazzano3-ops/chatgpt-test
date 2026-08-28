import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { buildMissionActivationHandoff, missionActivationHandoffManifest } from '../src/mission-activation-handoff.js';

const compiled = compileMissionPackage({
  prompt: 'Baue für Firma Müller eine Website, richte ein CRM ein, erstelle eine Support-KI und verbinde eingehende Leads automatisch damit.',
  project: 'mueller'
});
assert.equal(compiled.ok, true);

const handoff = buildMissionActivationHandoff(compiled.package, {});
assert.equal(handoff.ok, true);
assert.equal(handoff.user_input_unavoidable, true);
assert.equal(handoff.completion_boundary, 'STRUCTURAL_SYSTEM_COMPLETE_ACTIVATION_INPUT_REQUIRED');
for (const id of ['approve_web','approve_automation','approve_ai','approve_business','ai_provider','ai_credentials','ai_cost_approval','automation_transport','automation_policy_approval','automation_allowed_hosts','business_target','business_write_approval']) {
  assert.equal(handoff.required_inputs.some((item) => item.id === id), true, `${id} missing`);
}
assert.equal(handoff.required_inputs.find((item) => item.id === 'ai_credentials').sensitive, true);
assert.equal(handoff.optional_later.some((item) => item.id === 'production_release_approval'), true);
assert.equal(handoff.production_deploy, false);
assert.equal(handoff.mutates_external_systems, false);

const complete = buildMissionActivationHandoff(compiled.package, {
  adapter_approvals: { web: { authorized: true }, automation: { authorized: true }, ai: { authorized: true }, business: { authorized: true } },
  ai: { runner_configured: true, credentials_configured: true, cost_approved: true },
  automation: { transport_configured: true, policy_authorized: true, allowed_hosts: ['crm.example.test'] },
  business: { target_adapter_configured: true, external_write_approved: true }
});
assert.equal(complete.required_input_count, 0);
assert.equal(complete.user_input_unavoidable, false);
assert.equal(complete.completion_boundary, 'ACTIVATION_CONFIGURATION_COMPLETE_PRODUCTION_SEPARATE');

const manifest = missionActivationHandoffManifest();
assert.equal(manifest.version, '4.13');
assert.equal(manifest.secret_values_persisted, false);
assert.equal(manifest.mutates_external_systems, false);
assert.equal(manifest.production_deploy, false);
console.log('mission-activation-handoff-smoke: ok');
