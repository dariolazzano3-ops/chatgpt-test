const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

export const AURENTARA_WEBSITE_SCOPE = 'aurentara-systems-internal:riosystems-public-website-v1';
export const AURENTARA_WEBSITE_SLUG = 'riosystems-public-website-v1';
export const AURENTARA_ACCEPTED_RC_SHA = '9876feccfbcb7f87577a9d9a26ac2066412bc7a7';
export const AURENTARA_REGISTERED_CANONICAL_SHA = 'da71c5f3ab5822bd0bacb87ce5c2f669bf5dfb54';
export const AURENTARA_WORKING_BRANCH = 'factory/operator-project-workspace-v1';

const RESPONSIVE_MODES = Object.freeze([
  { id: 'desktop-1440', label: 'Desktop 1440', width: 1440, height: 900, family: 'Desktop' },
  { id: 'desktop-1200', label: 'Desktop 1200', width: 1200, height: 900, family: 'Desktop' },
  { id: 'tablet-1024', label: 'Tablet 1024', width: 1024, height: 900, family: 'Tablet' },
  { id: 'tablet-768', label: 'Tablet 768', width: 768, height: 900, family: 'Tablet' },
  { id: 'mobile-430', label: 'Mobile 430', width: 430, height: 900, family: 'Mobile' },
  { id: 'mobile-390', label: 'Mobile 390', width: 390, height: 844, family: 'Mobile' },
  { id: 'mobile-375', label: 'Mobile 375', width: 375, height: 812, family: 'Mobile' },
  { id: 'mobile-320', label: 'Mobile 320', width: 320, height: 760, family: 'Mobile' }
]);

const QA_CHECKS = Object.freeze([
  ['responsive_qa', 'Responsive QA', 'PASS'],
  ['desktop_qa', 'Desktop QA', 'PASS'],
  ['mobile_qa', 'Mobile QA', 'PASS'],
  ['accessibility', 'Accessibility', 'PASS'],
  ['console_errors', 'Console Errors', 'PASS'],
  ['horizontal_overflow', 'Horizontal Overflow', 'PASS'],
  ['navigation', 'Navigation', 'PASS'],
  ['hamyren_regression', 'HAMYREN Regression', 'PASS'],
  ['general_ci', 'General CI', 'PASS'],
  ['preview_deploy', 'Preview Deploy', 'NOT_VERIFIED']
].map(([id, label, status]) => ({ id, label, status })));

export function createAurentaraPublicWebsitePortfolioEntry() {
  return {
    customer_id: 'aurentara-systems-internal',
    project_id: AURENTARA_WEBSITE_SLUG,
    scope_key: AURENTARA_WEBSITE_SCOPE,
    name: 'AURENTARA SYSTEMS Public Website V1',
    type: 'PUBLIC_WEBSITE',
    industry: 'business-systems',
    country: 'DE',
    language: 'de',
    state: 'ACTIVE',
    blocked: false,
    priority: 1,
    budget_cost_units: 0,
    capability_count: 1,
    mission_count: 0,
    delivery_count: 0,
    workspace_enabled: true,
    environment: 'staging',
    data_mode: 'synthetic_only',
    repo: 'dariolazzano3-ops/chatgpt-test',
    canonical_branch: 'factory-control',
    accepted_rc_sha: AURENTARA_ACCEPTED_RC_SHA,
    working_branch: AURENTARA_WORKING_BRANCH,
    production_deploy: false
  };
}

export function isAurentaraPublicWebsiteProject(project = {}) {
  return project.project_id === AURENTARA_WEBSITE_SLUG || project.scope_key === AURENTARA_WEBSITE_SCOPE;
}

function containsAny(text, values = []) {
  return values.some((value) => text.includes(value));
}

function addType(types, type) {
  if (!types.includes(type)) types.push(type);
}

export function classifyOperatorProjectChange(input = {}) {
  const requestedChange = clean(input.requested_change || input.change || input.mission_text, 4000);
  if (!requestedChange) return { ok: false, error: 'WORKSPACE_CHANGE_REQUEST_REQUIRED', production_deploy: false };
  const text = requestedChange.toLowerCase();
  const types = [];

  if (containsAny(text, ['text', 'copy', 'headline', 'überschrift', 'wort', 'formulierung', 'cta', 'beschriftung'])) addType(types, 'COPY');
  if (containsAny(text, ['hero', 'abstand', 'spacing', 'farbe', 'layout', 'sektion', 'section', 'ruhiger', 'visuell', 'design', 'hochwertig'])) addType(types, 'VISUAL');
  if (containsAny(text, ['mobile', 'tablet', 'responsive', 'breakpoint', '320', '375', '390', '430', '768', '1024', '1440'])) addType(types, 'RESPONSIVE');
  if (containsAny(text, ['navigation', 'nav ', 'nav.', 'menü', 'menu', 'header'])) addType(types, 'NAVIGATION');
  if (containsAny(text, ['accessibility', 'barriere', 'aria', 'keyboard', 'tastatur', 'focus', 'fokus', 'kontrast'])) addType(types, 'ACCESSIBILITY');
  if (containsAny(text, ['performance', 'speed', 'schnell', 'lighthouse', 'laden', 'load time', 'bundle'])) addType(types, 'PERFORMANCE');
  if (containsAny(text, ['funktion', 'formular', 'form ', 'interaction', 'interaktion', 'dialog', 'button funktioniert'])) addType(types, 'FUNCTIONAL');
  if (containsAny(text, ['integration', 'api', 'webhook', 'provider', 'stripe', 'billing', 'payment', 'datenbank', 'database'])) addType(types, 'INTEGRATION');
  if (!types.length) addType(types, 'VISUAL');

  const highRiskSignals = containsAny(text, ['production', 'dns', 'domain aktiv', 'indexing', 'indexieren', 'stripe', 'billing', 'payment', 'echte kundendaten', 'real customer', 'secret', 'token']);
  const integration = types.includes('INTEGRATION');
  const medium = types.some((type) => ['NAVIGATION', 'ACCESSIBILITY', 'PERFORMANCE', 'FUNCTIONAL'].includes(type));
  const riskLevel = highRiskSignals || integration ? 'HIGH' : medium ? 'MEDIUM' : 'LOW';
  const allowed = !highRiskSignals;

  const files = new Set();
  for (const type of types) {
    if (['COPY', 'VISUAL'].includes(type)) ['projects/riosystems-public-website-v1/index.html', 'projects/riosystems-public-website-v1/styles.css', 'projects/riosystems-public-website-v1/visual-v2.css'].forEach((file) => files.add(file));
    if (type === 'RESPONSIVE') ['projects/riosystems-public-website-v1/styles.css', 'projects/riosystems-public-website-v1/visual-v2.css', 'projects/riosystems-public-website-v1/app.js'].forEach((file) => files.add(file));
    if (type === 'NAVIGATION') ['projects/riosystems-public-website-v1/index.html', 'projects/riosystems-public-website-v1/app.js', 'projects/riosystems-public-website-v1/styles.css'].forEach((file) => files.add(file));
    if (type === 'ACCESSIBILITY') ['projects/riosystems-public-website-v1/index.html', 'projects/riosystems-public-website-v1/app.js', 'projects/riosystems-public-website-v1/styles.css'].forEach((file) => files.add(file));
    if (type === 'PERFORMANCE') ['projects/riosystems-public-website-v1/index.html', 'projects/riosystems-public-website-v1/app.js', 'projects/riosystems-public-website-v1/styles.css'].forEach((file) => files.add(file));
    if (type === 'FUNCTIONAL') ['projects/riosystems-public-website-v1/app.js', 'projects/riosystems-public-website-v1/index.html'].forEach((file) => files.add(file));
    if (type === 'INTEGRATION') ['projects/riosystems-public-website-v1/app.js', 'projects/riosystems-public-website-v1/project.json'].forEach((file) => files.add(file));
  }

  return {
    ok: true,
    schema: 'riosystems.operator-project-change-classification.v1',
    requested_change: requestedChange,
    change_types: types,
    affected_files: [...files],
    risk_level: riskLevel,
    expected_provider_route: ['existing_web_factory', 'github_branch_pr', 'cloudflare_pages_factory_preview'],
    expected_variable_cost_eur: 0,
    production_impact: 'NONE',
    external_write_impact: 'STAGING_BRANCH_AND_PREVIEW_ONLY',
    approval_requirement: 'EXPLICIT_OPERATOR_APPROVAL',
    allowed,
    block_reason: allowed ? null : 'REQUEST_TOUCHES_NON_NEGOTIABLE_PRODUCTION_OR_SENSITIVE_BOUNDARY',
    staging_only: true,
    production_deploy: false,
    dns_change: false,
    indexing: false,
    billing: false,
    real_customer_data: false,
    paid_provider_calls_authorized: false
  };
}

function workspaceHistory(uiAudit = []) {
  const seed = [{
    iteration: 'V1 RC',
    git_sha: AURENTARA_ACCEPTED_RC_SHA,
    branch: 'aurentara-public-website-private-rc-v1-20260902',
    preview: 'Cloudflare Pages Factory Preview',
    qa_status: 'PASS',
    at: '2026-09-02T13:22:28.000Z',
    status: 'ACCEPTED_RC'
  }];
  const mapped = uiAudit
    .filter((item) => item.scope_key === AURENTARA_WEBSITE_SCOPE && String(item.event || '').startsWith('WORKSPACE_'))
    .map((item, index) => ({
      iteration: item.iteration_label || `Workspace ${index + 1}`,
      git_sha: item.git_sha || null,
      branch: item.branch || AURENTARA_WORKING_BRANCH,
      preview: item.preview_url || 'Preview only',
      qa_status: item.qa_status || 'NOT_VERIFIED',
      at: item.at || null,
      status: item.status || item.event
    }));
  return [...seed, ...mapped];
}

export function buildOperatorProjectWorkspace({ project = {}, ui_audit = [], preview_url = null, preview_status = null } = {}) {
  if (!isAurentaraPublicWebsiteProject(project)) return { ok: false, error: 'PROJECT_WORKSPACE_NOT_SUPPORTED', production_deploy: false };
  const url = clean(preview_url || project.preview_url, 1200) || null;
  const currentPreviewStatus = clean(preview_status || project.preview_status, 80) || (url ? 'AVAILABLE' : 'NOT_AVAILABLE');
  const history = workspaceHistory(ui_audit);
  const last = history.at(-1);
  return {
    ok: true,
    schema: 'riosystems.operator-project-workspace.v1',
    project: {
      project_id: AURENTARA_WEBSITE_SLUG,
      slug: AURENTARA_WEBSITE_SLUG,
      scope_key: AURENTARA_WEBSITE_SCOPE,
      name: 'AURENTARA SYSTEMS Public Website V1',
      type: 'PUBLIC_WEBSITE',
      status: project.state || 'ACTIVE',
      phase: 'PRIVATE_RELEASE_CANDIDATE_ITERATION',
      repo: 'dariolazzano3-ops/chatgpt-test',
      canonical_branch: 'factory-control',
      canonical_sha: AURENTARA_REGISTERED_CANONICAL_SHA,
      canonical_sha_state: 'VERIFIED_AT_WORKSPACE_REGISTRATION',
      canonical_source: 'github_remote_factory_control',
      working_branch: AURENTARA_WORKING_BRANCH,
      accepted_rc_sha: AURENTARA_ACCEPTED_RC_SHA,
      accepted_rc_pr: 351,
      preview_status: currentPreviewStatus,
      qa_status: 'ACCEPTED_RC_PASS',
      deployment_mode: 'STAGING_PREVIEW_ONLY',
      production_status: 'OFF',
      cost_status: 'ZERO_VARIABLE_COST_TARGET',
      last_change: last?.at || null
    },
    preview: {
      provider: 'Cloudflare Pages Factory Preview',
      pages_project: 'chatgpt-factory-preview',
      workflow: '.github/workflows/factory-preview.yml',
      url,
      status: currentPreviewStatus,
      embed_policy: url ? 'SANDBOXED_IFRAME_WITH_OPEN_PREVIEW_FALLBACK' : 'OPEN_PREVIEW_WHEN_AVAILABLE',
      current_working_state: currentPreviewStatus === 'AVAILABLE' ? 'CURRENT_WORKING_BRANCH_PREVIEW' : 'NOT_VERIFIED',
      accepted_rc_sha: AURENTARA_ACCEPTED_RC_SHA
    },
    responsive_modes: clone(RESPONSIVE_MODES),
    qa: {
      source: 'existing_riosystems_public_website_live_qa_and_ci',
      accepted_rc_status: 'PASS',
      checks: clone(QA_CHECKS),
      current_iteration_status: currentPreviewStatus === 'AVAILABLE' ? 'PREVIEW_AVAILABLE_QA_PENDING_OR_EXTERNAL' : 'NOT_VERIFIED'
    },
    iteration_history: history,
    governance: {
      branch_pr_only: true,
      automatic_merge: false,
      production: 'OFF',
      dns: 'UNCHANGED',
      indexing: 'OFF',
      billing: 'OFF',
      stripe: 'OFF',
      real_customer_data: 'NONE',
      paid_provider_calls: 0,
      variable_cost_target_eur: 0,
      secrets_in_ui: false
    },
    actions: {
      change_request: 'AVAILABLE',
      preflight: 'EXISTING_MISSION_PREFLIGHT',
      approval: 'EXPLICIT_OPERATOR_APPROVAL',
      execution: 'EXISTING_SYNTHETIC_MISSION_OR_BRANCH_PR_FLOW',
      accept_iteration: 'AVAILABLE_NO_AUTOMATIC_MERGE',
      request_changes: 'AVAILABLE',
      return_to_last_accepted: 'AVAILABLE_AS_OPERATOR_REQUEST'
    },
    production_deploy: false
  };
}

export function workspaceDecisionResult(decision = '') {
  const value = clean(decision, 80).toLowerCase();
  const table = {
    accept: { status: 'ITERATION_ACCEPTED', operator_gate: 'MERGE_OR_RELEASE_REMAINS_EXPLICIT' },
    request_changes: { status: 'CHANGES_REQUESTED', operator_gate: 'NEW_CHANGE_REQUEST_REQUIRED' },
    return_to_accepted: { status: 'RETURN_TO_LAST_ACCEPTED_REQUESTED', operator_gate: 'REVERT_EXECUTION_REQUIRES_EXPLICIT_APPROVAL' }
  };
  const selected = table[value];
  if (!selected) return { ok: false, error: 'WORKSPACE_DECISION_NOT_SUPPORTED', production_deploy: false };
  return {
    ok: true,
    schema: 'riosystems.operator-project-workspace-decision.v1',
    decision: value,
    ...selected,
    merge_started: false,
    merge_authorized: false,
    production_deploy: false,
    dns_change: false,
    billing: false,
    external_write_started: false,
    variable_cost_eur: 0
  };
}

export function enhanceOperatorDashboardShell(html = '') {
  const script = `<script>
(function(){
  const targetProject='${AURENTARA_WEBSITE_SLUG}';
  const targetName='AURENTARA SYSTEMS Public Website V1';
  const wrapProjects=window.renderProjects;
  if(typeof wrapProjects==='function') window.renderProjects=function(){
    wrapProjects();
    document.querySelectorAll('#projects tbody tr').forEach(function(row){
      if(!row.textContent.includes(targetName)) return;
      const button=row.querySelector('.project-open');
      if(!button) return;
      button.textContent='Workspace';
      button.onclick=function(){ location.href='/operator/workspace/'+encodeURIComponent(button.dataset.scope); };
    });
  };
  const wrapDetail=window.renderProjectDetail;
  if(typeof wrapDetail==='function') window.renderProjectDetail=function(detail){
    wrapDetail(detail);
    const project=detail&&detail.project||{};
    if(project.project_id!==targetProject) return;
    const card=document.querySelector('#project-detail .card');
    if(!card||card.querySelector('[data-workspace-link]')) return;
    const actions=document.createElement('div'); actions.className='actions'; actions.style.marginTop='14px';
    const link=document.createElement('a'); link.className='btn primary'; link.dataset.workspaceLink='';
    link.href='/operator/workspace/'+encodeURIComponent(project.scope_key); link.textContent='Projekt Workspace öffnen';
    actions.appendChild(link); card.appendChild(actions);
  };
})();
</script>`;
  return String(html).replace('</body>', `${script}</body>`);
}

export function renderOperatorProjectWorkspaceShell({ scope_key = AURENTARA_WEBSITE_SCOPE } = {}) {
  const scopeJson = JSON.stringify(scope_key).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURENTARA Project Workspace</title>
<style>
:root{color-scheme:light;--bg:#f3f2ee;--panel:#fff;--ink:#171915;--muted:#696d65;--line:#dde0d8;--soft:#f0f1ec;--good:#245b3b;--warn:#785b17;--bad:#7c3030}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.48 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1500px;margin:0 auto;padding:22px}.top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:16px}.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}h1{font-size:26px;margin:3px 0 6px;letter-spacing:-.025em}h2{font-size:15px;margin:0 0 12px}.small{font-size:12px;color:var(--muted)}.grid{display:grid;gap:12px}.two{grid-template-columns:minmax(0,1.5fr) minmax(310px,.8fr)}.card{background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:16px}.kvs{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px}.kv{background:#f8f8f5;border:1px solid var(--soft);border-radius:10px;padding:9px;min-width:0}.kv b{display:block;font-size:11px;color:var(--muted);margin-bottom:3px}.mono{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.badge{display:inline-block;border-radius:999px;background:var(--soft);padding:4px 8px;font-size:11px;font-weight:700}.badge.good{background:#edf5ef;color:var(--good)}.badge.warn{background:#faf4e5;color:var(--warn)}.badge.bad{background:#faeeee;color:var(--bad)}.actions{display:flex;gap:7px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);padding:8px 11px;text-decoration:none;cursor:pointer;font:inherit}.btn.primary{background:#1e211d;color:#fff;border-color:#1e211d}.btn.danger{color:var(--bad)}.preview-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.viewport-wrap{overflow:auto;background:#252824;border-radius:13px;padding:14px;min-height:380px}.viewport{margin:0 auto;background:#fff;transition:width .18s ease;max-width:100%}.viewport iframe{display:block;width:100%;height:680px;border:0;background:#fff}.empty{padding:28px;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--muted)}textarea{width:100%;min-height:105px;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;resize:vertical}button:focus-visible,a:focus-visible,textarea:focus-visible{outline:3px solid #94b3ce;outline-offset:2px}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:8px;border-bottom:1px solid var(--soft);vertical-align:top}.table th{font-size:10px;color:var(--muted);text-transform:uppercase}.callout{padding:11px;border-radius:11px;background:#f3f4ef;border:1px solid var(--line)}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f3;padding:10px;border-radius:10px;font-size:10px}.qa-list{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.qa{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--soft);border-radius:10px;padding:8px}.error{background:#faeeee;color:var(--bad);border:1px solid #ebc8c8;border-radius:10px;padding:10px;margin-bottom:10px}.sticky-safety{position:sticky;bottom:8px;margin-top:12px;padding:9px 12px;border-radius:12px;background:#181a17;color:#fff;display:flex;gap:14px;flex-wrap:wrap;font-size:11px}.loading{opacity:.58;pointer-events:none}@media(max-width:1000px){.two{grid-template-columns:1fr}.kvs{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.shell{padding:12px}.top{display:block}.top .actions{margin-top:10px}.kvs{grid-template-columns:repeat(2,1fr)}.qa-list{grid-template-columns:1fr}.viewport-wrap{padding:8px}.viewport iframe{height:620px}}
</style></head><body><main class="shell"><div id="error"></div><div class="top"><div><div class="eyebrow">AURENTARA Operator Control · Project Workspace V1</div><h1>AURENTARA SYSTEMS Public Website V1</h1><div class="small">Private iteration command center. GitHub, Cloudflare Pages, QA and Mission Control remain the infrastructure below.</div></div><div class="actions"><a class="btn" href="/operator">← Operator Control</a><button class="btn" id="refresh">Aktualisieren</button></div></div><section id="header" class="card"></section><div class="grid two" style="margin-top:12px"><section id="preview" class="card"></section><section id="change" class="card"></section></div><div class="grid two" style="margin-top:12px"><section id="qa" class="card"></section><section id="history" class="card"></section></div><section id="decision" class="card" style="margin-top:12px"></section><div class="sticky-safety"><strong>Safety locked</strong><span>Production OFF</span><span>DNS unchanged</span><span>Indexing OFF</span><span>Billing OFF</span><span>Real Customer Data NONE</span><span>Paid Provider Calls 0</span><span>Variable Cost target 0 €</span></div></main>
<script>
const SCOPE=${scopeJson}; const $=(s)=>document.querySelector(s); const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); const money=(v)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));
let workspace=null,plan=null,classification=null,selectedMode='desktop-1440';
async function api(path,opt={}){const r=await fetch('/operator/api'+path,{...opt,headers:{'content-type':'application/json',...(opt.headers||{})}});const d=await r.json().catch(()=>({error:'INVALID_RESPONSE'}));if(!r.ok){const e=new Error(d.error||('HTTP '+r.status));e.data=d;throw e}return d}
function fail(e){$('#error').innerHTML=e?'<div class="error"><strong>Aktion nicht ausgeführt.</strong> '+esc(e.message||e)+'</div>':''}
function badge(v){const x=String(v||'NOT_VERIFIED');const cls=/PASS|AVAILABLE|ACTIVE|ACCEPTED|OFF|UNCHANGED|NONE/.test(x)?'good':/FAIL|BLOCK|HIGH/.test(x)?'bad':'warn';return '<span class="badge '+cls+'">'+esc(x)+'</span>'}
function renderHeader(){const p=workspace.project;const rows=[['Status',p.status],['Phase',p.phase],['Canonical Git SHA',p.canonical_sha],['Working Branch',p.working_branch],['Accepted RC SHA',p.accepted_rc_sha],['Preview',p.preview_status],['QA',p.qa_status],['Deployment',p.deployment_mode],['Production',p.production_status],['Kosten',p.cost_status]];$('#header').innerHTML='<h2>Project Header</h2><div class="kvs">'+rows.map(([k,v])=>'<div class="kv"><b>'+esc(k)+'</b><span class="'+(String(v).length>22?'mono':'')+'">'+esc(v)+'</span></div>').join('')+'</div><div class="small" style="margin-top:8px">Project ID: <span class="mono">'+esc(p.project_id)+'</span> · Repo: <span class="mono">'+esc(p.repo)+'</span> · Canonical source: '+esc(p.canonical_source)+'</div>'}
function setMode(id){selectedMode=id;const m=workspace.responsive_modes.find(x=>x.id===id)||workspace.responsive_modes[0];const v=$('#viewport');if(v)v.style.width=m.width+'px';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('primary',b.dataset.mode===id))}
function renderPreview(){const p=workspace.preview;const modes=workspace.responsive_modes;$('#preview').innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div><h2>Live Preview</h2><div class="small">'+esc(p.provider)+' · '+esc(p.pages_project)+'</div></div>'+badge(p.status)+'</div><div class="preview-toolbar">'+modes.map(m=>'<button class="btn" data-mode="'+esc(m.id)+'">'+esc(m.label)+'</button>').join('')+'</div>'+(p.url?'<div class="actions" style="margin-bottom:9px"><a class="btn primary" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Open Preview ↗</a><span class="small">Sandboxed embed with open-preview fallback</span></div><div class="viewport-wrap"><div id="viewport" class="viewport"><iframe title="AURENTARA Website Preview" src="'+esc(p.url)+'" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe></div></div>':'<div class="empty"><strong>Preview noch nicht verfügbar.</strong><br>Der vorhandene Factory Preview Workflow erzeugt den Branch-Preview. Production bleibt gesperrt.</div>');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));setMode(selectedMode)}
function classificationHtml(c){if(!c)return '';return '<div class="callout" style="margin-top:10px"><strong>'+esc(c.change_types.join(' + '))+' · Risk '+esc(c.risk_level)+'</strong><div class="small">Files: '+esc(c.affected_files.join(', '))+'</div><div class="small">Route: '+esc(c.expected_provider_route.join(' → '))+' · Expected cost '+money(c.expected_variable_cost_eur)+' · Production impact '+esc(c.production_impact)+'</div>'+(!c.allowed?'<div class="error" style="margin-top:8px">'+esc(c.block_reason)+'</div>':'')+'</div>'}
function planHtml(p){if(!p)return '';const tasks=p.plan?.selected_capabilities||[];return '<div class="callout" style="margin-top:10px"><strong>Preflight: '+esc(p.status)+' · '+money(p.preflight?.estimated_variable_cost_eur||0)+'</strong><div class="small">Approval required · Execution started: '+esc(String(p.execution_started))+'</div><div class="small">Capabilities: '+esc(tasks.map(x=>x.capability).join(', ')||'none')+'</div><div class="actions" style="margin-top:9px"><button id="approve" class="btn primary">Operator-GO · Synthetic Staging</button><button id="reject" class="btn danger">Reject</button></div></div>'}
function renderChange(){ $('#change').innerHTML='<h2>Change Request</h2><div class="small">Natürliche Anweisung → Klassifikation → bestehender Mission Preflight → explizites Approval.</div><textarea id="request" placeholder="z. B. Mach den Hero etwas ruhiger."></textarea><div class="actions" style="margin-top:8px"><button id="classify" class="btn">Change prüfen</button><button id="preflight" class="btn primary">Preflight erzeugen</button></div><div id="change-result">'+classificationHtml(classification)+planHtml(plan)+'</div>';$('#classify').onclick=classify;$('#preflight').onclick=preflight;const a=$('#approve');if(a)a.onclick=approve;const r=$('#reject');if(r)r.onclick=()=>planDecision('reject') }
async function classify(){try{fail(null);classification=await api('/project-workspace/'+encodeURIComponent(SCOPE)+'/classify',{method:'POST',body:JSON.stringify({requested_change:$('#request').value})});renderChange()}catch(e){fail(e)}}
async function preflight(){try{fail(null);if(!classification)classification=await api('/project-workspace/'+encodeURIComponent(SCOPE)+'/classify',{method:'POST',body:JSON.stringify({requested_change:$('#request').value})});if(!classification.allowed)throw new Error(classification.block_reason);plan=await api('/mission-preflight',{method:'POST',body:JSON.stringify({scope_key:SCOPE,industry:'business-systems',country:'DE',language:'de',mission_text:classification.requested_change,requested_outcomes:['website preview iteration'],known_constraints:['staging only','no production','no DNS','no billing','synthetic data only','zero variable cost']})});renderChange()}catch(e){fail(e)}}
async function approve(){try{fail(null);const result=await api('/mission-approve',{method:'POST',body:JSON.stringify({plan_token:plan.plan_token})});plan=null;classification=null;await load();$('#decision').insertAdjacentHTML('afterbegin','<div class="callout"><strong>Execution route resolved.</strong><div class="small">Quality '+esc(result.quality_score??'–')+' · Variable cost '+money(result.variable_cost_eur||0)+' · Production '+esc(String(result.production_deploy))+'</div></div>')}catch(e){fail(e)}}
async function planDecision(decision){try{await api('/mission-plan-decision',{method:'POST',body:JSON.stringify({plan_token:plan.plan_token,decision})});plan=null;renderChange()}catch(e){fail(e)}}
function renderQA(){const q=workspace.qa;$('#qa').innerHTML='<h2>QA Panel</h2><div class="small" style="margin-bottom:8px">Source: '+esc(q.source)+'</div><div class="qa-list">'+q.checks.map(x=>'<div class="qa"><span>'+esc(x.label)+'</span>'+badge(x.status)+'</div>').join('')+'</div><div class="small" style="margin-top:8px">Current iteration: '+esc(q.current_iteration_status)+'</div>'}
function renderHistory(){const h=workspace.iteration_history||[];$('#history').innerHTML='<h2>Version / Iteration History</h2><div style="overflow:auto"><table class="table"><thead><tr><th>Iteration</th><th>SHA / Branch</th><th>QA</th><th>Status</th></tr></thead><tbody>'+h.slice().reverse().map(x=>'<tr><td>'+esc(x.iteration)+'</td><td class="mono">'+esc(x.git_sha||'not projected')+'<br>'+esc(x.branch||'')+'</td><td>'+badge(x.qa_status)+'</td><td>'+badge(x.status)+'</td></tr>').join('')+'</tbody></table></div>'}
async function decide(decision){try{fail(null);const r=await api('/project-workspace/'+encodeURIComponent(SCOPE)+'/decision',{method:'POST',body:JSON.stringify({decision})});await load();$('#decision').insertAdjacentHTML('afterbegin','<div class="callout"><strong>'+esc(r.status)+'</strong><div class="small">'+esc(r.operator_gate)+' · Merge started '+esc(String(r.merge_started))+' · Production '+esc(String(r.production_deploy))+'</div></div>')}catch(e){fail(e)}}
function renderDecision(){ $('#decision').innerHTML='<h2>Human Review</h2><div class="actions"><button class="btn primary" data-decision="accept">ACCEPT ITERATION</button><button class="btn" data-decision="request_changes">REQUEST CHANGES</button><button class="btn danger" data-decision="return_to_accepted">RETURN TO LAST ACCEPTED</button></div><div class="small" style="margin-top:8px">Kein Button merged automatisch. Finaler Merge oder Release bleibt ein explizites Operator-Gate.</div>';document.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>decide(b.dataset.decision))}
function render(){renderHeader();renderPreview();renderChange();renderQA();renderHistory();renderDecision()}
async function load(){document.body.classList.add('loading');try{fail(null);workspace=await api('/project-workspace/'+encodeURIComponent(SCOPE));render()}catch(e){fail(e)}finally{document.body.classList.remove('loading')}}
$('#refresh').onclick=load;load();
</script></body></html>`;
}

export function operatorProjectWorkspaceManifest() {
  return {
    version: 'riosystems.operator-project-workspace.v1',
    thin_workspace_adapter: true,
    existing_project_portfolio_reused: true,
    existing_mission_preflight_reused: true,
    existing_approval_flow_reused: true,
    existing_web_factory_route_referenced: true,
    existing_factory_preview_reused: true,
    duplicate_project_state: false,
    automatic_merge: false,
    production_deploy: false,
    dns_change: false,
    indexing: false,
    billing: false,
    real_customer_data: false,
    paid_provider_calls: 0,
    variable_cost_target_eur: 0
  };
}
