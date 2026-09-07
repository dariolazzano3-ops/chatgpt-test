export const J11_OPERATOR_CONTROL_PLANE_STYLE = String.raw`<style id="aurentara-j11-webfactory-control-plane-style">
.j11-control{display:grid;gap:12px}
.j11-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:15px;border:1px solid var(--line,#dde0d8);border-radius:14px;background:linear-gradient(180deg,#fff,#f8f8f4)}
.j11-hero h3{margin:2px 0 5px;font-size:17px}
.j11-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.j11-field{border:1px solid var(--line,#dde0d8);border-radius:12px;background:#fff;padding:11px;min-width:0}
.j11-field .k{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#696d65);margin-bottom:5px}
.j11-field .v{display:block;font-size:14px;font-weight:750;overflow-wrap:anywhere}
.j11-field .s{display:block;margin-top:5px;font-size:10px;color:var(--muted,#696d65)}
.j11-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.j11-action{display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid var(--line,#dde0d8);border-radius:11px;background:#fff;padding:9px 10px;text-align:left;min-height:54px;cursor:pointer}
.j11-action[disabled]{cursor:not-allowed;opacity:.6}
.j11-action b{display:block;font-size:12px}
.j11-action small{display:block;color:var(--muted,#696d65);font-size:10px;margin-top:2px}
.j11-pill{white-space:nowrap;border-radius:999px;padding:3px 6px;font-size:9px;font-weight:800;background:#eef0ea}
.j11-pill.available{background:#edf5ef;color:#245b3b}
.j11-pill.review_required{background:#faf4e5;color:#785b17}
.j11-pill.blocked{background:#faeeee;color:#7c3030}
.j11-pill.not_verified{background:#f0f1ec;color:#696d65}
.j11-status{padding:9px 11px;border-radius:10px;background:#f3f4ef;border:1px solid var(--line,#dde0d8);font-size:11px}
.j11-tech summary{cursor:pointer;font-weight:700}
.j11-tech pre{max-height:420px;overflow:auto}
@media(max-width:1100px){.j11-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.j11-hero{display:block}.j11-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.j11-actions{grid-template-columns:1fr}.j11-action{min-height:50px}}
@media(max-width:360px){.j11-grid{grid-template-columns:1fr}}
</style>`;

export const J11_OPERATOR_CONTROL_PLANE_SCRIPT = String.raw`<script id="aurentara-j11-webfactory-control-plane-script">(()=>{if(window.__aurentaraJ11ControlPlane)return;window.__aurentaraJ11ControlPlane=true;
const C=new Map(),E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),U=v=>String(v??'').trim().toUpperCase(),N=v=>Number.isFinite(Number(v))?Number(v):null;
const A=['SKETCH','REFERENCE','VARIANT','APPROVAL','BUILD','VISUAL_QA','DELTA_CLOSURE','REBUILD','PREVIEW','CHANGES','DELIVERY'];
const AL={SKETCH:'Sketch',REFERENCE:'Reference',VARIANT:'Variant',APPROVAL:'Approval',BUILD:'Build',VISUAL_QA:'Visual QA',DELTA_CLOSURE:'Delta Closure',REBUILD:'Rebuild',PREVIEW:'Preview',CHANGES:'Changes',DELIVERY:'Delivery'};
const TARGET={SKETCH:'implementation',REFERENCE:'implementation',VARIANT:'implementation',APPROVAL:'approvals',BUILD:'implementation',VISUAL_QA:'implementation',DELTA_CLOSURE:'implementation',REBUILD:'implementation',PREVIEW:'preview',CHANGES:'activity',DELIVERY:'approvals'};
function normStatus(v){const s=U(v);return s||'NOT_VERIFIED'}
function fmtCost(v){const n=N(v);return n==null?'NOT_VERIFIED':new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:4}).format(n)}
function refTruth(d){const r=d.reference||d.results?.reference||d.project?.reference||{};const status=normStatus(r.status||r.state||d.reference_status),version=String(r.version||r.reference_version||d.reference_version||'').trim();return{status,version,approved:status==='APPROVED'||r.approved===true}}
function visualTruth(d){const v=d.visual||d.results?.visual||d.visual_acceptance||{};const score=N(v.score??v.visual_score??d.visual_score),status=normStatus(v.status||v.acceptance||(score!=null?'MEASURED':''));return{score,status}}
function buildTruth(d){const b=d.build||d.results?.build||{},q=d.qa||d.results?.quality||{},id=String(b.build_id||b.id||d.results?.delivery?.build_id||'').trim(),profile=String(d.build_profile||b.profile||b.build_profile||d.project?.build_profile||d.project?.quality_level||'').trim(),qa=normStatus(q.status||q.qa_status||(q.passed===true?'PASS':q.passed===false?'FAIL':'')),accepted=['PASS','ACCEPTED','KNOWN_GOOD'].includes(qa)||b.accepted===true;return{id,profile,qa,accepted}}
function previewTruth(d){const p=d.project_preview_access||d.project?.project_preview_access||d.preview||{},available=p.available===true||Boolean(p.url||p.preview_url||p.route||p.open_url),url=String(p.url||p.preview_url||p.route||p.open_url||'').trim();return{available,url,status:normStatus(p.status||(available?'AVAILABLE':'NOT_AVAILABLE'))}}
function deliveryTruth(d){const x=d.delivery||d.results?.delivery||{},status=normStatus(x.status||x.state||(x.ready===true?'READY':''));return{status,ready:x.ready===true||['READY','PASS','ACCEPTED','DELIVERY_READY'].includes(status)}}
function j9Truth(d){const j=d.j9||d.browser_accessibility_performance||{},p=j.performance||d.performance||{},a=j.accessibility||d.accessibility||{},ps=N(p.lighthouse?.performance??p.score??p.performance),pst=normStatus(p.status||p.lighthouse?.status||(ps!=null?'MEASURED':'')),ast=normStatus(a.state||a.status);return{p:{score:ps,status:pst},a:{status:ast,critical:N(a.axe?.critical),serious:N(a.axe?.serious)}}}
function project(d,s){const p=d.project||{},k=s?.workspace?.knowledge_review||{},kr=String(k.current_knowledge_revision||k.revision||'').trim(),ks=normStatus(k.status),r=refTruth(d),v=visualTruth(d),b=buildTruth(d),pv=previewTruth(d),del=deliveryTruth(d),j9=j9Truth(d),cost=N(p.current_cost_eur??p.variable_cost_eur??p.budget_cost_units),knowledgeReady=['APPROVED','READY'].includes(ks)&&Boolean(kr),visualAccepted=['PASS','ACCEPTED'].includes(v.status),j9Pass=['PASS','FULL_ACCEPTED','AUTOMATED_PASS','HUMAN_REVIEW_PENDING'].includes(j9.a.status)&&['PASS','MEASURED'].includes(j9.p.status);
const fields=[
['Build Profile',b.profile||'NOT_VERIFIED',b.profile?'VERIFIED':'NOT_VERIFIED'],
['Jaguar Version','J11 Control Plane','VERIFIED_SYSTEM_VERSION'],
['Knowledge Revision',kr||'NOT_VERIFIED',kr?ks:'NOT_VERIFIED'],
['Reference',r.version?(r.status+' · '+r.version):r.status,r.status],
['Visual Score',v.score==null?'NOT_VERIFIED':String(v.score),v.status],
['Build / QA',b.id?(b.qa+' · '+b.id):b.qa,b.qa],
['Performance',j9.p.score==null?'NOT_VERIFIED':Math.round(j9.p.score*100)+' %',j9.p.status],
['Accessibility',j9.a.status,j9.a.status],
['Preview',pv.available?(pv.url||'AVAILABLE'):pv.status,pv.status],
['Cost',fmtCost(cost),cost==null?'NOT_VERIFIED':'MEASURED'],
['Delivery State',del.status,del.status]
];
const action=(id,state,reason)=>({id,state,reason,target:TARGET[id]});
const actions=[
action('SKETCH',p.scope_key?'AVAILABLE':'BLOCKED',p.scope_key?'Project scope available.':'Project scope required.'),
action('REFERENCE',knowledgeReady?(r.approved?'AVAILABLE':'REVIEW_REQUIRED'):'BLOCKED',knowledgeReady?(r.approved?'Approved reference available.':'Reference approval required.'):'Approved Knowledge revision required.'),
action('VARIANT',r.approved?'AVAILABLE':'BLOCKED',r.approved?'Approved reference can seed variants.':'Approved Reference required.'),
action('APPROVAL',r.approved?'AVAILABLE':knowledgeReady?'REVIEW_REQUIRED':'BLOCKED',r.approved?'Approval Hub available.':knowledgeReady?'Reference approval required.':'Knowledge is not ready.'),
action('BUILD',knowledgeReady&&r.approved?'AVAILABLE':'BLOCKED',knowledgeReady&&r.approved?'Knowledge and Reference gates ready.':'Approved Knowledge + Approved Reference required.'),
action('VISUAL_QA',b.accepted&&r.approved?'AVAILABLE':'BLOCKED',b.accepted&&r.approved?'Accepted build + Approved Reference available.':'Accepted build + Approved Reference required.'),
action('DELTA_CLOSURE',b.accepted&&r.approved?'AVAILABLE':'BLOCKED',b.accepted&&r.approved?'Visual closure can run or revalidate.':'Accepted build + Approved Reference required.'),
action('REBUILD','NOT_VERIFIED','J10 change-impact decision not exposed in current project payload.'),
action('PREVIEW',pv.available?'AVAILABLE':b.accepted?'REVIEW_REQUIRED':'BLOCKED',pv.available?'Private preview available.':b.accepted?'Preview materialization pending.':'Accepted build required.'),
action('CHANGES',p.scope_key?'AVAILABLE':'BLOCKED',p.scope_key?'Change request can be prepared against this project.':'Project scope required.'),
action('DELIVERY',del.ready&&visualAccepted&&j9Pass&&pv.available?'AVAILABLE':'BLOCKED',del.ready&&visualAccepted&&j9Pass&&pv.available?'Delivery prerequisites evidence-backed.':'Delivery requires Delivery Ready + Visual Acceptance + J9 + Preview.')
];
return{p,k,r,v,b,pv,del,j9,cost,fields,actions,notVerified:fields.filter(x=>x[2]==='NOT_VERIFIED').map(x=>x[0])}}
async function load(scope){if(C.has(scope))return C.get(scope);const promise=(async()=>{const [dr,sr]=await Promise.all([fetch('/operator/api/project-detail/'+encodeURIComponent(scope),{cache:'no-store'}),fetch('/operator/api/project-source-intake?scope_key='+encodeURIComponent(scope),{cache:'no-store'}).catch(()=>null)]);if(!dr.ok)throw new Error('J11_PROJECT_DETAIL_'+dr.status);const d=await dr.json(),s=sr&&sr.ok?await sr.json():{};return{d,s}})();C.set(scope,promise);try{return await promise}catch(e){C.delete(scope);throw e}}
function activate(name){const b=document.querySelector('.pm-workspace [data-pm-tab="'+name+'"]');if(b&&name!=='webfactory'){b.click();return true}return false}
function render(panel,payload){const t=project(payload.d,payload.s),scope=t.p.scope_key||panel.closest('.pm-workspace')?.dataset.scope||'',fields=t.fields.map((x,i)=>'<div class="j11-field" data-j11-field="'+E(String(i))+'"><span class="k">'+E(x[0])+'</span><span class="v">'+E(x[1])+'</span><span class="s">'+E(x[2])+'</span></div>').join(''),actions=t.actions.map(x=>'<button class="j11-action" data-j11-action="'+E(x.id)+'" data-target="'+E(x.target)+'" data-state="'+E(x.state)+'" '+(x.state==='BLOCKED'?'disabled':'')+'><span><b>'+E(AL[x.id]||x.id)+'</b><small>'+E(x.reason)+'</small></span><span class="j11-pill '+E(x.state.toLowerCase())+'">'+E(x.state)+'</span></button>').join('');
panel.innerHTML='<div class="j11-control" data-j11-control-plane data-scope="'+E(scope)+'"><div class="j11-hero"><div><div class="eyebrow">PROJECT JAGUAR · WEBFACTORY CONTROL PLANE</div><h3>WebFactory</h3><div class="small">Project Truth, Knowledge, Reference, J9, J10, Preview und Delivery in einer Operator-Sicht. Fehlende Evidence bleibt NOT_VERIFIED.</div></div><span class="badge ready">J11</span></div><div class="j11-grid">'+fields+'</div><div class="pm-card"><h3>Operator Actions</h3><div class="j11-actions">'+actions+'</div><div class="j11-status" data-j11-status style="margin-top:10px">Keine automatische Ausführung. Aktionen bleiben Operator-initiiert und Production/Public/DNS/Billing bleiben gesperrt.</div></div><details class="pm-card j11-tech"><summary>Technische Details</summary><pre>'+E(JSON.stringify({project:t.p,knowledge:t.k,reference:t.r,visual:t.v,build:t.b,j9:t.j9,preview:t.pv,delivery:t.del,not_verified_fields:t.notVerified,safety:{automatic_execution:false,automatic_merge:false,production_deploy:false,public_launch:false,dns_change:false,billing:false,external_writes:false}},null,2))+'</pre></details></div>';
panel.querySelectorAll('[data-j11-action]').forEach(b=>b.onclick=()=>{const state=b.dataset.state,id=b.dataset.j11Action,status=panel.querySelector('[data-j11-status]');if(state==='BLOCKED'){if(status)status.textContent=(b.querySelector('small')?.textContent||'Aktion blockiert.');return}document.dispatchEvent(new CustomEvent('aurentara:webfactory-control-action',{detail:{scope,action:id,state,automatic_execution:false}}));const moved=activate(b.dataset.target);if(status)status.textContent=(state==='REVIEW_REQUIRED'?'Review geöffnet. ':'Aktion vorbereitet. ')+(moved?'Bestehender Workspace-Bereich geöffnet. ':'')+'Keine automatische Ausführung gestartet.'})}
async function decorate(){const w=document.querySelector('.pm-workspace');if(!w)return;const scope=w.dataset.scope||'';if(!scope)return;const tabs=w.querySelector('.pm-tabs');if(!tabs)return;let tab=tabs.querySelector('[data-pm-tab="webfactory"]');if(!tab){tab=document.createElement('button');tab.className='pm-tab';tab.dataset.pmTab='webfactory';tab.textContent='WebFactory';tabs.appendChild(tab)}let panel=w.querySelector('[data-pm-panel="webfactory"]');if(!panel){panel=document.createElement('div');panel.className='pm-panel';panel.dataset.pmPanel='webfactory';panel.innerHTML='<div class="pm-card"><div class="empty">WebFactory Control Plane wird geladen…</div></div>';const legacy=w.querySelector('#project-detail');if(legacy)w.insertBefore(panel,legacy);else w.appendChild(panel)}if(!tab.dataset.j11Bound){tab.dataset.j11Bound='1';tab.onclick=()=>{w.dataset.j11Active='1';let tries=0;const hold=()=>{if(w.dataset.j11Active!=='1')return;w.querySelectorAll('[data-pm-tab]').forEach(x=>x.classList.toggle('active',x===tab));w.querySelectorAll('[data-pm-panel]').forEach(x=>x.classList.toggle('active',x===panel));tries+=1;if(tries<22)setTimeout(hold,100)};hold();if(!panel.dataset.j11Loaded){panel.dataset.j11Loaded='loading';load(scope).then(x=>{render(panel,x);panel.dataset.j11Loaded='1'}).catch(e=>{panel.innerHTML='<div class="pm-card"><div class="error">J11 Evidence konnte nicht geladen werden: '+E(e.message)+'</div></div>';panel.dataset.j11Loaded='error'})}}}if(!panel.dataset.j11Prefetch){panel.dataset.j11Prefetch='1';load(scope).then(x=>{if(panel.dataset.j11Loaded!=='1'){render(panel,x);panel.dataset.j11Loaded='1'}}).catch(()=>{})}}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;decorate()})};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',e=>{const b=e.target.closest?.('.pm-tab');if(b&&b.dataset.pmTab!=='webfactory'){const w=b.closest('.pm-workspace');if(w)w.dataset.j11Active='0'}schedule()},true);schedule();
})();</script>`;

export function injectJ11OperatorControlPlane(html='') {
  if (!html || html.includes('aurentara-j11-webfactory-control-plane-script')) return html;
  const addon = J11_OPERATOR_CONTROL_PLANE_STYLE + J11_OPERATOR_CONTROL_PLANE_SCRIPT;
  return html.includes('</body>') ? html.replace('</body>', addon + '</body>') : html + addon;
}

export function j11OperatorControlPlaneManifest() {
  return {
    schema: 'aurentara.j11-operator-webfactory-control-plane.v1',
    existing_premium_masterdashboard_reused: true,
    existing_project_detail_api_reused: true,
    existing_project_source_intake_api_reused: true,
    new_workspace_tab: 'WebFactory',
    fields: [
      'Build Profile',
      'Jaguar Version',
      'Knowledge Revision',
      'Reference',
      'Visual Score',
      'Build / QA',
      'Performance',
      'Accessibility',
      'Preview',
      'Cost',
      'Delivery State'
    ],
    actions: [
      'Sketch',
      'Reference',
      'Variant',
      'Approval',
      'Build',
      'Visual QA',
      'Delta Closure',
      'Rebuild',
      'Preview',
      'Changes',
      'Delivery'
    ],
    technical_detail_drawer: true,
    missing_evidence_stays_not_verified: true,
    automatic_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    external_writes: false
  };
}
