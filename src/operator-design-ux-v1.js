import { handleOperatorDashboard as handleFunctionalSealDashboard } from './operator-functional-seal-v1.js';

const DESIGN_STYLE = String.raw`<style id="aurentara-operator-design-v1">
:root{
  --bg:#f5f5f2;
  --panel:#ffffff;
  --panel-subtle:#fafaf8;
  --ink:#171816;
  --ink-strong:#0f100f;
  --muted:#6f726d;
  --muted-2:#8b8e88;
  --line:#e2e3de;
  --line-strong:#d5d7d1;
  --soft:#f0f1ed;
  --ready:#285a3d;
  --ready-bg:#eef5f0;
  --active:#285678;
  --active-bg:#edf3f7;
  --attention:#795b18;
  --attention-bg:#faf4e6;
  --blocked:#7a3030;
  --blocked-bg:#faeeee;
  --neutral:#5f635d;
  --sidebar:#191b19;
  --sidebar-2:#222522;
  --sidebar-line:#343834;
  --focus:#6b91b3;
  --radius-sm:8px;
  --radius-md:12px;
  --radius-lg:16px;
  --shadow:0 1px 2px rgba(20,24,19,.035),0 8px 28px rgba(20,24,19,.04);
  --space-1:4px;
  --space-2:8px;
  --space-3:12px;
  --space-4:16px;
  --space-5:20px;
  --space-6:24px;
  --space-7:32px;
  --space-8:40px;
}
html{background:var(--bg)}
body{background:var(--bg);color:var(--ink);font-size:14px;line-height:1.48;-webkit-font-smoothing:antialiased}
button,input,textarea,select{font:inherit}
button{min-height:36px}
.app{grid-template-columns:264px minmax(0,1fr)}
.side{padding:24px 14px 18px;background:var(--sidebar);border-right:1px solid #202320}
.brand{padding:4px 10px 22px;border-bottom:1px solid var(--sidebar-line);margin-bottom:16px}
.brand strong{font-size:12px;line-height:1.3;letter-spacing:.145em;font-weight:760;color:#f7f8f5}
.brand span{display:block;margin-top:5px;font-size:12px;color:#aeb3ac}
.brand-parent{margin-top:7px!important;font-size:10px!important;letter-spacing:.08em;text-transform:uppercase;color:#737971!important}
.nav{display:block;overflow:auto;padding-right:2px}
.nav-group{margin:0 0 18px}
.nav-group:last-child{margin-bottom:0}
.nav-label{padding:0 10px 7px;font-size:10px;line-height:1.2;letter-spacing:.12em;text-transform:uppercase;color:#747a73;font-weight:700}
.nav button{width:100%;display:flex;align-items:center;gap:10px;min-height:38px;margin:2px 0;padding:8px 10px;border-radius:9px;color:#c7cbc5;font-size:13px;font-weight:560;transition:background-color .12s ease,color .12s ease}
.nav button:hover{background:#242724;color:#f7f8f5}
.nav button.active{background:#2d312d;color:#fff;box-shadow:inset 2px 0 0 #8c948c}
.nav button:focus-visible{outline:2px solid #91abc0;outline-offset:1px}
.nav-icon{width:16px;height:16px;display:inline-grid;place-items:center;flex:0 0 16px;color:#8f958e}
.nav button.active .nav-icon,.nav button:hover .nav-icon{color:#dfe3dc}
.nav-icon svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}
.side-foot{border-top:1px solid var(--sidebar-line);padding:15px 10px 0;color:#848a83;line-height:1.55}
.main{padding:34px 38px 56px;min-width:0}
.main>.top,.main>.section,#error{width:min(100%,1600px);margin-left:auto;margin-right:auto}
.top{align-items:center;min-height:66px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--line)}
.top>div:first-child{min-width:0}
.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:700;color:var(--muted-2)}
h1{font-size:29px;line-height:1.12;margin:4px 0 5px;color:var(--ink-strong);font-weight:690;letter-spacing:-.035em}
h2{font-size:15px;line-height:1.3;margin:0 0 12px;font-weight:680;letter-spacing:-.01em}
h3{font-size:12px;line-height:1.35;margin:18px 0 8px;font-weight:700;letter-spacing:.01em;color:#3e413d}
.subtitle{font-size:13px;color:var(--muted);max-width:820px}
.actions,.filters{gap:8px;align-items:center}
.btn{min-height:36px;border:1px solid var(--line-strong);border-radius:9px;background:var(--panel);color:var(--ink);padding:8px 12px;font-size:12px;font-weight:650;box-shadow:0 1px 1px rgba(18,20,17,.025);transition:background-color .12s ease,border-color .12s ease,box-shadow .12s ease,transform .12s ease}
.btn:hover:not(:disabled){background:#f9faf7;border-color:#c9ccc5}
.btn:active:not(:disabled){transform:translateY(1px)}
.btn.primary{background:#202320;border-color:#202320;color:#fff;box-shadow:none}
.btn.primary:hover:not(:disabled){background:#2b2e2a;border-color:#2b2e2a}
.btn.danger{color:var(--blocked);background:#fffafa;border-color:#ead3d3}
.btn:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}
.btn:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible,.nav button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.grid{gap:16px}
.card,.metric{background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)}
.card{border-radius:var(--radius-lg);padding:20px}
.metric{border-radius:var(--radius-md);padding:15px 16px;box-shadow:none}
.metric .v{font-size:23px;font-weight:680;color:var(--ink-strong)}
.metric .k{font-size:11px;color:var(--muted);margin-top:2px}
.stack{gap:14px}
.row{gap:14px;padding:12px 0;border-top-color:var(--soft)}
.row-main strong{font-size:13px;font-weight:650}
.small{font-size:11.5px;color:var(--muted);line-height:1.45}
.badge{min-height:23px;padding:4px 8px;border:1px solid transparent;font-size:10.5px;font-weight:720;letter-spacing:.005em;background:var(--soft);color:var(--neutral)}
.badge:before{width:6px;height:6px;background:#858983}
.badge.ready{color:var(--ready);background:var(--ready-bg);border-color:#ddebe1}
.badge.active{color:var(--active);background:var(--active-bg);border-color:#dce8f0}
.badge.attention{color:var(--attention);background:var(--attention-bg);border-color:#efe3c6}
.badge.blocked{color:var(--blocked);background:var(--blocked-bg);border-color:#efd8d8}
.table-wrap{border:1px solid var(--line);border-radius:12px;overflow:auto;background:var(--panel);max-width:100%}
.table{min-width:760px}
.table th,.table td{padding:11px 12px;border-bottom:1px solid var(--soft)}
.table tr:last-child td{border-bottom:0}
.table tbody tr:hover>td{background:#fafbf8}
.table th{position:sticky;top:0;z-index:2;background:#fafaf8;font-size:10px;letter-spacing:.075em;font-weight:720;color:#757973;white-space:nowrap}
.table td{font-size:12.5px}
.table .mono{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
.field{gap:6px}
.field label{font-size:11px;font-weight:680;color:#5f635d}
.field input,.field textarea,.field select,.filter-control{border-color:var(--line-strong);border-radius:9px;background:#fff;padding:9px 10px;min-height:38px}
.field input:hover,.field textarea:hover,.field select:hover,.filter-control:hover{border-color:#c7cac3}
.field textarea{min-height:112px}
.form-grid{gap:14px}
.callout{border-radius:11px;padding:12px 13px;background:var(--panel-subtle)}
.callout.good{background:#f1f6f2;border-color:#dfebe1}
.callout.warn{background:#fbf6ea;border-color:#efe4cb}
.empty{min-height:82px;display:grid;place-items:center;padding:22px;border:1px dashed #d5d8d1;border-radius:12px;background:#fafbf8;color:#777b74;font-size:12px}
.error{padding:13px 14px;border-radius:10px;margin:0 auto 16px;background:#fff3f3;border-color:#e6c6c6;color:#6d2929;box-shadow:0 4px 18px rgba(96,37,37,.05)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;font-size:11.5px}
.details{margin-top:8px;border-top:1px solid var(--soft);padding-top:8px}
.details summary{display:inline-flex;align-items:center;gap:7px;min-height:32px;font-size:11.5px;font-weight:650;color:#5f635d;list-style:none}
.details summary::-webkit-details-marker{display:none}
.details summary:before{content:'›';font-size:16px;line-height:1;transition:transform .12s ease}
.details[open] summary:before{transform:rotate(90deg)}
pre{white-space:pre-wrap;word-break:break-word;background:#f7f8f5;border:1px solid #e7e8e3;padding:13px;border-radius:10px;font-size:10.5px;line-height:1.5;color:#454842;max-height:420px;overflow:auto}
.kvs{gap:10px}.kv{background:#fbfbf9;border-color:#eceee8;border-radius:10px;padding:11px}.kv b{font-size:10.5px;color:#5f635d;text-transform:uppercase;letter-spacing:.04em}.kv span{display:block;margin-top:4px;color:#252724}
.cap{border-color:var(--line);border-radius:11px;background:#fff}
.progress{height:6px;background:#e9ebe6}.progress span{background:#4a6b54}
.timeline{gap:0}.step{position:relative;padding-bottom:14px}.step:after{content:'';position:absolute;left:4px;top:15px;bottom:0;width:1px;background:#dfe3dc}.step:last-child:after{display:none}.step:before{width:9px;height:9px;margin-top:5px;box-shadow:0 0 0 3px #e7eee9}
.loading{opacity:1;pointer-events:none}
body.loading .section.active:before{content:'';display:block;height:86px;margin:0 0 14px;border-radius:14px;border:1px solid var(--line);background:linear-gradient(90deg,#f0f1ed 25%,#fafaf7 37%,#f0f1ed 63%);background-size:400% 100%;animation:aurentara-skeleton 1.25s ease infinite}
@keyframes aurentara-skeleton{0%{background-position:100% 0}100%{background-position:0 0}}
.design-overview{display:grid;gap:18px}
.design-overview .overview-section{display:grid;gap:10px}
.design-overview .section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:0 2px}
.design-overview .section-heading h2{margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.085em;color:#62665f}
.design-overview .section-heading .small{font-size:10.5px}
.attention-panel{border:1px solid #ead3c9;background:#fffaf7;border-radius:14px;padding:16px}
.attention-panel[data-severity="blocked"],.attention-panel[data-severity="failed"]{border-color:#e7caca;background:#fff8f8}
.attention-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;padding:11px 0;border-top:1px solid rgba(90,70,60,.09)}
.attention-item:first-of-type{border-top:0}
.attention-item strong{font-size:12.5px}.attention-item .small{margin-top:2px}
.overview-operations{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr);gap:16px}
.overview-support{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.overview-panel{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:18px;box-shadow:var(--shadow)}
.overview-panel.quiet{box-shadow:none;background:#fafbf8}
.overview-stat{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--soft)}
.overview-stat:first-of-type{border-top:0}.overview-stat strong{font-size:12px}.overview-stat .value{font-size:15px;font-weight:670;color:#242623}
.overview-list{display:grid}.overview-list .item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--soft)}.overview-list .item:first-child{border-top:0}.overview-list .item strong{font-size:12.5px}
#hq>.metrics,#hq>.cols,#hq>[data-functional-overview]{display:none!important}
.lifecycle{display:grid;grid-template-columns:repeat(6,minmax(80px,1fr));gap:0;margin:12px 0 16px;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:#fafbf8}
.lifecycle-step{position:relative;padding:10px 8px;border-left:1px solid var(--line);min-width:0}.lifecycle-step:first-child{border-left:0}.lifecycle-step .label{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.lifecycle-step .state{display:block;margin-top:4px;font-size:10.5px;font-weight:680;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lifecycle-step[data-tone="ready"]{background:#f6faf7}.lifecycle-step[data-tone="attention"]{background:#fcf8ef}.lifecycle-step[data-tone="blocked"]{background:#fff5f5}.lifecycle-step[data-tone="active"]{background:#f4f8fb}
.section[data-design-section="true"]>.card:first-child{margin-top:0}
#approvals .btn.primary{min-width:92px}#approvals .btn.danger{min-width:82px}
#health .badge.ready{background:#f3f6f3;border-color:#e7ece7;color:#4f6756}#health .badge.ready:before{background:#66806d}
#audit .row{align-items:flex-start}#audit .row-main strong{font-size:12px}
#functional-quick-jump{max-width:230px!important;background:#fafbf8}
.design-utility{opacity:.82}
@media(max-width:1180px){.app{grid-template-columns:224px minmax(0,1fr)}.main{padding:28px 26px 48px}.overview-operations{grid-template-columns:1fr}.overview-support{grid-template-columns:1fr 1fr}.lifecycle{grid-template-columns:repeat(3,1fr)}.lifecycle-step:nth-child(4){border-left:0;border-top:1px solid var(--line)}.lifecycle-step:nth-child(5),.lifecycle-step:nth-child(6){border-top:1px solid var(--line)}}
@media(max-width:860px){.app{grid-template-columns:196px minmax(0,1fr)}.side{padding-left:9px;padding-right:9px}.main{padding:24px 20px 42px}.top{align-items:flex-start}.overview-support{grid-template-columns:1fr}.kvs{grid-template-columns:1fr 1fr}.table{min-width:720px}}
@media(max-width:760px){.app{display:block}.side{position:sticky;top:0;z-index:30;height:auto;padding:10px 12px;background:rgba(25,27,25,.98);backdrop-filter:blur(14px);box-shadow:0 8px 20px rgba(15,17,15,.12)}.brand{display:flex;align-items:center;gap:10px;padding:2px 4px 9px;margin:0 0 8px;border-bottom:1px solid var(--sidebar-line)}.brand strong{font-size:10.5px}.brand span{margin:0;font-size:10.5px}.brand-parent{display:none!important}.nav{display:flex;gap:5px;overflow-x:auto;padding:0 0 2px;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}.nav-group{display:contents}.nav-label{display:none}.nav button{width:auto;flex:0 0 auto;min-height:34px;padding:7px 9px;margin:0;white-space:nowrap}.nav-icon{display:none}.side-foot{display:none}.main{padding:18px 14px 38px}.top{display:flex;align-items:flex-start;gap:12px;margin-bottom:20px;padding-bottom:14px}.top .actions{margin-top:0;justify-content:flex-end}.top .subtitle{display:none}.top h1{font-size:23px}.top .eyebrow{font-size:9px}.top .actions .btn{padding:7px 9px;min-height:34px}.top .actions #refresh{font-size:0}.top .actions #refresh:after{content:'Refresh';font-size:11px}.grid.metrics{grid-template-columns:1fr 1fr}.form-grid,.filter-box{grid-template-columns:1fr}.kvs{grid-template-columns:1fr}.card{padding:16px;border-radius:13px}.overview-operations,.overview-support{grid-template-columns:1fr}.overview-panel{padding:15px}.attention-item{grid-template-columns:1fr}.attention-item .btn{justify-self:start}.lifecycle{grid-template-columns:1fr 1fr}.lifecycle-step:nth-child(odd){border-left:0}.lifecycle-step:nth-child(n+3){border-top:1px solid var(--line)}.table{min-width:680px}.table-wrap{border-radius:10px}.row{align-items:flex-start}.actions,.filters{gap:6px}.badge{white-space:normal;text-align:left}.details summary{min-height:36px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
</style>`;

const DESIGN_SCRIPT = String.raw`<script id="aurentara-operator-design-v1-script">
(() => {
  if (window.__aurentaraDesignUxV1) return;
  window.__aurentaraDesignUxV1 = true;

  const sectionCopy = {
    hq:['Overview','Systemzustand, Aufmerksamkeit und laufende Arbeit auf einen Blick.'],
    projects:['Projects','Unternehmen und operative Workspaces.'],
    missions:['Missions','Missionen vom Input bis zur Delivery nachvollziehen.'],
    mission:['Mission Studio','Mission planen, prüfen und kontrolliert freigeben.'],
    approvals:['Approvals','Offene Entscheidungen nach Risiko, Kosten und Wirkung prüfen.'],
    deliveries:['Deliverables','Validierte Ergebnisse aus abgeschlossenen Missionen.'],
    executions:['Executions','Laufende und vergangene Ausführungen mit Evidence.'],
    factories:['Factories','Factory Health, Capability Coverage und aktuelle Ausführungslast.'],
    capabilities:['Capabilities','Registrierte Fähigkeiten und ihre tatsächlich verifizierte Verfügbarkeit.'],
    providers:['Providers','Provider Readiness, Restriktionen und Runtime-Evidence.'],
    costs:['Costs','Kosten, Budget und Blockierungen ohne geschätzte Nullwerte.'],
    quality:['Quality','Validierung, Repair-Evidence und finale Qualitätszustände.'],
    alerts:['Blockers / Alerts','Was Aufmerksamkeit verlangt, warum und was als Nächstes zu tun ist.'],
    health:['System Health','Authoritative Systemdiagnose. Gesunde Zustände bleiben visuell ruhig.'],
    audit:['Activity','Chronologische operative Ereignisse ohne Log-Wand.'],
    settings:['Settings','Sicherheits- und Runtime-Konfiguration des privaten Operator Controls.']
  };

  const icon = (name) => {
    const paths = {
      hq:'<path d="M3 11.5 8 3l5 8.5"/><path d="M5 9.5V13h6V9.5"/>',
      projects:'<rect x="2.5" y="4" width="11" height="8.5" rx="1.5"/><path d="M6 4V2.8h4V4"/>',
      missions:'<circle cx="8" cy="8" r="5.2"/><path d="m6.2 8 1.2 1.2 2.6-2.8"/>',
      approvals:'<path d="M3 8.2 6.2 11 13 4.5"/>',
      deliveries:'<path d="M3 5.5h10v7H3z"/><path d="M5.5 3h5v2.5"/>',
      executions:'<path d="M4 3v10M12 3v10"/><path d="m6.5 5 3 3-3 3"/>',
      factories:'<path d="M2.5 13V7l4 2V6l4 2V3h3v10z"/>',
      capabilities:'<path d="M8 2.5v11M2.5 8h11"/><circle cx="8" cy="8" r="3"/>',
      providers:'<circle cx="8" cy="8" r="5.2"/><path d="M2.8 8h10.4M8 2.8c1.7 1.7 2.4 3.4 2.4 5.2S9.7 11.5 8 13.2C6.3 11.5 5.6 9.8 5.6 8S6.3 4.5 8 2.8"/>',
      costs:'<path d="M8 2.5v11M11 5.2C10.4 4.4 9.5 4 8.2 4 6.7 4 5.7 4.7 5.7 5.8c0 2 5.1 1.2 5.1 3.6 0 1.3-1.1 2.2-2.8 2.2-1.3 0-2.4-.4-3.1-1.3"/>',
      quality:'<path d="M8 2.4 12.5 4v3.7c0 2.8-1.8 4.7-4.5 5.9-2.7-1.2-4.5-3.1-4.5-5.9V4z"/><path d="m5.7 8 1.4 1.4 3-3.2"/>',
      health:'<path d="M2.5 8h2.2l1.2-3 2.2 6 1.4-3h4"/>',
      audit:'<path d="M8 3a5 5 0 1 1-4.4 2.6"/><path d="M2.8 3v3h3M8 5.2V8l2 1.4"/>',
      settings:'<circle cx="8" cy="8" r="2.2"/><path d="M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.9.9M11 11l.9.9M11.9 4.1l-.9.9M5 11l-.9.9"/>',
      alerts:'<path d="M8 2.5 14 13H2z"/><path d="M8 6v3M8 11.2v.1"/>'
    };
    return '<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 16 16">'+(paths[name]||'<circle cx="8" cy="8" r="5"/>')+'</svg></span>';
  };

  function rebuildNavigation() {
    const nav=document.querySelector('.nav');
    if(!nav || nav.dataset.designGrouped==='true') return;
    const labels=new Map((typeof NAV!=='undefined'?NAV:[]).map(([id,label])=>[id,label]));
    const groups=[
      ['Overview',['hq']],
      ['Work',['projects','missions','approvals','deliveries']],
      ['Operations',['executions','factories','capabilities','providers']],
      ['Control',['costs','quality','health','audit']],
      ['',['settings']]
    ];
    nav.innerHTML='';
    for(const [label,ids] of groups){
      const group=document.createElement('div');group.className='nav-group';
      if(label){const heading=document.createElement('div');heading.className='nav-label';heading.textContent=label;group.appendChild(heading)}
      for(const id of ids){if(!labels.has(id)) continue;const button=document.createElement('button');button.type='button';button.dataset.goto=id;button.innerHTML=icon(id)+'<span>'+esc(labels.get(id))+'</span>';if((state.section||'hq')===id)button.className='active';if(id==='settings')button.classList.add('design-utility');group.appendChild(button)}
      if(group.querySelector('button'))nav.appendChild(group);
    }
    nav.dataset.designGrouped='true';
  }

  function polishBrand() {
    const brand=document.querySelector('.brand'); if(!brand) return;
    const strong=brand.querySelector('strong'); const sub=brand.querySelector('span');
    if(strong) strong.textContent='AURENTARA SYSTEMS';
    if(sub) sub.textContent='Operator Control';
    if(!brand.querySelector('.brand-parent')){const parent=document.createElement('span');parent.className='brand-parent';parent.textContent='A YSRIO Company';brand.appendChild(parent)}
  }

  function updateHeader(id) {
    const copy=sectionCopy[id]||[String(id||'Overview'),'Private operator workspace.'];
    const title=document.getElementById('title'); if(title)title.textContent=copy[0];
    const eyebrow=document.querySelector('.top .eyebrow'); if(eyebrow)eyebrow.textContent=id==='hq'?'Operator Control':'AURENTARA SYSTEMS';
    const subtitle=document.querySelector('.top .subtitle'); if(subtitle)subtitle.textContent=copy[1];
  }

  function renderAttention(data) {
    const alerts=Array.isArray(data.alerts)?data.alerts:[];
    const pending=Number(data.summary?.pending_approvals||0);
    const critical=alerts.filter(x=>['FAILED','BLOCKED'].includes(String(x.severity||'').toUpperCase()));
    const actionable=alerts.filter(x=>['FAILED','BLOCKED','ACTION_REQUIRED'].includes(String(x.severity||'').toUpperCase())).slice(0,4);
    if(!pending && !actionable.length) return '';
    const severity=critical.some(x=>String(x.severity).toUpperCase()==='FAILED')?'failed':critical.length?'blocked':'attention';
    const approvalItem=pending?'<div class="attention-item"><div><strong>'+esc(pending)+' offene Freigabe'+(pending===1?'':'n')+'</strong><div class="small">Missionen warten auf eine explizite Operator-Entscheidung.</div></div><button class="btn primary" data-goto="approvals">Review</button></div>':'';
    const alertItems=actionable.slice(0,3).map(a=>'<div class="attention-item"><div><strong>'+esc(a.what||'Attention required')+'</strong><div class="small">'+esc(a.impact||a.why||'')+'</div></div><button class="btn" data-goto="alerts">Inspect</button></div>').join('');
    return '<div class="overview-section"><div class="section-heading"><h2>Attention required</h2><span class="small">Nur offene Operator-Arbeit</span></div><div class="attention-panel" data-severity="'+severity+'">'+approvalItem+alertItems+'</div></div>';
  }

  function renderDesignOverview() {
    const root=document.getElementById('hq'); if(!root) return;
    root.querySelector('[data-design-overview]')?.remove();
    const data=state.data.functional||{}; const summary=data.summary||{};
    const missions=Array.isArray(data.missions)?data.missions:[];
    const executions=Array.isArray(data.executions)?data.executions:[];
    const activity=Array.isArray(data.activity?.items)?data.activity.items:[];
    const deliverables=state.data.deliveries?.universal_missions||[];
    const activeMissions=missions.filter(m=>['ACTIVE','RUNNING','QUEUED','WAITING','RETRYING'].includes(String(m.execution_state||m.status||'').toUpperCase())).slice(0,5);
    const activeExecutions=executions.filter(x=>['ACTIVE','RUNNING','QUEUED','WAITING','RETRYING'].includes(String(x.state||'').toUpperCase())).slice(0,5);
    const recentExecutions=executions.slice(0,5);
    const recentActivity=activity.slice(0,5);
    const recentDeliveries=deliverables.slice(-4).reverse();
    const providerCounts=summary.provider_counts||{};
    const unhealthyProviders=Object.entries(providerCounts).filter(([k])=>!['AVAILABLE','STAGING_ONLY'].includes(String(k).toUpperCase())).reduce((a,[,v])=>a+Number(v||0),0);
    const body=document.createElement('div'); body.className='design-overview'; body.dataset.designOverview='true';
    const operations=(activeMissions.length?activeMissions:missions.slice(0,4)).map(m=>'<div class="item"><div><strong>'+esc(m.project||m.project_id||m.mission_id||'Mission')+'</strong><div class="small mono">'+esc(m.mission_id||'UNKNOWN')+'</div></div>'+badge(m.execution_state||m.status||'UNKNOWN')+'</div>').join('')||'<div class="empty">Keine aktiven Missionen.</div>';
    const executionItems=(activeExecutions.length?activeExecutions:recentExecutions).slice(0,4).map(x=>'<div class="item"><div><strong>'+esc(x.factory||x.task_id||'Execution')+'</strong><div class="small">'+esc(x.provider||'Provider UNKNOWN')+'</div></div>'+badge(x.state||'UNKNOWN')+'</div>').join('')||'<div class="empty">Keine Execution-Evidence.</div>';
    const activityItems=recentActivity.map(x=>'<div class="item"><div><strong>'+esc(x.event||x.type||'Activity')+'</strong><div class="small">'+esc(fmtDate(x.at))+'</div></div></div>').join('')||'<div class="empty">Keine Aktivität.</div>';
    const deliveryItems=recentDeliveries.map(x=>'<div class="item"><div><strong>'+esc(x.business_name||x.mission_id||'Deliverable')+'</strong><div class="small">'+esc(x.mission_id||'')+'</div></div>'+badge(x.final_delivery_status||x.status||'UNKNOWN')+'</div>').join('')||'<div class="empty">Noch keine Deliverables.</div>';
    body.innerHTML=renderAttention(data)+
      '<div class="overview-section"><div class="section-heading"><h2>Current operations</h2><span class="small">Laufende Arbeit zuerst</span></div><div class="overview-operations"><div class="overview-panel"><div class="row"><div><strong>Missionen</strong><div class="small">Aktiv oder zuletzt relevant</div></div><button class="btn" data-goto="missions">Open</button></div><div class="overview-list">'+operations+'</div></div><div class="overview-panel quiet"><div class="row"><div><strong>Executions</strong><div class="small">Runtime-Evidence</div></div><button class="btn" data-goto="executions">Open</button></div><div class="overview-list">'+executionItems+'</div></div></div></div>'+
      '<div class="overview-section"><div class="section-heading"><h2>System & control</h2><span class="small">Unterstützende Wahrheit, visuell ruhig</span></div><div class="overview-support"><div class="overview-panel quiet"><h2>System</h2><div class="overview-stat"><strong>Operator state</strong><span>'+badge(summary.operator_state||'UNKNOWN')+'</span></div><div class="overview-stat"><strong>Factories</strong><span class="value">'+esc(summary.factory_count??'UNKNOWN')+'</span></div><div class="overview-stat"><strong>Provider attention</strong><span class="value">'+esc(unhealthyProviders)+'</span></div><div class="row"><button class="btn" data-goto="health">System Health</button><button class="btn" data-goto="providers">Providers</button></div></div><div class="overview-panel quiet"><h2>Financial / Control</h2><div class="overview-stat"><strong>Variable cost</strong><span class="value">'+esc(data.summary?.variable_cost_eur===null||data.summary?.variable_cost_eur===undefined?'UNKNOWN':fmtMoney(data.summary.variable_cost_eur))+'</span></div><div class="overview-stat"><strong>Pending approvals</strong><span class="value">'+esc(summary.pending_approvals??'UNKNOWN')+'</span></div><div class="overview-stat"><strong>Critical alerts</strong><span class="value">'+esc(summary.critical_alerts??'UNKNOWN')+'</span></div><div class="row"><button class="btn" data-goto="costs">Costs</button><button class="btn" data-goto="approvals">Approvals</button></div></div><div class="overview-panel quiet"><div class="row"><div><h2 style="margin:0">Output</h2><div class="small">Zuletzt ausgeliefert</div></div><button class="btn" data-goto="deliveries">Open</button></div><div class="overview-list">'+deliveryItems+'</div></div></div></div>'+
      '<div class="overview-section"><div class="section-heading"><h2>Recent activity</h2><span class="small">Chronologisch, ohne Log-Wand</span></div><div class="overview-panel quiet"><div class="overview-list">'+activityItems+'</div><div class="row"><button class="btn" data-goto="audit">Open Activity</button></div></div></div>';
    root.prepend(body);
  }

  function lifecycleTone(raw){const tone=status(raw).tone;return ['ready','active','attention','blocked'].includes(tone)?tone:'neutral'}
  function addMissionLifecycles(){
    const root=document.getElementById('missions');if(!root)return;
    const details=[...root.querySelectorAll('details.details')]; const missions=state.data.functional?.missions||[];
    details.forEach((detail,index)=>{if(detail.querySelector('.lifecycle'))return;const m=missions[index];if(!m)return;const stages=[['Mission',m.mission_type||m.status],['Plan',m.plan?'PLAN_READY':'UNKNOWN'],['Approval',m.approval_state],['Execution',m.execution_state],['Quality',m.quality_state],['Delivery',m.delivery_state]];const life=document.createElement('div');life.className='lifecycle';life.setAttribute('aria-label','Mission lifecycle');life.innerHTML=stages.map(([label,value])=>'<div class="lifecycle-step" data-tone="'+lifecycleTone(value)+'"><span class="label">'+esc(label)+'</span><span class="state">'+esc(status(value).label)+'</span></div>').join('');const firstHeading=detail.querySelector('h3');detail.insertBefore(life,firstHeading||detail.children[1]||null)});
  }

  function markSections(){document.querySelectorAll('.section').forEach(s=>s.dataset.designSection='true')}

  function polish(id){
    rebuildNavigation(); polishBrand(); updateHeader(id||state.section||'hq'); markSections();
    if((id||state.section)==='hq') renderDesignOverview();
    if((id||state.section)==='missions') addMissionLifecycles();
    const error=document.getElementById('error');if(error)error.setAttribute('role','status');
    document.querySelectorAll('.badge').forEach(el=>{if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','Status: '+el.textContent.trim())});
    document.querySelectorAll('table').forEach(t=>{if(!t.hasAttribute('role'))t.setAttribute('role','table')});
  }

  if(typeof render==='function'){
    const previousRender=render;
    render=function(id){previousRender(id);requestAnimationFrame(()=>polish(id));};
  }
  const refresh=document.getElementById('refresh');if(refresh){refresh.setAttribute('aria-label','Operator Control aktualisieren');refresh.title='Aktuelle Operator-Daten neu laden'}
  requestAnimationFrame(()=>polish(state.section||'hq'));
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const response = await handleFunctionalSealDashboard(request, env, ctx, options);
  if (!response) return null;
  const url = new URL(request.url);
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  let body = source;
  body = body.includes('</head>') ? body.replace('</head>', `${DESIGN_STYLE}</head>`) : `${DESIGN_STYLE}${body}`;
  body = body.includes('</body>') ? body.replace('</body>', `${DESIGN_SCRIPT}</body>`) : `${body}${DESIGN_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorDesignUxManifest() {
  return {
    schema: 'aurentara.operator-design-ux.v1',
    presentation_only: true,
    canonical_route: '/operator',
    existing_functional_seal_reused: true,
    new_core_engine: false,
    new_dashboard: false,
    new_api_route: false,
    grouped_navigation: true,
    command_center_hierarchy: true,
    mission_lifecycle_visualization: true,
    responsive_priority: ['desktop','laptop','tablet','mobile'],
    status_not_color_only: true,
    keyboard_focus_visible: true,
    reduced_motion_supported: true,
    loading_skeleton_supported: true,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    variable_cost_eur: 0
  };
}
