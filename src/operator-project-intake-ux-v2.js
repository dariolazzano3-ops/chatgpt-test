import { authorizeOperator } from './operator-dashboard-http-v1.js';
import {
  PROJECT_IMAGE_PURPOSES,
  updateProjectImagePurpose,
  updateProjectFactValue,
  deleteProjectSource
} from './project-source-intake-v1.js';
import { buildProjectKnowledgeReviewView } from './project-source-knowledge-review-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

const ROUTES = new Set([
  '/operator/api/project-source-intake/image-purpose',
  '/operator/api/project-source-intake/manual-note',
  '/operator/api/project-source-intake/source'
]);

function json(body, status = 200) {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-extension', 'project-ferrari-intake-ux-v2');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.clone().json(); } catch { return {}; }
}

async function load(service, scopeKey) {
  if (!service || typeof service.getProjectSourceIntake !== 'function') {
    return { ok: false, status: 503, body: { error: 'PROJECT_SOURCE_INTAKE_RUNTIME_SERVICE_NOT_AVAILABLE' } };
  }
  return service.getProjectSourceIntake({ scope_key: clean(scopeKey, 640) });
}

async function save(service, read, state, event) {
  if (!service || typeof service.saveProjectSourceIntake !== 'function') {
    return { ok: false, status: 503, body: { error: 'PROJECT_SOURCE_INTAKE_RUNTIME_SERVICE_NOT_AVAILABLE' } };
  }
  return service.saveProjectSourceIntake({
    state,
    expected_revision: read.body.runtime_revision,
    event
  });
}

function manualFactFor(state = {}, sourceId = '', factId = '') {
  const source = (state.sources || []).find((item) => item.source_id === sourceId && !item.deleted_at);
  if (!source || source.source_type !== 'MANUAL_INPUT') return null;
  return (state.facts || []).find((fact) => {
    if (factId && fact.fact_id !== factId) return false;
    return (fact.source_refs || []).includes(sourceId) && !['REJECTED', 'OUTDATED'].includes(fact.verification_status);
  }) || null;
}

export async function handleProjectIntakeUxV2Api(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!ROUTES.has(url.pathname)) return null;

  const expectedMethod = url.pathname.endsWith('/source') ? 'DELETE' : 'PATCH';
  if (request.method !== expectedMethod) return json({ error: 'METHOD_NOT_ALLOWED', production_deploy: false }, 405);

  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);

  const body = await readJson(request);
  const scopeKey = clean(body.scope_key, 640);
  const contextScopeKey = clean(body.context_scope_key, 640);
  if (!scopeKey) return json({ error: 'PROJECT_SOURCE_SCOPE_REQUIRED', production_deploy: false }, 400);
  if (contextScopeKey && contextScopeKey !== scopeKey) {
    return json({ error: 'PROJECT_SOURCE_PROJECT_CONTEXT_MISMATCH', production_deploy: false }, 409);
  }

  const service = options.runtime_service;
  const read = await load(service, scopeKey);
  if (!read.ok) return json(read.body, read.status || 400);
  const actor = auth.operator_id || auth.email || read.body.identity?.operator_id || 'operator';

  if (url.pathname.endsWith('/image-purpose')) {
    const sourceId = clean(body.source_id, 200);
    const purpose = clean(body.image_purpose, 80).toUpperCase();
    if (!sourceId) return json({ error: 'PROJECT_SOURCE_ID_REQUIRED', production_deploy: false }, 400);
    if (!PROJECT_IMAGE_PURPOSES.includes(purpose)) {
      return json({ error: 'PROJECT_IMAGE_PURPOSE_INVALID', allowed: PROJECT_IMAGE_PURPOSES, production_deploy: false }, 400);
    }
    const changed = updateProjectImagePurpose(read.body.state, sourceId, purpose, { actor_id: actor });
    if (!changed.ok) return json(changed, changed.error === 'PROJECT_SOURCE_NOT_FOUND' ? 404 : 400);
    if (!changed.changed) {
      return json({
        ok: true,
        changed: false,
        source: changed.source,
        runtime_revision: read.body.runtime_revision,
        review: buildProjectKnowledgeReviewView(read.body.state),
        production_deploy: false,
        external_writes: false
      });
    }
    const saved = await save(service, read, changed.state, 'PROJECT_IMAGE_PURPOSE_UPDATED');
    if (!saved.ok) return json(saved.body, saved.status || 409);
    return json({
      ok: true,
      changed: true,
      source: changed.source,
      runtime_revision: saved.body.runtime_revision,
      review: buildProjectKnowledgeReviewView(changed.state),
      approval_invalidated: changed.state.knowledge_review?.status === 'CHANGES_PENDING',
      factories_locked: changed.state.knowledge_review ? changed.state.knowledge_review.status !== 'APPROVED' : false,
      production_deploy: false,
      external_writes: false
    });
  }

  if (url.pathname.endsWith('/manual-note')) {
    const sourceId = clean(body.source_id, 200);
    const factId = clean(body.fact_id, 200);
    const value = clean(body.value, 12000);
    if (!sourceId || !value) return json({ error: 'PROJECT_MANUAL_NOTE_SOURCE_AND_VALUE_REQUIRED', production_deploy: false }, 400);
    const current = manualFactFor(read.body.state, sourceId, factId);
    if (!current) return json({ error: 'PROJECT_MANUAL_NOTE_NOT_FOUND', production_deploy: false }, 404);
    const edited = updateProjectFactValue(read.body.state, current.fact_id, { value }, { actor_id: actor });
    if (!edited.ok) return json(edited, 400);
    const next = structuredClone(edited.state);
    next.sources = (next.sources || []).map((source) => source.source_id === sourceId
      ? { ...source, source_metadata: { ...(source.source_metadata || {}), manual_text: value }, updated_at: next.updated_at }
      : source);
    const saved = await save(service, read, next, 'PROJECT_MANUAL_NOTE_UPDATED');
    if (!saved.ok) return json(saved.body, saved.status || 409);
    return json({
      ok: true,
      changed: edited.changed,
      fact: edited.fact,
      runtime_revision: saved.body.runtime_revision,
      review: buildProjectKnowledgeReviewView(next),
      production_deploy: false,
      external_writes: false
    });
  }

  const sourceId = clean(body.source_id, 200);
  const source = (read.body.state.sources || []).find((item) => item.source_id === sourceId && !item.deleted_at) || null;
  if (!source) return json({ error: 'PROJECT_SOURCE_NOT_FOUND', production_deploy: false }, 404);
  if (source.storage_ref) {
    return json({
      error: 'PROJECT_SOURCE_STORAGE_DELETE_ROUTE_REQUIRED',
      route: '/operator/api/project-source-intake/object',
      production_deploy: false
    }, 409);
  }
  const deleted = deleteProjectSource(read.body.state, sourceId);
  if (!deleted.ok) return json(deleted, 400);
  const saved = await save(service, read, deleted.state, 'PROJECT_SOURCE_DELETED');
  if (!saved.ok) return json(saved.body, saved.status || 409);
  return json({
    ok: true,
    source_id: sourceId,
    soft_deleted: true,
    runtime_revision: saved.body.runtime_revision,
    review: buildProjectKnowledgeReviewView(deleted.state),
    production_deploy: false,
    external_writes: false
  });
}

function injectProjectIntakeUxV2(html = '') {
  if (!html.includes('aurentara-project-source-storage-v1-ui') || html.includes('aurentara-project-intake-ux-v2')) return html;
  const addon = `<style id="aurentara-project-intake-ux-v2-style">
.source-basket-v2-active>.source-upload-grid,.source-basket-v2-active>details.details{display:none!important}
.source-basket-v2{margin:14px 0;display:grid;gap:12px}
.source-basket-phases{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.source-basket-phase{padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:12px;line-height:1.35}
.source-basket-phase.active{font-weight:700;background:#f6f7f8}
.source-basket-composer{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px;display:grid;gap:13px}
.source-basket-composer h3{margin:0;font-size:18px}
.source-basket-inputs{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;align-items:start}
.source-basket-input{border:1px solid var(--line);border-radius:12px;padding:12px;min-width:0;background:#fafafa}
.source-basket-input h4{margin:0 0 8px;font-size:14px}
.source-basket-input textarea{min-height:94px;resize:vertical}
.source-basket-actions{display:flex;gap:8px;align-items:end;flex-wrap:wrap}
.source-selection-v2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.source-selection-card{border:1px solid var(--line);border-radius:11px;padding:9px;background:#fff;min-width:0}
.source-selection-thumb{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#f0f1f2;margin-bottom:8px}
.source-selection-icon{width:100%;aspect-ratio:4/3;border-radius:8px;background:#f0f1f2;display:grid;place-items:center;font-size:28px;margin-bottom:8px}
.source-selection-name{font-weight:700;font-size:12px;overflow-wrap:anywhere}
.source-selection-meta,.source-selection-state{font-size:11px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}
.source-selection-state[data-state="working"]{color:#7a4b00;font-weight:700}
.source-selection-state[data-state="success"]{color:#05603a;font-weight:700}
.source-selection-state[data-state="error"]{color:#8a1c13;font-weight:700}
.source-upload-progress-v2{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff}
.source-upload-progress-v2 progress{width:100%;height:10px}
.source-upload-progress-v2[hidden]{display:none}
.source-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
.source-card-v2{padding:0;overflow:hidden}
.source-card-v2-media{width:100%;aspect-ratio:16/10;background:#f0f1f2;display:block;object-fit:cover;cursor:zoom-in}
.source-card-v2-body{padding:12px}
.source-card-v2-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.source-card-v2-title{font-weight:750;margin-top:3px;overflow-wrap:anywhere}
.source-card-v2-content{font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px}
.source-card-v2-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.source-card-v2-meta span{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:4px 7px;background:#fafafa}
.source-purpose-row{margin-top:10px}
.source-purpose-row label{font-size:11px;color:var(--muted)}
.source-purpose-row select{margin-top:4px;width:100%}
.source-v2-status{font-size:12px;margin-top:8px;font-weight:650}
.source-v2-status.pending{color:#7a4b00}.source-v2-status.approved{color:#05603a}.source-v2-status.error{color:#8a1c13}
.source-v2-empty{grid-column:1/-1;padding:18px;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--muted)}
.source-v2-review-meta{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:10px;font-size:12px;line-height:1.5;background:#fff}
.source-v2-review-meta.conflict{border-color:#b42318;background:#fff4f2;color:#8a1c13}
@media(max-width:980px){.source-basket-inputs{grid-template-columns:1fr 1fr}.source-basket-input:first-child{grid-column:1/-1}.source-selection-v2{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.source-basket-phases,.source-basket-inputs,.source-selection-v2,.source-cards{grid-template-columns:1fr}.source-basket-input:first-child{grid-column:auto}.source-basket-actions .btn,.source-basket-input .btn{width:100%;min-height:46px}.source-card-v2-media{aspect-ratio:4/3}.source-basket-composer{padding:12px}}
</style><script id="aurentara-project-intake-ux-v2">(()=>{
const PURPOSES=['INFORMATION_EXTRACTION','VISUAL_USAGE','BOTH'];
const PURPOSE_LABEL={INFORMATION_EXTRACTION:'Informationen erkennen',VISUAL_USAGE:'Visuell verwenden',BOTH:'Beides'};
const TYPE_LABEL={OWNED_WEBSITE:'Eigene Website',REFERENCE_WEBSITE:'Referenz-Website',IMAGE_VISUAL:'Bild',FILE_DOCUMENT:'Dokument',MANUAL_INPUT:'Manuelle Information'};
const RIGHTS_LABEL={OWNED_CONFIRMED:'Eigentum bestätigt',CUSTOMER_ASSERTED:'Vom Kunden bestätigt',CUSTOMER_LICENSED:'Vom Kunden lizenziert',PUBLIC_REFERENCE_ONLY:'Nur Referenz',UNKNOWN:'Rechte ungeklärt',RESTRICTED:'Eingeschränkt',DO_NOT_PUBLISH:'Nicht veröffentlichen'};
const CATEGORIES=[['OTHER','Sonstige Information'],['PRODUCT','Produkt'],['OFFERING','Leistung / Angebot'],['PRICE','Preis'],['OPENING_HOURS','Öffnungszeiten'],['PHONE','Telefon'],['EMAIL','E-Mail'],['ADDRESS','Adresse'],['DESCRIPTION','Beschreibung']];
const ALLOWED=['text/plain','text/markdown','text/csv','application/json','text/html','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/webp','image/gif'];
const IMAGE=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const TEXT=new Set(['text/plain','text/markdown','text/csv','application/json','text/html']);
const stateByRoot=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtBytes=n=>{const x=Number(n||0);if(x<1024)return x+' B';if(x<1048576)return (x/1024).toFixed(1)+' KB';return (x/1048576).toFixed(1)+' MB'};
const api=async(path,opt={})=>{const res=await fetch('/operator/api/project-source-intake'+path,opt);const type=res.headers.get('content-type')||'';const data=type.includes('json')?await res.json():res;if(!res.ok){const e=new Error(data?.error||('HTTP_'+res.status));e.data=data;throw e}return data};
const payload=async scope=>api('?scope_key='+encodeURIComponent(scope));
const purposeDefault=file=>{if(!IMAGE.has(String(file?.type||'').toLowerCase()))return 'INFORMATION_EXTRACTION';const n=String(file?.name||'').toLowerCase();return /(screen|screenshot|preis|price|menu|karte|flyer|öffnung|opening|liste|list)/.test(n)?'INFORMATION_EXTRACTION':'VISUAL_USAGE'};
const parserLabel=s=>{const mime=String(s?.mime_type||'').toLowerCase();if(s?.source_metadata?.text_content)return 'Inhalt verfügbar';if(TEXT.has(mime))return 'Bereit für KI-Aufbereitung';if(mime==='application/pdf'||mime.includes('wordprocessingml')||mime.includes('spreadsheetml'))return 'Nur Datei gespeichert · Extraktion nicht unterstützt';return s?.ingestion_status==='IMPORTED'?'Gespeichert':'Nur Datei gespeichert'};
const reviewStatus=(s,review)=>{if(review?.status==='APPROVED'&&s?.knowledge_approved===true)return ['Bestätigt','approved'];if(review?.status==='CHANGES_PENDING')return ['Änderung prüfen','pending'];if(review?.status==='IN_REVIEW')return ['In Prüfung','pending'];return ['Bereit für Aufbereitung','pending']};
const sourcePreview=(scope,s)=>'/operator/api/project-source-intake/preview?scope_key='+encodeURIComponent(scope)+'&storage_ref='+encodeURIComponent(s.storage_ref);
function setMessage(root,text,state='working'){let box=root.querySelector('[data-v2-message]');if(!box)return;box.hidden=!text;box.dataset.state=state;box.textContent=text||''}
function selectionState(root){if(!stateByRoot.has(root))stateByRoot.set(root,{records:[],urls:[]});return stateByRoot.get(root)}
function revoke(root){const st=selectionState(root);for(const u of st.urls||[])URL.revokeObjectURL(u);st.urls=[]}
function validateFiles(root,records){const p=root.__sourcePayload||{};const limits=p.storage||{};if(records.length>Number(limits.max_files_per_request||12))return 'Maximal '+(limits.max_files_per_request||12)+' Dateien pro Auswahl.';const total=records.reduce((sum,r)=>sum+Number(r.file.size||0),0);if(total>Number(limits.max_total_bytes||52428800))return 'Die Auswahl ist insgesamt zu groß. Maximal '+fmtBytes(limits.max_total_bytes||52428800)+'.';for(const r of records){const mime=String(r.file.type||'').toLowerCase();if(!ALLOWED.includes(mime))return r.file.name+': Dateiformat nicht unterstützt.';const limit=IMAGE.has(mime)?Number(limits.max_image_bytes||15728640):TEXT.has(mime)?Number(limits.max_text_bytes||2097152):Number(limits.max_file_bytes||20971520);if(Number(r.file.size||0)>limit)return r.file.name+': Datei zu groß. Limit '+fmtBytes(limit)+'.'}return ''}
function renderSelection(root){const host=root.querySelector('[data-v2-selection]');if(!host)return;const st=selectionState(root);if(!st.records.length){host.innerHTML='';return}host.innerHTML=st.records.map((r,i)=>{const mime=String(r.file.type||'').toLowerCase();const visual=IMAGE.has(mime)&&r.url?'<img class="source-selection-thumb" src="'+esc(r.url)+'" alt="">':'<div class="source-selection-icon" aria-hidden="true">📄</div>';return '<div class="source-selection-card" data-v2-selection-card="'+i+'">'+visual+'<div class="source-selection-name">'+esc(r.file.name)+'</div><div class="source-selection-meta">'+esc(mime||'unbekannter Typ')+' · '+esc(fmtBytes(r.file.size))+'</div>'+(IMAGE.has(mime)?'<label class="source-selection-meta">Zweck<select data-v2-selection-purpose="'+i+'">'+PURPOSES.map(p=>'<option value="'+p+'" '+(p===r.purpose?'selected':'')+'>'+esc(PURPOSE_LABEL[p])+'</option>').join('')+'</select></label>':'<div class="source-selection-meta">Zweck: Informationen erkennen</div>')+'<div class="source-selection-state" data-state="'+esc(r.statusKind||'idle')+'">'+esc(r.status||'Ausgewählt')+'</div></div>'}).join('');host.querySelectorAll('[data-v2-selection-purpose]').forEach(sel=>sel.onchange=()=>{const row=st.records[Number(sel.dataset.v2SelectionPurpose)];if(row)row.purpose=sel.value})}
function makeComposer(root){if(root.querySelector('[data-source-basket-v2]'))return;root.classList.add('source-basket-v2-active');const baseGrid=root.querySelector('.source-upload-grid');const cards=root.querySelector('[data-source-cards]');if(!cards)return;const wrap=document.createElement('div');wrap.className='source-basket-v2';wrap.dataset.sourceBasketV2='true';wrap.innerHTML='<div class="source-basket-phases" aria-label="Projekt Intake Ablauf"><div class="source-basket-phase active">1. Material hinzufügen</div><div class="source-basket-phase">2. KI aufbereiten</div><div class="source-basket-phase">3. Prüfen & bearbeiten</div><div class="source-basket-phase">4. Für Ferrari freigeben</div></div><div class="source-basket-composer"><div><div class="eyebrow">ROHMATERIAL / WÄSCHEKORB</div><h3>Alles Projektmaterial an einem Ort</h3><div class="small">Dateien, Bilder, Websites und Notizen sind Rohmaterial. Erst die spätere Prüfung macht daraus bestätigtes Projektwissen.</div></div><div class="source-basket-inputs"><div class="source-basket-input"><h4>📎 Dateien & Bilder</h4><input type="file" multiple data-v2-files aria-label="Dateien und Bilder auswählen"><div class="small">Vor dem Upload siehst du jede Datei einzeln. Maximalwerte werden aus dem Server-Contract geprüft. Verwendung / Zweck kann für jedes Bild passend festgelegt werden.</div><div class="source-basket-actions" style="margin-top:9px"><label class="field" style="flex:1"><span>Rechte</span><select data-v2-rights><option value="CUSTOMER_ASSERTED">Vom Kunden bereitgestellt</option><option value="OWNED_CONFIRMED">Eigentum bestätigt</option><option value="CUSTOMER_LICENSED">Lizenziert</option><option value="DO_NOT_PUBLISH">Nicht veröffentlichen</option></select></label><button class="btn primary" data-v2-upload disabled>Hochladen</button></div></div><div class="source-basket-input"><h4>🌐 Website</h4><input data-v2-url placeholder="https://..." aria-label="Website URL"><select data-v2-website-type style="margin-top:7px"><option value="OWNED_WEBSITE">Eigene Website</option><option value="REFERENCE_WEBSITE">Referenz-Website</option></select><div class="small" style="margin-top:7px"><label><input type="checkbox" data-v2-use-content checked> Inhalt</label> · <label><input type="checkbox" data-v2-use-structure> Struktur</label> · <label><input type="checkbox" data-v2-use-design> Design</label></div><button class="btn" data-v2-website style="margin-top:9px">Website hinzufügen</button></div><div class="source-basket-input"><h4>📝 Zusätzliche Information / Notiz</h4><textarea data-v2-note placeholder="z. B. Eisbecher Fantasimo jetzt neu auf der Karte" aria-label="Zusätzliche Information oder Notiz"></textarea><select data-v2-note-category style="margin-top:7px">'+CATEGORIES.map(x=>'<option value="'+x[0]+'">'+esc(x[1])+'</option>').join('')+'</select><button class="btn" data-v2-note-save style="margin-top:9px">Notiz hinzufügen</button></div></div><div data-v2-message class="source-upload-progress-v2" hidden aria-live="polite"></div><div class="source-selection-v2" data-v2-selection></div><div class="source-upload-progress-v2" data-v2-progress hidden aria-live="polite"><div data-v2-progress-label>Upload wird vorbereitet</div><progress max="1" value="0" data-v2-progress-bar></progress></div></div>';
cards.insertAdjacentElement('beforebegin',wrap);
if(baseGrid)baseGrid.hidden=true;
bindComposer(root,wrap)
}
function bindComposer(root,wrap){const input=wrap.querySelector('[data-v2-files]'),upload=wrap.querySelector('[data-v2-upload]');input.accept=ALLOWED.join(',');input.onchange=()=>{revoke(root);const st=selectionState(root);st.records=[...input.files].map(file=>{const mime=String(file.type||'').toLowerCase();let url='';if(IMAGE.has(mime)){url=URL.createObjectURL(file);st.urls.push(url)}return {file,purpose:purposeDefault(file),url,status:'Ausgewählt',statusKind:'idle'}});const error=validateFiles(root,st.records);upload.disabled=!st.records.length||Boolean(error);setMessage(root,error,error?'error':'working');if(!error)setMessage(root,st.records.length?st.records.length+' Dateien ausgewählt. Prüfe Vorschau und Zweck, dann hochladen.':'');renderSelection(root)};
upload.onclick=async()=>{const st=selectionState(root);const candidates=st.records.filter(r=>r.statusKind!=='success');const error=validateFiles(root,candidates);if(error){setMessage(root,error,'error');return}if(!candidates.length)return;const scope=root.dataset.scope||root.__sourcePayload?.identity?.scope_key;if(!scope)return;upload.disabled=true;upload.setAttribute('aria-busy','true');const progress=wrap.querySelector('[data-v2-progress]'),bar=wrap.querySelector('[data-v2-progress-bar]'),label=wrap.querySelector('[data-v2-progress-label]');progress.hidden=false;bar.max=candidates.length;bar.value=0;let success=0,failed=0;for(let i=0;i<candidates.length;i++){const row=candidates[i];row.status='Wird hochgeladen · '+(i+1)+' von '+candidates.length;row.statusKind='working';label.textContent=(i+1)+' von '+candidates.length+' wird hochgeladen';renderSelection(root);const fd=new FormData();fd.append('scope_key',scope);fd.append('rights_status',wrap.querySelector('[data-v2-rights]').value);fd.append('usage_role','PROJECT_VISUAL');fd.append('image_purpose',row.purpose);fd.append('files',row.file,row.file.name);try{await api('/upload',{method:'POST',body:fd});row.status='Hochgeladen';row.statusKind='success';success++}catch(e){row.status='Fehler · '+String(e?.data?.error||e?.message||'UPLOAD_FAILED');row.statusKind='error';failed++}bar.value=i+1;renderSelection(root)}label.textContent=failed?success+' von '+candidates.length+' hochgeladen. '+failed+' fehlgeschlagen.':success+' Dateien erfolgreich hochgeladen.';setMessage(root,failed?success+' von '+candidates.length+' Dateien hochgeladen. '+failed+' Datei(en) fehlgeschlagen. Erfolgreiche Dateien bleiben gespeichert.':success+' Dateien erfolgreich hochgeladen.',failed?'error':'success');try{await refresh(root,scope)}catch{}upload.disabled=false;upload.removeAttribute('aria-busy');upload.textContent=failed?'Fehlgeschlagene erneut versuchen':'Hochladen';if(!failed){input.value=''}};
const type=wrap.querySelector('[data-v2-website-type]');type.onchange=()=>{const ref=type.value==='REFERENCE_WEBSITE';wrap.querySelector('[data-v2-use-content]').checked=!ref;wrap.querySelector('[data-v2-use-structure]').checked=ref;wrap.querySelector('[data-v2-use-design]').checked=ref};
wrap.querySelector('[data-v2-website]').onclick=async e=>{const b=e.currentTarget,u=wrap.querySelector('[data-v2-url]'),value=u.value.trim(),scope=root.dataset.scope;if(!value||!scope)return;b.disabled=true;b.textContent='Website wird geprüft…';setMessage(root,'Website wird geprüft…');try{await api('/website',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,source_url:value,source_type:type.value,reference_only:type.value==='REFERENCE_WEBSITE',website_usage:{content:wrap.querySelector('[data-v2-use-content]').checked,structure_reference:wrap.querySelector('[data-v2-use-structure]').checked,design_reference:wrap.querySelector('[data-v2-use-design]').checked}})});u.value='';setMessage(root,'Website erfolgreich hinzugefügt.','success');await refresh(root,scope)}catch(err){setMessage(root,'Website konnte nicht hinzugefügt werden: '+String(err?.data?.error||err?.message),'error')}finally{b.disabled=false;b.textContent='Website hinzufügen'}};
wrap.querySelector('[data-v2-note-save]').onclick=async e=>{const b=e.currentTarget,n=wrap.querySelector('[data-v2-note]'),value=n.value.trim(),scope=root.dataset.scope;if(!value||!scope)return;b.disabled=true;b.textContent='Notiz wird gespeichert…';try{await api('/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,context_scope_key:scope,display_name:'Manuelle Information',facts:[{category:wrap.querySelector('[data-v2-note-category]').value,value}]})});n.value='';setMessage(root,'Notiz im Wäschekorb gespeichert. Sie ist noch nicht als Wahrheit bestätigt.','success');await refresh(root,scope)}catch(err){setMessage(root,'Notiz konnte nicht gespeichert werden: '+String(err?.data?.error||err?.message),'error')}finally{b.disabled=false;b.textContent='Notiz hinzufügen'}}
}
function linkedFacts(payload,sourceId){return (payload?.workspace?.sections?.project_knowledge||[]).filter(f=>(f.source_refs||[]).includes(sourceId)&&!['REJECTED','OUTDATED'].includes(f.verification_status))}
function renderCards(root,p){const cards=root.querySelector('[data-source-cards]');if(!cards)return;const list=p?.workspace?.sections?.project_sources||[];const review=p?.workspace?.knowledge_review||{};if(cards.querySelector('[data-v2-source-card]')&&cards.dataset.v2RuntimeRevision===String(p.runtime_revision||''))return;cards.dataset.v2RuntimeRevision=String(p.runtime_revision||'');cards.innerHTML=list.length?list.map(s=>{const type=TYPE_LABEL[s.source_type]||s.source_type;const status=reviewStatus(s,review);const facts=linkedFacts(p,s.source_id);const mime=String(s.mime_type||'').toLowerCase();const image=s.source_type==='IMAGE_VISUAL'&&s.storage_ref;const note=s.source_type==='MANUAL_INPUT';const website=['OWNED_WEBSITE','REFERENCE_WEBSITE'].includes(s.source_type);const purpose=PURPOSES.includes(s.image_purpose)?s.image_purpose:'VISUAL_USAGE';const body=note?'<div class="source-card-v2-content">'+esc(String(s.source_metadata?.manual_text||facts.map(f=>typeof f.value==='string'?f.value:JSON.stringify(f.value)).join('\\n')||'Manuelle Information'))+'</div>':s.source_type==='FILE_DOCUMENT'?'<div class="source-card-v2-content">'+esc(parserLabel(s))+'</div>':'';const media=image?'<img class="source-card-v2-media" src="'+esc(sourcePreview(p.identity.scope_key,s))+'" alt="'+esc(s.display_name||'Projektbild')+'" loading="lazy" data-v2-zoom="'+esc(s.source_id)+'">':'';const purposeHtml=image?'<div class="source-purpose-row"><label>Zweck</label><select data-v2-purpose="'+esc(s.source_id)+'">'+PURPOSES.map(x=>'<option value="'+x+'" '+(x===purpose?'selected':'')+'>'+esc(PURPOSE_LABEL[x])+'</option>').join('')+'</select></div>':'';const usage=s.website_usage||{content:s.source_type==='OWNED_WEBSITE',structure_reference:false,design_reference:false};const websiteHtml=website?'<div class="source-purpose-row"><label>Website verwenden für</label><div class="small"><label><input type="checkbox" data-v2-w-content="'+esc(s.source_id)+'" '+(usage.content?'checked':'')+'> Inhalt</label> · <label><input type="checkbox" data-v2-w-structure="'+esc(s.source_id)+'" '+(usage.structure_reference?'checked':'')+'> Struktur</label> · <label><input type="checkbox" data-v2-w-design="'+esc(s.source_id)+'" '+(usage.design_reference?'checked':'')+'> Design</label></div><button class="btn" data-v2-w-save="'+esc(s.source_id)+'" style="margin-top:7px">Verwendung speichern</button></div>':'';return '<div class="source-card source-card-v2" data-polished-source-card="true" data-v2-source-card="'+esc(s.source_id)+'">'+media+'<div class="source-card-v2-body"><div class="source-card-v2-kicker">'+esc(type)+'</div><div class="source-card-v2-title">'+esc(s.display_name||type)+'</div>'+body+'<div class="source-card-v2-meta">'+(mime?'<span>'+esc(mime)+'</span>':'')+'<span>'+esc(RIGHTS_LABEL[s.ownership_status]||s.ownership_status||'Rechte ungeklärt')+'</span>'+(s.storage_ref?'<span>🔒 Privat gespeichert</span>':'')+'</div>'+purposeHtml+websiteHtml+'<div class="source-v2-status '+status[1]+'">'+esc(status[0])+'</div><div class="source-tools"><button class="btn" data-v2-rename="'+esc(s.source_id)+'">Umbenennen</button>'+(note&&facts[0]?'<button class="btn" data-v2-note-edit="'+esc(s.source_id)+'" data-fact-id="'+esc(facts[0].fact_id)+'">Notiz bearbeiten</button>':'')+(s.storage_ref?'<button class="btn" data-v2-download="'+esc(s.source_id)+'">Herunterladen</button>':'')+'<button class="btn danger" data-v2-delete="'+esc(s.source_id)+'">Löschen</button></div></div></div>'}).join(''):'<div class="source-v2-empty">Noch kein Rohmaterial. Füge oben Dateien, eine Website oder eine Notiz hinzu.</div>';bindCards(root,p)}
function bindCards(root,p){const cards=root.querySelector('[data-source-cards]'),list=p?.workspace?.sections?.project_sources||[],scope=p?.identity?.scope_key;if(!cards||!scope)return;cards.querySelectorAll('[data-v2-zoom]').forEach(el=>el.onclick=()=>{const s=list.find(x=>x.source_id===el.dataset.v2Zoom);if(s?.storage_ref)window.open(sourcePreview(scope,s),'_blank','noopener')});cards.querySelectorAll('[data-v2-purpose]').forEach(sel=>sel.onchange=async()=>{sel.disabled=true;try{await api('/image-purpose',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,context_scope_key:scope,source_id:sel.dataset.v2Purpose,image_purpose:sel.value})});await refresh(root,scope);setMessage(root,'Bildzweck gespeichert. Eine vorherige Ferrari-Freigabe wurde bei relevanter Änderung zurückgesetzt.','success')}catch(e){setMessage(root,'Bildzweck konnte nicht gespeichert werden: '+String(e?.data?.error||e?.message),'error')}finally{sel.disabled=false}});cards.querySelectorAll('[data-v2-w-save]').forEach(b=>b.onclick=async()=>{const id=b.dataset.v2WSave;b.disabled=true;try{const pick=n=>cards.querySelector('['+n+'="'+CSS.escape(id)+'"]')?.checked===true;await api('/website-usage',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,source_id:id,website_usage:{content:pick('data-v2-w-content'),structure_reference:pick('data-v2-w-structure'),design_reference:pick('data-v2-w-design')}})});await refresh(root,scope)}catch(e){setMessage(root,'Website-Verwendung konnte nicht gespeichert werden: '+String(e?.data?.error||e?.message),'error')}finally{b.disabled=false}});cards.querySelectorAll('[data-v2-download]').forEach(b=>b.onclick=()=>{const s=list.find(x=>x.source_id===b.dataset.v2Download);if(s?.storage_ref)window.open('/operator/api/project-source-intake/object?scope_key='+encodeURIComponent(scope)+'&storage_ref='+encodeURIComponent(s.storage_ref),'_blank','noopener')});cards.querySelectorAll('[data-v2-rename]').forEach(b=>b.onclick=async()=>{const s=list.find(x=>x.source_id===b.dataset.v2Rename);if(!s)return;const name=window.prompt('Sichtbaren Namen bearbeiten',s.display_name||'');if(!name?.trim())return;try{await api('/rename',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,source_id:s.source_id,display_name:name.trim()})});await refresh(root,scope)}catch(e){setMessage(root,'Name konnte nicht gespeichert werden: '+String(e?.data?.error||e?.message),'error')}});cards.querySelectorAll('[data-v2-note-edit]').forEach(b=>b.onclick=async()=>{const s=list.find(x=>x.source_id===b.dataset.v2NoteEdit);const fact=linkedFacts(p,s?.source_id||'').find(x=>x.fact_id===b.dataset.factId);if(!s||!fact)return;const current=typeof fact.value==='string'?fact.value:JSON.stringify(fact.value);const value=window.prompt('Notiz bearbeiten',current);if(!value?.trim())return;try{await api('/manual-note',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,context_scope_key:scope,source_id:s.source_id,fact_id:fact.fact_id,value:value.trim()})});await refresh(root,scope)}catch(e){setMessage(root,'Notiz konnte nicht gespeichert werden: '+String(e?.data?.error||e?.message),'error')}});cards.querySelectorAll('[data-v2-delete]').forEach(b=>b.onclick=async()=>{const s=list.find(x=>x.source_id===b.dataset.v2Delete);if(!s||!window.confirm('Diese Quelle aus dem Wäschekorb entfernen?'))return;b.disabled=true;try{if(s.storage_ref)await api('/object',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,source_id:s.source_id})});else await api('/source',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,context_scope_key:scope,source_id:s.source_id})});await refresh(root,scope)}catch(e){setMessage(root,'Quelle konnte nicht gelöscht werden: '+String(e?.data?.error||e?.message),'error')}finally{b.disabled=false}})}
function decorateKnowledge(root,p){const panel=root.querySelector('[data-knowledge-review-panel]');const cards=root.querySelector('[data-source-cards]');if(!panel||!cards)return;if(panel.previousElementSibling!==cards)cards.insertAdjacentElement('afterend',panel);const view=p?.workspace?.knowledge_review||{};const prepare=panel.querySelector('[data-knowledge-prepare]');if(prepare&&!prepare.disabled)prepare.textContent=view.status==='IN_REVIEW'||view.status==='CHANGES_PENDING'?'Änderungen mit KI neu aufbereiten':'Mit KI aufbereiten';const approve=panel.querySelector('[data-knowledge-approve]');if(approve&&!approve.disabled)approve.textContent='Für Ferrari freigeben';let meta=panel.querySelector('[data-v2-review-meta]');if(!meta){meta=document.createElement('div');meta.dataset.v2ReviewMeta='true';meta.className='source-v2-review-meta';panel.appendChild(meta)}if(Number(view.conflict_count||0)>0){meta.className='source-v2-review-meta conflict';meta.textContent='⚠️ '+view.conflict_count+' widersprüchliche Angabe(n). Freigabe bleibt gesperrt, bis der Konflikt human aufgelöst wurde.'}else if(view.status==='APPROVED'){meta.className='source-v2-review-meta';meta.textContent='✅ Freigegeben'+(view.approved_at?' · '+new Date(view.approved_at).toLocaleString('de-DE'):'')+(view.approved_by?' · '+view.approved_by:'')+(view.approved_knowledge_revision?' · Knowledge Revision '+view.approved_knowledge_revision:'')}else if(view.status==='CHANGES_PENDING'){meta.className='source-v2-review-meta';meta.textContent='Neue Änderungen vorhanden. Bitte Projektakte erneut aufbereiten und prüfen. Factories bleiben bis zur erneuten Freigabe gesperrt.'}else if((view.source_count||0)===0){meta.className='source-v2-review-meta';meta.textContent='Noch kein Rohmaterial. KI-Aufbereitung und finale Freigabe sind noch nicht abgeschlossen.'}else{meta.className='source-v2-review-meta';meta.textContent='Rohmaterial vorhanden. Der nächste Schritt ist die KI-Aufbereitung, danach die menschliche Prüfung.'}}
async function refresh(root,scope){const p=await payload(scope);root.__sourcePayload=p;root.dataset.scope=scope;renderCards(root,p);decorateKnowledge(root,p);const status=root.querySelector('[data-source-status]');const count=p?.workspace?.sections?.project_sources?.length||0;if(status)status.innerHTML='<span class="badge neutral">'+count+' Rohquelle'+(count===1?'':'n')+'</span> · '+esc(p?.workspace?.knowledge_review?.status||'NOT_STARTED');return p}
function activate(root){if(!root||root.dataset.intakeUxV2==='true')return;root.dataset.intakeUxV2='true';const h2=root.querySelector('h2');if(h2)h2.textContent='Wäschekorb / Rohmaterial';const eyebrow=root.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='PROJECT FERRARI · INTELLIGENT PROJECT INTAKE';makeComposer(root);const scope=root.dataset.scope||root.__sourcePayload?.identity?.scope_key;if(scope)refresh(root,scope).catch(()=>{})}
function tick(){document.querySelectorAll('[data-project-source-intake]').forEach(root=>{activate(root);const p=root.__sourcePayload;if(p){const cards=root.querySelector('[data-source-cards]');if(cards&&!cards.querySelector('[data-v2-source-card]'))renderCards(root,p);decorateKnowledge(root,p)}})}
new MutationObserver(tick).observe(document.documentElement,{childList:true,subtree:true});tick();setInterval(tick,1200)
})()</script>`;
  return html.includes('</body>') ? html.replace('</body>', addon + '</body>') : html + addon;
}

export async function applyProjectIntakeUxV2(response) {
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
  const html = await response.text();
  const next = injectProjectIntakeUxV2(html);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-project-intake-ux', 'v2');
  return new Response(next, { status: response.status, statusText: response.statusText, headers });
}

export function projectIntakeUxV2Manifest() {
  return {
    schema: 'aurentara.project-ferrari-intake-ux.v2',
    existing_source_registry_reused: true,
    existing_asset_registry_reused: true,
    existing_knowledge_review_reused: true,
    existing_approval_engine_reused: true,
    sequential_upload_requests: true,
    per_file_progress: true,
    partial_failure_preserves_success: true,
    direct_image_thumbnails: true,
    image_purpose_editable: true,
    direct_manual_note_input: true,
    manual_note_editable: true,
    no_automatic_paid_ai_call: true,
    dashboard_redesign: false,
    production_deploy: false,
    external_writes: false
  };
}
