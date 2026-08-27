import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aiMissionBridgeManifest } from '../src/ai-mission-bridge.js';
import { missionExecutionRouterManifest } from '../src/mission-execution-router.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const ai = aiMissionBridgeManifest();
const router = missionExecutionRouterManifest();

assert.equal(runtime.factory_version, '4.7');
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.ai_mission_execution_bridge, true);
assert.equal(runtime.capabilities.ai_injected_runner_required, true);
assert.equal(runtime.capabilities.ai_tools_disabled, true);
assert.equal(runtime.capabilities.ai_external_data_disabled, true);
assert.equal(runtime.capabilities.ai_external_side_effects_disabled, true);
assert.equal(runtime.capabilities.web_automation_ai_mission_routing, true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.deepEqual(runtime.capabilities.available_factories, ['web', 'automation', 'ai']);

assert.equal(ai.version, '4.7');
assert.equal(ai.adapter, 'ai-factory-v1');
assert.equal(ai.mission_execution, 'injected_runner_only');
assert.equal(ai.explicit_dispatch_approval, true);
assert.equal(ai.tool_access, false);
assert.equal(ai.external_data_access, false);
assert.equal(ai.external_side_effects, false);
assert.equal(ai.production_deploy, false);

assert.equal(router.version, '4.7');
assert.deepEqual(router.supported_engines, ['web', 'automation', 'ai']);
assert.equal(router.explicit_dispatch_approval_required, true);
assert.equal(router.automatic_cross_factory_execution, false);
assert.equal(router.production_deploy, false);

for (const file of [
  'src/ai-mission-bridge.js',
  'src/ai-mission-adapter.js',
  'src/ai-executor.js',
  'src/mission-execution-router.js',
  'scripts/ai-mission-bridge-smoke.mjs',
  'scripts/mission-router-ai-smoke.mjs'
]) assert.equal(fs.existsSync(file), true, `${file} missing`);

console.log('factory-v47-readiness: ok');
