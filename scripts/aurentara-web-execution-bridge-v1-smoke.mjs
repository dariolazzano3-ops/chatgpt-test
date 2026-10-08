import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { handleOperatorDashboard } from '../src/operator-dashboard-completeness-v1.js';
import { handleAurentaraWebExecutionBridgeV1, aurentaraWebExecutionBridgeV1Manifest } from '../src/operator-web-execution-bridge-v1.js';
import { resolveProjectPreviewAccess } from '../src/project-preview-access-v1.js';

const operatorId='operator:bridge@example.com';
const scope='synthetic:website-bridge-v1';
const created=createOperatorRuntime({
  operator_id:operatorId,
  selected_project_scope:scope,
  portfolio:{operator_id:operatorId,projects:[{
    customer_id:'synthetic',project_id:'website-bridge-v1',scope_key:scope,name:'Synthetic Website',
    industry:'test',country:'DE',language:'de',state:'ACTIVE',blocked:false,production_deploy:false
  }],production_deploy:false},
  at:'2026-10-07T15:00:00.000Z'
});
assert.equal(created.ok,true);
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const service=createOperatorRuntimeApiService({operator_id:operatorId,store});
const queueExecutor=async contract=>({
  ok:true,status:'EXECUTION_QUEUED',async_pending:true,execution_id:contract.execution_id,
  actual_provider:'riosystems-native-web',executor_id:'web-factory-native-v1',
  qa:{passed:false,pending:true},synthetic_only:true,real_customer_data:false,
  variable_cost_eur:0,paid_overflow:false,production_deploy:false
});
queueExecutor.execution_bridge_async=true;

const authorize=async()=>({ok:true,operator_id:operatorId,email:'bridge@example.com'});
const env={RIOSYSTEMS_ENVIRONMENT:'local',AURENTARA_EXECUTION_BRIDGE_TOKEN:'test-bridge-token-0123456789-abcdefghijklmnopqrstuvwxyz'};
const opts={runtime_service:service,live_staging_executor:queueExecutor,authorize};
const req=(path,method='GET',body=null,auth=false)=>new Request('https://operator.test'+path,{
  method,
  headers:{...(body?{'content-type':'application/json'}:{}),...(auth?{authorization:'Bearer '+env.AURENTARA_EXECUTION_BRIDGE_TOKEN}:{})},
  body:body?JSON.stringify(body):undefined
});

const preflight=await handleOperatorDashboard(req('/operator/api/mission-preflight','POST',{
  scope_key:scope,industry:'test',country:'DE',language:'de',
  mission_text:'Ändere die Testwebsite im privaten Staging.',
  requested_outcomes:['website'],known_constraints:['keine Production']
}),env,{},opts);
assert.equal(preflight.status,201);
const plan=await preflight.json();

const queued=await handleOperatorDashboard(req('/operator/api/mission-plan-decision','POST',{
  plan_token:plan.plan_token,decision:'approve_live_staging',confirmation_text:'CONFIRM_LIVE_STAGING_ZERO_COST'
}),env,{},opts);
assert.equal(queued.status,202);
const queuedBody=await queued.json();
assert.equal(queuedBody.status,'EXECUTION_QUEUED');
assert.equal(queuedBody.async_pending,true);

let snap=await service.handle({method:'GET',path:'/snapshot'});
let run=snap.runtime.live_staging_runs[0];
assert.equal(run.status,'EXECUTING');
assert.equal(run.execution_bridge.status,'QUEUED');
assert.equal(run.production_deploy,false);

const unauthorized=await handleAurentaraWebExecutionBridgeV1(req('/internal/aurentara-web-execution-bridge/v1/health'),env,{}, {runtime_service:service});
assert.equal(unauthorized.status,401);

const health=await handleAurentaraWebExecutionBridgeV1(req('/internal/aurentara-web-execution-bridge/v1/health','GET',null,true),env,{}, {runtime_service:service});
assert.equal(health.status,200);
assert.equal((await health.json()).queued,1);

const claim=await handleAurentaraWebExecutionBridgeV1(req('/internal/aurentara-web-execution-bridge/v1/claim','POST',{worker_id:'vps-bridge-1',lease_seconds:600},true),env,{}, {runtime_service:service});
assert.equal(claim.status,200);
const claimBody=await claim.json();
assert.equal(claimBody.run.execution_id,queuedBody.execution_id);
assert.equal(claimBody.run.execution_bridge.status,'CLAIMED');
assert.equal(claimBody.run.execution_bridge.worker_id,'vps-bridge-1');

const duplicateSameWorkerClaim=await handleAurentaraWebExecutionBridgeV1(req('/internal/aurentara-web-execution-bridge/v1/claim','POST',{worker_id:'vps-bridge-1',lease_seconds:600},true),env,{}, {runtime_service:service});
assert.equal(duplicateSameWorkerClaim.status,200);
assert.equal((await duplicateSameWorkerClaim.json()).run,null);

const secondClaim=await handleAurentaraWebExecutionBridgeV1(req('/internal/aurentara-web-execution-bridge/v1/claim','POST',{worker_id:'vps-bridge-2',lease_seconds:600},true),env,{}, {runtime_service:service});
assert.equal(secondClaim.status,200);
assert.equal((await secondClaim.json()).run,null);

const complete=await handleAurentaraWebExecutionBridgeV1(req('/internal/aurentara-web-execution-bridge/v1/complete','POST',{
  worker_id:'vps-bridge-1',
  execution_id:queuedBody.execution_id,
  result:{
    ok:true,status:'LIVE_STAGING_VERIFIED',qa:{passed:true},
    preview_url:'https://private.example.invalid',
    private_access_verified:true,
    synthetic_only:true,real_customer_data:false,
    variable_cost_eur:0,paid_overflow:false,production_deploy:false,
    public_deploy:false,dns_change:false,billing:false,checkout:false,public_indexing:false
  }
},true),env,{}, {runtime_service:service});
assert.equal(complete.status,200);
const completeBody=await complete.json();
assert.equal(completeBody.ok,true);

snap=await service.handle({method:'GET',path:'/snapshot'});
run=snap.runtime.live_staging_runs[0];
assert.equal(run.status,'LIVE_STAGING_VERIFIED');
assert.equal(run.execution_bridge.status,'COMPLETED');
assert.equal(run.evidence.qa.passed,true);
assert.equal(run.production_deploy,false);
assert.ok(snap.runtime.audit.some(x=>x.event==='WEB_EXECUTION_BRIDGE_CLAIMED'));

const access=resolveProjectPreviewAccess({project:{project_id:'website-bridge-v1',scope_key:scope}},{scope_key:scope,runtime:snap.runtime});
assert.equal(access.available,true);
assert.equal(access.access_kind,'EXISTING_PRIVATE_PREVIEW_URL');
assert.equal(access.provider,'AURENTARA_EXECUTION_BRIDGE_PRIVATE_PREVIEW');
assert.equal(access.preview_url,'https://private.example.invalid/');
assert.equal(access.private_access_verified,true);
assert.equal(access.qa_passed,true);

const manifest=aurentaraWebExecutionBridgeV1Manifest();
assert.equal(manifest.github_credentials_in_worker,false);
assert.equal(manifest.production_deploy,false);
assert.equal(manifest.automatic_merge,false);

console.log(JSON.stringify({
  ok:true,
  suite:'aurentara-web-execution-bridge-v1',
  queue:'PASS',claim_lease:'PASS',same_worker_duplicate_claim:'PASS',completion:'PASS',preview_return:'PASS',auth:'PASS',
  github_credentials_in_worker:false,production_deploy:false,automatic_merge:false
},null,2));
