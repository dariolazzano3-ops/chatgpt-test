// FollowClean real-browser UX smoke test (headless Chrome via DevTools protocol, no npm deps).
// Usage: node apps/followclean/tests/chrome-ux-smoke.mjs   (needs google-chrome/chromium, Node >= 22)
// iPhone-sized viewport (390x844, touch, DPR 3). This is the Chromium engine, NOT Safari/WebKit:
// it does not replace tests/webkit-smoke.mjs or a check on a real iPhone.
// Synthetic export only. No Instagram request (profile navigation is cancelled), no Stripe, no API.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const bin=['google-chrome','chromium','chromium-browser'].find(b=>{try{execFileSync('which',[b]);return true}catch{return false}});
if(!bin){console.error('SKIP: no Chrome/Chromium binary found');process.exit(2);}
const server=http.createServer((req,res)=>{
  if(req.url.split('?')[0]!=='/'){res.writeHead(404).end('{}');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const profile=await mkdtemp(join(tmpdir(),'fc-chrome-'));
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
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
const cdp=(m,p)=>send(m,p,sessionId);
await cdp('Runtime.enable');await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
await cdp('Emulation.setTouchEmulationEnabled',{enabled:true});
async function ev(expression){
  const r=await cdp('Runtime.evaluate',{expression:'(async()=>{'+expression+'})()',awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label,ms=20000){const end=Date.now()+ms;
  while(Date.now()<end){if(await ev('return !!('+expression+')'))return;await sleep(100);}
  throw Error('Timeout: '+label);}
async function shot(name){if(!process.env.FC_SHOTS)return;
  const {data}=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(process.env.FC_SHOTS,name+'.png'),Buffer.from(data,'base64'));}
let failed=0,count=0;
async function test(label,fn){count++;try{await fn();console.log('PASS',label);}
  catch(e){failed++;console.error('FAIL',label,e.message);process.exitCode=1;}}
// Helpers injected into the page: cancel real navigation, simulate leaving and returning.
const helpers=`
window.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[target="_blank"]');if(a)e.preventDefault();});
window.__vis='visible';
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__vis});
window.__leaveAndReturn=()=>{window.__vis='hidden';document.dispatchEvent(new Event('visibilitychange'));
  window.__vis='visible';document.dispatchEvent(new Event('visibilitychange'));};
window.__row=n=>[...document.querySelectorAll('#profiles-list .profile-row')].find(r=>r.querySelector('strong').textContent==='@'+n);
window.__box=el=>{const r=el.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};};`;
try{
  await cdp('Page.navigate',{url});
  await until("document.readyState==='complete' && document.querySelector('#fc-why-live')",'page load');
  await ev(helpers);

  await test('Page loads at 390px without script errors or horizontal overflow',async()=>{
    await sleep(400);
    assert.deepEqual(pageErrors,[]);
    assert.ok(await ev('return document.documentElement.scrollWidth<=window.innerWidth+1'),'horizontal overflow');});
  await test('Export guide is collapsed, inert and hidden from assistive tech by default',async()=>{
    const s=await ev("const p=document.querySelector('#fc-guide-panel');return {open:p.classList.contains('is-open'),inert:p.inert,aria:p.getAttribute('aria-hidden'),h:p.getBoundingClientRect().height}");
    assert.deepEqual([s.open,s.inert,s.aria],[false,true,'true']);assert.ok(s.h<4,'collapsed height '+s.h);});
  await test('Live explainer opens on tap, names all four states, tap target >= 44px',async()=>{
    const s=await ev(`const d=document.querySelector('#fc-why-live');const sum=d.querySelector('summary');
      const before=d.open;sum.click();await new Promise(r=>setTimeout(r,350));
      return {before,after:d.open,h:__box(sum).h,tags:[...d.querySelectorAll('.fc-why-tag')].map(t=>t.textContent),
        bodyH:__box(d.querySelector('.fc-why-live-body')).h,cta:__box(d.querySelector('.fc-why-live-cta')).h}`);
    assert.deepEqual([s.before,s.after],[false,true]);
    assert.deepEqual(s.tags,['Bestätigt','Gegenseitig','Unbestätigt','Unklar']);
    assert.ok(s.h>=44&&s.cta>=44&&s.bodyH>80,JSON.stringify(s));
    await shot('1-explainer');});
  await test('Explainer button opens the export guide and syncs every toggle',async()=>{
    await ev("document.querySelector('.fc-why-live-cta').click()");
    await until("document.querySelector('#fc-guide-panel').getBoundingClientRect().height>200",'guide expanded');
    const s=await ev(`const p=document.querySelector('#fc-guide-panel');
      return {open:p.classList.contains('is-open'),inert:p.inert,aria:p.getAttribute('aria-hidden'),
        steps:p.querySelectorAll('.export-step').length,
        expanded:[...document.querySelectorAll('[data-guide-toggle]')].map(b=>b.getAttribute('aria-expanded')),
        overflow:document.documentElement.scrollWidth>window.innerWidth+1}`);
    assert.deepEqual([s.open,s.inert,s.aria,s.steps,s.overflow],[true,false,'false',3,false]);
    assert.ok(s.expanded.length>=3&&s.expanded.every(x=>x==='true'),s.expanded.join());
    await sleep(500);await shot('2-guide-open');});
  await test('Export guide closes again and returns to inert',async()=>{
    await ev("document.querySelector('[data-guide-toggle]').click()");
    await until("document.querySelector('#fc-guide-panel').getBoundingClientRect().height<4",'guide collapsed');
    assert.equal(await ev("return document.querySelector('#fc-guide-panel').inert"),true);});
  const feed=async()=>{
    await ev(`const make=n=>({string_list_data:[{value:n,href:'https://www.instagram.com/'+n+'/'}]});
      const zip=new JSZip();zip.file('connections/followers_and_following/followers_1.json',JSON.stringify(['alice'].map(make)));
      zip.file('connections/followers_and_following/following.json',JSON.stringify({relationships_following:['alice','bob','carla','_.dora'].map(title=>({title}))}));
      const file=new File([await zip.generateAsync({type:'blob'})],'test.zip',{type:'application/zip'});
      const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#file-input');
      input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));`);
    await until("!document.querySelector('#results-view').hidden && window.__row('bob')",'results');
    // Progress is stored per account name, exactly as a user would enter it.
    await ev("const a=document.querySelector('#fc-history-account');a.value='example.test';a.dispatchEvent(new Event('input',{bubbles:true}));a.dispatchEvent(new Event('change',{bubbles:true}));");
    await ev("document.querySelector('#fc-insights-start').click()");
    await until("!document.querySelector('#detail-view').hidden && __box(__row('bob')).h>0",'list opened');};
  const stored=()=>ev("return localStorage.getItem('followclean:progress:v2:example.test')||''");
  await test('Hero example uses self-drawn inline SVG avatars, no embedded photos',async()=>{
    assert.ok(!html.includes('data:image/'),'embedded raster image left in page');
    const s=await ev(`return {imgs:document.images.length,svgs:[...document.querySelectorAll('.balance-portrait svg')].map(x=>[__box(x).w>=60,x.getAttribute('role'),x.getAttribute('aria-label')].join('|'))}`);
    assert.equal(s.imgs,0);
    assert.deepEqual(s.svgs,['true|img|Jonas, gezeichnetes Beispiel-Profil','true|img|Matilda, gezeichnetes Beispiel-Profil']);});
  await test('ZIP import (nested export folders) renders local fallback avatars only',async()=>{
    await feed();
    const s=await ev(`const rows=[...document.querySelectorAll('#profiles-list .profile-row')];
      return {n:rows.length,imgs:document.querySelectorAll('#profiles-list img').length,
        av:rows.map(r=>{const a=r.querySelector('.profile-avatar');return [a.textContent,a.dataset.fcFallback,a.style.getPropertyValue('--fc-av-h')!==''].join('|')})}`);
    assert.equal(s.n,3);assert.equal(s.imgs,0);
    assert.deepEqual(s.av.sort(),['B|1|true','C|1|true','D|1|true']);});
  const state=n=>ev(`const r=__row('${n}');return {cls:r.className,text:r.querySelector('.profile-status').textContent,
    toast:!document.querySelector('#visit-toast').hidden,toastText:document.querySelector('#visit-toast-text').textContent}`);
  const progress=()=>ev("return document.querySelector('#progress-text').textContent");
  await test('Import result: 3 non-followers, mutual excluded, progress starts at 0 von 3',async()=>{
    assert.equal(await ev("return !!__row('alice')"),false);
    assert.equal(await progress(),'0 von 3');});
  await test('Opening a profile marks it visited, never done',async()=>{
    await ev("__row('bob').querySelector('.profile-link').click();await new Promise(r=>setTimeout(r,80));");
    const s=await state('bob');
    assert.ok(s.cls.includes('fc-row-opened')&&!s.cls.includes('fc-row-done'),s.cls);
    assert.match(s.text,/Profil besucht · noch nicht erledigt/);});
  await test('Returning from Instagram asks; it does NOT mark the account done',async()=>{
    await ev("__leaveAndReturn();await new Promise(r=>setTimeout(r,120));");
    const s=await state('bob');
    assert.ok(s.cls.includes('fc-row-opened')&&!s.cls.includes('fc-row-done'),s.cls);
    assert.equal(s.toast,true);assert.match(s.toastText,/@bob.*kann das nicht sehen/);
    const saved=await stored();
    assert.match(saved,/"bob":"opened"/,'visited state is persisted: '+saved);
    assert.ok(!/"bob":"done"/.test(saved),saved);
    const sizes=await ev("return [...document.querySelectorAll('#visit-toast button')].map(b=>__box(b).h)");
    assert.ok(sizes.length===3&&sizes.every(h=>h>=44),'touch targets '+sizes);
    assert.equal(await progress(),'0 von 3','a visit must not count as progress');
    await ev("document.querySelector('#visit-toast').scrollIntoView({block:'center'})");await sleep(350);await shot('3-return-prompt');});
  await test('"Noch offen" keeps the account visited',async()=>{
    await ev("document.querySelector('#visit-undo').click();await new Promise(r=>setTimeout(r,80));");
    const s=await state('bob');
    assert.equal(s.toast,false);assert.ok(s.cls.includes('fc-row-opened')&&!s.cls.includes('fc-row-done'),s.cls);});
  await test('Only the explicit confirmation turns the row green',async()=>{
    await ev("__row('bob').querySelector('.profile-link').click();await new Promise(r=>setTimeout(r,80));__leaveAndReturn();await new Promise(r=>setTimeout(r,120));");
    assert.equal((await state('bob')).toast,true);
    await ev("document.querySelector('#visit-confirm').click();await new Promise(r=>setTimeout(r,80));");
    const s=await state('bob');
    assert.ok(s.cls.includes('fc-row-done'),s.cls);assert.equal(s.toast,false);
    assert.match(s.text,/kein Entfolgen-Nachweis/);
    assert.match(await stored(),/"bob":"done"/);assert.equal(await progress(),'1 von 3');});
  await test('"Behalten" from the prompt keeps the account without a done state',async()=>{
    await ev("__row('carla').querySelector('.profile-link').click();await new Promise(r=>setTimeout(r,80));__leaveAndReturn();await new Promise(r=>setTimeout(r,120));document.querySelector('#visit-keep').click();await new Promise(r=>setTimeout(r,80));");
    const s=await state('carla');
    assert.ok(!s.cls.includes('fc-row-done')&&!s.cls.includes('fc-row-opened'),s.cls);assert.match(s.text,/Behalten/);});
  await test('Deciding in the list closes a pending prompt',async()=>{
    await ev("__row('_.dora').querySelector('.profile-link').click();await new Promise(r=>setTimeout(r,80));__leaveAndReturn();await new Promise(r=>setTimeout(r,120));");
    assert.equal((await state('_.dora')).toast,true);
    await ev("[...__row('_.dora').querySelectorAll('.mini-btn')].at(-1).click();await new Promise(r=>setTimeout(r,80));");
    const s=await state('_.dora');assert.equal(s.toast,false);assert.ok(s.cls.includes('fc-row-done'),s.cls);});
  await test('Progress counts only explicit decisions and survives reload + re-import',async()=>{
    const before=await progress();
    assert.equal(before,'3 von 3');
    await cdp('Page.reload');
    await until("document.readyState==='complete' && document.querySelector('#fc-why-live') && typeof JSZip!=='undefined'",'reload');
    await sleep(300);await ev(helpers);await feed();
    const s=await ev("return ['bob','carla','_.dora'].map(n=>{const r=__row(n);return n+':'+(r.className.includes('fc-row-done')?'done':r.querySelector('.profile-status').textContent.includes('Behalten')?'keep':'open')})");
    assert.deepEqual(s,['bob:done','carla:keep','_.dora:done']);
    assert.equal(await progress(),'3 von 3');
    assert.equal(await ev("return document.querySelector('#visit-toast').hidden"),true,'no prompt after reload');});
  await test('Undo from the list returns an account to open and lowers progress',async()=>{
    await ev("__row('bob').querySelector('.mini-btn.active-done').click();await new Promise(r=>setTimeout(r,80));");
    const cls=await ev("return __row('bob').className");
    assert.ok(!cls.includes('fc-row-done'),cls);assert.equal(await progress(),'2 von 3');});
  await test('Focus/blur alone (no real leave) never opens a prompt or changes state',async()=>{
    await ev("document.querySelector('#visit-toast').hidden=true;window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));await new Promise(r=>setTimeout(r,80));");
    assert.equal(await ev("return document.querySelector('#visit-toast').hidden"),true);});
  await test('Results view: no script errors, no horizontal overflow, no broken images',async()=>{
    await shot('4-results');
    assert.deepEqual(pageErrors,[]);
    const s=await ev("return {o:document.documentElement.scrollWidth<=window.innerWidth+1,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).length}");
    assert.deepEqual(s,{o:true,broken:0});});
  await test('Reduced motion disables the new animations',async()=>{
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const s=await ev(`const t=document.querySelector('#visit-toast');t.hidden=false;t.classList.add('is-in');
      const d=document.querySelector('#fc-why-live');d.open=true;
      const out=[getComputedStyle(t).animationName,getComputedStyle(d.querySelector('.fc-why-live-body')).animationName];t.hidden=true;return out`);
    assert.deepEqual(s,['none','none']);});
}finally{
  console.log(failed?failed+' FAILED':'FollowClean Chrome UX smoke: '+count+' checks passed');
  ws.close();chrome.kill('SIGKILL');server.close();await sleep(300);
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
