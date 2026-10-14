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

test('V104 geodata-accurate self-hosted map loads without external iframe',()=>{
 assert.match(loc,/class="v103-location__map-static"/);
 assert.match(loc,/src="\/assets\/images\/editorial\/gelato-donatello-public-map-v104\.webp"/);
 assert.match(loc,/alt="Geografisch korrekt gestaltete OpenStreetMap-Umgebung/);
 assert.doesNotMatch(loc,/<iframe\b/);
 assert.match(loc,/mlat=49\.299548&amp;mlon=6\.8977832/);
 assert.match(loc,/© OpenStreetMap contributors/);
 assert.match(loc,/href="https:\/\/www\.openstreetmap\.org\/copyright"/);
 assert.match(loc,/Burg Bucherbach unmittelbar neben dem Stadion an der Burg/);
 const file=new URL('../assets/images/editorial/gelato-donatello-public-map-v104.webp',import.meta.url);
 assert.ok(statSync(file).size>10000,'real map asset');
 assert.ok(statSync(file).size<180000,'optimized local map asset');
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

test('Editable vector master is available with geospatially accurate OSM objects', () => {
 const source=readFileSync(new URL('../assets/maps/gelato-donatello-public-map-v104.svg',import.meta.url),'utf8');
 assert.match(source,/Stadion an der Burg/);
 assert.match(source,/Burg Bucherbach/);
 assert.match(source,/Spielplatz/);
 assert.match(source,/Gelato Donatello/);
 assert.match(source,/OpenStreetMap-Mitwirkende/);
 assert.doesNotMatch(source,/Lilien-Apotheke|Little Italy|Volksbank|EDEKA/);
});

test('Burg Bucherbach is correctly NE of, and directly adjacent to, Stadion an der Burg', () => {
 const data=JSON.parse(readFileSync(new URL('../assets/maps/gelato-public-pois-v104.json',import.meta.url),'utf8'));
 const named=n=>data.places.find(p=>p.name===n);
 const a=named('Stadion an der Burg'), b=named('Burg Bucherbach');
 assert.ok(b.lat>a.lat && b.lon>a.lon,'castle must be northeast of stadium');
 const dy=(b.lat-a.lat)*111200, dx=(b.lon-a.lon)*72500;
 const distance=Math.hypot(dx,dy);
 assert.ok(distance<160 && distance>40,`features should be adjacent, distance=${distance.toFixed(1)}m`);
 assert.equal(data.places.filter(p=>p.type==='parking').length,4);
 assert.equal(data.places.filter(p=>p.type==='bus_stop').length,2);
});
