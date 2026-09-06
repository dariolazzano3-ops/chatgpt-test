import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { captureDomMeasurements, evaluateDomMeasurementIntegrity } from '../src/visual-foundry/dom-measurement.js';

const server=http.createServer((req,res)=>{
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html><head><style>
  body{margin:0;font-family:Arial}.shell{display:grid;grid-template-columns:240px 1fr;gap:20px;padding:24px}.sidebar{padding:16px;border-radius:12px;background:rgb(10,20,30)}.hero{height:180px;font-size:32px;line-height:40px}
  </style></head><body><main class="shell" data-visual-id="shell"><aside class="sidebar" data-visual-id="sidebar">Nav</aside><section class="hero" data-visual-id="hero">Hero</section></main></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'});
  const snap=await captureDomMeasurements(page,{component_ids:['shell','sidebar','hero']});
  const integrity=evaluateDomMeasurementIntegrity(snap);
  assert.equal(integrity.status,'PASS');
  const sidebar=snap.components.find(x=>x.component_id==='sidebar');
  assert.equal(sidebar.geometry.width,240);
  assert.equal(sidebar.padding.left,16);
  assert.equal(sidebar.appearance.border_radius,'12px');
  assert.equal(snap.stable_selector_contract,'data-visual-id');
  assert.equal(snap.fragile_nth_child_core_contract,false);

  const missing=await captureDomMeasurements(page,{component_ids:['does-not-exist']});
  assert.equal(evaluateDomMeasurementIntegrity(missing).status,'FAIL');

  await page.evaluate(()=>{document.querySelector('[data-visual-id="hero"]').insertAdjacentHTML('afterend','<div data-visual-id="hero">duplicate</div>')});
  const duplicate=await captureDomMeasurements(page,{component_ids:['hero']});
  assert.equal(evaluateDomMeasurementIntegrity(duplicate).status,'FAIL');

  const evidence={ok:true,suite:'visual-foundry-wave4-smoke',bounding_rect:'PASS',computed_styles:'PASS',stable_visual_ids:'PASS',missing_component_fail_closed:'PASS',duplicate_visual_id_fail_closed:'PASS',production_deploy:false,external_writes:false};
  await mkdir('artifacts/visual-foundry/wave4',{recursive:true});
  await writeFile('artifacts/visual-foundry/wave4/evidence.json',JSON.stringify({evidence,snapshot:snap},null,2));
  console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();server.close();}
