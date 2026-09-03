const CONTEXT_KEY = 'aurentara.operator-context.v1';

export function formatOperatorBerlinTimestamp(value) {
  if (!value) return '–';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}.${parts.month}.${parts.year} · ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}

export function isTransientOperatorNetworkError(error) {
  const message = String(error?.message || error || '');
  return /load failed|failed to fetch|networkerror|network request failed|network.*failed/i.test(message);
}

function requestMethod(input, init = {}) {
  const explicit = String(init?.method || '').trim();
  if (explicit) return explicit.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return String(input.method || 'GET').toUpperCase();
  return 'GET';
}

export async function runBoundedOperatorRead(fetcher, input, init = {}, sleep = () => Promise.resolve()) {
  const method = requestMethod(input, init);
  if (method !== 'GET') return fetcher(input, init);
  try {
    return await fetcher(input, init);
  } catch (error) {
    if (!isTransientOperatorNetworkError(error)) throw error;
    await sleep();
    return fetcher(input, init);
  }
}

const STYLE = String.raw`<style id="aurentara-operator-final-localization-v1-style">
.operator-network-detail{margin-top:5px;font-size:11px;line-height:1.45;opacity:.72;overflow-wrap:anywhere}
.operator-control-code{margin-top:3px;font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);overflow-wrap:anywhere}
.operator-deployment-time{margin-top:3px}
@media(max-width:760px){.operator-network-detail,.operator-control-code{font-size:10.5px}}
</style>`;

const SCRIPT = String.raw`<script id="aurentara-operator-final-localization-v1-script">
(() => {
  if (window.__aurentaraOperatorFinalLocalizationV1) return;
  window.__aurentaraOperatorFinalLocalizationV1 = true;

  const CONTEXT_KEY='aurentara.operator-context.v1';
  const RIGHTS={
    CUSTOMER_ASSERTED:'Vom Kunden bestätigt',
    OWNED_CONFIRMED:'Eigentum bestätigt',
    CUSTOMER_LICENSED:'Vom Kunden lizenziert',
    PUBLIC_REFERENCE_ONLY:'Nur als Referenz',
    UNKNOWN:'Rechte ungeklärt',
    RESTRICTED:'Nutzung eingeschränkt',
    DO_NOT_PUBLISH:'Nicht veröffentlichen'
  };
  const USAGE={PROJECT_VISUAL:'Projektbild',LOGO:'Logo',GALLERY:'Galerie'};
  const EVENTS={
    PROJECT_SOURCE_UPLOAD_RECORDED:'Projektquelle hochgeladen',
    PROJECT_SOURCE_WEBSITE_IMPORTED:'Website-Quelle importiert',
    PROJECT_SOURCE_MANUAL_INPUT_RECORDED:'Manuelle Projektquelle hinzugefügt',
    PROJECT_SOURCE_DISPLAY_NAME_UPDATED:'Name der Projektquelle geändert',
    PROJECT_SOURCE_DELETED:'Projektquelle gelöscht',
    PROJECT_SOURCE_OBJECT_DELETED:'Projektquelle gelöscht',
    PROJECT_SOURCE_PACKS_AND_READINESS_RECORDED:'Quellenbereitschaft aktualisiert',
    CONTROLLED_PAID_STAGING_ACTIVATED:'Kontrolliertes Paid-Staging aktiviert',
    CONTROLLED_PAID_STAGING_DEACTIVATED:'Kontrolliertes Paid-Staging deaktiviert',
    CONTROLLED_PAID_STAGING_BUDGET_UPDATED:'Paid-Staging-Budget aktualisiert',
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
    DELIVERY_COMPLETED:'Auslieferung abgeschlossen'
  };
  const TEXT={
    'Bulk Rights':'Rechte',
    'Usage':'Verwendung',
    'Project Visual':'Projektbild',
    'Gallery':'Galerie',
    'Upload':'Hochladen',
    'Open Activity':'Aktivität öffnen',
    'Quick Jump...':'Schnellzugriff...',
    'Quick Jump…':'Schnellzugriff…',
    'Quick Jump':'Schnellzugriff',
    'Mode':'Modus',
    'Spent':'Ausgegeben',
    'Reserved':'Reserviert',
    'Remaining':'Verfügbar',
    'Paid Provider Calls':'Kostenpflichtige Provider-Aufrufe',
    'Production':'Produktion',
    'External Writes':'Externe Schreibzugriffe',
    'This component may limit or block operator work.':'Diese Komponente kann Operator-Arbeit einschränken oder blockieren.',
    'Control Plane':'Staging-Kontrolle bereit'
  };
  const TECH_CODE='LIVE_STAGING_CONTROL_READY';
  const transient=error=>/load failed|failed to fetch|networkerror|network request failed|network.*failed/i.test(String(error?.message||error||''));
  const berlin=value=>{
    if(!value)return'–';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return'–';
    const parts=Object.fromEntries(new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'short'}).formatToParts(date).map(part=>[part.type,part.value]));
    return parts.day+'.'+parts.month+'.'+parts.year+' · '+parts.hour+':'+parts.minute+' '+parts.timeZoneName;
  };
  window.aurentaraBerlinTimeV1=berlin;
  try{fmtDate=berlin}catch{}

  const methodOf=(input,init={})=>String(init?.method||(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')||'GET').toUpperCase();
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const method=methodOf(input,init);
    if(method!=='GET')return nativeFetch(input,init);
    try{return await nativeFetch(input,init)}catch(error){
      if(!transient(error))throw error;
      await new Promise(resolve=>setTimeout(resolve,180));
      return nativeFetch(input,init);
    }
  };

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const originalSetError=typeof setError==='function'?setError:null;
  if(originalSetError){
    setError=function(error){
      if(error&&transient(error)){
        const host=document.getElementById('error');
        if(host)host.innerHTML='<div class="error"><strong>⚠️ Verbindung fehlgeschlagen. Bitte erneut versuchen.</strong><div class="operator-network-detail">Technisches Detail: '+escapeHtml(error.message||error)+'</div></div>';
        return;
      }
      return originalSetError(error);
    };
    window.setError=setError;
  }

  const readContext=()=>{try{const value=JSON.parse(sessionStorage.getItem(CONTEXT_KEY)||'{}');return{section:String(value.section||''),scope:String(value.scope||'').slice(0,640)}}catch{return{section:'',scope:''}}};
  const saveContext=()=>{try{sessionStorage.setItem(CONTEXT_KEY,JSON.stringify({section:String(state?.section||'hq'),scope:String(state?.selectedScope||'').slice(0,640)}))}catch{}};
  const allowedSection=id=>Array.isArray(NAV)&&NAV.some(item=>item[0]===id);
  const saved=readContext();
  if(saved.section&&allowedSection(saved.section))state.section=saved.section;
  if(saved.scope)state.selectedScope=saved.scope;

  if(typeof go==='function'){
    const priorGo=go;
    go=function(id){const result=priorGo(id);saveContext();return result};
    window.go=go;
  }
  if(typeof openProject==='function'){
    const priorOpenProject=openProject;
    openProject=async function(scope){state.selectedScope=scope;saveContext();const result=await priorOpenProject(scope);saveContext();return result};
    window.openProject=openProject;
  }
  if(typeof loadAll==='function'){
    const priorLoadAll=loadAll;
    loadAll=async function(){
      const before={section:state.section,scope:state.selectedScope};
      saveContext();
      const result=await priorLoadAll();
      if(before.scope)state.selectedScope=before.scope;
      if(before.section&&allowedSection(before.section))state.section=before.section;
      if(typeof go==='function'&&allowedSection(state.section))go(state.section);
      saveContext();
      return result;
    };
    window.loadAll=loadAll;
    const refresh=document.getElementById('refresh');
    if(refresh)refresh.onclick=loadAll;
  }
  addEventListener('pagehide',saveContext);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveContext()});

  const humanEvent=code=>EVENTS[code]||(typeof window.aurentaraHumanEventTitleV1==='function'?window.aurentaraHumanEventTitleV1(code):code);
  const polishEventElement=element=>{
    const raw=String(element.textContent||'').trim();
    if(!/^[A-Z][A-Z0-9_]{3,}$/.test(raw)||!raw.includes('_'))return;
    if(element.closest('code,pre,.human-meta'))return;
    element.dataset.finalHumanEvent='true';
    element.innerHTML='<span>'+escapeHtml(humanEvent(raw))+'</span><div class="human-meta"><code>'+escapeHtml(raw)+'</code></div>';
  };
  const polishExistingEventCode=code=>{
    const raw=String(code.textContent||'').trim();
    const meta=code.closest('.human-meta');
    const parent=meta?.parentElement;
    if(!parent||!raw)return;
    const title=[...parent.children].find(child=>child!==meta&&child.tagName!=='CODE');
    if(title&&EVENTS[raw])title.textContent=EVENTS[raw];
  };
  const localizeSourceForm=root=>{
    const rights=root.querySelector('[data-source-rights]');
    if(rights)rights.querySelectorAll('option').forEach(option=>{const raw=String(option.getAttribute('value')||option.textContent||'').trim();if(!raw)return;option.setAttribute('value',raw);option.value=raw;if(RIGHTS[raw])option.textContent=RIGHTS[raw]});
    const usage=root.querySelector('[data-source-usage]');
    if(usage)usage.querySelectorAll('option').forEach(option=>{const raw=String(option.value||'').trim();if(USAGE[raw])option.textContent=USAGE[raw]});
  };
  const localizeControlPlane=root=>{
    root.querySelectorAll('code,.mono,strong,span,div').forEach(element=>{
      if(element.children.length&&element.tagName!=='DIV')return;
      const raw=String(element.textContent||'').trim();
      if(raw!==TECH_CODE&&!raw.includes(TECH_CODE))return;
      const row=element.closest('.row,.human-card,.overview-panel,.card')||element.parentElement;
      if(!row||row.dataset.controlPlaneHuman==='true')return;
      row.dataset.controlPlaneHuman='true';
      const strong=row.querySelector('strong');
      if(strong)strong.innerHTML='Staging-Kontrolle bereit<div class="operator-control-code">'+TECH_CODE+'</div>';
      else element.innerHTML='Staging-Kontrolle bereit<div class="operator-control-code">'+TECH_CODE+'</div>';
    });
  };
  const translateLeaves=root=>{
    root.querySelectorAll('h1,h2,h3,h4,strong,span,button,th,dt,label,summary,option').forEach(element=>{
      if(element.closest('code,pre')||element.children.length)return;
      const raw=String(element.textContent||'').trim();
      if(TEXT[raw])element.textContent=TEXT[raw];
    });
    root.querySelectorAll('input[placeholder]').forEach(input=>{const raw=input.getAttribute('placeholder');if(TEXT[raw])input.setAttribute('placeholder',TEXT[raw])});
  };
  const localizeIsoTimes=root=>{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let node;
    while((node=walker.nextNode()))nodes.push(node);
    nodes.forEach(textNode=>{
      const parent=textNode.parentElement;
      if(!parent||parent.closest('code,pre,script,style'))return;
      const raw=String(textNode.nodeValue||'');
      const match=raw.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z\b/);
      if(!match)return;
      textNode.nodeValue=raw.replace(match[0],berlin(match[0]));
    });
  };
  const polish=root=>{
    if(!root)return;
    localizeSourceForm(root);
    translateLeaves(root);
    localizeControlPlane(root);
    root.querySelectorAll('strong,td').forEach(polishEventElement);
    root.querySelectorAll('.human-meta code').forEach(polishExistingEventCode);
    localizeIsoTimes(root);
  };
  const observer=new MutationObserver(mutations=>mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===1)polish(node)})));
  observer.observe(document.body,{subtree:true,childList:true});
  polish(document.body);

  const restore=async()=>{
    while(document.body.classList.contains('loading'))await new Promise(resolve=>setTimeout(resolve,25));
    if(saved.section&&allowedSection(saved.section)&&typeof go==='function')go(saved.section);
    if(saved.scope&&state.section==='projects'){
      const project=(state.data?.projects?.items||[]).find(item=>item.scope_key===saved.scope);
      if(project&&(!state.detail||state.detail?.project?.scope_key!==saved.scope)&&typeof openProject==='function')await openProject(saved.scope);
    }
    polish(document.body);
    saveContext();
  };
  void restore();
})();
</script>`;

export async function applyOperatorFinalHumanUxLocalization(response) {
  if (!(response instanceof Response)) return response;
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  if (source.includes('aurentara-operator-final-localization-v1-script')) return new Response(source, response);
  const addon = `${STYLE}${SCRIPT}`;
  const body = source.includes('</body>') ? source.replace('</body>', `${addon}</body>`) : `${source}${addon}`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-final-human-ux-localization', 'v1');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorFinalHumanUxLocalizationManifest() {
  return {
    schema: 'aurentara.operator-final-human-ux-localization.v1',
    locale: 'de-DE',
    time_zone: 'Europe/Berlin',
    persistent_timestamp_storage_unchanged: true,
    activity_event_codes_preserved: true,
    source_enum_values_preserved: true,
    context_storage: CONTEXT_KEY,
    context_storage_scope: 'sessionStorage',
    read_retry_maximum: 1,
    read_retry_transient_network_only: true,
    write_retry_maximum: 0,
    write_methods_retried: false,
    production_deploy: false,
    external_writes: false,
    public_deploy: false,
    dns_change: false,
    billing: false,
    paid_provider_calls: 0,
    additional_variable_cost_eur: 0
  };
}
