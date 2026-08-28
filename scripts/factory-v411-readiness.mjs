import assert from 'node:assert/strict';
import fs from 'node:fs';
import { missionActivationGateManifest } from '../src/mission-activation-gate.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const manifest = missionActivationGateManifest();
const [runtimeMajor = 0, runtimeMinor = 0] = String(runtime.factory_version || '').split('.').map(Number);

assert.equal(runtimeMajor, 4);
assert.ok(runtimeMinor >= 11, `runtime factory_version ${runtime.factory_version} must be >= 4.11`);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.mission_activation_readiness_gate, true);
assert.equal(runtime.capabilities.activation_blocker_classification, true);
assert.equal(runtime.capabilities.activation_readiness_read_only, true);
assert.equal(runtime.capabilities.provider_activation_never_implicit, true);
assert.equal(runtime.capabilities.transport_activation_never_implicit, true);
assert.equal(runtime.capabilities.crm_write_activation_never_implicit, true);
assert.equal(runtime.capabilities.mission_activation_readiness_workflow, true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);

assert.equal(manifest.version, '4.11');
assert.equal(manifest.mode, 'read_only_activation_readiness');
assert.equal(manifest.mutates_external_systems, false);
assert.equal(manifest.activates_providers, false);
assert.equal(manifest.activates_transports, false);
assert.equal(manifest.production_deploy, false);

for (const file of [
  'src/mission-activation-gate.js',
  'scripts/mission-activation-gate-smoke.mjs',
  'scripts/mission-activation-readiness.mjs',
  '.github/workflows/mission-activation-readiness.yml'
]) assert.equal(fs.existsSync(file), true, `${file} missing`);

console.log('factory-v411-readiness: ok');
