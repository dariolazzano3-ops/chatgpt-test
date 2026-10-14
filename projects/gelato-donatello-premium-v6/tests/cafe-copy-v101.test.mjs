import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Caffè storytelling connects authentic ice cream and Italian coffee without old clichés', () => {
 const section = html.match(/<section class="v73-caffe v88-caffe-photo"[\s\S]*?<\/section>/)?.[0];
 assert.ok(section);
 assert.match(section, /ZWEI KLASSIKER\. EIN GENUSSMOMENT\./);
 assert.match(section, /Zu echtem Eis<br \/><em>darf ein echter Caffè nicht fehlen\.<\/em>/);
 assert.match(section, /Erst ein Eis\. Dann ein Cappuccino\. Und am liebsten noch ein bisschen bleiben\./);
 assert.match(section, /href="#standort">Jetzt vorbeikommen/);
 assert.doesNotMatch(section, /Komm für den Genuss|Bleib für das Gefühl|Auch wenn alles eiskalt|Ein warmer Caffè geht immer/);
 assert.equal((section.match(/Cappuccino/g) || []).length, 2); // image alt + concise supporting text
});

test('Gift transition, authentic voucher cards and contact details remain intact', () => {
 assert.ok(html.indexOf('id="gutscheine"') < html.indexOf('data-caffe-scroll'));
 assert.ok(html.indexOf('data-caffe-scroll') < html.indexOf('class="v102-location"'));
 assert.match(html, /La dolce vita beginnt bei uns\./);
 assert.match(html, /gutschein-wert-original\.avif/);
 assert.match(html, /gutschein-eiskugeln-original\.avif/);
 assert.match(html, /Hauptstraße 4/);
});
