import assert from 'node:assert/strict';
import fs from 'node:fs';
import { missionSupervisorManifest } from '../src/mission-supervisor.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const manifest = missionSupervisorManifest();
const [runtimeMajor = 0, runtimeMinor = 0] = String(runtime.factory_version || '').split('.').map(Number);

assert.equal(runtimeMajor, 4);
assert.ok(runtimeMinor >= 9, `runtime factory_version ${runtime.factory_version} must be >= 4.9`);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.supervised_multi_factory_mission_loop, true);
assert.equal(runtime.capabilities.persisted_multi_factory_mission_supervisor, true);
assert.equal(runtime.capabilities.mission_supervisor_persistence_hook, true);
assert.equal(runtime.capabilities.mission_supervisor_web_dispatch_hook, true);
assert.equal(runtime.capabilities.mission_supervisor_web_observation_hook, true);
assert.equal(runtime.capabilities.mission_supervisor_resume_safe, true);
assert.equal(runtime.capabilities.mission_supervisor_workflow, true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.equal(runtime.capabilities.business_external_writes_disabled, true);
assert.equal(runtime.capabilities.ai_injected_runner_required, true);

assert.equal(manifest.version, '4.9');
assert.equal(manifest.mode, 'supervised_multi_factory_loop');
assert.deepEqual(manifest.supported_engines, ['web', 'automation', 'ai', 'business']);
assert.equal(manifest.durable_persistence_hook, true);
assert.equal(manifest.web_dispatch_hook, true);
assert.equal(manifest.web_observation_hook, true);
assert.equal(manifest.explicit_adapter_approval_required, true);
assert.equal(manifest.ai_injected_runner_required, true);
assert.equal(manifest.automatic_multi_factory_execution, false);
assert.equal(manifest.production_deploy, false);

for (const file of [
  'src/mission-supervisor.js',
  'scripts/mission-supervisor.mjs',
  'scripts/mission-supervisor-smoke.mjs',
  '.github/workflows/mission-supervisor.yml'
]) assert.equal(fs.existsSync(file), true, `${file} missing`);

console.log('factory-v49-readiness: ok');
