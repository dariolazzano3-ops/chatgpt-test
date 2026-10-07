import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { activateControlledPaidStagingProject, controlledPaidStagingSnapshot, CONTROLLED_PAID_STAGING_CONFIRMATION } from '../src/operator-controlled-paid-staging-v1.js';
import { handleOperatorDashboard } from '../src/operator-controlled-paid-staging-dashboard-v1.js';

const operatorId='operator:async-bridge@aurentara.test';
const scope='gelato-donatello:gelato-donatello-website-v1';
const base={customer_id:'gelato-donatello',project_id:'gelato-donatello-website-v1',scope_key:scope,name:'Gelato Donatello',industry:'gelateria',country:'DE',language:'de',state:'READY',blocked:false,production_deploy:false};
const activated=activateControlledPaidStagingProject(base,{
  project_id:base.project_id,scope_key:scope,confirmation_text:CONTROLLED_PAID_STAGING_CONFIRMATION,
  project_budget_ceiling_eur:25,environment:'staging',paid_provider_permission:true,
  production_locked:true,external_write_locked:true,public_deploy:false,dns_change:false,billing:false,
  checkout:false,public_indexing:false,real_end_customer_data:false,automatic_budget_increase:false
});
assert.equal(activated.ok,true);
const created=createOperatorRuntime({operator_id:operatorId,selected_project_scope:scope,portfolio:{operator_id:operatorId,projects:[activated.project],production_deploy:false}});
assert.equal(created.ok,true);
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const service=createOperatorRuntimeApiService({operator_id:operatorId,store});
let calls=0;
const queuedExecutor=async contract=>{
  calls++;
  return {
    ok:true,status:'EXECUTION_QUEUED',async_pending:true,execution_id:contract.execution_id,
    actual_provider:'riosystems-native-web',executor_id:'web-factory-native-v1',
    qa:{passed:false,pending:true},synthetic_only:false,real_customer_data:false,
    external_customer_writes:false,variable_cost_eur:0,paid_overflow:false,
    public_deploy:false,dns_change:false,billing:false,checkout:false,public_indexing:false,production_deploy:false
  };
};
queuedExecutor.execution_bridge_async=true;
const options={
  runtime_service:service,
  authorize:async()=>({ok:true,operator_id:operatorId,email:'async-bridge@aurentara.test'}),
  current_runtime_verified_provider_ids:['posthog-free'],
  synthetic_acceptance:true,
  live_staging_executor:queuedExecutor
};
const call=async(path,body)=>{
  const req=new Request('https://operator.test'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const response=await handleOperatorDashboard(req,{}, {},options);
  return {response,json:await response.clone().json()};
};

const preflight=await call('/operator/api/mission-preflight',{
  scope_key:scope,mission_text:'Ändere die Gelato Website im privaten Staging.',requested_outcomes:['web_presence']
});
assert.equal(preflight.response.status,201);
const execute=await call('/operator/api/mission-plan-decision',{
  scope_key:scope,plan_token:preflight.json.plan_token,decision:'approve',confirmation_text:CONTROLLED_PAID_STAGING_CONFIRMATION
});
assert.equal(execute.response.status,202);
assert.equal(execute.json.status,'EXECUTION_QUEUED');
assert.equal(calls,1);

let snap=await service.handle({method:'GET',path:'/snapshot'});
let run=snap.runtime.live_staging_runs[0];
assert.equal(run.controlled_paid_staging,true);
assert.equal(run.status,'EXECUTING');
assert.equal(run.execution_bridge.status,'QUEUED');
assert.equal(run.project_budget?.reserved_eur,undefined);

const claim=await service.claimLiveStagingExecution({expected_revision:snap.runtime.revision,worker_id:'async-worker',lease_seconds:600});
assert.equal(claim.ok,true);
snap=await service.handle({method:'GET',path:'/snapshot'});
run=snap.runtime.live_staging_runs[0];
assert.equal(run.execution_bridge.status,'CLAIMED');

const completed=await service.completeLiveStagingExecution({
  expected_revision:snap.runtime.revision,execution_id:run.execution_id,worker_id:'async-worker',
  result:{
    ok:true,status:'LIVE_PROVIDER_VERIFIED',
    planned_provider:'riosystems-native-web',dispatched_provider:'riosystems-native-web',
    actual_provider:'riosystems-native-web',executor_id:'web-factory-native-v1',
    provider_call_count:0,actual_cost_eur:0,variable_cost_eur:0,
    qa:{passed:true},preview_url:'https://private.example.invalid',private_access_verified:true,
    synthetic_only:false,real_customer_data:false,external_customer_writes:false,
    public_deploy:false,dns_change:false,billing:false,checkout:false,public_indexing:false,
    paid_overflow:false,production_deploy:false
  }
});
assert.equal(completed.ok,true);

snap=await service.handle({method:'GET',path:'/snapshot'});
run=snap.runtime.live_staging_runs[0];
assert.equal(run.status,'LIVE_STAGING_VERIFIED');
assert.equal(run.execution_bridge.status,'COMPLETED');
assert.equal(run.evidence.actual_provider,'riosystems-native-web');
assert.equal(run.variable_cost_eur,0);
const project=snap.runtime.command_center_state.portfolio.projects[0];
const budget=controlledPaidStagingSnapshot(project);
assert.equal(budget.reserved_eur,0);
assert.equal(budget.current_spend_eur,0);

console.log(JSON.stringify({ok:true,suite:'aurentara-controlled-async-execution-bridge-v1',queue:'PASS',claim:'PASS',provider_truth:'PASS',cost_release:'PASS',paid_provider_calls:0,production_deploy:false},null,2));
