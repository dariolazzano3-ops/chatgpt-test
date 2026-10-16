import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'events/index.html'),'utf8');
const css=readFileSync(path.join(root,'assets/css/events-v121.css'),'utf8');
const img=path.join(root,'assets/images/events/gelato-event-eislabor-original-v125.jpg');
test('V125 exact unmodified user JPEG rejects substitutions',()=>{
 assert.ok(existsSync(img),'Missing exact uploaded original JPEG. Never deploy with missing artwork.');
 const data=readFileSync(img);
 assert.equal(data.length,583794);
 assert.equal(createHash('sha256').update(data).digest('hex'),'5f98873c1fb3f171cd6ce9ed08d9523d04568d7040fdea867123c359628230e6');
 assert.equal(data.subarray(0,3).toString('hex'),'ffd8ff');
 assert.ok(html.includes('gelato-event-eislabor-original-v125.jpg'));
 assert.match(html,/width="1536" height="864"/);
});
test('V125 full original artwork uncropped on desktop/mobile',()=>{
 assert.match(css,/ev121-hero__figure img\{[^}]*width:100%;height:auto;object-fit:contain/);
 assert.match(css,/object-position:center;filter:none;transform:none;max-height:none/);
 assert.match(css,/ev121-hero__figure:after\{display:none\}/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/ev121-hero__figure img\{object-fit:contain;object-position:center center\}/);
 assert.match(html,/href="#teilnahme">Teilnahme anfragen/);
 assert.match(html,/href="#highlights">Mehr erfahren/);
 assert.match(html,/data-event-form-status="disabled"/);
});
