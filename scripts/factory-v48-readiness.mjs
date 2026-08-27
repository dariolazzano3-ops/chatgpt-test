import assert from 'node:assert/strict';
import fs from 'node:fs';
import { businessFactoryManifest } from '../src/business-factory.js';
import { businessMissionBridgeManifest } from '../src/business-mission-bridge.js';
import { missionExecutionRouterManifest } from '../src/mission-execution-router.js';
import { listCapabilities } from '../src/capability-router.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const factory = businessFactoryManifest();
const bridge = businessMissionBridgeManifest();
const router = missionExecutionRouterManifest();
const capabilities = Object.fromEntries(listCapabilities().map((item) => [item.id, item]));
const [runtimeMajor = 0, runtimeMinor = 0] = String(runtime.factory_version || '').split('.').map(Number);
const [routerMajor = 0, routerMinor = 0] = String(router.version || '').split('.').map(Number);

assert.equal(runtimeMajor, 4);
assert.ok(runtimeMinor >= 8, `runtime factory_version ${runtime.factory_version} must be >= 4.8`);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.business_factory_foundation, true);
assert.equal(runtime.capabilities.business_contract_validation, true);
assert.equal(runtime.capabilities.business_bounded_local_execution, true);
assert.equal(runtime.capabilities.business_external_writes_disabled, true);
assert.equal(runtime.capabilities.business_mission_execution_bridge, true);
assert.equal(runtime.capabilities.web_automation_ai_business_mission_routing, true);
for (const item of ['web', 'automation', 'ai', 'business']) assert.equal(runtime.capabilities.available_factories.includes(item), true);
assert.equal(runtime.capabilities.planned_factories.includes('app'), true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);

assert.equal(factory.engine, 'business');
assert.equal(factory.external_writes, false);
assert.equal(bridge.version, '4.8');
assert.equal(bridge.adapter, 'business-factory-v1');
assert.equal(bridge.explicit_dispatch_approval, true);
assert.equal(bridge.external_writes, false);
assert.equal(routerMajor, 4);
assert.ok(routerMinor >= 8, `router manifest ${router.version} must be >= 4.8`);
for (const engine of ['web', 'automation', 'ai', 'business']) assert.equal(router.supported_engines.includes(engine), true);
assert.equal(router.production_deploy, false);

assert.equal(capabilities.automation_build.status, 'available');
assert.equal(capabilities.automation_build.engine, 'automation');
assert.equal(capabilities.ai_system_build.status, 'available');
assert.equal(capabilities.ai_system_build.engine, 'ai');
assert.equal(capabilities.business_system_build.status, 'available');
assert.equal(capabilities.business_system_build.engine, 'business');

for (const file of [
  'src/business-factory.js',
  'src/business-executor.js',
  'src/business-mission-bridge.js',
  'src/mission-execution-router.js',
  'scripts/business-factory-smoke.mjs',
  'scripts/business-mission-bridge-smoke.mjs',
  'scripts/mission-four-factory-smoke.mjs'
]) assert.equal(fs.existsSync(file), true, `${file} missing`);

console.log('factory-v48-readiness: ok');
