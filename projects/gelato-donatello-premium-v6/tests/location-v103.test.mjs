import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const loc=html.slice(html.indexOf('<section class="v102-location"'),html.indexOf('</main>'));

test('premium map section follows the cafe and replaces oversized address hero',()=>{
 const coffee=html.indexOf('data-caffe-scroll');const location=html.indexOf('class="v102-location"');const footer=html.indexOf('id="site-footer"');
 assert.ok(coffee>0&&location>coffee&&footer>location);
 assert.equal((html.match(/id="standort"/g)||[]).length,1);
 assert.doesNotMatch(html,/<h2>Hauptstraße 4\.<br \/>Köllerbach\.<\/h2>/);
 assert.match(html,/Das gute Leben <em>liegt ganz nah\.<\/em>/);
 assert.match(html,/Direkt gegenüber der Burg Bucherbach/);
});

test('V103 self-hosted map loads independently from OpenStreetMap third-party iframe',()=>{
 assert.match(loc,/class="v103-location__map-static"/);
 assert.match(loc,/src="\/assets\/images\/editorial\/gelato-donatello-location-map-v103\.webp"/);
 assert.match(loc,/alt="Straßenkarte von Köllerbach mit Standortmarkierung/);
 assert.doesNotMatch(loc,/<iframe\b/);
 assert.match(loc,/mlat=49\.299548&amp;mlon=6\.8977832/);
 assert.match(loc,/© OpenStreetMap contributors/);
 assert.match(loc,/href="https:\/\/www\.openstreetmap\.org\/copyright"/);
 const file=new URL('../assets/images/editorial/gelato-donatello-location-map-v103.webp',import.meta.url);
 assert.ok(statSync(file).size>10000,'real map asset');
 assert.ok(statSync(file).size<150000,'optimized local map asset');
});

test('real address, phone, directions and external map link preserved',()=>{
 assert.match(loc,/Hauptstraße 4/);
 assert.match(loc,/66346 Püttlingen-Köllerbach/);
 assert.match(loc,/href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=49\.299548%2C6\.8977832"/);
 assert.match(loc,/href="tel:\+4968069394980"/);
 assert.match(loc,/href="\/kontakt\/"/);
 assert.match(loc,/Karte vergrößern/);
 assert.doesNotMatch(loc,/AIza|api_key=/);
});
