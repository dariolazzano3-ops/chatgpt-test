import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
assert.equal(runtime.factory_version, '3.9');
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.execution_adapter_registry, true);
assert.equal(runtime.capabilities.web_factory_execution_adapter, true);
assert.equal(runtime.capabilities.mission_execution_coordinator, true);
assert.equal(runtime.capabilities.adapter_result_validation, true);
assert.equal(runtime.capabilities.explicit_adapter_dispatch_required, true);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.equal(runtime.capabilities.manual_production_approval_required, true);
for (const path of ['src/execution-adapters.js', 'src/execution-coordinator.js', 'src/web-factory-adapter.js']) assert.equal(fs.existsSync(path), true, `${path} missing`);
console.log('factory-v39-readiness: ok');
