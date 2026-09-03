function injectHumanAcceptanceUi(html = '') {
  if (!html.includes('aurentara-project-source-storage-v1-ui') || html.includes('aurentara-project-source-human-acceptance-ui-v1')) return html;
  const addon = `<style id="aurentara-project-source-human-acceptance-ui-v1-style">[data-source-local-status]{margin-top:9px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:13px;line-height:1.45}[data-source-local-status][data-state="working"]{font-weight:650}[data-source-local-status][data-state="error"]{border-color:#b42318;background:#fff4f2;color:#8a1c13}[data-source-local-status][data-state="success"]{border-color:#067647;background:#ecfdf3;color:#05603a}</style><script id="aurentara-project-source-human-acceptance-ui-v1">(()=>{const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));const ensureStatus=root=>{let box=root.querySelector('[data-source-local-status]');if(!box){box=document.createElement('div');box.dataset.sourceLocalStatus='true';box.dataset.state='idle';box.hidden=true;const anchor=root.querySelector('[data-source-status]');anchor?.insertAdjacentElement('afterend',box)}return box};const message=(root,state,text)=>{const box=ensureStatus(root);box.hidden=false;box.dataset.state=state;box.innerHTML=esc(text)};const enhance=root=>{if(!root)return;ensureStatus(root);const button=root.querySelector('[data-source-website]');if(!button||button.dataset.humanAcceptancePatched==='true')return;button.dataset.humanAcceptancePatched='true';button.addEventListener('click',async event=>{event.preventDefault();event.stopImmediatePropagation();const input=root.querySelector('[data-source-url]');const sourceUrl=input?.value?.trim();const scope=root.dataset.scope;if(!sourceUrl||!scope)return;const originalText=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Website wird geprüft…';message(root,'working','Website wird geprüft…');try{const response=await fetch('/operator/api/project-source-intake/website',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:scope,source_url:sourceUrl})});const data=await response.json().catch(()=>({}));if(!response.ok){const error=data?.error||('HTTP_'+response.status);const detail=data?.cause?(' · '+data.cause):'';message(root,'error','Website konnte nicht geprüft werden: '+error+detail);if(typeof window.setError==='function')window.setError(Object.assign(new Error(error),{data}));return}input.value='';message(root,'success','Website erfolgreich geprüft und als Project Source übernommen.');setTimeout(()=>window.location.reload(),350)}catch(error){message(root,'error','Website konnte nicht geprüft werden: '+(error?.message||'NETWORK_ERROR'));if(typeof window.setError==='function')window.setError(error)}finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent=originalText}},true)};const scan=()=>document.querySelectorAll('[data-project-source-intake]').forEach(enhance);new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan()})();</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${addon}</body>`) : `${html}${addon}`;
}

export async function applyProjectSourceHumanAcceptanceUi(response) {
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-project-source-human-acceptance-ui', 'v1');
  return new Response(injectHumanAcceptanceUi(html), { status: response.status, statusText: response.statusText, headers });
}

export function projectSourceHumanAcceptanceUiManifest() {
  return {
    schema: 'aurentara.project-source-human-acceptance-ui.v1',
    website_pending_status_local: true,
    website_error_local: true,
    website_success_local: true,
    existing_global_error_retained: true,
    project_sources_area_targeted: true,
    production_deploy: false,
    variable_cost_eur: 0
  };
}
