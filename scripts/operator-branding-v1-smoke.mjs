#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyOperatorBranding, operatorBrandingManifest } from '../src/operator-branding-v1.js';

const html = new Response('<title>RIOSYSTEMS Operator Control Plane</title><strong>RIOSYSTEMS</strong><script>const fallback="RIOSYSTEMS";</script>', {
  status: 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '123' }
});
const branded = await applyOperatorBranding(html);
const brandedBody = await branded.text();
assert.ok(brandedBody.includes('AURENTARA SYSTEMS Operator Control Plane'));
assert.ok(brandedBody.includes('<strong>AURENTARA SYSTEMS</strong>'));
assert.ok(!brandedBody.includes('RIOSYSTEMS'));
assert.equal(branded.headers.get('x-aurentara-brand-layer'), 'operator-presentation-v1');
assert.equal(branded.headers.has('content-length'), false);

const json = new Response(JSON.stringify({ schema: 'riosystems.operator-runtime.v1', label: 'RIOSYSTEMS internal' }), {
  status: 200,
  headers: { 'content-type': 'application/json' }
});
const untouched = await applyOperatorBranding(json);
assert.deepEqual(await untouched.json(), { schema: 'riosystems.operator-runtime.v1', label: 'RIOSYSTEMS internal' });

const manifest = operatorBrandingManifest();
assert.equal(manifest.parent_brand, 'YSRIO GROUP');
assert.equal(manifest.operative_brand, 'AURENTARA SYSTEMS');
assert.equal(manifest.internal_technology, 'RIOSYSTEMS');
assert.equal(manifest.scope, 'operator_html_presentation_only');
assert.equal(manifest.api_contracts_renamed, false);
assert.equal(manifest.runtime_namespaces_renamed, false);
assert.equal(manifest.provider_logic_changed, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-branding-v1',
  parent: manifest.parent_brand,
  operative_brand: manifest.operative_brand,
  internal_technology: manifest.internal_technology,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
