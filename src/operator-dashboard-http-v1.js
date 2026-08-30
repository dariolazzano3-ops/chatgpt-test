import {
  compileUniversalMission,
  analyzeMissionBusiness,
  selectMissionCapabilities,
  buildCapabilityDependencyPlan,
  missionCostApprovalPreflight
} from './universal-mission-run.js';
import { createOperatorRuntime } from './operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from './operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from './operator-runtime-api-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const runtimeServices = new Map();
const pendingPlans = new Map();

export const OPERATOR_STATUS_MAP = Object.freeze({
  DRAFT: ['Draft', 'neutral'],
  COMPILING: ['Mission wird verstanden', 'active'],
  PLAN_READY: ['Plan bereit', 'ready'],
  APPROVAL_REQUIRED: ['Freigabe erforderlich', 'attention'],
  READY: ['Bereit', 'ready'],
  RUNNING: ['Läuft', 'active'],
  ACTIVE: ['Aktiv', 'active'],
  BLOCKED: ['Blockiert', 'blocked'],
  RETRYING: ['Wiederholung', 'attention'],
  QUALITY_REVIEW: ['Qualitätsprüfung', 'active'],
  DELIVERY_READY: ['Delivery bereit', 'ready'],
  SIMULATED_HANDOFF_READY: ['Synthetische Delivery bereit', 'ready'],
  SYNTHETIC_STAGING_COMPLETED: ['Synthetisches Staging abgeschlossen', 'ready'],
  COMPLETED: ['Abgeschlossen', 'ready'],
  READY_FOR_SUPERVISED_SYNTHETIC_STAGING: ['Für kontrolliertes Staging bereit', 'ready'],
  LIVE_STAGING_VERIFIED: ['Staging verifiziert', 'ready'],
  STRATEGY_ENGINE_READY: ['Strategie bereit', 'ready'],
  OPERATOR_ATTENTION_REQUIRED: ['Aufmerksamkeit erforderlich', 'attention'],
  LIVE_STAGING_CONTROL_READY: ['Staging Control bereit', 'ready'],
  CONTROL_PLANE_READY: ['Control Plane bereit', 'ready'],
  FAILED: ['Fehlgeschlagen', 'blocked'],
  CANCELLED: ['Abgebrochen', 'neutral'],
  NOT_READY: ['Nicht bereit', 'neutral'],
  NOT_VERIFIED: ['Nicht verifiziert', 'neutral'],
  UNKNOWN: ['Unbekannt', 'neutral'],
  LOCKED: ['Gesperrt', 'blocked'],
  DISABLED: ['Deaktiviert', 'neutral']
});

export function operatorDashboardStatusMeta(status) {
  const raw = clean(status, 120).toUpperCase() || 'UNKNOWN';
  const [label, tone] = OPERATOR_STATUS_MAP[raw] || [raw.replaceAll('_', ' '), 'neutral'];
  return { raw, label, tone };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    }
  });
}

async function readBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) return {};
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return {};
  try { return await request.json(); } catch { return {}; }
}

function seededPortfolio(operatorId) {
  return {
    operator_id: operatorId,
    projects: [
      {
        customer_id: 'synthetic-customer-bakery',
        project_id: 'bakery-muller:universal-regression-v1',
        scope_key: 'synthetic-customer-bakery:bakery-muller:universal-regression-v1',
        name: 'Bäckerei Müller', industry: 'bakery', country: 'DE', language: 'de',
        state: 'READY', blocked: false, priority: 10, budget_cost_units: 0,
        capability_count: 5, mission_count: 0, delivery_count: 1, production_deploy: false
      },
      {
        customer_id: 'synthetic-customer-craft',
        project_id: 'handwerk-modernisierung:universal-v1',
        scope_key: 'synthetic-customer-craft:handwerk-modernisierung:universal-v1',
        name: 'Muster Handwerksbetrieb', industry: 'handwerk', country: 'DE', language: 'de',
        state: 'ACTIVE', blocked: false, priority: 20, budget_cost_units: 0,
        capability_count: 5, mission_count: 0, delivery_count: 0, production_deploy: false
      },
      {
        customer_id: 'synthetic-customer-service',
        project_id: 'service-studio:operator-v1',
        scope_key: 'synthetic-customer-service:service-studio:operator-v1',
        name: 'Synthetic Service Studio', industry: 'professional-services', country: 'DE', language: 'de',
        state: 'READY', blocked: false, priority: 30, budget_cost_units: 0,
        capability_count: 3, mission_count: 0, delivery_count: 0, production_deploy: false
      }
    ],
    production_deploy: false
  };
}

function createInitialRuntime(operatorId) {
  const created = createOperatorRuntime({ operator_id: operatorId, portfolio: seededPortfolio(operatorId), at: new Date().toISOString() });
  if (!created.ok) throw new Error(created.error || 'OPERATOR_RUNTIME_INIT_FAILED');
  return created.runtime;
}

function getRuntimeService(operatorId, options = {}) {
  if (options.runtime_service) return options.runtime_service;
  if (!runtimeServices.has(operatorId)) {
    const initial = createInitialRuntime(operatorId);
    const store = createMemoryOperatorRuntimeStore([initial]);
    runtimeServices.set(operatorId, createOperatorRuntimeApiService({ operator_id: operatorId, store }));
  }
  return runtimeServices.get(operatorId);
}

export async function authorizeOperator(request, env = {}, ctx = {}, options = {}) {
  if (typeof options.authorize === 'function') return options.authorize(request, env, ctx);
  const expectedEmail = clean(env.RIOSYSTEMS_OPERATOR_EMAIL, 320).toLowerCase();
  const expectedAud = clean(env.RIOSYSTEMS_ACCESS_AUD, 320);
  if (!expectedEmail || !expectedAud) return { ok: false, status: 503, error: 'OPERATOR_ACCESS_NOT_CONFIGURED' };
  if (!ctx?.access || typeof ctx.access.getIdentity !== 'function') return { ok: false, status: 401, error: 'CLOUDFLARE_ACCESS_REQUIRED' };
  if (clean(ctx.access.aud, 320) !== expectedAud) return { ok: false, status: 403, error: 'CLOUDFLARE_ACCESS_AUDIENCE_MISMATCH' };
  let identity = null;
  try { identity = await ctx.access.getIdentity(); } catch { return { ok: false, status: 401, error: 'CLOUDFLARE_ACCESS_IDENTITY_FAILED' }; }
  const email = clean(identity?.email, 320).toLowerCase();
  if (!email || email !== expectedEmail) return { ok: false, status: 403, error: 'OPERATOR_IDENTITY_NOT_ALLOWED' };
  return { ok: true, operator_id: `operator:${email}`, email };
}

function safeMissionInput(body, project) {
  return {
    customer_id: project.customer_id,
    project_id: project.project_id,
    business_name: project.name,
    industry: clean(body.industry, 160) || project.industry || 'unknown',
    country: clean(body.country, 80) || project.country || 'DE',
    language: clean(body.language, 40) || project.language || 'de',
    mission_text: clean(body.mission_text, 4000),
    business_goals: Array.isArray(body.business_goals) ? body.business_goals.map((v) => clean(v, 300)).filter(Boolean) : [],
    known_constraints: Array.isArray(body.known_constraints) ? body.known_constraints.map((v) => clean(v, 300)).filter(Boolean) : [],
    existing_systems: Array.isArray(body.existing_systems) ? body.existing_systems.map((v) => clean(v, 160)).filter(Boolean) : [],
    requested_outcomes: Array.isArray(body.requested_outcomes) ? body.requested_outcomes.map((v) => clean(v, 300)).filter(Boolean) : [],
    budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
    approval_policy: { external_writes_require_approval: true, production_requires_explicit_approval: true },
    data_policy: { synthetic_only: true, real_customer_data: false },
    environment: 'staging',
    production_authorized: false
  };
}

function buildPlanReview(safeInput) {
  const compiled = compileUniversalMission(safeInput);
  if (!compiled.ok) return compiled;
  const analysis = analyzeMissionBusiness(compiled.mission);
  const selection = selectMissionCapabilities(compiled.mission, analysis);
  const plan = buildCapabilityDependencyPlan(compiled.mission, selection);
  const preflight = missionCostApprovalPreflight(compiled.mission, plan);
  return { ok: preflight.ok, mission: compiled.mission, analysis, plan, preflight };
}

function pendingForOperator(operatorId) {
  return [...pendingPlans.values()].filter((item) => item.operator_id === operatorId).map((item) => ({
    plan_token: item.plan_token,
    scope_key: item.scope_key,
    mission_id: item.review.mission.mission_id,
    business_name: item.review.mission.business_name,
    mission_text: item.review.mission.mission_text,
    estimated_variable_cost_eur: item.review.preflight.estimated_variable_cost_eur,
    risk: 'SYNTHETIC_STAGING_ONLY',
    status: 'APPROVAL_REQUIRED',
    created_at: item.created_at,
    expires_at: item.expires_at,
    production_deploy: false
  }));
}

function purgeExpiredPlans() {
  const now = Date.now();
  for (const [key, value] of pendingPlans.entries()) if (value.expires_at_ms <= now) pendingPlans.delete(key);
}

async function customApi(service, operatorId, path, request, body) {
  const snapshotResponse = await service.handle({ method: 'GET', path: '/snapshot' });
  if (!snapshotResponse.ok) return { status: snapshotResponse.status || 500, body: snapshotResponse.body };
  const snapshot = snapshotResponse.body;
  const runtime = snapshotResponse.runtime;

  if (path === '/providers' && request.method === 'GET') return { status: 200, body: snapshot.control_plane.providers };
  if (path === '/costs' && request.method === 'GET') return { status: 200, body: {
    schema: 'riosystems.operator-cost-center.v1',
    spent_eur: Number(snapshot.control_plane.cost.live_proof_variable_cost_eur || 0) + Number(snapshot.universal_missions.variable_cost_eur || 0),
    reserved_eur: 0, estimated_eur: 0,
    remaining_development_budget_eur: snapshot.control_plane.cost.development_ceiling_eur,
    development_ceiling_eur: snapshot.control_plane.cost.development_ceiling_eur,
    variable_cost_state: snapshot.universal_missions.variable_cost_eur === 0 ? 'ESTIMATED_ZERO' : 'PAID_APPROVAL_REQUIRED',
    automatic_paid_overflow: false, paid_execution_authorized: false, production_deploy: false
  }};
  if (path === '/audit' && request.method === 'GET') return { status: 200, body: {
    schema: 'riosystems.operator-audit-view.v1',
    items: [...(runtime.command_center_state?.audit || []), ...(runtime.audit || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))),
    production_deploy: false
  }};
  if (path === '/settings' && request.method === 'GET') return { status: 200, body: {
    schema: 'riosystems.operator-settings-view.v1', default_environment: 'staging', data_mode: 'synthetic_only',
    mission_variable_budget_ceiling_eur: 0, automatic_paid_overflow: false, production_policy: 'LOCKED',
    approval_policy: 'EXPLICIT_SERVER_SIDE', provider_fallback: 'BOUNDED_ZERO_COST_ONLY', runtime_store: 'MEMORY_REFERENCE_ADAPTER',
    persistence_note: 'Runtime state is not yet durable across Worker isolate restarts.', production_deploy: false
  }};
  if (path === '/system-health' && request.method === 'GET') return { status: 200, body: {
    schema: 'riosystems.operator-system-health.v1',
    control_plane: operatorDashboardStatusMeta(snapshot.control_plane.readiness.status),
    factory_control_api: { raw: 'VERIFIED_HEALTHY', label: 'Operator Runtime API verified', tone: 'ready' },
    factories: (snapshot.control_plane.factories.items || []).map((item) => ({ ...item, ui_status: operatorDashboardStatusMeta(item.status) })),
    providers: snapshot.control_plane.providers,
    ci: { raw: 'NOT_VERIFIED', label: 'CI status is repository evidence, not polled by this runtime', tone: 'neutral' },
    production: { raw: 'DISABLED', label: 'Production disabled', tone: 'neutral' }, production_deploy: false
  }};
  if (path === '/approvals' && request.method === 'GET') {
    purgeExpiredPlans();
    const core = await service.handle({ method: 'GET', path: '/approvals' });
    return { status: 200, body: { schema: 'riosystems.operator-approval-center.v1', core: core.body, mission_plans: pendingForOperator(operatorId), production_deploy: false } };
  }
  if (path === '/mission-preflight' && request.method === 'POST') {
    const scopeKey = clean(body.scope_key, 300) || runtime.selected_project_scope;
    const project = (runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey);
    if (!project) return { status: 404, body: { error: 'MISSION_PROJECT_SCOPE_REQUIRED', production_deploy: false } };
    const input = safeMissionInput(body, project);
    if (!input.mission_text) return { status: 400, body: { error: 'MISSION_TEXT_REQUIRED', production_deploy: false } };
    const review = buildPlanReview(input);
    if (!review.ok) return { status: 400, body: review };
    const planToken = `plan:${review.mission.mission_id}:r${runtime.revision}`;
    const createdAt = new Date().toISOString();
    const expiresAtMs = Date.now() + 30 * 60 * 1000;
    pendingPlans.set(planToken, { plan_token: planToken, operator_id: operatorId, scope_key: scopeKey, expected_revision: runtime.revision, input, review, created_at: createdAt, expires_at_ms: expiresAtMs, expires_at: new Date(expiresAtMs).toISOString() });
    return { status: 201, body: { schema: 'riosystems.operator-plan-review.v1', status: 'APPROVAL_REQUIRED', plan_token: planToken, runtime_revision: runtime.revision, ...clone(review), execution_started: false, production_deploy: false } };
  }
  if (path === '/mission-approve' && request.method === 'POST') {
    purgeExpiredPlans();
    const planToken = clean(body.plan_token, 300);
    const pending = pendingPlans.get(planToken);
    if (!pending || pending.operator_id !== operatorId) return { status: 404, body: { error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false } };
    if (runtime.revision !== pending.expected_revision) {
      pendingPlans.delete(planToken);
      return { status: 409, body: { error: 'PLAN_RUNTIME_REVISION_CONFLICT', expected_revision: pending.expected_revision, actual_revision: runtime.revision, production_deploy: false } };
    }
    const executed = await service.handle({ method: 'POST', path: '/universal-missions', body: { ...pending.input, expected_revision: pending.expected_revision } });
    if (executed.ok) pendingPlans.delete(planToken);
    return { status: executed.status, body: { ...executed.body, approved_plan_token: planToken, production_deploy: false } };
  }
  return null;
}

function shell() {
  const statusMapJson = JSON.stringify(OPERATOR_STATUS_MAP).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIOSYSTEMS Operator Control Plane</title>
<style>
:root{color-scheme:light;--bg:#f4f3ef;--panel:#fff;--ink:#171815;--muted:#6b6e66;--line:#dedfd8;--soft:#eeefe9;--ready:#235b3a;--active:#244d72;--attention:#775b19;--blocked:#7a2f2f;--radius:18px;--shadow:0 10px 28px rgba(24,28,22,.06)}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,textarea,select{font:inherit}button{cursor:pointer}.app{min-height:100vh;display:grid;grid-template-columns:246px 1fr}.side{position:sticky;top:0;height:100vh;padding:22px 16px;background:#191b18;color:#f7f7f3;display:flex;flex-direction:column}.brand{padding:8px 10px 22px}.brand strong{display:block;letter-spacing:.13em;font-size:13px}.brand span{color:#aeb2a9;font-size:12px}.nav{display:grid;gap:5px}.nav button{border:0;background:transparent;color:#cdd0c8;text-align:left;padding:10px 12px;border-radius:11px}.nav button:hover,.nav button:focus-visible,.nav button.active{background:#2a2d28;color:#fff;outline:none}.side-foot{margin-top:auto;border-top:1px solid #363a34;padding:16px 10px 0;color:#aeb2a9;font-size:12px}.main{padding:30px;min-width:0}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}h1{font-size:30px;line-height:1.12;margin:4px 0 7px;letter-spacing:-.03em}.subtitle{color:var(--muted);max-width:760px}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);border-radius:11px;padding:9px 13px;background:var(--panel);color:var(--ink)}.btn.primary{background:#1d201c;color:#fff;border-color:#1d201c}.btn:focus-visible{outline:3px solid #9bb4cc;outline-offset:2px}.grid{display:grid;gap:14px}.metrics{grid-template-columns:repeat(5,minmax(130px,1fr));margin-bottom:14px}.metric,.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}.metric{padding:17px}.metric .v{font-size:26px;font-weight:700;letter-spacing:-.03em}.metric .k{color:var(--muted);font-size:12px;margin-top:3px}.cols{grid-template-columns:minmax(0,1.6fr) minmax(280px,.8fr)}.card{padding:19px}.card h2{font-size:16px;margin:0 0 14px}.stack{display:grid;gap:10px}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--soft);padding:11px 0}.row:first-child{border-top:0}.row-main{min-width:0}.row-main strong{display:block}.small{font-size:12px;color:var(--muted)}.badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:700;background:var(--soft);white-space:nowrap}.badge:before{content:"";width:7px;height:7px;border-radius:50%;background:#777}.badge.ready{color:var(--ready);background:#edf5ef}.badge.ready:before{background:var(--ready)}.badge.active{color:var(--active);background:#edf3f8}.badge.active:before{background:var(--active)}.badge.attention{color:var(--attention);background:#faf4e5}.badge.attention:before{background:var(--attention)}.badge.blocked{color:var(--blocked);background:#faeeee}.badge.blocked:before{background:var(--blocked)}.section{display:none}.section.active{display:block}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--soft);vertical-align:top}.table th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}.field label{font-size:12px;color:var(--muted);font-weight:600}.field input,.field textarea,.field select{width:100%;border:1px solid var(--line);border-radius:11px;background:#fff;padding:10px 11px;color:var(--ink)}.field textarea{min-height:116px;resize:vertical}.locked{background:#f7f7f3!important;color:#75786f!important}.review{margin-top:16px}.plan-task{padding:12px;border:1px solid var(--line);border-radius:13px;background:#fbfbf8}.callout{border-radius:14px;padding:13px 14px;background:#f0f2ed;border:1px solid var(--line);margin-bottom:13px}.callout.warn{background:#faf4e5}.callout.good{background:#edf5ef}.timeline{display:grid;gap:0}.timeline .step{display:grid;grid-template-columns:18px 1fr;gap:10px;padding:0 0 15px}.timeline .step:before{content:"";width:10px;height:10px;border-radius:50%;margin-top:5px;background:#4a5f50;box-shadow:0 0 0 4px #e6eee8}.empty{padding:24px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px}.error{background:#faeeee;border:1px solid #eccaca;color:#702828;padding:12px 14px;border-radius:12px;margin-bottom:14px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.details{margin-top:8px}.details summary{cursor:pointer;color:var(--muted)}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f3;padding:12px;border-radius:12px;font-size:11px}.loading{opacity:.55;pointer-events:none}@media(max-width:1050px){.metrics{grid-template-columns:repeat(3,1fr)}.cols{grid-template-columns:1fr}.app{grid-template-columns:210px 1fr}}@media(max-width:760px){.app{display:block}.side{position:static;height:auto}.nav{grid-template-columns:repeat(2,1fr)}.side-foot{display:none}.main{padding:18px}.top{display:block}.actions{margin-top:14px}.metrics{grid-template-columns:repeat(2,1fr)}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}}
</style></head><body><div class="app"><aside class="side"><div class="brand"><strong>RIOSYSTEMS</strong><span>Private Operator Control Plane</span></div><nav class="nav" aria-label="Hauptnavigation"></nav><div class="side-foot">Single Operator V1<br>Production: locked</div></aside><main class="main"><div id="error" aria-live="polite"></div><div class="top"><div><div class="eyebrow">Factory Control</div><h1 id="title">HQ</h1><div class="subtitle">Der private Leitstand für Missionen, Factories, Provider, Kosten, Freigaben und Deliveries.</div></div><div class="actions"><button class="btn" id="refresh">Aktualisieren</button><button class="btn primary" data-goto="mission">Neue Mission</button></div></div><section id="hq" class="section active"></section><section id="projects" class="section"></section><section id="mission" class="section"></section><section id="approvals" class="section"></section><section id="factories" class="section"></section><section id="providers" class="section"></section><section id="costs" class="section"></section><section id="deliveries" class="section"></section><section id="health" class="section"></section><section id="audit" class="section"></section><section id="settings" class="section"></section></main></div>
<script>
const STATUS_MAP=${statusMapJson};const NAV=[['hq','HQ'],['projects','Projects'],['mission','Mission Studio'],['approvals','Approvals'],['factories','Factories'],['providers','Providers'],['costs','Costs'],['deliveries','Deliveries'],['health','System Health'],['audit','Audit Log'],['settings','Settings']];const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const fmtMoney=(v)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));const fmtDate=(v)=>v?new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'–';function status(raw){const key=String(raw||'UNKNOWN').toUpperCase();const item=STATUS_MAP[key]||[key.replaceAll('_',' '),'neutral'];return {raw:key,label:item[0],tone:item[1]}}function badge(raw){const s=status(raw);return '<span class="badge '+esc(s.tone)+'">'+esc(s.label)+'</span>'}async function api(path,opt={}){const res=await fetch('/operator/api'+path,{...opt,headers:{'content-type':'application/json',...(opt.headers||{})}});const data=await res.json().catch(()=>({error:'INVALID_RESPONSE'}));if(!res.ok){const e=new Error(data.error||('HTTP '+res.status));e.data=data;throw e}return data}const state={data:{},section:'hq',selectedScope:null,plan:null,lastMissionId:null};const nav=$('.nav');NAV.forEach(([id,label])=>{const b=document.createElement('button');b.textContent=label;b.dataset.goto=id;b.className=id==='hq'?'active':'';nav.appendChild(b)});function go(id){state.section=id;$$('.section').forEach(x=>x.classList.toggle('active',x.id===id));$$('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.goto===id));const item=NAV.find(x=>x[0]===id);$('#title').textContent=item?item[1]:'RIOSYSTEMS';render(id)}document.addEventListener('click',e=>{const t=e.target.closest('[data-goto]');if(t)go(t.dataset.goto)});$('#refresh').onclick=()=>loadAll();function setError(e){$('#error').innerHTML=e?'<div class="error"><strong>Aktion nicht ausgeführt.</strong><div>'+esc(e.message||e)+'</div></div>':''}async function loadAll(){document.body.classList.add('loading');setError(null);try{const [dashboard,projects,missions,deliveries,factories,providers,costs,approvals,health,audit,settings,actions]=await Promise.all([api('/dashboard'),api('/projects'),api('/missions'),api('/deliveries'),api('/factories'),api('/providers'),api('/costs'),api('/approvals'),api('/system-health'),api('/audit'),api('/settings'),api('/actions')]);state.data={dashboard,projects,missions,deliveries,factories,providers,costs,approvals,health,audit,settings,actions};state.selectedScope=projects.selected_project_scope||state.selectedScope||projects.items?.[0]?.scope_key||null;render(state.section)}catch(e){setError(e)}finally{document.body.classList.remove('loading')}}function metrics(){const d=state.data.dashboard||{};const c=state.data.costs||{};const m=d.metrics||{};return [['Aktive Projekte',m.projects||0],['Laufende Runs',m.execution_runs||0],['Offene Freigaben',(state.data.approvals?.core?.pending_count||0)+(state.data.approvals?.mission_plans?.length||0)],['Blocker',m.blocked_projects||0],['Variable Kosten',fmtMoney(c.spent_eur||0)]]}
function renderHQ(){const d=state.data.dashboard||{};const projects=state.data.projects?.items||[];const deliveries=[...(state.data.deliveries?.universal_missions||[]),...(state.data.deliveries?.live_proofs||[])];$('#hq').innerHTML='<div class="grid metrics">'+metrics().map(([k,v])=>'<div class="metric"><div class="v">'+esc(v)+'</div><div class="k">'+esc(k)+'</div></div>').join('')+'</div><div class="grid cols"><div class="card"><h2>Projects</h2><div class="stack">'+projects.slice(0,6).map(p=>'<div class="row"><div class="row-main"><strong>'+esc(p.name||p.project_id)+'</strong><span class="small">'+esc(p.scope_key||'')+'</span></div>'+badge(p.state)+'</div>').join('')+'</div></div><div class="stack"><div class="card"><h2>System</h2><div class="row"><div><strong>'+esc(d.hero?.label||'Control Plane')+'</strong><span class="small">'+esc(d.hero?.subtitle||'')+'</span></div>'+badge(d.hero?.code)+'</div><div class="row"><span>Production</span>'+badge('LOCKED')+'</div><div class="row"><span>Customer data</span><span class="badge neutral">Synthetic only</span></div></div><div class="card"><h2>Letzte Deliveries</h2>'+(deliveries.length?deliveries.slice(-4).reverse().map(x=>'<div class="row"><div class="row-main"><strong>'+esc(x.business_name||x.project_scope||x.mission_id||x.proof_id||'Delivery')+'</strong><span class="small">'+esc(x.status||x.final_delivery_status||'')+'</span></div>'+badge(x.status||x.final_delivery_status)+'</div>').join(''):'<div class="empty">Noch keine synthetische Mission-Delivery in dieser Runtime.</div>')+'</div></div></div>'}
function renderProjects(){const items=state.data.projects?.items||[];$('#projects').innerHTML='<div class="card"><h2>Projektportfolio</h2><div class="table-wrap"><table class="table"><thead><tr><th>Projekt</th><th>Status</th><th>Priorität</th><th>Kosten</th><th>Scope</th><th></th></tr></thead><tbody>'+items.map(p=>'<tr><td><strong>'+esc(p.name||p.project_id)+'</strong><div class="small">'+esc(p.customer_id||'')+'</div></td><td>'+badge(p.state)+'</td><td>'+esc(p.priority??'–')+'</td><td>'+fmtMoney(p.budget_cost_units||0)+'</td><td class="mono">'+esc(p.scope_key)+'</td><td><button class="btn select-project" data-scope="'+esc(p.scope_key)+'">Auswählen</button></td></tr>').join('')+'</tbody></table></div></div>';$$('.select-project',$('#projects')).forEach(b=>b.onclick=async()=>{try{const snap=await api('/snapshot');await api('/projects/'+encodeURIComponent(b.dataset.scope)+'/select',{method:'POST',body:JSON.stringify({expected_revision:snap.runtime.revision})});state.selectedScope=b.dataset.scope;await loadAll()}catch(e){setError(e)}})}
function missionForm(){const projects=state.data.projects?.items||[];return '<div class="grid cols"><div class="card"><h2>Neue Mission</h2><form id="mission-form" class="form-grid"><div class="field full"><label>Projekt</label><select name="scope_key" required>'+projects.map(p=>'<option value="'+esc(p.scope_key)+'" '+(p.scope_key===state.selectedScope?'selected':'')+'>'+esc(p.name||p.project_id)+'</option>').join('')+'</select></div><div class="field"><label>Branche</label><input name="industry" placeholder="z. B. handwerk"></div><div class="field"><label>Land</label><input name="country" value="DE"></div><div class="field"><label>Sprache</label><input name="language" value="de"></div><div class="field"><label>Budgetgrenze</label><input class="locked" value="0 € variable Kosten" disabled></div><div class="field full"><label>Mission</label><textarea name="mission_text" required placeholder="Beschreibe das Unternehmensziel in natürlicher Sprache."></textarea></div><div class="field"><label>Gewünschte Ergebnisse, kommagetrennt</label><input name="requested_outcomes" placeholder="Website, CRM, Follow-up, Analytics"></div><div class="field"><label>Einschränkungen, kommagetrennt</label><input name="known_constraints" value="nur synthetische Daten, keine Production"></div><div class="field"><label>Environment</label><input class="locked" value="staging" disabled></div><div class="field"><label>Datenmodus</label><input class="locked" value="synthetic_only" disabled></div><div class="field full"><button class="btn primary" type="submit">Mission verstehen & Plan prüfen</button></div></form></div><div class="card"><h2>Sicherheitsrahmen</h2><div class="callout good"><strong>V1 Safe Defaults</strong><div class="small">Staging · synthetische Daten · 0 € variable Kosten · kein Paid Overflow · Production technisch gesperrt.</div></div><div class="small">Das Formular kann diese Werte nicht überschreiben. Der Server setzt sie erneut und der Universal Mission Preflight prüft sie fail-closed.</div></div></div><div id="plan-review" class="review"></div>'}
function renderPlan(review){if(!review)return;const tasks=review.plan?.selected_capabilities||[];const rejected=review.plan?.rejected_capabilities||[];$('#plan-review').innerHTML='<div class="card"><div class="callout warn"><strong>Plan Review · Freigabe erforderlich</strong><div class="small">Noch keine Ausführung gestartet. Runtime Revision '+esc(review.runtime_revision)+'</div></div><h2>Erkannte Ziele & Probleme</h2><div class="small">'+esc((review.analysis?.problems||[]).join(' · ')||'Keine expliziten Problemklassen erkannt')+'</div><h2 style="margin-top:18px">Capabilities, Factories & Provider</h2><div class="stack">'+tasks.map(t=>'<div class="plan-task"><div class="row"><div class="row-main"><strong>'+esc(t.capability)+'</strong><span class="small">Factory: '+esc(t.factory)+' · '+esc(t.reason||'')+'</span></div>'+badge(t.status)+'</div><div class="small">Provider: <b>'+esc(t.provider?.primary)+'</b> · Fallback: '+esc(t.provider?.fallback||'none')+' · '+fmtMoney(t.provider?.estimated_variable_cost_eur||0)+'</div><div class="small">Dependencies: '+esc((t.dependencies||[]).join(', ')||'keine')+'</div></div>').join('')+'</div><h2 style="margin-top:18px">Bewusst nicht gewählt</h2><div class="small">'+esc(rejected.map(x=>x.capability+': '+x.reason).join(' · ')||'Keine')+'</div><div class="row" style="margin-top:16px"><div><strong>Cost Preflight</strong><div class="small">'+esc(review.preflight?.status)+' · '+fmtMoney(review.preflight?.estimated_variable_cost_eur||0)+'</div></div><button id="approve-plan" class="btn primary">Plan freigeben & synthetisches Staging starten</button></div><details class="details"><summary>Technische Details</summary><pre>'+esc(JSON.stringify(review,null,2))+'</pre></details></div>';$('#approve-plan').onclick=approvePlan}
async function approvePlan(){try{const result=await api('/mission-approve',{method:'POST',body:JSON.stringify({plan_token:state.plan.plan_token})});state.lastMissionId=result.mission_id;state.plan=null;await loadAll();go('deliveries')}catch(e){setError(e)}}function renderMission(){$('#mission').innerHTML=missionForm();const f=$('#mission-form');f.onsubmit=async e=>{e.preventDefault();setError(null);const fd=new FormData(f);const split=(x)=>String(x||'').split(',').map(v=>v.trim()).filter(Boolean);try{state.plan=await api('/mission-preflight',{method:'POST',body:JSON.stringify({scope_key:fd.get('scope_key'),industry:fd.get('industry'),country:fd.get('country'),language:fd.get('language'),mission_text:fd.get('mission_text'),requested_outcomes:split(fd.get('requested_outcomes')),known_constraints:split(fd.get('known_constraints'))})});renderPlan(state.plan)}catch(err){setError(err)}};renderPlan(state.plan)}
function renderApprovals(){const a=state.data.approvals||{};const plans=a.mission_plans||[];const core=a.core?.pending||[];$('#approvals').innerHTML='<div class="grid cols"><div class="card"><h2>Mission Plan Approvals</h2>'+(plans.length?plans.map(p=>'<div class="row"><div class="row-main"><strong>'+esc(p.business_name)+'</strong><span class="small">'+esc(p.mission_text)+'</span></div>'+badge(p.status)+'</div>').join(''):'<div class="empty">Keine offenen Mission-Plan-Freigaben.</div>')+'</div><div class="card"><h2>Core Approvals</h2>'+(core.length?core.map(p=>'<div class="row"><div class="row-main"><strong>'+esc(p.approval_type||p.capability||'Approval')+'</strong><span class="small">'+esc(p.scope_key||'')+'</span></div>'+badge('APPROVAL_REQUIRED')+'</div>').join(''):'<div class="empty">Keine offenen Core-Freigaben.</div>')+'</div></div>'}
function renderFactories(){const f=state.data.factories?.items||[];$('#factories').innerHTML='<div class="grid cols"><div class="card"><h2>Factory Readiness</h2>'+f.map(x=>'<div class="row"><div class="row-main"><strong>'+esc(x.factory)+'</strong><span class="small">'+esc(x.role)+' · '+esc((x.provider_path||[]).join(' → '))+'</span></div>'+badge(x.status)+'</div>').join('')+'</div><div class="card"><h2>Grundsatz</h2><div class="callout"><strong>Eine Oberfläche, keine konkurrierenden Dashboards.</strong><div class="small">Factory-Details bleiben Unteransichten des Operator Control Plane. Provider- und Factory-Logik bleibt im Backend.</div></div></div></div>'}
function renderProviders(){const p=state.data.providers||{};const matrix=p.activation_matrix||{};const rows=Array.isArray(matrix)?matrix:Object.entries(matrix).map(([name,value])=>({name,...(value||{})}));$('#providers').innerHTML='<div class="card"><h2>Provider Layer</h2><div class="callout"><strong>Source of truth</strong><div class="small">'+esc(p.source_of_truth||'provider-stack-v1')+'</div></div>'+(rows.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Provider / Domain</th><th>Status</th><th>Details</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><strong>'+esc(x.name||x.provider||x.id||'Provider')+'</strong></td><td>'+badge(x.status||x.readiness||'UNKNOWN')+'</td><td class="small">'+esc(x.reason||x.blocker||x.role||'')+'</td></tr>').join('')+'</tbody></table></div>':'<details class="details" open><summary>Activation matrix</summary><pre>'+esc(JSON.stringify(matrix,null,2))+'</pre></details>')+'</div>'}
function renderCosts(){const c=state.data.costs||{};$('#costs').innerHTML='<div class="grid metrics">'+[['Spent',fmtMoney(c.spent_eur)],['Reserved',fmtMoney(c.reserved_eur)],['Estimated',fmtMoney(c.estimated_eur)],['Dev ceiling',fmtMoney(c.development_ceiling_eur)],['Paid overflow',c.automatic_paid_overflow?'AN':'AUS']].map(([k,v])=>'<div class="metric"><div class="v">'+esc(v)+'</div><div class="k">'+esc(k)+'</div></div>').join('')+'</div><div class="card"><h2>Kostenrealität</h2><div class="row"><span>Aktueller Variablenstatus</span><span class="badge attention">'+esc(c.variable_cost_state||'NOT_ESTIMATED')+'</span></div><div class="small">0 € wird als ESTIMATED ZERO gekennzeichnet und nicht automatisch als „kostenlos verifiziert“ ausgegeben.</div></div>'}
function renderDeliveries(){const d=state.data.deliveries||{};const u=d.universal_missions||[];const live=d.live_proofs||[];$('#deliveries').innerHTML='<div class="grid cols"><div class="card"><h2>Unified Deliveries</h2>'+(u.length?u.slice().reverse().map(x=>'<div class="row"><div class="row-main"><strong>'+esc(x.business_name||x.mission_id)+'</strong><span class="small">'+esc(x.mission||'')+' · Quality '+esc(x.quality?.quality_score??'–')+'</span></div>'+badge(x.final_delivery_status)+'</div><details class="details"><summary>Evidence</summary><pre>'+esc(JSON.stringify(x,null,2))+'</pre></details>').join(''):'<div class="empty">Noch keine Universal Mission Delivery in dieser Runtime.</div>')+'</div><div class="card"><h2>Live Provider Evidence</h2>'+(live.length?live.map(x=>'<div class="row"><div class="row-main"><strong>'+esc(x.kind||'Live proof')+'</strong><span class="small">'+esc(x.project_scope||'')+'</span></div>'+badge(x.status)+'</div>').join(''):'<div class="empty">Keine Live-Proofs gemeldet.</div>')+'</div></div>'}
function renderHealth(){const h=state.data.health||{};$('#health').innerHTML='<div class="grid cols"><div class="card"><h2>System Health</h2><div class="row"><span>Control Plane</span>'+badge(h.control_plane?.raw)+'</div><div class="row"><span>Factory Control API</span>'+badge(h.factory_control_api?.raw)+'</div><div class="row"><span>CI</span>'+badge(h.ci?.raw)+'</div><div class="row"><span>Production</span>'+badge(h.production?.raw)+'</div></div><div class="card"><h2>Factories</h2>'+(h.factories||[]).map(x=>'<div class="row"><div><strong>'+esc(x.factory)+'</strong><div class="small">'+esc(x.role)+'</div></div>'+badge(x.status)+'</div>').join('')+'</div></div>'}
function renderAudit(){const items=state.data.audit?.items||[];$('#audit').innerHTML='<div class="card"><h2>Audit Timeline</h2><div class="timeline">'+(items.length?items.map(x=>'<div class="step"><div></div><div><strong>'+esc(x.event||x.type||'Event')+'</strong><div class="small">'+esc(x.scope_key||x.command_id||x.mission_id||'system')+' · '+esc(fmtDate(x.at))+'</div></div></div>').join(''):'<div class="empty">Keine Audit Events.</div>')+'</div></div>'}
function renderSettings(){const s=state.data.settings||{};$('#settings').innerHTML='<div class="grid cols"><div class="card"><h2>Operator Policies</h2>'+[['Standardumgebung',s.default_environment],['Datenmodus',s.data_mode],['Missionsbudget',fmtMoney(s.mission_variable_budget_ceiling_eur)],['Paid Overflow',s.automatic_paid_overflow?'AN':'AUS'],['Production',s.production_policy],['Approval Policy',s.approval_policy],['Provider Fallback',s.provider_fallback]].map(([k,v])=>'<div class="row"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div><div class="card"><h2>Runtime Persistence</h2><div class="callout warn"><strong>'+esc(s.runtime_store||'UNKNOWN')+'</strong><div class="small">'+esc(s.persistence_note||'')+'</div></div><div class="small">Credentials und Secrets werden hier bewusst weder gespeichert noch angezeigt.</div></div></div>'}function render(id){({hq:renderHQ,projects:renderProjects,mission:renderMission,approvals:renderApprovals,factories:renderFactories,providers:renderProviders,costs:renderCosts,deliveries:renderDeliveries,health:renderHealth,audit:renderAudit,settings:renderSettings}[id]||renderHQ)()}loadAll();
</script></body></html>`;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!(url.pathname === '/operator' || url.pathname === '/operator/' || url.pathname.startsWith('/operator/api/'))) return null;
  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) {
    const body = { error: auth.error, private_operator_access_required: true, production_deploy: false };
    return url.pathname.startsWith('/operator/api/') ? json(body, auth.status || 403) : html('<!doctype html><meta charset="utf-8"><title>RIOSYSTEMS Private</title><body style="font-family:system-ui;padding:3rem"><h1>RIOSYSTEMS Private Operator Control Plane</h1><p>Private operator authentication is required.</p></body>', auth.status || 403);
  }
  if (url.pathname === '/operator' || url.pathname === '/operator/') return html(shell());
  const service = getRuntimeService(auth.operator_id, options);
  const path = url.pathname.slice('/operator/api'.length) || '/dashboard';
  const body = await readBody(request);
  const custom = await customApi(service, auth.operator_id, path, request, body);
  if (custom) return json(custom.body, custom.status);
  const allowedPaths = ['/health','/snapshot','/dashboard','/projects','/missions','/deliveries','/factories','/actions'];
  const pass = allowedPaths.includes(path) || /^\/projects\/[^/]+(?:\/select)?$/.test(path) || /^\/missions\/[^/]+$/.test(path);
  if (!pass) return json({ error: 'OPERATOR_DASHBOARD_ROUTE_NOT_FOUND', production_deploy: false }, 404);
  const result = await service.handle({ method: request.method, path, body, expected_revision: body.expected_revision });
  return json(result.body, result.status || (result.ok ? 200 : 400));
}

export function operatorDashboardHttpManifest() {
  return {
    schema: 'riosystems.private-operator-dashboard-http.v1', route: '/operator', auth: 'cloudflare_access_ctx_identity_fail_closed', single_operator: true,
    local_dev_access_supported_by_cloudflare_access_dev_identity: true, backend: 'riosystems.operator-runtime-api.v1',
    plan_review_uses_existing_universal_mission_compiler: true, mission_execution_uses_existing_operator_runtime_api: true,
    direct_provider_calls: false, secrets_in_frontend: false, automatic_dispatch: false, automatic_paid_overflow: false,
    real_customer_data: false, production_deploy: false
  };
}
