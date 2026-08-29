import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../projects/bakery-muller-staging/', import.meta.url);
const [html, css, manifestText] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('project.json', root), 'utf8')
]);
const manifest = JSON.parse(manifestText);

assert.equal(manifest.schema, 'riosystems.web-staging-project.v1');
assert.equal(manifest.project.slug, 'bakery-muller-staging');
assert.equal(manifest.generated_by, 'riosystems-native-web');
assert.equal(manifest.environment, 'staging');
assert.equal(manifest.synthetic_test_data_only, true);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.external_integrations, false);
assert.equal(manifest.forms_enabled, false);
assert.equal(manifest.payments_enabled, false);
assert.equal(manifest.hosting_target, 'cloudflare-pages-preview');
assert.equal(manifest.deployment_authorized, false);
assert.equal(manifest.custom_domain, false);
assert.equal(manifest.dns_change, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);
assert.match(html, /RIOSYSTEMS STAGING/);
assert.match(html, /SYNTHETISCHE TESTDATEN/);
assert.match(html, /noindex,nofollow/);
assert.doesNotMatch(html, /<form\b/i);
assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/i);
assert.ok(css.length > 1000);

console.log('RIOSYSTEMS Bäckerei Müller web staging artifact readiness: OK');
