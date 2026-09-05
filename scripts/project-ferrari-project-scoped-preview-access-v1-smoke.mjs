import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard, operatorProjectPreviewAccessManifest } from '../src/operator-project-preview-access-v1.js';
import {
  resolveProjectPreviewAccess,
  canonicalPreviewRawUrl,
  canonicalPreviewArtifactForScope
} from '../src/project-preview-access-v1.js';

const HEAD='723b4cedb65ebd70f2180b9f03e8bb9e66c79a84';
const operatorId='operator:preview-access@example.test';
const gelato={
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:'gelato-donatello:gelato-donatello-website-v1',
  name:'Gelato Donatello',
  industry:'gelateria',
  country:'DE',
  language:'de',
  state:'ACTIVE',
  blocked:false,
  production_deploy:false
};
const other={
  customer_id:'other-customer',
  project_id:'other-project-v1',
  scope_key:'other-customer:other-project-v1',
  name:'Other Project',
  industry:'services',
  country:'DE',
  language:'de',
  state:'READY',
  blocked:false,
  production_deploy:false
};

const artifact=canonicalPreviewArtifactForScope(gelato.scope_key);
assert.ok(artifact);
assert.equal(artifact.source_path,'projects/gelato-donatello-website-v1/ferrari-preview-v1.html');

const resolved=resolveProjectPreviewAccess({project:gelato},{deployed_sha:HEAD});
assert.equal(resolved.available,true);
assert.equal(resolved.status,'AVAILABLE');
assert.equal(resolved.access_kind,'CANONICAL_ARTIFACT_PROXY');
assert.equal(resolved.source_revision,HEAD);
assert.equal(resolved.operator_route,'/operator/project-preview/'+encodeURIComponent(gelato.scope_key));
assert.match(canonicalPreviewRawUrl(resolved),new RegExp(HEAD));

const external=resolveProjectPreviewAccess({
  project:{...other,preview_url:'https://example.pages.dev/review/123'}
},{deployed_sha:HEAD});
assert.equal(external.available,true);
assert.equal(external.access_kind,'EXISTING_PRIVATE_PREVIEW_URL');
assert.equal(external.preview_url,'https://example.pages.dev/review/123');

const unsafe=resolveProjectPreviewAccess({
  project:{...other,preview_url:'http://unsafe.example.test'}
},{deployed_sha:HEAD});
assert.equal(unsafe.available,false);

const missing=resolveProjectPreviewAccess({project:other},{deployed_sha:HEAD});
assert.equal(missing.available,false);
assert.equal(missing.status,'NOT_AVAILABLE');
assert.equal(missing.reason,'NO_PROJECT_PREVIEW_REGISTERED');

const created=createOperatorRuntime({
  operator_id:operatorId,
  portfolio:{operator_id:operatorId,projects:[gelato,other],production_deploy:false}
});
assert.equal(created.ok,true);
created.runtime.selected_project_scope=gelato.scope_key;
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const core=createOperatorRuntimeApiService({operator_id:operatorId,store});
const service=withProjectSourceIntakeRuntimeService({service:core,store,operator_id:operatorId});
const authorize=async()=>({ok:true,status:200,operator_id:operatorId,email:'preview-access@example.test'});
const env={
  RIOSYSTEMS_ENVIRONMENT:'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY:'false',
  RIOSYSTEMS_EXTERNAL_WRITES:'false',
  CF_VERSION_METADATA:{id:'preview-access-test-version',tag:HEAD,timestamp:'2026-09-05T15:30:00.000Z'}
};
const previewHtml='<!doctype html><html lang="de"><head><title>Gelato Preview Test</title></head><body><h1>Gelato Donatello</h1><p>Private Vorschau</p></body></html>';
const options={
  runtime_service:service,
  authorize,
  project_preview_fetch:async(url)=>{
    assert.match(String(url),new RegExp('raw\\.githubusercontent\\.com/.+/'+HEAD+'/projects/gelato-donatello-website-v1/ferrari-preview-v1.html'));
    return new Response(previewHtml,{status:200,headers:{'content-type':'text/html'}});
  }
};

async function call(path,init={}){
  const response=await handleOperatorDashboard(new Request('https://operator.example.test'+path,init),env,{},options);
  assert.ok(response,'response required for '+path);
  return response;
}

let response=await call('/operator/api/project-detail/'+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
let body=await response.json();
assert.equal(body.project.scope_key,gelato.scope_key);
assert.equal(body.project_preview_access.available,true);
assert.equal(body.project_preview_access.access_kind,'CANONICAL_ARTIFACT_PROXY');
assert.equal(body.project_preview_access.source_revision,HEAD);

response=await call('/operator/api/project-detail/'+encodeURIComponent(other.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.project_preview_access.available,false);
assert.equal(body.project_preview_access.status,'NOT_AVAILABLE');

response=await call('/operator/api/project-preview-access?scope_key='+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.preview_access.available,true);
assert.equal(body.preview_access.scope_key,gelato.scope_key);

response=await call('/operator/project-preview/'+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
assert.match(response.headers.get('content-type')||'',/text\/html/);
assert.match(response.headers.get('cache-control')||'',/no-store/);
assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
assert.equal(response.headers.get('x-aurentara-project-preview-scope'),gelato.scope_key);
assert.equal(response.headers.get('x-aurentara-project-preview-revision'),HEAD);
assert.match(response.headers.get('content-security-policy')||'',/script-src 'none'/);
assert.match(await response.text(),/Gelato Donatello/);

response=await call('/operator/project-preview/'+encodeURIComponent(other.scope_key));
assert.equal(response.status,404);
body=await response.json();
assert.equal(body.error,'PROJECT_PREVIEW_NOT_AVAILABLE');

response=await call('/operator/api/project-source-intake/human-decision',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({
    scope_key:other.scope_key,
    context_scope_key:other.scope_key,
    question_id:'FINAL_HUMAN_QUALITY_APPROVAL',
    controls:{human_quality:{approved:true,preview_seen:true}}
  })
});
assert.equal(response.status,409);
body=await response.json();
assert.equal(body.error,'HUMAN_QUALITY_APPROVAL_PREVIEW_NOT_AVAILABLE');

response=await call('/operator');
assert.equal(response.status,200);
const html=await response.text();
assert.match(html,/aurentara-project-preview-access-v1-ui/);
assert.match(html,/Vorschau öffnen ↗/);
assert.match(html,/Tatsächliche Vorschau öffnen ↗/);

const manifest=operatorProjectPreviewAccessManifest();
assert.equal(manifest.every_project_detail_gets_preview_projection,true);
assert.equal(manifest.existing_human_input_closure_reused,true);
assert.equal(manifest.no_new_preview_engine,true);
assert.equal(manifest.no_new_provider,true);
assert.equal(manifest.final_human_approval_requires_preview_available,true);
assert.equal(manifest.production_deploy,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-project-scoped-preview-access-v1',
  gelato_preview:'AVAILABLE_CANONICAL_ARTIFACT',
  exact_head_bound:true,
  every_project_preview_projection:'PASS',
  missing_preview_fail_closed:'PASS',
  final_human_approval_preview_availability_gate:'PASS',
  operator_private_preview_proxy:'PASS',
  no_new_preview_engine:true,
  no_new_provider:true,
  production_deploy:false,
  public_launch:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
