import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard, operatorProjectPreviewAccessManifest } from '../src/operator-project-preview-access-v1.js';
import { GENERATED_PROJECT_PREVIEW_INDEX } from '../src/generated-project-preview-index-v1.js';
import {
  resolveProjectPreviewAccess,
  canonicalPreviewRawUrl,
  projectPreviewDirectoryCandidates,
  runtimeProjectPreviewArtifact,
  bundledProjectPreviewArtifact
} from '../src/project-preview-access-v1.js';

const HEAD='026c9582d5a82b6ede2af2bc6c7e6f45143262e6';
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
const arbitraryCanonical={
  customer_id:'mueller-elektrotechnik',
  project_id:'mueller-elektrotechnik-digital-customer-system-v1',
  scope_key:'mueller-elektrotechnik:mueller-elektrotechnik-digital-customer-system-v1',
  name:'Müller Elektrotechnik',
  industry:'elektrotechnik',
  country:'DE',
  language:'de',
  state:'READY',
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
assert.deepEqual(projectPreviewDirectoryCandidates({project:arbitraryCanonical}),['projects/mueller-elektrotechnik-digital-customer-system-v1']);

const bundledGelato=bundledProjectPreviewArtifact({project:gelato});
assert.ok(bundledGelato);
assert.equal(bundledGelato.source_path,'projects/gelato-donatello-website-v1/ferrari-preview-v1.html');
assert.match(bundledGelato.html,/Gelato Donatello/i);
const indexedGelato=GENERATED_PROJECT_PREVIEW_INDEX.by_scope?.[gelato.scope_key];
assert.ok(indexedGelato,'Gelato must be present in generated build-time preview index');
assert.ok(Number(indexedGelato.styles_inlined||0)>=1,'Gelato preview must inline at least one local stylesheet');
assert.match(indexedGelato.html,/data-aurentara-preview-bundled-css="styles\.css"/);
assert.doesNotMatch(indexedGelato.html,/href=["']\.\/styles\.css["']/i);

const bundledArbitrary=bundledProjectPreviewArtifact({project:arbitraryCanonical});
assert.ok(bundledArbitrary);
assert.equal(bundledArbitrary.source_path,'projects/mueller-elektrotechnik-digital-customer-system-v1/index.html');

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
  portfolio:{operator_id:operatorId,projects:[gelato,arbitraryCanonical,noPreview],production_deploy:false}
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

const options={
  runtime_service:service,
  authorize
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
assert.equal(body.project_preview_access.access_kind,'BUNDLED_PROJECT_ARTIFACT');
assert.equal(body.project_preview_access.source_path,'projects/gelato-donatello-website-v1/ferrari-preview-v1.html');
assert.equal(body.project_preview_access.provider,'RIOSYSTEMS_BUILD_PREVIEW_INDEX');

response=await call('/operator/api/project-detail/'+encodeURIComponent(arbitraryCanonical.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.project_preview_access.available,true);
assert.equal(body.project_preview_access.access_kind,'BUNDLED_PROJECT_ARTIFACT');
assert.equal(body.project_preview_access.source_path,'projects/mueller-elektrotechnik-digital-customer-system-v1/index.html');

response=await call('/operator/api/project-detail/'+encodeURIComponent(noPreview.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.project_preview_access.available,false);
assert.equal(body.project_preview_access.status,'NOT_AVAILABLE');

response=await call('/operator/project-preview/'+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
assert.match(await response.text(),/Gelato Donatello/i);

response=await call('/operator/project-preview/'+encodeURIComponent(arbitraryCanonical.scope_key));
assert.equal(response.status,200);
assert.match(response.headers.get('x-aurentara-project-preview-provider')||'',/RIOSYSTEMS_BUILD_PREVIEW_INDEX/);
assert.match(await response.text(),/<html/i);

response=await call('/operator/project-preview/'+encodeURIComponent(noPreview.scope_key));
assert.equal(response.status,404);
body=await response.json();
assert.equal(body.error,'PROJECT_PREVIEW_NOT_AVAILABLE');

const canonicalAccess=resolveProjectPreviewAccess({project:noPreview},{deployed_sha:HEAD,canonical_source_path:'projects/internal-crm-v1/index.html'});
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
assert.equal(manifest.build_time_project_preview_index,true);
assert.equal(manifest.build_time_preview_index_runtime_network_dependency,false);
assert.equal(manifest.build_time_preview_index_support,true);
assert.equal(manifest.hardcoded_project_preview_exceptions,false);
assert.equal(manifest.production_deploy,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-system-wide-preview-access-v2',
  gelato_build_time_preview:'PASS',
  gelato_local_styles_bundled:'PASS',
  arbitrary_project_build_time_preview:'PASS',
  runtime_web_factory_preview:'PASS',
  build_time_preview_runtime_network_dependency:false,
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
