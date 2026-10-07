import assert from 'node:assert/strict';
import {
  injectAurentaraWebProjectControlV2,
  applyAurentaraWebProjectControlV2,
  aurentaraWebProjectControlV2Manifest
} from '../src/operator-web-project-control-v2.js';

const source='<!doctype html><html><body><main>Operator</main></body></html>';
const injected=injectAurentaraWebProjectControlV2(source);
assert.match(injected,/aurentara-web-project-control-v2-style/);
assert.match(injected,/aurentara-web-project-control-v2-script/);
assert.match(injected,/Website-Projekt/);
assert.match(injected,/Auftrag vorbereiten/);
assert.match(injected,/Production bleibt gesperrt/);
assert.equal(injectAurentaraWebProjectControlV2(injected),injected,'injection must be idempotent');

const response=await applyAurentaraWebProjectControlV2(new Response(source,{status:200,headers:{'content-type':'text/html; charset=utf-8'}}));
assert.equal(response.status,200);
assert.equal(response.headers.get('x-aurentara-web-project-control'),'v2');
assert.match(await response.text(),/AURENTARA · WEB PROJECT CONTROL V2/);

const untouched=await applyAurentaraWebProjectControlV2(new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}}));
assert.equal(await untouched.text(),'{"ok":true}');

const manifest=aurentaraWebProjectControlV2Manifest();
assert.equal(manifest.existing_operator_runtime_reused,true);
assert.equal(manifest.existing_webfactory_control_plane_reused,true);
assert.equal(manifest.existing_preview_access_reused,true);
assert.equal(manifest.existing_approval_engine_reused,true);
assert.deepEqual(manifest.simple_flow,['AUFTRAG','MATERIAL','BUILD','PRUEFUNG','PREVIEW','FREIGABE']);
assert.equal(manifest.production_deploy,false);
assert.equal(manifest.public_launch,false);
assert.equal(manifest.dns_change,false);
assert.equal(manifest.billing_activation,false);
assert.equal(manifest.automatic_merge,false);
assert.equal(manifest.external_writes,false);

console.log(JSON.stringify({
  ok:true,
  suite:'aurentara-web-project-control-v2-smoke',
  simple_flow:manifest.simple_flow,
  existing_infrastructure_reused:true,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  automatic_merge:false,
  external_writes:false
},null,2));
