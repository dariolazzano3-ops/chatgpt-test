const clean=(value,max=240)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const SECTION_LABELS=Object.freeze({
  hq:'HQ',
  projects:'Projects',
  mission:'Missions',
  approvals:'Approvals',
  deliveries:'Results',
  executions:'Executions',
  factories:'Factories',
  capabilities:'Capabilities',
  providers:'Providers',
  costs:'Costs',
  quality:'Quality',
  alerts:'Blocker / Hinweise',
  health:'System Health',
  audit:'Activity',
  settings:'Settings / Richtlinien'
});
export const GLOBAL_OPERATOR_AI_SECTIONS=Object.freeze(Object.keys(SECTION_LABELS));

export function sanitizeGlobalOperatorAiUiContext(input={},authoritative={}){
  const rawSection=clean(input.section,80).toLowerCase();
  const section=GLOBAL_OPERATOR_AI_SECTIONS.includes(rawSection)?rawSection:'hq';
  const scope=clean(authoritative.selected_project_scope,640)||null;
  const projects=Array.isArray(authoritative.projects)?authoritative.projects:[];
  const project=scope?projects.find(item=>clean(item?.scope_key,640)===scope):null;
  return Object.freeze({
    schema:'aurentara.operator-ai.ui-context-hint.v1',
    source:'MASTERDASHBOARD_UI',
    hint_only:true,
    authoritative:false,
    section,
    section_label:SECTION_LABELS[section],
    view_identity:`masterdashboard:${section}`,
    selected_project_scope:scope,
    selected_project_name:clean(project?.name||project?.project_name||project?.project_id,260)||null,
    conversation_project_scope:scope,
    production_authorized:false,
    external_writes_authorized:false,
    level_4_active:false
  });
}

const STYLE=String.raw`<style id="aurentara-global-operator-ai-access-v1-style">
.global-operator-ai-trigger{position:fixed;right:22px;top:18px;z-index:1200;border:1px solid #3d443a;background:#1e211d;color:#fff;border-radius:999px;padding:10px 15px;font-size:12px;font-weight:800;letter-spacing:.04em;box-shadow:0 10px 28px rgba(20,24,19,.18)}
.global-operator-ai-trigger:hover,.global-operator-ai-trigger:focus-visible{background:#2b3029}
.global-operator-ai-backdrop{position:fixed;inset:0;z-index:1300;background:rgba(18,21,17,.28);display:none;justify-content:flex-end}
.global-operator-ai-backdrop.open{display:flex}
.global-operator-ai-panel{width:min(440px,100vw);height:100%;background:#fff;border-left:1px solid var(--line);box-shadow:-18px 0 40px rgba(20,24,19,.14);display:flex;flex-direction:column;min-width:0}
.global-operator-ai-head{padding:18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.global-operator-ai-head h2{font-size:20px;margin:2px 0 3px}.global-operator-ai-close{border:1px solid var(--line);background:#fff;border-radius:10px;width:38px;height:38px;font-size:20px}
.global-operator-ai-body{padding:16px 18px 20px;display:flex;flex-direction:column;gap:13px;min-height:0;overflow:auto;flex:1}
.global-operator-ai-context{display:grid;grid-template-columns:1fr 1fr;gap:8px}.global-operator-ai-context .kv{padding:9px}
.global-operator-ai-compose{display:grid;gap:9px}.global-operator-ai-compose textarea{min-height:112px;resize:vertical;width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;background:#fff;color:var(--ink)}
.global-operator-ai-output{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fafaf7;display:grid;gap:10px}
.global-operator-ai-output[hidden]{display:none}.global-operator-ai-answer{font-size:14px;white-space:pre-wrap}.global-operator-ai-blockers{display:grid;gap:5px}.global-operator-ai-foot{display:flex;gap:8px;flex-wrap:wrap}
.global-operator-ai-model{font-size:11px;color:var(--muted)}
@media(max-width:760px){.global-operator-ai-trigger{top:auto;bottom:18px;right:14px;padding:11px 14px}.global-operator-ai-backdrop{align-items:flex-end}.global-operator-ai-panel{width:100%;height:min(92vh,780px);border-left:0;border-top:1px solid var(--line);border-radius:18px 18px 0 0}.global-operator-ai-context{grid-template-columns:1fr}.global-operator-ai-head{padding:15px 16px}.global-operator-ai-body{padding:14px 16px 18px}.global-operator-ai-compose textarea{min-height:104px}.global-operator-ai-foot .btn{flex:1;min-height:44px}}
</style>`;

const MARKUP=String.raw`<button id="global-operator-ai-trigger" class="global-operator-ai-trigger" type="button" aria-controls="global-operator-ai-panel" aria-expanded="false">ASK OPERATOR AI</button>
<div id="global-operator-ai-backdrop" class="global-operator-ai-backdrop" aria-hidden="true">
  <aside id="global-operator-ai-panel" class="global-operator-ai-panel" role="dialog" aria-modal="true" aria-labelledby="global-operator-ai-title">
    <div class="global-operator-ai-head"><div><div class="eyebrow">AURENTARA SYSTEMS</div><h2 id="global-operator-ai-title">Operator AI</h2><div class="small"><span class="badge ready">REAL AI CONNECTED</span></div></div><button id="global-operator-ai-close" class="global-operator-ai-close" type="button" aria-label="Operator AI schließen">×</button></div>
    <div class="global-operator-ai-body">
      <div class="global-operator-ai-context"><div class="kv"><b>Aktueller Bereich</b><span id="global-operator-ai-section">HQ</span></div><div class="kv"><b>Aktuelles Projekt</b><span id="global-operator-ai-project">Nicht ausgewählt</span></div></div>
      <div class="global-operator-ai-compose"><textarea id="global-operator-ai-input" placeholder="Frag Operator AI zu genau diesem Bereich…" aria-label="Operator AI Frage"></textarea><button id="global-operator-ai-send" class="btn primary" type="button">SENDEN</button></div>
      <div id="global-operator-ai-output" class="global-operator-ai-output" hidden aria-live="polite"></div>
      <div class="global-operator-ai-foot"><button id="global-operator-ai-full" class="btn" type="button">IN OPERATOR AI ÖFFNEN</button></div>
    </div>
  </aside>
</div>`;

const SCRIPT=String.raw`<script id="aurentara-global-operator-ai-access-v1-script">
(()=>{if(window.__aurentaraGlobalOperatorAiAccessV1)return;window.__aurentaraGlobalOperatorAiAccessV1=true;
const trigger=document.getElementById('global-operator-ai-trigger'),backdrop=document.getElementById('global-operator-ai-backdrop'),panel=document.getElementById('global-operator-ai-panel'),close=document.getElementById('global-operator-ai-close'),send=document.getElementById('global-operator-ai-send'),input=document.getElementById('global-operator-ai-input'),output=document.getElementById('global-operator-ai-output'),full=document.getElementById('global-operator-ai-full'),sectionLabel=document.getElementById('global-operator-ai-section'),projectLabel=document.getElementById('global-operator-ai-project');
if(!trigger||!backdrop||!panel)return;
const LABELS={hq:'HQ',projects:'Projects',mission:'Missions',approvals:'Approvals',deliveries:'Results',executions:'Executions',factories:'Factories',capabilities:'Capabilities',providers:'Providers',costs:'Costs',quality:'Quality',alerts:'Blocker / Hinweise',health:'System Health',audit:'Activity',settings:'Settings / Richtlinien'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>{const s=typeof state!=='undefined'&&state?state:{};const section=String(s.section||'hq');const scope=String(s.selectedScope||'').slice(0,640)||null;const items=s.data?.projects?.items||[];const detail=s.detail?.project||null;const project=(detail?.scope_key===scope?detail:items.find(x=>x.scope_key===scope))||null;return{section:LABELS[section]?section:'hq',section_label:LABELS[section]||'HQ',view_identity:'masterdashboard:'+(LABELS[section]?section:'hq'),selected_project_scope:scope,selected_project_name:project?.name||project?.project_name||project?.project_id||null,conversation_project_scope:scope}};
const refreshContext=()=>{const c=current();sectionLabel.textContent=c.section_label;projectLabel.textContent=c.selected_project_name||'Nicht ausgewählt';return c};
const open=()=>{refreshContext();backdrop.classList.add('open');backdrop.setAttribute('aria-hidden','false');trigger.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';setTimeout(()=>input?.focus(),0)};
const shut=()=>{backdrop.classList.remove('open');backdrop.setAttribute('aria-hidden','true');trigger.setAttribute('aria-expanded','false');document.body.style.overflow='';trigger.focus()};
trigger.onclick=open;close.onclick=shut;backdrop.addEventListener('click',e=>{if(e.target===backdrop)shut()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.classList.contains('open'))shut()});
const renderResult=d=>{const blockers=Array.isArray(d.blockers)?d.blockers:[];const usage=d.inference?.usage;const cost=d.inference?.estimated_cost_usd;output.hidden=false;output.innerHTML='<div><div class="eyebrow">Antwort</div><div class="global-operator-ai-answer">'+esc(d.summary||'Keine Antwort verfügbar.')+'</div></div><div><b>Next Action</b><div class="small">'+esc(d.next_action?.message||'Keine weitere Aktion ermittelt.')+'</div></div><div><b>Blocker</b><div class="global-operator-ai-blockers">'+(blockers.length?blockers.slice(0,5).map(x=>'<span class="small">'+esc(x.code||x.message||x)+'</span>').join(''):'<span class="small">Keine priorisierten Blocker.</span>')+'</div></div><div class="global-operator-ai-model">AI: '+esc(d.inference?.status==='VERIFIED'?'REAL AI CONNECTED':'FAIL-SAFE')+' · '+esc(d.inference?.model||'gpt-5.6-luna')+(usage?' · '+esc(usage.total_tokens)+' Tokens':'')+(Number.isFinite(Number(cost))?' · $'+esc(cost):'')+'</div>'};
send.onclick=async()=>{const message=input?.value.trim();if(!message)return;const ui=refreshContext();send.disabled=true;output.hidden=false;output.innerHTML='<div class="small">Operator AI wertet den verifizierten Kontext aus…</div>';try{const r=await fetch('/operator/api/operator-ai/message',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,project_scope:ui.selected_project_scope,conversation_project_scope:ui.conversation_project_scope,ui_context:ui})});const d=await r.json().catch(()=>({error:'INVALID_RESPONSE'}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));renderResult(d)}catch(e){output.innerHTML='<div class="error">'+esc(e.message||e)+'</div>'}finally{send.disabled=false}};
full.onclick=()=>{shut();if(typeof window.aurentaraOpenOperatorAiV1==='function')window.aurentaraOpenOperatorAiV1()};
window.aurentaraGlobalOperatorAiContextV1=current;window.aurentaraOpenGlobalOperatorAiV1=open;window.aurentaraCloseGlobalOperatorAiV1=shut;
new MutationObserver(()=>{if(backdrop.classList.contains('open'))refreshContext()}).observe(document.querySelector('.main')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
</script>`;

export function injectGlobalOperatorAiAccessUi(source=''){
  if(!source||source.includes('aurentara-global-operator-ai-access-v1-script'))return source;
  const addon=`${STYLE}${MARKUP}${SCRIPT}`;
  return source.includes('</body>')?source.replace('</body>',`${addon}</body>`):`${source}${addon}`;
}

export function globalOperatorAiAccessManifest(){
  return {
    schema:'aurentara.global-operator-ai-access.v1',
    dashboard_wide_trigger:true,
    nav_rebuild_independent:true,
    sidepanel:true,
    full_workspace_preserved:true,
    context_hint_fields:['section','section_label','view_identity','selected_project_scope','selected_project_name','conversation_project_scope'],
    sections:[...GLOBAL_OPERATOR_AI_SECTIONS],
    desktop_drawer:true,
    mobile_drawer:true,
    project_resolution_authoritative:true,
    ui_context_hint_only:true,
    paid_provider_calls_for_acceptance:0,
    production_deploy:false,
    external_writes:false,
    level_4_status:'NOT_ACTIVATED'
  };
}
