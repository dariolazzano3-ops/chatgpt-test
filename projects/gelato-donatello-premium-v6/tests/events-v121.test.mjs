import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFileSync(path.join(root,f),'utf8');
const html=read('events/index.html');
const css=read('assets/css/events-v121.css');
const img=path.join(root,'assets/images/events/gelato-event-eislabor-hero-v121.avif');

test('V121 event headline, hero image and both relevant CTAs',()=>{
 assert.match(html,/GELATO DONATELLO EVENTS/);
 assert.match(html,/Ein Blick hinter <em>die Kulissen\.<\/em>/);
 assert.match(html,/src="\/assets\/images\/events\/gelato-event-eislabor-hero-v121\.avif"/);
 assert.ok(statSync(img).size>20000,'Missing true user-provided lab artwork. Fail deployment closed.');
 assert.match(html,/href="#teilnahme">Teilnahme anfragen/);
 assert.match(html,/href="#highlights">Mehr erfahren/);
 assert.match(html,/Illustrative Event-Vorschau/);
});
test('Four distinct highlights, ordered schedule and minimal winter information',()=>{
 for(const s of ['Rundführung durchs Eislabor','So entsteht unser Eis','Eigenes Eis mitnehmen','Begrenzte Teilnehmerplätze'])assert.ok(html.includes(s));
 for(const s of ['Begrüßung','Rundgang durchs Eislabor','Erklärung &amp; Vorführung','Eigenes Eis mitnehmen'])assert.ok(html.includes(s));
 assert.match(html,/Winter-Event/);
 assert.match(html,/Je nach Nachfrage/);
 assert.match(html,/Begrenzt · Anzahl offen/);
 assert.match(html,/Weitere Details folgen/);
 assert.equal((html.match(/class="ev121-program__list"/g)||[]).length,1);
 assert.equal((html.match(/<li><span>0[1-4]<\/span>/g)||[]).length,4);
});
test('Form is explicitly disabled: no endpoint, false sale or data processing',()=>{
 for(const field of ['name','email','phone','requested_seats','note'])assert.match(html,new RegExp('name="'+field+'"'));
 assert.match(html,/fieldset disabled/);
 assert.match(html,/name="privacy_acknowledged"/);
 assert.match(html,/name="marketing_opt_in"/);
 assert.match(html,/data-event-form-status="disabled"/);
 assert.match(html,/type="button" class="ev121-form__submit" disabled/);
 assert.match(html,/keine personenbezogenen Daten entgegengenommen, versendet oder gespeichert/);
 assert.doesNotMatch(html,/<form[^>]+action=|type="submit"|fetch\(/);
 assert.match(html,/noindex,nofollow,noarchive/);
});
test('Mobile-first rules and original site header/footer preserved',()=>{
 assert.match(html,/id="site-header"/);
 assert.match(html,/id="site-footer"/);
 assert.match(html,/src="\/assets\/js\/app\.js"/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:385px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.ev121-hero__figure img\{/);
});
