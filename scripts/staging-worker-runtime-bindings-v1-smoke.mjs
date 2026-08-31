#!/usr/bin/env node
import assert from 'node:assert/strict';
import { deriveStagingOperatorBindings } from './staging-worker-runtime-bindings-v1.mjs';

const app = {
  id: '11111111-2222-3333-4444-555555555555',
  type: 'self_hosted',
  domain: 'riosystems-staging.example.workers.dev',
  aud: 'access-audience-test'
};

const success = deriveStagingOperatorBindings({
  applications: [app],
  policies: [{ decision: 'allow', include: [{ email: { email: 'operator@example.invalid' } }] }]
});
assert.equal(success.ok, true);
assert.equal(success.operator_email, 'operator@example.invalid');
assert.equal(success.audience, 'access-audience-test');
assert.equal(success.production_deploy, false);
assert.equal(success.variable_cost_eur, 0);

const broad = deriveStagingOperatorBindings({
  applications: [app],
  policies: [{ decision: 'allow', include: [{ everyone: {} }] }]
});
assert.equal(broad.ok, false);
assert.equal(broad.error, 'ACCESS_BROAD_ALLOW_POLICY_REJECTED');

const domainOnly = deriveStagingOperatorBindings({
  applications: [app],
  policies: [{ decision: 'allow', include: [{ email_domain: { domain: 'example.invalid' } }] }]
});
assert.equal(domainOnly.ok, false);
assert.equal(domainOnly.error, 'ACCESS_OPERATOR_EMAIL_NOT_RESOLVABLE');

const ambiguous = deriveStagingOperatorBindings({
  applications: [app],
  policies: [{
    decision: 'allow',
    include: [
      { email: { email: 'one@example.invalid' } },
      { email: { email: 'two@example.invalid' } }
    ]
  }]
});
assert.equal(ambiguous.ok, false);
assert.equal(ambiguous.error, 'ACCESS_OPERATOR_EMAIL_AMBIGUOUS');

const bypass = deriveStagingOperatorBindings({
  applications: [app],
  policies: [
    { decision: 'allow', include: [{ email: { email: 'operator@example.invalid' } }] },
    { decision: 'bypass', include: [{ everyone: {} }] }
  ]
});
assert.equal(bypass.ok, false);
assert.equal(bypass.error, 'ACCESS_BYPASS_POLICY_REJECTED');

console.log(JSON.stringify({
  ok: true,
  schema: 'riosystems.staging-worker-runtime-bindings-smoke.v1',
  sensitive_values_returned: false,
  production_deploy: false,
  external_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
