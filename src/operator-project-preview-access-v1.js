import { handleOperatorDashboard as handleExistingOperatorDashboard } from './operator-dashboard-human-input-closure-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import { buildOperatorDeploymentIdentity } from './operator-deployment-identity-v1.js';
import {
  resolveProjectPreviewAccess,
  canonicalPreviewRawUrl,
  projectPreviewAccessManifest
} from './project-preview-access-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function json(body, status = 200, source = null) {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-project-preview-access-v1', 'enabled');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

function deployedSha(env = {}, options = {}) {
  const explicit = clean(options.project_preview_canonical_sha, 80).toLowerCase();
  if (/^[0-9a-f]{40}$/.test(explicit)) return explicit;
  const identity = buildOperatorDeploymentIdentity(env);
  return clean(identity.deployed_sha, 80).toLowerCase();
}

async function projectDetailPayload(request, env, ctx, options, scopeKey) {
  const url = new URL(request.url);
  url.pathname = '/operator/api/project-detail/' + encodeURIComponent(scopeKey);
  url.search = '';
  const sub = new Request(url.toString(), { method: 'GET', headers: request.headers });
  const response = await handleExistingOperatorDashboard(sub, env, ctx, options);
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('application/json')) {
    return { ok: false, response };
  }
  try {
    return { ok: true, response, payload: await response.clone().json() };
  } catch {
    return { ok: false, response };
  }
}

function accessForPayload(payload = {}, env = {}, options = {}, scopeKey = '') {
  return resolveProjectPreviewAccess(payload, {
    scope_key: scopeKey || payload?.project?.scope_key,
    deployed_sha: deployedSha(env, options)
  });
}

async function resolveAccess(request, env, ctx, options, scopeKey) {
  const detail = await projectDetailPayload(request, env, ctx, options, scopeKey);
  if (!detail.ok) return { ok: false, response: detail.response };
  return { ok: true, detail, access: accessForPayload(detail.payload, env, options, scopeKey) };
}

function positiveFinalHumanApproval(body = {}) {
  if (clean(body.question_id, 160).toUpperCase() !== 'FINAL_HUMAN_QUALITY_APPROVAL') return false;
  const controls = body.controls && typeof body.controls === 'object' ? body.controls : {};
  return Object.values(controls).some((value) => value && typeof value === 'object' && value.approved === true);
}

async function serveProjectPreview(request, env, ctx, options, scopeKey) {
  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);

  const resolved = await resolveAccess(request, env, ctx, options, scopeKey);
  if (!resolved.ok) return resolved.response || json({ error: 'PROJECT_PREVIEW_PROJECT_NOT_FOUND', production_deploy: false }, 404);
  const access = resolved.access;
  if (!access.available) return json({ error: 'PROJECT_PREVIEW_NOT_AVAILABLE', preview_access: access, production_deploy: false }, 404);

  if (access.access_kind === 'EXISTING_PRIVATE_PREVIEW_URL') {
    return Response.redirect(access.preview_url, 302);
  }

  const rawUrl = canonicalPreviewRawUrl(access);
  if (!rawUrl) return json({ error: 'PROJECT_PREVIEW_CANONICAL_ARTIFACT_INVALID', preview_access: access, production_deploy: false }, 409);
  const fetchImpl = typeof options.project_preview_fetch === 'function' ? options.project_preview_fetch : fetch;
  let upstream;
  try {
    upstream = await fetchImpl(rawUrl, { method: 'GET', headers: { accept: 'text/html' }, redirect: 'follow' });
  } catch {
    return json({ error: 'PROJECT_PREVIEW_CANONICAL_ARTIFACT_FETCH_FAILED', preview_access: access, production_deploy: false }, 502);
  }
  if (!upstream?.ok) return json({ error: 'PROJECT_PREVIEW_CANONICAL_ARTIFACT_FETCH_FAILED', status: upstream?.status || 502, preview_access: access, production_deploy: false }, 502);
  const html = await upstream.text();
  if (!html || html.length > 2_000_000) return json({ error: 'PROJECT_PREVIEW_CANONICAL_ARTIFACT_INVALID_SIZE', production_deploy: false }, 502);

  const headers = new Headers();
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-robots-tag', 'noindex, nofollow');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:; script-src 'none'; connect-src 'none'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'");
  headers.set('x-aurentara-project-preview-scope', scopeKey);
  headers.set('x-aurentara-project-preview-revision', access.source_revision);
  return new Response(html, { status: 200, headers });
}

function uiInjection() {
  return `<style id="aurentara-project-preview-access-v1-style">
.project-preview-access-v1{margin-top:14px;min-width:0;max-width:100%;overflow:hidden}.project-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0}.project-preview-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;min-width:0;max-width:100%}.project-preview-kv{border:1px solid var(--soft);border-radius:10px;padding:9px;min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word}.project-preview-kv .mono{white-space:normal;overflow-wrap:anywhere;word-break:break-word}.project-preview-final-action{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--soft);min-width:0;max-width:100%;overflow:hidden}.project-preview-final-action .btn{max-width:100%;white-space:normal;text-align:center;overflow-wrap:anywhere}@media(max-width:760px){.project-preview-meta{grid-template-columns:minmax(0,1fr)}.project-preview-access-v1 .btn,.project-preview-final-action .btn{width:100%;min-height:46px}}
</style><script id="aurentara-project-preview-access-v1-ui">(()=>{if(window.__aurentaraProjectPreviewAccessV1)return;window.__aurentaraProjectPreviewAccessV1=true;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null;
const previewCard=(d)=>{const root=document.getElementById('project-detail');if(!root)return;const p=d?.project||{},a=d?.project_preview_access||null;current=a;let card=root.querySelector('[data-project-preview-access]');if(card)card.remove();card=document.createElement('div');card.className='card project-preview-access-v1';card.dataset.projectPreviewAccess='true';const available=a?.available===true;const route=a?.operator_route||'';card.innerHTML='<div class="project-preview-head"><div><div class="eyebrow">Project Preview</div><h2 style="margin:3px 0">Vorschau</h2><div class="small">Projektgebundene Vorschau für '+e(p.name||p.project_id||'dieses Projekt')+'</div></div><span class="badge '+(available?'ready':'attention')+'">'+e(a?.status||'NOT_AVAILABLE')+'</span></div>'+(available?'<div class="project-preview-meta"><div class="project-preview-kv"><b>Provider</b>'+e(a.provider||'Existing Preview')+'</div><div class="project-preview-kv"><b>Revision</b><span class="mono">'+e(a.source_revision||'runtime preview')+'</span></div><div class="project-preview-kv"><b>Scope</b><span class="mono">'+e(a.scope_key||p.scope_key||'')+'</span></div></div><div class="actions" style="margin-top:10px"><a class="btn primary" data-project-preview-open href="'+e(route)+'" target="_blank" rel="noopener noreferrer">Vorschau öffnen ↗</a></div>':'<div class="callout warn" style="margin-top:10px"><strong>Preview noch nicht verfügbar.</strong><div class="small">'+e(a?.reason||'Für dieses Projekt ist noch keine echte Preview registriert.')+'</div></div>');root.prepend(card);enhanceFinal()};
const enhanceFinal=()=>{const q=document.querySelector('[data-human-question="FINAL_HUMAN_QUALITY_APPROVAL"]');if(!q)return;const available=current?.available===true;let box=q.querySelector('[data-project-preview-final-action]');if(!box){box=document.createElement('div');box.className='project-preview-final-action';box.dataset.projectPreviewFinalAction='true';box.innerHTML=available?'<strong>Finale Sichtprüfung</strong><div class="small">Öffne zuerst die tatsächliche projektgebundene Vorschau. Kehre danach zu dieser Freigabe zurück.</div><a class="btn primary" style="margin-top:8px" href="'+e(current.operator_route||'')+'" target="_blank" rel="noopener noreferrer">Tatsächliche Vorschau öffnen ↗</a>':'<strong>Finale Sichtprüfung blockiert</strong><div class="small">Für dieses Projekt ist noch keine Preview verfügbar. Eine positive Human Quality Approval ist deshalb nicht zulässig.</div>';const controls=q.querySelector('.human-input-controls');if(controls)q.insertBefore(box,controls);else q.prepend(box);}const yes=q.querySelector('input[type=radio][value="yes"]'),seen=q.querySelector('input[data-human-preview]');if(yes)yes.disabled=!available;if(seen)seen.disabled=!available;};
const old=window.renderProjectDetail;if(typeof old==='function')window.renderProjectDetail=function(d){old(d);previewCard(d);setTimeout(enhanceFinal,0)};
const observer=new MutationObserver(()=>enhanceFinal());observer.observe(document.body,{childList:true,subtree:true});
})();</script>`;
}

function injectUi(source = '') {
  if (source.includes('aurentara-project-preview-access-v1-ui')) return source;
  const ui = uiInjection();
  return source.includes('</body>') ? source.replace('</body>', ui + '</body>') : source + ui;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/operator/project-preview/') && request.method === 'GET') {
    let scopeKey = '';
    try { scopeKey = decodeURIComponent(url.pathname.slice('/operator/project-preview/'.length)); } catch { return json({ error: 'INVALID_PROJECT_SCOPE_ENCODING', production_deploy: false }, 400); }
    if (!scopeKey) return json({ error: 'PROJECT_SCOPE_REQUIRED', production_deploy: false }, 400);
    return serveProjectPreview(request, env, ctx, options, scopeKey);
  }

  if (url.pathname === '/operator/api/project-preview-access' && request.method === 'GET') {
    const auth = await authorizeOperator(request, env, ctx, options);
    if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
    const scopeKey = clean(url.searchParams.get('scope_key'), 640);
    if (!scopeKey) return json({ error: 'PROJECT_SCOPE_REQUIRED', production_deploy: false }, 400);
    const resolved = await resolveAccess(request, env, ctx, options, scopeKey);
    if (!resolved.ok) return resolved.response || json({ error: 'PROJECT_NOT_FOUND', production_deploy: false }, 404);
    return json({ ok: true, preview_access: resolved.access, production_deploy: false }, 200);
  }

  if (url.pathname === '/operator/api/project-source-intake/human-decision' && request.method === 'POST') {
    let body = {};
    try { body = await request.clone().json(); } catch {}
    if (positiveFinalHumanApproval(body)) {
      const scopeKey = clean(body.scope_key, 640);
      const auth = await authorizeOperator(request, env, ctx, options);
      if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
      const resolved = await resolveAccess(request, env, ctx, options, scopeKey);
      if (!resolved.ok || !resolved.access?.available) {
        return json({ error: 'HUMAN_QUALITY_APPROVAL_PREVIEW_NOT_AVAILABLE', preview_access: resolved.access || null, production_deploy: false }, 409);
      }
    }
  }

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;

  if (request.method === 'GET' && url.pathname.startsWith('/operator/api/project-detail/') && response.status === 200 && (response.headers.get('content-type') || '').includes('application/json')) {
    let payload;
    try { payload = await response.clone().json(); } catch { return response; }
    let scopeKey = '';
    try { scopeKey = decodeURIComponent(url.pathname.slice('/operator/api/project-detail/'.length)); } catch { return response; }
    const access = accessForPayload(payload, env, options, scopeKey);
    return json({ ...payload, project_preview_access: access }, 200, response);
  }

  const type = response.headers.get('content-type') || '';
  if ((url.pathname === '/operator' || url.pathname === '/operator/') && response.status === 200 && type.includes('text/html')) {
    const source = await response.text();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('x-aurentara-project-preview-access-v1', 'enabled');
    return new Response(injectUi(source), { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}

export function operatorProjectPreviewAccessManifest() {
  return {
    ...projectPreviewAccessManifest(),
    existing_masterdashboard_extended: true,
    existing_project_detail_reused: true,
    existing_human_input_closure_reused: true,
    final_human_approval_requires_preview_available: true,
    preview_open_action_in_project_detail: true,
    preview_open_action_in_final_human_question: true,
    desktop_mobile: true,
    production_deploy: false
  };
}
