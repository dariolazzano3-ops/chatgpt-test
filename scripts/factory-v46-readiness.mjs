import assert from 'node:assert/strict';
import fs from 'node:fs';
import { missionExecutionRouterManifest } from '../src/mission-execution-router.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const manifest = missionExecutionRouterManifest();
const [runtimeMajor = 0, runtimeMinor = 0] = String(runtime.factory_version || '').split('.').map(Number);
const [manifestMajor = 0, manifestMinor = 0] = String(manifest.version || '').split('.').map(Number);

assert.equal(runtimeMajor, 4);
assert.ok(runtimeMinor >= 6, `runtime factory_version ${runtime.factory_version} must be >= 4.6`);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.unified_mission_execution_router, true);
assert.equal(runtime.capabilities.web_automation_mission_routing, true);
assert.equal(runtime.capabilities.bounded_ready_task_execution, true);
assert.equal(runtime.capabilities.dependency_aware_mission_progression, true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.equal(manifestMajor, 4);
assert.ok(manifestMinor >= 6, `router manifest ${manifest.version} must be >= 4.6`);
assert.equal(manifest.supported_engines.includes('web'), true);
assert.equal(manifest.supported_engines.includes('automation'), true);
assert.equal(manifest.explicit_dispatch_approval_required, true);
assert.equal(manifest.automatic_cross_factory_execution, false);
assert.equal(manifest.production_deploy, false);

for (const file of [
  'src/mission-execution-router.js',
  'src/mission-execution-bridge.js',
  'src/automation-mission-bridge.js',
  'scripts/mission-execution-router-smoke.mjs'
]) assert.equal(fs.existsSync(file), true, `${file} missing`);

console.log('factory-v46-readiness: ok');
