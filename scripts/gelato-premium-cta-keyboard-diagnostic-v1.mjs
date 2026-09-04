#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const PROJECT_DIR=path.join(ROOT,'projects/gelato-donatello-website-v1');
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  let rel=u.pathname==='/'?'index.html':u.pathname.replace(/^\/+/, '');
  if(rel.includes('..')) rel='404.html';
  let p=path.join(PROJECT_DIR,rel),status=200;
  try{const s=await stat(p);if(!s.isFile())throw new Error('not file');}
  catch{p=path.join(PROJECT_DIR,'404.html');status=404;}
  const body=await readFile(p);
  res.statusCode=status;
  res.setHeader('content-type',path.extname(p)==='.css'?'text/css; charset=utf-8':'text/html; charset=utf-8');
  res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const baseUrl=`http://127.0.0.1:${port}/`;
const browser=await chromium.launch({headless:true});
const evidence=[];

try{
  for(const viewport of [
    {id:'desktop',width:1440,height:1000},
    {id:'mobile',width:390,height:844}
  ]){
    for(let iteration=1;iteration<=8;iteration++){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
      const page=await context.newPage();
      await page.goto(baseUrl,{waitUntil:'load'});
      const primary=page.getByRole('link',{name:'Sorten ansehen'}).first();
      assert.equal(await primary.isVisible(),true);
      const href=await primary.getAttribute('href');
      assert.equal(href,'#sorten');
      await primary.focus();
      const focused=await page.evaluate(()=>({
        tag:document.activeElement?.tagName||null,
        href:document.activeElement?.getAttribute?.('href')||null,
        text:document.activeElement?.textContent?.trim()||null
      }));
      assert.equal(focused.tag,'A');
      assert.equal(focused.href,'#sorten');

      const before=new URL(page.url()).hash;
      await page.keyboard.press('Enter');
      const immediate=new URL(page.url()).hash;
      await page.waitForTimeout(0);
      const after0=new URL(page.url()).hash;
      await page.waitForTimeout(25);
      const after25=new URL(page.url()).hash;
      await page.waitForTimeout(100);
      const after100=new URL(page.url()).hash;
      const targetVisible=await page.locator('#sorten').isVisible();

      await page.goto(baseUrl,{waitUntil:'load'});
      const clickPrimary=page.getByRole('link',{name:'Sorten ansehen'}).first();
      await clickPrimary.click();
      await page.waitForTimeout(25);
      const clickHash=new URL(page.url()).hash;

      evidence.push({viewport:viewport.id,iteration,href,focused,before,immediate,after0,after25,after100,targetVisible,clickHash});
      assert.equal(after100,'#sorten',`${viewport.id} iteration ${iteration}: keyboard destination eventually resolves`);
      assert.equal(clickHash,'#sorten',`${viewport.id} iteration ${iteration}: pointer destination resolves`);
      await context.close();
    }
  }
}finally{
  await browser.close();
  await new Promise(r=>server.close(r));
}

const immediateFailures=evidence.filter(x=>x.immediate!=='#sorten');
const eventualFailures=evidence.filter(x=>x.after100!=='#sorten');
console.log(JSON.stringify({
  ok:eventualFailures.length===0,
  schema:'aurentara.gelato-premium-cta-keyboard-diagnostic.v1',
  sample_count:evidence.length,
  immediate_failure_count:immediateFailures.length,
  eventual_failure_count:eventualFailures.length,
  immediate_failures:immediateFailures,
  evidence
},null,2));
