const clean=(value,max=240)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const SECTION_LABELS=Object.freeze({
  hq:'HQ',
  projects:'Projects',
  missions:'Missions',
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
(function(){
if(window.__aurentaraGlobalOperatorAiAccessV1){return;}
window.__aurentaraGlobalOperatorAiAccessV1=true;
var trigger=document.getElementById('global-operator-ai-trigger');
var backdrop=document.getElementById('global-operator-ai-backdrop');
var panel=document.getElementById('global-operator-ai-panel');
var closeButton=document.getElementById('global-operator-ai-close');
var sendButton=document.getElementById('global-operator-ai-send');
var input=document.getElementById('global-operator-ai-input');
var output=document.getElementById('global-operator-ai-output');
var fullButton=document.getElementById('global-operator-ai-full');
var sectionLabel=document.getElementById('global-operator-ai-section');
var projectLabel=document.getElementById('global-operator-ai-project');
if(!trigger||!backdrop||!panel||!closeButton||!sendButton||!input||!output||!fullButton||!sectionLabel||!projectLabel){return;}
var LABELS={hq:'HQ',projects:'Projects',missions:'Missions',mission:'Missions',approvals:'Approvals',deliveries:'Results',executions:'Executions',factories:'Factories',capabilities:'Capabilities',providers:'Providers',costs:'Costs',quality:'Quality',alerts:'Blocker / Hinweise',health:'System Health',audit:'Activity',settings:'Settings / Richtlinien'};
function currentContext(){
  var dashboardState=typeof state!=='undefined'&&state?state:{};
  var rawSection=String(dashboardState.section||'hq');
  var section=LABELS[rawSection]?rawSection:'hq';
  var scope=String(dashboardState.selectedScope||'').slice(0,640)||null;
  var items=dashboardState.data&&dashboardState.data.projects&&Array.isArray(dashboardState.data.projects.items)?dashboardState.data.projects.items:[];
  var detail=dashboardState.detail&&dashboardState.detail.project?dashboardState.detail.project:null;
  var project=null;
  if(detail&&detail.scope_key===scope){project=detail;}
  if(!project&&scope){for(var i=0;i<items.length;i+=1){if(items[i]&&items[i].scope_key===scope){project=items[i];break;}}}
  return {section:section,section_label:LABELS[section]||'HQ',view_identity:'masterdashboard:'+section,selected_project_scope:scope,selected_project_name:project&&(project.name||project.project_name||project.project_id)||null,conversation_project_scope:scope};
}
function refreshContext(){
  var context=currentContext();
  sectionLabel.textContent=context.section_label;
  projectLabel.textContent=context.selected_project_name||'No project selected';
  return context;
}
function openPanel(){
  refreshContext();
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden','false');
  trigger.setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';
  setTimeout(function(){input.focus();},0);
}
function closePanel(){
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden','true');
  trigger.setAttribute('aria-expanded','false');
  document.body.style.overflow='';
  trigger.focus();
}
function makeBlock(title,text){
  var root=document.createElement('div');
  var heading=document.createElement('b');
  var body=document.createElement('div');
  heading.textContent=title;
  body.className='small';
  body.textContent=text;
  root.appendChild(heading);
  root.appendChild(body);
  return root;
}
function clearOutput(){
  while(output.firstChild){output.removeChild(output.firstChild);}
}
function renderResult(data){
  output.hidden=false;
  clearOutput();
  var answerRoot=document.createElement('div');
  var eyebrow=document.createElement('div');
  var answer=document.createElement('div');
  eyebrow.className='eyebrow';
  eyebrow.textContent='Antwort';
  answer.className='global-operator-ai-answer';
  answer.textContent=String(data&&data.summary||'Keine Antwort verfuegbar.');
  answerRoot.appendChild(eyebrow);
  answerRoot.appendChild(answer);
  output.appendChild(answerRoot);
  output.appendChild(makeBlock('Next Action',String(data&&data.next_action&&data.next_action.message||'Keine weitere Aktion ermittelt.')));
  var blockersRoot=document.createElement('div');
  var blockersTitle=document.createElement('b');
  var blockersList=document.createElement('div');
  blockersTitle.textContent='Blocker';
  blockersList.className='global-operator-ai-blockers';
  var blockers=Array.isArray(data&&data.blockers)?data.blockers:[];
  if(blockers.length){
    for(var j=0;j<blockers.length&&j<5;j+=1){
      var item=blockers[j];
      var blockerRow=document.createElement('span');
      blockerRow.className='small';
      blockerRow.textContent=String(item&&item.code||item&&item.message||item||'');
      blockersList.appendChild(blockerRow);
    }
  }else{
    var emptyBlocker=document.createElement('span');
    emptyBlocker.className='small';
    emptyBlocker.textContent='Keine priorisierten Blocker.';
    blockersList.appendChild(emptyBlocker);
  }
  blockersRoot.appendChild(blockersTitle);
  blockersRoot.appendChild(blockersList);
  output.appendChild(blockersRoot);
  var inference=data&&data.inference||{};
  var usage=inference.usage||null;
  var cost=Number(inference.estimated_cost_usd);
  var model=document.createElement('div');
  var modelText='AI: '+(inference.status==='VERIFIED'?'REAL AI CONNECTED':'FAIL-SAFE')+' | '+String(inference.model||'gpt-5.6-luna');
  model.className='global-operator-ai-model';
  if(usage){modelText+=' | '+String(usage.total_tokens)+' Tokens';}
  if(Number.isFinite(cost)){modelText+=' | $'+String(cost);}
  model.textContent=modelText;
  output.appendChild(model);
}
function renderMessage(className,text){
  output.hidden=false;
  clearOutput();
  var row=document.createElement('div');
  row.className=className;
  row.textContent=text;
  output.appendChild(row);
}
trigger.addEventListener('click',openPanel);
closeButton.addEventListener('click',closePanel);
backdrop.addEventListener('click',function(event){if(event.target===backdrop){closePanel();}});
document.addEventListener('keydown',function(event){if(event.key==='Escape'&&backdrop.classList.contains('open')){closePanel();}});
sendButton.addEventListener('click',function(){
  var message=input.value.trim();
  if(!message){return;}
  var ui=refreshContext();
  sendButton.disabled=true;
  renderMessage('small','Operator AI analysiert den verifizierten Kontext...');
  fetch('/operator/api/operator-ai/message',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:message,project_scope:ui.selected_project_scope,conversation_project_scope:ui.conversation_project_scope,ui_context:ui})})
    .then(function(response){return response.json().catch(function(){return {error:'INVALID_RESPONSE'};}).then(function(data){if(!response.ok){throw new Error(data.error||('HTTP '+response.status));}return data;});})
    .then(function(data){renderResult(data);})
    .catch(function(error){renderMessage('error',String(error&&error.message||error||'Operator AI request failed.'));})
    .then(function(){sendButton.disabled=false;});
});
fullButton.addEventListener('click',function(){closePanel();if(typeof window.aurentaraOpenOperatorAiV1==='function'){window.aurentaraOpenOperatorAiV1();}});
window.aurentaraGlobalOperatorAiContextV1=currentContext;
window.aurentaraOpenGlobalOperatorAiV1=openPanel;
window.aurentaraCloseGlobalOperatorAiV1=closePanel;
var main=document.querySelector('.main')||document.body;
new MutationObserver(function(){if(backdrop.classList.contains('open')){refreshContext();}}).observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
}());
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
