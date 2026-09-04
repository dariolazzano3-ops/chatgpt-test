import { handleOperatorAiMessageWithInference } from './service-v1.js';

const c=(v,n=1000)=>String(v??'').trim().slice(0,n);
const CONFIRMATION='AURENTARA_OPERATOR_AI_REAL_ACCEPTANCE_V1';
const SCOPE='synthetic-operator-ai:real-inference-acceptance-v1';
const MESSAGE='Wie steht das Testprojekt aktuell und was ist der wichtigste nächste Schritt? Starte nichts.';

function json(body,status=200){return new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function authorized(request,env){return Boolean(env.API_TOKEN)&&(request.headers.get('authorization')||'')==='Bearer '+env.API_TOKEN}

export async function handleOperatorAiRealInferenceAcceptance(request,env={},options={}){
  const url=new URL(request.url);
  if(url.pathname!=='/factory/diagnostics/operator-ai-real-inference-acceptance')return null;
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED',production_deploy:false},405);
  if(!authorized(request,env))return json({ok:false,error:'UNAUTHORIZED',production_deploy:false},401);
  if(c(env.RIOSYSTEMS_ENVIRONMENT,80).toLowerCase()!=='staging'||c(env.RIOSYSTEMS_PRODUCTION_DEPLOY,20).toLowerCase()!=='false'||c(env.RIOSYSTEMS_EXTERNAL_WRITES,20).toLowerCase()!=='false')return json({ok:false,error:'STAGING_SAFETY_BOUNDARY_REQUIRED',paid_inference_calls:0,production_deploy:false,external_writes:false},403);
  if(request.headers.get('x-aurentara-operator-ai-acceptance-confirmation')!==CONFIRMATION)return json({ok:false,error:'OPERATOR_AI_REAL_ACCEPTANCE_CONFIRMATION_REQUIRED',paid_inference_calls:0,production_deploy:false},403);
  let body={};try{body=await request.json()}catch{}
  const expected=c(body.expected_canonical_sha,80),deployed=c(env.CF_VERSION_METADATA?.tag,80);
  if(!/^[0-9a-f]{40}$/i.test(expected)||deployed!==expected)return json({ok:false,error:'OPERATOR_AI_DEPLOYED_CANONICAL_MISMATCH',expected_canonical_sha:expected||null,deployed_version_tag:deployed||null,paid_inference_calls:0,production_deploy:false},409);

  const project={customer_id:'synthetic-operator-ai',project_id:'real-inference-acceptance-v1',scope_key:SCOPE,name:'AURENTARA Operator AI Synthetic Acceptance',state:'READY',environment:'staging'};
  const now=c(env.CF_VERSION_METADATA?.timestamp,100)||new Date().toISOString();
  const context={
    projects:[project],selected_project_scope:SCOPE,operator_runtime_revision:1,
    canonical_source:{canonical_branch:'factory-control',canonical_head:deployed,verified_at:now},
    project_state:project,project_context:{scope_key:SCOPE,status:'READY',synthetic_only:true},
    mission_state:{status:'READY',execution_started:false},quality_state:{status:'SUPPORTED',hard_failures:[]},
    provider_state:{provider_ecosystem:[{id:'openai-api',connection_state:'CONNECTED_STAGING',runtime_eligible:true,inference_verified:true,routing_ready:true,paid_execution_approved:false,production_eligible:false}]},
    cost_state:{route:'BALANCED',approval_required:false,cost_ceiling:0},approval_state:{pending:[],operator_production_approval:false,external_write_approved:false},
    release_state:{status:'STAGING_ONLY',production_approval_required:true,production_approved:false},delivery_state:{status:'NOT_STARTED'},
    recent_evidence:[{source:'worker_version_metadata',status:'VERIFIED',verified:true,observed_at:now}],unknowns:[],conflicts:[]
  };

  const result=await handleOperatorAiMessageWithInference({message:MESSAGE,conversation_project_scope:SCOPE},context,{now,env,fetch_impl:options.fetch_impl,safe_internal_execution_active:false});
  const inf=result.inference||{};
  const ok=result.ok===true&&result.project_resolution?.scope_key===SCOPE&&inf.status==='VERIFIED'&&inf.provider==='openai-api'&&inf.model==='gpt-5.6-luna'&&inf.tool_calls===0&&result.execution?.started===false&&result.production_deploy===false&&result.external_writes===false;
  return json({
    ok,
    schema:'aurentara.operator-ai.real-inference-live-acceptance.v1',
    deployed_canonical_sha:deployed,
    project_scope:SCOPE,
    answer:ok?c(result.summary,3000):null,
    reasoning_summary:ok?c(result.why,1200):null,
    next_action:ok?result.next_action:null,
    provider:inf.provider||'openai-api',
    model:inf.model||'gpt-5.6-luna',
    inference_status:inf.status||'FAILED',
    usage:inf.usage||null,
    estimated_cost_usd:inf.estimated_cost_usd??0,
    paid_inference_calls:Number(inf.paid_inference_calls||0),
    tool_calls:Number(inf.tool_calls||0),
    execution_started:result.execution?.started===true,
    level_4_status:'NOT_ACTIVATED',
    secret_value_exposed:false,
    prompt_content_logged:false,
    production_deploy:false,
    external_writes:false,
    error:ok?null:(inf.error||result.error||'OPERATOR_AI_REAL_ACCEPTANCE_FAILED')
  },ok?200:502);
}

export function operatorAiRealInferenceAcceptanceManifest(){return{schema:'aurentara.operator-ai.real-inference-live-acceptance.v1',route:'POST /factory/diagnostics/operator-ai-real-inference-acceptance',auth:'API_TOKEN',staging_only:true,synthetic_project_only:true,exact_confirmation:CONFIRMATION,max_paid_calls_per_request:1,no_retries:true,production_deploy:false,external_writes:false,level_4_status:'NOT_ACTIVATED'}}
