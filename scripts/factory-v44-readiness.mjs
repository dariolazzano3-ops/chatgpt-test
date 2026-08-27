import assert from 'node:assert/strict';
import fs from 'node:fs';
import { supervisedAutomationManifest } from '../src/automation-supervised-runner.js';
import { externalActionManifest } from '../src/automation-external-actions.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
const runner = supervisedAutomationManifest();
const external = externalActionManifest();

const [major = 0, minor = 0] = String(runtime.factory_version || '').split('.').map(Number);
assert.equal(major, 4);
assert.ok(minor >= 4, `runtime factory_version ${runtime.factory_version} must be >= 4.4`);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.automation_supervised_runner, true);
assert.equal(runtime.capabilities.automation_transport_injection_required, true);
assert.equal(runtime.capabilities.automatic_adapter_dispatch, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.equal(runner.version, '4.4');
assert.equal(runner.external_transport_injected, true);
assert.equal(runner.automatic_execution, false);
assert.equal(external.allowlist_required, true);
assert.equal(external.inline_secrets_allowed, false);

for (const file of [
  'src/automation-supervised-runner.js',
  'scripts/automation-supervised-runner-smoke.mjs',
  'docs/LEAN-V4.4.md',
]) {
  assert.equal(fs.existsSync(file), true, `${file} missing`);
}

console.log('factory-v44-readiness: ok');
