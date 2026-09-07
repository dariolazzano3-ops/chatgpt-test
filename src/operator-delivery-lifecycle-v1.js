export const J13_OPERATOR_DELIVERY_LIFECYCLE_STYLE = String.raw`<style id="aurentara-j13-delivery-lifecycle-style">
.j13-card{border:1px solid var(--line,#dde0d8);border-radius:14px;padding:13px;background:#fff;margin-bottom:12px}
.j13-flow{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:9px}
.j13-step{border:1px solid var(--line,#dde0d8);border-radius:9px;padding:7px 8px;font-size:10px;text-align:center;background:#fafaf7}
.j13-step.current{font-weight:800;background:#eef2e8}
.j13-state{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:800;background:#f0f1ec}
.j13-state.ready{background:#edf5ef;color:#245b3b}
.j13-state.blocked{background:#faeeee;color:#7c3030}
@media(max-width:760px){.j13-flow{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>`;

export const J13_OPERATOR_DELIVERY_LIFECYCLE_SCRIPT = String.raw`<script id="aurentara-j13-delivery-lifecycle-script">(()=>{if(window.__aurentaraJ13DeliveryLifecycle)return;window.__aurentaraJ13DeliveryLifecycle=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function derive(w){const code=w?.dataset?.j12Action||'',label=w?.querySelector('.pm-next strong')?.textContent?.trim()||'Next Best Action offen';if(code==='READY_FOR_DELIVERY_LIFECYCLE')return{state:'READY_TO_START_CUSTOMER_REVIEW',tone:'ready',reason:'J12 Pre-Delivery-Gates sind vollständig. J13 kann den privaten Customer Review Lifecycle starten.',label};return{state:'PRE_DELIVERY_BLOCKED',tone:'blocked',reason:'J13 bleibt gesperrt, bis J12 READY_FOR_DELIVERY_LIFECYCLE meldet. Aktuell: '+label,label}}
function render(w,panel){const truth=derive(w);let host=panel.querySelector('[data-j13-delivery-lifecycle]');if(!host){host=document.createElement('div');host.dataset.j13DeliveryLifecycle='1';const control=panel.querySelector('[data-j11-control-plane]');if(control)control.prepend(host);else panel.prepend(host)}host.innerHTML='<div class="j13-card"><div class="row"><div><div class="eyebrow">DELIVERY LIFECYCLE · J13</div><strong>Customer Review bis Delivery Package</strong></div><span class="j13-state '+truth.tone+'">'+esc(truth.state)+'</span></div><div class="small" style="margin-top:6px">'+esc(truth.reason)+'</div><div class="j13-flow"><div class="j13-step '+(truth.state==='READY_TO_START_CUSTOMER_REVIEW'?'current':'')+'">Private Preview</div><div class="j13-step">Customer Review</div><div class="j13-step">Revision</div><div class="j13-step">Approval</div><div class="j13-step">Handoff</div><div class="j13-step">Delivery Package</div></div><div class="small" style="margin-top:8px">External Activation bleibt getrennt. Keine automatische Kundenkommunikation, kein Production/Public Deploy.</div></div>';w.dataset.j13State=truth.state}
function decorate(){const w=document.querySelector('.pm-workspace');if(!w)return;const panel=w.querySelector('[data-pm-panel="webfactory"]');if(!panel)return;const j11=panel.querySelector('[data-j11-control-plane]');if(!j11)return;const state=derive(w).state;if(w.dataset.j13RenderedState===state&&panel.querySelector('[data-j13-delivery-lifecycle]'))return;render(w,panel);w.dataset.j13RenderedState=state}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;decorate()},25)};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-j12-action']});document.addEventListener('click',schedule,true);document.addEventListener('aurentara:j12-next-best-action',schedule);schedule();
})();</script>`;

export function injectJ13OperatorDeliveryLifecycle(html='') {
  if (!html || html.includes('aurentara-j13-delivery-lifecycle-script')) return html;
  const addon = J13_OPERATOR_DELIVERY_LIFECYCLE_STYLE + J13_OPERATOR_DELIVERY_LIFECYCLE_SCRIPT;
  return html.includes('</body>') ? html.replace('</body>', addon + '</body>') : html + addon;
}

export function j13OperatorDeliveryLifecycleManifest() {
  return {
    schema: 'aurentara.j13-operator-delivery-lifecycle.v1',
    existing_premium_workspace_reused: true,
    existing_j11_webfactory_tab_reused: true,
    existing_j12_next_best_action_reused: true,
    projected_states: ['PRE_DELIVERY_BLOCKED','READY_TO_START_CUSTOMER_REVIEW'],
    flow: ['PRIVATE_PREVIEW','CUSTOMER_REVIEW','REVISION','APPROVAL','HANDOFF','DELIVERY_PACKAGE'],
    external_activation_separate: true,
    automatic_customer_communication: false,
    automatic_execution: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    external_writes: false
  };
}
