import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const css=readFileSync(path.join(root,'assets/css/drinks-v116.css'),'utf8');
const js=readFileSync(path.join(root,'assets/js/drinks-v116.js'),'utf8');
test('Milk circuit rotates 6x faster (5.6s / 6 = 933.333ms) without altering its linear compositor motion',()=>{
 assert.match(css,/animation:dr118-milk-circuit var\(--dr118-lap-time,933\.333ms\) linear infinite paused/);
 const ms=Number(css.match(/--dr118-lap-time,(\d+\.\d+)ms/)[1]);
 assert.ok(Math.abs(ms-5600/6)<.002,'Incorrect rotation speed');
 assert.ok(Math.abs(2*ms-1866.66667)<.01,'Incorrect switch interval');
 assert.match(css,/@keyframes dr118-milk-circuit\{from\{transform:rotate\(0\)\}to\{transform:rotate\(360deg\)\}\}/);
});
test('Switch still relies on two completed CSS rotations, with ordered synchronized images, title and top label',()=>{
 assert.match(js,/const order = \[0, 2, 1\]/);
 assert.match(js,/flow\.addEventListener\('animationiteration'/);
 assert.match(js,/if \(completedLaps === 2\)/);
 assert.match(js,/setFlavor\(order\[\(order\.indexOf\(selected\) \+ 1\) % 3\]\)/);
 assert.match(js,/frame\.classList\.toggle\('is-active', i === next\)/);
 assert.match(js,/title\.textContent = names\[next\]/);
 assert.match(js,/button\.querySelector\('\.dr118-choice-label'\)\.textContent = shortNames\[flavor\]/);
 assert.doesNotMatch(js,/setInterval|setTimeout/);
});
test('Reduced motion and offscreen pausing remain unchanged',()=>{
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(js,/IntersectionObserver/);
 assert.match(js,/document\.hidden/);
 assert.match(js,/animationPlayState = running \? 'running' : 'paused'/);
 assert.match(css,/\.dr118-milk-flow\{animation:none!important/);
});
