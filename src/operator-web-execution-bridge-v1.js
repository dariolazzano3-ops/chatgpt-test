const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const ROUTE='/internal/aurentara-web-execution-bridge/v1';

function json(body,status=200){
  return new Response(JSON.stringify(body,null,2),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'x-aurentara-web-execution-bridge':'v1'
    }
  });
}

function timingSafeEqualText(a='',b=''){
  const x=new TextEncoder().encode(String(a));
  const y=new TextEncoder().encode(String(b));
  if(x.length!==y.length)return false;
  let diff=0;
  for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
  return diff===0;
}

function authorized(request,env={}){
  const expected=clean(env.AURENTARA_EXECUTION_BRIDGE_TOKEN,500);
  if(expected.length<32)return false;
  const header=clean(request.headers.get('authorization'),700);
  if(!header.startsWith('Bearer '))return false;
  return timingSafeEqualText(header.slice(7),expected);
}

async function body(request){
  try{return await request.clone().json()}catch{return{}}
}

async function snapshot(service){
  const result=await service.handle({method:'GET',path:'/snapshot'});
  if(!result?.ok)return null;
  return result;
}

export async function handleAurentaraWebExecutionBridgeV1(request,env={},ctx={},options={}){
  const url=new URL(request.url);
  if(!url.pathname.startsWith(ROUTE))return null;
  if(!authorized(request,env))return json({ok:false,error:'EXECUTION_BRIDGE_AUTH_REQUIRED'},401);
  const service=options.runtime_service;
  if(!service)return json({ok:false,error:'EXECUTION_BRIDGE_RUNTIME_UNAVAILABLE'},503);

  if(request.method==='GET'&&url.pathname===ROUTE+'/health'){
    const snap=await snapshot(service);
    if(!snap)return json({ok:false,error:'EXECUTION_BRIDGE_RUNTIME_UNAVAILABLE'},503);
    const runs=snap.runtime?.live_staging_runs||[];
    return json({
      ok:true,
      schema:'aurentara.web-execution-bridge.health.v1',
      status:'READY',
      runtime_revision:snap.runtime?.revision??null,
      queued:runs.filter(x=>x.status==='EXECUTING'&&x.execution_bridge?.status==='QUEUED').length,
      claimed:runs.filter(x=>x.status==='EXECUTING'&&x.execution_bridge?.status==='CLAIMED').length,
      production_deploy:false,
      public_deploy:false,
      dns_change:false,
      billing:false
    });
  }

  if(request.method==='POST'&&url.pathname===ROUTE+'/claim'){
    const input=await body(request);
    const snap=await snapshot(service);
    if(!snap)return json({ok:false,error:'EXECUTION_BRIDGE_RUNTIME_UNAVAILABLE'},503);
    const result=await service.claimLiveStagingExecution({
      expected_revision:snap.runtime.revision,
      worker_id:clean(input.worker_id,160),
      lease_seconds:Number(input.lease_seconds||600)
    });
    if(!result?.ok)return json(result?.body||{ok:false,error:'EXECUTION_BRIDGE_CLAIM_FAILED'},result?.status||409);
    const run=result.body?.run||result.run||null;
    return json({
      ok:true,
      schema:'aurentara.web-execution-bridge.claim.v1',
      runtime_revision:result.runtime?.revision??snap.runtime.revision,
      run:run?{
        execution_id:run.execution_id,
        mission_id:run.mission_id,
        scope_key:run.scope_key,
        plan_token:run.plan_token,
        controlled_paid_staging:run.controlled_paid_staging===true,
        contract:run.contract,
        execution_bridge:run.execution_bridge
      }:null,
      production_deploy:false
    });
  }

  if(request.method==='POST'&&url.pathname===ROUTE+'/complete'){
    const input=await body(request);
    const snap=await snapshot(service);
    if(!snap)return json({ok:false,error:'EXECUTION_BRIDGE_RUNTIME_UNAVAILABLE'},503);
    const result=await service.completeLiveStagingExecution({
      expected_revision:snap.runtime.revision,
      execution_id:clean(input.execution_id,220),
      worker_id:clean(input.worker_id,160),
      result:input.result&&typeof input.result==='object'?input.result:{}
    });
    const status=result?.status|| (result?.ok?200:502);
    return json({
      ok:result?.ok===true,
      schema:'aurentara.web-execution-bridge.complete.v1',
      execution_id:clean(input.execution_id,220),
      runtime_revision:result?.runtime?.revision??snap.runtime.revision,
      result:result?.body||null,
      production_deploy:false
    },status);
  }

  return json({ok:false,error:'EXECUTION_BRIDGE_ROUTE_NOT_FOUND'},404);
}

export function aurentaraWebExecutionBridgeV1Manifest(){
  return{
    schema:'aurentara.web-execution-bridge.v1',
    transport:'OUTBOUND_POLLER_OVER_BEARER_AUTH',
    durable_queue:'OPERATOR_RUNTIME_LIVE_STAGING_RUNS',
    claim_lease:true,
    idempotent_reservation:true,
    github_credentials_in_worker:false,
    production_deploy:false,
    public_deploy:false,
    dns_change:false,
    billing:false,
    automatic_merge:false
  };
}
