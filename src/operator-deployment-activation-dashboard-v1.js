import { handleOperatorDashboard as handleExistingDashboard } from './operator-controlled-paid-staging-dashboard-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import { buildOperatorDeploymentIdentity, deploymentIdentityResponse } from './operator-deployment-identity-v1.js';
import {
  CONTROLLED_PAID_STAGING_PROJECT_ID,
  CONTROLLED_PAID_STAGING_MAX_EUR,
  CONTROLLED_PAID_STAGING_CONFIRMATION,
  controlledPaidStagingSnapshot
} from './operator-controlled-paid-staging-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function json(body, status = 200, source = null) {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-extension', 'deployment-identity-gelato-activation-v1');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

async function readJson(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) return {};
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.clone().json(); } catch { return {}; }
}

function runtimeProject(runtime = {}, scopeKey = '') {
  return (runtime.command_center_state?.portfolio?.projects || []).find((project) => project.scope_key === scopeKey) || null;
}

function deploymentLabel(identity = {}) {
  const environment = clean(identity.environment, 40).toUpperCase() || 'UNKNOWN';
  const version = identity.deployed_sha ? identity.deployed_sha.slice(0, 8) : 'VERSION UNKNOWN';
  let deployedAt = 'DEPLOY TIME UNKNOWN';
  if (identity.deployed_at) {
    const parsed = new Date(identity.deployed_at);
    if (!Number.isNaN(parsed.getTime())) deployedAt = `deployed ${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  }
  const production = identity.production_deploy === false ? 'LOCKED' : identity.production_deploy === true ? 'ACTIVE' : 'UNKNOWN';
  const external = identity.external_writes === false ? 'LOCKED' : identity.external_writes === true ? 'ACTIVE' : 'UNKNOWN';
  return { environment, version, deployedAt, production, external };
}

function injectDeploymentIdentity(source, env = {}) {
  const identity = buildOperatorDeploymentIdentity(env);
  const label = deploymentLabel(identity);
  const marker = '<strong>RIOSYSTEMS</strong><span>Private Operator Control Plane</span>';
  if (!source.includes(marker) || source.includes('data-deployment-identity-v1')) return source;
  const style = '<style id="aurentara-deployment-identity-v1-style">.deployment-identity-v1{margin-top:10px;padding-top:9px;border-top:1px solid #363a34;display:grid;gap:3px;font-size:10px;line-height:1.35;color:#d7dbd4}.deployment-identity-v1 b{font-size:10px;letter-spacing:.04em;color:#fff}.deployment-identity-v1 .locked{color:#a8d7b6!important;background:transparent!important}.deployment-identity-v1 .unknown{color:#e7c67c}</style>';
  const identityHtml = `<div class="deployment-identity-v1" data-deployment-identity-v1="true"><b>${esc(label.environment)} · ${esc(label.version)} · ${esc(label.deployedAt)}</b><span class="${label.production === 'LOCKED' ? 'locked' : label.production === 'UNKNOWN' ? 'unknown' : ''}">Production: ${esc(label.production)}</span><span class="${label.external === 'LOCKED' ? 'locked' : label.external === 'UNKNOWN' ? 'unknown' : ''}">External Writes: ${esc(label.external)}</span></div>`;
  let body = source.replace(marker, `${marker}${identityHtml}`);
  if (body.includes('</head>')) body = body.replace('</head>', `${style}</head>`);
  return body;
}

function activationMetadata(project = {}) {
  const eligible = clean(project.project_id, 160) === CONTROLLED_PAID_STAGING_PROJECT_ID;
  return {
    eligible,
    project_id: project.project_id || null,
    scope_key: project.scope_key || null,
    budget_eur: eligible ? CONTROLLED_PAID_STAGING_MAX_EUR : 0,
    confirmation_text: eligible ? CONTROLLED_PAID_STAGING_CONFIRMATION : null,
    mission_execution_on_activation: false,
    production_deploy: false,
    external_writes: false
  };
}

async function augmentProjects(response, service) {
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('application/json')) return response;
  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  const snapshot = await service.handle({ method: 'GET', path: '/snapshot' });
  if (!snapshot.ok) return response;
  const items = (payload.items || []).map((item) => {
    const project = runtimeProject(snapshot.runtime, item.scope_key);
    if (!project || clean(project.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID) return item;
    return {
      ...item,
      controlled_paid_staging_snapshot: controlledPaidStagingSnapshot(project),
      controlled_paid_staging_activation: activationMetadata(project)
    };
  });
  return json({ ...payload, items }, 200, response);
}

async function augmentProjectDetail(response, service, scopeKey) {
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('application/json')) return response;
  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  const snapshot = await service.handle({ method: 'GET', path: '/snapshot' });
  if (!snapshot.ok) return response;
  const project = runtimeProject(snapshot.runtime, scopeKey);
  if (!project || clean(project.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID) return response;
  return json({
    ...payload,
    controlled_paid_staging: controlledPaidStagingSnapshot(project),
    controlled_paid_staging_activation: activationMetadata(project)
  }, 200, response);
}

function activationUiScript() {
  const projectId = JSON.stringify(CONTROLLED_PAID_STAGING_PROJECT_ID);
  const confirmation = JSON.stringify(CONTROLLED_PAID_STAGING_CONFIRMATION);
  const budget = JSON.stringify(CONTROLLED_PAID_STAGING_MAX_EUR);
  return `<script id="aurentara-deployment-activation-dashboard-v1-ui">(()=>{const PROJECT_ID=${projectId},CONFIRMATION=${confirmation},BUDGET=${budget};const policyHtml=s=>'<div class="human-grid kvs" style="margin-top:12px"><div class="kv"><b>Mode</b>'+esc(s.mode||'SAFE_DEFAULT')+'</div><div class="kv"><b>Budget</b>'+fmtMoney(s.project_budget_ceiling_eur||0)+'</div><div class="kv"><b>Spent</b>'+fmtMoney(s.current_spend_eur||0)+'</div><div class="kv"><b>Reserved</b>'+fmtMoney(s.reserved_eur||0)+'</div><div class="kv"><b>Remaining</b>'+fmtMoney(s.remaining_budget_eur||0)+'</div><div class="kv"><b>Paid Provider Calls</b>'+esc(s.paid_provider_calls||'NOT_AUTHORIZED')+'</div><div class="kv"><b>Production</b>'+esc(s.production||'LOCKED')+'</div><div class="kv"><b>External Writes</b>'+esc(s.external_customer_writes===false?'LOCKED':'UNKNOWN')+'</div></div>';const addProjectPolicy=d=>{const root=document.getElementById('project-detail');if(!root)return;const p=d?.project||{},s=d?.controlled_paid_staging,a=d?.controlled_paid_staging_activation;if(p.project_id!==PROJECT_ID||!s)return;let card=root.querySelector('[data-controlled-paid-staging]');if(card&&s.active)return;if(card)card.remove();card=document.createElement('div');card.className='card human-section';card.dataset.controlledPaidStaging='true';if(s.active){card.innerHTML='<div class="eyebrow">Gelato Activation</div><h2>CONTROLLED PAID STAGING</h2>'+policyHtml(s)+'<div class="callout good" style="margin-top:12px"><strong>Aktiv und serverseitig persistiert.</strong><div class="small">Keine Mission wurde durch die Aktivierung gestartet.</div></div>';}else{card.innerHTML='<div class="eyebrow">Gelato Activation</div><h2>Controlled Paid Staging aktivieren</h2><div class="callout warn"><strong>Projektbezogene Paid-Staging-Freigabe</strong><div class="small">Budget fest auf '+fmtMoney(BUDGET)+' · Production LOCKED · External Writes LOCKED · keine automatische Budgeterhöhung.</div></div><label style="display:flex;gap:9px;align-items:flex-start;margin:14px 0"><input id="gelato-paid-staging-confirm" type="checkbox" style="margin-top:3px"><span>Ich bestätige das Projektbudget von <b>'+fmtMoney(BUDGET)+'</b> für Gelato Donatello Controlled Paid Staging.</span></label><button class="btn primary" id="gelato-paid-staging-activate" disabled>25,00 € Budget bestätigen & aktivieren</button><div class="small" style="margin-top:9px">Aktivierung persistiert nur den Projektmodus. Sie startet keine Mission.</div>';const checkbox=card.querySelector('#gelato-paid-staging-confirm'),button=card.querySelector('#gelato-paid-staging-activate');checkbox.onchange=()=>button.disabled=!checkbox.checked;button.onclick=async()=>{button.disabled=true;setError(null);try{await api('/controlled-paid-staging/activate',{method:'POST',body:JSON.stringify({scope_key:p.scope_key,project_id:PROJECT_ID,project_budget_ceiling_eur:BUDGET,confirmation_text:CONFIRMATION})});await loadAll();state.selectedScope=p.scope_key;state.detail=await api('/project-detail/'+encodeURIComponent(p.scope_key));renderProjectDetail(state.detail)}catch(error){setError(error);button.disabled=!checkbox.checked}};}root.prepend(card)};const oldDetail=window.renderProjectDetail;if(typeof oldDetail==='function')window.renderProjectDetail=function(d){oldDetail(d);addProjectPolicy(d)};const applyMissionPolicy=()=>{const root=document.getElementById('mission');if(!root)return;const p=(state.data.projects?.items||[]).find(item=>item.scope_key===state.selectedScope);const s=p?.controlled_paid_staging_snapshot;if(p?.project_id!==PROJECT_ID||!s?.active)return;const existing=root.querySelector('[data-mission-controlled-paid-staging]');if(existing)existing.remove();const card=document.createElement('div');card.className='card';card.dataset.missionControlledPaidStaging='true';card.style.marginBottom='14px';card.innerHTML='<div class="eyebrow">Execution Policy</div><h2>CONTROLLED PAID STAGING</h2>'+policyHtml(s);root.prepend(card);for(const field of root.querySelectorAll('#mission-form .field')){const label=(field.querySelector('label')?.textContent||'').trim(),input=field.querySelector('input');if(!input)continue;if(label==='Budgetgrenze')input.value=fmtMoney(s.project_budget_ceiling_eur)+' Projektbudget';if(label==='Datenmodus')input.value='controlled-prelaunch'}const submit=root.querySelector('#mission-form button[type="submit"]');if(submit)submit.textContent='Mission verstehen & Controlled Paid Staging prüfen';const callout=root.querySelector('.grid.cols > .card:nth-child(2) .callout');if(callout)callout.innerHTML='<strong>Controlled Paid Staging</strong><div class="small">'+fmtMoney(s.remaining_budget_eur)+' verbleibend · Paid Provider Calls nur innerhalb des Projektbudgets · Production und External Writes gesperrt.</div>'};const oldMission=window.renderMission;if(typeof oldMission==='function')window.renderMission=function(){oldMission();applyMissionPolicy()};})();</script>`;
}

function injectActivationUi(source) {
  if (source.includes('aurentara-deployment-activation-dashboard-v1-ui')) return source;
  const script = activationUiScript();
  return source.includes('</body>') ? source.replace('</body>', `${script}</body>`) : `${source}${script}`;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  const operatorRoute = url.pathname === '/operator' || url.pathname === '/operator/' || url.pathname.startsWith('/operator/api/');
  if (!operatorRoute) return handleExistingDashboard(request, env, ctx, options);

  if (url.pathname === '/operator/api/runtime-version') {
    const auth = await authorizeOperator(request, env, ctx, options);
    if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED', production_deploy: false }, 405);
    return deploymentIdentityResponse(env);
  }

  if (url.pathname === '/operator' || url.pathname === '/') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
    const source = await response.text();
    const body = injectActivationUi(injectDeploymentIdentity(source, env));
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }

  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return handleExistingDashboard(request, env, ctx, options);
  const service = options.runtime_service;
  if (!service) return handleExistingDashboard(request, env, ctx, options);

  if (url.pathname === '/operator/api/controlled-paid-staging/activate') {
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED', production_deploy: false }, 405);
    if (typeof service.activateControlledPaidStaging !== 'function') return json({ error: 'CONTROLLED_PAID_STAGING_DURABLE_ACTIVATION_NOT_AVAILABLE', production_deploy: false }, 503);
    const body = await readJson(request);
    if (clean(body.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID) return json({ error: 'CONTROLLED_PAID_STAGING_PROJECT_NOT_ELIGIBLE', production_deploy: false }, 400);
    if (money(body.project_budget_ceiling_eur) !== CONTROLLED_PAID_STAGING_MAX_EUR) return json({ error: 'CONTROLLED_PAID_STAGING_BUDGET_CONFIRMATION_REQUIRED', required_budget_eur: CONTROLLED_PAID_STAGING_MAX_EUR, production_deploy: false }, 400);
    if (clean(body.confirmation_text, 200) !== CONTROLLED_PAID_STAGING_CONFIRMATION) return json({ error: 'CONTROLLED_PAID_STAGING_CONFIRMATION_REQUIRED', production_deploy: false }, 400);
    const snapshot = await service.handle({ method: 'GET', path: '/snapshot' });
    if (!snapshot.ok) return json({ error: 'OPERATOR_RUNTIME_SNAPSHOT_REQUIRED', production_deploy: false }, 503);
    const scopeKey = clean(body.scope_key, 320);
    const project = runtimeProject(snapshot.runtime, scopeKey);
    if (!project || clean(project.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID) return json({ error: 'CONTROLLED_PAID_STAGING_PROJECT_NOT_ELIGIBLE', production_deploy: false }, 400);
    const activated = await service.activateControlledPaidStaging({
      scope_key: scopeKey,
      project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
      project_budget_ceiling_eur: CONTROLLED_PAID_STAGING_MAX_EUR,
      confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
      expected_revision: snapshot.runtime.revision
    });
    return json(activated.body, activated.status || (activated.ok ? 201 : 400));
  }

  if (url.pathname === '/operator/api/projects' && request.method === 'GET') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    return augmentProjects(response, service);
  }

  const detailPrefix = url.pathname.startsWith('/operator/api/project-detail/')
    ? '/operator/api/project-detail/'
    : url.pathname.startsWith('/operator/api/project-workspace/')
      ? '/operator/api/project-workspace/'
      : null;
  if (detailPrefix && request.method === 'GET') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    let scopeKey = '';
    try { scopeKey = decodeURIComponent(url.pathname.slice(detailPrefix.length)); } catch { return response; }
    return augmentProjectDetail(response, service, scopeKey);
  }

  return handleExistingDashboard(request, env, ctx, options);
}

export function operatorDeploymentActivationDashboardManifest() {
  return {
    schema: 'aurentara.operator-deployment-activation-dashboard.v1',
    deployment_identity_runtime_evidence: true,
    runtime_version_endpoint: 'GET /operator/api/runtime-version',
    version_unknown_fail_safe: true,
    cache_safe: true,
    controlled_paid_staging_activation: true,
    project_budget_eur: CONTROLLED_PAID_STAGING_MAX_EUR,
    durable_runtime_persistence: true,
    mission_execution_on_activation: false,
    secrets_exposed: false,
    external_writes: false,
    production_deploy: false
  };
}
