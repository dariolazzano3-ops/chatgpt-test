export const J12_OPERATOR_NEXT_BEST_ACTION_STYLE = String.raw`<style id="aurentara-j12-next-best-action-style">
.j12-next{border:1px solid var(--line,#dde0d8);border-radius:14px;padding:13px;background:linear-gradient(180deg,#fff,#f8f8f4);display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.j12-next-copy{min-width:0}
.j12-next .eyebrow{margin-bottom:4px}
.j12-next strong{display:block;font-size:15px;overflow-wrap:anywhere}
.j12-next .small{margin-top:3px}
.j12-next button{white-space:nowrap}
.j12-secondary-details{margin-top:10px;border-top:1px solid var(--line,#dde0d8);padding-top:9px}
.j12-secondary-details summary{cursor:pointer;font-size:11px;font-weight:750;color:var(--muted,#696d65)}
.j12-secondary-details[open] summary{margin-bottom:8px}
.pm-next[data-j12-ready="1"] .small:first-child::after{content:" · J12"}
@media(max-width:620px){.j12-next{display:block}.j12-next button{width:100%;margin-top:9px}}
</style>`;

export const J12_OPERATOR_NEXT_BEST_ACTION_SCRIPT = String.raw`<script id="aurentara-j12-next-best-action-script">(()=>{if(window.__aurentaraJ12NextBestAction)return;window.__aurentaraJ12NextBestAction=true;
const cache=new Map(),esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),U=v=>String(v??'').trim().toUpperCase(),N=v=>Number.isFinite(Number(v))?Number(v):0,A=v=>Array.isArray(v)?v:[];
function ktruth(s={}){const k=s?.workspace?.knowledge_review||{},facts=A(s?.workspace?.sections?.project_knowledge),status=U(k.status)||'NOT_VERIFIED',revision=String(k.current_knowledge_revision||k.revision||'').trim(),unresolved=Math.max(N(k.catch_net?.unresolved_count),N(k.conflict_count),N(s?.workspace?.conflict_count),facts.filter(f=>['UNVERIFIED','NEEDS_REVIEW','SOURCE_CONFLICT','AMBIGUOUS'].includes(U(f.verification_status))).length);return{status,revision,unresolved,approved:status==='APPROVED'&&Boolean(revision)}}
function humans(s={}){const h=s.human_input_closure||{},open=A(h.open_inputs),count=Math.max(N(h.open_input_count),open.length),contact=open.filter(x=>{const z=U((x.id||x.input_id||x.field||x.code||'')+' '+(x.question||x.label||x.reason||''));return['CONTACT','KONTAKT','PHONE','TELEFON','EMAIL','E-MAIL','ADDRESS','ADRESSE'].some(t=>z.includes(t))});return{open,count,contact}}
function rtruth(d={}){const r=d.reference||d.results?.reference||d.project?.reference||{},status=U(r.status||r.state||d.reference_status)||'NOT_VERIFIED',version=String(r.version||r.reference_version||d.reference_version||'').trim(),exists=Boolean(version||r.reference_id||r.id||!['NOT_VERIFIED','MISSING','NONE'].includes(status));return{status,version,exists,approved:status==='APPROVED'||r.approved===true}}
function btruth(d={}){const b=d.build||d.results?.build||{},q=d.qa||d.results?.quality||{},id=String(b.build_id||b.id||d.results?.delivery?.build_id||'').trim(),qa=U(q.status||q.qa_status||(q.passed===true?'PASS':q.passed===false?'FAIL':''))||'NOT_VERIFIED';return{id,qa,accepted:b.accepted===true||['PASS','ACCEPTED','KNOWN_GOOD'].includes(qa)}}
function vtruth(d={}){const v=d.visual||d.results?.visual||d.visual_acceptance||{},status=U(v.status||v.acceptance||d.visual_status)||'NOT_VERIFIED',delta=Math.max(N(v.delta_count),N(v.open_delta_count),A(v.deltas).filter(x=>!['PASS','CLOSED','ACCEPTED'].includes(U(x.status))).length);return{status,delta,accepted:['PASS','ACCEPTED'].includes(status)&&delta===0}}
function j9truth(d={}){const j=d.j9||d.browser_accessibility_performance||{},browser=U(j.browser?.status)||'NOT_VERIFIED',perf=U(j.performance?.status||j.performance?.lighthouse?.status)||'NOT_VERIFIED',a11y=U(j.accessibility?.state||j.accessibility?.status)||'NOT_VERIFIED',pass=(browser==='PASS'||browser==='NOT_VERIFIED')&&perf==='PASS'&&['PASS','AUTOMATED_PASS','HUMAN_REVIEW_PENDING','FULL_ACCEPTED'].includes(a11y);return{browser,perf,a11y,pass}}
function ptruth(d={}){const p=d.project_preview_access||d.project?.project_preview_access||d.preview||{},available=p.available===true||Boolean(p.url||p.preview_url||p.route||p.open_url),review=U(p.review_status||p.human_review_status||d.preview_review_status)||'NOT_VERIFIED',reviewed=['PASS','APPROVED','ACCEPTED','REVIEWED'].includes(review)||p.reviewed===true;return{available,review,reviewed}}
function atruth(d={}){const a=d.website_approval||d.approval||{},status=U(a.status||a.state||d.website_approval_status)||'NOT_VERIFIED';return{status,approved:['APPROVED','ACCEPTED','PASS'].includes(status)||a.approved===true}}
function derive(d={},s={}){const k=ktruth(s),h=humans(s),r=rtruth(d),b=btruth(d),v=vtruth(d),j=j9truth(d),p=ptruth(d),a=atruth(d),x=(code,label,target,reason,priority)=>({code,label,target,reason,priority});
if(k.unresolved>0)return x('REVIEW_PROJECT_KNOWLEDGE',String(k.unresolved)+' Angaben prüfen','knowledge','Projektwissen enthält offene oder widersprüchliche Angaben.',10);
if(h.contact.length>0)return x('CONFIRM_CONTACT_DETAILS',h.contact.length>1?String(h.contact.length)+' Kontaktdaten bestätigen':'Kontaktdaten bestätigen','approvals','Offene Kontaktdaten können Inhalt oder Conversion beeinflussen.',20);
if(h.count>0)return x('REVIEW_PROJECT_KNOWLEDGE',String(h.count)+' Kundenangabe'+(h.count===1?'':'n')+' prüfen','approvals','Menschliche Projektangaben sind noch offen.',30);
if(!k.approved&&['STAGED','IN_REVIEW','CHANGES_PENDING','READY'].includes(k.status))return x('APPROVE_PROJECT_KNOWLEDGE','Projektwissen bereitstellen','knowledge','Projektwissen ist vorbereitet, aber noch nicht als Revision freigegeben.',40);
if(k.approved&&!r.exists)return x('CREATE_REFERENCE','Reference erstellen','webfactory','Freigegebenes Projektwissen liegt vor, eine Reference fehlt.',50);
if(k.approved&&r.exists&&!r.approved)return x('APPROVE_REFERENCE','Reference freigeben','webfactory','Eine Reference existiert, ist aber noch nicht freigegeben.',60);
if(k.approved&&r.approved&&!b.accepted)return x('BUILD_WEBSITE','Website bauen','webfactory','Knowledge und Reference sind freigegeben, ein akzeptierter Build fehlt.',70);
if(b.accepted&&r.approved&&!v.accepted)return x('CLOSE_VISUAL_DELTA',v.delta>0?String(v.delta)+' Visual Deltas schließen':'Visual Delta schließen','webfactory','Der Build existiert, Visual Closure ist noch offen.',80);
if(v.accepted&&!j.pass)return x('RUN_BROWSER_QUALITY','Browser-Qualität prüfen','webfactory','Visual Closure ist akzeptiert, J9 ist noch nicht vollständig grün.',90);
if(v.accepted&&j.pass&&(!p.available||!p.reviewed))return x('CHECK_PREVIEW',p.available?'Preview prüfen':'Preview bereitstellen und prüfen','preview','Technische Gates sind grün, die Preview-Prüfung ist noch offen.',100);
if(v.accepted&&j.pass&&p.available&&p.reviewed&&!a.approved)return x('APPROVE_WEBSITE','Website freigeben','approvals','Preview ist geprüft, finale Website-Freigabe fehlt.',110);
if(k.approved&&r.approved&&b.accepted&&v.accepted&&j.pass&&p.available&&p.reviewed&&a.approved)return x('READY_FOR_DELIVERY_LIFECYCLE','Bereit für Delivery Lifecycle','webfactory','Alle J12 Pre-Delivery-Gates sind erfüllt.',120);
return x('REVIEW_PROJECT_KNOWLEDGE','Projektwissen prüfen','knowledge','Aus der aktuellen Evidence ist noch keine spätere Aktion belastbar ableitbar.',999)}
async function load(scope){if(cache.has(scope))return cache.get(scope);const p=(async()=>{const [dr,sr]=await Promise.all([fetch('/operator/api/project-detail/'+encodeURIComponent(scope),{cache:'no-store'}),fetch('/operator/api/project-source-intake?scope_key='+encodeURIComponent(scope),{cache:'no-store'}).catch(()=>null)]);if(!dr.ok)throw new Error('J12_PROJECT_DETAIL_'+dr.status);return{d:await dr.json(),s:sr&&sr.ok?await sr.json():{}}})();cache.set(scope,p);try{return await p}catch(e){cache.delete(scope);throw e}}
function go(target){const w=document.querySelector('.pm-workspace');if(!w)return false;const b=w.querySelector('[data-pm-tab="'+target+'"]');if(b){b.click();return true}return false}
function collapseSecondary(panel){if(!panel)return;const actions=panel.querySelector('.j11-actions');if(!actions||actions.closest('.j12-secondary-details'))return;const details=document.createElement('details');details.className='j12-secondary-details';details.innerHTML='<summary>Weitere WebFactory Aktionen</summary>';actions.parentNode.insertBefore(details,actions);details.appendChild(actions)}
function apply(scope,payload){const a=derive(payload.d,payload.s),w=document.querySelector('.pm-workspace[data-scope="'+CSS.escape(scope)+'"]');if(!w)return;w.dataset.j12Action=a.code;const top=w.querySelector('.pm-next');if(top){top.dataset.j12Ready='1';const label=top.querySelector('[data-pm-next-label]')||top.querySelector('strong'),button=top.querySelector('[data-pm-jump]')||top.querySelector('button');if(label)label.textContent=a.label;if(button){button.textContent='Jetzt öffnen';button.dataset.j12Target=a.target;button.onclick=()=>go(a.target)}}const wf=w.querySelector('[data-pm-panel="webfactory"]');if(wf){collapseSecondary(wf);let card=wf.querySelector('[data-j12-next-best-action]');if(!card){card=document.createElement('div');card.dataset.j12NextBestAction='1';const host=wf.querySelector('[data-j11-control-plane]');if(host)host.prepend(card);else wf.prepend(card)}card.innerHTML='<div class="j12-next"><div class="j12-next-copy"><div class="eyebrow">NEXT BEST ACTION · J12</div><strong>'+esc(a.label)+'</strong><div class="small">'+esc(a.reason)+'</div><div class="small">Die einzige Primäraktion bleibt oben im Project Workspace.</div></div></div>'}document.dispatchEvent(new CustomEvent('aurentara:j12-next-best-action',{detail:{scope,action:a.code,target:a.target,priority:a.priority,automatic_execution:false}}))}
async function decorate(){const w=document.querySelector('.pm-workspace'),scope=w?.dataset.scope;if(!w||!scope)return;if(w.dataset.j12Loading===scope)return;w.dataset.j12Loading=scope;try{apply(scope,await load(scope))}catch(e){w.dataset.j12Error=e.message}}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;decorate()},20)};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',schedule,true);schedule();
})();</script>`;

export function injectJ12OperatorNextBestAction(html='') {
  if (!html || html.includes('aurentara-j12-next-best-action-script')) return html;
  const addon = J12_OPERATOR_NEXT_BEST_ACTION_STYLE + J12_OPERATOR_NEXT_BEST_ACTION_SCRIPT;
  return html.includes('</body>') ? html.replace('</body>', addon + '</body>') : html + addon;
}

export function j12OperatorNextBestActionManifest() {
  return {
    schema: 'aurentara.j12-operator-next-best-action.v1',
    existing_premium_workspace_reused: true,
    existing_j11_webfactory_tab_reused: true,
    existing_project_detail_api_reused: true,
    existing_project_source_intake_api_reused: true,
    exactly_one_primary_action: true,
    primary_surface: 'PROJECT_WORKSPACE_HEADER',
    secondary_webfactory_actions_collapsed_by_default: true,
    targets: ['knowledge','approvals','webfactory','preview'],
    network_writes_on_primary_action: 0,
    automatic_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    external_writes: false
  };
}
