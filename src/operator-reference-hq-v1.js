const STYLE = String.raw\`<style id="aurentara-ferrari-reference-hq-v1-style">
:root{
  --rf-bg:#061016;--rf-bg2:#09151c;--rf-surface:#0b1a22;--rf-surface2:#0d2029;
  --rf-line:#1b3440;--rf-line2:#284652;--rf-text:#f2f6f7;--rf-muted:#8fa2aa;
  --rf-gold:#d5b454;--rf-green:#35d884;--rf-yellow:#f0bd3f;--rf-red:#ff655d;--rf-blue:#65b9ff;
  --rf-radius:10px;--rf-shadow:0 14px 36px rgba(0,0,0,.24)
}
html{background:var(--rf-bg)}
body{background:radial-gradient(circle at 72% -20%,#18303c 0,transparent 34%),linear-gradient(180deg,#071218,#050c11 72%);color:var(--rf-text)}
body .app{grid-template-columns:212px minmax(0,1fr);background:transparent}
body .side{position:sticky;top:0;height:100vh;padding:22px 10px 18px;background:
  radial-gradient(ellipse at 35% 88%,rgba(37,63,70,.38),transparent 35%),
  linear-gradient(160deg,#071217 0%,#061016 54%,#050c11 100%);border-right:1px solid #18303a;color:var(--rf-text)}
body .brand{margin:0 8px 22px;padding:5px 6px 18px;border-bottom:0;text-align:center}
body .brand strong{display:block;color:#fff;font-size:19px;letter-spacing:.25em;font-weight:450}
body .brand span{display:block;margin-top:3px;color:#c8d2d6;font-size:9px;letter-spacing:.42em;text-transform:uppercase}
body .brand .brand-parent{display:none!important}
body .nav{height:calc(100vh - 205px);overflow-y:auto;overflow-x:hidden;padding:3px 0 20px;scrollbar-width:none}
body .nav::-webkit-scrollbar{display:none}
body .nav-group{display:contents}.nav-label{display:none!important}
body .nav button{position:relative;width:100%;display:flex;align-items:center;gap:12px;min-height:45px;margin:1px 0;padding:10px 13px;border:0;border-radius:9px;background:transparent;color:#aebfc7;font-size:13px;font-weight:520;text-align:left}
body .nav button:hover{background:#122129;color:#fff}
body .nav button.active{background:linear-gradient(90deg,rgba(213,180,84,.17),rgba(255,255,255,.065));color:#fff;box-shadow:none}
body .nav button.active:before{content:"";position:absolute;left:-10px;top:7px;bottom:7px;width:3px;border-radius:4px;background:var(--rf-gold);box-shadow:0 0 12px rgba(213,180,84,.5)}
body .nav-icon{width:18px;height:18px;color:#bad0da} body .nav-icon svg{width:18px;height:18px}
body .rf-custom-nav .nav-icon{display:inline-grid}
body .rf-nav-projects span:last-child,body .rf-nav-approvals span:last-child,body .rf-nav-settings span:last-child{font-size:0}
body .rf-nav-projects span:last-child:after{content:"Portfolio";font-size:13px}
body .rf-nav-approvals span:last-child:after{content:"Approvals";font-size:13px}
body .rf-nav-settings span:last-child:after{content:"Settings";font-size:13px}
body .rf-nav-spacer{height:380px;pointer-events:none}
body .rf-legacy-nav{display:grid;gap:1px;padding-top:8px;border-top:1px solid #152a33}
body .rf-legacy-nav:before{content:"SYSTEM";display:block;padding:5px 12px;color:#4f6974;font-size:9px;letter-spacing:.18em}
body .side-foot{margin:0 9px;padding:12px 4px 0;border-top:1px solid #18303a;color:#70848d;font-size:9px;letter-spacing:.13em;line-height:1.55;text-transform:uppercase}
body .main{max-width:none;width:100%;padding:0 18px 30px;min-width:0;background:transparent}
body .main>.top,body .main>.section,body #error{width:100%;max-width:none}
body.rf-hq-active .top{display:none!important}
body.rf-hq-active #error{margin-top:8px}
body.rf-hq-active .global-operator-ai-trigger{display:none!important}
body .rf-utility-bar{display:none;height:56px;margin:0 -18px 0;padding:9px 16px;align-items:center;gap:12px;border-bottom:1px solid #18313b;background:rgba(5,15,21,.92);backdrop-filter:blur(14px)}
body.rf-hq-active .rf-utility-bar{display:flex}
.rf-search{position:relative;flex:0 1 340px}.rf-search input{width:100%;height:38px;padding:0 45px 0 37px;border:1px solid #24404b;border-radius:9px;background:#0b1820;color:#dce7eb;outline:0}
.rf-search input:focus{border-color:#456878;box-shadow:0 0 0 2px rgba(101,185,255,.08)}.rf-search svg{position:absolute;left:12px;top:10px;width:17px;height:17px;stroke:#9bb0b9;fill:none;stroke-width:1.7}.rf-kbd{position:absolute;right:9px;top:8px;padding:3px 6px;border:1px solid #2a424d;border-radius:6px;color:#6f8790;font-size:10px}
.rf-utils{margin-left:auto;display:flex;align-items:center;gap:9px}.rf-chip{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 11px;border:1px solid #29414a;border-radius:999px;background:#0a171e;color:#c8d5da;font-size:10px;font-weight:680}.rf-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--rf-green);box-shadow:0 0 10px rgba(53,216,132,.6)}.rf-prod-lock{color:#d8c980}.rf-icon-btn{width:32px;height:32px;min-height:32px;border:0;background:transparent;color:#a9bdc5;display:grid;place-items:center}.rf-icon-btn:hover{color:#fff}.rf-operator{display:flex;align-items:center;gap:9px;padding-left:12px;border-left:1px solid #29404a}.rf-avatar{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#647b87,#2b3c45);color:#fff;font-size:10px;font-weight:800}.rf-operator b{display:block;font-size:10px;color:#fff}.rf-operator span{display:block;font-size:8px;color:#718893;letter-spacing:.08em}
#hq{padding-top:0}
.rf-hq{display:grid;gap:11px;min-width:0}
.rf-hero{position:relative;min-height:115px;margin:0 -1px;overflow:hidden;padding:17px 14px 12px;border-bottom:1px solid #17303b;background:
  radial-gradient(ellipse at 82% 95%,rgba(213,180,84,.17),transparent 24%),
  linear-gradient(105deg,#0a171f 0%,#0c1921 42%,#09131a 100%)}
.rf-hero:before{content:"";position:absolute;right:-4%;bottom:-24px;width:66%;height:125px;opacity:.78;background:
  linear-gradient(142deg,transparent 0 35%,#1b2b31 35% 47%,transparent 47%),
  linear-gradient(38deg,transparent 0 41%,#13242c 41% 56%,transparent 56%),
  linear-gradient(150deg,transparent 0 54%,#24343a 54% 68%,transparent 68%);filter:drop-shadow(0 14px 10px rgba(0,0,0,.35))}
.rf-hero>*{position:relative;z-index:1}.rf-eyebrow{display:flex;align-items:center;gap:8px;color:#c9b768;font-size:9px;letter-spacing:.23em;text-transform:uppercase}.rf-eyebrow:before{content:"◈";font-size:7px}.rf-hero h1{margin:6px 0 4px;color:#fff;font-size:37px;line-height:1;letter-spacing:-.035em;font-weight:690}.rf-hero p{margin:0;color:#d0d8dc;font-size:13px}.rf-motto{position:absolute;right:23px;top:22px;width:105px;color:#aabcc3;font-size:8px;letter-spacing:.32em;line-height:1.7;text-transform:uppercase}.rf-motto:after{content:"";display:block;width:62px;height:1px;margin-top:10px;background:var(--rf-gold)}
.rf-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.rf-kpi{min-height:95px;padding:16px 16px 12px;border:1px solid var(--rf-line);border-radius:var(--rf-radius);background:linear-gradient(145deg,rgba(13,29,37,.97),rgba(7,19,25,.96));box-shadow:inset 0 1px rgba(255,255,255,.015)}
.rf-kpi-head{display:flex;gap:13px;align-items:center}.rf-kpi-icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#15271f;color:var(--rf-green)}.rf-kpi-icon.gold{background:#28251a;color:var(--rf-gold)}.rf-kpi-icon.red{background:#2a1b1c;color:var(--rf-red)}.rf-kpi-icon.blue{background:#142632;color:var(--rf-blue)}.rf-kpi-icon svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.7}.rf-kpi-label{font-size:10px;color:#dbe4e8}.rf-kpi-value{margin-top:1px;color:#fff;font-size:21px;font-weight:700}.rf-kpi-foot{margin:5px 0 0 55px;color:#55d994;font-size:9px}.rf-kpi-foot.muted{color:#77909a}
.rf-middle{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.98fr);gap:11px}.rf-panel{min-width:0;border:1px solid var(--rf-line);border-radius:var(--rf-radius);background:linear-gradient(150deg,rgba(11,27,35,.98),rgba(6,17,23,.98));box-shadow:var(--rf-shadow)}.rf-panel-head{min-height:54px;display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #18313b}.rf-panel-head h2{margin:0;color:#f4f7f8;font-size:14px}.rf-panel-head p{margin:2px 0 0;color:#7f949d;font-size:9px}.rf-panel-head .push{margin-left:auto}.rf-link{border:0;background:transparent;color:#9fb0b7;font-size:9px}.rf-link:hover{color:#fff}
.rf-alert-icon{color:var(--rf-red);font-size:23px;filter:drop-shadow(0 0 6px rgba(255,101,93,.35))}
.rf-attention-list{padding:1px 13px 8px}.rf-attention-row{display:grid;grid-template-columns:8px 95px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:39px;border-top:1px solid #142a33}.rf-attention-row:first-child{border-top:0}.rf-attention-dot{width:6px;height:6px;border-radius:50%;background:var(--rf-yellow)}.rf-attention-dot.blocked{background:var(--rf-red)}.rf-attention-dot.info{background:var(--rf-blue)}.rf-attention-tag{justify-self:start;padding:4px 7px;border:1px solid #6d521b;border-radius:5px;background:#2a2414;color:#f3c64e;font-size:8px;font-weight:750}.rf-attention-tag.blocked{border-color:#74302d;background:#2c1818;color:#ff756e}.rf-attention-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7e0e4;font-size:9px}.rf-attention-time{color:#69818b;font-size:8px}.rf-all-clear{padding:22px;color:#84cfa6;font-size:10px}
.rf-ai-body{padding:11px 14px 12px}.rf-ai-copy{padding:11px 12px;border:1px solid #1d3742;border-radius:8px;background:#08161d}.rf-ai-copy b{font-size:11px}.rf-ai-copy p{margin:5px 0 8px;color:#a9bac1;font-size:9px;line-height:1.55}.rf-ai-actions{display:flex;gap:6px;flex-wrap:wrap}.rf-ai-action{min-height:27px;padding:5px 9px;border:1px solid #29434e;border-radius:6px;background:#102129;color:#b8c8cf;font-size:8px}.rf-ai-input{display:grid;grid-template-columns:1fr 32px;gap:6px;margin-top:8px}.rf-ai-input input{height:34px;padding:0 10px;border:1px solid #203944;border-radius:7px;background:#08151c;color:#dfe8eb}.rf-ai-input button{min-height:34px;border:1px solid #29434e;border-radius:7px;background:#0e2028;color:#9fb6c1}
.rf-bottom{display:grid;grid-template-columns:minmax(470px,.93fr) minmax(0,1.12fr);gap:11px}.rf-portfolio-head .rf-gold-btn{height:32px;padding:0 17px;border:0;border-radius:7px;background:linear-gradient(180deg,#edd375,#c79d3b);color:#1b170b;font-size:9px;font-weight:800}.rf-portfolio-tools{display:grid;grid-template-columns:auto 190px;gap:8px;padding:8px 12px;border-bottom:1px solid #18313b}.rf-filter-tabs{display:flex;gap:6px}.rf-filter{min-height:29px;padding:5px 10px;border:1px solid #29424d;border-radius:6px;background:#0d1d25;color:#98adb6;font-size:8px}.rf-filter.active{border-color:#b99a48;color:#fff;background:#282618}.rf-project-search{position:relative}.rf-project-search input{width:100%;height:29px;padding:0 9px 0 28px;border:1px solid #29424d;border-radius:6px;background:#09171e;color:#c8d5da;font-size:8px}.rf-project-search:before{content:"⌕";position:absolute;left:10px;top:5px;color:#6d8792}
.rf-project-list{padding:4px 0 6px}.rf-project-row{display:grid;grid-template-columns:48px minmax(155px,1fr) auto 17px;gap:9px;align-items:center;min-height:66px;margin:0 1px;padding:7px 11px;border:1px solid transparent;border-top-color:#142b34;background:transparent}.rf-project-row:first-child{border-top-color:transparent}.rf-project-row.selected{margin:3px 0;border-color:#b99a48;border-radius:7px;background:linear-gradient(90deg,rgba(213,180,84,.13),rgba(21,37,40,.6))}.rf-thumb{width:46px;height:46px;border-radius:6px;display:grid;place-items:center;background:linear-gradient(145deg,#3a4b52,#17272e);color:#f4f7f8;font-size:16px;font-weight:750}.rf-project-name{min-width:0}.rf-project-name b{display:block;color:#eef4f6;font-size:10px}.rf-project-name span{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#728994;font-size:7px}.rf-project-chips{display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap}.rf-pchip{padding:4px 6px;border:1px solid #31515d;border-radius:5px;color:#9fb4bc;font-size:7px;font-weight:700;white-space:nowrap}.rf-pchip.green{border-color:#236b4a;background:#103523;color:#63df9c}.rf-pchip.red{border-color:#73302e;background:#2c1717;color:#ff736b}.rf-pchip.gold{border-color:#72591c;background:#2c2614;color:#eac04a}.rf-open{border:0;background:transparent;color:#b8c7cd;font-size:18px}
.rf-selected-head{display:flex;align-items:center;gap:10px;padding:10px 13px}.rf-selected-head .rf-thumb{width:56px;height:44px}.rf-selected-title{min-width:0}.rf-selected-title b{display:block;color:#fff;font-size:14px}.rf-selected-title span{display:block;margin-top:2px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#80959e;font-size:8px}.rf-favorite{margin-left:auto;padding:6px 9px;border:1px solid #8b7028;border-radius:999px;color:#ddc56f;font-size:8px}.rf-selected-tabs{display:flex;gap:1px;padding:0 9px;border-top:1px solid #152d36;border-bottom:1px solid #18323c;overflow:auto}.rf-selected-tabs button{flex:1;min-width:max-content;min-height:34px;border:0;border-bottom:2px solid transparent;background:transparent;color:#9aafb8;font-size:8px}.rf-selected-tabs button.active{border-bottom-color:var(--rf-gold);color:#fff;background:linear-gradient(180deg,rgba(213,180,84,.08),transparent)}
.rf-selected-grid{display:grid;grid-template-columns:1.25fr .92fr;gap:9px;padding:12px}.rf-status-card,.rf-action-card,.rf-mini-card{border:1px solid #1b3741;border-radius:8px;background:#0a1a21;padding:12px}.rf-status-card h3,.rf-action-card h3,.rf-mini-card h3{display:flex;align-items:center;gap:6px;margin:0 0 10px;color:#eaf1f3;font-size:9px}.rf-status-line{display:flex;align-items:center;gap:7px;margin-bottom:9px}.rf-status-pill{padding:4px 7px;border-radius:999px;background:#123c29;color:#58dd98;font-size:7px;font-weight:800}.rf-progress{height:6px;border-radius:99px;background:#17303a;overflow:hidden}.rf-progress span{display:block;height:100%;background:linear-gradient(90deg,#37df8a,#64f1b1)}.rf-status-meta{display:flex;justify-content:space-between;margin-top:6px;color:#7e949d;font-size:8px}.rf-no-progress{padding:8px;border:1px dashed #2b4650;border-radius:6px;color:#78909a;font-size:8px}.rf-action-card{background:linear-gradient(145deg,#242116,#17180f)}.rf-action-card .next{color:#f0f3f4;font-size:10px;line-height:1.4}.rf-action-card .why{margin-top:7px;color:#998e63;font-size:8px}
.rf-mini-grid{display:grid;grid-template-columns:1fr 1fr 1.34fr;gap:8px;grid-column:1/-1}.rf-mini-row{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #17303a;color:#91a6ae;font-size:8px}.rf-mini-row:first-of-type{border-top:0}.rf-mini-row b{color:#e2eaed}.rf-preview-btn{width:100%;min-height:32px;margin-top:7px;border:1px solid #31505c;border-radius:6px;background:#10242c;color:#e1e9ec;font-size:8px}.rf-activity-list{display:grid}.rf-activity-item{display:grid;grid-template-columns:10px 1fr auto;gap:7px;align-items:center;padding:5px 0;border-top:1px solid #152c35;color:#a9bbc2;font-size:7.5px}.rf-activity-item:first-child{border-top:0}.rf-activity-dot{width:6px;height:6px;border-radius:2px;background:#d8b64d}.rf-empty-selected{padding:40px 18px;color:#79909a;text-align:center;font-size:10px}
body .card,body .metric{border-color:#203b46} body .badge{border-color:#2c4650}
@media(max-width:1180px){body .app{grid-template-columns:196px 1fr}.rf-bottom{grid-template-columns:1fr}.rf-middle{grid-template-columns:1fr}.rf-kpis{grid-template-columns:1fr 1fr}.rf-nav-spacer{height:220px}}
@media(max-width:760px){body .app{display:block}.rf-utility-bar{margin:0 -14px}.rf-utils .rf-chip,.rf-operator{display:none}.rf-search{flex:1}.rf-hero{margin:0}.rf-hero h1{font-size:28px}.rf-motto{display:none}.rf-kpis{grid-template-columns:1fr 1fr}.rf-middle,.rf-bottom{grid-template-columns:1fr}.rf-selected-grid{grid-template-columns:1fr}.rf-mini-grid{grid-template-columns:1fr}.rf-portfolio-tools{grid-template-columns:1fr}.rf-project-row{grid-template-columns:44px minmax(0,1fr) 17px}.rf-project-chips{grid-column:2/-1;justify-content:flex-start}.side .rf-nav-spacer{height:20px}.side .rf-legacy-nav{display:flex}.side .nav{height:auto}.rf-nav-projects span:last-child:after,.rf-nav-approvals span:last-child:after,.rf-nav-settings span:last-child:after{font-size:11px}}
</style>\`;

const SCRIPT = String.raw\`<script id="aurentara-ferrari-reference-hq-v1-script">
(function(){
  if(window.__aurentaraFerrariReferenceHqV1)return;
  window.__aurentaraFerrariReferenceHqV1=true;
  var H=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])})};
  var U=function(v){return String(v==null?'':v).trim().toUpperCase()};
  var N=function(v){var x=Number(v);return Number.isFinite(x)?x:0};
  var SVG={
    search:'<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>',
    folder:'<svg viewBox="0 0 22 22"><path d="M2.8 6.3h6l1.7 2h8.7v9.2H2.8z"/></svg>',
    input:'<svg viewBox="0 0 22 22"><path d="M5 2.8h9l3 3V19H5z"/><path d="M14 2.8V6h3M8 10h6M8 13h6"/></svg>',
    clock:'<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="8"/><path d="M11 6.5v5l3.5 2"/></svg>',
    preview:'<svg viewBox="0 0 22 22"><rect x="3" y="4" width="16" height="11" rx="2"/><path d="M8 19h6M11 15v4"/></svg>',
    ai:'<svg viewBox="0 0 22 22"><path d="M11 2.7 12.6 8 18 9.6 12.6 11.2 11 16.5 9.4 11.2 4 9.6 9.4 8z"/><path d="M17 3.5v4M15 5.5h4"/></svg>'
  };
  function items(){return state&&state.data&&state.data.projects&&Array.isArray(state.data.projects.items)?state.data.projects.items:[]}
  function context(scope){return state.rfHqContexts&&state.rfHqContexts[scope]||{}}
  function detail(scope){return state.rfHqDetails&&state.rfHqDetails[scope]||null}
  function previewOf(p,d,c){return (d&&d.project_preview_access)||(p&&p.project_preview_access)||(c&&c.preview)||{}}
  function inputCount(c){var closure=c&&c.source_payload&&c.source_payload.human_input_closure||c&&c.human_input_closure||{};return Math.max(N(c&&c.open_input_count),N(closure.open_input_count),Array.isArray(closure.open_inputs)?closure.open_inputs.length:0)}
  function approvalCount(p,c){return N(p&&p.open_approval_count)+N(c&&c.open_approval_count)}
  function blockerCount(p,c){return N(p&&p.blocker_count)+N(c&&c.blocker_count)}
  function statusLabel(p,c){var raw=U(p&&p.state||p&&p.mission_status||'UNKNOWN');if(blockerCount(p,c)>0||raw==='BLOCKED'||raw==='FAILED')return 'BLOCKIERT';if(inputCount(c)>0||approvalCount(p,c)>0)return 'AUFMERKSAMKEIT';if(raw==='ACTIVE'||raw==='RUNNING')return 'IN UMSETZUNG';if(raw==='READY')return 'BEREIT';return raw.replaceAll('_',' ')||'UNBEKANNT'}
  function chipTone(label){var x=U(label);if(x.includes('BLOCK')||x.includes('FAIL'))return'red';if(x.includes('AUFMERK')||x.includes('FREIGABE'))return'gold';if(x.includes('READY')||x.includes('BEREIT')||x.includes('UMSETZUNG')||x.includes('ACTIVE'))return'green';return''}
  function nextAction(p,c,d){
    var pi=previewOf(p,d,c),inputs=inputCount(c),approvals=approvalCount(p,c),blocks=blockerCount(p,c);
    if(blocks>0)return{label:'Blocker prüfen',tab:'overview',why:'Projekt ist durch bestehende Runtime-Evidence blockiert.'};
    if(inputs>0)return{label:inputs+' offene Eingabe'+(inputs===1?'':'n')+' beantworten',tab:'approvals',why:'Customer Input Closure benötigt menschliche Angaben.'};
    if(approvals>0)return{label:'Ausstehende Freigabe prüfen',tab:'approvals',why:'Eine explizite Operator-Entscheidung ist erforderlich.'};
    if(pi&&pi.available===true)return{label:'Preview prüfen',tab:'preview',why:'Ein projektbezogener Preview-Zugang ist verfügbar.'};
    return{label:'Projektübersicht öffnen',tab:'overview',why:'Keine höher priorisierte Operator-Aktion erkannt.'}
  }
  function selected(){
    var all=items(),scope=String(state.selectedScope||'');
    var found=scope&&all.find(function(p){return p.scope_key===scope});
    if(found)return found;
    var gelato=all.find(function(p){return String(p.scope_key||'').includes('gelato-donatello:gelato-donatello-website-v1')});
    return gelato||all.find(function(p){return p.project_detail_openable===true})||all[0]||null
  }
  function hydrate(){
    if(state.rfHqHydrating)return;
    state.rfHqContexts=state.rfHqContexts||{};state.rfHqDetails=state.rfHqDetails||{};
    var all=items().filter(function(p){return p&&p.scope_key&&p.project_detail_openable===true});
    var sel=selected();
    var jobs=[];
    all.forEach(function(p){
      if(!state.rfHqContexts[p.scope_key]){
        jobs.push(api('/project-source-intake?scope_key='+encodeURIComponent(p.scope_key)).then(function(x){
          var w=x.workspace||{},k=w.knowledge_review||{},closure=x.human_input_closure||{};
          state.rfHqContexts[p.scope_key]={open_input_count:N(closure.open_input_count),open_approval_count:N(closure.readiness&&closure.readiness.human_quality_approval&&closure.readiness.human_quality_approval.status==='APPROVAL_REQUIRED'?1:0),blocker_count:N(w.blocker_count),knowledge_attention_count:N(k.catch_net&&k.catch_net.unresolved_count),preview:p.project_preview_access||{},source_payload:x};
        }).catch(function(){state.rfHqContexts[p.scope_key]={preview:p.project_preview_access||{}}}))
      }
    });
    if(sel&&sel.project_detail_openable===true&&!state.rfHqDetails[sel.scope_key]){
      jobs.push(api('/project-detail/'+encodeURIComponent(sel.scope_key)).then(function(x){state.rfHqDetails[sel.scope_key]=x}).catch(function(){}))
    }
    if(!jobs.length)return;
    state.rfHqHydrating=true;
    Promise.all(jobs).then(function(){state.rfHqHydrating=false;if(state.section==='hq')renderReferenceHq()}).catch(function(){state.rfHqHydrating=false})
  }
  function navIcon(path){return'<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 16 16">'+path+'</svg></span>'}
  function arrangeChrome(){
    var brand=document.querySelector('.brand');
    if(brand)brand.innerHTML='<strong>AURENTARA</strong><span>SYSTEMS</span>';
    var foot=document.querySelector('.side-foot');if(foot)foot.innerHTML='IDEAS INTO IMPACT<br><br>PEOPLE · PROJECTS · PROGRESS';
    var nav=document.querySelector('.nav');if(!nav||nav.dataset.rfArranged==='true')return;
    var buttons=[].slice.call(nav.querySelectorAll('button[data-goto]')),map={};buttons.forEach(function(b){map[b.dataset.goto]=b});
    nav.innerHTML='';
    var custom=function(id,label,path,handler){var b=document.createElement('button');b.type='button';b.className='rf-custom-nav rf-nav-'+id;b.innerHTML=navIcon(path)+'<span>'+label+'</span>';b.addEventListener('click',handler);nav.appendChild(b);return b};
    function add(id,cls){if(!map[id])return;map[id].classList.add('rf-nav-'+(cls||id));nav.appendChild(map[id])}
    add('hq');add('projects');
    custom('project-overview','Project Overview','<rect x="2.8" y="2.8" width="10.4" height="10.4" rx="1.5"/><path d="M5 6h6M5 9h4"/>',function(){openSelectedTab('overview')});
    custom('sources','Sources','<path d="M3 4h10v9H3z"/><path d="M5 2.8h6V4M5 7h6M5 10h4"/>',function(){openSelectedTab('sources')});
    custom('knowledge','Knowledge','<path d="M2.8 3.5h4.5c1 0 1.7.5 1.7 1.5v8c0-1-.7-1.5-1.7-1.5H2.8z"/><path d="M13.2 3.5H8.7C7.7 3.5 7 4 7 5v8c0-1 .7-1.5 1.7-1.5h4.5z"/>',function(){openSelectedTab('knowledge')});
    custom('preview','Preview','<rect x="2.5" y="3" width="11" height="8" rx="1.5"/><path d="M6 13h4M8 11v2"/>',function(){openSelectedTab('preview')});
    add('approvals');add('audit');
    custom('operator-ai','Operator AI','<path d="M8 2.3 9.1 6.9 13.7 8 9.1 9.1 8 13.7 6.9 9.1 2.3 8 6.9 6.9z"/>',function(){if(window.aurentaraOpenGlobalOperatorAiV1)window.aurentaraOpenGlobalOperatorAiV1();else if(window.aurentaraOpenOperatorAiV1)window.aurentaraOpenOperatorAiV1()});
    add('settings');
    var spacer=document.createElement('div');spacer.className='rf-nav-spacer';nav.appendChild(spacer);
    var legacy=document.createElement('div');legacy.className='rf-legacy-nav';
    buttons.forEach(function(b){if(!b.parentElement||b.parentElement===nav)return;if(['hq','projects','approvals','audit','settings'].includes(b.dataset.goto))return;legacy.appendChild(b)});
    nav.appendChild(legacy);nav.dataset.rfArranged='true'
  }
  function utility(){
    var main=document.querySelector('.main');if(!main)return;
    var bar=document.getElementById('rf-utility-bar');
    if(!bar){bar=document.createElement('div');bar.id='rf-utility-bar';bar.className='rf-utility-bar';bar.innerHTML=
      '<div class="rf-search">'+SVG.search+'<input id="rf-universal-search" placeholder="Universelle Suche ..." aria-label="Universelle Suche"><span class="rf-kbd">⌘ K</span></div>'+
      '<div class="rf-utils"><span class="rf-chip"><span class="dot"></span>STAGING</span><span class="rf-chip rf-prod-lock">Production locked</span><button class="rf-icon-btn" id="rf-ai-top" aria-label="Operator AI">'+SVG.ai+'</button><div class="rf-operator"><span class="rf-avatar">OP</span><div><b>Operator</b><span>AURENTARA</span></div></div></div>';
      main.insertBefore(bar,main.firstChild);
      bar.querySelector('#rf-ai-top').onclick=function(){if(window.aurentaraOpenGlobalOperatorAiV1)window.aurentaraOpenGlobalOperatorAiV1()};
      var si=bar.querySelector('#rf-universal-search');si.addEventListener('keydown',function(e){if(e.key==='Enter')universalSearch(si.value)});
      document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();si.focus()}})
    }
  }
  function universalSearch(raw){
    var q=String(raw||'').trim().toLowerCase();if(!q)return;
    var sectionMap=[['provider','providers'],['kosten','costs'],['cost','costs'],['freigab','approvals'],['approval','approvals'],['activity','audit'],['aktiv','audit'],['system','health'],['factory','factories'],['mission','mission']];
    for(var i=0;i<sectionMap.length;i++)if(q.includes(sectionMap[i][0])){go(sectionMap[i][1]);return}
    var p=items().find(function(x){return [x.name,x.project_id,x.customer_id,x.scope_key].some(function(v){return String(v||'').toLowerCase().includes(q)})});
    if(p){openProject(p,'overview');return}
    state.projectQuery=raw;go('projects')
  }
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(N(v))}
  function renderKpis(){
    var all=items(),inputs=0,approvals=0,previews=0;
    all.forEach(function(p){var c=context(p.scope_key);inputs+=inputCount(c);approvals+=approvalCount(p,c);if(previewOf(p,null,c).available===true)previews++});
    var globalA=state.data&&state.data.approvals||{};approvals=Math.max(approvals,N(globalA.core&&globalA.core.pending_count)+(Array.isArray(globalA.mission_plans)?globalA.mission_plans.filter(function(x){return U(x.status)!=='DEFERRED'}).length:0));
    var cards=[
      ['gold',SVG.folder,'Aktive Projekte',all.length],
      ['',SVG.input,'Offene Inputs',inputs],
      ['red',SVG.clock,'Ausstehende Freigaben',approvals],
      ['blue',SVG.preview,'Preview bereit',previews]
    ];
    return '<div class="rf-kpis">'+cards.map(function(x){return'<div class="rf-kpi"><div class="rf-kpi-head"><div class="rf-kpi-icon '+x[0]+'">'+x[1]+'</div><div><div class="rf-kpi-label">'+H(x[2])+'</div><div class="rf-kpi-value">'+H(x[3])+'</div></div></div><div class="rf-kpi-foot muted">Live aus Ferrari Runtime Truth</div></div>'}).join('')+'</div>'
  }
  function attentionRows(){
    var rows=[];
    items().forEach(function(p){var c=context(p.scope_key),b=blockerCount(p,c),i=inputCount(c),a=approvalCount(p,c);if(b>0)rows.push({tone:'blocked',tag:'BLOCKIERT',name:(p.name||p.project_id)+' – '+b+' Blocker',scope:p.scope_key});if(a>0)rows.push({tone:'',tag:'FREIGABE OFFEN',name:(p.name||p.project_id)+' – '+a+' Freigabe'+(a===1?'':'n'),scope:p.scope_key});if(i>0)rows.push({tone:'',tag:'INPUT BENÖTIGT',name:(p.name||p.project_id)+' – '+i+' offene Eingabe'+(i===1?'':'n'),scope:p.scope_key})});
    rows=rows.slice(0,4);if(!rows.length)return'<div class="rf-all-clear">Keine offenen projektbezogenen Attention-Punkte.</div>';
    return'<div class="rf-attention-list">'+rows.map(function(r){return'<button class="rf-attention-row" data-rf-scope="'+H(r.scope)+'"><span class="rf-attention-dot '+r.tone+'"></span><span class="rf-attention-tag '+r.tone+'">'+H(r.tag)+'</span><span class="rf-attention-name">'+H(r.name)+'</span><span class="rf-attention-time">jetzt</span></button>'}).join('')+'</div>'
  }
  function aiPanel(){
    return'<div class="rf-panel"><div class="rf-panel-head"><span style="color:var(--rf-blue)">'+SVG.ai+'</span><div><h2>Operator AI</h2><p>Ihr intelligenter Projektassistent – immer verfügbar.</p></div><button class="rf-link push" id="rf-ai-new">Neuer Chat ›</button></div><div class="rf-ai-body"><div class="rf-ai-copy"><b>Hallo! Ich bin Ihr Operator AI.</b><p>Ich unterstütze Sie bei Analyse, Planung und Umsetzung auf Basis des verifizierten AURENTARA-Kontexts.</p><div class="rf-ai-actions"><button class="rf-ai-action" data-rf-ai="Projektstatus zusammenfassen">Projektstatus zusammenfassen</button><button class="rf-ai-action" data-rf-ai="Risiken analysieren">Risiken analysieren</button><button class="rf-ai-action" data-rf-ai="Nächste Schritte empfehlen">Nächste Schritte empfehlen</button></div></div><div class="rf-ai-input"><input id="rf-ai-input" placeholder="Fragen Sie mich etwas ..."><button id="rf-ai-send">➤</button></div></div></div>'
  }
  function filteredProjects(){
    var all=items(),f=state.rfPortfolioFilter||'all',q=String(state.rfPortfolioQuery||'').toLowerCase();
    return all.filter(function(p){var internal=String(p.customer_id||'').toLowerCase().includes('internal');if(f==='customer'&&internal)return false;if(f==='internal'&&!internal)return false;if(q&&![p.name,p.project_id,p.customer_id,p.scope_key].some(function(v){return String(v||'').toLowerCase().includes(q)}))return false;return true})
  }
  function portfolio(){
    var all=items(),customers=all.filter(function(p){return!String(p.customer_id||'').toLowerCase().includes('internal')}).length,internal=all.length-customers,sel=selected(),rows=filteredProjects();
    var rowHtml=rows.map(function(p){var c=context(p.scope_key),pi=previewOf(p,null,c),label=statusLabel(p,c),chips='<span class="rf-pchip '+chipTone(label)+'">'+H(label)+'</span>';if(pi.available===true)chips+='<span class="rf-pchip green">PREVIEW VERFÜGBAR</span>';if(approvalCount(p,c)>0)chips+='<span class="rf-pchip gold">FREIGABE OFFEN</span>';var initial=String(p.name||p.project_id||'?').trim().charAt(0).toUpperCase();return'<div class="rf-project-row '+(sel&&sel.scope_key===p.scope_key?'selected':'')+'" data-rf-row="'+H(p.scope_key)+'"><div class="rf-thumb">'+H(initial)+'</div><div class="rf-project-name"><b>'+H(p.name||p.project_id)+'</b><span>'+H(p.scope_key)+'</span></div><div class="rf-project-chips">'+chips+'</div><button class="rf-open" data-rf-open="'+H(p.scope_key)+'" aria-label="Projekt öffnen">›</button></div>'}).join('');
    return'<div class="rf-panel"><div class="rf-panel-head rf-portfolio-head"><span style="font-size:18px">▱</span><div><h2>Projekt Portfolio</h2><p>Alle Kunden- und internen Projekte auf einen Blick.</p></div><button class="rf-gold-btn push" id="rf-new-project">Neues Projekt</button></div><div class="rf-portfolio-tools"><div class="rf-filter-tabs"><button class="rf-filter '+((state.rfPortfolioFilter||'all')==='all'?'active':'')+'" data-rf-filter="all">Alle ('+all.length+')</button><button class="rf-filter '+(state.rfPortfolioFilter==='customer'?'active':'')+'" data-rf-filter="customer">Kundenprojekte ('+customers+')</button><button class="rf-filter '+(state.rfPortfolioFilter==='internal'?'active':'')+'" data-rf-filter="internal">Interne Projekte ('+internal+')</button></div><div class="rf-project-search"><input id="rf-project-search" placeholder="Projekte suchen ..." value="'+H(state.rfPortfolioQuery||'')+'"></div></div><div class="rf-project-list">'+(rowHtml||'<div class="rf-all-clear">Keine Projekte passen zum Filter.</div>')+'</div></div>'
  }
  function selectedPanel(){
    var p=selected();if(!p)return'<div class="rf-panel"><div class="rf-empty-selected">Kein Projekt ausgewählt.</div></div>';
    var c=context(p.scope_key),d=detail(p.scope_key),pi=previewOf(p,d,c),a=nextAction(p,c,d),pct=N(p.progress_percent),timeline=d&&Array.isArray(d.timeline)?d.timeline.slice(-4).reverse():[],status=statusLabel(p,c),initial=String(p.name||p.project_id||'?').charAt(0).toUpperCase();
    var progress=pct>0&&pct<=100?'<div class="rf-progress"><span style="width:'+Math.round(pct)+'%"></span></div><div class="rf-status-meta"><span>Verifizierter Projektfortschritt</span><b>'+Math.round(pct)+' %</b></div>':'<div class="rf-no-progress">Kein verifizierter Prozentwert vorhanden · Status: '+H(status)+'</div>';
    var activity=timeline.length?timeline.map(function(x){return'<div class="rf-activity-item"><span class="rf-activity-dot"></span><span>'+H(x.event||x.type||'Aktivität')+'</span><span>'+H(typeof fmtDate==='function'?fmtDate(x.at):'')+'</span></div>'}).join(''):'<div class="rf-mini-row"><span>Noch keine Aktivität verfügbar.</span></div>';
    var preview='<div class="rf-mini-row"><span>Status</span><b>'+(pi.available===true?'VERFÜGBAR':'NICHT VERFÜGBAR')+'</b></div>'+(pi.available===true?'<button class="rf-preview-btn" data-rf-preview="'+H(pi.operator_route||pi.route||'')+'">Preview öffnen ↗</button>':'');
    return'<div class="rf-panel"><div class="rf-selected-head"><div class="rf-thumb">'+H(initial)+'</div><div class="rf-selected-title"><b>'+H(p.name||p.project_id)+'</b><span>'+H(p.scope_key)+'</span></div>'+(String(p.scope_key).includes('gelato-donatello')?'<span class="rf-favorite">★ Dogfood Projekt</span>':'')+'</div><div class="rf-selected-tabs">'+[['overview','Übersicht'],['sources','Quellen'],['knowledge','Projektwissen'],['implementation','Umsetzung'],['preview','Preview'],['approvals','Prüfungen'],['activity','Aktivität']].map(function(x,i){return'<button class="'+(i===0?'active':'')+'" data-rf-tab="'+x[0]+'" data-rf-scope="'+H(p.scope_key)+'">'+x[1]+'</button>'}).join('')+'</div><div class="rf-selected-grid"><div class="rf-status-card"><h3>▣ Projektstatus</h3><div class="rf-status-line"><span class="rf-status-pill">'+H(status)+'</span></div>'+progress+'</div><div class="rf-action-card"><h3>◷ Nächste Aktion</h3><div class="next">'+H(a.label)+' ›</div><div class="why">'+H(a.why)+'</div></div><div class="rf-mini-grid"><div class="rf-mini-card"><h3>◎ Cost & Safety</h3><div class="rf-mini-row"><span>Aktuelle Kosten</span><b>'+H(money(p.current_cost_eur||0))+'</b></div><div class="rf-mini-row"><span>Production</span><b>GESPERRT</b></div><div class="rf-mini-row"><span>External Writes</span><b>GESPERRT</b></div></div><div class="rf-mini-card"><h3>▣ Preview Access</h3>'+preview+'</div><div class="rf-mini-card"><h3>☷ Letzte Aktivitäten</h3><div class="rf-activity-list">'+activity+'</div></div></div></div></div>'
  }
  function bind(){
    document.querySelectorAll('[data-rf-filter]').forEach(function(b){b.onclick=function(){state.rfPortfolioFilter=b.dataset.rfFilter;renderReferenceHq()}});
    var qs=document.getElementById('rf-project-search');if(qs)qs.oninput=function(){state.rfPortfolioQuery=qs.value;renderReferenceHq()};
    var np=document.getElementById('rf-new-project');if(np)np.onclick=function(){go('projects');setTimeout(function(){var b=document.getElementById('pm-new-project');if(b)b.click()},60)};
    document.querySelectorAll('[data-rf-open]').forEach(function(b){b.onclick=function(){var p=items().find(function(x){return x.scope_key===b.dataset.rfOpen});if(p)openProject(p,'overview')}});
    document.querySelectorAll('[data-rf-row]').forEach(function(r){r.onclick=function(e){if(e.target.closest('button'))return;var p=items().find(function(x){return x.scope_key===r.dataset.rfRow});if(p)selectProjectForHq(p)}});
    document.querySelectorAll('[data-rf-scope].rf-attention-row').forEach(function(b){b.onclick=function(){var p=items().find(function(x){return x.scope_key===b.dataset.rfScope});if(p)openProject(p,nextAction(p,context(p.scope_key),detail(p.scope_key)).tab)}});
    document.querySelectorAll('[data-rf-tab]').forEach(function(b){b.onclick=function(){openProject(items().find(function(x){return x.scope_key===b.dataset.rfScope}),b.dataset.rfTab)}});
    document.querySelectorAll('[data-rf-ai]').forEach(function(b){b.onclick=function(){openAi(b.dataset.rfAi)}});
    var ain=document.getElementById('rf-ai-input'),send=document.getElementById('rf-ai-send'),newc=document.getElementById('rf-ai-new');if(send)send.onclick=function(){openAi(ain&&ain.value)};if(ain)ain.onkeydown=function(e){if(e.key==='Enter')openAi(ain.value)};if(newc)newc.onclick=function(){openAi('')};
    document.querySelectorAll('[data-rf-preview]').forEach(function(b){b.onclick=function(){var href=b.dataset.rfPreview;if(href)location.href=href;else openSelectedTab('preview')}})
  }
  function openAi(question){
    if(window.aurentaraOpenGlobalOperatorAiV1){window.aurentaraOpenGlobalOperatorAiV1();setTimeout(function(){var i=document.getElementById('global-operator-ai-input');if(i&&question)i.value=question},30)}
    else if(window.aurentaraOpenOperatorAiV1)window.aurentaraOpenOperatorAiV1()
  }
  function selectProjectForHq(p){
    if(!p)return;state.selectedScope=p.scope_key;if(p.project_detail_openable===true&&!state.rfHqDetails[p.scope_key]){api('/project-detail/'+encodeURIComponent(p.scope_key)).then(function(d){state.rfHqDetails[p.scope_key]=d;renderReferenceHq()}).catch(function(){renderReferenceHq()})}else renderReferenceHq()
  }
  function openSelectedTab(tab){var p=selected();if(p)openProject(p,tab)}
  function openProject(p,tab){
    if(!p)return;
    if(p.project_detail_openable===true){
      var goWith=function(d){state.selectedScope=p.scope_key;state.detail=d;state.premiumTab=tab||'overview';go('projects');setTimeout(function(){if(typeof window.renderProjectDetail==='function')window.renderProjectDetail(d)},30)};
      var d=detail(p.scope_key);if(d){goWith(d);return}
      api('/project-detail/'+encodeURIComponent(p.scope_key)).then(function(x){state.rfHqDetails[p.scope_key]=x;goWith(x)}).catch(function(e){if(typeof setError==='function')setError(e)})
      return
    }
    if(p.workspace_enabled===true){location.href=p.project_workspace_route||('/operator/workspace/'+encodeURIComponent(p.scope_key||''));return}
    go('projects')
  }
  function renderReferenceHq(){
    arrangeChrome();utility();
    var root=document.getElementById('hq');if(!root)return;
    document.body.classList.toggle('rf-hq-active',state.section==='hq');
    if(state.section!=='hq')return;
    hydrate();
    root.innerHTML='<div class="rf-hq"><div class="rf-hero"><div class="rf-eyebrow">PROJECT FERRARI PREMIUM MASTERDASHBOARD V1</div><h1>Masterdashboard</h1><p>Steuern Sie alle Kunden- und internen Projekte. Transparent. Effizient. Erfolgssicher.</p><div class="rf-motto">EXCELLENCE<br>BUILDS<br>TOMORROW</div></div>'+renderKpis()+'<div class="rf-middle"><div class="rf-panel"><div class="rf-panel-head"><span class="rf-alert-icon">▲</span><div><h2>Attention Center</h2><p>Diese Elemente benötigen Ihre Aufmerksamkeit.</p></div><button class="rf-link push" id="rf-attention-all">Alle anzeigen →</button></div>'+attentionRows()+'</div>'+aiPanel()+'</div><div class="rf-bottom">'+portfolio()+selectedPanel()+'</div></div>';
    bind();
    var aa=document.getElementById('rf-attention-all');if(aa)aa.onclick=function(){if(typeof NAV!=='undefined'&&NAV.some(function(x){return x[0]==='alerts'}))go('alerts');else go('approvals')}
  }
  var previousRender=typeof render==='function'?render:null;
  if(previousRender){render=function(id){previousRender(id);requestAnimationFrame(renderReferenceHq)};window.render=render}
  arrangeChrome();utility();
  requestAnimationFrame(renderReferenceHq);
  setTimeout(renderReferenceHq,250);
  setTimeout(renderReferenceHq,900);
})();
</script>\`;

const ADDON=STYLE+SCRIPT;

export function injectReferenceDrivenHq(html=''){
  if(!html||html.includes('aurentara-ferrari-reference-hq-v1-script'))return html;
  return html.includes('</body>')?html.replace('</body>',ADDON+'</body>'):html+ADDON;
}

export async function applyReferenceDrivenHq(response){
  if(!(response instanceof Response)||response.status!==200||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  const html=await response.text(),headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-ferrari-reference-hq','v1');
  return new Response(injectReferenceDrivenHq(html),{status:response.status,statusText:response.statusText,headers});
}

export function referenceDrivenHqManifest(){
  return {
    schema:'aurentara.project-ferrari.reference-driven-hq.v1',
    reference:'AURENTARA Masterdashboard im Dark-Mode.png',
    reference_dimensions:[1586,992],
    canonical_route:'/operator',
    presentation_only:true,
    existing_runtime_truth_reused:true,
    existing_project_identity_reused:true,
    existing_operator_ai_reused:true,
    existing_preview_contract_reused:true,
    project_detail_openable_respected:true,
    repository_only_project_detail_forbidden:true,
    fake_progress_forbidden:true,
    production_deploy:false,
    external_writes:false,
    duplicate_registry:false,
    duplicate_runtime:false
  };
}
