import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const file = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('gifts sit between kids cups and coffee, before the visit, only once', () => {
  const html = file('../index.html');
  const kids = html.indexOf('class="v66-kids');
  const gifts = html.indexOf('class="v99-gifts" id="gutscheine"');
  const coffee = html.indexOf('data-caffe-scroll');
  const visit = html.indexOf('class="v6-contact-cta"');
  assert.ok(kids >= 0 && kids < gifts && gifts < coffee && coffee < visit);
  assert.equal((html.match(/id="gutscheine"/g) || []).length, 1);
  assert.equal((html.match(/class="v99-gift"/g) || []).length, 2);
  assert.match(html, /La dolce vita beginnt bei uns\./);
  assert.doesNotMatch(html, /class="v98-gift\b/);
});

test('both owner-provided vouchers are stored as real, optimized images and wired to contact', () => {
  const html = file('../index.html');
  const images = ['gutschein-wert-original.avif', 'gutschein-eiskugeln-original.avif'];
  for (const name of images) {
    assert.match(html, new RegExp(name));
    const path = new URL('../assets/images/editorial/' + name, import.meta.url);
    assert.ok(statSync(path).size > 5000, `${name} must be a real image asset`);
    assert.ok(statSync(path).size < 100000, `${name} should be web-optimized`);
  }
  assert.equal((html.match(/href="\/kontakt\/#gutscheine-anfrage"/g)||[]).length, 2);
  assert.match(html, /Wertgutschein/);
  assert.match(html, /Eiskugel-Gutschein/);
  assert.doesNotMatch(html, /class="v98-gift__voucher"/);
  assert.doesNotMatch(html, /\b(?:10|25|50|100)\s*€/);
});

test('the existing navigation and contact path remain in place', () => {
  const nav = file('../assets/js/components/nav.js');
  const contact = file('../kontakt/index.html');
  assert.match(nav, /href: '\/#gutscheine', label: 'Gutscheine'/);
  assert.match(contact, /id="gutscheine-anfrage"/);
  assert.match(contact, /href="tel:\+4968069394980"/);
});
