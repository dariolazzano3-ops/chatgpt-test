import { handleOperatorDashboard as handleDesignDashboard } from './operator-design-ux-v1.js';

const HUMAN_UX_STYLE = String.raw`<style id="aurentara-human-ux-seal-v1-style">
:root{--human-readable:14px;--human-meta:11.5px}
.section{max-width:1500px}
.card{padding:20px 22px}
.card h2,.card h3{line-height:1.28}
.row-main strong,.overview-list .item strong,.human-primary{font-size:13.5px;line-height:1.42}
.small{font-size:12px;line-height:1.55}
.human-meta{font-size:var(--human-meta);line-height:1.45;color:var(--muted);margin-top:3px}
.human-meta code,.human-event-key{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;font-size:10.5px;color:#747871;word-break:break-word}
.human-section{display:grid;gap:14px}
.human-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:2px}
.human-section-head h2{margin:0;font-size:15px}
.human-section-head p{margin:4px 0 0;color:var(--muted);font-size:12px}
.human-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.human-summary{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:18px;box-shadow:var(--shadow)}
.human-summary h3{margin:0 0 3px;font-size:15px}
.human-summary .human-status-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 14px}
.human-kvs{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.human-kv{min-width:0;border:1px solid #eceee8;background:#fbfbf9;border-radius:10px;padding:10px 11px}
.human-kv b{display:block;font-size:10px;letter-spacing:.045em;text-transform:uppercase;color:#6c7069;margin-bottom:4px}
.human-kv span{display:block;font-size:12.5px;line-height:1.42;color:#292b28;overflow-wrap:anywhere}
.human-evidence{margin-top:12px;border-top:1px solid var(--soft);padding-top:8px}
.human-evidence summary{cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:34px;font-size:11.5px;font-weight:650;color:#60645d}
.human-evidence pre{margin:8px 0 0;font-size:10.5px;max-height:360px}
.human-all-clear{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid #dfe9e1;background:#f5f9f6;border-radius:13px;padding:14px 16px}
.human-all-clear strong{font-size:13.5px;color:#34543f}.human-all-clear .small{margin-top:2px}
.human-create-project{border:1px solid var(--line);border-radius:13px;background:var(--panel);margin:14px 0 0;overflow:hidden}
.human-create-project>summary{cursor:pointer;padding:13px 16px;font-size:12.5px;font-weight:680;list-style:none;display:flex;align-items:center;justify-content:space-between}
.human-create-project>summary::-webkit-details-marker{display:none}.human-create-project>summary:after{content:'+';font-size:17px;color:var(--muted)}.human-create-project[open]>summary:after{content:'−'}
.human-create-project>.card,.human-create-project>[data-project-create]{border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none;margin:0}
.human-status-stack{display:grid;gap:8px}
.human-status-row{display:grid;grid-template-columns:minmax(150px,.45fr) minmax(160px,.35fr) minmax(260px,1fr);gap:12px;align-items:start;padding:11px 0;border-top:1px solid var(--soft)}
.human-status-row:first-child{border-top:0}.human-status-row strong{font-size:12.5px}
.human-empty{padding:14px 16px;border:1px dashed #d5d8d1;border-radius:12px;background:#fafbf8;color:#686c65;font-size:12px;line-height:1.5}
.human-provider-grid,.human-factory-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:12px}
.human-provider-card,.human-factory-card{border:1px solid var(--line);border-radius:13px;background:#fff;padding:15px 16px;min-width:0}
.human-provider-card h3,.human-factory-card h3{margin:0;font-size:14px}.human-provider-card .row,.human-factory-card .row{padding:8px 0}
.human-note{margin-top:9px;padding:9px 10px;border-radius:9px;background:#fafbf8;border:1px solid var(--soft);font-size:11.5px;line-height:1.5;color:#60645d}
.human-health-overall{border-left:4px solid #69746b}.human-health-overall[data-state="attention"]{border-left-color:#b88426}.human-health-overall[data-state="blocked"]{border-left-color:#b34b4b}
.human-blocker{border:1px solid #ead7c4;background:#fffaf4;border-radius:12px;padding:13px 14px}.human-blocker h3{margin:0 0 8px;font-size:13px}
.human-blocker-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.human-policy dl{grid-template-columns:minmax(180px,.5fr) 1fr}.human-policy dt{font-size:11.5px}.human-policy dd{font-size:12.5px}
.functional-safety-panel.human-safety-clear{padding:10px 12px!important;opacity:.88}.functional-safety-panel.human-safety-clear .human-safety-label{font-weight:680;font-size:12px;color:#3f6049}.functional-safety-panel.human-safety-risk{border-color:#dfc4a7!important;background:#fff9f2!important}
#approvals .empty,#audit .empty{min-height:62px}
#deliveries .human-summary{max-width:none}
#projects>.card:first-child{margin-bottom:0}
#projects .human-create-project{max-width:1080px}
#health .human-grid{grid-template-columns:repeat(4,minmax(190px,1fr))}
#settings.human-policy .card{max-width:1080px}
.human-secondary-raw{opacity:.96}
@media(max-width:1000px){#health .human-grid{grid-template-columns:1fr 1fr}.human-status-row{grid-template-columns:1fr .5fr}.human-status-row>:last-child{grid-column:1/-1}}
@media(max-width:700px){.card{padding:16px}.human-grid,#health .human-grid{grid-template-columns:1fr}.human-all-clear{align-items:flex-start;flex-direction:column}.human-status-row{grid-template-columns:1fr}.human-status-row>:last-child{grid-column:auto}.human-kvs{grid-template-columns:1fr}.human-provider-grid,.human-factory-grid{grid-template-columns:1fr}}
</style>`;

const HUMAN_UX_SCRIPT = String.raw`<script id="aurentara-human-ux-seal-v1-script">
(() => {
  if (window.__aurentaraHumanUxSealV1) return;
  window.__aurentaraHumanUxSealV1 = true;

  const PAGE_COPY = {
    hq:['HQ','Aktueller Betriebszustand und nächste relevante Aktionen.'],
    projects:['Projekte','Unternehmen und operative Projekte verwalten.'],
    missions:['Missionen','Missionen, Pläne und Ergebnisse nachvollziehen.'],
    mission:['Mission Studio','Missionen formulieren, planen und kontrolliert ausführen.'],
    approvals:['Freigaben','Offene Entscheidungen und Freigaben prüfen.'],
    deliveries:['Ergebnisse','Auslieferungen, Qualität und Evidence nachvollziehen.'],
    executions:['Ausführungen','Laufende und vergangene Ausführungen mit Evidence prüfen.'],
    factories:['Factories','Reifegrad, Verifikation und Einsatzbereitschaft verfolgen.'],
    capabilities:['Capabilities','Registrierte Fähigkeiten und reale Verfügbarkeit prüfen.'],
    providers:['Provider','Verfügbarkeit, Gates und Integrationsstatus prüfen.'],
    costs:['Kosten','Budget, Ausgaben und Reserven im Blick behalten.'],
    quality:['Qualität','Qualitätszustände und Validierung nachvollziehen.'],
    alerts:['Blocker / Hinweise','Handlungsbedarf, Auswirkung und nächsten Schritt erkennen.'],
    health:['Systemstatus','Runtime, Staging und Systembereitschaft überwachen.'],
    audit:['Aktivität','Wichtige Operator- und Systemereignisse nachvollziehen.'],
    settings:['Richtlinien','Aktive Runtime-, Budget- und Sicherheitsrichtlinien einsehen.']
  };
  const NAV_LABELS = {hq:'HQ',projects:'Projekte',missions:'Missionen',mission:'Mission Studio',approvals:'Freigaben',deliveries:'Ergebnisse',executions:'Ausführungen',factories:'Factories',capabilities:'Capabilities',providers:'Provider',costs:'Kosten',quality:'Qualität',alerts:'Blocker',health:'Systemstatus',audit:'Aktivität',settings:'Richtlinien'};
  const GROUP_LABELS = {Overview:'Übersicht',Work:'Arbeit',Operations:'Betrieb',Control:'Steuerung'};
  const EXACT_TEXT = {
    'Projects':'Projekte','Approvals':'Freigaben','Providers':'Provider','Costs':'Kosten','Deliverables':'Ergebnisse','Deliveries':'Ergebnisse','Executions':'Ausführungen','System Health':'Systemstatus','Activity':'Aktivität','Audit Log':'Aktivität','Settings':'Richtlinien','Quality':'Qualität','Attention required':'Handlungsbedarf','Current operations':'Aktive Vorgänge','System & control':'System & Steuerung','Financial / Control':'Kosten & Steuerung','Recent activity':'Letzte Aktivität','Pending approvals':'Offene Freigaben','Variable cost':'Variable Kosten','Critical alerts':'Kritische Hinweise','Operator state':'Operator-Zustand','Provider attention':'Provider-Hinweise','Open':'Öffnen','Review':'Prüfen','Inspect':'Prüfen','Refresh':'Aktualisieren','Spent':'Ausgegeben','Reserved':'Reserviert','Estimated':'Geschätzt','Remaining':'Verbleibend','Default environment':'Standardumgebung','Data mode':'Datenmodus','Mission budget':'Missionsbudget','Monthly budget':'Monatsbudget','Retry limit':'Retry-Limit','Paid overflow':'Paid Overflow','Approval policy':'Freigaberichtlinie','Provider fallback':'Provider-Fallback','NOT CONFIGURED':'Nicht konfiguriert','Not configured':'Nicht konfiguriert'
  };
  const EVENT_TITLES = {
    MISSION_PLAN_DURABLY_RECORDED:'Missionsplan gespeichert',
    SYNTHETIC_UNIVERSAL_MISSION_RECORDED:'Synthetische Mission abgeschlossen',
    UNIVERSAL_MISSION_RECORDED:'Mission aufgezeichnet',
    PROJECT_CREATED:'Projekt erstellt',
    PROJECT_UPDATED:'Projekt aktualisiert',
    MISSION_CREATED:'Mission erstellt',
    MISSION_PLANNED:'Mission geplant',
    MISSION_APPROVED:'Mission freigegeben',
    MISSION_REJECTED:'Mission abgelehnt',
    EXECUTION_STARTED:'Ausführung gestartet',
    EXECUTION_COMPLETED:'Ausführung abgeschlossen',
    EXECUTION_FAILED:'Ausführung fehlgeschlagen',
    DELIVERY_READY:'Ergebnis bereit',
    DELIVERY_COMPLETED:'Auslieferung abgeschlossen',
    APPROVAL_REQUESTED:'Freigabe angefordert',
    APPROVAL_APPROVED:'Freigabe erteilt',
    APPROVAL_REJECTED:'Freigabe abgelehnt'
  };
  const FACTORY_STATES = new Set(['EXISTS','STAGING VERIFIED','READY','PLANNED','NOT VERIFIED','BLOCKED']);
  const PROVIDER_STATES = new Set(['AVAILABLE','STAGING ONLY','CREDENTIAL REQUIRED','BUDGET GATE','PERMISSION GATE','UNAVAILABLE','PRODUCTION DISABLED','UNKNOWN']);
  const rows = (v) => Array.isArray(v) ? v : [];
  const str = (v, fallback='Nicht verifiziert') => v === null || v === undefined || v === '' ? fallback : String(v);
  const h = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const upper = (v) => String(v ?? '').trim().toUpperCase().replace(/-/g,'_');
  const first = (...values) => values.find(v => v !== null && v !== undefined && v !== '');
  const money = (v) => v === null || v === undefined || v === '' ? 'Nicht verifiziert' : (Number.isFinite(Number(v)) ? new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v)) : str(v));
  const humanBool = (v) => v === true || upper(v)==='TRUE' || upper(v)==='ON' ? 'AN' : v === false || upper(v)==='FALSE' || upper(v)==='OFF' ? 'AUS' : str(v);
  const chip = (value, tone) => '<span class="badge '+h(tone||'neutral')+'">'+h(str(value))+'</span>';
  const tone = (raw) => {const x=upper(raw);if(['AVAILABLE','READY','COMPLETED','SUCCESS','HEALTHY','PASS','VERIFIED','STAGING_VERIFIED','STAGING VERIFIED'].includes(x))return'ready';if(['ACTIVE','RUNNING','STAGING_ONLY','STAGING ONLY'].includes(x))return'active';if(['BLOCKED','FAILED','FAILURE','UNAVAILABLE','ERROR'].includes(x))return'blocked';if(['CREDENTIAL_REQUIRED','BUDGET_GATE','PERMISSION_GATE','NOT_VERIFIED','UNKNOWN','ACTION_REQUIRED'].includes(x))return'attention';return'neutral'};
  const kv = (label, value, extra='') => '<div class="human-kv"><b>'+h(label)+'</b><span>'+h(str(value))+'</span>'+extra+'</div>';

  function eventTitle(key){
    const raw=upper(key);
    if(EVENT_TITLES[raw]) return EVENT_TITLES[raw];
    if(!raw || !raw.includes('_')) return str(key);
    const words=raw.toLowerCase().split('_').filter(Boolean);
    if(!words.length) return str(key);
    const phrase=words.join(' ');
    return phrase.charAt(0).toUpperCase()+phrase.slice(1);
  }
  window.aurentaraHumanEventTitleV1 = eventTitle;

  function technicalEvent(el){
    const raw=(el.textContent||'').trim();
    if(!/^[A-Z][A-Z0-9_]{3,}$/.test(raw) || !raw.includes('_')) return;
    if(el.dataset.humanizedEvent==='true') return;
    el.dataset.humanizedEvent='true';
    el.innerHTML='<span class="human-primary">'+h(eventTitle(raw))+'</span><div class="human-meta"><code>'+h(raw)+'</code></div>';
  }
  function humanizeEvents(root){if(!root)return;root.querySelectorAll('strong,td').forEach(technicalEvent)}

  function translateExact(root){
    if(!root)return;
    root.querySelectorAll('h1,h2,h3,h4,strong,span,button,th,dt,label,summary').forEach(el=>{
      if(el.children.length) return;
      const raw=(el.textContent||'').trim();
      if(EXACT_TEXT[raw]) el.textContent=EXACT_TEXT[raw];
    });
  }

  function polishNavigation(){
    document.querySelectorAll('.nav button[data-goto]').forEach(button=>{const id=button.dataset.goto;const text=button.querySelector('span:last-child');if(text&&NAV_LABELS[id])text.textContent=NAV_LABELS[id]});
    document.querySelectorAll('.nav-label').forEach(el=>{const raw=(el.textContent||'').trim();if(GROUP_LABELS[raw])el.textContent=GROUP_LABELS[raw]});
  }

  function polishHeader(id){
    const copy=PAGE_COPY[id]||['Operator Control','Privater operativer Leitstand.'];
    const title=document.getElementById('title');if(title)title.textContent=copy[0];
    const subtitle=document.querySelector('.top .subtitle');if(subtitle)subtitle.textContent=copy[1];
    const refresh=document.getElementById('refresh');
    if(refresh){const visible=['health','providers','audit'].includes(id);refresh.hidden=!visible;refresh.setAttribute('aria-hidden',visible?'false':'true');refresh.textContent='Aktualisieren'}
  }

  function compactProjectCreate(){
    const root=document.getElementById('projects');if(!root)return;
    const create=root.querySelector('[data-project-create]');if(!create||create.closest('.human-create-project'))return;
    const wrapper=document.createElement('details');wrapper.className='human-create-project';wrapper.dataset.humanProjectCreate='true';
    const summary=document.createElement('summary');summary.textContent='Neues Projekt anlegen';wrapper.appendChild(summary);
    create.parentNode.insertBefore(wrapper,create);wrapper.appendChild(create);
  }

  function projectNextAction(project){
    const s=upper(project?.status);
    if(s==='BLOCKED'||s==='FAILED')return'Blocker und letzte Evidence prüfen';
    if(['COMPLETED','DONE','SUCCESS'].includes(s))return'Keine unmittelbare Aktion erforderlich';
    if(['ACTIVE','RUNNING'].includes(s))return'Aktuellen Missions- und Freigabestatus prüfen';
    if(['CREATED','NEW'].includes(s))return'Mission definieren';
    return'Nächsten verifizierten Projektschritt prüfen';
  }

  function polishProjectDetail(){
    const id=state?.section||'';if(!String(id).includes('project'))return;
    const candidates=[document.getElementById('project-detail'),document.getElementById('project'),document.querySelector('[data-project-detail]')].filter(Boolean);
    const root=candidates[0];if(!root||root.querySelector('[data-human-project-priority]')){humanizeEvents(root);return}
    const project=state?.data?.project_detail||state?.data?.project||state?.data?.selected_project||{};
    const results=rows(project.results||project.deliverables);
    const caps=rows(project.capabilities||project.capability_map);
    const block=document.createElement('div');block.className='card human-section';block.dataset.humanProjectPriority='true';
    block.innerHTML='<div class="human-section-head"><div><h2>Projekt auf einen Blick</h2><p>Status, aktueller Zustand und nächste Operator-Aktion zuerst.</p></div>'+chip(first(project.status,project.state,'Nicht verifiziert'),tone(first(project.status,project.state)))+'</div><div class="human-kvs">'+
      kv('Projektstatus',first(project.status,project.state))+
      kv('Aktueller Zustand',first(project.current_state,project.phase,project.current_phase))+
      kv('Capabilities',caps.length?caps.length:'Nicht verifiziert')+
      kv('Ergebnisse',results.length?results.length:'Noch kein Ergebnis')+
      kv('Nächste Aktion',projectNextAction(project))+'</div>';
    root.prepend(block);humanizeEvents(root);
  }

  function approvalCounts(){
    const f=state?.data?.functional||{};const a=f.approvals||state?.data?.approvals||{};
    const mission=rows(a.mission_plan||a.mission_plan_approvals||a.plans);
    const core=rows(a.core||a.core_approvals||a.items);
    return {pending:Number(f.summary?.pending_approvals??a.pending_count??(mission.length+core.length)||0),mission:mission.length,core:core.length,known:Boolean(mission.length||core.length||a.pending_count!==undefined||f.summary?.pending_approvals!==undefined)};
  }

  function compactApprovals(){
    const root=document.getElementById('approvals');if(!root)return;
    const counts=approvalCounts();if(counts.pending!==0)return;
    root.innerHTML='<div class="human-all-clear"><div><strong>Keine Freigaben erforderlich</strong><div class="small">Es wartet aktuell keine Operator-Entscheidung.</div></div><div class="human-meta">Offene Freigaben: 0'+(counts.known?' · Mission Plan: '+counts.mission+' · Core: '+counts.core:'')+'</div></div>';
  }

  function providerDisplayName(name){const m={cloudflare:'Cloudflare',supabase:'Supabase',posthog:'PostHog',openai:'OpenAI','workers-ai':'Workers AI'};return m[String(name||'').toLowerCase()]||str(name)}
  function providerState(p){
    let s=upper(p?.status).replace(/_/g,' ');
    if(PROVIDER_STATES.has(s))return s;
    if(s==='NOT VERIFIED'||s==='NOT_VERIFIED'||!s){if(p?.credentials_required===true)return'CREDENTIAL REQUIRED';return'UNKNOWN'}
    if(s.includes('CREDENTIAL'))return'CREDENTIAL REQUIRED';if(s.includes('BUDGET'))return'BUDGET GATE';if(s.includes('PERMISSION'))return'PERMISSION GATE';if(s.includes('UNAVAILABLE'))return'UNAVAILABLE';if(s.includes('STAGING'))return'STAGING ONLY';return'UNKNOWN';
  }
  function renderHumanProviders(){
    const root=document.getElementById('providers');if(!root)return;
    const items=rows(state?.data?.functional?.providers);
    root.innerHTML='<div class="human-section"><div class="human-section-head"><div><h2>Provider</h2><p>Registry, reale Verfügbarkeit und Gates. Fehlende Evidence wird nicht als verfügbar dargestellt.</p></div></div>'+
      (items.length?'<div class="human-provider-grid">'+items.map(p=>{const ps=providerState(p);const restrictions=rows(p.current_restrictions);const secondary=[];if(p.production_deploy===false||restrictions.includes('PRODUCTION_DISABLED'))secondary.push('PRODUCTION DISABLED');if(p.cost_mode==='paid_usage')secondary.push('BUDGET GATE bei bezahlter Nutzung');return'<div class="human-provider-card"><div class="row"><div><h3>'+h(providerDisplayName(p.name))+'</h3><div class="human-meta">'+h(str(p.category,'Registrierter Provider'))+'</div></div>'+chip(ps,tone(ps))+'</div><div class="human-kvs">'+kv('Umgebung',first(p.environment,p.inventory_registered?'Registry':'Nicht verifiziert'))+kv('Credentials',first(p.credentials_state,p.credentials_required===true?'Erforderlich':'Nicht verifiziert'))+kv('Health',p.health)+kv('Kostenmodus',p.cost_mode)+'</div><div class="human-note">'+h(secondary.join(' · ')||'Keine zusätzliche verifizierte Einschränkung.')+'</div></div>'}).join('')+'</div>':'<div class="human-empty">Keine Provider-Evidence in der bestehenden Registry verfügbar.</div>')+'</div>';
  }

  function factoryState(f){
    const raw=upper(first(f.health,f.status));const ci=upper(f.ci_verification);const blockers=rows(f.open_blockers);
    if(blockers.length||raw.includes('BLOCK')||raw.includes('FAIL'))return'BLOCKED';
    if(raw.includes('PLANNED')||raw==='PLANNED')return'PLANNED';
    if(raw.includes('STAGING_VERIFIED')||raw.includes('STAGING VERIFIED')||ci==='VERIFIED'||ci==='PASS')return'STAGING VERIFIED';
    if(raw.includes('READY')&&Number(f.execution_count||0)>0)return'READY';
    if(Number(f.execution_count||0)>0)return'EXISTS';
    if(raw==='AVAILABLE'||raw==='REGISTERED')return'EXISTS';
    return'NOT VERIFIED';
  }
  function renderHumanFactories(){
    const root=document.getElementById('factories');if(!root)return;
    const items=rows(state?.data?.functional?.factories?.items);
    root.innerHTML='<div class="human-section"><div class="human-section-head"><div><h2>Factories</h2><p>Existenz, Staging-Verifikation und reale Run-Evidence klar getrennt.</p></div></div>'+
      (items.length?'<div class="human-factory-grid">'+items.map(f=>{const fs=factoryState(f);const notes=[];if(!Number(f.execution_count||0))notes.push('Noch kein verifizierter Run');if(!rows(f.provider_availability).length)notes.push('Noch keine Provider-Evidence');if(f.quality_score===null||f.quality_score===undefined)notes.push('Qualität noch nicht gemessen');return'<div class="human-factory-card"><div class="row"><div><h3>'+h(f.factory)+'</h3><div class="human-meta">'+h(str(f.role,''))+'</div></div>'+chip(fs,tone(fs))+'</div><div class="human-kvs">'+kv('Runs',f.execution_count)+kv('Erfolgsrate',f.success_rate_percent===null||f.success_rate_percent===undefined?'Nicht verifiziert':f.success_rate_percent+'%')+kv('Workload',f.current_workload===null?'Nicht verifiziert':f.current_workload)+kv('CI',f.ci_verification)+'</div><div class="human-note">'+h(notes.join(' · ')||'Verifizierte operative Evidence vorhanden.')+'</div></div>'}).join('')+'</div>':'<div class="human-empty">Keine Factories aus der bestehenden Core-Projektion verfügbar.</div>')+'</div>';
  }

  function deliveryList(){return rows(state?.data?.deliveries?.universal_missions||state?.data?.deliveries?.items||state?.data?.functional?.deliveries)}
  function deliverySummary(u){
    const plan=u?.plan||u?.mission_plan||{};const execution=u?.execution||{};const quality=u?.quality||{};const delivery=u?.delivery||{};const safety=u?.safety||{};
    const selected=rows(first(plan.selected_capabilities,plan.target_capabilities,u.selected_capabilities));const rejected=rows(first(plan.rejected_capabilities,u.rejected_capabilities));const assumptions=rows(first(plan.assumptions,u.assumptions));
    const factories=rows(first(u.factories,execution.factories)).map(x=>typeof x==='string'?x:first(x.factory,x.name)).filter(Boolean);
    const providers=rows(first(u.providers,execution.providers)).map(x=>typeof x==='string'?x:first(x.provider,x.name)).filter(Boolean);
    const provider=first(execution.provider,u.provider,providers.join(', '));const factory=first(execution.factory,u.factory,factories.join(', '));
    return {project:first(u.business_name,u.project,u.project_id,u.scope_key),mission:first(u.mission,u.mission_id,u.mission_type),status:first(u.status,execution.status),final:first(u.final_delivery_status,delivery.status,u.delivery_status),quality:first(quality.score,u.quality_score,quality.status,u.quality_state),factory,capability:first(u.capability,selected.join(', ')),provider,cost:first(u.variable_cost_eur,u.actual_cost_eur,u.estimated_variable_cost_eur),environment:first(u.environment,execution.environment,'staging'),production:first(safety.production,u.production_deploy===false?'OFF':u.production_deploy),external:first(safety.external_writes,u.external_writes===false?'OFF':u.external_writes),evidence:first(execution.evidence,u.execution_evidence,execution.execution_id),assumptions:assumptions.join(' · ')||'Keine verifizierten Annahmen ausgewiesen',rejected:rejected.join(', ')||'Keine ausgewiesen',reference:first(delivery.reference,delivery.artifact_ref,delivery.url,u.delivery_reference,u.result_reference,u.mission_id)};
  }
  function renderHumanDeliveries(){
    const root=document.getElementById('deliveries');if(!root)return;const items=deliveryList();
    root.innerHTML='<div class="human-section"><div class="human-section-head"><div><h2>Unified Delivery</h2><p>Human Summary zuerst. Vollständige technische Evidence bleibt sekundär erhalten.</p></div></div>'+
      (items.length?items.map(u=>{const d=deliverySummary(u);return'<article class="human-summary" data-human-unified-delivery="true"><div class="row"><div><h3>'+h(str(d.project,'Projekt'))+'</h3><div class="human-meta">Mission: '+h(str(d.mission))+'</div></div>'+chip(str(d.final),tone(d.final))+'</div><div class="human-kvs">'+kv('Projekt',d.project)+kv('Mission',d.mission)+kv('Status',d.status)+kv('Finaler Delivery-Status',d.final)+kv('Qualität',d.quality)+kv('Factory',d.factory)+kv('Capability',d.capability)+kv('Provider',d.provider)+kv('Kosten',d.cost===undefined||d.cost===null?'Nicht verifiziert':money(d.cost))+kv('Umgebung',d.environment)+kv('Production',humanBool(d.production))+kv('External Writes',humanBool(d.external))+kv('Execution Evidence',typeof d.evidence==='object'?JSON.stringify(d.evidence):d.evidence)+kv('Wichtige Annahmen',d.assumptions)+kv('Abgelehnte / ungenutzte Capabilities',d.rejected)+kv('Delivery / Result Reference',d.reference)+'</div><details class="human-evidence human-secondary-raw"><summary>Technische Details / Raw Evidence</summary><pre>'+h(JSON.stringify(u,null,2))+'</pre></details></article>'}).join(''):'<div class="human-empty">Noch keine Unified-Delivery-Evidence vorhanden.</div>')+'</div>';
  }

  function renderHumanHealth(){
    const root=document.getElementById('health');if(!root)return;const f=state?.data?.functional||{};const sh=f.system_health||f.systemHealth||state?.data?.health||{};const summary=f.summary||{};const alerts=rows(f.alerts);const blockers=alerts.filter(a=>['BLOCKED','FAILED','ACTION_REQUIRED'].includes(upper(a.severity)));
    const operator=upper(first(summary.operator_state,sh.status,'UNKNOWN'));
    const runtime=first(sh.runtime_health,sh.runtime?.status,operator==='FAILED'?'FAILED':operator==='BLOCKED'?'DEGRADED':'HEALTHY');
    const staging=first(sh.staging_verification,sh.staging?.status,sh.staging_status,'Nicht verifiziert');
    const activation=first(sh.activation_readiness,sh.activation?.status,sh.activation_status,'Nicht verifiziert');
    const overall=blockers.length||operator==='BLOCKED'||operator==='FAILED'?'HANDLUNGSBEDARF':operator==='UNKNOWN'?'NICHT VOLLSTÄNDIG VERIFIZIERT':'BETRIEBSBEREIT (STAGING)';
    root.innerHTML='<div class="human-section"><div class="human-summary human-health-overall" data-state="'+(overall==='HANDLUNGSBEDARF'?'blocked':overall.includes('NICHT')?'attention':'ready')+'"><div class="human-section-head"><div><h2>Overall System State</h2><p>Runtime, Staging, Activation und Production werden getrennt bewertet.</p></div>'+chip(overall,tone(overall))+'</div><div class="human-grid">'+kv('Runtime Health',runtime)+kv('Staging Verification',staging)+kv('Activation Readiness',activation)+kv('Production State','DISABLED')+'</div></div>'+
      (blockers.length?'<div class="human-section"><div class="human-section-head"><div><h2>Aktuelle Blocker</h2><p>Nur reale bestehende Alerts.</p></div></div>'+blockers.map(b=>'<div class="human-blocker"><h3>'+h(str(b.what,'Blocker'))+'</h3><div class="human-blocker-grid">'+kv('Warum',b.why)+kv('Auswirkung',b.impact)+kv('Nächste Aktion',b.next_action)+'</div></div>').join('')+'</div>':'<div class="human-all-clear"><div><strong>Kein aktiver Systemblocker</strong><div class="small">Nicht verifizierte Teilzustände bleiben oben separat sichtbar.</div></div></div>')+'</div>';
  }

  function polishCosts(){const root=document.getElementById('costs');if(root)translateExact(root)}
  function polishAudit(){const root=document.getElementById('audit');if(!root)return;humanizeEvents(root);translateExact(root)}
  function polishPolicies(){const root=document.getElementById('settings');if(!root)return;root.classList.add('human-policy');translateExact(root);root.querySelectorAll('dd,span,strong').forEach(el=>{if((el.textContent||'').trim()==='NOT CONFIGURED')el.textContent='Nicht konfiguriert'})}
  function polishSafety(){const root=document.getElementById('mission');if(!root)return;const panel=root.querySelector('.functional-safety-panel');if(!panel)return;panel.classList.remove('human-safety-clear','human-safety-risk');const txt=upper(panel.textContent);const risky=/BLOCKED|FAILED|RISK|REQUIRED|EXTERNAL WRITE: ON|PRODUCTION: ON/.test(txt);panel.classList.add(risky?'human-safety-risk':'human-safety-clear');if(!risky&&!panel.querySelector('.human-safety-label')){const label=document.createElement('div');label.className='human-safety-label';label.textContent='Sicherheitsrahmen: alles klar';panel.prepend(label)}}
  function polishHq(){const root=document.getElementById('hq');if(!root)return;translateExact(root);humanizeEvents(root)}

  function humanPolish(id){
    const section=id||state?.section||'hq';polishNavigation();polishHeader(section);
    if(section==='projects')compactProjectCreate();
    if(String(section).includes('project'))polishProjectDetail();
    if(section==='approvals')compactApprovals();
    if(section==='providers')renderHumanProviders();
    if(section==='factories')renderHumanFactories();
    if(section==='deliveries')renderHumanDeliveries();
    if(section==='health')renderHumanHealth();
    if(section==='audit')polishAudit();
    if(section==='settings')polishPolicies();
    if(section==='costs')polishCosts();
    if(section==='mission')polishSafety();
    if(section==='hq')polishHq();
    const active=document.getElementById(section);translateExact(active);humanizeEvents(active);
    document.documentElement.dataset.humanUxSeal='reality-fix-v1';
  }

  if(typeof render==='function'){
    const previousRender=render;
    render=function(id){previousRender(id);requestAnimationFrame(()=>humanPolish(id));};
  }
  requestAnimationFrame(()=>humanPolish(state?.section||'hq'));
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const response = await handleDesignDashboard(request, env, ctx, options);
  if (!response) return null;
  const url = new URL(request.url);
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  let body = source;
  body = body.includes('</head>') ? body.replace('</head>', `${HUMAN_UX_STYLE}</head>`) : `${HUMAN_UX_STYLE}${body}`;
  body = body.includes('</body>') ? body.replace('</body>', `${HUMAN_UX_SCRIPT}</body>`) : `${body}${HUMAN_UX_SCRIPT}`;
  const headers = new Headers(response.headers);
  headers.set('x-aurentara-human-ux-seal', 'reality-fix-v1');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorHumanUxSealManifest() {
  return {
    schema: 'aurentara.operator-human-ux-seal.v1',
    presentation_only: true,
    canonical_route: '/operator',
    same_control_plane: true,
    existing_design_layer_reused: true,
    core_logic_changed: false,
    api_contract_changed: false,
    new_feature_engine: false,
    human_summary_first: true,
    raw_evidence_preserved_secondary: true,
    canonical_human_language: 'de',
    project_creation_secondary: true,
    human_event_titles_first: true,
    provider_truth_fail_closed: true,
    factory_truth_fail_closed: true,
    health_dimensions_separated: true,
    settings_presented_as_read_only_policies: true,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}
