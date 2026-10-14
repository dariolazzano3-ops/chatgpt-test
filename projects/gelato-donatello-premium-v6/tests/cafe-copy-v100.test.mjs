import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Caffè storytelling sells an experience instead of repeating coffee clichés', () => {
 const section = html.match(/<section class="v73-caffe v88-caffe-photo"[\s\S]*?<\/section>/)?.[0];
 assert.ok(section);
 assert.match(section, /MEHR ALS EINE PAUSE/);
 assert.match(section, /Komm für den Genuss\.<br \/><em>Bleib für das Gefühl\.<\/em>/);
 assert.match(section, /Ein Cappuccino\. Ein bisschen Ruhe\. Ein Moment nur für dich\./);
 assert.match(section, /href="\/kontakt\/">Jetzt vorbeikommen/);
 assert.doesNotMatch(section, /Auch wenn alles eiskalt|Ein warmer Caffè geht immer|Ein guter Kaffee/);
 assert.equal((section.match(/Cappuccino/g) || []).length, 2); // image alt + concise supporting text
});

test('Gift transition, authentic voucher cards and contact details remain intact', () => {
 assert.ok(html.indexOf('id="gutscheine"') < html.indexOf('data-caffe-scroll'));
 assert.ok(html.indexOf('data-caffe-scroll') < html.indexOf('class="v6-contact-cta"'));
 assert.match(html, /La dolce vita beginnt bei uns\./);
 assert.match(html, /gutschein-wert-original\.avif/);
 assert.match(html, /gutschein-eiskugeln-original\.avif/);
 assert.match(html, /Hauptstraße 4/);
});
