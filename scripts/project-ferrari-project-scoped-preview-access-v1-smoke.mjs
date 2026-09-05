import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard, operatorProjectPreviewAccessManifest } from '../src/operator-project-preview-access-v1.js';
import {
  resolveProjectPreviewAccess,
  canonicalPreviewRawUrl,
  projectPreviewDirectoryCandidates,
  runtimeProjectPreviewArtifact
} from '../src/project-preview-access-v1.js';

const HEAD='7ff78b4b2a302c814d775664c9543954fa3c8309';
const operatorId='operator:preview-system@example.test';
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
const legacyScopedGelato={
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello',
  scope_key:'gelato-donatello:gelato-donatello-website-v1',
  name:'Gelato Donatello Legacy Runtime Identity',
  industry:'gelateria',
  country:'DE',
  language:'de',
  state:'ACTIVE',
  blocked:false,
  production_deploy:false
};
const cafe={
  customer_id:'cafe-luna',
  project_id:'cafe-luna-website-v1',
  scope_key:'cafe-luna:cafe-luna-website-v1',
  name:'Café Luna',
  industry:'cafe',
  country:'DE',
  language:'de',
  state:'ACTIVE',
  blocked:false,
  production_deploy:false
};
const noPreview={
  customer_id:'internal-ops',
  project_id:'internal-crm-v1',
  scope_key:'internal-ops:internal-crm-v1',
  name:'Internal CRM',
  industry:'services',
  country:'DE',
  language:'de',
  state:'READY',
  blocked:false,
  production_deploy:false
};

assert.deepEqual(projectPreviewDirectoryCandidates({project:gelato}),['projects/gelato-donatello-website-v1']);
assert.deepEqual(projectPreviewDirectoryCandidates({project:legacyScopedGelato}),[
  'projects/gelato-donatello-website-v1',
  'projects/gelato-donatello'
]);
assert.deepEqual(projectPreviewDirectoryCandidates({project:cafe}),['projects/cafe-luna-website-v1']);

const entrySource=await readFile(new URL('../src/entry.js',import.meta.url),'utf8');
assert.match(entrySource,/startsWith\("\/operator\/project-preview\/"\)/);

const external=resolveProjectPreviewAccess({
  project:{...cafe,preview_url:'https://example.pages.dev/review/123'}
},{deployed_sha:HEAD});
assert.equal(external.available,true);
assert.equal(external.access_kind,'EXISTING_PRIVATE_PREVIEW_URL');

const arbitraryRuntime={
  live_staging_runs:[{
    scope_key:cafe.scope_key,
    status:'LIVE_STAGING_VERIFIED',
    execution_id:'exec:cafe:1',
    updated_at:'2026-09-05T16:20:00.000Z',
    evidence:{
      qa:{passed:true},
      delivery:{
        factory_result:{
          artifact:{
            project_root:'projects/cafe-luna-website-v1',
            files:{
              'projects/cafe-luna-website-v1/index.html':'<!doctype html><html><body><h1>Café Luna Runtime</h1></body></html>'
            }
          }
        }
      }
    }
  }]
};
const runtimeArtifact=runtimeProjectPreviewArtifact(arbitraryRuntime,cafe.scope_key);
assert.ok(runtimeArtifact);
assert.match(runtimeArtifact.html,/Café Luna Runtime/);
const runtimeAccess=resolveProjectPreviewAccess({project:cafe},{deployed_sha:HEAD,runtime:arbitraryRuntime});
assert.equal(runtimeAccess.available,true);
assert.equal(runtimeAccess.access_kind,'RUNTIME_WEB_FACTORY_ARTIFACT');
assert.equal(runtimeAccess.provider,'RIOSYSTEMS_NATIVE_WEB_RUNTIME');

const missing=resolveProjectPreviewAccess({project:noPreview},{deployed_sha:HEAD});
assert.equal(missing.available,false);
assert.equal(missing.reason,'PROJECT_PREVIEW_ARTIFACT_NOT_MATERIALIZED_OR_REGISTERED');

const created=createOperatorRuntime({
  operator_id:operatorId,
  portfolio:{operator_id:operatorId,projects:[gelato,cafe,noPreview],production_deploy:false}
});
assert.equal(created.ok,true);
created.runtime.selected_project_scope=gelato.scope_key;
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const core=createOperatorRuntimeApiService({operator_id:operatorId,store});
const service=withProjectSourceIntakeRuntimeService({service:core,store,operator_id:operatorId});
const authorize=async()=>({ok:true,status:200,operator_id:operatorId,email:'preview-system@example.test'});
const env={
  RIOSYSTEMS_ENVIRONMENT:'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY:'false',
  RIOSYSTEMS_EXTERNAL_WRITES:'false',
  CF_VERSION_METADATA:{id:'preview-system-version',tag:HEAD,timestamp:'2026-09-05T16:30:00.000Z'}
};

const listings={
  'projects/gelato-donatello-website-v1':[
    {type:'file',name:'customer-delivery-contract-v1.json',path:'projects/gelato-donatello-website-v1/customer-delivery-contract-v1.json'},
    {type:'file',name:'ferrari-preview-v1.html',path:'projects/gelato-donatello-website-v1/ferrari-preview-v1.html'}
  ],
  'projects/cafe-luna-website-v1':[
    {type:'file',name:'index.html',path:'projects/cafe-luna-website-v1/index.html'},
    {type:'file',name:'styles.css',path:'projects/cafe-luna-website-v1/styles.css'}
  ]
};
function directoryFromUrl(url){
  const marker='/contents/';
  const raw=String(url);
  const start=raw.indexOf(marker);
  if(start<0)return null;
  const rest=raw.slice(start+marker.length).split('?')[0];
  return decodeURIComponent(rest);
}
const options={
  runtime_service:service,
  authorize,
  project_preview_directory_fetch:async(url)=>{
    const directory=directoryFromUrl(url);
    const body=listings[directory];
    return body
      ? new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}})
      : new Response(JSON.stringify({message:'Not Found'}),{status:404,headers:{'content-type':'application/json'}});
  },
  project_preview_fetch:async(url)=>{
    const raw=String(url);
    if(raw.includes('/projects/gelato-donatello-website-v1/ferrari-preview-v1.html')){
      return new Response('<!doctype html><html><body><h1>Gelato Donatello Generic Discovery</h1></body></html>',{status:200});
    }
    if(raw.includes('/projects/cafe-luna-website-v1/index.html')){
      return new Response('<!doctype html><html><body><h1>Café Luna Generic Discovery</h1></body></html>',{status:200});
    }
    return new Response('missing',{status:404});
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
assert.equal(body.project_preview_access.available,true);
assert.equal(body.project_preview_access.access_kind,'CANONICAL_ARTIFACT_PROXY');
assert.equal(body.project_preview_access.source_path,'projects/gelato-donatello-website-v1/ferrari-preview-v1.html');
assert.equal(body.project_preview_access.provider,'CANONICAL_PROJECT_ARTIFACT');

response=await call('/operator/api/project-detail/'+encodeURIComponent(cafe.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.project_preview_access.available,true);
assert.equal(body.project_preview_access.source_path,'projects/cafe-luna-website-v1/index.html');

response=await call('/operator/api/project-detail/'+encodeURIComponent(noPreview.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.project_preview_access.available,false);
assert.equal(body.project_preview_access.status,'NOT_AVAILABLE');

response=await call('/operator/project-preview/'+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
assert.match(await response.text(),/Gelato Donatello Generic Discovery/);

response=await call('/operator/project-preview/'+encodeURIComponent(cafe.scope_key));
assert.equal(response.status,200);
assert.match(await response.text(),/Café Luna Generic Discovery/);

response=await call('/operator/project-preview/'+encodeURIComponent(noPreview.scope_key));
assert.equal(response.status,404);
body=await response.json();
assert.equal(body.error,'PROJECT_PREVIEW_NOT_AVAILABLE');

const canonicalAccess=resolveProjectPreviewAccess({project:cafe},{deployed_sha:HEAD,canonical_source_path:'projects/cafe-luna-website-v1/index.html'});
assert.equal(canonicalAccess.available,true);
assert.match(canonicalPreviewRawUrl(canonicalAccess),new RegExp(HEAD));

response=await call('/operator/api/project-source-intake/human-decision',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({
    scope_key:noPreview.scope_key,
    context_scope_key:noPreview.scope_key,
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
assert.match(html,/aurentara-project-preview-access-v2-ui/);
assert.match(html,/Systemweite projektgebundene Vorschau/);

const manifest=operatorProjectPreviewAccessManifest();
assert.equal(manifest.every_project_uses_same_preview_contract,true);
assert.equal(manifest.project_specific_hardcoded_preview_registry,false);
assert.equal(manifest.runtime_web_factory_artifacts_reused,true);
assert.equal(manifest.canonical_project_artifacts_discovered_generically,true);
assert.equal(manifest.hardcoded_project_preview_exceptions,false);
assert.equal(manifest.production_deploy,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-system-wide-preview-access-v2',
  gelato_generic_discovery:'PASS',
  arbitrary_project_generic_discovery:'PASS',
  runtime_web_factory_preview:'PASS',
  no_hardcoded_project_registry:true,
  every_project_same_preview_contract:true,
  scope_key_identity_discovery:'PASS',
  operator_preview_route_dispatch:'PASS',
  missing_preview_fail_closed:'PASS',
  final_human_approval_preview_availability_gate:'PASS',
  production_deploy:false,
  public_launch:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
