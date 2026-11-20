// FollowClean V21 landing smoke test (headless Chrome via DevTools protocol, no npm deps).
// Usage: node apps/followclean/tests/landing-v21-smoke.mjs   (needs google-chrome/chromium, Node >= 22)
// iPhone-sized viewport (390x844, touch, DPR 3). Chromium engine, NOT Safari/WebKit.
// Checks: section order, honest copy, no horizontal overflow, scroll reveal, dashboard demo states,
// FAQ, internal anchors, reduced motion. No network, no Instagram, no Stripe.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const bin=['google-chrome','chromium','chromium-browser'].find(b=>{try{execFileSync('which',[b]);return true}catch{return false}});
if(!bin){console.error('SKIP: no Chrome/Chromium binary found');process.exit(2);}
const server=http.createServer((req,res)=>{
  if(req.url.split('?')[0]!=='/'){res.writeHead(404,{'Content-Type':'application/json'}).end('{}');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const profile=await mkdtemp(join(tmpdir(),'fc-landing-'));
const chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',
  '--user-data-dir='+profile,'--no-first-run','--disable-extensions','about:blank']);
const wsUrl=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(Error('Chrome did not start')),20000);
  chrome.stderr.on('data',d=>{buf+=d;const m=buf.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);res(m[1]);}});});
const ws=new WebSocket(wsUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let seq=0;const waiting=new Map(),pageErrors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&waiting.has(m.id)){const {res,rej}=waiting.get(m.id);waiting.delete(m.id);m.error?rej(Error(m.error.message)):res(m.result);}
  if(m.method==='Runtime.exceptionThrown')pageErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{const id=++seq;waiting.set(id,{res,rej});ws.send(JSON.stringify({id,method,params,sessionId}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=0,count=0,cdp,ev;
async function test(label,fn){count++;try{await fn();console.log('PASS',label);}
  catch(e){failed++;console.error('FAIL',label,e.message);process.exitCode=1;}}
async function openPage(reduce){
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  cdp=(m,p)=>send(m,p,sessionId);
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.bringToFront');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]});
  ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression:'(async()=>{'+expression+'})()',awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  await cdp('Page.navigate',{url});
  for(let i=0;i<200&&!(await ev("return document.readyState==='complete'"));i++)await sleep(50);
  await sleep(300);
}
const stateOf="const d=document.querySelector('[data-fcl-demo]');const t=d.querySelector('[data-fcl-target]');return {s:t.dataset.s,label:t.querySelector('[data-fcl-state]').textContent,done:d.querySelector('[data-fcl-done]').textContent}";
try{
  // Static checks on the shipped HTML
  await test('Hero copy follows the V10 brief',async()=>{
    assert.match(html,/<h1 id="hero-title">Finde heraus, <em>wer dir nicht zurückfolgt\.<\/em><\/h1>/);
    assert.match(html,/Analysiere deine Instagram-Verbindungen\. Einfach, übersichtlich und ohne dein Instagram-Passwort\./);
    assert.match(html,/id="fc-analyze-submit">Jetzt kostenlos analysieren/);});
  await test('Honest copy: no HTML-export claim, Smart Scan marked Beta, demo marked as invented data',async()=>{
    assert.ok(!/HTML-Exporte, auch|JSON- und HTML-Exporte/.test(html),'HTML exports are rejected by the parser and must not be advertised');
    assert.match(html,/Beta · noch nicht freigeschaltet/);
    assert.match(html,/Erfundene Beispiel-Accounts/);assert.match(html,/Beispieldaten/);
    assert.match(html,/Derzeit nur Stripe-Testmodus, keine echte Zahlung/);});

  await openPage(false);
  await test('All landing sections exist in the intended order',async()=>{
    const ids=await ev("return [...document.querySelectorAll('main > section')].map(s=>s.id||s.className.split(' ')[0])");
    const want=['hero','workspace','vorschau','so-gehts','zwei-wege','features','sicherheit','preise','faq','los','rechtliches'];
    const pos=want.map(w=>ids.indexOf(w));
    assert.ok(pos.every(p=>p>=0),'missing: '+want.filter((w,i)=>pos[i]<0).join(','));
    assert.deepEqual([...pos].sort((a,b)=>a-b),pos,'order: '+ids.join(','));});
  await test('Every internal anchor points to an existing id',async()=>{
    const bad=await ev("return [...document.querySelectorAll('a[href^=\"#\"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1)))");
    assert.deepEqual(bad,[]);});
  await test('Motion enabled: reveal elements start hidden, then appear on scroll',async()=>{
    assert.equal(await ev("return document.documentElement.classList.contains('fcl-motion')"),true);
    assert.equal(await ev("return getComputedStyle(document.querySelector('#faq [data-fcl-reveal]')).opacity"),'0');
    await ev("document.querySelector('#vorschau').scrollIntoView({block:'start',behavior:'instant'})");await sleep(250);
    assert.ok(await ev("return document.querySelector('[data-fcl-demo]').classList.contains('fcl-in')"));});
  await test('Dashboard demo: open → profile visited (blue) → confirmed done (green), counters land on final values',async()=>{
    await sleep(900);
    assert.deepEqual(await ev(stateOf),{s:'open',label:'Offen',done:'12'});
    await sleep(1100);
    assert.deepEqual(await ev(stateOf),{s:'visited',label:'Profil besucht',done:'12'});
    await sleep(1400);
    assert.deepEqual(await ev(stateOf),{s:'done',label:'Erledigt ✓',done:'13'});
    assert.deepEqual(await ev("return [...document.querySelectorAll('[data-fcl-demo] [data-fcl-count]')].map(e=>e.textContent)"),['412','389','37']);
    const c=await ev("const g=s=>getComputedStyle(document.querySelector('[data-fcl-demo] .fcl-row'+s+' .fcl-state')).color;return [g('[data-s=\"done\"]'),g('[data-s=\"visited\"]')]");
    assert.notEqual(c[0],c[1],'visited and done must look different');});
  await test('Replay restarts the demo from the open state',async()=>{
    await ev("document.querySelector('[data-fcl-replay]').click()");await sleep(200);
    assert.equal((await ev(stateOf)).s,'open');});
  await test('All reveal elements become visible after scrolling through the page',async()=>{
    for(let y=0;y<30;y++){await ev("window.scrollBy({top:600,behavior:'instant'})");await sleep(60);}
    await sleep(900);
    const hidden=await ev("return [...document.querySelectorAll('[data-fcl-reveal]')].filter(e=>!e.classList.contains('fcl-in')||getComputedStyle(e).opacity!=='1').length");
    assert.equal(hidden,0);});
  await test('FAQ opens on tap and stays inside the viewport width',async()=>{
    await ev("document.querySelector('#faq summary').click()");await sleep(400);
    const s=await ev("const d=document.querySelector('#faq details');const r=d.getBoundingClientRect();return {open:d.open,fits:r.right<=innerWidth+1&&r.left>=-1,h:d.querySelector('.fcl-faq-a').getBoundingClientRect().height>20}");
    assert.deepEqual(s,{open:true,fits:true,h:true});});
  await test('No horizontal overflow at 390px and touch targets of new buttons ≥ 44px',async()=>{
    assert.ok(await ev('return document.documentElement.scrollWidth<=window.innerWidth+1'),'overflow');
    const small=await ev("return [...document.querySelectorAll('.fcl-btn,.fcl-faq summary')].filter(e=>e.getBoundingClientRect().height<44).length");
    assert.equal(small,0);});
  await test('No page errors',async()=>assert.deepEqual(pageErrors,[]));

  await openPage(true);
  await test('Reduced motion: no motion class, content visible, demo shows the final state without playing',async()=>{
    assert.equal(await ev("return document.documentElement.classList.contains('fcl-motion')"),false);
    assert.equal(await ev("return [...document.querySelectorAll('[data-fcl-reveal]')].filter(e=>getComputedStyle(e).opacity!=='1').length"),0);
    await ev("document.querySelector('#vorschau').scrollIntoView({behavior:'instant'})");await sleep(700);
    assert.deepEqual(await ev(stateOf),{s:'done',label:'Erledigt ✓',done:'13'});
    assert.equal(await ev("return getComputedStyle(document.querySelector('.hero-copy h1')).animationName"),'none');});
  await test('No page errors (reduced motion)',async()=>assert.deepEqual(pageErrors,[]));
}finally{
  console.log(failed?failed+' FAILED':'FollowClean landing V21 smoke: '+count+' checks passed');
  ws.close();chrome.kill('SIGKILL');server.close();await sleep(300);
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
