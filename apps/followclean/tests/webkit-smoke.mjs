/**
 * FollowClean WebKit / Safari-engine smoke tests.
 * Run from the project checkout with an existing Playwright setup:
 *   npm install --no-save playwright
 *   npx playwright install webkit
 *   node apps/followclean/tests/webkit-smoke.mjs
 * Uses synthetic Instagram exports only. Does not use Instagram login or Stripe.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const htmlPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../index.html');
const html=await readFile(htmlPath,'utf8');
let playwright;
try { playwright=await import('playwright'); }
catch {throw new Error('Playwright fehlt. Siehe Installationsanleitung in diesem Dateikopf.');}
const server=http.createServer((req,res)=>{
 if(req.url?.split('?')[0]!=='/'){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{
  'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
 }).end(html);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
let browser;
try{
 browser=await playwright.webkit.launch({headless:true});
 const context=await browser.newContext({...playwright.devices['iPhone 13'],colorScheme:'dark'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 async function feed(followers,following){
  await page.evaluate(async({followers,following})=>{
   const make=n=>({string_list_data:[{value:n,href:'https://www.instagram.com/'+n+'/'}]});
   const zip=new JSZip();
   zip.file('followers_1.json',JSON.stringify(followers.map(make)));
   zip.file('following.json',JSON.stringify({relationships_following:following.map(title=>({title}))}));
   const file=new File([await zip.generateAsync({type:'blob'})],'test.zip',{type:'application/zip'});
   const dt=new DataTransfer();dt.items.add(file);
   const input=document.querySelector('#file-input');
   input.files=dt.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  },{followers,following});
  await page.locator('#results-view:not([hidden])').waitFor({timeout:25000});
 }
 const choose=async name=>{
  await page.locator('#fc-history-account').fill(name);
 };
 const key='followclean:progress:v2:example.test';
 await feed(['alice'],['alice','bob','carla']);
 await choose('example.test');
 await page.locator('#fc-insights-start').click();
 assert.equal(await page.locator('#guide-name').textContent(),'@bob');
 await page.locator('#guide-done').click();
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),key);
 assert.equal(stored.bob,'done');
 await page.locator('#reset-btn').click();
 await feed(['alice'],['alice','bob','carla','daria']);
 await choose('example.test');
 assert.equal(await page.locator('#fc-insights-done').textContent(),'1');
 assert.equal(await page.locator('#fc-insights-open').textContent(),'2');
 await choose('different.test');
 assert.equal(await page.locator('#fc-insights-done').textContent(),'0');
 assert.equal(await page.locator('#guide-panel').isHidden(),true);
 await choose('example.test');
 await page.locator('#fc-insights-start').click();
 assert.equal(await page.locator('#guide-name').textContent(),'@carla');
 // Opening a profile must NEVER equal user confirmation of unfollowing.
 await page.evaluate(()=>{
  document.addEventListener('click',event=>{
   if(event.target.closest('#guide-link'))event.preventDefault();
  },{capture:true,once:true});
  const a=document.querySelector('#guide-link');
  a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  window.dispatchEvent(new Event('pagehide'));
  window.dispatchEvent(new Event('pageshow'));
 });
 assert.equal(await page.locator('#fc-insights-done').textContent(),'1');
 assert.equal(await page.locator('#guide-name').textContent(),'@carla');
 assert.match(await page.locator('#guide-feedback').textContent(),/selbst/);
 const quality=await page.evaluate(()=>({
  noOverflow:document.documentElement.scrollWidth===document.documentElement.clientWidth,
  font:parseFloat(getComputedStyle(document.querySelector('#fc-history-account')).fontSize),
  touchTargets:[...document.querySelectorAll('.fc-smart-actions button,.fc-smart-actions a')].every(el=>el.getBoundingClientRect().height>=44),
  noPassword:!document.querySelector('input[type="password"]'),
  hasSandbox:!!document.querySelector('a[href^="https://buy.stripe.com/test_"]')
 }));
 assert.equal(quality.noOverflow,true);
 assert.ok(quality.font>=16);
 assert.equal(quality.touchTargets,true);
 assert.equal(quality.noPassword,true);
 assert.equal(quality.hasSandbox,true);
 assert.deepEqual(errors,[]);
 console.log('PASS FollowClean WebKit synthetic iPhone tests: isolated progress, ZIP reimport, return logic, UI, dark-mode context.');
 await context.close();
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
