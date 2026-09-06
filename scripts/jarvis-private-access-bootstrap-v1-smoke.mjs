import assert from 'node:assert/strict';
import { deriveSingleOperatorEmail, jarvisAppMatch } from './jarvis-private-access-bootstrap-v1.mjs';

const operatorApp = {
  id: 'op-app',
  type: 'self_hosted',
  domain: 'https://riosystems-staging.example.workers.dev/operator'
};
const jarvisApp = {
  id: 'jarvis-app',
  type: 'self_hosted',
  domain: 'https://jarvis-private-staging.example.workers.dev',
  aud: 'jarvis-aud'
};
const policies = {
  'op-app': [{
    id: 'op-policy',
    decision: 'allow',
    include: [{ email: { email: 'operator@example.invalid' } }]
  }]
};

const operator = deriveSingleOperatorEmail([operatorApp, jarvisApp], policies);
assert.equal(operator.ok, true);
assert.equal(operator.email, 'operator@example.invalid');

assert.equal(jarvisAppMatch(jarvisApp, 'jarvis-private-staging.example.workers.dev'), true);
assert.equal(jarvisAppMatch(operatorApp, 'jarvis-private-staging.example.workers.dev'), false);

const broad = deriveSingleOperatorEmail([operatorApp], {
  'op-app': [{ decision: 'allow', include: [{ everyone: {} }] }]
});
assert.equal(broad.ok, false);
assert.equal(broad.error, 'OPERATOR_ACCESS_BROAD_RULE_REJECTED');

const ambiguous = deriveSingleOperatorEmail([operatorApp], {
  'op-app': [{
    decision: 'allow',
    include: [
      { email: { email: 'one@example.invalid' } },
      { email: { email: 'two@example.invalid' } }
    ]
  }]
});
assert.equal(ambiguous.ok, false);
assert.equal(ambiguous.error, 'OPERATOR_EMAIL_AMBIGUOUS');

console.log('JARVIS Private Access Bootstrap V1 smoke: PASS');
