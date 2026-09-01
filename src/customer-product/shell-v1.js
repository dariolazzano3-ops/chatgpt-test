const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderCustomerProductShell(input = {}) {
  const brand = escapeHtml(input.brand || 'AURENTARA SYSTEMS');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${brand} · Personal Business AI</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#181818;background:#f5f4f0;line-height:1.45}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}.shell{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.side{padding:28px 20px;border-right:1px solid #deddd8;background:#fbfaf7}.brand{font-size:13px;font-weight:800;letter-spacing:.11em}.product{font-size:12px;color:#686762;margin-top:5px}.nav{display:grid;gap:7px;margin-top:34px}.nav button{border:0;background:transparent;text-align:left;padding:10px 12px;border-radius:10px;cursor:pointer;color:#55534f}.nav button.active,.nav button:hover{background:#eceae4;color:#171717}.safe{margin-top:32px;padding:12px;border:1px solid #deddd8;border-radius:12px;font-size:11px;color:#6e6c67}.main{max-width:980px;width:100%;padding:48px 44px}.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#78756f}.headline{font-size:36px;letter-spacing:-.035em;margin:7px 0 8px}.muted{color:#706e69}.card{background:#fff;border:1px solid #dfddd7;border-radius:16px;padding:20px;margin:18px 0}.chatlog{min-height:280px;max-height:55vh;overflow:auto;display:grid;gap:11px;padding:4px}.msg{padding:12px 14px;border-radius:13px;max-width:82%;white-space:pre-wrap}.msg.user{justify-self:end;background:#222;color:#fff}.msg.assistant{justify-self:start;background:#f0eee8}.composer{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px}.composer textarea{min-height:54px;resize:vertical;border:1px solid #d6d4ce;border-radius:12px;padding:12px;background:#fff}.primary{border:0;background:#171717;color:#fff;border-radius:11px;padding:10px 17px;cursor:pointer}.secondary{border:1px solid #d5d3cd;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}.rows{display:grid;gap:10px}.row{padding:13px;border:1px solid #e2e0da;border-radius:12px;background:#fff}.tag{display:inline-block;font-size:10px;padding:3px 7px;border-radius:999px;background:#efede7;color:#66635d;margin-left:6px}.hidden{display:none}.warning{border-left:3px solid #333;padding-left:12px;color:#5d5a55}.value{font-weight:650}.actions{display:flex;gap:8px;margin-top:10px}.status{font-size:12px;margin-top:9px;color:#68655f}@media(max-width:760px){.shell{grid-template-columns:1fr}.side{border-right:0;border-bottom:1px solid #deddd8;padding:18px}.nav{grid-template-columns:repeat(5,auto);overflow:auto;margin-top:18px}.main{padding:28px 18px}.headline{font-size:30px}.safe{display:none}}
</style>
</head>
<body>
<div class="shell">
<aside class="side">
  <div class="brand">${brand}</div>
  <div class="product">Personal Business AI</div>
  <div class="nav" id="nav">
    <button data-view="chat" class="active">Business AI</button>
    <button data-view="memory">Memory</button>
    <button data-view="goals">Goals</button>
    <button data-view="decisions">Decisions</button>
    <button data-view="usage">Usage</button>
  </div>
  <div class="safe">Customer Surface V1 · getrennt vom privaten Operator Control Plane.</div>
</aside>
<main class="main">
<section id="view-chat">
  <div class="eyebrow">Your business, remembered</div>
  <h1 class="headline">Frag dein Unternehmen.</h1>
  <p class="muted">Deine Business AI nutzt bestätigtes Business-Wissen, Ziele und Entscheidungen als Kontext. Kritische aktuelle Fragen werden ohne vertrauenswürdige Evidenz nicht geraten.</p>
  <div class="card">
    <div id="chatlog" class="chatlog"><div class="msg assistant">Willkommen. Starte die sichere Guest-Demo, um eine synthetische Business-Session anzulegen.</div></div>
    <div class="composer"><textarea id="message" placeholder="Zum Beispiel: Wie kann ich mein Frühstücksangebot verbessern?"></textarea><button class="primary" id="send">Senden</button></div>
    <div class="status" id="chatstatus"></div>
  </div>
</section>
<section id="view-memory" class="hidden"><div class="eyebrow">Transparency</div><h1 class="headline">Was weiß meine Business AI?</h1><p class="muted">Nur dein aktuelles, tenant-isoliertes Business Memory. Fehler kannst du explizit korrigieren.</p><div id="memory" class="rows"></div></section>
<section id="view-goals" class="hidden"><div class="eyebrow">Direction</div><h1 class="headline">Goals</h1><div id="goals" class="rows"></div></section>
<section id="view-decisions" class="hidden"><div class="eyebrow">Decision memory</div><h1 class="headline">Decisions</h1><div id="decisions" class="rows"></div></section>
<section id="view-usage" class="hidden"><div class="eyebrow">Fair use</div><h1 class="headline">Usage & Plan</h1><div id="usage" class="card"></div></section>
</main>
</div>
<script>
const state={session:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function api(path,options={}){const response=await fetch('/customer/api/'+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});let body={};try{body=await response.json()}catch{}if(!response.ok)throw Object.assign(new Error(body.error||'REQUEST_FAILED'),{body,status:response.status});return body}
async function ensure(){if(state.session)return state.session;try{state.session=(await api('session')).session}catch{state.session=(await api('guest-session',{method:'POST',body:'{}'})).session}return state.session}
function add(role,text){const node=document.createElement('div');node.className='msg '+role;node.textContent=text;document.getElementById('chatlog').append(node);node.scrollIntoView({block:'nearest'});}
async function send(){const box=document.getElementById('message'),message=box.value.trim();if(!message)return;await ensure();add('user',message);box.value='';const status=document.getElementById('chatstatus');status.textContent='Business Context wird geprüft …';try{const out=await api('chat',{method:'POST',body:JSON.stringify({message})});add('assistant',out.answer);status.textContent=out.risk_classification?.trusted_research_required?'Antwort mit Safety-Policy geprüft.':'Antwort mit Business Context geprüft.';}catch(e){if(e.body?.trusted_research_required)add('assistant','Für diese aktuelle oder sensible Frage brauche ich vertrauenswürdige aktuelle Quellen. Live Research ist in dieser sicheren V1 noch nicht aktiviert.');else add('assistant','Diese Aktion ist in der sicheren Customer Surface V1 noch nicht verfügbar.');status.textContent=e.body?.error||e.message}}
async function loadMemory(){await ensure();const out=await api('memory');const root=document.getElementById('memory');root.innerHTML=out.facts.length?'':'<div class="row muted">Noch kein bestätigtes Business Memory.</div>';out.facts.forEach(f=>{const n=document.createElement('div');n.className='row';n.innerHTML='<span class="value">'+esc(f.subject||f.fact_key)+'</span><span class="tag">'+esc(f.status)+'</span><div>'+esc(typeof f.value==='string'?f.value:JSON.stringify(f.value))+'</div><div class="actions"><button class="secondary">Korrigieren</button></div>';n.querySelector('button').onclick=async()=>{const next=prompt('Korrigierter Wert:',typeof f.value==='string'?f.value:JSON.stringify(f.value));if(next===null)return;if(!confirm('Diese Korrektur als bestätigte Business-Wahrheit speichern?'))return;await api('memory/correct',{method:'POST',body:JSON.stringify({memory_id:f.memory_id,value:next,user_confirmed:true})});await loadMemory()};root.append(n)})}
async function loadRows(kind){await ensure();const out=await api(kind);const items=out[kind]||[];const root=document.getElementById(kind);root.innerHTML=items.length?'':'<div class="row muted">Noch keine Einträge.</div>';items.forEach(item=>{const n=document.createElement('div');n.className='row';n.innerHTML='<span class="value">'+esc(item.title||item.decision||'Eintrag')+'</span>'+ (item.status?'<span class="tag">'+esc(item.status)+'</span>':'') +'<div>'+esc(item.description||item.decision||'')+'</div>';root.append(n)})}
async function loadUsage(){await ensure();const out=await api('usage');document.getElementById('usage').innerHTML='<div class="value">'+esc(out.plan.label)+'</div><p class="muted">'+esc(out.plan.description)+'</p><p>AI Turns: <b>'+esc(out.usage.ai_turns)+'</b><br>Variable Kosten: <b>€'+esc(out.usage.variable_cost_eur.toFixed(2))+'</b></p><p class="warning">Production Billing und echte Zahlungen sind nicht aktiv.</p>'}
document.getElementById('send').onclick=send;document.getElementById('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
document.getElementById('nav').onclick=async e=>{const b=e.target.closest('button[data-view]');if(!b)return;document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('main>section').forEach(x=>x.classList.add('hidden'));document.getElementById('view-'+b.dataset.view).classList.remove('hidden');if(b.dataset.view==='memory')await loadMemory();if(b.dataset.view==='goals')await loadRows('goals');if(b.dataset.view==='decisions')await loadRows('decisions');if(b.dataset.view==='usage')await loadUsage()};
</script>
</body></html>`;
}
