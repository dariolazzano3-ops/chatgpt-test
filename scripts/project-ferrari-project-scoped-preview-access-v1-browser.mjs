import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { handleOperatorDashboard } from '../src/operator-project-preview-access-v1.js';

const HEAD='723b4cedb65ebd70f2180b9f03e8bb9e66c79a84';
const scope='gelato-donatello:gelato-donatello-website-v1';
const shell=await handleOperatorDashboard(
  new Request('https://operator.example.test/operator'),
  {RIOSYSTEMS_ENVIRONMENT:'staging',RIOSYSTEMS_PRODUCTION_DEPLOY:'false',RIOSYSTEMS_EXTERNAL_WRITES:'false',CF_VERSION_METADATA:{id:'browser',tag:HEAD,timestamp:'2026-09-05T15:30:00.000Z'}},
  {},
  {authorize:async()=>({ok:true,status:200,operator_id:'operator:preview-browser@example.test',email:'preview-browser@example.test'})}
);
assert.equal(shell.status,200);
const fullHtml=await shell.text();

function extractTag(id,tag){
  const pattern=new RegExp('<'+tag+'[^>]*id="'+id+'"[^>]*>[\\s\\S]*?<\\/'+tag+'>');
  const match=fullHtml.match(pattern);
  assert.ok(match,'missing '+tag+'#'+id);
  return match[0];
}
const style=extractTag('aurentara-project-preview-access-v1-style','style');
const script=extractTag('aurentara-project-preview-access-v1-ui','script');

function pageHtml(access){
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--line:#ddd;--soft:#eee;--muted:#666}.card{padding:16px;border:1px solid #ddd;border-radius:14px}.btn{display:inline-flex;padding:9px 13px;border:1px solid #ddd;border-radius:10px;text-decoration:none}.primary{background:#222;color:#fff}.badge{display:inline-flex;padding:4px 8px;border-radius:999px}.ready{background:#eaf8ee}.attention{background:#fff4d9}.callout{padding:12px;border:1px solid #ddd;border-radius:12px}.warn{background:#fff4d9}.actions{display:flex;gap:8px}.mono{font-family:monospace}.small{font-size:12px;color:#666}.eyebrow{font-size:11px}.human-input-controls{margin-top:10px}</style>
${style}</head><body><main id="project-detail"></main>
<script>window.renderProjectDetail=function(d){document.getElementById('project-detail').innerHTML='<div class="card"><h2>'+String(d.project.name||'')+'</h2></div><div class="human-input-question" data-human-question="FINAL_HUMAN_QUALITY_APPROVAL"><h3>Final Human Quality Approval</h3><div class="human-input-controls"><label><input type="radio" name="final" value="yes"> Ja</label><label><input type="radio" name="final" value="no"> Nein</label><label><input type="checkbox" data-human-preview="final"> Ich habe die tatsächliche Vorschau gesehen.</label></div></div>';};</script>
${script}
<script>window.renderProjectDetail({project:{project_id:'gelato-donatello-website-v1',scope_key:${JSON.stringify(scope)},name:'Gelato Donatello'},project_preview_access:${JSON.stringify(access)}});</script>
</body></html>`;
}

const available={
  schema:'aurentara.project-preview-access.v1',
  project_id:'gelato-donatello-website-v1',
  scope_key:scope,
  status:'AVAILABLE',
  available:true,
  provider:'CANONICAL_REPOSITORY_ARTIFACT',
  operator_route:'/operator/project-preview/'+encodeURIComponent(scope),
  source_revision:HEAD
};
const missing={...available,status:'NOT_AVAILABLE',available:false,provider:null,operator_route:null,source_revision:null,reason:'NO_PROJECT_PREVIEW_REGISTERED'};

async function run(name,viewport,access,expectedAvailable){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport});
  await context.route('https://preview-access.test/operator',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:pageHtml(access)}));
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('https://preview-access.test/operator',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-project-preview-access]');
  const card=page.locator('[data-project-preview-access]');
  assert.equal(await card.isVisible(),true,name);
  assert.match(await card.innerText(),/Vorschau/);
  const final=page.locator('[data-human-question="FINAL_HUMAN_QUALITY_APPROVAL"]');
  await page.waitForSelector('[data-project-preview-final-action]');
  if(expectedAvailable){
    assert.equal(await card.getByRole('link',{name:/Vorschau öffnen/}).isVisible(),true);
    assert.equal(await final.getByRole('link',{name:/Tatsächliche Vorschau öffnen/}).isVisible(),true);
    assert.equal(await final.locator('input[type=radio][value=yes]').isEnabled(),true);
    assert.equal(await final.locator('input[data-human-preview]').isEnabled(),true);
    if(viewport.width<=760){
      const box=await final.getByRole('link',{name:/Tatsächliche Vorschau öffnen/}).boundingBox();
      assert.ok(box&&box.height>=45,name+' mobile preview target');
    }
  }else{
    assert.match(await card.innerText(),/Preview noch nicht verfügbar/);
    assert.equal(await final.locator('input[type=radio][value=yes]').isDisabled(),true);
    assert.equal(await final.locator('input[data-human-preview]').isDisabled(),true);
  }
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(width.scroll<=width.inner+1,name+' horizontal overflow');
  assert.deepEqual(errors,[]);
  await browser.close();
  return {name,status:expectedAvailable?'AVAILABLE':'NOT_AVAILABLE',horizontal_overflow:'PASS'};
}

const desktop=await run('desktop',{width:1440,height:1000},available,true);
const mobile=await run('iphone',{width:390,height:844},available,true);
const missingState=await run('missing-preview',{width:390,height:844},missing,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-project-scoped-preview-access-v1-browser',
  desktop,
  mobile,
  missing_state:missingState,
  project_detail_preview_action:'PASS',
  final_human_question_preview_action:'PASS',
  missing_preview_positive_approval_disabled:'PASS',
  production_deploy:false,
  public_launch:false,
  variable_cost_eur:0
},null,2));
