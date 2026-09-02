#!/usr/bin/env node
import assert from 'node:assert/strict';
import { deriveStagingOperatorBindings, providerDurabilitySources } from './staging-worker-runtime-bindings-v1.mjs';

const app = {
  id: '11111111-2222-3333-4444-555555555555',
  type: 'self_hosted',
  domain: 'https://riosystems-staging.example.workers.dev/operator',
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

const noProviderSources = providerDurabilitySources({});
assert.equal(noProviderSources.activepieces_api_key_present, false);
assert.equal(noProviderSources.webflow_site_token_present, false);
assert.deepEqual(noProviderSources.restorable_secret_names, []);
assert.equal(noProviderSources.durability_gate_remains, true);
assert.equal(noProviderSources.sensitive_values_returned, false);

const activepiecesOnly = providerDurabilitySources({ ACTIVEPIECES_API_KEY: 'synthetic-activepieces-key' });
assert.equal(activepiecesOnly.activepieces_api_key_present, true);
assert.equal(activepiecesOnly.webflow_site_token_present, false);
assert.deepEqual(activepiecesOnly.restorable_secret_names, ['ACTIVEPIECES_API_KEY']);
assert.equal(activepiecesOnly.durability_gate_remains, true);
assert.equal(JSON.stringify(activepiecesOnly).includes('synthetic-activepieces-key'), false);

const bothProviderSources = providerDurabilitySources({
  ACTIVEPIECES_API_KEY: 'synthetic-activepieces-key',
  WEBFLOW_SITE_TOKEN: 'synthetic-webflow-token'
});
assert.equal(bothProviderSources.activepieces_api_key_present, true);
assert.equal(bothProviderSources.webflow_site_token_present, true);
assert.deepEqual(bothProviderSources.restorable_secret_names, ['ACTIVEPIECES_API_KEY', 'WEBFLOW_SITE_TOKEN']);
assert.equal(bothProviderSources.durability_gate_remains, false);
assert.equal(JSON.stringify(bothProviderSources).includes('synthetic-activepieces-key'), false);
assert.equal(JSON.stringify(bothProviderSources).includes('synthetic-webflow-token'), false);

console.log(JSON.stringify({
  ok: true,
  schema: 'riosystems.staging-worker-runtime-bindings-smoke.v1',
  access_domain_path_normalized: true,
  durable_provider_secret_sources_supported: true,
  missing_provider_sources_fail_visible: true,
  sensitive_values_returned: false,
  production_deploy: false,
  external_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
