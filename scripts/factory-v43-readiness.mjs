import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listExecutionAdapters } from '../src/execution-adapters.js';
import { externalActionManifest, validateExternalAction } from '../src/automation-external-actions.js';

const runtime = JSON.parse(fs.readFileSync(new URL('../factory-state/runtime.json', import.meta.url), 'utf8'));
assert.equal(runtime.factory_version, '4.3');
assert.equal(runtime.production_deploy, false);
assert.equal(runtime.capabilities.automation_safe_execution, true);
assert.equal(runtime.capabilities.automation_supervised_external_actions, true);
assert.equal(runtime.capabilities.automation_http_webhook_adapter, true);
assert.equal(runtime.capabilities.automation_external_allowlist_required, true);
assert.equal(runtime.capabilities.automation_private_network_guard, true);
assert.equal(runtime.capabilities.automation_inline_secret_guard, true);
assert.equal(runtime.capabilities.automatic_external_side_effects, false);
assert.equal(runtime.capabilities.automatic_multi_factory_execution, false);
assert.ok(runtime.capabilities.available_factories.includes('automation'));

const automation = listExecutionAdapters().find((adapter) => adapter.engine === 'automation');
assert.ok(automation);
assert.equal(automation.available, true);
assert.equal(automation.mode, 'supervised_execution');
assert.equal(automation.safe_internal_execution, true);
assert.equal(automation.supervised_external_actions, true);
assert.equal(automation.automatic_external_side_effects, false);
assert.equal(automation.production_deploy, false);

const manifest = externalActionManifest();
assert.equal(manifest.mode, 'supervised');
assert.equal(manifest.allowlist_required, true);
assert.equal(manifest.inline_secrets_allowed, false);
assert.equal(manifest.production_deploy, false);

const valid = validateExternalAction(
  { type: 'http_request', url: 'https://api.example.test/v1/items', method: 'GET' },
  { allowed_hosts: ['api.example.test'], authorized: true }
);
assert.equal(valid.ok, true);

const unauthorized = validateExternalAction(
  { type: 'http_request', url: 'https://api.example.test/v1/items', method: 'GET' },
  { allowed_hosts: ['api.example.test'], authorized: false }
);
assert.equal(unauthorized.ok, false);
assert.ok(unauthorized.errors.includes('EXTERNAL_ACTION_APPROVAL_REQUIRED'));

console.log('factory-v43-readiness: ok');
