import { createOpenAIAdapter } from '../ai-provider-adapters-v1.js';
import { createCustomerEconomicsRuntime } from './economics-v1.js';
import { HAMYREN_FREE_QUESTION_LIMIT_V1 } from './hamyren-customer-journey-readiness-v1.js';

const SCHEMA = 'aurentara_customer_ai';
const MODEL = 'gpt-5-mini';
const PROVIDER = 'openai';
const PER_TURN_RESERVATION_EUR = 0.05;
const INPUT_EUR_PER_MILLION = 0.215758; // $0.25 * 0.863032 EUR/USD snapshot 2026-09-02T22:10Z
const OUTPUT_EUR_PER_MILLION = 1.726064; // $2.00 * 0.863032 EUR/USD snapshot 2026-09-02T22:10Z
const MAX_MESSAGE_CHARS = 8000;
const MAX_CONTEXT_ITEMS = 12;
const MAX_COMPLETION_TOKENS = 900;
const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);
const id = (prefix) => `${prefix}-${(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replaceAll('-', '').slice(0,24)}`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer' } });
}

async function readJson(request) {
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return null;
  const raw = await request.text();
  if (raw.length > 16000) return null;
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
}

function config(env = {}) {
  const url = clean(env.AURENTARA_CUSTOMER_SUPABASE_URL, 1000);
  const key = clean(env.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY, 1200);
  return { ok: Boolean(url && key), url, key };
}

async function sb(fetchImpl, cfg, accessToken, path, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const headers = {
    'content-type':'application/json',
    'apikey':cfg.key,
    'authorization':`Bearer ${accessToken}`,
    [['POST','PUT','PATCH','DELETE'].includes(method) ? 'Content-Profile' : 'Accept-Profile']: SCHEMA,
    ...(init.headers || {})
  };
  const response = await fetchImpl(`${cfg.url}/rest/v1/${path}`, { ...init, method, headers });
  let body = null;
  try { body = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, body };
}

async function rpc(fetchImpl, cfg, accessToken, name, body) {
  return sb(fetchImpl, cfg, accessToken, `rpc/${name}`, { method:'POST', body:JSON.stringify(body) });
}

async function resolveWorkspace(fetchImpl, cfg, accessToken, user) {
  const memberships = await sb(fetchImpl,cfg,accessToken,`memberships?select=tenant_id,role,status&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`);
  const membership = memberships.ok && Array.isArray(memberships.body) ? memberships.body[0] : null;
  if (!membership) return { ok:false, bootstrap_required:true };
  const businesses = await sb(fetchImpl,cfg,accessToken,`businesses?select=*&tenant_id=eq.${encodeURIComponent(membership.tenant_id)}&deleted_at=is.null&limit=1`);
  const business = businesses.ok && Array.isArray(businesses.body) ? businesses.body[0] : null;
  if (!business) return { ok:false, bootstrap_required:true, tenant_id:membership.tenant_id };
  return { ok:true, tenant_id:membership.tenant_id, business_id:business.business_id, role:membership.role, business };
}

async function countSuccessfulTurns(fetchImpl,cfg,token,workspace) {
  const result = await sb(fetchImpl,cfg,token,`usage_attribution?select=usage_id&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&usage_class=eq.hamyren_real_ai_answer`);
  return result.ok && Array.isArray(result.body) ? result.body.length : 0;
}

function trial(used) {
  const successful = Math.max(0, Math.min(HAMYREN_FREE_QUESTION_LIMIT_V1, Number(used || 0)));
  const remaining = Math.max(0, HAMYREN_FREE_QUESTION_LIMIT_V1-successful);
  return { successful_free_questions:successful,remaining_free_questions:remaining,free_question_limit:HAMYREN_FREE_QUESTION_LIMIT_V1,may_ask_free_question:remaining>0,next_step:remaining>0?'ASK_BUSINESS_QUESTION':'ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF' };
}

async function ensureConversation(fetchImpl,cfg,token,user,workspace,requestedId) {
  if (requestedId) {
    const found = await sb(fetchImpl,cfg,token,`conversations?select=*&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&conversation_id=eq.${encodeURIComponent(requestedId)}&deleted_at=is.null&limit=1`);
    if (found.ok && Array.isArray(found.body) && found.body[0]) return found.body[0];
  }
  const latest = await sb(fetchImpl,cfg,token,`conversations?select=*&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&owner_user_id=eq.${encodeURIComponent(user.id)}&deleted_at=is.null&order=updated_at.desc&limit=1`);
  if (latest.ok && Array.isArray(latest.body) && latest.body[0]) return latest.body[0];
  const conversation = { tenant_id:workspace.tenant_id,business_id:workspace.business_id,conversation_id:id('conv'),owner_user_id:user.id,title:'HAMYREN Business AI',status:'ACTIVE',data_sensitivity:'customer',operator_plane_shared:false };
  const created = await sb(fetchImpl,cfg,token,'conversations',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(conversation)});
  return created.ok && Array.isArray(created.body) ? created.body[0] : null;
}

async function loadContext(fetchImpl,cfg,token,workspace,conversation) {
  const q = (table, select, extra='') => sb(fetchImpl,cfg,token,`${table}?select=${select}&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}${extra}`);
  const [memory,goals,decisions,messages] = await Promise.all([
    q('memory_facts','memory_id,category,fact_key,subject,value,status,confidence,sensitivity','&status=eq.ACTIVE&deleted_at=is.null&limit=12'),
    q('goals','goal_id,title,description,status,priority,target,target_date','&deleted_at=is.null&limit=12'),
    q('decisions','decision_id,title,decision,reasoning_summary,status,decided_at','&deleted_at=is.null&limit=12'),
    sb(fetchImpl,cfg,token,`conversation_messages?select=role,content,ordinal&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&conversation_id=eq.${encodeURIComponent(conversation.conversation_id)}&deleted_at=is.null&order=ordinal.desc&limit=${MAX_CONTEXT_ITEMS}`)
  ]);
  return {
    business:workspace.business,
    memory:memory.ok&&Array.isArray(memory.body)?memory.body:[],
    goals:goals.ok&&Array.isArray(goals.body)?goals.body:[],
    decisions:decisions.ok&&Array.isArray(decisions.body)?decisions.body:[],
    conversation:messages.ok&&Array.isArray(messages.body)?[...messages.body].reverse():[]
  };
}

function actualCostEur(usage={}) {
  const input=Math.max(0,Number(usage.prompt_tokens||usage.input_tokens||0));
  const output=Math.max(0,Number(usage.completion_tokens||usage.output_tokens||0));
  if (!Number.isFinite(input)||!Number.isFinite(output)) return null;
  return Number(((input*INPUT_EUR_PER_MILLION+output*OUTPUT_EUR_PER_MILLION)/1_000_000).toFixed(6));
}

function buildProvider(env, fetchImpl) {
  const apiKey=clean(env.HAMYREN_OPENAI_API_KEY,12000);
  const invoke=async ({model,prompt_contract}) => {
    const response=await fetchImpl('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'authorization':`Bearer ${apiKey}`,'content-type':'application/json'},
      body:JSON.stringify({
        model,
        max_completion_tokens:MAX_COMPLETION_TOKENS,
        response_format:{type:'json_object'},
        messages:[
          {role:'system',content:'Du bist HAMYREN, ein Personal Business AI von AURENTARA SYSTEMS. Antworte auf Deutsch, konkret und knapp. Nutze nur bereitgestellten Unternehmenskontext als Fakten. Markiere Annahmen klar. Erfinde keine Unternehmensdaten. Behandle Empfehlungen als Empfehlungen. Wenn professionelle Umsetzung sinnvoll ist, setze aurentara_handoff. Gib ausschließlich valides JSON mit answer (string), aurentara_handoff (object|null) zurück. Gib keine internen Runtime-, Provider-, Gate-, Worker- oder Operator-Details aus.'},
          {role:'user',content:JSON.stringify(prompt_contract)}
        ]
      })
    });
    let body={}; try{body=await response.json();}catch{}
    if(!response.ok) return {ok:false,error:`OPENAI_HTTP_${response.status}`,retryable:response.status>=500};
    const raw=clean(body?.choices?.[0]?.message?.content,24000);
    let parsed={}; try{parsed=JSON.parse(raw);}catch{parsed={answer:raw};}
    const cost=actualCostEur(body?.usage||{});
    return {ok:Boolean(parsed.answer),output:parsed,usage:body?.usage||null,actual_cost_eur:cost};
  };
  return createOpenAIAdapter({
    id:PROVIDER,enabled:true,credential_present:Boolean(apiKey),paid_execution_approved:true,
    data_classes:['internal','customer_test'],models:{Luna:MODEL,Terra:MODEL,Sol:MODEL},
    pricing_eur_per_million_tokens:{Luna:{input:INPUT_EUR_PER_MILLION,output:OUTPUT_EUR_PER_MILLION},Terra:{input:INPUT_EUR_PER_MILLION,output:OUTPUT_EUR_PER_MILLION},Sol:{input:INPUT_EUR_PER_MILLION,output:OUTPUT_EUR_PER_MILLION}},invoke
  });
}

async function handleChat(request,env,fetchImpl,cfg,token,user,workspace) {
  const body=await readJson(request); const message=clean(body?.message,MAX_MESSAGE_CHARS);
  if(!message) return json({ok:false,message:'Bitte gib eine Business-Frage ein.'},400);
  const used=await countSuccessfulTurns(fetchImpl,cfg,token,workspace);
  if(used>=HAMYREN_FREE_QUESTION_LIMIT_V1) return json({ok:false,message:'Deine fünf kostenlosen Fragen sind aufgebraucht. Du kannst deine bisherigen Inhalte weiter ansehen und den Upgrade-Bereich prüfen.',...trial(used)},409);
  const conversation=await ensureConversation(fetchImpl,cfg,token,user,workspace,clean(body?.conversation_id,120));
  if(!conversation) return json({ok:false,message:'Dein Gespräch konnte gerade nicht geöffnet werden. Bitte versuche es erneut.'},503);
  const context=await loadContext(fetchImpl,cfg,token,workspace,conversation);
  const turnId=id('turn'), userMessageId=id('msg'), assistantMessageId=id('msg');
  const ordinal=Math.max(0,Number(conversation.message_count||context.conversation.length||0))+1;
  const userInsert=await sb(fetchImpl,cfg,token,'conversation_messages',{method:'POST',body:JSON.stringify({tenant_id:workspace.tenant_id,business_id:workspace.business_id,conversation_id:conversation.conversation_id,message_id:userMessageId,role:'user',content:message,ordinal,metadata:{acceptance:true}})});
  if(!userInsert.ok) return json({ok:false,message:'Deine Nachricht konnte gerade nicht gespeichert werden.'},503);
  await sb(fetchImpl,cfg,token,'conversation_turns',{method:'POST',body:JSON.stringify({tenant_id:workspace.tenant_id,business_id:workspace.business_id,conversation_id:conversation.conversation_id,turn_id:turnId,user_message_id:userMessageId,intent:'business_advice',status:'RUNNING',context_manifest:{business:true,memory_count:context.memory.length,goal_count:context.goals.length,decision_count:context.decisions.length}})});
  const reserved=await rpc(fetchImpl,cfg,token,'hamyren_ai_budget_reserve_v2',{p_tenant_id:workspace.tenant_id,p_operation_id:turnId,p_provider_id:PROVIDER,p_model_id:MODEL,p_estimated_eur:PER_TURN_RESERVATION_EUR});
  if(!reserved.ok||reserved.body?.ok!==true){
    await sb(fetchImpl,cfg,token,`conversation_turns?tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&turn_id=eq.${encodeURIComponent(turnId)}`,{method:'PATCH',body:JSON.stringify({status:'BLOCKED',updated_at:new Date().toISOString()})});
    return json({ok:false,message:'Das private AI-Testbudget ist ausgeschöpft oder derzeit sicher gesperrt. Es wurde kein neuer AI-Aufruf ausgeführt.',...trial(used)},429);
  }
  const provider=buildProvider(env,fetchImpl);
  const prompt={customer_question:message,business_context:context.business,confirmed_memory:context.memory,active_goals:context.goals,decisions:context.decisions,conversation_history:context.conversation.map(m=>({role:m.role,content:clean(m.content,3000)})),instruction:'Beantworte die Frage als persönliche Business-Beratung. Frage nach, wenn entscheidender Kontext fehlt.'};
  let result;
  try{result=await provider.infer({route:{logical_model:'Luna'},task:{task_type:'generation'},prompt,ai_run_id:turnId,attempt:1});}catch{result={ok:false,error:'PROVIDER_CALL_FAILED'};}
  if(!result?.ok){
    await rpc(fetchImpl,cfg,token,'hamyren_ai_budget_release_v2',{p_tenant_id:workspace.tenant_id,p_operation_id:turnId});
    await sb(fetchImpl,cfg,token,`conversation_turns?tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&turn_id=eq.${encodeURIComponent(turnId)}`,{method:'PATCH',body:JSON.stringify({status:'FAILED',updated_at:new Date().toISOString()})});
    return json({ok:false,message:'HAMYREN konnte gerade keine AI-Antwort erzeugen. Deine kostenlose Frage wurde nicht verbraucht. Bitte versuche es später erneut.',...trial(used)},503);
  }
  const cost=Number.isFinite(result.actual_cost_eur)?Number(result.actual_cost_eur):null;
  if(cost===null){
    await rpc(fetchImpl,cfg,token,'hamyren_ai_budget_settle_v2',{p_tenant_id:workspace.tenant_id,p_operation_id:turnId,p_actual_eur:null});
    return json({ok:false,message:'Die Kosten dieses AI-Aufrufs konnten nicht sicher bestimmt werden. Weitere kostenpflichtige Aufrufe wurden vorsorglich gesperrt.'},503);
  }
  const settled=await rpc(fetchImpl,cfg,token,'hamyren_ai_budget_settle_v2',{p_tenant_id:workspace.tenant_id,p_operation_id:turnId,p_actual_eur:cost});
  if(!settled.ok||settled.body?.ok!==true) return json({ok:false,message:'Die Kostenabrechnung konnte nicht sicher abgeschlossen werden. Weitere AI-Aufrufe bleiben gesperrt.'},503);
  const answer=clean(result.output?.answer,16000);
  await sb(fetchImpl,cfg,token,'conversation_messages',{method:'POST',body:JSON.stringify({tenant_id:workspace.tenant_id,business_id:workspace.business_id,conversation_id:conversation.conversation_id,message_id:assistantMessageId,role:'assistant',content:answer,ordinal:ordinal+1,metadata:{provider:PROVIDER,model:MODEL}})});
  await sb(fetchImpl,cfg,token,`conversation_turns?tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&turn_id=eq.${encodeURIComponent(turnId)}`,{method:'PATCH',body:JSON.stringify({assistant_message_id:assistantMessageId,status:'COMPLETED',output:{answer,aurentara_handoff:result.output?.aurentara_handoff||null},ai_metadata:{provider:PROVIDER,model:MODEL,input_tokens:result.usage?.prompt_tokens||0,output_tokens:result.usage?.completion_tokens||0,actual_cost_eur:cost},updated_at:new Date().toISOString()})});
  await sb(fetchImpl,cfg,token,'usage_attribution',{method:'POST',body:JSON.stringify({tenant_id:workspace.tenant_id,business_id:workspace.business_id,usage_id:id('usage'),user_id:user.id,conversation_id:conversation.conversation_id,operation_id:turnId,provider_id:PROVIDER,model_id:MODEL,usage_class:'hamyren_real_ai_answer',estimated_cost_units:PER_TURN_RESERVATION_EUR,actual_cost_units:cost})});
  await sb(fetchImpl,cfg,token,`conversations?tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&conversation_id=eq.${encodeURIComponent(conversation.conversation_id)}`,{method:'PATCH',body:JSON.stringify({message_count:ordinal+1,turn_count:Number(conversation.turn_count||0)+1,last_intent:'business_advice',last_error:null,updated_at:new Date().toISOString()})});
  return json({ok:true,answer,conversation_id:conversation.conversation_id,provider:PROVIDER,model:MODEL,input_tokens:result.usage?.prompt_tokens||0,output_tokens:result.usage?.completion_tokens||0,actual_cost_eur:cost,aurentara_handoff:result.output?.aurentara_handoff||null,...trial(used+1)});
}

export function createPrivateCustomerAiAcceptanceRuntime(options={}) {
  const fetchImpl=options.fetch_impl||fetch;
  const economics=createCustomerEconomicsRuntime();
  return {
    manifest(){return {schema:'hamyren.private-customer-ai-acceptance.v2',provider:PROVIDER,model:MODEL,hard_budget_eur:10,per_turn_reservation_eur:PER_TURN_RESERVATION_EUR,no_paid_fallback:true,public_launch:false,billing:false,production_deploy:false,pricing_fx:{eur_per_usd:0.863032,as_of:'2026-09-02T22:10:00Z'}};},
    async handle(request,{env={},access_token,user}={}) {
      const cfg=config(env); if(!cfg.ok) return json({ok:false,message:'HAMYREN ist für diesen privaten Test noch nicht vollständig verbunden.'},503);
      const workspace=await resolveWorkspace(fetchImpl,cfg,access_token,user);
      if(!workspace.ok) return json({ok:false,message:'Bitte initialisiere zuerst deinen privaten HAMYREN Workspace.',bootstrap_required:true},409);
      const url=new URL(request.url), method=request.method.toUpperCase();
      if(url.pathname==='/customer/api/session'&&method==='GET') {
        const used=await countSuccessfulTurns(fetchImpl,cfg,access_token,workspace);
        return json({ok:true,session:{kind:'customer',tenant_id:workspace.tenant_id,business_id:workspace.business_id,business_name:workspace.business.name,synthetic:false,...trial(used)},workspace:{role:workspace.role,business:workspace.business}});
      }
      if(url.pathname==='/customer/api/guest-session') return json({ok:false,message:'Bitte melde dich mit deinem privaten HAMYREN Account an.'},401);
      if(url.pathname==='/customer/api/chat'&&method==='POST') return handleChat(request,env,fetchImpl,cfg,access_token,user,workspace);
      if(url.pathname==='/customer/api/memory'&&method==='GET') { const r=await sb(fetchImpl,cfg,access_token,`memory_facts?select=*&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&deleted_at=is.null&order=updated_at.desc`); return json({ok:r.ok,facts:r.ok&&Array.isArray(r.body)?r.body:[]},r.ok?200:502); }
      if(url.pathname==='/customer/api/goals'&&method==='GET') { const r=await sb(fetchImpl,cfg,access_token,`goals?select=*&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&deleted_at=is.null&order=updated_at.desc`); return json({ok:r.ok,goals:r.ok&&Array.isArray(r.body)?r.body:[]},r.ok?200:502); }
      if(url.pathname==='/customer/api/decisions'&&method==='GET') { const r=await sb(fetchImpl,cfg,access_token,`decisions?select=*&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&deleted_at=is.null&order=updated_at.desc`); return json({ok:r.ok,decisions:r.ok&&Array.isArray(r.body)?r.body:[]},r.ok?200:502); }
      if(url.pathname==='/customer/api/usage'&&method==='GET') {
        const used=await countSuccessfulTurns(fetchImpl,cfg,access_token,workspace);
        const costs=await sb(fetchImpl,cfg,access_token,`usage_attribution?select=actual_cost_units&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&business_id=eq.${encodeURIComponent(workspace.business_id)}&usage_class=eq.hamyren_real_ai_answer`);
        const variable=(costs.ok&&Array.isArray(costs.body)?costs.body:[]).reduce((sum,x)=>sum+Number(x.actual_cost_units||0),0);
        const budget=await sb(fetchImpl,cfg,access_token,`hamyren_ai_test_budgets?select=hard_limit_eur,spent_eur,reserved_eur,status&tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&limit=1`);
        const b=budget.ok&&Array.isArray(budget.body)?budget.body[0]:null;
        return json({ok:true,trial:trial(used),plan:{plan_id:'free-starter-v1',label:'Free Starter',description:'Private Acceptance',monthly_compute_units:20},usage:{spent_compute_units:used,compute_unit_budget:20,variable_cost_eur:Number(variable.toFixed(6))},test_budget:b||{hard_limit_eur:10,spent_eur:0,reserved_eur:0,status:'ACTIVE'}});
      }
      if(url.pathname==='/customer/api/plans'&&method==='GET') return json({ok:true,plans:economics.listPlans(),payment_provider_active:false,checkout_active:false});
      if(url.pathname==='/customer/api/account-handoff') return json({ok:true,status:'ACCOUNT_ACTIVE',persistent_context:true});
      if(url.pathname==='/customer/api/upgrade'&&method==='POST') return json({ok:false,message:'Upgrades sind im privaten Prelaunch sichtbar, Zahlungen aber noch nicht aktiviert.',payment_provider_active:false,checkout_active:false},409);
      return null;
    }
  };
}
