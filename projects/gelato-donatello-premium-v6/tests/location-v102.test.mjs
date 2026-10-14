import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Oversized address hero is replaced by one premium map section below the Caffè', () => {
  const coffee=html.indexOf('data-caffe-scroll');
  const location=html.indexOf('class="v102-location"');
  const footer=html.indexOf('id="site-footer"');
  assert.ok(coffee>0 && location>coffee && footer>location);
  assert.equal((html.match(/id="standort"/g)||[]).length,1);
  assert.doesNotMatch(html, /<h2>Hauptstraße 4\.<br \/>Köllerbach\.<\/h2>/);
  assert.match(html, /Das gute Leben <em>liegt ganz nah\.<\/em>/);
  assert.match(html, /Direkt gegenüber der Burg Bucherbach/);
});

test('Embedded map points to verified Gelato Donatello location', () => {
  const loc=html.slice(html.indexOf('<section class="v102-location"'),html.indexOf('<!-- footer SHOULD_NOT_EXIST -->')>=0?html.indexOf('<!-- footer SHOULD_NOT_EXIST -->'):html.indexOf('</main>'));
  assert.match(loc,/openstreetmap\.org\/export\/embed\.html/);
  assert.match(loc,/marker=49\.299548%2C6\.8977832/);
  assert.match(loc,/layer=mapnik/);
  assert.match(loc,/loading="lazy"/);
  assert.match(loc,/title="OpenStreetMap-Karte/);
  assert.match(loc,/Hauptstraße 4/);
  assert.match(loc,/66346 Püttlingen-Köllerbach/);
  assert.match(loc,/href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=49\.299548%2C6\.8977832"/);
  assert.match(loc,/href="tel:\+4968069394980"/);
  assert.match(loc,/href="\/kontakt\/"/);
  assert.match(loc,/Karte vergrößern/);
  assert.doesNotMatch(loc,/AIza|api_key=/);
});
