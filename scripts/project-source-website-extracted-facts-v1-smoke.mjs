import assert from 'node:assert/strict';
import { openProjectSourceWorkspace, intakeWebsiteSource } from '../src/project-source-workspace-intake-v1.js';

function response(status, body = '', headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => normalized[String(key).toLowerCase()] ?? null },
    text: async () => String(body)
  };
}

const html = `<!doctype html><html><head><title>Gelato Fixture</title><meta name="viewport" content="width=device-width"></head><body>
<h1>Gelato Fixture</h1>
<h2>Eis</h2><h3>Eistorten</h3><ul><li>Eisvitrine Vermietung</li></ul>
<p>Hauptstraße 4, 66346 Püttlingen</p>
<p>Telefon 06806 9394980</p>
<p>Telefon +49 176 200 150 65</p>
<p>Montag 12:00 - 22:00</p>
<p>Kugel 1,60 €</p>
<a href="/impressum">Impressum</a>
</body></html>`;

const fetcher = async (input) => {
  const url = new URL(String(input));
  if (url.pathname === '/robots.txt') return response(200, 'User-agent: *\nDisallow:\n', { 'content-type': 'text/plain' });
  if (url.pathname === '/') return response(200, html, { 'content-type': 'text/html' });
  return response(404, '', { 'content-type': 'text/html' });
};

const opened = openProjectSourceWorkspace({
  operator_id: 'operator-fixture',
  customer_id: 'gelato-fixture',
  project_id: 'website-extraction-v1',
  scope_key: 'gelato-fixture:website-extraction-v1',
  at: '2026-09-04T20:00:00.000Z'
});
assert.equal(opened.ok, true);

const imported = await intakeWebsiteSource(opened.state, {
  source_id: 'gelato-fixture-website',
  source_url: 'https://gelato.example/',
  ownership_status: 'CUSTOMER_ASSERTED',
  website_usage: { content: true, structure_reference: false, design_reference: false },
  record_extracted_facts: true,
  max_pages: 1
}, {
  fetcher,
  resolveHostname: async () => ['93.184.216.34']
}, {
  at: '2026-09-04T20:00:01.000Z'
});

assert.equal(imported.ok, true);
assert.equal(imported.extracted_is_verified, false);
assert.ok(imported.extracted_fact_count >= 6);
assert.equal(imported.extracted_facts.every((fact) => fact.origin === 'EXTRACTED'), true);
assert.equal(imported.extracted_facts.every((fact) => ['UNVERIFIED','SOURCE_CONFLICT'].includes(fact.verification_status)), true);

const phoneFacts = imported.state.facts.filter((fact) => fact.field_path === 'business.phone');
assert.equal(phoneFacts.length, 2);
assert.equal(phoneFacts.every((fact) => fact.critical === true), true);
assert.equal(phoneFacts.every((fact) => fact.verification_status === 'SOURCE_CONFLICT'), true);

const pricing = imported.state.facts.find((fact) => fact.field_path === 'business.pricing');
assert.ok(pricing);
assert.equal(pricing.verification_status, 'UNVERIFIED');
assert.deepEqual(pricing.value, ['1,60 €']);

const products = imported.state.facts.find((fact) => fact.field_path === 'business.products');
assert.ok(products);
assert.equal(products.verification_status, 'UNVERIFIED');
assert.ok(products.value.includes('Eis'));
assert.ok(products.value.includes('Eistorten'));

const address = imported.state.facts.find((fact) => fact.field_path === 'business.address');
assert.ok(address);
assert.equal(address.verification_status, 'UNVERIFIED');

assert.equal(imported.variable_cost_eur, 0);
assert.equal(imported.paid_provider_calls, 0);
assert.equal(imported.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.project-source-website-extracted-facts.v1',
  extracted_fact_count: imported.extracted_fact_count,
  phone_conflict_count: phoneFacts.length,
  extracted_is_verified: false,
  variable_cost_eur: 0,
  paid_provider_calls: 0,
  production_deploy: false
}, null, 2));
