import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aiFactoryManifest } from '../src/ai-factory.js';
import { listExecutionAdapters } from '../src/execution-adapters.js';

for (const file of ['src/ai-factory.js', 'src/ai-structured-output.js', 'src/execution-adapters.js', 'scripts/ai-factory-smoke.mjs', 'scripts/ai-structured-output-smoke.mjs']) {
  assert.equal(fs.existsSync(file), true, `${file} missing`);
}

const manifest = aiFactoryManifest();
assert.equal(manifest.id, 'ai-factory-v1');
assert.equal(manifest.version, '1.1.0');
assert.equal(manifest.status, 'structured_output_foundation');
assert.equal(manifest.execution_mode, 'contract_only');
assert.equal(manifest.provider_agnostic, true);
assert.equal(manifest.model_routing, false);
assert.equal(manifest.structured_output_validation, true);
assert.equal(manifest.schema_contracts, true);
assert.equal(manifest.tool_access, false);
assert.equal(manifest.external_data_access, false);
assert.equal(manifest.external_side_effects, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.limits.max_attempts, 3);

const adapter = listExecutionAdapters().find((item) => item.engine === 'ai');
assert.ok(adapter, 'AI execution adapter missing');
assert.equal(adapter.available, true);
assert.equal(adapter.mode, 'contract_only');
assert.equal(adapter.automatic_execution, false);
assert.equal(adapter.production_deploy, false);

console.log('ai-factory-v1-readiness: ok');
