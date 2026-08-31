import { handleOperatorDashboard as handleHumanUxDashboard } from './operator-human-ux-seal-v1.js';

const FINAL_SCRIPT = String.raw`<script id="aurentara-human-ux-final-v1-script">
(() => {
  if (window.__aurentaraHumanUxFinalV1) return;
  window.__aurentaraHumanUxFinalV1 = true;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=v=>Array.isArray(v)?v:[];
  const up=v=>String(v??'').trim().toUpperCase();
  const show=v=>v===null||v===undefined||v===''?'Nicht verifiziert':String(v);
  const kv=(k,v)=>'<div class="human-kv"><b>'+h(k)+'</b><span>'+h(show(v))+'</span></div>';
  const eventTitle=key=>window.aurentaraHumanEventTitleV1?window.aurentaraHumanEventTitleV1(key):String(key||'Event').toLowerCase().split('_').join(' ');
  function humanize(root){if(!root)return;root.querySelectorAll('strong,td').forEach(el=>{const raw=(el.textContent||'').trim();if(el.dataset.humanEvent==='true'||!/^[A-Z][A-Z0-9_]{3,}$/.test(raw)||!raw.includes('_'))return;el.dataset.humanEvent='true';el.innerHTML='<span>'+h(eventTitle(raw))+'</span><div class="human-meta"><code>'+h(raw)+'</code></div>'})}
  function wrapProjectCreate(){const root=document.getElementById('projects');if(!root)return;const form=root.querySelector('[data-project-create]');if(!form||form.closest('.human-create'))return;const d=document.createElement('details');d.className='human-create';d.dataset.humanProjectCreate='true';const s=document.createElement('summary');s.textContent='Neues Projekt anlegen';form.parentNode.insertBefore(d,form);d.append(s,form)}
  function clearStaleProjectPriority(){if(state?.detail)return;document.querySelector('#project-detail [data-human-project-priority]')?.remove()}
  function ensureFactoryProjection(){const base=state?.data?.factories?.items;if(!rows(base).length)return;state.data.functional=state.data.functional||{};const current=state.data.functional.factories||{};if(rows(current.items).length)return;state.data.functional.factories={...(state.data.factories||{}),...current,items:base}}
  function nextAction(p={}){const s=up(p.mission_status||p.status);if(['BLOCKED','FAILED'].includes(s))return'Blocker und letzte Evidence prüfen';if(['COMPLETED','DONE','SUCCESS'].includes(s))return'Keine unmittelbare Aktion erforderlich';if(['ACTIVE','RUNNING'].includes(s))return'Aktuellen Missions- und Freigabestatus prüfen';return'Mission und nächsten verifizierten Schritt prüfen'}
  function humanProjectDetail(d={}){const root=document.getElementById('project-detail');if(!root)return;root.querySelector('[data-human-project-priority]')?.remove();root.querySelector('[data-human-project-delivery]')?.remove();const p=d.project||{},caps=rows(d.capabilities),results=d.results||{};const summary=document.createElement('div');summary.className='card human-section';summary.dataset.humanProjectPriority='true';summary.innerHTML='<div class="human-head"><div><h2>Projekt auf einen Blick</h2><p>Status, aktueller Zustand, Capabilities, Ergebnis und nächste Aktion zuerst.</p></div></div><div class="human-grid">'+kv('Projektstatus',p.mission_status||p.status)+kv('Aktueller Zustand',p.current_state||p.current_phase||p.environment)+kv('Capabilities',caps.length)+kv('Ergebnisse',results.delivery?'Vorhanden':'Noch kein Ergebnis')+kv('Nächste Aktion',nextAction(p))+'</div>';root.prepend(summary);humanize(root);const raw=[...root.querySelectorAll('details')].find(x=>{const t=x.querySelector('summary')?.textContent||'';return t.includes('Unified Delivery')||t.includes('Raw Evidence')});if(raw&&results.delivery){const human=document.createElement('div');human.className='human-summary';human.dataset.humanProjectDelivery='true';const quality=results.quality||{},evidence=results.execution_evidence||{};human.innerHTML='<div class="human-head"><div><h3>Unified Delivery Summary</h3><p>Operator-relevantes Ergebnis vor technischer Evidence.</p></div></div><div class="human-grid">'+kv('Projekt',p.name||p.project_id)+kv('Status',p.mission_status)+kv('Finaler Delivery-Status',results.delivery.final_delivery_status||results.delivery.status)+kv('Qualität',quality.quality_score??quality.status)+kv('Execution Evidence',evidence.mode||evidence.execution_id||'Nicht verifiziert')+kv('Delivery / Result Reference',results.delivery.mission_id||results.delivery.delivery_id||p.project_id)+'</div>';raw.parentNode.insertBefore(human,raw);raw.classList.add('human-raw');const rs=raw.querySelector('summary');if(rs)rs.textContent='Technische Details / Raw Evidence'} }
  function finalPolish(id){if(id==='projects'){wrapProjectCreate();clearStaleProjectPriority()}if(id==='audit')humanize(document.getElementById('audit'));if(state?.detail&&document.getElementById('project-detail')?.children.length)humanProjectDetail(state.detail)}
  if(typeof renderProjects==='function'){const prev=renderProjects;renderProjects=function(){prev();wrapProjectCreate();clearStaleProjectPriority()}}
  if(typeof renderProjectDetail==='function'){const prev=renderProjectDetail;renderProjectDetail=function(d){prev(d);humanProjectDetail(d)}}
  if(typeof renderAudit==='function'){const prev=renderAudit;renderAudit=function(){prev();humanize(document.getElementById('audit'))}}
  if(typeof render==='function'){const prev=render;render=function(id){if(id==='factories')ensureFactoryProjection();prev(id);requestAnimationFrame(()=>finalPolish(id))}}
  requestAnimationFrame(()=>finalPolish(state?.section||'hq'));
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const response = await handleHumanUxDashboard(request, env, ctx, options);
  if (!response) return null;
  const url = new URL(request.url);
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${FINAL_SCRIPT}</body>`) : `${source}${FINAL_SCRIPT}`;
  const headers = new Headers(response.headers);
  headers.set('x-aurentara-human-ux-final', 'accepted-candidate-v1');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorHumanUxFinalManifest() {
  return {
    schema: 'aurentara.operator-human-ux-final.v1',
    presentation_only: true,
    same_control_plane: true,
    direct_project_render_path_sealed: true,
    direct_project_detail_render_path_sealed: true,
    direct_audit_render_path_sealed: true,
    project_delivery_human_summary_first: true,
    raw_evidence_preserved: true,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}