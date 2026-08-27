import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const version = Number(runtime.factory_version);
assert.ok(version >= 4.1);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.automation_factory_foundation, true);
assert.equal(runtime.capabilities.automation_contract_validation, true);
assert.equal(runtime.capabilities.automation_dry_run_planning, true);
assert.equal(runtime.capabilities.automation_external_side_effect_guard, true);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.equal(runtime.capabilities.manual_production_approval_required, true);
assert.ok(runtime.capabilities.available_factories.includes('web'));
assert.ok(runtime.capabilities.available_factories.includes('automation'));
for (const file of ['src/automation-factory.js', 'src/execution-adapters.js', 'scripts/automation-factory-smoke.mjs']) {
  assert.equal(fs.existsSync(file), true, `${file} missing`);
}
console.log('factory-v41-readiness: ok');
