const WEB_PROJECT_CONTROL_V2_STYLE = String.raw`<style id="aurentara-web-project-control-v2-style">
:root{--awc-ink:#171915;--awc-muted:#697067;--awc-line:#e2e5de;--awc-soft:#f4f5f1;--awc-dark:#1e221e;--awc-good:#245b3b;--awc-warn:#785b17}
body.awc-v2-ready .side .brand{padding-bottom:14px}
body.awc-v2-ready .side .brand strong{font-size:14px;letter-spacing:.16em}
body.awc-v2-ready .side .brand span{display:block;margin-top:4px}
body.awc-v2-ready .nav{gap:4px}
body.awc-v2-ready .nav button{position:relative}
body.awc-v2-ready .nav button.awc-primary{font-weight:760;color:#f6f7f4;background:#232722}
body.awc-v2-ready .nav button.awc-secondary{font-size:12px;color:#9fa69c;padding-top:7px;padding-bottom:7px}
.awc-side-label{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#747b72;padding:12px 10px 5px}
.awc-hero{border:1px solid var(--awc-line);border-radius:22px;background:linear-gradient(135deg,#fff 0%,#f7f8f4 62%,#eef2eb 100%);padding:24px;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,.8fr);gap:22px;margin-bottom:14px;box-shadow:0 15px 40px rgba(24,31,24,.045)}
.awc-hero h2{font-size:29px;letter-spacing:-.035em;margin:5px 0 8px}
.awc-hero p{margin:0;color:var(--awc-muted);max-width:720px}
.awc-hero-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:17px}
.awc-engine{border:1px solid var(--awc-line);border-radius:16px;background:#fff;padding:14px;display:grid;gap:8px;align-self:stretch}
.awc-engine-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--awc-soft);font-size:12px}
.awc-engine-row:first-child{border-top:0}
.awc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;background:#6e756d}
.awc-dot.good{background:var(--awc-good);box-shadow:0 0 0 4px #edf5ef}
.awc-flow{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:14px 0}
.awc-flow-step{border:1px solid var(--awc-line);border-radius:12px;background:#fff;padding:10px;text-align:center;font-size:11px}
.awc-flow-step b{display:block;font-size:12px;margin-bottom:2px}
body.awc-v2-ready .pm-head .subtitle:after{content:"  Fokus: Auftrag → Material → Website → Preview → Freigabe.";display:inline}
body.awc-v2-ready .pm-summary{grid-template-columns:repeat(4,minmax(0,1fr))}
body.awc-v2-ready .pm-summary .pm-stat:nth-child(5){display:none}
.awc-project-strip{border:1px solid var(--awc-line);background:#fff;border-radius:16px;padding:13px 15px;margin:0 0 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.awc-project-strip strong{font-size:14px}
.awc-project-strip .small{max-width:720px}
body.awc-v2-ready .pm-workspace-head{padding:17px 19px}
body.awc-v2-ready .pm-workhead .eyebrow{font-size:10px}
body.awc-v2-ready .pm-status [data-pm-environment],body.awc-v2-ready .pm-status [data-pm-progress]{opacity:.68}
body.awc-v2-ready .pm-journey{grid-template-columns:repeat(6,minmax(0,1fr))}
body.awc-v2-ready .pm-tabs{padding:5px;gap:4px;background:#edf0eb}
body.awc-v2-ready .pm-tab{font-weight:650}
body.awc-v2-ready .pm-tab[data-pm-tab="activity"]{margin-left:auto;opacity:.68}
body.awc-v2-ready .pm-panel[data-pm-panel="overview"] details.pm-card{margin-top:12px!important}
.awc-work-order{border:1px solid var(--awc-line);border-radius:18px;background:linear-gradient(180deg,#fff,#f8f9f6);padding:18px;margin-bottom:12px;box-shadow:0 8px 24px rgba(24,31,24,.035)}
.awc-work-order h3{font-size:18px;margin:2px 0 6px}
.awc-work-order p{margin:0 0 12px;color:var(--awc-muted);font-size:13px}
.awc-work-order textarea{width:100%;min-height:112px;border:1px solid var(--awc-line);border-radius:13px;padding:12px 13px;background:#fff;color:var(--awc-ink);resize:vertical}
.awc-work-order-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.awc-work-order-status{margin-top:10px;padding:11px 12px;border-radius:12px;background:var(--awc-soft);font-size:12px;display:none}
.awc-work-order-status.visible{display:block}
.awc-work-order-status.good{background:#edf5ef;color:#204e34}
.awc-work-order-status.warn{background:#faf4e5;color:#6b5116}
.awc-quick{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0 0}
.awc-quick button{border:1px solid var(--awc-line);background:#fff;border-radius:999px;padding:6px 9px;font-size:11px;color:var(--awc-muted)}
.awc-tech-note{font-size:11px;color:var(--awc-muted);margin-top:8px}
.awc-workflow-state{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}
.awc-state{border:1px solid var(--awc-line);border-radius:13px;padding:11px;background:#fff}
.awc-state .k{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--awc-muted)}
.awc-state .v{font-size:13px;font-weight:750;margin-top:4px}
.awc-system-note{margin:10px 0;padding:10px 12px;border-radius:12px;background:#f4f5f1;color:#5e665e;font-size:12px}
@media(max-width:980px){.awc-hero{grid-template-columns:1fr}.awc-flow{grid-template-columns:repeat(3,1fr)}.awc-workflow-state{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.awc-hero{padding:18px;border-radius:17px}.awc-hero h2{font-size:24px}.awc-flow{grid-template-columns:repeat(2,1fr)}body.awc-v2-ready .pm-summary{grid-template-columns:repeat(2,1fr)}body.awc-v2-ready .pm-journey{grid-template-columns:repeat(3,1fr)}body.awc-v2-ready .pm-tab[data-pm-tab="activity"]{margin-left:0}.awc-work-order{padding:15px}.awc-work-order-actions .btn{width:100%}.awc-workflow-state{grid-template-columns:1fr 1fr}}
@media(max-width:390px){.awc-flow,.awc-workflow-state{grid-template-columns:1fr 1fr}.awc-hero-actions .btn{width:100%}}
</style>`;

const WEB_PROJECT_CONTROL_V2_SCRIPT = String.raw`<script id="aurentara-web-project-control-v2-script">(()=>{if(window.__aurentaraWebProjectControlV2)return;window.__aurentaraWebProjectControlV2=true;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const navLabels={hq:'Übersicht',projects:'Webseiten',mission:'Aufträge',approvals:'Freigaben',deliveries:'Ergebnisse',health:'System',factories:'Factories',providers:'Provider',costs:'Kosten',audit:'Aktivität',settings:'Einstellungen'};
const primary=new Set(['hq','projects','approvals','health']);
function relabelNav(){const nav=document.querySelector('.nav');if(!nav)return;nav.querySelectorAll('button[data-goto]').forEach(b=>{const id=b.dataset.goto;b.textContent=navLabels[id]||b.textContent;b.classList.toggle('awc-primary',primary.has(id));b.classList.toggle('awc-secondary',!primary.has(id))});if(!nav.querySelector('[data-awc-side-label]')){const x=document.createElement('div');x.className='awc-side-label';x.dataset.awcSideLabel='1';x.textContent='AURENTARA CONTROL';nav.prepend(x)}}
function decorateBrand(){const brand=document.querySelector('.side .brand');if(!brand)return;const strong=brand.querySelector('strong');if(strong)strong.textContent='AURENTARA SYSTEMS';let sub=brand.querySelector('.awc-brand-subtitle');if(!sub){sub=document.createElement('span');sub.className='awc-brand-subtitle';sub.textContent='Web Project Control';strong?.insertAdjacentElement('afterend',sub)}[...brand.children].filter(x=>x.tagName==='SPAN'&&!x.classList.contains('awc-brand-subtitle')&&x.textContent.trim()==='Operator Control').forEach(x=>x.style.display='none');document.body.classList.add('awc-v2-ready')}
function heroHtml(){return '<div class="awc-hero" data-awc-hero><div><div class="eyebrow">AURENTARA · WEB PROJECT CONTROL V2</div><h2>Webseiten steuern, ohne die Technik im Weg.</h2><p>Projekt auswählen, Material ergänzen, Auftrag formulieren, Preview prüfen und freigeben. RIOSYSTEMS und die WebFactory arbeiten darunter weiter als technische Produktionsschicht.</p><div class="awc-hero-actions"><button class="btn primary" data-goto="projects">Webseiten öffnen</button><button class="btn" data-goto="approvals">Offene Freigaben</button></div><div class="awc-flow"><div class="awc-flow-step"><b>1 · Auftrag</b>Was soll passieren?</div><div class="awc-flow-step"><b>2 · Material</b>Bilder, Logo, Referenz</div><div class="awc-flow-step"><b>3 · Build</b>WebFactory</div><div class="awc-flow-step"><b>4 · Prüfung</b>Visual + Browser QA</div><div class="awc-flow-step"><b>5 · Preview</b>Privat ansehen</div><div class="awc-flow-step"><b>6 · Freigabe</b>Du entscheidest</div></div></div><div class="awc-engine"><strong>Produktionsmaschine</strong><div class="awc-engine-row"><span><i class="awc-dot good"></i>RIOSYSTEMS WebFactory</span><b>verbunden</b></div><div class="awc-engine-row"><span><i class="awc-dot good"></i>Autonomous Delivery Loop</span><b>bereit</b></div><div class="awc-engine-row"><span><i class="awc-dot good"></i>Private Preview</span><b>aktiv</b></div><div class="awc-engine-row"><span><i class="awc-dot"></i>Production / DNS / Billing</span><b>gesperrt</b></div></div></div>'}
function decorateHQ(){const h=document.querySelector('#hq');if(!h||h.querySelector('[data-awc-hero]'))return;h.insertAdjacentHTML('afterbegin',heroHtml())}
function decoratePortfolio(){const root=document.querySelector('#projects');if(!root||!root.querySelector('.pm-list'))return;const head=root.querySelector('.pm-head h2'),sub=root.querySelector('.pm-head .subtitle');if(head)head.textContent='Webseiten';if(sub)sub.textContent='Alle Website-Projekte an einem Ort. ';const mission=root.querySelector('#pm-new-mission');if(mission)mission.textContent='+ Neuer Auftrag';if(!root.querySelector('[data-awc-project-strip]')){const strip=document.createElement('div');strip.className='awc-project-strip';strip.dataset.awcProjectStrip='1';strip.innerHTML='<div><strong>Ein Projekt öffnen und direkt weiterarbeiten.</strong><div class="small">Material, Projektwissen, WebFactory, Preview und Freigaben greifen auf dieselbe Project-State-Truth zu.</div></div><span class="badge ready">WebFactory verbunden</span>';const list=root.querySelector('.pm-list');list?.parentNode.insertBefore(strip,list)}}
function relabelWorkspace(){const w=document.querySelector('.pm-workspace');if(!w)return;const labels={overview:'Übersicht',sources:'Material',knowledge:'Projektwissen',implementation:'Auftrag & Bau',webfactory:'Website bauen',preview:'Preview',approvals:'Freigabe',activity:'Technik'};w.querySelectorAll('[data-pm-tab]').forEach(b=>{if(labels[b.dataset.pmTab])b.textContent=labels[b.dataset.pmTab]});const eyebrow=w.querySelector('.pm-workhead .eyebrow');if(eyebrow)eyebrow.textContent='WEBSITE PROJEKT';const steps=w.querySelectorAll('.pm-journey .pm-step'),names=['Material','Plan','Build','Prüfung','Freigabe','Live'];steps.forEach((s,i)=>{if(names[i])s.textContent=names[i]});const next=w.querySelector('.pm-next .small');if(next)next.textContent='NÄCHSTER SCHRITT';const tech=w.querySelector('[data-pm-panel="overview"] details.pm-card summary');if(tech)tech.textContent='Technische Details anzeigen'}
function pipelineStateHtml(){const w=document.querySelector('.pm-workspace'),d=(typeof state!=='undefined'?state.detail:null)||{},p=d.project||{},preview=d.project_preview_access||p.project_preview_access||{},quality=d.results?.quality||{},delivery=d.results?.delivery||{};const available=preview.available===true,qa=quality.passed===true||String(quality.status||quality.qa_status||'').toUpperCase()==='PASS',ready=Boolean(delivery&&Object.keys(delivery).length);return '<div class="awc-workflow-state" data-awc-workflow-state><div class="awc-state"><div class="k">Projekt</div><div class="v">'+E(p.name||p.project_id||'Aktiv')+'</div></div><div class="awc-state"><div class="k">WebFactory</div><div class="v">Verbunden</div></div><div class="awc-state"><div class="k">Qualität</div><div class="v">'+E(qa?'Geprüft':'Wird im Build geprüft')+'</div></div><div class="awc-state"><div class="k">Preview</div><div class="v">'+E(available?'Verfügbar':ready?'Wird vorbereitet':'Noch offen')+'</div></div></div>'}
function missionBody(scope,instruction){return{scope_key:scope,context_scope_key:scope,mission_text:'Website-Projekt. Setze folgenden Auftrag um: '+instruction,business_goals:['Website-Auftrag für das ausgewählte Projekt sauber umsetzen'],known_constraints:['Production bleibt gesperrt','Keine DNS-Änderungen','Keine Billing-Aktivierung','Keine öffentlichen Änderungen ohne ausdrückliche Freigabe'],requested_outcomes:[instruction]}}
async function prepareWorkOrder(box){const w=box.closest('.pm-workspace'),scope=w?.dataset.scope||'',ta=box.querySelector('textarea'),button=box.querySelector('[data-awc-prepare]'),status=box.querySelector('[data-awc-status]'),instruction=String(ta?.value||'').trim();if(!scope||!instruction){status.className='awc-work-order-status visible warn';status.textContent='Bitte zuerst kurz beschreiben, was an der Website geändert werden soll.';return}button.disabled=true;status.className='awc-work-order-status visible';status.textContent='Auftrag wird gegen den aktuellen Projektstand geprüft…';try{const result=await api('/mission-preflight',{method:'POST',body:JSON.stringify(missionBody(scope,instruction))});state.plan=result;status.className='awc-work-order-status visible good';const caps=(result.plan?.selected_capabilities||[]).map(x=>x.capability).filter(Boolean);status.innerHTML='<strong>Auftrag vorbereitet.</strong><div>'+E(caps.length?'Geplante Bereiche: '+caps.join(', '):'Plan ist bereit')+'. Noch keine Production-Aktion wurde ausgeführt.</div><button class="btn" data-awc-open-approvals style="margin-top:8px">Freigaben öffnen</button>';status.querySelector('[data-awc-open-approvals]')?.addEventListener('click',async()=>{try{await loadAll()}catch{}go('approvals')})}catch(e){status.className='awc-work-order-status visible warn';status.textContent='Auftrag konnte nicht vorbereitet werden: '+String(e?.message||e)}finally{button.disabled=false}}
function workOrderHtml(){return '<div class="awc-work-order" data-awc-work-order><div class="eyebrow">NEUER WEBSITE-AUFTRAG</div><h3>Was soll sich ändern?</h3><p>Beschreibe es normal. AURENTARA bindet den Auftrag an dieses Projekt und bereitet den vorhandenen RIOSYSTEMS-Ablauf vor.</p><textarea aria-label="Website Auftrag" placeholder="z. B. Logo im Header hochwertiger und dreidimensionaler wirken lassen, ohne das Logo selbst zu verändern."></textarea><div class="awc-quick"><button type="button" data-awc-template="Design näher an der freigegebenen Referenz ausrichten.">Referenztreue</button><button type="button" data-awc-template="Mobile Darstellung vollständig prüfen und verbessern.">Mobile verbessern</button><button type="button" data-awc-template="Die aktuelle Version visuell veredeln, ohne Inhalte oder Funktionen zu verlieren.">Premium Finish</button></div><div class="awc-work-order-actions"><button class="btn primary" type="button" data-awc-prepare>Auftrag vorbereiten</button><button class="btn" type="button" data-awc-open-factory>Website bauen öffnen</button></div><div class="awc-tech-note">Der Auftrag startet zunächst als kontrollierter Projektauftrag. Public Launch, Production, DNS und Billing bleiben gesperrt.</div><div class="awc-work-order-status" data-awc-status></div></div>'}
function installWorkOrder(){const w=document.querySelector('.pm-workspace');if(!w)return;const panel=w.querySelector('[data-pm-panel="implementation"]');if(!panel||panel.querySelector('[data-awc-work-order]'))return;panel.insertAdjacentHTML('afterbegin',pipelineStateHtml()+workOrderHtml());const box=panel.querySelector('[data-awc-work-order]');box.querySelector('[data-awc-prepare]')?.addEventListener('click',()=>prepareWorkOrder(box));box.querySelector('[data-awc-open-factory]')?.addEventListener('click',()=>w.querySelector('[data-pm-tab="webfactory"]')?.click());box.querySelectorAll('[data-awc-template]').forEach(b=>b.addEventListener('click',()=>{const ta=box.querySelector('textarea');ta.value=(ta.value?ta.value+'\n':'')+b.dataset.awcTemplate;ta.focus()}))}
function systemNote(){const health=document.querySelector('#health');if(!health||health.querySelector('[data-awc-system-note]'))return;const x=document.createElement('div');x.className='awc-system-note';x.dataset.awcSystemNote='1';x.textContent='Für den normalen Website-Alltag reichen Webseiten, Aufträge, Freigaben und Preview. Die übrigen Systembereiche bleiben hier für Diagnose und Administration erhalten.';health.prepend(x)}
function decorate(){decorateBrand();relabelNav();decorateHQ();decoratePortfolio();relabelWorkspace();installWorkOrder();systemNote()}
let busy=false;const schedule=()=>{if(busy)return;busy=true;setTimeout(()=>{busy=false;decorate()},25)};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',schedule,true);window.addEventListener('load',schedule);decorate();
})();</script>`;

export function injectAurentaraWebProjectControlV2(html=''){
  if(!html||html.includes('aurentara-web-project-control-v2-script'))return html;
  const addon=WEB_PROJECT_CONTROL_V2_STYLE+WEB_PROJECT_CONTROL_V2_SCRIPT;
  return html.includes('</body>')?html.replace('</body>',addon+'</body>'):html+addon;
}

export async function applyAurentaraWebProjectControlV2(response){
  if(!(response instanceof Response)||response.status!==200||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  const html=await response.text();
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-web-project-control','v2');
  return new Response(injectAurentaraWebProjectControlV2(html),{status:response.status,statusText:response.statusText,headers});
}

export function aurentaraWebProjectControlV2Manifest(){
  return{
    schema:'aurentara.web-project-control.v2',
    purpose:'SIMPLE_OPERATOR_SURFACE_OVER_EXISTING_RIOSYSTEMS_WEB_INFRASTRUCTURE',
    existing_operator_runtime_reused:true,
    existing_premium_workspace_reused:true,
    existing_project_source_intake_reused:true,
    existing_webfactory_control_plane_reused:true,
    existing_next_best_action_reused:true,
    existing_delivery_lifecycle_reused:true,
    existing_preview_access_reused:true,
    existing_approval_engine_reused:true,
    existing_mission_preflight_reused:true,
    autonomous_delivery_loop_engine_status:'IMPLEMENTED_ACCEPTED_NOT_DIRECTLY_DISPATCHED_BY_THIS_UI',
    simple_flow:['AUFTRAG','MATERIAL','BUILD','PRUEFUNG','PREVIEW','FREIGABE'],
    primary_navigation:['UEBERSICHT','WEBSEITEN','FREIGABEN','SYSTEM'],
    technical_controls_preserved:true,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    billing_activation:false,
    automatic_merge:false,
    external_writes:false
  };
}
