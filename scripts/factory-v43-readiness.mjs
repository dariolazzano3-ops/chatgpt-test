import assert from 'node:assert/strict';
import fs from 'node:fs';
import { externalActionManifest, validateExternalAction } from '../src/automation-external-actions.js';
import { resolveExecutionAdapter } from '../src/execution-adapters.js';

const runtime = JSON.parse(fs.readFileSync('factory-state/runtime.json', 'utf8'));
assert.ok(Number(runtime.factory_version) >= 4.3);
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.automation_bounded_execution, true);
assert.equal(runtime.capabilities.automation_supervised_http, true);
assert.equal(runtime.capabilities.automation_supervised_webhook, true);
assert.equal(runtime.capabilities.automation_external_allowlist_required, true);
assert.equal(runtime.capabilities.automation_inline_secrets_blocked, true);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);

const adapter = resolveExecutionAdapter({ domain:'automation', state:'READY' });
assert.equal(adapter.ok, true);
assert.equal(adapter.adapter.mode, 'supervised');
assert.equal(adapter.adapter.automatic_execution, false);
assert.equal(adapter.adapter.production_deploy, false);

const manifest = externalActionManifest();
assert.equal(manifest.mode, 'supervised');
assert.equal(manifest.allowlist_required, true);
assert.equal(manifest.automatic_execution, false);

const blocked = validateExternalAction({ type:'webhook', url:'https://hooks.example.test/x' }, { authorized:true });
assert.equal(blocked.ok, false);
assert.ok(blocked.errors.includes('EXTERNAL_ACTION_ALLOWLIST_REQUIRED'));

for (const file of ['src/automation-external-actions.js','scripts/automation-external-actions-smoke.mjs']) {
  assert.equal(fs.existsSync(file), true, `${file} missing`);
}
console.log('factory-v43-readiness: ok');
