import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { evaluateMissionActivation, missionActivationGateManifest } from '../src/mission-activation-gate.js';

const compiled = compileMissionPackage({
  prompt: 'Baue für Firma Müller eine Website, richte ein CRM ein, erstelle eine Support-KI und verbinde eingehende Leads automatisch damit.',
  project: 'mueller'
});
assert.equal(compiled.ok, true);
const pkg = compiled.package;

const empty = evaluateMissionActivation(pkg, {});
assert.equal(empty.ok, true);
assert.equal(empty.status, 'BLOCKED_BY_REQUIRED_APPROVALS');
assert.equal(empty.ready_for_supervised_execution, false);
assert.equal(empty.ready_for_external_activation, false);
for (const engine of ['web', 'automation', 'ai', 'business']) assert.equal(empty.blockers.some((item) => item.engine === engine && item.type === 'adapter_approval'), true);
assert.equal(empty.blockers.some((item) => item.code === 'AI_PROVIDER_CREDENTIALS_REQUIRED'), true);
assert.equal(empty.blockers.some((item) => item.code === 'AUTOMATION_ALLOWED_HOSTS_REQUIRED'), true);
assert.equal(empty.blockers.some((item) => item.code === 'BUSINESS_TARGET_ADAPTER_REQUIRED'), true);

const supervised = evaluateMissionActivation(pkg, {
  adapter_approvals: {
    web: { authorized: true }, automation: { authorized: true }, ai: { authorized: true }, business: { authorized: true }
  }
});
assert.equal(supervised.ready_for_supervised_execution, true);
assert.equal(supervised.ready_for_external_activation, false);
assert.equal(supervised.status, 'READY_FOR_SUPERVISED_EXECUTION_WITH_EXTERNAL_BLOCKERS');

const ready = evaluateMissionActivation(pkg, {
  adapter_approvals: {
    web: { authorized: true }, automation: { authorized: true }, ai: { authorized: true }, business: { authorized: true }
  },
  ai: { runner_configured: true, credentials_configured: true, cost_approved: true },
  automation: { transport_configured: true, policy_authorized: true, allowed_hosts: ['crm.example.test'] },
  business: { target_adapter_configured: true, external_write_approved: true }
});
assert.equal(ready.ready_for_supervised_execution, true);
assert.equal(ready.ready_for_external_activation, true);
assert.equal(ready.status, 'READY_FOR_EXTERNAL_ACTIVATION');
assert.equal(ready.blocker_count, 0);
assert.equal(ready.production_deploy, false);

const production = evaluateMissionActivation(pkg, { production_deploy: true });
assert.equal(production.blockers.some((item) => item.code === 'PRODUCTION_ACTIVATION_NOT_ALLOWED_HERE'), true);

const manifest = missionActivationGateManifest();
assert.equal(manifest.version, '4.11');
assert.equal(manifest.mutates_external_systems, false);
assert.equal(manifest.activates_providers, false);
assert.equal(manifest.activates_transports, false);
assert.equal(manifest.production_deploy, false);
console.log('mission-activation-gate-smoke: ok');
