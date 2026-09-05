import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { GENERATED_PROJECT_PREVIEW_REGISTRY_V1 } from '../src/generated-project-preview-registry-v1.js';
import { handleOperatorDashboard, operatorProjectPreviewAccessManifest } from '../src/operator-project-preview-access-v1.js';
import {
  resolveProjectPreviewAccess,
  bundledProjectPreviewArtifact,
  runtimeProjectPreviewArtifact,
  projectPreviewAccessManifest
} from '../src/project-preview-access-v1.js';

const HEAD='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const operatorId='operator:preview-bundle@example.test';
const gelato={
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:'gelato-donatello:gelato-donatello-website-v1',
  name:'Gelato Donatello',
  industry:'gelateria',
  country:'DE',
  language:'de',
  state:'READY',
  blocked:false,
  production_deploy:false
};
const legacyGelato={...gelato,project_id:'gelato-donatello'};
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

assert.ok(GENERATED_PROJECT_PREVIEW_REGISTRY_V1.length >= 4,'build-time generator should index current project previews');
const gelatoEntry=GENERATED_PROJECT_PREVIEW_REGISTRY_V1.find((entry)=>entry.project_dir==='gelato-donatello-website-v1');
assert.ok(gelatoEntry,'Gelato preview must be in generated registry');
assert.equal(gelatoEntry.source_path,'projects/gelato-donatello-website-v1/ferrari-preview-v1.html');
assert.ok(gelatoEntry.styles_inlined >= 1);
assert.match(gelatoEntry.html,/data-aurentara-preview-bundled-css="styles\.css"/);
assert.doesNotMatch(gelatoEntry.html,/href="\.\/styles\.css"/);

const bundled=bundledProjectPreviewArtifact({project:gelato},{scope_key:gelato.scope_key});
assert.ok(bundled);
assert.equal(bundled.registry_key,'gelato-donatello-website-v1');
assert.match(bundled.html,/Gelato Donatello/);

const legacyBundled=bundledProjectPreviewArtifact({project:legacyGelato},{scope_key:legacyGelato.scope_key});
assert.ok(legacyBundled,'authoritative scope must resolve bundle even when legacy project_id differs');
assert.equal(legacyBundled.registry_key,'gelato-donatello-website-v1');

const gelatoAccess=resolveProjectPreviewAccess({project:gelato},{scope_key:gelato.scope_key,deployed_sha:HEAD});
assert.equal(gelatoAccess.available,true);
assert.equal(gelatoAccess.access_kind,'BUNDLED_CANONICAL_PROJECT_ARTIFACT');
assert.equal(gelatoAccess.provider,'RIOSYSTEMS_BUILD_TIME_PROJECT_PREVIEW');
assert.equal(gelatoAccess.source_revision,HEAD);
assert.equal(gelatoAccess.styles_inlined,gelatoEntry.styles_inlined);
assert.equal(gelatoAccess.exact_head_bound,true);

const external=resolveProjectPreviewAccess({
  project:{...cafe,preview_url:'https://example.pages.dev/review/123'}
},{scope_key:cafe.scope_key,deployed_sha:HEAD});
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
const runtimeAccess=resolveProjectPreviewAccess({project:cafe},{scope_key:cafe.scope_key,deployed_sha:HEAD,runtime:arbitraryRuntime});
assert.equal(runtimeAccess.available,true);
assert.equal(runtimeAccess.access_kind,'RUNTIME_WEB_FACTORY_ARTIFACT');

const missing=resolveProjectPreviewAccess({project:noPreview},{scope_key:noPreview.scope_key,deployed_sha:HEAD});
assert.equal(missing.available,false);
assert.equal(missing.reason,'PROJECT_PREVIEW_ARTIFACT_NOT_MATERIALIZED_IN_BUILD');

const created=createOperatorRuntime({
  operator_id:operatorId,
  portfolio:{operator_id:operatorId,projects:[gelato,cafe,noPreview],production_deploy:false}
});
assert.equal(created.ok,true);
created.runtime.selected_project_scope=gelato.scope_key;
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const core=createOperatorRuntimeApiService({operator_id:operatorId,store});
const service=withProjectSourceIntakeRuntimeService({service:core,store,operator_id:operatorId});
const authorize=async()=>({ok:true,status:200,operator_id:operatorId,email:'preview-bundle@example.test'});
const env={
  RIOSYSTEMS_ENVIRONMENT:'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY:'false',
  RIOSYSTEMS_EXTERNAL_WRITES:'false',
  CF_VERSION_METADATA:{id:'preview-bundle-version',tag:HEAD,timestamp:'2026-09-05T16:30:00.000Z'}
};
const options={runtime_service:service,authorize};

async function call(path,init={}){
  const response=await handleOperatorDashboard(new Request('https://operator.example.test'+path,init),env,{},options);
  assert.ok(response,'response required for '+path);
  return response;
}

let response=await call('/operator/api/project-detail/'+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
let body=await response.json();
assert.equal(body.project_preview_access.available,true);
assert.equal(body.project_preview_access.access_kind,'BUNDLED_CANONICAL_PROJECT_ARTIFACT');
assert.equal(body.project_preview_access.source_path,'projects/gelato-donatello-website-v1/ferrari-preview-v1.html');

response=await call('/operator/project-preview/'+encodeURIComponent(gelato.scope_key));
assert.equal(response.status,200);
assert.match(response.headers.get('content-type')||'',/text\/html/);
assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
assert.equal(response.headers.get('x-aurentara-project-preview-scope'),gelato.scope_key);
const previewHtml=await response.text();
assert.match(previewHtml,/Gelato Donatello/);
assert.match(previewHtml,/data-aurentara-preview-bundled-css="styles\.css"/);

response=await call('/operator/api/project-detail/'+encodeURIComponent(noPreview.scope_key));
assert.equal(response.status,200);
body=await response.json();
assert.equal(body.project_preview_access.available,false);

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

const entrySource=await readFile(new URL('../src/entry.js',import.meta.url),'utf8');
assert.match(entrySource,/startsWith\("\/operator\/project-preview\/"\)/);

const coreManifest=projectPreviewAccessManifest();
assert.equal(coreManifest.build_time_project_artifact_registry,true);
assert.equal(coreManifest.runtime_github_discovery_required,false);
assert.equal(coreManifest.project_specific_hardcoded_preview_registry,false);
assert.equal(coreManifest.local_stylesheets_inlined_at_build,true);

const manifest=operatorProjectPreviewAccessManifest();
assert.equal(manifest.system_wide_project_preview_contract,true);
assert.equal(manifest.hardcoded_project_preview_exceptions,false);
assert.equal(manifest.build_time_project_preview_registry,true);
assert.equal(manifest.runtime_github_preview_lookup,false);
assert.equal(manifest.production_deploy,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-buildtime-preview-bundle-v3',
  generated_projects:GENERATED_PROJECT_PREVIEW_REGISTRY_V1.length,
  gelato_bundled_preview:'PASS',
  gelato_styles_inlined:'PASS',
  legacy_scope_resolution:'PASS',
  arbitrary_runtime_project_preview:'PASS',
  no_runtime_github_dependency:true,
  no_project_specific_exception:true,
  final_human_approval_preview_gate:'PASS',
  production_deploy:false,
  public_launch:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
