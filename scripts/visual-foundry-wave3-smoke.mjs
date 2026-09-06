import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { runPinnedRender } from '../src/visual-foundry/render-lab.js';

let counter=0;
const server=http.createServer((req,res)=>{
  counter+=1;
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html><head><style>@keyframes pulse{from{opacity:.2}to{opacity:1}}.pulse{animation:pulse 2s infinite}</style></head><body><main><h1 class="pulse">Pinned Render</h1><p data-visual-mask>${Date.now()}-${counter}</p></main></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const url=`http://127.0.0.1:${port}`;
await mkdir('artifacts/visual-foundry/wave3',{recursive:true});

try{
  const one=await runPinnedRender({
    url,output_path:'artifacts/visual-foundry/wave3/render-1.png',
    viewport:{width:800,height:600,device_pixel_ratio:1},
    locale:'en-US',timezone:'UTC',mask_selectors:['[data-visual-mask]'],full_page:false,commit_sha:'synthetic'
  });
  const two=await runPinnedRender({
    url,output_path:'artifacts/visual-foundry/wave3/render-2.png',
    viewport:{width:800,height:600,device_pixel_ratio:1},
    locale:'en-US',timezone:'UTC',mask_selectors:['[data-visual-mask]'],full_page:false,commit_sha:'synthetic'
  });
  assert.equal(one.browser,'chromium');
  assert.equal(one.playwright_package,'1.55.0');
  assert.equal(one.viewport.width,800);
  assert.equal(one.device_pixel_ratio,1);
  assert.equal(one.timezone,'UTC');
  assert.equal(one.reduced_motion,true);
  assert.equal(one.animation_policy,'DISABLED_AND_FROZEN');
  assert.equal(one.service_workers,'BLOCKED');
  assert.deepEqual(one.screenshot_dimensions,two.screenshot_dimensions);
  assert.equal(one.screenshot_pixel_hash,two.screenshot_pixel_hash,'masked deterministic renders must be pixel-identical');
  assert.deepEqual(one.page_errors,[]);
  const evidence={ok:true,suite:'visual-foundry-wave3-smoke',pinned_browser_environment:'PASS',animation_freeze:'PASS',dynamic_masking:'PASS',deterministic_repeat_render:'PASS',pixel_hash_basis:'DECODED_RGBA',browser_version:one.browser_version,font_manifest_entries:one.font_manifest.length,production_deploy:false,external_writes:false};
  await writeFile('artifacts/visual-foundry/wave3/evidence.json',JSON.stringify({evidence,render:one},null,2));
  console.log(JSON.stringify(evidence,null,2));
}finally{server.close();}
