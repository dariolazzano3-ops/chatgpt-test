import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aiFactoryManifest, validateAIContract } from '../src/ai-factory.js';
import { validateStructuredOutputSchema } from '../src/ai-structured-output.js';

for (const file of ['src/ai-factory.js', 'src/ai-structured-output.js', 'scripts/ai-structured-output-smoke.mjs']) {
  assert.equal(fs.existsSync(file), true, `${file} missing`);
}

const manifest = aiFactoryManifest();
assert.equal(manifest.version, '1.1.0');
assert.equal(manifest.structured_output_validation, true);
assert.equal(manifest.schema_contracts, true);
assert.equal(manifest.provider_agnostic, true);
assert.equal(manifest.model_routing, false);
assert.equal(manifest.tool_access, false);
assert.equal(manifest.external_data_access, false);
assert.equal(manifest.production_deploy, false);

const schema = {
  type: 'object',
  required: ['summary'],
  additionalProperties: false,
  properties: { summary: { type: 'string', maxLength: 500 } }
};
assert.equal(validateStructuredOutputSchema(schema).ok, true);
assert.equal(validateAIContract({ task_type: 'summarize', goal: 'Summarize input', input: { text: 'x' }, output: { format: 'structured_json', schema } }).ok, true);
assert.equal(validateAIContract({ task_type: 'summarize', goal: 'Summarize input', input: { text: 'x' }, output: { format: 'structured_json', schema: { type: 'string', pattern: '.*' } } }).ok, false);

console.log('ai-factory-v11-readiness: ok');
