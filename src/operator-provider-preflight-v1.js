import { handleOperatorDashboard as handleExistingOperatorDashboard } from './operator-human-ux-final-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import { providerActivationInventory } from './provider-activation-inventory.js';
import { providerActivationMatrix } from './provider-stack-v1.js';
import { createApprovalRecord } from './runtime-approvals.js';
import {
  quickMissionCostEstimate,
  deepMissionCostPreflight,
  evaluateMissionCostCeiling,
  selectCostAwareProvider,
  historicalEstimateRecord,
  missionCostPreflightManifest
} from './mission-cost-preflight-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const asArray = (value) => Array.isArray(value) ? value : [];
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function bodyJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function activationText(row = {}) {
  return clean(row.activation || row.status || row.state || '', 240).toLowerCase();
}

function matrixConnection(row = {}) {
  const text = activationText(row);
  if (!text) return 'NOT_CONNECTED';
  if (text.includes('live_staging_verified') || text.includes('staging_deploy_verified') || text.includes('staging_write_verified') || text.includes('staging_analytics_verified') || text.includes('live_read_and_staging')) return 'CONNECTED_STAGING';
  if (text.includes('permission_required') || text.includes('credential') || text.includes('budget_gate')) return 'NOT_CONNECTED';
  if (text.includes('verification_incomplete') || text.includes('only_if_')) return 'NOT_CONNECTED';
  if (text.includes('live_read_verified')) return 'READ_ONLY_VERIFIED';
  return 'NOT_CONNECTED';
}

function providerConfigured(provider = {}, evidence = {}, connection = 'NOT_CONNECTED') {
  if (connection !== 'NOT_CONNECTED') return 'CONFIGURED';
  const credential = clean(provider.credential_state || evidence.credential || evidence.credentials_state || '', 120).toUpperCase();
  const account = clean(provider.account_state || evidence.account || evidence.account_state || '', 120).toUpperCase();
  const credentialReady = provider.credentials_required !== true || ['PRESENT_VALID','READY','VERIFIED'].includes(credential);
  const accountReady = provider.account_binding_required !== true || ['READY','PRESENT','VERIFIED','ACCESSIBLE'].includes(account);
  return credentialReady && accountReady ? 'CONFIGURED' : 'NOT_VERIFIED';
}

function providerExecutable(evidence = {}) {
  if (!evidence || typeof evidence !== 'object') return false;
  const explicit = [
    evidence.staging_deploy_verified,
    evidence.staging_inference_verified,
    evidence.staging_write_verified,
    evidence.staging_analytics_verified
  ].some((value) => value === true);
  if (explicit) return true;
  const text = activationText(evidence);
  if (text.includes('read_only') || text.includes('read-only')) return false;
  return text === 'live_staging_verified'
    || text.includes('staging_deploy_verified')
    || text.includes('staging_write_verified')
    || text.includes('staging_analytics_verified')
    || text.includes('live_staging_inference_verified');
}

function providerPresentationGroup({ availability, connection, configured, executable, evidence = {} } = {}) {
  const text = activationText(evidence);
  if (String(availability || '').toUpperCase().includes('UNAVAILABLE') || text.includes('failed')) return 'BLOCKIERT';
  if (connection === 'NOT_CONNECTED') return 'NICHT_VERBUNDEN';
  if (executable === 'VERIFIED_STAGING' && connection === 'CONNECTED_STAGING') return 'EINSATZBEREIT';
  if (['CONNECTED_STAGING','READ_ONLY_VERIFIED'].includes(connection)) return 'STAGING_VERIFIZIERT';
  if (configured === 'CONFIGURED') return 'KONFIGURIERT_NICHT_VERIFIZIERT';
  return 'NICHT_VERBUNDEN';
}

export function buildProviderEcosystemProjection() {
  const inventory = providerActivationInventory();
  const matrix = providerActivationMatrix();
  const matrixById = new Map(asArray(matrix.providers).map((row) => [row.id, row]));
  const providers = asArray(inventory.providers).map((provider) => {
    const evidence = matrixById.get(provider.id) || null;
    const connection = evidence ? matrixConnection(evidence) : 'NOT_CONNECTED';
    const activeRuntime = provider.runtime_eligible !== false && ['CONNECTED_STAGING', 'READ_ONLY_VERIFIED'].includes(connection);
    const verification = connection === 'CONNECTED_STAGING'
      ? 'VERIFIED_STAGING'
      : connection === 'READ_ONLY_VERIFIED'
        ? 'VERIFIED_READ_ONLY'
        : provider.verification === 'EVIDENCE_DRIVEN' ? 'NOT_VERIFIED' : (provider.verification || 'NOT_CONNECTED');
    const configured = providerConfigured(provider, evidence || {}, connection);
    const executable = providerExecutable(evidence || {}) ? 'VERIFIED_STAGING' : (connection === 'NOT_CONNECTED' ? 'NOT_CONNECTED' : 'NOT_VERIFIED');
    const productionCapable = provider.production_eligible === true ? 'VERIFIED' : provider.production_eligible === false ? 'BLOCKED' : 'NOT_VERIFIED';
    const presentationGroup = providerPresentationGroup({
      availability: provider.availability,
      connection,
      configured,
      executable,
      evidence: evidence || {}
    });
    return {
      id: provider.id,
      name: provider.name || provider.id,
      category: provider.category || 'uncategorized',
      role: provider.role || asArray(provider.roles).join(', ') || 'STRATEGIC PROVIDER',
      state: provider.strategic_state || 'SELECTED',
      availability: provider.availability || 'AVAILABLE',
      connection_state: connection,
      verification,
      restrictions: clone(provider.restrictions || []),
      runtime_eligible: provider.runtime_eligible !== false,
      active_runtime: activeRuntime,
      capabilities: clone(provider.capabilities || []),
      cost_mode: provider.cost_mode || 'UNKNOWN',
      evidence: evidence ? clone(evidence) : null,
      presentation_group: presentationGroup,
      presentation_dimensions: {
        registered: 'REGISTERED',
        available: provider.availability || 'NOT_VERIFIED',
        configured,
        connected: connection,
        staging_verified: connection === 'CONNECTED_STAGING' ? 'VERIFIED_STAGING' : connection === 'READ_ONLY_VERIFIED' ? 'VERIFIED_READ_ONLY' : 'NOT_VERIFIED',
        executable,
        production_capable: productionCapable
      },
      secrets_exposed: false,
      production_deploy: false
    };
  });
  return {
    schema: 'aurentara.provider-ecosystem.v2',
    source_of_truth: 'provider_activation_inventory_plus_activation_matrix',
    provider_ecosystem: providers,
    presentation_groups: {
      einsatzbereit: providers.filter((provider) => provider.presentation_group === 'EINSATZBEREIT').map((provider) => provider.id),
      staging_verifiziert: providers.filter((provider) => provider.presentation_group === 'STAGING_VERIFIZIERT').map((provider) => provider.id),
      konfiguriert_nicht_verifiziert: providers.filter((provider) => provider.presentation_group === 'KONFIGURIERT_NICHT_VERIFIZIERT').map((provider) => provider.id),
      nicht_verbunden: providers.filter((provider) => provider.presentation_group === 'NICHT_VERBUNDEN').map((provider) => provider.id),
      blockiert: providers.filter((provider) => provider.presentation_group === 'BLOCKIERT').map((provider) => provider.id)
    },
    active_runtime_routes: providers.filter((provider) => provider.active_runtime === true),
    strategic_selection_is_not_technical_connection: true,
    not_connected_never_runtime_eligible: providers.every((provider) => provider.connection_state !== 'NOT_CONNECTED' || provider.active_runtime === false),
    paid_provider_activation: false,
    secrets_exposed: false,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}

async function currentFunctionalProjection(request, env, ctx, options) {
  const url = new URL(request.url);
  url.pathname = '/operator/api/functional-completion';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  const response = await handleExistingOperatorDashboard(probe, env, ctx, options);
  if (!response || response.status !== 200) return null;
  try { return await response.clone().json(); } catch { return null; }
}

function historyFromFunctionalProjection(projection = {}) {
  const missionRows = asArray(projection?.missions?.items || projection?.missions || projection?.mission_items);
  return missionRows.filter((mission) => ['COMPLETED', 'SUCCESS', 'SIMULATED_HANDOFF_READY', 'SYNTHETIC_STAGING_COMPLETED', 'DELIVERY_READY'].includes(clean(mission?.status || mission?.delivery_state, 80).toUpperCase()))
    .map((mission) => historicalEstimateRecord({
      mission_id: mission.mission_id,
      mission_type: mission.mission_type || 'GENERAL',
      route: mission.route || 'BALANCED',
      capability_mix: asArray(mission.selected_capabilities).map((item) => item?.capability || item).filter(Boolean),
      estimated_cost: mission.estimated_cost_eur,
      actual_cost: mission.actual_cost_eur,
      completed: true
    }));
}

async function historyForRequest(request, env, ctx, options) {
  const projection = await currentFunctionalProjection(request, env, ctx, options);
  return historyFromFunctionalProjection(projection || {});
}

function scopeParts(scopeKey = '') {
  const parts = clean(scopeKey, 500).split(':').filter(Boolean);
  return {
    customer_id: parts.shift() || 'synthetic-operator',
    project_id: parts.join(':') || 'synthetic-mission'
  };
}

function costAwareDecision(input = {}) {
  const action = clean(input.action, 80).toUpperCase();
  const gate = evaluateMissionCostCeiling(input);
  if (action === 'STOP') {
    return {
      ok: true,
      status: 'MISSION_STOPPED_BEFORE_EXECUTION',
      mission_paused: true,
      execution_started: false,
      approval_required: false,
      production_deploy: false,
      external_writes: false,
      additional_variable_cost_eur: 0
    };
  }
  if (action === 'ALTERNATIVE_ROUTE') {
    return {
      ok: true,
      status: 'ALTERNATIVE_ROUTE_REQUIRED',
      recommended_route: 'ECONOMY',
      mission_paused: true,
      execution_started: false,
      production_deploy: false,
      external_writes: false,
      additional_variable_cost_eur: 0
    };
  }
  if (action === 'CONTINUE_APPROVE') {
    const newCeiling = Number(input.new_ceiling_eur);
    if (!Number.isFinite(newCeiling) || newCeiling < Number(input.projected_final_cost_eur || 0)) {
      return { ok: false, status: 'ADDITIONAL_BUDGET_INSUFFICIENT', required_ceiling_eur: money(input.projected_final_cost_eur || 0), production_deploy: false };
    }
    const ids = scopeParts(input.scope_key);
    const approval = createApprovalRecord({
      customer_id: input.customer_id || ids.customer_id,
      project_id: input.project_id || ids.project_id,
      approval_type: 'MISSION_COST_CEILING_OVERRUN',
      actor_id: clean(input.actor_id || 'operator', 160),
      granted: true,
      metadata: {
        mission_id: clean(input.mission_id, 180) || null,
        previous_ceiling_eur: gate.approved_ceiling_eur,
        approved_ceiling_eur: money(newCeiling),
        projected_final_cost_eur: money(input.projected_final_cost_eur || 0),
        reason: 'OPERATOR_EXPLICIT_ADDITIONAL_BUDGET_APPROVAL'
      }
    });
    return {
      ok: approval.ok === true,
      status: approval.ok ? 'ADDITIONAL_BUDGET_APPROVED' : 'APPROVAL_RECORD_FAILED',
      approval: approval.approval || null,
      approved_ceiling_eur: money(newCeiling),
      mission_paused: !approval.ok,
      existing_approval_contract_reused: true,
      production_deploy: false,
      external_writes: false,
      additional_variable_cost_eur: 0
    };
  }
  return { ok: false, status: 'UNKNOWN_COST_OVERRUN_ACTION', allowed_actions: ['CONTINUE_APPROVE', 'ALTERNATIVE_ROUTE', 'STOP'], production_deploy: false };
}

async function authorizeNewEndpoint(request, env, ctx, options) {
  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return { ok: false, response: json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403) };
  return { ok: true, auth };
}

const PREFLIGHT_STYLE = String.raw`<style id="aurentara-provider-preflight-v1-style">
.cost-preflight{margin-top:14px}.cost-preflight .route-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.cost-route{border:1px solid var(--line);border-radius:10px;background:#fbfbf9;padding:11px;text-align:left;cursor:pointer}.cost-route.active{border-color:#8f9a90;background:#f3f6f3;box-shadow:inset 0 0 0 1px #8f9a90}.cost-route b{display:block;font-size:11px}.cost-route span{display:block;margin-top:3px;font-size:14px;font-weight:680}.cost-route small{display:block;margin-top:4px;color:var(--muted)}.cost-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.cost-ceiling{display:grid;grid-template-columns:minmax(180px,.55fr) 1fr;gap:12px;align-items:end;margin-top:12px}.cost-pause{margin-top:12px;border:1px solid #e3c8a8;background:#fff9f1;border-radius:11px;padding:12px}.provider-ecosystem-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}.provider-ecosystem-card{border:1px solid var(--line);background:#fff;border-radius:12px;padding:14px}.provider-ecosystem-card h3{margin:0 0 4px}.provider-runtime-list{margin-top:14px}@media(max-width:760px){.cost-preflight .route-grid,.cost-summary,.cost-ceiling{grid-template-columns:1fr}}
</style>`;

const PREFLIGHT_SCRIPT = String.raw`<script id="aurentara-provider-preflight-v1-script">
(() => {
  if (window.__aurentaraProviderPreflightV1) return;
  window.__aurentaraProviderPreflightV1 = true;
  const rows=v=>Array.isArray(v)?v:[];
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const eur=v=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const routeKey=v=>String(v||'BALANCED').toUpperCase();
  const humanDim=v=>({
    REGISTERED:'Registriert',AVAILABLE:'Verfügbar',CONFIGURED:'Konfiguriert',
    CONNECTED_STAGING:'Verbunden (Staging)',READ_ONLY_VERIFIED:'Read-only verifiziert',
    VERIFIED_STAGING:'Staging verifiziert',VERIFIED_READ_ONLY:'Read-only verifiziert',
    VERIFIED:'Verifiziert',NOT_VERIFIED:'Nicht verifiziert',NOT_CONNECTED:'Nicht verbunden',
    BLOCKED:'Blockiert'
  })[String(v||'NOT_VERIFIED').toUpperCase()]||String(v||'Nicht verifiziert').replaceAll('_',' ');
  const humanGroup=v=>({
    EINSATZBEREIT:'Einsatzbereit (Staging)',STAGING_VERIFIZIERT:'Staging verifiziert',
    KONFIGURIERT_NICHT_VERIFIZIERT:'Konfiguriert, nicht verifiziert',
    NICHT_VERBUNDEN:'Nicht verbunden',BLOCKIERT:'Blockiert'
  })[String(v||'NICHT_VERBUNDEN').toUpperCase()]||String(v||'Nicht verbunden');
  const groupBadge=v=>badge(v==='EINSATZBEREIT'?'READY':v==='STAGING_VERIFIZIERT'?'STAGING_ONLY':v==='BLOCKIERT'?'BLOCKED':'NOT_VERIFIED');
  const capLabel=v=>typeof humanCapability==='function'?humanCapability(v):String(v||'').replaceAll('_',' ');
  const cache=new Map();
  function routeData(result,route){return result?.routes?.[String(route||'BALANCED').toLowerCase()]||result}
  function missionInput(review,route){const form=document.getElementById('mission-form');const text=form?.querySelector('[name="mission_text"]')?.value||review?.mission?.mission_text||'';const outcomes=String(form?.querySelector('[name="requested_outcomes"]')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);const constraints=String(form?.querySelector('[name="known_constraints"]')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);return{route:routeKey(route),mission_text:text,requested_outcomes:outcomes,known_constraints:constraints,plan:review?.plan||{},selected_capabilities:review?.plan?.selected_capabilities||[],mission_type:'GENERAL',external_dependencies_unknown:true}}
  function pauseHtml(gate){return '<div class="cost-pause" data-cost-pause><strong>Mission pausiert: Cost Ceiling würde überschritten</strong><div class="small">Actual Spend '+eur(gate.actual_spend_eur)+' · Projected Final Cost '+eur(gate.projected_final_cost_eur)+' · Approved Ceiling '+eur(gate.approved_ceiling_eur)+' · Zusätzlich benötigt '+eur(gate.additional_required_budget_eur)+'</div><div class="actions" style="margin-top:9px"><button class="btn primary" data-cost-continue>WEITER FREIGEBEN</button><button class="btn" data-cost-alternative>ALTERNATIVE ROUTE</button><button class="btn danger" data-cost-stop>STOPPEN</button></div></div>'}
  function bindPause(review,result,route,gate){const box=document.querySelector('[data-cost-pause]');if(!box)return;box.querySelector('[data-cost-continue]').onclick=async()=>{const decision=await api('/cost-overrun/decision',{method:'POST',body:JSON.stringify({action:'CONTINUE_APPROVE',scope_key:state.selectedScope,mission_id:review?.mission?.mission_id,actual_spend_eur:gate.actual_spend_eur,projected_final_cost_eur:gate.projected_final_cost_eur,approved_ceiling_eur:gate.approved_ceiling_eur,new_ceiling_eur:gate.projected_final_cost_eur})});if(decision.ok){const input=document.querySelector('[data-cost-ceiling]');if(input)input.value=String(decision.approved_ceiling_eur);document.querySelector('[data-cost-pause]')?.remove();await startMission(review,result,route)}};box.querySelector('[data-cost-alternative]').onclick=()=>renderCost(review,result,'ECONOMY');box.querySelector('[data-cost-stop]').onclick=async()=>{await api('/cost-overrun/decision',{method:'POST',body:JSON.stringify({action:'STOP',scope_key:state.selectedScope,mission_id:review?.mission?.mission_id,projected_final_cost_eur:gate.projected_final_cost_eur,approved_ceiling_eur:gate.approved_ceiling_eur})});const start=document.getElementById('approve-plan');if(start){start.disabled=true;start.textContent='Mission gestoppt'}box.innerHTML='<strong>Mission vor Execution gestoppt.</strong><div class="small">Es wurde keine Ausführung gestartet.</div>'}}
  async function startMission(review,result,route){const selected=routeData(result,route);const ceiling=Number(document.querySelector('[data-cost-ceiling]')?.value);const gate=await api('/cost-ceiling/evaluate',{method:'POST',body:JSON.stringify({scope_key:state.selectedScope,mission_id:review?.mission?.mission_id,actual_spend_eur:0,projected_final_cost_eur:selected.high_estimate_eur,approved_ceiling_eur:ceiling,reason:'MISSION_STUDIO_PREFLIGHT'})});document.querySelector('[data-cost-pause]')?.remove();if(!gate.ok){document.querySelector('[data-cost-preflight]')?.insertAdjacentHTML('beforeend',pauseHtml(gate));bindPause(review,result,route,gate);return gate}const response=await api('/mission-plan-decision',{method:'POST',body:JSON.stringify({plan_token:review.plan_token,decision:'approve',confirmation_text:review.confirmation_text||'CONFIRM_SYNTHETIC_STAGING',cost_preflight_v1:{route:routeKey(route),estimated_cost_eur:selected.estimated_cost_eur,projected_final_cost_eur:selected.high_estimate_eur,approved_ceiling_eur:ceiling,confidence:selected.confidence}})});state.plan=null;await loadAll();go('deliveries');return response}
  function renderCost(review,result,route='BALANCED',deep=false){const host=document.getElementById('plan-review');if(!host||!review)return;let card=host.querySelector('[data-cost-preflight]');if(!card){card=document.createElement('div');card.className='card cost-preflight';card.dataset.costPreflight='true';host.prepend(card)}const selected=routeData(result,route);const r=result.routes||{};card.innerHTML='<div class="row"><div><div class="eyebrow">Kosten-Preflight</div><h2 style="margin:3px 0">Geschätzte Kosten</h2><div class="small">'+(deep?'Deep Preflight':'Quick Estimate')+' · Range statt Scheinpräzision · 0 Paid Calls</div></div>'+badge(selected.confidence||'UNKNOWN')+'</div><div class="cost-summary"><div class="kv"><b>Geschätzt</b><span>'+eur(selected.estimated_cost_eur)+'</span></div><div class="kv"><b>Erwarteter Bereich</b><span>'+eur(selected.low_estimate_eur)+' – '+eur(selected.high_estimate_eur)+'</span></div><div class="kv"><b>Confidence</b><span>'+h(selected.confidence)+' · '+h(selected.confidence_score)+'</span></div><div class="kv"><b>Quick Latency</b><span>'+h(result.calculation_latency_ms)+' ms</span></div></div><div class="route-grid">'+['ECONOMY','BALANCED','PREMIUM'].map(name=>{const d=routeData(result,name);return '<button type="button" class="cost-route '+(routeKey(route)===name?'active':'')+'" data-cost-route="'+name+'"><b>'+name+(name==='BALANCED'?' · EMPFOHLEN':'')+'</b><span>'+eur(d.estimated_cost_eur)+'</span><small>'+eur(d.low_estimate_eur)+' – '+eur(d.high_estimate_eur)+'</small></button>'}).join('')+'</div><div class="cost-ceiling"><div class="field"><label>Approved Cost Ceiling</label><input type="number" min="0" step="0.01" data-cost-ceiling value="'+h(selected.recommended_cost_ceiling_eur)+'"></div><div class="small">Execution pausiert automatisch, wenn der projected final cost dieses Ceiling überschreiten würde.</div></div><div class="actions" style="margin-top:12px"><button type="button" class="btn" data-cost-deep>GENAUER KALKULIEREN</button><details class="details"><summary>ROUTENDETAILS</summary><pre>'+h(JSON.stringify({provider_classes:selected.expected_provider_classes,capabilities:selected.expected_capabilities,uncertainties:selected.uncertainties,estimate_basis:selected.estimate_basis,expected_execution_structure:result.expected_execution_structure||null},null,2))+'</pre></details></div>';card.querySelectorAll('[data-cost-route]').forEach(btn=>btn.onclick=()=>renderCost(review,result,btn.dataset.costRoute,deep));card.querySelector('[data-cost-deep]').onclick=async()=>{const deepResult=await api('/cost-preflight/deep',{method:'POST',body:JSON.stringify(missionInput(review,route))});cache.set(review.plan_token,{result:deepResult,route:routeKey(route),deep:true});renderCost(review,deepResult,route,true)};const start=document.getElementById('approve-plan');if(start){start.textContent='MISSION STARTEN';start.onclick=()=>startMission(review,result,route)}}
  async function hydrateCost(review){if(!review?.plan_token)return;try{const input=missionInput(review,'BALANCED');const result=await api('/cost-preflight/quick',{method:'POST',body:JSON.stringify(input)});cache.set(review.plan_token,{result,route:'BALANCED',deep:false});renderCost(review,result,'BALANCED',false)}catch(error){setError(error)}}
  if(typeof renderPlan==='function'){const prev=renderPlan;renderPlan=function(review){prev(review);if(review)void hydrateCost(review)}}
  async function renderProviderEcosystem(){const root=document.getElementById('providers');if(!root)return;try{const data=await api('/provider-ecosystem');const ecosystem=rows(data.provider_ecosystem),active=rows(data.active_runtime_routes);root.innerHTML='<div class="card"><div class="human-head"><div><h2>Provider Ecosystem</h2><p>Registrierung, Konfiguration, Verbindung, Staging-Verifikation, Ausführbarkeit und Production-Fähigkeit bleiben getrennte Wahrheitsdimensionen.</p></div></div><div class="provider-ecosystem-grid">'+ecosystem.map(p=>{const d=p.presentation_dimensions||{};return '<div class="provider-ecosystem-card" data-provider-group="'+h(p.presentation_group)+'"><div class="row"><div><h3>'+h(p.name)+'</h3><div class="small">'+h(p.category)+' · '+h(p.role)+'</div></div>'+groupBadge(p.presentation_group)+'</div><div class="human-note"><strong>'+h(humanGroup(p.presentation_group))+'</strong></div><div class="human-grid">'+
      '<div class="kv"><b>Registriert</b><span>'+h(humanDim(d.registered))+'</span></div>'+
      '<div class="kv"><b>Verfügbar</b><span>'+h(humanDim(d.available))+'</span></div>'+
      '<div class="kv"><b>Konfiguriert</b><span>'+h(humanDim(d.configured))+'</span></div>'+
      '<div class="kv"><b>Verbunden</b><span>'+h(humanDim(d.connected))+'</span></div>'+
      '<div class="kv"><b>Staging-verifiziert</b><span>'+h(humanDim(d.staging_verified))+'</span></div>'+
      '<div class="kv"><b>Ausführbar</b><span>'+h(humanDim(d.executable))+'</span></div>'+
      '<div class="kv"><b>Production-fähig</b><span>'+h(humanDim(d.production_capable))+'</span></div></div>'+
      '<div class="small">Capabilities: '+h(rows(p.capabilities).map(capLabel).join(' · ')||'Nicht projiziert')+'</div>'+
      '<details class="details"><summary>Technischer Provider-Contract</summary><pre>'+h(JSON.stringify({id:p.id,state:p.state,availability:p.availability,connection_state:p.connection_state,verification:p.verification,cost_mode:p.cost_mode,restrictions:p.restrictions,evidence:p.evidence},null,2))+'</pre></details></div>'}).join('')+'</div></div><div class="card provider-runtime-list"><h2>Aktive Runtime-Routen</h2>'+(active.length?active.map(p=>'<div class="row"><div><strong>'+h(p.name)+'</strong><div class="small">'+h(p.role)+' · '+h(humanDim(p.presentation_dimensions?.executable))+'</div></div>'+groupBadge(p.presentation_group)+'</div>').join(''):'<div class="empty">Keine verifizierte aktive Runtime-Route.</div>')+'</div>'}catch(error){setError(error)}}
  if(typeof render==='function'){const prev=render;render=function(id){prev(id);if(id==='providers')requestAnimationFrame(()=>void renderProviderEcosystem());if(id==='mission'&&state?.plan)requestAnimationFrame(()=>void hydrateCost(state.plan))}}
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith('/operator/api/provider-ecosystem') || path.startsWith('/operator/api/cost-preflight/') || path === '/operator/api/cost-ceiling/evaluate' || path === '/operator/api/cost-overrun/decision' || path === '/operator/api/cost-routing/select' || path === '/operator/api/estimate-history') {
    const auth = await authorizeNewEndpoint(request, env, ctx, options);
    if (!auth.ok) return auth.response;
  }

  if (request.method === 'GET' && path === '/operator/api/provider-ecosystem') return json(buildProviderEcosystemProjection());

  if (request.method === 'GET' && path === '/operator/api/estimate-history') {
    const history = await historyForRequest(request, env, ctx, options);
    return json({ schema: 'aurentara.mission-estimate-history.v1', items: history, count: history.length, storage_mode: 'derived_from_existing_completed_mission_evidence', machine_learning: false, production_deploy: false });
  }

  if (request.method === 'POST' && path === '/operator/api/cost-preflight/quick') {
    const input = await bodyJson(request);
    const history = await historyForRequest(request, env, ctx, options);
    return json(quickMissionCostEstimate(input, { history }));
  }

  if (request.method === 'POST' && path === '/operator/api/cost-preflight/deep') {
    const input = await bodyJson(request);
    const history = await historyForRequest(request, env, ctx, options);
    return json(deepMissionCostPreflight(input, { history }));
  }

  if (request.method === 'POST' && path === '/operator/api/cost-ceiling/evaluate') {
    const input = await bodyJson(request);
    return json(evaluateMissionCostCeiling(input));
  }

  if (request.method === 'POST' && path === '/operator/api/cost-overrun/decision') {
    const input = await bodyJson(request);
    return json(costAwareDecision(input), costAwareDecision(input).ok ? 200 : 400);
  }

  if (request.method === 'POST' && path === '/operator/api/cost-routing/select') {
    const input = await bodyJson(request);
    const result = selectCostAwareProvider(input);
    return json(result, result.ok ? 200 : 409);
  }

  if (request.method === 'POST' && path === '/operator/api/mission-plan-decision') {
    let body = {};
    try { body = await request.clone().json(); } catch { body = {}; }
    if (clean(body.decision, 40).toLowerCase() === 'approve' && body.cost_preflight_v1 && typeof body.cost_preflight_v1 === 'object') {
      const gate = evaluateMissionCostCeiling({
        actual_spend_eur: 0,
        projected_final_cost_eur: body.cost_preflight_v1.projected_final_cost_eur,
        approved_ceiling_eur: body.cost_preflight_v1.approved_ceiling_eur,
        mission_id: body.cost_preflight_v1.mission_id,
        customer_id: body.cost_preflight_v1.customer_id,
        project_id: body.cost_preflight_v1.project_id,
        actor_id: 'operator',
        reason: 'SERVER_SIDE_MISSION_START_COST_GATE'
      });
      if (!gate.ok) return json({ ...gate, execution_started: false, existing_approval_contract_reused: true }, 409);
    }
  }

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  const type = response.headers.get('content-type') || '';
  if (!(path === '/operator' || path === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const injection = `${PREFLIGHT_STYLE}${PREFLIGHT_SCRIPT}`;
  const body = source.includes('</body>') ? source.replace('</body>', `${injection}</body>`) : `${source}${injection}`;
  const headers = new Headers(response.headers);
  headers.set('x-aurentara-provider-preflight-v1', 'enabled');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorProviderPreflightManifest() {
  return {
    schema: 'aurentara.operator-provider-preflight.v1',
    same_control_plane: true,
    existing_provider_registry_extended: true,
    existing_approval_contract_reused: true,
    provider_ecosystem_endpoint: '/operator/api/provider-ecosystem',
    quick_estimate_endpoint: '/operator/api/cost-preflight/quick',
    deep_preflight_endpoint: '/operator/api/cost-preflight/deep',
    cost_ceiling_endpoint: '/operator/api/cost-ceiling/evaluate',
    cost_overrun_decision_endpoint: '/operator/api/cost-overrun/decision',
    cost_routing_endpoint: '/operator/api/cost-routing/select',
    history_endpoint: '/operator/api/estimate-history',
    mission_studio_integrated: true,
    provider_page_split_ecosystem_and_active_runtime: true,
    ...missionCostPreflightManifest(),
    paid_provider_activation: false,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}
