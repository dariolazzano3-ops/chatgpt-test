import { canonicalGraph } from './graph.js';
const clone=v=>structuredClone(v??null);
const RECIPES={
 lead_intake:['trigger','validation','transform','database','notification','termination'],
 contact_form:['trigger','validation','transform','database','notification','termination'],
 booking_followup:['trigger','delay','condition','notification','termination'],
 support_escalation:['trigger','validation','ai_task','condition','notification','termination'],
 review_request:['trigger','delay','condition','notification','termination'],
 sales_notification:['trigger','validation','notification','termination'],
 CRM_sync:['trigger','database','transform','database','validation','termination'],
 AI_lead_qualification:['trigger','validation','ai_task','database','notification','termination'],
 customer_onboarding:['trigger','validation','subflow','notification','delay','notification','termination']
};
export function recipeCatalog(){return clone(RECIPES);}
export function compileRecipe({recipe,project_id,parameters={}}={}){const types=RECIPES[recipe];if(!types)return {ok:false,error:'RECIPE_UNKNOWN'};const nodes=types.map((type,i)=>({id:i===0?'trigger':i===types.length-1?'end':`${type}_${i}`,type,config:{recipe,parameters:clone(parameters)},project_id,idempotency_required:['database','notification','action','ai_task','subflow','webhook'].includes(type),idempotency_key:['database','notification','action','ai_task','subflow','webhook'].includes(type)?`${project_id}:${recipe}:${i}`:null,timeout_ms:5000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true}));const edges=nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id,type:'success'}));return canonicalGraph({automation_id:`${project_id}:${recipe}`,project_id,nodes,edges,metadata:{recipe,parameterized:true,provider_neutral:true}});}
export function websiteBusinessReferenceFlow(project_id='synthetic-project'){const nodes=[
{id:'website_form',type:'trigger',config:{event_type:'website.form_submitted'},timeout_ms:1000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'validate',type:'validation',timeout_ms:1000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'map_lead',type:'transform',timeout_ms:1000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'business_request',type:'subflow',config:{factory:'business',operation:'lead.create'},idempotency_key:`${project_id}:lead`,idempotency_required:true,timeout_ms:5000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'ai_qualification',type:'ai_task',config:{factory:'ai',operation:'lead.qualify'},idempotency_key:`${project_id}:ai`,idempotency_required:true,timeout_ms:5000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'notify_sales',type:'notification',config:{channel:'internal'},idempotency_key:`${project_id}:notify`,idempotency_required:true,timeout_ms:5000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'analytics',type:'action',config:{action:'analytics'},idempotency_key:`${project_id}:analytics`,idempotency_required:true,timeout_ms:5000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},
{id:'success',type:'validation',timeout_ms:1000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true},{id:'end',type:'termination',timeout_ms:1000,retry_policy:{strategy:'bounded_retry',max_attempts:3},validation:true,observability:true}
];const edges=nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id,type:'success'}));return canonicalGraph({automation_id:`${project_id}:website-business-flow`,project_id,nodes,edges,metadata:{cross_factory:true,event_type:'website.form_submitted'}});}
