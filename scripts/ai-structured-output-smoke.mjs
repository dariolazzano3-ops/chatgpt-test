import assert from 'node:assert/strict';
import {
  validateStructuredOutputSchema,
  validateStructuredOutput,
  parseAndValidateStructuredOutput
} from '../src/ai-structured-output.js';

const schema = {
  type: 'object',
  required: ['intent', 'urgent', 'score', 'tags'],
  additionalProperties: false,
  properties: {
    intent: { type: 'string', minLength: 1, maxLength: 40 },
    urgent: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    tags: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 20 } }
  }
};

assert.equal(validateStructuredOutputSchema(schema).ok, true);
assert.equal(validateStructuredOutput({ intent: 'callback', urgent: true, score: 0.9, tags: ['sales'] }, schema).ok, true);

const missing = validateStructuredOutput({ intent: 'callback', score: 0.4, tags: ['sales'] }, schema);
assert.equal(missing.ok, false);
assert.ok(missing.errors.some((error) => error.code === 'AI_OUTPUT_REQUIRED_PROPERTY_MISSING'));

const extra = validateStructuredOutput({ intent: 'callback', urgent: false, score: 0.4, tags: ['sales'], invented: true }, schema);
assert.equal(extra.ok, false);
assert.ok(extra.errors.some((error) => error.code === 'AI_OUTPUT_ADDITIONAL_PROPERTY'));

const wrongType = validateStructuredOutput({ intent: 'callback', urgent: 'yes', score: 0.4, tags: ['sales'] }, schema);
assert.equal(wrongType.ok, false);
assert.ok(wrongType.errors.some((error) => error.code === 'AI_OUTPUT_TYPE_MISMATCH'));

assert.equal(parseAndValidateStructuredOutput(JSON.stringify({ intent: 'callback', urgent: true, score: 1, tags: ['sales'] }), schema).ok, true);
assert.equal(parseAndValidateStructuredOutput('{broken json', schema).kind, 'parse_error');

const unsupported = validateStructuredOutputSchema({ type: 'string', pattern: '^x+$' });
assert.equal(unsupported.ok, false);
assert.ok(unsupported.errors.some((error) => error.code === 'AI_SCHEMA_KEYWORD_UNSUPPORTED'));

const badRequired = validateStructuredOutputSchema({ type: 'object', required: ['missing'], properties: {} });
assert.equal(badRequired.ok, false);
assert.ok(badRequired.errors.some((error) => error.code === 'AI_SCHEMA_REQUIRED_PROPERTY_MISSING'));

console.log('ai-structured-output-smoke: ok');
