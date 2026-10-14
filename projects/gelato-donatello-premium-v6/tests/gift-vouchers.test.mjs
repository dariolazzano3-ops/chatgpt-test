import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('home contains both owner-confirmed gift voucher types with a smooth Italian transition', () => {
  const html = file('../index.html');
  const section = html.match(/<section class="v98-gifts"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'the gift section is present');
  assert.match(section, /id="gutscheine"/);
  assert.match(section, /La dolce vita/);
  assert.match(section, /beginnt bei uns/);
  assert.match(section, /v98-gifts__wave/);
  assert.match(section, /Wertgutschein/);
  assert.match(section, /Eiskugel-Gutschein/);
  assert.equal((section.match(/class="v98-gift v98-gift--/g) || []).length, 2);
  assert.equal((section.match(/href="\/kontakt\/#gutscheine-anfrage"/g) || []).length, 2);
  assert.ok(html.indexOf('class="v88-caffe-photo') < 0 || html.indexOf('data-caffe-scroll') < html.indexOf('id="gutscheine"'));
  assert.ok(html.indexOf('id="gutscheine"') < html.indexOf('class="v6-contact-cta"'));
  assert.doesNotMatch(section, /\b(?:10|20|25|50|100)\s*€/);
});

test('gift request path leads to the existing contact page and real phone action', () => {
  const contact = file('../kontakt/index.html');
  const nav = file('../assets/js/components/nav.js');
  assert.match(contact, /id="gutscheine-anfrage"/);
  assert.match(contact, /Wertgutschein oder Eiskugel-Gutschein/);
  assert.match(contact, /href="tel:\+4968069394980"/);
  assert.match(nav, /href: '\/#gutscheine', label: 'Gutscheine'/);
});
