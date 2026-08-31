#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyOperatorBranding, operatorBrandingManifest } from '../src/operator-branding-v1.js';

const html = new Response(`<!doctype html><html><head><title>RIOSYSTEMS Operator Control Plane</title></head><body><div class="brand"><strong>RIOSYSTEMS</strong><span>Private Operator Control Plane</span></div><script>const fallback="RIOSYSTEMS";</script></body></html>`, {
  status: 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '123' }
});
const branded = await applyOperatorBranding(html);
const brandedBody = await branded.text();
assert.ok(brandedBody.includes('<title>AURENTARA SYSTEMS | Operator Control</title>'));
assert.ok(brandedBody.includes('<strong>AURENTARA SYSTEMS</strong><span>Operator Control</span>'));
assert.ok(brandedBody.includes('<meta name="application-name" content="AURENTARA SYSTEMS Operator Control">'));
assert.ok(brandedBody.includes('<meta name="description" content="Private operator control environment for AURENTARA SYSTEMS.">'));
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
assert.equal(manifest.parent_brand, 'YSRIO');
assert.equal(manifest.operative_brand, 'AURENTARA SYSTEMS');
assert.equal(manifest.operator_surface, 'Operator Control');
assert.equal(manifest.browser_title, 'AURENTARA SYSTEMS | Operator Control');
assert.equal(manifest.parent_brand_prominent_in_dashboard, false);
assert.equal(manifest.internal_technology, 'RIOSYSTEMS');
assert.equal(manifest.scope, 'operator_html_presentation_only');
assert.equal(manifest.api_contracts_renamed, false);
assert.equal(manifest.runtime_namespaces_renamed, false);
assert.equal(manifest.provider_logic_changed, false);
assert.equal(manifest.dns_changed, false);
assert.equal(manifest.custom_domain_changed, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-branding-v1',
  parent: manifest.parent_brand,
  operative_brand: manifest.operative_brand,
  operator_surface: manifest.operator_surface,
  browser_title: manifest.browser_title,
  internal_technology: manifest.internal_technology,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
