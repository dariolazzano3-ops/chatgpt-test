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

assert.equal(runtime.factory_version, '4.8');
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.business_factory_foundation, true);
assert.equal(runtime.capabilities.business_contract_validation, true);
assert.equal(runtime.capabilities.business_bounded_local_execution, true);
assert.equal(runtime.capabilities.business_external_writes_disabled, true);
assert.equal(runtime.capabilities.business_mission_execution_bridge, true);
assert.equal(runtime.capabilities.web_automation_ai_business_mission_routing, true);
assert.deepEqual(runtime.capabilities.available_factories, ['web', 'automation', 'ai', 'business']);
assert.deepEqual(runtime.capabilities.planned_factories, ['app']);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);

assert.equal(factory.engine, 'business');
assert.equal(factory.external_writes, false);
assert.equal(bridge.version, '4.8');
assert.equal(bridge.adapter, 'business-factory-v1');
assert.equal(bridge.explicit_dispatch_approval, true);
assert.equal(bridge.external_writes, false);
assert.equal(router.version, '4.8');
assert.deepEqual(router.supported_engines, ['web', 'automation', 'ai', 'business']);
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
