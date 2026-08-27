import assert from 'node:assert/strict';
import { buildEditFeatureRegressionChecks, extractProjectFeatureFingerprint } from './edit-feature-fingerprint.mjs';

const baseline = {
  'index.html': `
    <section class="search-panel" data-factory-feature="catalog-search">
      <form id="search-form"><input id="search-input"><button id="search-submit">Suchen</button></form>
    </section>
    <section class="checkout-panel"><a id="checkout-link" href="/checkout">Checkout</a></section>`,
  '_worker.js': `if (url.pathname === '/api/search') {} if (url.pathname === '/api/checkout') {}`
};

const fingerprint = extractProjectFeatureFingerprint(baseline);
assert.ok(fingerprint.some((feature) => feature.key === 'interactive_id:search-form'));
assert.ok(fingerprint.some((feature) => feature.key === 'feature_marker:catalog-search'));
assert.ok(fingerprint.some((feature) => feature.key === 'panel:checkout-panel'));
assert.ok(fingerprint.some((feature) => feature.key === 'api_route:/api/checkout'));

const healthy = structuredClone(baseline);
assert.ok(buildEditFeatureRegressionChecks({ mode: 'edit', prompt: 'Passe nur die Abstände an.' }, baseline, healthy).every((check) => check.ok));

const broken = {
  ...baseline,
  'index.html': baseline['index.html'].replace('<a id="checkout-link" href="/checkout">Checkout</a>', ''),
  '_worker.js': baseline['_worker.js'].replace("if (url.pathname === '/api/checkout') {}", '')
};
const brokenChecks = buildEditFeatureRegressionChecks({ mode: 'edit', prompt: 'Passe nur die Abstände an.' }, baseline, broken);
assert.equal(brokenChecks.find((check) => check.id.includes('interactive_id_checkout_link'))?.ok, false);
assert.equal(brokenChecks.find((check) => check.id.includes('api_route_api_checkout'))?.ok, false);

const removalChecks = buildEditFeatureRegressionChecks({ mode: 'edit', prompt: 'Entferne den Checkout vollständig.' }, baseline, broken);
assert.ok(!removalChecks.some((check) => check.id.includes('api_route_api_checkout')), 'explicit API feature removal should be allowed');

assert.equal(buildEditFeatureRegressionChecks({ mode: 'evolve', prompt: 'Neue App.' }, baseline, broken).length, 0);

console.log(JSON.stringify({
  ok: true,
  guard: 'project-wide-edit-feature-fingerprint',
  fingerprint_size: fingerprint.length,
  cases: {
    healthy_edit: 'passed',
    accidental_feature_loss: 'blocked',
    explicit_feature_removal: 'allowed',
    evolve_mode: 'not_scoped'
  }
}, null, 2));
