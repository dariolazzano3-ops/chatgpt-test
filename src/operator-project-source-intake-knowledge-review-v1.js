import { authorizeOperator } from './operator-dashboard-http-v1.js';
import {
  prepareProjectKnowledgeReview,
  editProjectKnowledgeReviewItem,
  approveProjectKnowledgeReview,
  reopenProjectKnowledgeReview,
  buildProjectKnowledgeReviewView
} from './project-source-knowledge-review-v1.js';
import { organizeProjectKnowledgeWithAi } from './project-source-knowledge-organizer-v1.js';
import { extractProjectImageKnowledgeWithVision } from './project-source-image-vision-extraction-v1.js';
import { reviewProjectFact } from './project-source-intake-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const ROUTES = new Set([
  '/operator/api/project-source-intake/review/prepare',
  '/operator/api/project-source-intake/review/item',
  '/operator/api/project-source-intake/review/fact-decision',
  '/operator/api/project-source-intake/review/approve',
  '/operator/api/project-source-intake/review/reopen'
]);

function json(body, status = 200) {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-extension', 'project-knowledge-review-v1');
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

export async function handleProjectKnowledgeReviewApi(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!ROUTES.has(url.pathname)) return null;
  if (!['POST', 'PATCH'].includes(request.method)) return json({ error: 'METHOD_NOT_ALLOWED', production_deploy: false }, 405);

  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);

  const body = await readJson(request);
  const scopeKey = clean(body.scope_key, 640);
  const contextScopeKey = clean(body.context_scope_key, 640);
  if (!scopeKey) return json({ error: 'PROJECT_KNOWLEDGE_REVIEW_SCOPE_REQUIRED', production_deploy: false }, 400);
  if (contextScopeKey && contextScopeKey !== scopeKey) {
    return json({ error: 'PROJECT_KNOWLEDGE_REVIEW_PROJECT_CONTEXT_MISMATCH', production_deploy: false }, 409);
  }

  const service = options.runtime_service;
  const read = await load(service, scopeKey);
  if (!read.ok) return json(read.body, read.status || 400);
  const actorId = auth.operator_id || auth.email || read.body.identity?.operator_id || 'operator';

  if (url.pathname.endsWith('/prepare')) {
    const extractImages = typeof options.image_vision_extractor === 'function'
      ? options.image_vision_extractor
      : extractProjectImageKnowledgeWithVision;
    const vision = await extractImages(read.body.state, env, {
      allow_paid_inference: body.allow_ai === true,
      storage_client: options.project_source_storage_client,
      storage_fetcher: options.project_source_storage_fetcher,
      fetch_impl: options.image_vision_fetch_impl
    });
    if (!vision.ok || !vision.state) {
      return json({
        error: vision.error || 'PROJECT_IMAGE_VISION_EXTRACTION_FAILED',
        image_vision: vision,
        production_deploy: false,
        external_writes: false
      }, 400);
    }

    const organize = typeof options.knowledge_organizer === 'function'
      ? options.knowledge_organizer
      : organizeProjectKnowledgeWithAi;
    const organized = await organize(vision.state, env, {
      allow_paid_inference: body.allow_ai === true,
      fetch_impl: options.knowledge_organizer_fetch_impl
    });
    if (!organized.ok || !organized.structure) {
      return json({
        error: organized.error || 'PROJECT_KNOWLEDGE_ORGANIZATION_FAILED',
        organizer: organized,
        image_vision: vision,
        production_deploy: false
      }, 400);
    }
    const prepared = prepareProjectKnowledgeReview(vision.state, {
      ...organized.structure,
      ai_used: organized.ai_used === true,
      provider: organized.provider || organized.structure.provider,
      model: organized.model || organized.structure.model
    }, { actor_id: actorId });
    if (!prepared.ok) return json(prepared, 400);
    const saved = await save(service, read, prepared.state, 'PROJECT_KNOWLEDGE_REVIEW_PREPARED');
    if (!saved.ok) return json(saved.body, saved.status || 409);
    return json({
      ok: true,
      review: buildProjectKnowledgeReviewView(prepared.state),
      image_vision: {
        requested_image_count: Number(vision.requested_image_count || 0),
        extracted_image_count: Number(vision.extracted_image_count || 0),
        skipped_image_count: Number(vision.skipped_image_count || 0),
        extracted_fact_count: Number(vision.extracted_fact_count || 0),
        paid_provider_calls: Number(vision.paid_provider_calls || 0),
        estimated_cost_usd: Number(vision.estimated_cost_usd || 0),
        provider: vision.provider || null,
        model: vision.model || null,
        results: Array.isArray(vision.results) ? vision.results : []
      },
      organizer: {
        status: organized.status,
        ai_used: organized.ai_used === true,
        provider: organized.provider || null,
        model: organized.model || null,
        fallback_reason: organized.fallback_reason || null,
        paid_provider_calls: Number(organized.paid_provider_calls || 0),
        estimated_cost_usd: Number(organized.estimated_cost_usd || 0)
      },
      runtime_revision: saved.body.runtime_revision,
      gate_active: true,
      production_deploy: false,
      external_writes: false
    }, 201);
  }

  if (url.pathname.endsWith('/fact-decision')) {
    const factId = clean(body.fact_id || body.item_id, 240);
    const verificationStatus = clean(body.verification_status || body.status, 80).toUpperCase();
    if (!factId || !['OPERATOR_CONFIRMED', 'REJECTED'].includes(verificationStatus)) {
      return json({ error: 'PROJECT_KNOWLEDGE_CONFLICT_DECISION_REQUIRED', production_deploy: false }, 400);
    }
    const reviewed = reviewProjectFact(read.body.state, factId, {
      verification_status: verificationStatus,
      verified_by: actorId
    }, { actor_id: actorId });
    if (!reviewed.ok) return json(reviewed, reviewed.error === 'PROJECT_FACT_NOT_FOUND' ? 404 : 400);
    const saved = await save(service, read, reviewed.state, 'PROJECT_KNOWLEDGE_CONFLICT_HUMAN_RESOLVED');
    if (!saved.ok) return json(saved.body, saved.status || 409);
    return json({
      ok: true,
      fact: reviewed.fact,
      review: buildProjectKnowledgeReviewView(reviewed.state),
      runtime_revision: saved.body.runtime_revision,
      gate_active: true,
      human_conflict_decision: true,
      production_deploy: false,
      external_writes: false
    });
  }

  if (url.pathname.endsWith('/item')) {
    const edited = editProjectKnowledgeReviewItem(read.body.state, body, { actor_id: actorId });
    if (!edited.ok) return json(edited, edited.error?.includes('NOT_FOUND') ? 404 : 400);
    const saved = await save(service, read, edited.state, 'PROJECT_KNOWLEDGE_REVIEW_ITEM_EDITED');
    if (!saved.ok) return json(saved.body, saved.status || 409);
    return json({
      ok: true,
      review: buildProjectKnowledgeReviewView(edited.state),
      runtime_revision: saved.body.runtime_revision,
      gate_active: true,
      production_deploy: false,
      external_writes: false
    });
  }

  if (url.pathname.endsWith('/approve')) {
    const approved = approveProjectKnowledgeReview(read.body.state, {
      review_seen: body.review_seen === true,
      approval_confirmed: body.approval_confirmed === true
    }, { actor_id: actorId });
    if (!approved.ok) return json(approved, 400);
    const saved = await save(service, read, approved.state, 'PROJECT_KNOWLEDGE_APPROVED_FOR_USE');
    if (!saved.ok) return json(saved.body, saved.status || 409);
    return json({
      ok: true,
      review: buildProjectKnowledgeReviewView(approved.state),
      approved_fact_count: approved.approved_fact_count,
      approved_asset_count: approved.approved_asset_count,
      runtime_revision: saved.body.runtime_revision,
      gate_active: false,
      factories_may_use_approved_knowledge: true,
      production_deploy: false,
      external_writes: false
    });
  }

  const reopened = reopenProjectKnowledgeReview(read.body.state, { actor_id: actorId });
  if (!reopened.ok) return json(reopened, 400);
  const saved = await save(service, read, reopened.state, 'PROJECT_KNOWLEDGE_REVIEW_REOPENED');
  if (!saved.ok) return json(saved.body, saved.status || 409);
  return json({
    ok: true,
    review: buildProjectKnowledgeReviewView(reopened.state),
    runtime_revision: saved.body.runtime_revision,
    gate_active: true,
    production_deploy: false,
    external_writes: false
  });
}

function injectUi(html = '') {
  if (!html.includes('aurentara-project-source-storage-v1-ui') || html.includes('aurentara-project-knowledge-review-v1-ui')) return html;
  const addon = `<style id="aurentara-project-knowledge-review-v1-style">
.knowledge-review-v1{margin:0 0 16px;padding:16px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#fff,#fafafa)}
.knowledge-review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.knowledge-review-head h3{margin:2px 0 4px;font-size:20px}
.knowledge-review-stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:14px 0}
.knowledge-stage{padding:9px;border:1px solid var(--line);border-radius:10px;font-size:12px;background:#fff}
.knowledge-stage.complete{border-color:#067647;background:#ecfdf3;color:#05603a;font-weight:650}
.knowledge-review-message{padding:12px;border-radius:12px;background:#f6f7f8;border:1px solid var(--line);font-size:13px;line-height:1.5}
.knowledge-review-message.locked{background:#fff7ed;border-color:#f2c48d}
.knowledge-review-message.approved{background:#ecfdf3;border-color:#067647;color:#05603a}
.knowledge-sections{display:grid;gap:10px;margin-top:12px}
.knowledge-section{border:1px solid var(--line);border-radius:13px;background:#fff;overflow:hidden}
.knowledge-section summary{cursor:pointer;padding:12px 14px;font-weight:700}
.knowledge-section-body{padding:0 14px 14px;display:grid;gap:8px}
.knowledge-item{border-top:1px solid var(--line);padding-top:9px}
.knowledge-item:first-child{border-top:0}
.knowledge-item-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.knowledge-item-value{font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.knowledge-item-meta{font-size:11px;color:var(--muted);margin-top:3px}
.knowledge-edit{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.5fr) auto auto;gap:7px;margin-top:8px}
.knowledge-edit textarea{min-height:74px;resize:vertical}
.knowledge-approval{margin-top:14px;padding:13px;border:1px solid var(--line);border-radius:12px;background:#fff}
.knowledge-approval label{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.45}
.knowledge-review-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.knowledge-ai-badge{font-size:11px;padding:5px 8px;border-radius:999px;border:1px solid var(--line);background:#fff}
@media(max-width:760px){.knowledge-review-stages{grid-template-columns:1fr 1fr}.knowledge-edit{grid-template-columns:1fr}.knowledge-review-actions .btn{width:100%}}
</style><script id="aurentara-project-knowledge-review-v1-ui">(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>typeof v==='string'?v:JSON.stringify(v,null,2);
const api=async(path,body,method='POST')=>{const res=await fetch('/operator/api/project-source-intake/review/'+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await res.json().catch(()=>({}));if(!res.ok){const e=new Error(data.error||('HTTP_'+res.status));e.data=data;throw e}return data};
const sourceApi=async scope=>{const res=await fetch('/operator/api/project-source-intake?scope_key='+encodeURIComponent(scope));const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||('HTTP_'+res.status));return data};
const stateText=status=>({NOT_STARTED:'Noch nicht aufbereitet',COLLECTING:'Rohquellen werden gesammelt',IN_REVIEW:'Strukturierte Projektakte wartet auf deine Prüfung',CHANGES_PENDING:'Neue Änderungen vorhanden. Freigabe ist pausiert.',APPROVED:'Projektwissen ist für Ferrari freigegeben'}[status]||status);
const errorText=e=>({PROJECT_KNOWLEDGE_CONFLICTS_MUST_BE_RESOLVED:'Es gibt noch widersprüchliche Angaben. Bitte diese zuerst korrigieren.',PROJECT_KNOWLEDGE_EXPLICIT_APPROVAL_REQUIRED:'Bitte die Projektakte zuerst prüfen und den Freigabe-Haken setzen.',PROJECT_KNOWLEDGE_REVIEW_NOT_PREPARED:'Bitte zuerst mit KI aufbereiten.',PROJECT_KNOWLEDGE_REVIEW_EMPTY:'Ohne Rohmaterial kann nichts freigegeben werden.',PROJECT_KNOWLEDGE_REVIEW_REOPEN_REQUIRED:'Bitte die Freigabe zuerst wieder zur Bearbeitung öffnen.',PROJECT_IMAGE_VISION_BATCH_LIMIT_EXCEEDED:'Bitte maximal 6 Bilder gleichzeitig zum Informationen-Auslesen markieren.',PROJECT_IMAGE_VISION_STORAGE_READ_FAILED:'Ein markiertes Bild konnte nicht sicher aus dem privaten Speicher geladen werden.',PROJECT_IMAGE_VISION_OPENAI_CREDENTIAL_REQUIRED:'Die Bildanalyse ist im Staging gerade nicht verfügbar.',PROJECT_IMAGE_VISION_REAL_INFERENCE_NOT_ENABLED:'Die Bildanalyse ist im Staging gerade nicht aktiviert.',PROJECT_IMAGE_VISION_STAGING_SAFETY_CONTRACT_NOT_MET:'Die Bildanalyse ist nur im sicheren privaten Staging erlaubt.',PROJECT_IMAGE_VISION_COST_CEILING_EXCEEDED:'Die Bildanalyse wurde durch das Kostenlimit gestoppt.'}[e?.data?.error||e?.message]||('Aktion fehlgeschlagen: '+(e?.data?.error||e?.message||'UNKNOWN')));
function rootScope(root){return root?.__sourcePayload?.identity?.scope_key||root?.dataset?.scope||''}
function ensurePanel(root){let panel=root.querySelector('[data-knowledge-review-panel]');if(panel)return panel;panel=document.createElement('div');panel.className='knowledge-review-v1';panel.dataset.knowledgeReviewPanel='true';const grid=root.querySelector('.source-upload-grid');(grid||root.firstChild)?.insertAdjacentElement(grid?'beforebegin':'afterend',panel);const h2=root.querySelector('h2');if(h2&&/Project Sources/i.test(h2.textContent||''))h2.textContent='Wäschekorb / Rohquellen';return panel}
function renderItem(item,scope,status){const editable=status!=='APPROVED';const val=item.type==='FACT'?fmt(item.value):(item.type==='SOURCE'?(item.source_type||'Quelle'):(item.usage_role||'Bild'));const fact=item.type==='FACT';const conflict=fact&&item.verification_status==='SOURCE_CONFLICT';const origin=(item.source_refs||[]).length?' · Quellen: '+item.source_refs.join(', '):(item.source_id?' · Quelle: '+item.source_id:'');return '<div class="knowledge-item" data-knowledge-item="'+esc(item.type)+':'+esc(item.id)+'"><div class="knowledge-item-row"><div><strong>'+esc(item.label||item.id)+'</strong><div class="knowledge-item-value">'+esc(val)+'</div><div class="knowledge-item-meta">'+esc(item.type+(item.field_path?' · '+item.field_path:'')+(item.verification_status?' · '+item.verification_status:'')+origin)+'</div></div>'+(editable?'<div class="source-tools">'+(conflict?'<button class="btn primary" data-knowledge-conflict-confirm="'+esc(item.id)+'">Diese Angabe bestätigen</button>':'')+(fact?'<button class="btn" data-knowledge-fact-reject="'+esc(item.id)+'">Ignorieren</button>':'')+'<button class="btn" data-knowledge-edit="'+esc(item.type)+':'+esc(item.id)+'">Bearbeiten</button></div>':'')+'</div></div>'}
function render(root,payload){const panel=ensurePanel(root);const view=payload?.workspace?.knowledge_review||payload?.workspace?.sections?.knowledge_review||payload?.knowledge_review||payload?.review;const status=view?.status||'NOT_STARTED';const gate=view?.gate||{};const stages=view?.stages||[];panel.innerHTML='<div class="knowledge-review-head"><div><div class="eyebrow">PROJECT FERRARI · INTELLIGENT INTAKE</div><h3>Vom Wäschekorb zur sauberen Projektakte</h3><div class="small">Alles sammeln → KI ordnet → du prüfst → erst danach darf Ferrari damit arbeiten.</div></div><span class="knowledge-ai-badge">'+esc(view?.organized_by==='AI'?'🧠 KI strukturiert':view?.organized_by?'Strukturiert':'Noch roh')+'</span></div>'+
'<div class="knowledge-review-stages">'+stages.map(s=>'<div class="knowledge-stage '+(s.complete?'complete':'')+'">'+esc(s.label)+'</div>').join('')+'</div>'+
'<div class="knowledge-review-message '+(status==='APPROVED'?'approved':gate.allowed===false?'locked':'')+'"><strong>'+esc(stateText(status))+'</strong><div>'+(status==='APPROVED'?'✅ Freigegebener Snapshot. Factories dürfen dieses bestätigte Projektwissen verwenden.':status==='IN_REVIEW'||status==='CHANGES_PENDING'?'🔒 Nutzung gesperrt, bis du die strukturierte Fassung ausdrücklich freigibst.':'Wirf zuerst Websites, Textdateien, Preislisten, Bilder und Notizen in den Wäschekorb. Danach räumt die KI auf.')+'</div></div>'+
((view?.sections||[]).length?'<div class="knowledge-sections">'+view.sections.map(section=>'<details class="knowledge-section" open><summary>'+esc(section.label||section.id)+' · '+esc((section.items||[]).length)+'</summary><div class="knowledge-section-body">'+(section.summary?'<div class="small">'+esc(section.summary)+'</div>':'')+(section.items||[]).map(item=>renderItem(item,rootScope(root),status)).join('')+'</div></details>').join('')+'</div>':'')+
'<div class="knowledge-review-actions">'+(status==='APPROVED'?'<button class="btn" data-knowledge-reopen>Bearbeitung wieder öffnen</button>':'<button class="btn primary" data-knowledge-prepare>'+(status==='IN_REVIEW'||status==='CHANGES_PENDING'?'Mit KI neu sortieren':'Mit KI aufräumen')+'</button>')+'</div>'+
((status==='IN_REVIEW'||status==='CHANGES_PENDING'||status==='COLLECTING')?'<div class="knowledge-approval"><label><input type="checkbox" data-knowledge-confirm> <span>Ich habe die strukturierte Projektakte geprüft. <strong>Ferrari darf jetzt mit diesen bestätigten Informationen arbeiten.</strong></span></label><button class="btn primary" data-knowledge-approve disabled style="margin-top:10px">Für Nutzung freigeben</button></div>':'');
const scope=rootScope(root);const prepare=panel.querySelector('[data-knowledge-prepare]');if(prepare)prepare.onclick=async()=>{if(!scope)return;prepare.disabled=true;prepare.textContent='KI räumt auf…';try{await api('prepare',{scope_key:scope,context_scope_key:scope,allow_ai:true});await refresh(root,scope)}catch(e){alert(errorText(e))}finally{prepare.disabled=false}};
const checkbox=panel.querySelector('[data-knowledge-confirm]'),approve=panel.querySelector('[data-knowledge-approve]');if(checkbox&&approve){checkbox.onchange=()=>approve.disabled=!checkbox.checked;approve.onclick=async()=>{approve.disabled=true;approve.textContent='Freigabe wird gespeichert…';try{await api('approve',{scope_key:scope,context_scope_key:scope,review_seen:true,approval_confirmed:true});await refresh(root,scope)}catch(e){alert(errorText(e));approve.disabled=false}}}
const reopen=panel.querySelector('[data-knowledge-reopen]');if(reopen)reopen.onclick=async()=>{reopen.disabled=true;try{await api('reopen',{scope_key:scope,context_scope_key:scope});await refresh(root,scope)}catch(e){alert(errorText(e));reopen.disabled=false}};
panel.querySelectorAll('[data-knowledge-conflict-confirm]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api('fact-decision',{scope_key:scope,context_scope_key:scope,fact_id:btn.dataset.knowledgeConflictConfirm,verification_status:'OPERATOR_CONFIRMED'});await refresh(root,scope)}catch(e){alert(errorText(e));btn.disabled=false}});panel.querySelectorAll('[data-knowledge-fact-reject]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api('fact-decision',{scope_key:scope,context_scope_key:scope,fact_id:btn.dataset.knowledgeFactReject,verification_status:'REJECTED'});await refresh(root,scope)}catch(e){alert(errorText(e));btn.disabled=false}});panel.querySelectorAll('[data-knowledge-edit]').forEach(btn=>btn.onclick=()=>{const [type,id]=btn.dataset.knowledgeEdit.split(':');const holder=btn.closest('.knowledge-item');if(holder.querySelector('.knowledge-edit'))return;const current=(view.sections||[]).flatMap(s=>s.items||[]).find(x=>x.type===type&&x.id===id);if(!current)return;const edit=document.createElement('div');edit.className='knowledge-edit';const initial=type==='FACT'?fmt(current.value):(type==='SOURCE'?(current.label||''):(current.usage_role||''));const sectionOptions=(view.available_sections||view.sections||[]).map(s=>'<option value="'+esc(s.id)+'" '+(s.id===current.section_id?'selected':'')+'>'+esc(s.label||s.id)+'</option>').join('');edit.innerHTML='<textarea data-knowledge-value>'+esc(initial)+'</textarea><select data-knowledge-section aria-label="Kategorie">'+sectionOptions+'</select><button class="btn primary" data-knowledge-save>Speichern</button><button class="btn" data-knowledge-cancel>Abbrechen</button>';holder.appendChild(edit);edit.querySelector('[data-knowledge-cancel]').onclick=()=>edit.remove();edit.querySelector('[data-knowledge-save]').onclick=async()=>{const value=edit.querySelector('[data-knowledge-value]').value.trim();const body={scope_key:scope,context_scope_key:scope,item_type:type,item_id:id,section_id:edit.querySelector('[data-knowledge-section]')?.value||current.section_id};if(type==='FACT'){let parsed=value;try{parsed=JSON.parse(value)}catch{}body.value=parsed}else if(type==='SOURCE')body.display_name=value;else body.usage_role=value;try{await api('item',body,'PATCH');await refresh(root,scope)}catch(e){alert(errorText(e))}}})}
async function refresh(root,scope){const payload=await sourceApi(scope);root.__sourcePayload=payload;render(root,payload)}
function boot(){const scan=()=>{document.querySelectorAll('[data-project-source-intake]').forEach(root=>{const scope=rootScope(root);if(!scope)return;const panel=ensurePanel(root);if(panel.dataset.scope===scope&&panel.dataset.booted==='true')return;panel.dataset.scope=scope;panel.dataset.booted='true';refresh(root,scope).catch(()=>{})})};scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});setInterval(scan,1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})()</script>`;
  return html.includes('</body>') ? html.replace('</body>', addon + '</body>') : html + addon;
}

export async function applyProjectKnowledgeReviewUi(response) {
  if (!(response instanceof Response)) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  const html = await response.text();
  const next = injectUi(html);
  if (next === html) return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-project-knowledge-review-ui', 'v1');
  return new Response(next, { status: response.status, statusText: response.statusText, headers });
}

export function projectKnowledgeReviewUiManifest() {
  return {
    schema: 'aurentara.operator-project-knowledge-review-ui.v1',
    raw_source_basket: true,
    ai_organization_action: true,
    structured_human_review: true,
    editable_before_approval: true,
    explicit_final_checkbox: true,
    factories_locked_during_review: true,
    existing_project_source_ui_reused: true,
    dashboard_redesign: false,
    production_deploy: false
  };
}
