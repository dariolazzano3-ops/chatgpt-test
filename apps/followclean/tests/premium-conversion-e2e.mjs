// FollowClean V19 premium conversion: Worker API + real Chromium end-to-end, synthetic only.
// Usage: node apps/followclean/tests/premium-conversion-e2e.mjs   (Node >= 22.5, Chrome/Chromium)
// No Stripe network call (webhooks are signed locally with a fake TEST secret), no Apify, no Instagram.
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {readFile,mkdtemp} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const dir=fileURLToPath(new URL('..',import.meta.url));
execFileSync(process.execPath,[dir+'build-instagram-worker.mjs'],{stdio:'ignore'});
const realFetch=globalThis.fetch;let outbound=0;
globalThis.fetch=async()=>{outbound++;throw Error('network forbidden in test');};
const worker=(await import(pathToFileURL(dir+'dist/worker.mjs').href+'?t='+Date.now())).default;
const sql=await readFile(dir+'sql/fc_premium_v1.sql','utf8');
function d1(){const raw=new DatabaseSync(':memory:');raw.exec(sql);
  const stmt=(q,a=[])=>({bind:(...b)=>stmt(q,b),
    run:async()=>({meta:{changes:Number(raw.prepare(q).run(...a).changes)}}),
    first:async()=>raw.prepare(q).get(...a)??null});
  return {prepare:q=>stmt(q),raw};}
const WH='whsec_'+'T'.repeat(24);
const mkEnv=(over={})=>({FC_APIFY_BUDGET_DB:d1(),FC_IG_SESSION_SECRET:'s'.repeat(40),FC_STRIPE_WEBHOOK_SECRET:WH,...over});
let failed=0,count=0;
async function test(label,fn){count++;try{await fn();console.log('PASS',label);}catch(e){failed++;console.error('FAIL',label,e.message);process.exitCode=1;}}
const O='https://fc.test';
const call=(env,path,{method='GET',body,headers={},ip='203.0.113.7'}={})=>worker.fetch(new Request(O+path,{method,body,
  headers:{'CF-Connecting-IP':ip,...(method!=='GET'?{'Origin':O,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'}:{}),...headers}}),env);
const ref='fc_'+'a'.repeat(32);
const event=({id='1',...o}={},{id:sid='1',...s}={})=>JSON.stringify({object:'event',livemode:false,type:'checkout.session.completed',...o,id:'evt_'+id,
  data:{object:{object:'checkout.session',livemode:false,payment_status:'paid',client_reference_id:ref,amount_total:0,currency:'eur',payment_link:'plink_x',...s,id:sid.startsWith('live')?sid:'cs_test_'+sid}}});
const sign=(body,t=Math.floor(Date.now()/1000),secret=WH)=>'t='+t+',v1='+crypto.createHmac('sha256',secret).update(t+'.'+body).digest('hex');
const hook=(env,body,sig=sign(body))=>call(env,'/api/premium/webhook',{method:'POST',body,headers:{'Stripe-Signature':sig,'Origin':'https://stripe.example'}});

await test('Free scan is honest: NO_RELIABLE_LIVE_RESULT, 0 checked, 0 cost, never live',async()=>{
  const r=await call(mkEnv(),'/api/scan/free',{method:'POST',body:JSON.stringify({username:'@YsrRioo'})});
  const j=await r.json();assert.equal(r.status,200);
  assert.deepEqual([j.username,j.status,j.live,j.checked,j.hit,j.costUsd,j.executionEnabled,j.reason,j.rateLimit],
    ['ysrrioo','NO_RELIABLE_LIVE_RESULT',false,0,null,0,false,'provider_not_verified','ok']);});
await test('Free scan rejects bad names, foreign origins, GET and oversized bodies',async()=>{
  const env=mkEnv();
  assert.equal((await call(env,'/api/scan/free',{method:'POST',body:'{"username":"bad name!"}'})).status,400);
  assert.equal((await call(env,'/api/scan/free',{method:'POST',body:'{"username":"ok"}',headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await call(env,'/api/scan/free')).status,405);
  assert.equal((await call(env,'/api/scan/free',{method:'POST',body:'{"username":"'+'x'.repeat(600)+'"}'})).status,413);});
await test('Rate limits: 5 per name/hour and 10 per IP/hour, IP stored only as salted hash',async()=>{
  const env=mkEnv();const s=[];
  for(let i=0;i<6;i++)s.push((await call(env,'/api/scan/free',{method:'POST',body:'{"username":"same"}',ip:'198.51.100.'+i})).status);
  assert.deepEqual(s,[200,200,200,200,200,429]);
  const t=[];for(let i=0;i<11;i++)t.push((await call(env,'/api/scan/free',{method:'POST',body:JSON.stringify({username:'n'+i})})).status);
  assert.deepEqual(t.slice(9),[200,429]);
  const buckets=env.FC_APIFY_BUDGET_DB.raw.prepare('SELECT bucket FROM fc_rate_limit_v1').all().map(r=>r.bucket).join(' ');
  assert.ok(!buckets.includes('203.0.113')&&!buckets.includes('198.51.100'),'raw IP must not be stored');});
await test('Without D1 the scan still answers honestly and reports rate limit unavailable',async()=>{
  const j=await (await call(mkEnv({FC_APIFY_BUDGET_DB:undefined}),'/api/scan/free',{method:'POST',body:'{"username":"abc"}'})).json();
  assert.deepEqual([j.status,j.rateLimit,j.costUsd],['NO_RELIABLE_LIVE_RESULT','unavailable',0]);});
await test('Webhook signature: missing, malformed, wrong secret, stale and future timestamps are rejected',async()=>{
  const env=mkEnv(),b=event();
  assert.equal((await hook(env,b,'')).status,400);
  assert.equal((await hook(env,b,'t=abc,v1=zz')).status,400);
  assert.equal((await hook(env,b,sign(b,undefined,'whsec_'+'X'.repeat(24)))).status,400);
  assert.equal((await hook(env,b,sign(b,Math.floor(Date.now()/1000)-301))).status,400);
  assert.equal((await hook(env,b,sign(b,Math.floor(Date.now()/1000)+301))).status,400);
  assert.equal((await hook(env,b+' ',sign(b))).status,400,'body tampering');
  assert.equal((await hook(mkEnv({FC_STRIPE_WEBHOOK_SECRET:undefined}),b)).status,503,'unconfigured');
  assert.equal(env.FC_APIFY_BUDGET_DB.raw.prepare('SELECT COUNT(*) n FROM fc_premium_orders_v1').get().n,0);});
await test('Webhook records a paid TEST session once (idempotent across replays and duplicate events)',async()=>{
  const env=mkEnv(),b=event();
  assert.deepEqual(await (await hook(env,b)).json(),{received:true,recorded:true});
  assert.deepEqual(await (await hook(env,b)).json(),{received:true,recorded:false});
  const dup=event({id:'2',type:'checkout.session.async_payment_succeeded'});
  assert.deepEqual(await (await hook(env,dup)).json(),{received:true,recorded:false});
  assert.equal(env.FC_APIFY_BUDGET_DB.raw.prepare('SELECT COUNT(*) n FROM fc_premium_orders_v1').get().n,1);});
await test('Webhook never unlocks live mode, unpaid, foreign links, missing claim or other events',async()=>{
  const env=mkEnv({FC_STRIPE_PAYMENT_LINK_ID:'plink_x'});
  assert.equal((await hook(env,event({livemode:true}))).status,400);
  assert.equal((await hook(env,event({},{livemode:true}))).status,400);
  assert.equal((await hook(env,event({},{id:'live_1'}))).status,400,'non cs_test_ session');
  assert.equal((await (await hook(env,event({id:'3'},{id:'3',payment_status:'unpaid'}))).json()).ignored,'not_paid');
  assert.equal((await (await hook(env,event({id:'4'},{id:'4',payment_link:'plink_other'}))).json()).ignored,'foreign_payment_link');
  assert.equal((await (await hook(env,event({id:'5'},{id:'5',client_reference_id:'x'}))).json()).ignored,'no_claim_reference');
  assert.equal((await (await hook(env,event({id:'6',type:'charge.refunded'}))).json()).ignored,'event_type');
  assert.equal(env.FC_APIFY_BUDGET_DB.raw.prepare('SELECT COUNT(*) n FROM fc_premium_orders_v1').get().n,0);});
await test('Status issues a signed token only after a recorded order; verify re-checks the order',async()=>{
  const env=mkEnv();
  assert.equal((await call(env,'/api/premium/status?ref=nope')).status,400);
  assert.deepEqual(await (await call(env,'/api/premium/status?ref='+ref)).json(),{premium:false,pending:true});
  await hook(env,event());
  const j=await (await call(env,'/api/premium/status?ref='+ref)).json();
  assert.equal(j.premium,true);assert.match(j.token,/^fcp1\.fc_a{32}\.\d{10}\.[a-f0-9]{64}$/);
  const v=t=>call(env,'/api/premium/verify',{method:'POST',body:JSON.stringify({token:t})});
  assert.deepEqual(await (await v(j.token)).json(),{premium:true});
  assert.equal((await v(j.token.slice(0,-1)+(j.token.endsWith('0')?'1':'0'))).status,401,'tampered');
  assert.equal((await v('fcp1.'+ref+'.1000000000.'+'0'.repeat(64))).status,401,'expired/forged');
  assert.equal((await call(env,'/api/premium/verify',{method:'POST',body:JSON.stringify({token:j.token}),headers:{Origin:'https://evil.test'}})).status,403);
  const other=mkEnv();
  assert.equal((await call(other,'/api/premium/verify',{method:'POST',body:JSON.stringify({token:j.token})})).status,401,'token without order');});
await test('Unconfigured store fails closed (503), never unlocks',async()=>{
  const env=mkEnv({FC_APIFY_BUDGET_DB:undefined});
  assert.equal((await call(env,'/api/premium/status?ref='+ref)).status,503);
  const cfg=await (await call(env,'/api/premium/config')).json();
  assert.equal(cfg.unlockConfigured,false);assert.match(cfg.checkout,/^https:\/\/buy\.stripe\.com\/test_/);});
await test('Order table is append-only and rejects live mode rows',async()=>{
  const raw=d1().raw;
  raw.prepare("INSERT INTO fc_premium_orders_v1 VALUES('cs_test_9','evt_9',?,0,'eur',0,1)").run(ref);
  assert.throws(()=>raw.prepare("UPDATE fc_premium_orders_v1 SET claim_ref=?").run('fc_'+'b'.repeat(32)),/append-only/);
  assert.throws(()=>raw.prepare("INSERT INTO fc_premium_orders_v1 VALUES('cs_test_8','evt_8',?,0,'eur',1,1)").run(ref));
  assert.throws(()=>raw.prepare("INSERT INTO fc_premium_orders_v1 VALUES('cs_live_8','evt_7',?,0,'eur',0,1)").run(ref));});
await test('Paid provider path is still closed and no outbound request happened',async()=>{
  const r=await call(mkEnv(),'/api/analysis/start',{method:'POST',body:'{"username":"abc"}'});
  assert.equal(r.status,503);assert.equal(outbound,0);});

// ---- Real browser end to end (Chromium 390x844; NOT Safari/WebKit) ----
globalThis.fetch=realFetch;
const bin=['google-chrome','chromium','chromium-browser'].find(b=>{try{execFileSync('which',[b]);return true}catch{return false}});
if(!bin){console.error('SKIP browser part: no Chrome');}
else{
  const env=mkEnv();
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const host='http://'+req.headers.host;
    const r=await worker.fetch(new Request(host+req.url,{method:req.method,headers:{...req.headers,'CF-Connecting-IP':'127.0.0.1'},
      body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),env);
    res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port+'/';
  const profile=await mkdtemp(join(tmpdir(),'fc-e2e-'));
  const chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','about:blank']);
  const wsUrl=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(Error('no chrome')),20000);
    chrome.stderr.on('data',d=>{buf+=d;const m=buf.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);res(m[1]);}});});
  const ws=new WebSocket(wsUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let seq=0;const waiting=new Map(),pageErrors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {res,rej}=waiting.get(m.id);waiting.delete(m.id);m.error?rej(Error(m.error.message)):res(m.result);}
    if(m.method==='Runtime.exceptionThrown')pageErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const send=(method,params={},sessionId)=>new Promise((res,rej)=>{const id=++seq;waiting.set(id,{res,rej});ws.send(JSON.stringify({id,method,params,sessionId}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cdp=(m,p)=>send(m,p,sessionId);
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
  const ev=async x=>{const r=await cdp('Runtime.evaluate',{expression:'(async()=>{'+x+'})()',awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const shot=async(n,full)=>{if(!process.env.FC_SHOTS)return;const {data}=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:!!full});
    (await import('node:fs')).writeFileSync(join(process.env.FC_SHOTS,n+'.png'),Buffer.from(data,'base64'));};
  const until=async(x,l,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await ev('return !!('+x+')'))return;await sleep(100);}throw Error('Timeout: '+l);};
  const vis=sel=>`(()=>{const e=document.querySelector('${sel}');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'})()`;
  try{
    await cdp('Page.navigate',{url});
    await until("document.readyState==='complete'&&document.body.classList.contains('fc-free')",'load');
    await ev("window.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[target=\"_blank\"]');if(a){e.preventDefault();window.__opened=a.href;}},true);");
    await test('Free start: username field + "Jetzt analysieren", no ZIP upload, no export guide, no old preview',async()=>{
      assert.equal(await ev("return document.querySelector('#fc-analyze-submit').textContent.trim().startsWith('Jetzt analysieren')"),true);
      for(const sel of ['#dropzone','#export-guide','#file-input','#fc-smartscan-v1','#testkauf','#premium-preview'])
        assert.equal(await ev('return '+vis(sel)),false,sel+' must be hidden before purchase');
      assert.equal(await ev("return !!document.querySelector('#fc-username-first')"),false);
      assert.equal(await ev('return '+vis('#fc-analyze-input')),true);
      assert.ok(await ev('return document.documentElement.scrollWidth<=window.innerWidth+1'),'overflow');await shot('v19-1-start');});
    await test('Invalid name shows inline error and starts no analysis',async()=>{
      await ev("document.querySelector('#fc-analyze-input').value='bad name!';document.querySelector('#fc-analyze-submit').click();");
      assert.equal(await ev("return document.querySelector('#fc-analyze-error').hidden"),false);
      assert.equal(await ev("return document.querySelector('#fc-analysis').hidden"),true);});
    await test('Analysis view animates steps and ends with "Kein verlässlicher Live-Treffer möglich" (no fake hit)',async()=>{
      await ev("document.querySelector('#fc-analyze-input').value='@YsrRioo';document.querySelector('#fc-analyze-submit').click();");
      await until("!document.querySelector('#fc-analysis').hidden",'analysis open',3000);
      await until("document.querySelector('#fc-analysis').classList.contains('fc-an-done')",'analysis done');
      const s=await ev(`return {none:!document.querySelector('#fc-an-none').hidden,hit:!document.querySelector('#fc-an-hit').hidden,
        text:document.querySelector('#fc-an-none strong').textContent,checked:document.querySelector('#fc-an-checked').textContent,
        name:document.querySelector('#fc-an-name').textContent,steps:[...document.querySelectorAll('#fc-an-steps li')].map(l=>l.dataset.state)}`);
      assert.deepEqual(s,{none:true,hit:false,text:'Kein verlässlicher Live-Treffer möglich',checked:'0',name:'@ysrrioo',steps:['ok','warn','skip','skip']});
      await ev("document.querySelector('#fc-analysis').scrollIntoView()");await sleep(700);await shot('v19-2-analysis');
      await ev("document.querySelector('#fc-an-offer').scrollIntoView()");await sleep(300);await shot('v19-3-offer');});
    await test('Premium offer explains the JSON/ZIP export before purchase; no countdown, no invented numbers',async()=>{
      const s=await ev(`const o=document.querySelector('#fc-an-offer');return {shown:!o.hidden,text:o.textContent,href:document.querySelector('#fc-an-cta').href}`);
      assert.equal(s.shown,true);assert.match(s.text,/Instagram-Datenexport im JSON-\/ZIP-Format/);
      assert.doesNotMatch(s.text,/Countdown|nur noch \d|\d+ Nicht-Rückfolger gefunden/i);
      assert.match(s.href,/^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9]+\?client_reference_id=fc_[a-f0-9]{32}$/);});
    await test('Checkout click shows pending state; nothing unlocks without a verified webhook',async()=>{
      await ev("document.querySelector('#fc-an-cta').click()");
      assert.equal(await ev("return !document.querySelector('#fc-an-pending').hidden"),true);
      await ev("document.querySelector('#fc-an-recheck').click()");await sleep(400);
      assert.equal(await ev("return document.body.classList.contains('fc-premium')"),false);
      assert.match(await ev("return document.querySelector('#fc-an-pending-text').textContent"),/Noch keine bestätigte Testzahlung/);
      await ev("localStorage.setItem('followclean:premium:v1','fcp1.fc_'+'a'.repeat(32)+'.9999999999.'+'0'.repeat(64))");
      await cdp('Page.reload');
      await until("document.readyState==='complete'&&document.body.classList.contains('fc-free')&&localStorage.getItem('followclean:premium:v1')===null",'forged token rejected and removed');
      assert.equal(await ev('return '+vis('#dropzone')),false,'forged token must not unlock');
      await ev("window.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[target=\"_blank\"]');if(a){e.preventDefault();}},true);");});
    await test('Signed TEST webhook for this claim unlocks Premium; export guide + ZIP upload appear',async()=>{
      const claim=await ev("return localStorage.getItem('followclean:premium-claim:v1')");
      const body=JSON.parse(event());body.data.object.client_reference_id=claim;const b=JSON.stringify(body);
      const r=await realFetch(url+'api/premium/webhook',{method:'POST',body:b,headers:{'Stripe-Signature':sign(b),'Content-Type':'application/json'}});
      assert.equal(r.status,200);
      await ev("document.querySelector('#fc-an-recheck').click()");
      await until("document.body.classList.contains('fc-premium')",'premium unlocked',8000);
      for(const sel of ['#fc-premium-welcome','#export-guide','#dropzone'])assert.equal(await ev('return '+vis(sel)),true,sel);
      assert.equal(await ev('return '+vis('#testkauf')),false);await sleep(600);await shot('v19-4-premium');});
    await test('Premium survives reload via server-verified token',async()=>{
      await cdp('Page.reload');
      await until("document.readyState==='complete'&&document.body.classList.contains('fc-premium')",'premium after reload');});
    await test('No script errors and no horizontal overflow at 390px',async()=>{
      assert.deepEqual(pageErrors,[]);assert.ok(await ev('return document.documentElement.scrollWidth<=window.innerWidth+1'));});
  }finally{ws.close();chrome.kill();server.close();}
}
console.log('FollowClean premium conversion e2e:',count-failed,'of',count,'passed');
if(failed)process.exit(1);
