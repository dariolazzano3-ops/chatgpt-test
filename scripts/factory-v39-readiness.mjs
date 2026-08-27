import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
assert.ok(Number(runtime.factory_version) >= 3.9);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.orchestration_mission_state, true);
assert.equal(runtime.capabilities.execution_adapter_registry, true);
assert.equal(runtime.capabilities.web_factory_execution_adapter, true);
assert.equal(runtime.capabilities.mission_to_factory_request_bridge, true);
assert.equal(runtime.capabilities.factory_result_to_mission_reconciliation, true);
assert.equal(runtime.capabilities.persisted_dispatch_envelope, true);
assert.equal(runtime.capabilities.adapter_dispatch_authorization_required, true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.equal(runtime.capabilities.manual_production_approval_required, true);
for (const file of [
  'src/orchestration-planner.js',
  'src/orchestration-state.js',
  'src/execution-adapters.js',
  'src/mission-execution-bridge.js',
  'scripts/orchestration-mission-state.mjs',
  'scripts/mission-execution-adapter.mjs'
]) assert.equal(fs.existsSync(file), true, `${file} missing`);

console.log('factory-v39-readiness: ok');
