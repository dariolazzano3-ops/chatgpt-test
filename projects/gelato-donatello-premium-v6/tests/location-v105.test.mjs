import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = name => readFileSync(new URL(name, import.meta.url));
const html=read('../index.html').toString();
const css=read('../assets/css/style.css').toString();
const start=html.indexOf('<section class="v102-location"');
const loc=html.slice(start,html.indexOf('</main>',start));

test('Exactly the supplied original JPEG is used with no recomposition',()=>{
 const bytes=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
 assert.equal(bytes.length,769764);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
 assert.match(loc,/src="\/assets\/images\/editorial\/gelato-donatello-original-location-v105\.jpg"/);
 assert.match(loc,/width="1448" height="1086"/);
 assert.doesNotMatch(loc,/gelato-donatello-public-map-v104\.webp/);
});

test('No website decorations obscure or duplicate labels already in original picture',()=>{
 assert.doesNotMatch(loc,/class="v102-location__map-badge"/);
 assert.doesNotMatch(loc,/class="v103-location__map-open"/);
 assert.doesNotMatch(loc,/class="v103-location__map-attribution"/);
 assert.doesNotMatch(loc,/<iframe\b/);
 assert.match(css,/V105: exact user-supplied location image/);
 assert.match(css,/object-fit:contain/);
});

test('All existing directions and contacts are preserved',()=>{
 assert.ok(html.indexOf('data-caffe-scroll')<start);
 assert.match(loc,/Hauptstraße 4/);
 assert.match(loc,/66346 Püttlingen-Köllerbach/);
 assert.match(loc,/href="https:\/\/www\.openstreetmap\.org\/\?mlat=49\.299548&amp;mlon=6\.8977832/);
 assert.match(loc,/href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=49\.299548%2C6\.8977832"/);
 assert.match(loc,/href="tel:\+4968069394980"/);
 assert.match(loc,/href="\/kontakt\/"/);
 assert.match(loc,/Karte vergrößern/);
});
