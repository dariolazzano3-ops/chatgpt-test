import { handleOperatorDashboard as handleExistingOperatorDashboard } from '../operator-project-source-intake-storage-dashboard-v1.js';
import { authorizeOperator } from '../operator-dashboard-http-v1.js';
import { handleOperatorAiMessage } from './service-v1.js';
import { resolveOperatorAiIntent } from './intent-v1.js';
import { interpretOperatorAiResult } from './result-interpreter-v1.js';
import { quickMissionCostEstimate } from '../mission-cost-preflight-v1.js';
import { operatorAiContractsManifest } from './contracts-v1.js';
import { operatorAiIntentManifest } from './intent-v1.js';
import { operatorAiProjectResolutionManifest } from './project-resolution-v1.js';
import { operatorAiContextSnapshotManifest } from './context-snapshot-v1.js';
import { operatorAiDecisionSupportManifest } from './decision-support-v1.js';
import { operatorAiExecutionBriefManifest } from './execution-brief-v1.js';
import { operatorAiPromptRendererManifest } from './prompt-renderer-v1.js';
import { operatorAiResultInterpreterManifest } from './result-interpreter-v1.js';
import { operatorAiServiceManifest } from './service-v1.js';

const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];
const clone = (value) => structuredClone(value ?? null);

function json(body, status = 200, source = null) {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-ai-v1', 'enabled');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

async function readJson(request) {
  try { return await request.clone().json(); } catch { return {}; }
}

async function probeJson(request, env, ctx, options, path) {
  try {
    const url = new URL(request.url);
    url.pathname = path.split('?')[0];
    url.search = path.includes('?') ? `?${path.split('?').slice(1).join('?')}` : '';
    const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
    const response = await handleExistingOperatorDashboard(probe, env, ctx, options);
    if (!response || !response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return null;
    return await response.clone().json();
  } catch { return null; }
}

function findHeadSignal(health = {}) {
  const candidates = [
    health?.signals?.branch_truth, health?.branch_truth, health?.system_health?.signals?.branch_truth,
    health?.authoritative?.branch_truth, health?.items?.branch_truth
  ].filter(Boolean);
  for (const item of candidates) {
    const head = item?.head_sha || item?.details?.head_sha || item?.evidence?.head_sha;
    if (/^[a-f0-9]{40}$/i.test(clean(head,80))) return { head_sha: clean(head,80), observed_at: item?.observed_at || item?.updated_at || health?.generated_at || health?.checked_at || null, status: item?.status || 'VERIFIED' };
  }
  const stack = [health];
  const seen = new Set();
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (/^[a-f0-9]{40}$/i.test(clean(value.head_sha,80)) && clean(value.source,200).toLowerCase().includes('github')) return { head_sha: clean(value.head_sha,80), observed_at: value.updated_at || value.observed_at || null, status: value.status || 'VERIFIED' };
    for (const child of Object.values(value)) if (child && typeof child === 'object') stack.push(child);
  }
  return null;
}

function projectItem(projectsBody = {}, scopeKey = '') {
  return arr(projectsBody.items || projectsBody.projects).find((item) => item.scope_key === scopeKey) || null;
}

function qualityFromDetail(detail = {}) {
  return detail?.premium_standard || detail?.workspace?.premium_standard || detail?.quality || detail?.project?.premium_standard || null;
}

function releaseFromHealth(health = {}) {
  return health?.production_readiness || health?.signals?.production_readiness || health?.release || { status: 'UNKNOWN', production_approval_required: true };
}

async function collectContext(request, env, ctx, options = {}, requestedScope = null) {
  const [projects, health, providers, costs, approvals, deliveries, actions] = await Promise.all([
    probeJson(request, env, ctx, options, '/operator/api/projects'),
    probeJson(request, env, ctx, options, '/operator/api/system-health'),
    probeJson(request, env, ctx, options, '/operator/api/provider-ecosystem'),
    probeJson(request, env, ctx, options, '/operator/api/costs'),
    probeJson(request, env, ctx, options, '/operator/api/approvals'),
    probeJson(request, env, ctx, options, '/operator/api/deliveries'),
    probeJson(request, env, ctx, options, '/operator/api/actions')
  ]);
  const items = arr(projects?.items || projects?.projects);
  const selectedScope = clean(requestedScope || projects?.selected_project_scope, 500) || null;
  const selected = selectedScope ? projectItem(projects || {}, selectedScope) : null;
  const detail = selectedScope ? await probeJson(request, env, ctx, options, `/operator/api/project-detail/${encodeURIComponent(selectedScope)}`) : null;
  const sourceIntake = selectedScope ? await probeJson(request, env, ctx, options, `/operator/api/project-source-intake?scope_key=${encodeURIComponent(selectedScope)}`) : null;
  const head = findHeadSignal(health || {});
  const runtimeRevision = projects?.revision ?? projects?.runtime_revision ?? detail?.runtime_revision ?? null;

  return {
    projects: items,
    selected_project_scope: selectedScope,
    operator_runtime_revision: Number.isInteger(Number(runtimeRevision)) ? Number(runtimeRevision) : null,
    canonical_source: {
      canonical_branch: 'factory-control',
      canonical_head: head?.head_sha || null,
      verified_at: head?.observed_at || new Date().toISOString(),
      verification_status: head?.status || 'UNKNOWN',
      source: head ? 'existing_operator_system_health_github_exact_head' : 'UNKNOWN'
    },
    project_state: detail || selected || null,
    project_context: sourceIntake || null,
    mission_state: { actions: clone(actions || null), recent_deliveries: clone(deliveries || null) },
    quality_state: qualityFromDetail(detail || {}),
    provider_state: providers || null,
    cost_state: costs || null,
    approval_state: approvals || null,
    release_state: releaseFromHealth(health || {}),
    delivery_state: deliveries || null,
    recent_evidence: [
      head ? { evidence_ref: 'github_exact_factory_control_head', source: 'github_exact_factory_control_head', status: head.status || 'VERIFIED', verified: true, observed_at: head.observed_at, head_sha: head.head_sha } : { evidence_ref: 'github_exact_factory_control_head', source: 'github_exact_factory_control_head', status: 'UNKNOWN' },
      health ? { evidence_ref: 'operator_system_health', source: 'operator_system_health', status: health.status || 'SUPPORTED', supported: true, observed_at: health.checked_at || health.generated_at || null } : null,
      sourceIntake ? { evidence_ref: 'project_source_intake', source: 'project_source_intake', status: 'SUPPORTED', supported: true, observed_at: sourceIntake.updated_at || null } : null
    ].filter(Boolean),
    unknowns: [!head ? 'CANONICAL_HEAD_NOT_AVAILABLE_FROM_RUNTIME_HEALTH' : null, !selectedScope ? 'NO_SELECTED_PROJECT' : null, !sourceIntake ? 'PROJECT_SOURCE_INTAKE_NOT_AVAILABLE' : null].filter(Boolean),
    conflicts: []
  };
}

const AI_STYLE = String.raw`<style id="aurentara-operator-ai-v1-style">
.operator-ai-shell{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(290px,.75fr);gap:14px}.operator-ai-hero{background:linear-gradient(135deg,#191b18,#30352e);color:#f7f7f4;border-radius:17px;padding:20px}.operator-ai-hero .small{color:#c9cec5}.operator-ai-compose{display:grid;gap:10px;margin-top:14px}.operator-ai-compose textarea{width:100%;min-height:110px;border:1px solid #50564d;border-radius:13px;background:#fff;color:#171915;padding:12px;resize:vertical}.operator-ai-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.operator-ai-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 10px}.operator-ai-tabs button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 10px}.operator-ai-tabs button.active{background:#1e211d;color:#fff;border-color:#1e211d}.operator-ai-view{display:none}.operator-ai-view.active{display:block}.operator-ai-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.operator-ai-next{border:1px solid #d8dfd6;background:#f3f7f1;border-radius:14px;padding:14px}.operator-ai-blocker{border-top:1px solid var(--soft);padding:10px 0}.operator-ai-blocker:first-child{border-top:0}.operator-ai-prompt{max-height:520px;overflow:auto}.operator-ai-launch-lock{border:1px solid #e7c9b8;background:#fff5ee;border-radius:13px;padding:12px}.nav .operator-ai-nav{border:1px solid #4d574b;background:#262b25;color:#fff}.operator-ai-inline-code{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}@media(max-width:900px){.operator-ai-shell{grid-template-columns:1fr}.operator-ai-grid{grid-template-columns:1fr}}
</style>`;

const AI_SCRIPT = String.raw`<script id="aurentara-operator-ai-v1-script">
(()=>{if(window.__aurentaraOperatorAiV1)return;window.__aurentaraOperatorAiV1=true;
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=v=>Array.isArray(v)?v:[];let last=null;let activeTab='CHAT';
const nav=document.querySelector('.nav');const main=document.querySelector('.main');if(!nav||!main)return;
let section=document.getElementById('operator-ai');if(!section){section=document.createElement('section');section.id='operator-ai';section.className='section';main.appendChild(section)}
const btn=document.createElement('button');btn.type='button';btn.className='operator-ai-nav';btn.textContent='Operator AI';btn.onclick=()=>open();nav.appendChild(btn);
function show(){document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));section.classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const t=document.getElementById('title');if(t)t.textContent='Operator AI'}
async function api(path,opt={}){const r=await fetch('/operator/api/operator-ai'+path,{...opt,headers:{'content-type':'application/json',...(opt.headers||{})}});const d=await r.json().catch(()=>({error:'INVALID_RESPONSE'}));if(!r.ok){const e=new Error(d.error||('HTTP '+r.status));e.data=d;throw e}return d}
function badge(v){const s=String(v||'UNKNOWN').toUpperCase();const tone=s.includes('BLOCK')||s.includes('FAIL')?'blocked':s.includes('READY')||s.includes('VERIFIED')||s.includes('FRESH')?'ready':s.includes('APPROVAL')||s.includes('STALE')?'attention':'active';return '<span class="badge '+tone+'">'+h(s)+'</span>'}
function base(){section.innerHTML='<div class="operator-ai-shell"><div><div class="operator-ai-hero"><div class="eyebrow" style="color:#bfc5bb">AURENTARA SYSTEMS · ONE CENTRAL AI</div><h2 style="font-size:24px;margin:4px 0 6px">Was möchtest du tun?</h2><div class="small">Status verstehen, nächsten Schritt finden, Masterprompt erzeugen oder sichere Execution vorbereiten. Production bleibt approval-gated.</div><div class="operator-ai-compose"><textarea id="operator-ai-input" placeholder="z. B. Wie steht Gelato gerade?"></textarea><div class="actions"><button class="btn primary" id="operator-ai-send">AN OPERATOR AI SENDEN</button><button class="btn" id="operator-ai-context">KONTEXT AKTUALISIEREN</button></div></div><div class="operator-ai-meta" id="operator-ai-meta"></div></div><div class="operator-ai-tabs" id="operator-ai-tabs">'+['CHAT','BRIEF','MASTERPROMPT','RUN','RESULT'].map(x=>'<button data-ai-tab="'+x+'">'+x+'</button>').join('')+'</div><div id="operator-ai-output" class="card"></div></div><aside class="stack"><div class="card"><h2>Safety</h2><div class="operator-ai-launch-lock"><strong>Production locked</strong><div class="small">Keine Chat-Aussage ersetzt formale Approval Records.</div></div><div class="row"><span>Aktiver Autonomie-Max</span><strong>Level 3</strong></div><div class="row"><span>Level 4</span><span>NOT ACTIVATED</span></div><div class="row"><span>Level 5</span><span>APPROVAL-GATED</span></div></div><div class="card" id="operator-ai-context-card"><h2>Project Context</h2><div class="small">Noch nicht geladen.</div></div></aside></div>';document.getElementById('operator-ai-send').onclick=send;document.getElementById('operator-ai-context').onclick=loadContext;document.querySelectorAll('[data-ai-tab]').forEach(x=>x.onclick=()=>{activeTab=x.dataset.aiTab;renderLast()});renderLast()}
function renderLast(){document.querySelectorAll('[data-ai-tab]').forEach(x=>x.classList.toggle('active',x.dataset.aiTab===activeTab));const out=document.getElementById('operator-ai-output');if(!out)return;if(!last){out.innerHTML='<div class="empty">Schreibe eine Anweisung. Statusfragen bleiben garantiert read-only.</div>';return}const b=last.execution_brief;const prompt=last.masterprompt||'';const blockers=rows(last.blockers);if(activeTab==='CHAT'){out.innerHTML='<div class="eyebrow">SUMMARY</div><h2>'+h(last.summary)+'</h2><div class="operator-ai-next"><b>NEXT ACTION</b><div>'+h(last.next_action?.message||'Keine weitere Aktion ermittelt.')+'</div></div><h3>WHY</h3><div class="small">'+h(last.why||'–')+'</div><h3>BLOCKERS</h3>'+(blockers.length?blockers.map(x=>'<div class="operator-ai-blocker"><b>'+h(x.code)+'</b><div class="small">'+h(x.message||x.classification)+'</div></div>').join(''):'<div class="small">Keine priorisierten Blocker.</div>')}else if(activeTab==='BRIEF'){out.innerHTML=b?'<h2>Execution Brief</h2><pre>'+h(JSON.stringify(b,null,2))+'</pre>':'<div class="empty">Für diese Read-only-Antwort wurde kein Execution Brief benötigt.</div>'}else if(activeTab==='MASTERPROMPT'){out.innerHTML=prompt?'<h2>Masterprompt</h2><pre class="operator-ai-prompt">'+h(prompt)+'</pre>':'<div class="empty">Kein Masterprompt für diese Anfrage.</div>'}else if(activeTab==='RUN'){const e=last.execution||{};out.innerHTML='<h2>Run State</h2><div class="operator-ai-grid"><div class="kv"><b>Execution requested</b><span>'+h(String(e.requested))+'</span></div><div class="kv"><b>Requested autonomy</b><span>'+h(e.requested_autonomy)+'</span></div><div class="kv"><b>Actual autonomy</b><span>'+h(e.actual_autonomy)+'</span></div><div class="kv"><b>Started</b><span>'+h(String(e.started))+'</span></div></div><div class="callout warn" style="margin-top:12px"><b>'+h(e.safe_internal_execution_status||'NOT_ACTIVATED')+'</b><div class="small">V1 bereitet bis Level 3 vor. Keine ungesicherte interne oder externe Wirkung.</div></div>'}else{out.innerHTML='<h2>Result</h2><div class="empty">Result Interpretation wird nach einem bestehenden Runtime-Run angezeigt. In V1 startet diese Oberfläche selbst keine Level-4/5-Execution.</div>'}}
function renderContext(d){const card=document.getElementById('operator-ai-context-card');if(!card)return;const p=d?.project_state?.project||d?.project_state||{};card.innerHTML='<h2>Project Context</h2><div class="row"><span>Project</span><strong>'+h(p.name||p.project_name||d.project_ref||'Nicht ausgewählt')+'</strong></div><div class="row"><span>Canonical</span><span class="operator-ai-inline-code">'+h(d?.canonical_source?.canonical_head||'UNKNOWN')+'</span></div><div class="row"><span>Freshness</span>'+badge(d?.freshness?.canonical)+'</div><div class="row"><span>Unknowns</span><strong>'+rows(d?.unknowns).length+'</strong></div>'}
async function loadContext(){try{const d=await api('/context');renderContext(d.context_snapshot||d)}catch(e){const out=document.getElementById('operator-ai-output');if(out)out.innerHTML='<div class="error">'+h(e.message)+'</div>'}}
async function send(){const input=document.getElementById('operator-ai-input');const message=input?.value.trim();if(!message)return;const out=document.getElementById('operator-ai-output');if(out)out.innerHTML='<div class="empty">Operator AI wertet den verifizierten Kontext aus…</div>';try{last=await api('/message',{method:'POST',body:JSON.stringify({message})});const meta=document.getElementById('operator-ai-meta');if(meta)meta.innerHTML=badge(last.intent?.intent)+' '+badge('LEVEL '+last.execution?.actual_autonomy)+' '+badge(last.execution?.started?'STARTED':'NOT STARTED');renderContext(last.context_snapshot);activeTab='CHAT';renderLast()}catch(e){if(out)out.innerHTML='<div class="error">'+h(e.message)+'</div>'}}
function open(){show();if(!document.getElementById('operator-ai-input'))base();void loadContext()}
window.aurentaraOpenOperatorAiV1=open;
})();
</script>`;

function injectOperatorAiUi(source = '') {
  if (source.includes('aurentara-operator-ai-v1-script')) return source;
  const injection = `${AI_STYLE}${AI_SCRIPT}`;
  return source.includes('</body>') ? source.replace('</body>', `${injection}</body>`) : `${source}${injection}`;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  const isAiApi = url.pathname === '/operator/api/operator-ai/context' || url.pathname === '/operator/api/operator-ai/message' || url.pathname === '/operator/api/operator-ai/manifest' || url.pathname === '/operator/api/operator-ai/results/interpret';

  if (isAiApi) {
    const auth = await authorizeOperator(request, env, ctx, options);
    if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);

    if (request.method === 'GET' && url.pathname === '/operator/api/operator-ai/manifest') {
      return json({
        schema: 'aurentara.operator-ai.bundle.v1',
        contracts: operatorAiContractsManifest(), intent: operatorAiIntentManifest(), project_resolution: operatorAiProjectResolutionManifest(),
        context: operatorAiContextSnapshotManifest(), decision_support: operatorAiDecisionSupportManifest(), execution_brief: operatorAiExecutionBriefManifest(),
        prompt_renderer: operatorAiPromptRendererManifest(), result_interpreter: operatorAiResultInterpreterManifest(), service: operatorAiServiceManifest(),
        dashboard_integrated: true, safe_internal_execution_status: 'NOT_ACTIVATED', active_autonomy_levels: [0,1,2,3], production_deploy: false, external_writes: false
      });
    }

    if (request.method === 'POST' && url.pathname === '/operator/api/operator-ai/results/interpret') {
      const body = await readJson(request);
      return json(interpretOperatorAiResult(body));
    }

    if (request.method === 'GET' && url.pathname === '/operator/api/operator-ai/context') {
      const scopeKey = clean(url.searchParams.get('scope_key'), 500) || null;
      const context = await collectContext(request, env, ctx, options, scopeKey);
      const selected = context.selected_project_scope ? context.projects.find((p) => p.scope_key === context.selected_project_scope) : null;
      const syntheticMessage = selected ? `Wie steht ${selected.name || selected.project_id}?` : 'Wie steht das ausgewählte Projekt?';
      const result = handleOperatorAiMessage({ message: syntheticMessage }, context, { safe_internal_execution_active: false });
      return json({ schema: 'aurentara.operator-ai.context-response.v1', context_snapshot: result.context_snapshot || null, project_resolution: result.project_resolution || null, production_deploy: false });
    }

    if (request.method === 'POST' && url.pathname === '/operator/api/operator-ai/message') {
      const body = await readJson(request);
      const message = clean(body.message || body.text, 6000);
      if (!message) return json({ error: 'OPERATOR_AI_MESSAGE_REQUIRED', production_deploy: false }, 400);
      const context = await collectContext(request, env, ctx, options, clean(body.project_scope || body.scope_key, 500) || null);
      const resolvedIntent = resolveOperatorAiIntent({ message });
      if (resolvedIntent.ok && resolvedIntent.requested_autonomy >= 3) {
        const quick = quickMissionCostEstimate({
          route: 'BALANCED',
          mission_text: message,
          selected_capabilities: [],
          mission_type: 'GENERAL',
          external_dependencies_unknown: true
        });
        const selected = quick?.routes?.balanced || quick?.routes?.BALANCED || quick;
        context.cost_state = {
          ...clone(context.cost_state || {}),
          schema: quick?.schema || 'aurentara.mission-cost-preflight.v1',
          route: 'BALANCED',
          estimated_min: selected?.low_estimate_eur ?? null,
          estimated_max: selected?.high_estimate_eur ?? null,
          low_estimate_eur: selected?.low_estimate_eur ?? null,
          high_estimate_eur: selected?.high_estimate_eur ?? null,
          confidence: selected?.confidence || quick?.confidence || 'UNKNOWN',
          cost_ceiling: selected?.recommended_cost_ceiling_eur ?? 0,
          approval_required: false,
          paid_provider_calls_expected: 0,
          preflight_status: quick?.ok === false ? 'BLOCKED' : 'PREPARED',
          preflight_ref: `operator-ai-inline:${Date.now()}`
        };
        context.cost_preflight_ref = context.cost_state.preflight_ref;
      }
      const result = handleOperatorAiMessage({ message, conversation_project_scope: clean(body.conversation_project_scope,500) || null }, context, { safe_internal_execution_active: false });
      return json(result, result.ok === false ? 409 : 200);
    }

    return json({ error: 'OPERATOR_AI_ROUTE_NOT_FOUND', production_deploy: false }, 404);
  }

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-operator-ai-v1', 'enabled');
  return new Response(injectOperatorAiUi(source), { status: response.status, statusText: response.statusText, headers });
}

export function operatorAiDashboardManifest() {
  return {
    schema: 'aurentara.operator-ai.dashboard.v1',
    existing_dashboard_extended: true,
    routes: ['GET /operator/api/operator-ai/context','POST /operator/api/operator-ai/message','POST /operator/api/operator-ai/results/interpret','GET /operator/api/operator-ai/manifest'],
    views: ['CHAT','BRIEF','MASTERPROMPT','RUN','RESULT'],
    central_input: true,
    project_context_visible: true,
    cost_risk_evidence_visible: true,
    safe_internal_execution_status: 'NOT_ACTIVATED',
    active_autonomy_levels: [0,1,2,3],
    new_database: false,
    production_deploy: false,
    external_writes: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  };
}
