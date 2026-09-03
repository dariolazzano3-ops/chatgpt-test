import { handleOperatorDashboard as handleExistingDashboard } from './operator-deployment-activation-dashboard-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import {
  intakeManualSource,
  intakeFileSource,
  intakeImageSource,
  intakeWebsiteSource,
  buildWorkspacePacksAndReadiness
} from './project-source-workspace-intake-v1.js';
import { deleteProjectSource } from './project-source-intake-v1.js';
import { buildProjectSourceIntakeWorkspaceSections } from './operator-project-source-intake-workspace-v1.js';
import {
  createProjectSourceStorageClient,
  PROJECT_SOURCE_STORAGE_MIME_TYPES,
  PROJECT_SOURCE_UPLOAD_LIMITS
} from './project-source-storage-supabase-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const PUBLISHABLE_RIGHTS = new Set(['OWNED_CONFIRMED', 'CUSTOMER_LICENSED', 'CUSTOMER_ASSERTED']);
const RIGHTS = new Set(['OWNED_CONFIRMED', 'CUSTOMER_LICENSED', 'CUSTOMER_ASSERTED', 'UNKNOWN', 'DO_NOT_PUBLISH']);

function json(body, status = 200, source = null) {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-extension', 'project-source-intake-storage-v1');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.clone().json(); } catch { return {}; }
}

function rightsValue(value, fallback = 'CUSTOMER_ASSERTED') {
  const normalized = clean(value, 80).toUpperCase();
  return RIGHTS.has(normalized) ? normalized : fallback;
}

function sourceById(state = {}, sourceId = '') {
  return (state.sources || []).find((source) => source.source_id === sourceId && !source.deleted_at) || null;
}

function sourceForStorageRef(state = {}, storageRef = '') {
  return (state.sources || []).find((source) => source.storage_ref === storageRef && !source.deleted_at) || null;
}

function softDeleteSource(state = {}, sourceId = '', at = null) {
  const current = sourceById(state, sourceId);
  if (!current) return { ok: false, error: 'PROJECT_SOURCE_NOT_FOUND' };
  const deleted = deleteProjectSource(state, sourceId, { at });
  if (!deleted.ok) return deleted;
  const next = structuredClone(deleted.state);
  next.assets = (next.assets || []).map((asset) => asset.source_id === sourceId
    ? { ...asset, rights_status: 'DO_NOT_PUBLISH', publishable: false, editable: false, derivative_allowed: false, deleted_at: clean(at, 100) || new Date().toISOString() }
    : asset);
  return { ok: true, state: next, source: current };
}

function workspacePayload(read = {}) {
  const workspace = buildProjectSourceIntakeWorkspaceSections(read.state || {});
  return {
    schema: 'aurentara.operator-project-source-intake-storage.v1',
    project: read.project,
    identity: read.identity,
    workspace,
    persisted: read.persisted === true,
    runtime_revision: read.runtime_revision,
    storage: {
      bucket: 'project-source-intake-private',
      private: true,
      public_access: false,
      direct_browser_storage_access: false,
      binary_in_runtime_json: false,
      max_files_per_request: PROJECT_SOURCE_UPLOAD_LIMITS.max_files_per_request,
      allowed_mime_types: PROJECT_SOURCE_STORAGE_MIME_TYPES
    },
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  };
}

async function loadIntake(service, scopeKey) {
  if (!service || typeof service.getProjectSourceIntake !== 'function') return { ok: false, status: 503, body: { error: 'PROJECT_SOURCE_INTAKE_RUNTIME_SERVICE_NOT_AVAILABLE' } };
  return service.getProjectSourceIntake({ scope_key: clean(scopeKey, 640) });
}

async function saveIntake(service, read, state, event) {
  if (!service || typeof service.saveProjectSourceIntake !== 'function') return { ok: false, status: 503, body: { error: 'PROJECT_SOURCE_INTAKE_RUNTIME_SERVICE_NOT_AVAILABLE' } };
  return service.saveProjectSourceIntake({ state, expected_revision: read.body.runtime_revision, event });
}

function storageClient(env, options = {}) {
  return options.project_source_storage_client || createProjectSourceStorageClient(env, { fetcher: options.project_source_storage_fetcher });
}

async function rollback(storage, uploaded = [], identity = {}) {
  for (const item of [...uploaded].reverse()) {
    try { await storage.remove(item.storage_ref, identity); } catch {}
  }
}

async function handleUpload(request, env, service, options = {}) {
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'PROJECT_SOURCE_MULTIPART_FORM_REQUIRED', production_deploy: false }, 400); }
  const scopeKey = clean(form.get('scope_key'), 640);
  const read = await loadIntake(service, scopeKey);
  if (!read.ok) return json(read.body, read.status || 400);
  const files = form.getAll('files').filter((file) => file && typeof file.arrayBuffer === 'function' && clean(file.name, 500));
  if (!files.length) return json({ error: 'PROJECT_SOURCE_UPLOAD_FILES_REQUIRED', production_deploy: false }, 400);
  if (files.length > PROJECT_SOURCE_UPLOAD_LIMITS.max_files_per_request) return json({ error: 'PROJECT_SOURCE_UPLOAD_FILE_COUNT_EXCEEDED', max_files: PROJECT_SOURCE_UPLOAD_LIMITS.max_files_per_request, production_deploy: false }, 413);
  const replaceSourceId = clean(form.get('replace_source_id'), 200);
  if (replaceSourceId && files.length !== 1) return json({ error: 'PROJECT_SOURCE_REPLACE_REQUIRES_SINGLE_FILE', production_deploy: false }, 400);
  if (replaceSourceId && !sourceById(read.body.state, replaceSourceId)) return json({ error: 'PROJECT_SOURCE_REPLACE_TARGET_NOT_FOUND', production_deploy: false }, 404);

  const rights = rightsValue(form.get('rights_status'));
  const usageRole = clean(form.get('usage_role'), 120) || 'PROJECT_VISUAL';
  let storage;
  try { storage = storageClient(env, options); } catch { return json({ error: 'PROJECT_SOURCE_STORAGE_NOT_CONFIGURED', secret_exposed: false, production_deploy: false }, 503); }
  const uploaded = await storage.uploadMany(files, read.body.identity);
  if (!uploaded.ok) return json(uploaded, uploaded.error?.includes('TOO_LARGE') ? 413 : 400);

  let state = read.body.state;
  const intakeItems = [];
  for (const item of uploaded.items) {
    const common = {
      source_id: item.source_id,
      filename: item.filename,
      display_name: item.filename,
      storage_ref: item.storage_ref,
      mime_type: item.mime_type,
      content_hash: item.content_hash,
      ownership_status: rights,
      usage_attestation: { source: 'operator_upload', rights_status: rights, scope_key: read.body.identity.scope_key }
    };
    const integrated = item.kind === 'image'
      ? intakeImageSource(state, { ...common, asset_id: `asset_${item.source_id}`, rights_status: rights, usage_role: usageRole, publishable: PUBLISHABLE_RIGHTS.has(rights) })
      : intakeFileSource(state, common);
    if (!integrated.ok) {
      await rollback(storage, uploaded.items, read.body.identity);
      return json({ ...integrated, storage_rollback: true, production_deploy: false }, 400);
    }
    state = integrated.state;
    intakeItems.push({ source: integrated.source, asset: integrated.asset || null, parser_status: integrated.parser_status || null, storage: item });
  }

  let replacement = null;
  if (replaceSourceId) {
    const retired = softDeleteSource(state, replaceSourceId);
    if (!retired.ok) {
      await rollback(storage, uploaded.items, read.body.identity);
      return json({ ...retired, storage_rollback: true, production_deploy: false }, 400);
    }
    state = retired.state;
    replacement = {
      replaces_source_id: replaceSourceId,
      previous_storage_ref: retired.source.storage_ref,
      previous_object_retained_for_traceability: true,
      blind_overwrite: false
    };
  }

  const saved = await saveIntake(service, read, state, replacement ? 'PROJECT_SOURCE_REPLACEMENT_RECORDED' : 'PROJECT_SOURCE_UPLOAD_RECORDED');
  if (!saved.ok) {
    await rollback(storage, uploaded.items, read.body.identity);
    return json({ ...saved.body, storage_rollback: true, production_deploy: false }, saved.status || 409);
  }
  const latest = await loadIntake(service, scopeKey);
  return json({
    ok: true,
    items: intakeItems.map((item) => ({ source: item.source, asset: item.asset, parser_status: item.parser_status, storage_ref: item.storage.storage_ref, filename_was_sanitized: item.storage.filename_was_sanitized })),
    replacement,
    workspace: latest.ok ? workspacePayload(latest.body).workspace : null,
    runtime_revision: saved.body.runtime_revision,
    binary_data_in_runtime_json: false,
    multi_upload: files.length > 1,
    bulk_rights_status: rights,
    mobile_compatible_multipart: true,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  }, 201);
}

async function handleDelete(request, env, service, options = {}) {
  const body = await readJson(request);
  const scopeKey = clean(body.scope_key, 640);
  let read = await loadIntake(service, scopeKey);
  if (!read.ok) return json(read.body, read.status || 400);
  const sourceId = clean(body.source_id, 200);
  const source = sourceById(read.body.state, sourceId);
  if (!source || !source.storage_ref) return json({ error: 'PROJECT_SOURCE_STORED_SOURCE_NOT_FOUND', production_deploy: false }, 404);
  let storage;
  try { storage = storageClient(env, options); } catch { return json({ error: 'PROJECT_SOURCE_STORAGE_NOT_CONFIGURED', secret_exposed: false, production_deploy: false }, 503); }
  const removed = await storage.remove(source.storage_ref, read.body.identity);
  if (!removed.ok) return json(removed, removed.error === 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED' ? 403 : 502);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const deleted = softDeleteSource(read.body.state, sourceId);
    if (!deleted.ok) return json({ ...deleted, storage_deleted: true, production_deploy: false }, 409);
    const saved = await saveIntake(service, read, deleted.state, 'PROJECT_SOURCE_STORAGE_OBJECT_DELETED');
    if (saved.ok) return json({ ok: true, source_id: sourceId, storage_deleted: true, soft_deleted: true, runtime_revision: saved.body.runtime_revision, project_scoped: true, production_deploy: false });
    if (saved.status !== 409) return json({ ...saved.body, storage_deleted: true, production_deploy: false }, saved.status || 500);
    read = await loadIntake(service, scopeKey);
    if (!read.ok) break;
    if (!sourceById(read.body.state, sourceId)) return json({ ok: true, source_id: sourceId, storage_deleted: true, soft_deleted: true, idempotent_replay: true, production_deploy: false });
  }
  return json({ error: 'PROJECT_SOURCE_DELETE_RUNTIME_RECONCILIATION_FAILED', storage_deleted: true, production_deploy: false }, 409);
}

async function handleDownload(request, env, service, options = {}) {
  const url = new URL(request.url);
  const scopeKey = clean(url.searchParams.get('scope_key'), 640);
  const storageRef = clean(url.searchParams.get('storage_ref'), 4000);
  const read = await loadIntake(service, scopeKey);
  if (!read.ok) return json(read.body, read.status || 400);
  const source = sourceForStorageRef(read.body.state, storageRef);
  if (!source) return json({ error: 'PROJECT_SOURCE_STORAGE_REF_NOT_REGISTERED_IN_PROJECT', production_deploy: false }, 404);
  let storage;
  try { storage = storageClient(env, options); } catch { return json({ error: 'PROJECT_SOURCE_STORAGE_NOT_CONFIGURED', secret_exposed: false, production_deploy: false }, 503); }
  const downloaded = await storage.download(storageRef, read.body.identity);
  if (!downloaded.ok) return json(downloaded, downloaded.error === 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED' ? 403 : 404);
  const headers = new Headers();
  headers.set('content-type', downloaded.content_type || source.mime_type || 'application/octet-stream');
  headers.set('cache-control', 'private, no-store');
  headers.set('content-disposition', `attachment; filename="${clean(source.display_name, 140).replace(/["\\]/g, '_') || 'project-source'}"`);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-public-active', 'false');
  return new Response(downloaded.response.body, { status: 200, headers });
}

async function handleManual(request, service) {
  const body = await readJson(request);
  const read = await loadIntake(service, body.scope_key);
  if (!read.ok) return json(read.body, read.status || 400);
  const facts = (Array.isArray(body.facts) ? body.facts : []).slice(0, 30).map((fact) => ({
    fact_id: clean(fact.fact_id, 200) || undefined,
    field_path: clean(fact.field_path, 320),
    value: fact.value,
    origin: 'MANUAL',
    verification_status: 'UNVERIFIED',
    critical: fact.critical === true
  })).filter((fact) => fact.field_path && fact.value !== undefined && fact.value !== null && clean(typeof fact.value === 'string' ? fact.value : JSON.stringify(fact.value), 1));
  if (!facts.length) return json({ error: 'PROJECT_SOURCE_MANUAL_FACTS_REQUIRED', production_deploy: false }, 400);
  const result = intakeManualSource(read.body.state, {
    source_id: clean(body.source_id, 200) || undefined,
    display_name: clean(body.display_name, 300) || 'Operator manual information',
    ownership_status: 'CUSTOMER_ASSERTED',
    facts
  });
  if (!result.ok) return json(result, 400);
  const saved = await saveIntake(service, read, result.state, 'PROJECT_SOURCE_MANUAL_INPUT_RECORDED');
  if (!saved.ok) return json(saved.body, saved.status || 409);
  return json({ ok: true, source: result.source, facts: result.facts, runtime_revision: saved.body.runtime_revision, auto_verified: false, production_deploy: false }, 201);
}

async function handleWebsite(request, service, options = {}) {
  const body = await readJson(request);
  const read = await loadIntake(service, body.scope_key);
  if (!read.ok) return json(read.body, read.status || 400);
  const result = await intakeWebsiteSource(read.body.state, {
    source_url: clean(body.source_url, 2000),
    reference_only: body.reference_only === true,
    ownership_status: body.reference_only === true ? 'PUBLIC_REFERENCE_ONLY' : 'CUSTOMER_ASSERTED',
    display_name: clean(body.display_name, 300) || 'Website source'
  }, options.website_import_deps || {});
  if (!result.ok) return json(result, 400);
  const saved = await saveIntake(service, read, result.state, 'PROJECT_SOURCE_WEBSITE_IMPORTED');
  if (!saved.ok) return json(saved.body, saved.status || 409);
  return json({ ok: true, source: result.source, import_result: result.import_result, extracted_is_verified: false, variable_cost_eur: 0, paid_provider_calls: 0, runtime_revision: saved.body.runtime_revision, production_deploy: false }, 201);
}

async function handlePacks(request, service) {
  const body = await readJson(request);
  const read = await loadIntake(service, body.scope_key);
  if (!read.ok) return json(read.body, read.status || 400);
  const result = buildWorkspacePacksAndReadiness(read.body.state, {
    will_show_pricing: body.will_show_pricing === true,
    will_show_opening_hours: body.will_show_opening_hours === true,
    will_show_address: body.will_show_address === true,
    will_show_phone: body.will_show_phone === true,
    will_show_email: body.will_show_email === true,
    legal_required: body.legal_required === true,
    requires_assets: body.requires_assets === true,
    intended_asset_ids: Array.isArray(body.intended_asset_ids) ? body.intended_asset_ids : []
  });
  if (!result.ok) return json(result, 400);
  const saved = await saveIntake(service, read, result.state, 'PROJECT_SOURCE_PACKS_AND_READINESS_RECORDED');
  if (!saved.ok) return json(saved.body, saved.status || 409);
  return json({ ok: true, content_pack: result.content_pack, visual_pack: result.visual_pack, readiness: result.readiness, runtime_revision: saved.body.runtime_revision, variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false }, 201);
}

function sourceUi() {
  const accept = PROJECT_SOURCE_STORAGE_MIME_TYPES.join(',');
  return `<style id="aurentara-project-source-storage-v1-style">.source-intake-v1{margin-top:14px}.source-upload-grid{display:grid;grid-template-columns:1.2fr .8fr .8fr auto;gap:9px;align-items:end}.source-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.source-card{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;min-width:0}.source-card strong{display:block;overflow-wrap:anywhere}.source-card .small{overflow-wrap:anywhere}.source-tools{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.source-manual-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}@media(max-width:760px){.source-upload-grid,.source-cards,.source-manual-grid{grid-template-columns:1fr}.source-upload-grid .btn{width:100%;min-height:46px}.source-intake-v1 input[type=file]{min-height:48px;padding:10px}.source-card{padding:14px}}</style><script id="aurentara-project-source-storage-v1-ui">(()=>{const ACCEPT=${JSON.stringify(accept)};const sourceFetch=async(path,opt={})=>{const res=await fetch('/operator/api/project-source-intake'+path,opt);const type=res.headers.get('content-type')||'';const data=type.includes('json')?await res.json():res;if(!res.ok){const e=new Error(data?.error||('HTTP '+res.status));e.data=data;throw e}return data};const renderSources=(root,payload)=>{const list=payload?.workspace?.sections?.project_sources||[];const assets=payload?.workspace?.sections?.project_knowledge||[];const ready=payload?.workspace?.sections?.content_readiness;root.querySelector('[data-source-status]').innerHTML='<span class="badge '+(ready?.status==='BLOCKED'?'blocked':ready?'ready':'neutral')+'">'+esc(ready?.status||'INTAKE IN PROGRESS')+'</span> · '+esc(list.length)+' Sources';const cards=root.querySelector('[data-source-cards]');cards.innerHTML=list.length?list.map(s=>'<div class="source-card"><strong>'+esc(s.display_name||s.source_type)+'</strong><div class="small">'+esc(s.source_type)+' · '+esc(s.mime_type||'')+'</div><div class="small">Rights: '+esc(s.ownership_status||'UNKNOWN')+'</div><div class="small">Private storage: '+(s.storage_ref?'yes':'no')+'</div><div class="source-tools">'+(s.storage_ref?'<button class="btn" data-source-open="'+esc(s.source_id)+'">Ansehen</button><button class="btn danger" data-source-delete="'+esc(s.source_id)+'">Löschen</button>':'')+'</div></div>').join(''):'<div class="empty">Noch keine Project Sources.</div>';cards.querySelectorAll('[data-source-open]').forEach(b=>b.onclick=()=>{const s=list.find(x=>x.source_id===b.dataset.sourceOpen);if(s?.storage_ref)window.open('/operator/api/project-source-intake/object?scope_key='+encodeURIComponent(payload.identity.scope_key)+'&storage_ref='+encodeURIComponent(s.storage_ref),'_blank','noopener')});cards.querySelectorAll('[data-source-delete]').forEach(b=>b.onclick=async()=>{try{await sourceFetch('/object',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:payload.identity.scope_key,source_id:b.dataset.sourceDelete})});await hydrate(root,payload.identity.scope_key)}catch(e){setError(e)}})};const hydrate=async(root,scope)=>{const payload=await sourceFetch('?scope_key='+encodeURIComponent(scope));root.dataset.scope=scope;renderSources(root,payload)};const install=d=>{const host=document.getElementById('project-detail');const p=d?.project;if(!host||!p?.scope_key)return;let root=host.querySelector('[data-project-source-intake]');if(!root){root=document.createElement('div');root.className='card source-intake-v1';root.dataset.projectSourceIntake='true';root.innerHTML='<div class="eyebrow">Project Knowledge</div><h2>Project Sources</h2><div class="small" data-source-status>Loading…</div><div class="source-upload-grid" style="margin-top:12px"><div class="field"><label>Dateien / Bilder</label><input type="file" multiple accept="'+esc(ACCEPT)+'" data-source-files></div><div class="field"><label>Bulk Rights</label><select data-source-rights><option> CUSTOMER_ASSERTED </option><option> OWNED_CONFIRMED </option><option> CUSTOMER_LICENSED </option><option> DO_NOT_PUBLISH </option></select></div><div class="field"><label>Usage</label><select data-source-usage><option value="PROJECT_VISUAL">Project Visual</option><option value="LOGO">Logo</option><option value="GALLERY">Gallery</option></select></div><button class="btn primary" data-source-upload>Upload</button></div><div class="source-cards" data-source-cards></div><details class="details"><summary>Weitere Source Actions</summary><div class="source-manual-grid"><div class="field"><label>Website URL</label><input data-source-url placeholder="https://..."></div><button class="btn" data-source-website style="align-self:end">Website hinzufügen</button><div class="field"><label>Manuelle Info</label><textarea data-source-manual placeholder="Kurze bestätigungsbedürftige Projektinformation"></textarea></div><div class="field"><label>Feld</label><input data-source-field placeholder="content.summary"><button class="btn" data-source-manual-save style="margin-top:8px">Info hinzufügen</button></div></div></details>';host.prepend(root);root.querySelector('[data-source-upload]').onclick=async()=>{const files=[...root.querySelector('[data-source-files]').files];if(!files.length)return;const fd=new FormData();fd.append('scope_key',p.scope_key);fd.append('rights_status',root.querySelector('[data-source-rights]').value.trim());fd.append('usage_role',root.querySelector('[data-source-usage]').value);files.forEach(f=>fd.append('files',f,f.name));try{root.classList.add('loading');await sourceFetch('/upload',{method:'POST',body:fd});root.querySelector('[data-source-files]').value='';await hydrate(root,p.scope_key)}catch(e){setError(e)}finally{root.classList.remove('loading')}};root.querySelector('[data-source-website]').onclick=async()=>{const u=root.querySelector('[data-source-url]').value.trim();if(!u)return;try{await sourceFetch('/website',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:p.scope_key,source_url:u})});root.querySelector('[data-source-url]').value='';await hydrate(root,p.scope_key)}catch(e){setError(e)}};root.querySelector('[data-source-manual-save]').onclick=async()=>{const value=root.querySelector('[data-source-manual]').value.trim(),field=root.querySelector('[data-source-field]').value.trim()||'content.summary';if(!value)return;try{await sourceFetch('/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:p.scope_key,facts:[{field_path:field,value}]})});root.querySelector('[data-source-manual]').value='';await hydrate(root,p.scope_key)}catch(e){setError(e)}}}hydrate(root,p.scope_key).catch(setError)};const old=window.renderProjectDetail;if(typeof old==='function')window.renderProjectDetail=function(d){old(d);install(d)};})();</script>`;
}

function injectSourceUi(source) {
  if (source.includes('aurentara-project-source-storage-v1-ui')) return source;
  const ui = sourceUi();
  return source.includes('</body>') ? source.replace('</body>', `${ui}</body>`) : `${source}${ui}`;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  const isSourceApi = url.pathname === '/operator/api/project-source-intake' || url.pathname.startsWith('/operator/api/project-source-intake/');

  if (url.pathname === '/operator' || url.pathname === '/operator/') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
    const source = await response.text();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(injectSourceUi(source), { status: response.status, statusText: response.statusText, headers });
  }

  if (!isSourceApi) return handleExistingDashboard(request, env, ctx, options);
  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
  const service = options.runtime_service;
  if (!service) return json({ error: 'OPERATOR_RUNTIME_DURABILITY_NOT_READY', production_deploy: false }, 503);

  if (url.pathname === '/operator/api/project-source-intake' && request.method === 'GET') {
    const read = await loadIntake(service, url.searchParams.get('scope_key'));
    return read.ok ? json(workspacePayload(read.body)) : json(read.body, read.status || 400);
  }
  if (url.pathname === '/operator/api/project-source-intake/upload' && request.method === 'POST') return handleUpload(request, env, service, options);
  if (url.pathname === '/operator/api/project-source-intake/object' && request.method === 'GET') return handleDownload(request, env, service, options);
  if (url.pathname === '/operator/api/project-source-intake/object' && request.method === 'DELETE') return handleDelete(request, env, service, options);
  if (url.pathname === '/operator/api/project-source-intake/manual' && request.method === 'POST') return handleManual(request, service);
  if (url.pathname === '/operator/api/project-source-intake/website' && request.method === 'POST') return handleWebsite(request, service, options);
  if (url.pathname === '/operator/api/project-source-intake/packs' && request.method === 'POST') return handlePacks(request, service);
  return json({ error: 'PROJECT_SOURCE_INTAKE_ROUTE_NOT_FOUND', production_deploy: false }, 404);
}

export function operatorProjectSourceIntakeStorageDashboardManifest() {
  return {
    schema: 'aurentara.operator-project-source-intake-storage-dashboard.v1',
    existing_operator_dashboard_extended: true,
    routes: ['GET source intake','POST multipart upload','GET private object','DELETE private object','POST manual source','POST website source','POST packs/readiness'],
    multi_file_upload: true,
    multi_image_upload: true,
    bulk_rights_on_upload: true,
    mobile_file_input: true,
    source_cards: true,
    service_role_browser_exposure: false,
    project_scope_server_resolved: true,
    runtime_binary_storage: false,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  };
}
