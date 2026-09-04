import { authorizeOperator } from './operator-dashboard-http-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function json(body, status = 200) {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-extension', 'project-source-human-ux-polish-v1');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.clone().json(); } catch { return {}; }
}

export async function handleProjectSourceHumanAcceptanceApi(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (url.pathname !== '/operator/api/project-source-intake/rename' || request.method !== 'POST') return null;

  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
  const service = options.runtime_service;
  if (!service || typeof service.getProjectSourceIntake !== 'function' || typeof service.saveProjectSourceIntake !== 'function') {
    return json({ error: 'PROJECT_SOURCE_INTAKE_RUNTIME_SERVICE_NOT_AVAILABLE', production_deploy: false }, 503);
  }

  const body = await readJson(request);
  const scopeKey = clean(body.scope_key, 640);
  const sourceId = clean(body.source_id, 200);
  const displayName = clean(body.display_name, 300);
  if (!scopeKey || !sourceId) return json({ error: 'PROJECT_SOURCE_RENAME_SCOPE_AND_SOURCE_REQUIRED', production_deploy: false }, 400);
  if (!displayName) return json({ error: 'PROJECT_SOURCE_DISPLAY_NAME_REQUIRED', production_deploy: false }, 400);

  const read = await service.getProjectSourceIntake({ scope_key: scopeKey });
  if (!read.ok) return json(read.body, read.status || 400);
  const state = read.body.state;
  const source = (state.sources || []).find((item) => item.source_id === sourceId && !item.deleted_at) || null;
  if (!source) return json({ error: 'PROJECT_SOURCE_NOT_FOUND', project_scoped: true, production_deploy: false }, 404);
  if (source.scope_key !== state.scope_key || source.project_id !== state.project_id || source.customer_id !== state.customer_id) {
    return json({ error: 'PROJECT_SOURCE_CROSS_SCOPE_REJECTED', project_scoped: true, production_deploy: false }, 403);
  }

  if (source.display_name === displayName) {
    return json({
      ok: true,
      changed: false,
      source,
      runtime_revision: read.body.runtime_revision,
      metadata_only: true,
      storage_ref_unchanged: true,
      content_hash_unchanged: true,
      source_id_unchanged: true,
      variable_cost_eur: 0,
      paid_provider_calls: 0,
      production_deploy: false
    });
  }

  const at = new Date().toISOString();
  const next = structuredClone(state);
  const previousDisplayName = source.display_name;
  const previousKnowledgeRevision = Number(next.knowledge_revision || 1);
  next.record_revision = Number(next.record_revision || 1) + 1;
  next.updated_at = at;
  next.sources = (next.sources || []).map((item) => item.source_id === sourceId
    ? { ...item, display_name: displayName, updated_at: at }
    : item);
  next.audit = [...(next.audit || []), {
    event: 'PROJECT_SOURCE_DISPLAY_NAME_UPDATED',
    at,
    actor: next.operator_id || auth.operator_id || null,
    scope_key: next.scope_key,
    source_id: sourceId,
    previous_display_name: previousDisplayName,
    display_name: displayName,
    metadata_only: true
  }];
  next.knowledge_revision = previousKnowledgeRevision;

  const saved = await service.saveProjectSourceIntake({
    state: next,
    expected_revision: read.body.runtime_revision,
    event: 'PROJECT_SOURCE_DISPLAY_NAME_UPDATED'
  });
  if (!saved.ok) return json(saved.body, saved.status || 409);

  const renamed = next.sources.find((item) => item.source_id === sourceId);
  return json({
    ok: true,
    changed: true,
    source: renamed,
    runtime_revision: saved.body.runtime_revision,
    metadata_only: true,
    knowledge_revision_unchanged: next.knowledge_revision === state.knowledge_revision,
    storage_ref_unchanged: renamed.storage_ref === source.storage_ref,
    content_hash_unchanged: renamed.content_hash === source.content_hash,
    source_id_unchanged: renamed.source_id === source.source_id,
    source_version_unchanged: renamed.version === source.version,
    project_scoped: true,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  });
}

function injectHumanAcceptanceUi(html = '') {
  if (!html.includes('aurentara-project-source-storage-v1-ui') || html.includes('aurentara-project-source-human-acceptance-ui-v1')) return html;
  const addon = `<style id="aurentara-project-source-human-acceptance-ui-v1-style">
[data-source-local-status]{margin-top:9px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:13px;line-height:1.45}
[data-source-local-status][data-state="working"]{font-weight:650}
[data-source-local-status][data-state="error"]{border-color:#b42318;background:#fff4f2;color:#8a1c13}
[data-source-local-status][data-state="success"]{border-color:#067647;background:#ecfdf3;color:#05603a}
.source-status-code{margin-top:4px;font-size:11px;opacity:.72;overflow-wrap:anywhere}
.source-selection-feedback{margin-top:6px;font-size:12px;font-weight:650}
.source-upload-help{margin-top:4px;font-size:11px;color:var(--muted)}
.source-mobile-hint{display:none}
.source-card .source-type-line,.source-card .source-rights-line,.source-card .source-storage-line,.source-card .source-success-line{margin-top:4px}
.source-rename-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;margin-top:9px}
.source-rename-row input{min-width:0}
@media(max-width:760px){.source-desktop-hint{display:none}.source-mobile-hint{display:inline}.source-rename-row{grid-template-columns:1fr}.source-rename-row .btn{width:100%}}
</style><script id="aurentara-project-source-human-acceptance-ui-v1">(()=>{
const ALLOWED_MIME=${JSON.stringify(['text/plain','text/markdown','text/csv','application/json','text/html','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/webp','image/gif'])};
const PREVIEW_MIME=${JSON.stringify(['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain'])};
const SOURCE_LABELS={OWNED_WEBSITE:'Eigene Website',REFERENCE_WEBSITE:'Referenz-Website',IMAGE_VISUAL:'Bild',FILE_DOCUMENT:'Datei',MANUAL_INPUT:'Manuelle Information'};
const RIGHTS_LABELS={OWNED_CONFIRMED:'Eigentum bestätigt',CUSTOMER_ASSERTED:'Vom Kunden bestätigt',CUSTOMER_LICENSED:'Vom Kunden lizenziert',PUBLIC_REFERENCE_ONLY:'Nur als Referenz',UNKNOWN:'Rechte ungeklärt',RESTRICTED:'Nutzung eingeschränkt',DO_NOT_PUBLISH:'Nicht veröffentlichen'};
const READINESS_LABELS={READY:'Bereit',READY_WITH_WARNINGS:'Bereit mit Hinweisen',BLOCKED:'Blockiert'};
const MIME_LABELS={'image/png':'PNG','image/jpeg':'JPG','image/webp':'WebP','image/gif':'GIF','application/pdf':'PDF','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'DOCX','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'XLSX','text/plain':'TXT','text/markdown':'Markdown','text/csv':'CSV','application/json':'JSON','text/html':'HTML'};
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const sourceFetch=async(path,opt={})=>{const res=await fetch('/operator/api/project-source-intake'+path,opt);const type=res.headers.get('content-type')||'';const data=type.includes('json')?await res.json():res;if(!res.ok){const e=new Error(data?.error||('HTTP_'+res.status));e.data=data;throw e}return data};
const ensureStatus=root=>{let box=root.querySelector('[data-source-local-status]');if(!box){box=document.createElement('div');box.dataset.sourceLocalStatus='true';box.dataset.state='idle';box.hidden=true;const anchor=root.querySelector('[data-source-status]');anchor?.insertAdjacentElement('afterend',box)}return box};
const message=(root,state,text,code='')=>{const box=ensureStatus(root);box.hidden=false;box.dataset.state=state;box.innerHTML='<div>'+esc(text)+'</div>'+(code?'<div class="source-status-code">'+esc(code)+'</div>':'')};
const errorText=code=>({PROJECT_SOURCE_UPLOAD_MIME_UNSUPPORTED:'⚠️ Dieses Dateiformat wird aktuell nicht unterstützt. Bitte PNG, JPG, WebP oder ein anderes freigegebenes Format verwenden.',PROJECT_SOURCE_UPLOAD_TOO_LARGE:'⚠️ Die ausgewählte Datei ist zu groß. Bitte eine kleinere Datei verwenden.',PROJECT_SOURCE_UPLOAD_FILE_COUNT_EXCEEDED:'⚠️ Es wurden zu viele Dateien gleichzeitig ausgewählt.',PROJECT_SOURCE_UPLOAD_FILES_REQUIRED:'⚠️ Bitte mindestens eine Datei auswählen.',PROJECT_SOURCE_DISPLAY_NAME_REQUIRED:'⚠️ Bitte einen sichtbaren Namen eingeben.',PROJECT_SOURCE_NOT_FOUND:'⚠️ Die Project Source wurde nicht gefunden.',PROJECT_SOURCE_CROSS_SCOPE_REJECTED:'⚠️ Diese Project Source gehört zu einem anderen Projekt und darf hier nicht geändert werden.',PROJECT_SOURCE_PREVIEW_UNSUPPORTED:'⚠️ Für diesen Dateityp ist keine sichere Vorschau verfügbar. Bitte stattdessen explizit herunterladen.',PROJECT_SOURCE_PREVIEW_MIME_MISMATCH:'⚠️ Der Dateityp stimmt nicht sicher mit der gespeicherten Quelle überein. Vorschau wurde blockiert.'}[code]||'⚠️ Die Aktion konnte nicht abgeschlossen werden.');
const localError=(root,error)=>{const code=error?.data?.error||error?.message||'PROJECT_SOURCE_ACTION_FAILED';message(root,'error',errorText(code),code);if(typeof window.setError==='function')window.setError(error)};
const countLabel=n=>n===1?'1 Datei ausgewählt':n+' Dateien ausgewählt';
const uploadRunningLabel=n=>n===1?'1 Datei wird hochgeladen…':n+' Dateien werden hochgeladen…';
const uploadSuccessLabel=n=>n===1?'✅ Datei erfolgreich hochgeladen.':'✅ '+n+' Dateien erfolgreich hochgeladen.';
const typeLabel=s=>SOURCE_LABELS[s?.source_type]||'Project Source';
const rightsLabel=s=>RIGHTS_LABELS[s?.ownership_status]||'Rechte ungeklärt';
const mimeLabel=s=>MIME_LABELS[String(s?.mime_type||'').toLowerCase()]||'';
const displayName=s=>{const raw=String(s?.display_name||'').trim();if(s?.source_type==='OWNED_WEBSITE'&&(!raw||raw==='Website source'))return 'Website';if(s?.source_type==='REFERENCE_WEBSITE'&&(!raw||raw==='Website source'))return 'Referenz-Website';return raw||typeLabel(s)};
const readinessLabel=ready=>ready?.status?(READINESS_LABELS[ready.status]||'Intake läuft'):'Intake läuft';
const renderSources=(root,payload)=>{const list=payload?.workspace?.sections?.project_sources||[];const ready=payload?.workspace?.sections?.content_readiness;root.__sourcePayload=payload;const status=root.querySelector('[data-source-status]');if(status)status.innerHTML='<span class="badge '+(ready?.status==='BLOCKED'?'blocked':ready?'ready':'neutral')+'">'+esc(readinessLabel(ready))+'</span> · '+esc(list.length)+' '+(list.length===1?'Quelle':'Quellen');const cards=root.querySelector('[data-source-cards]');if(!cards)return;cards.innerHTML=list.length?list.map(s=>{const mime=mimeLabel(s),storage=Boolean(s.storage_ref),website=['OWNED_WEBSITE','REFERENCE_WEBSITE'].includes(s.source_type);return '<div class="source-card" data-polished-source-card="true" data-source-id="'+esc(s.source_id)+'"><strong>'+esc(displayName(s))+'</strong><div class="small source-type-line">'+esc(typeLabel(s)+(mime?' · '+mime:''))+'</div><div class="small source-rights-line">Rechte: '+esc(rightsLabel(s))+'</div>'+(storage?'<div class="small source-storage-line">🔒 Privat gespeichert</div>':'')+(website?'<div class="small source-success-line">✅ Erfolgreich hinzugefügt</div>':'')+'<div class="source-tools">'+(storage?'<button class="btn" data-polish-preview="'+esc(s.source_id)+'">Ansehen</button><button class="btn" data-polish-download="'+esc(s.source_id)+'">Herunterladen</button>':'')+'<button class="btn" data-polish-rename="'+esc(s.source_id)+'">Name bearbeiten</button>'+(storage?'<button class="btn danger" data-polish-delete="'+esc(s.source_id)+'">Löschen</button>':'')+'</div></div>'}).join(''):'<div class="empty">Noch keine Project Sources.</div>';
cards.querySelectorAll('[data-polish-preview]').forEach(b=>b.onclick=()=>{const s=list.find(x=>x.source_id===b.dataset.polishPreview);if(!s?.storage_ref)return;const mime=String(s.mime_type||'').toLowerCase();if(!PREVIEW_MIME.includes(mime)){message(root,'error','⚠️ Für diesen Dateityp ist keine sichere Vorschau verfügbar. Bitte stattdessen explizit herunterladen.','PROJECT_SOURCE_PREVIEW_UNSUPPORTED');return}window.open('/operator/api/project-source-intake/preview?scope_key='+encodeURIComponent(payload.identity.scope_key)+'&storage_ref='+encodeURIComponent(s.storage_ref),'_blank','noopener')});cards.querySelectorAll('[data-polish-download]').forEach(b=>b.onclick=()=>{const s=list.find(x=>x.source_id===b.dataset.polishDownload);if(s?.storage_ref)window.open('/operator/api/project-source-intake/object?scope_key='+encodeURIComponent(payload.identity.scope_key)+'&storage_ref='+encodeURIComponent(s.storage_ref),'_blank','noopener')});
cards.querySelectorAll('[data-polish-delete]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;b.disabled=true;message(root,'working','Project Source wird gelöscht…');try{await sourceFetch('/object',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:payload.identity.scope_key,source_id:b.dataset.polishDelete})});await refresh(root,payload.identity.scope_key);message(root,'success','✅ Source gelöscht')}catch(e){localError(root,e)}finally{b.disabled=false}});
cards.querySelectorAll('[data-polish-rename]').forEach(b=>b.onclick=()=>{const card=b.closest('[data-polished-source-card]');const s=list.find(x=>x.source_id===b.dataset.polishRename);if(!card||!s)return;card.querySelector('.source-rename-row')?.remove();const row=document.createElement('div');row.className='source-rename-row';row.innerHTML='<input data-polish-name maxlength="300" value="'+esc(displayName(s))+'" aria-label="Sichtbaren Namen bearbeiten"><button class="btn primary" data-polish-name-save>Speichern</button><button class="btn" data-polish-name-cancel>Abbrechen</button>';card.appendChild(row);const input=row.querySelector('[data-polish-name]');input.focus();input.select();row.querySelector('[data-polish-name-cancel]').onclick=()=>row.remove();row.querySelector('[data-polish-name-save]').onclick=async()=>{const name=input.value.trim();if(!name){message(root,'error','⚠️ Bitte einen sichtbaren Namen eingeben.','PROJECT_SOURCE_DISPLAY_NAME_REQUIRED');return}const save=row.querySelector('[data-polish-name-save]');save.disabled=true;message(root,'working','Name wird gespeichert…');try{await sourceFetch('/rename',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:payload.identity.scope_key,source_id:s.source_id,display_name:name})});await refresh(root,payload.identity.scope_key);message(root,'success','✅ Name gespeichert')}catch(e){localError(root,e)}finally{save.disabled=false}}})};
const refresh=async(root,scope)=>{const payload=await sourceFetch('?scope_key='+encodeURIComponent(scope));root.dataset.scope=scope;renderSources(root,payload);return payload};
const ensureSelectionUi=root=>{const input=root.querySelector('[data-source-files]');if(!input)return;let selected=root.querySelector('[data-source-selection-feedback]');if(!selected){selected=document.createElement('div');selected.className='source-selection-feedback';selected.dataset.sourceSelectionFeedback='true';selected.textContent='Keine Dateien ausgewählt';input.insertAdjacentElement('afterend',selected)}if(!root.querySelector('[data-source-upload-help]')){const help=document.createElement('div');help.className='source-upload-help';help.dataset.sourceUploadHelp='true';help.innerHTML='<span class="source-desktop-hint">Mehrere Dateien können gleichzeitig ausgewählt werden. Mit Strg/Shift mehrere Dateien auswählen.</span><span class="source-mobile-hint">Mehrere Dateien können gleichzeitig ausgewählt werden.</span>';selected.insertAdjacentElement('afterend',help)}input.addEventListener('change',()=>{const files=[...input.files];selected.textContent=files.length?countLabel(files.length):'Keine Dateien ausgewählt';const unsupported=files.find(f=>!ALLOWED_MIME.includes(String(f.type||'').toLowerCase()));if(unsupported)message(root,'error','⚠️ Dieses Dateiformat wird aktuell nicht unterstützt. Bitte PNG, JPG, WebP oder ein anderes freigegebenes Format verwenden.','PROJECT_SOURCE_UPLOAD_MIME_UNSUPPORTED')})};
const enhance=root=>{if(!root||root.dataset.humanAcceptancePatched==='true')return;root.dataset.humanAcceptancePatched='true';ensureStatus(root);ensureSelectionUi(root);const scope=root.dataset.scope;const upload=root.querySelector('[data-source-upload]');const fileInput=root.querySelector('[data-source-files]');if(upload)upload.addEventListener('click',async event=>{event.preventDefault();event.stopImmediatePropagation();if(root.dataset.sourceUploadBusy==='true')return;const files=[...(fileInput?.files||[])];if(!files.length){message(root,'error','⚠️ Bitte mindestens eine Datei auswählen.','PROJECT_SOURCE_UPLOAD_FILES_REQUIRED');return}const unsupported=files.find(f=>!ALLOWED_MIME.includes(String(f.type||'').toLowerCase()));if(unsupported){message(root,'error','⚠️ Dieses Dateiformat wird aktuell nicht unterstützt. Bitte PNG, JPG, WebP oder ein anderes freigegebenes Format verwenden.','PROJECT_SOURCE_UPLOAD_MIME_UNSUPPORTED');return}const activeScope=root.dataset.scope;if(!activeScope)return;root.dataset.sourceUploadBusy='true';const originalText=upload.textContent;upload.disabled=true;upload.setAttribute('aria-busy','true');upload.textContent='Upload läuft…';message(root,'working',uploadRunningLabel(files.length));const fd=new FormData();fd.append('scope_key',activeScope);fd.append('rights_status',root.querySelector('[data-source-rights]')?.value?.trim()||'CUSTOMER_ASSERTED');fd.append('usage_role',root.querySelector('[data-source-usage]')?.value||'PROJECT_VISUAL');files.forEach(f=>fd.append('files',f,f.name));try{await sourceFetch('/upload',{method:'POST',body:fd});fileInput.value='';const selected=root.querySelector('[data-source-selection-feedback]');if(selected)selected.textContent='Keine Dateien ausgewählt';message(root,'success',uploadSuccessLabel(files.length)+' Project Sources werden aktualisiert…');await refresh(root,activeScope);message(root,'success',uploadSuccessLabel(files.length))}catch(e){localError(root,e)}finally{root.dataset.sourceUploadBusy='false';upload.disabled=false;upload.removeAttribute('aria-busy');upload.textContent=originalText}},true);
const website=root.querySelector('[data-source-website]');if(website)website.addEventListener('click',async event=>{event.preventDefault();event.stopImmediatePropagation();if(root.dataset.sourceWebsiteBusy==='true')return;const input=root.querySelector('[data-source-url]');const sourceUrl=input?.value?.trim();const activeScope=root.dataset.scope;if(!sourceUrl||!activeScope)return;root.dataset.sourceWebsiteBusy='true';const originalText=website.textContent;website.disabled=true;website.setAttribute('aria-busy','true');website.textContent='Website wird geprüft…';message(root,'working','Website wird geprüft…');try{await sourceFetch('/website',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:activeScope,source_url:sourceUrl})});input.value='';message(root,'success','✅ Website erfolgreich hinzugefügt. Project Sources werden aktualisiert…');await refresh(root,activeScope);message(root,'success','✅ Website erfolgreich hinzugefügt')}catch(e){const code=e?.data?.error||e?.message||'WEBSITE_IMPORT_FAILED';const detail=e?.data?.cause?(' · '+e.data.cause):'';message(root,'error','⚠️ Website konnte nicht hinzugefügt werden. '+detail,code);if(typeof window.setError==='function')window.setError(e)}finally{root.dataset.sourceWebsiteBusy='false';website.disabled=false;website.removeAttribute('aria-busy');website.textContent=originalText}},true);
const cards=root.querySelector('[data-source-cards]');if(cards){new MutationObserver(()=>{if(cards.children.length&&!cards.querySelector('[data-polished-source-card]')&&root.dataset.sourcePolishRefresh!=='true'){root.dataset.sourcePolishRefresh='true';refresh(root,root.dataset.scope).catch(e=>localError(root,e)).finally(()=>{root.dataset.sourcePolishRefresh='false'})}}).observe(cards,{childList:true})}
if(scope)refresh(root,scope).catch(e=>localError(root,e))};
window.__aurentaraProjectSourceIntakeRefresh=scope=>{const root=[...document.querySelectorAll('[data-project-source-intake]')].find(item=>item.dataset.scope===scope)||document.querySelector('[data-project-source-intake]');return root?refresh(root,scope):Promise.resolve(null)};
const scan=()=>document.querySelectorAll('[data-project-source-intake]').forEach(enhance);new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan()})();</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${addon}</body>`) : `${html}${addon}`;
}

export async function applyProjectSourceHumanAcceptanceUi(response) {
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-project-source-human-acceptance-ui', 'v1');
  return new Response(injectHumanAcceptanceUi(html), { status: response.status, statusText: response.statusText, headers });
}

export function projectSourceHumanAcceptanceUiManifest() {
  return {
    schema: 'aurentara.project-source-human-acceptance-ui.v1',
    website_pending_status_local: true,
    website_error_local: true,
    website_success_local: true,
    upload_pending_status_local: true,
    upload_error_local: true,
    upload_success_local: true,
    multi_file_selection_feedback: true,
    client_mime_precheck_matches_server_allowlist: true,
    server_mime_validation_authoritative: true,
    source_display_name_editing: true,
    private_preview_action: true,
    explicit_download_action: true,
    unsafe_preview_human_message: true,
    storage_object_rename: false,
    german_source_presentation: true,
    local_action_success_states: true,
    project_context_retained_without_reload: true,
    existing_global_error_retained: true,
    project_sources_area_targeted: true,
    production_deploy: false,
    variable_cost_eur: 0
  };
}
