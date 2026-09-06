export function renderJarvisPrivateChatV1() {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="application-name" content="JARVIS Personal AI">
<title>JARVIS · Private Command Center</title>
<style>
:root{color-scheme:dark;--bg:#05090e;--panel:rgba(8,16,25,.78);--panel2:rgba(10,22,34,.64);--line:rgba(126,199,255,.16);--line2:rgba(151,214,255,.3);--text:#edf7ff;--muted:#7892a8;--blue:#8bd2ff;--blue2:#4aaeff;--ok:#82f7cf;--warn:#ffd28b;--danger:#ff8e9b;--shadow:0 24px 80px rgba(0,0,0,.42)}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 58% 20%,#0c1d2d 0,#07111b 27%,#04080d 62%,#020508 100%);color:var(--text);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh;overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 49.8%,rgba(126,199,255,.035) 50%,transparent 50.2%),linear-gradient(rgba(126,199,255,.025) 1px,transparent 1px);background-size:100% 100%,100% 72px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.9),transparent)}
.shell{min-height:100vh;display:grid;grid-template-columns:210px minmax(0,1fr) 280px;gap:18px;padding:18px}
.glass{border:1px solid var(--line);background:linear-gradient(180deg,rgba(12,24,36,.82),rgba(5,12,19,.76));box-shadow:var(--shadow);backdrop-filter:blur(22px)}
.rail{border-radius:24px;padding:24px 16px;display:flex;flex-direction:column;min-height:calc(100vh - 36px);position:sticky;top:18px}
.brand{letter-spacing:.42em;font-size:18px;font-weight:500;color:#d8efff;padding:8px 10px 22px}.brand small{display:block;letter-spacing:.22em;font-size:9px;color:var(--muted);margin-top:8px}
.nav{display:grid;gap:7px;margin-top:14px}.nav button{appearance:none;border:0;background:transparent;color:#7892a8;text-align:left;border-radius:12px;padding:11px 12px;font-size:12px;letter-spacing:.08em;cursor:pointer}.nav button:hover,.nav button.active{color:#eaf7ff;background:linear-gradient(90deg,rgba(92,177,255,.14),transparent);box-shadow:inset 2px 0 0 var(--blue)}
.philosophy{margin-top:auto;padding:18px 11px 6px;color:#6f899e;font-size:10px;line-height:1.65;letter-spacing:.13em}.philosophy strong{display:block;color:#a7c9e1;font-size:11px;margin-bottom:8px}
.main{min-width:0;display:flex;flex-direction:column;gap:18px}.topbar{height:74px;border-radius:24px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}.greeting{font-size:13px;letter-spacing:.16em;color:#a5c3d9}.greeting strong{display:block;font-size:20px;letter-spacing:.06em;color:#e7f6ff;margin-bottom:4px}.live{display:flex;align-items:center;gap:9px;font-size:10px;letter-spacing:.12em;color:var(--muted)}.dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 18px var(--ok)}
.command{position:relative;min-height:calc(100vh - 128px);border-radius:30px;overflow:hidden;display:grid;grid-template-rows:minmax(260px,1fr) auto auto}
.core-stage{position:relative;min-height:310px;display:grid;place-items:center;overflow:hidden}.core-stage:before{content:"";position:absolute;width:520px;height:520px;border-radius:50%;border:1px solid rgba(112,197,255,.12);box-shadow:0 0 90px rgba(58,154,226,.08),inset 0 0 90px rgba(58,154,226,.04);animation:drift 14s linear infinite}.core-stage:after{content:"";position:absolute;width:380px;height:380px;border-radius:50%;border:1px solid rgba(112,197,255,.18);box-shadow:0 0 60px rgba(58,154,226,.12);animation:drift 10s linear infinite reverse}
.orb{width:220px;height:220px;border-radius:50%;position:relative;z-index:2;background:radial-gradient(circle at 38% 35%,rgba(154,222,255,.95) 0 2%,rgba(54,135,204,.78) 3% 10%,rgba(10,42,72,.94) 32%,#06111c 62%,#02060b 100%);box-shadow:0 0 0 1px rgba(154,222,255,.28),0 0 55px rgba(57,158,232,.34),inset -30px -20px 65px #01050a}.orb:before{content:"";position:absolute;inset:-26px;border:1px solid rgba(128,207,255,.32);border-radius:50%;clip-path:polygon(0 42%,100% 22%,100% 60%,0 80%);transform:rotate(-12deg)}.orb-label{position:absolute;z-index:3;text-align:center;letter-spacing:.5em;font-size:13px;color:#dff4ff;text-shadow:0 0 16px rgba(131,211,255,.8)}.orb-label small{display:block;margin-top:12px;letter-spacing:.2em;font-size:8px;color:#7ca5c0}
.chat{position:relative;z-index:5;max-height:340px;overflow:auto;padding:0 28px 12px;display:grid;gap:10px}.bubble{max-width:min(760px,88%);padding:13px 15px;border:1px solid var(--line);border-radius:16px;white-space:pre-wrap;line-height:1.55;font-size:13px}.bubble.assistant{background:rgba(34,78,109,.17);color:#d9edf9}.bubble.user{justify-self:end;background:rgba(87,153,206,.14);color:#f3fbff}.bubble.error{border-color:rgba(255,142,155,.28);color:#ffc4cb}
.quick{padding:0 28px 14px;display:flex;gap:8px;overflow:auto}.quick button{white-space:nowrap;border:1px solid var(--line);background:rgba(5,14,22,.72);color:#90abc0;border-radius:999px;padding:8px 11px;font-size:10px;cursor:pointer}.quick button:hover{border-color:var(--line2);color:#dff4ff}
.composer{border-top:1px solid var(--line);padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;background:rgba(2,7,12,.64)}textarea{resize:none;height:50px;max-height:130px;border:1px solid var(--line);background:#071019;color:#eef8ff;border-radius:15px;padding:14px 15px;font:inherit;outline:none}textarea:focus{border-color:rgba(111,197,255,.45);box-shadow:0 0 0 3px rgba(64,162,231,.08)}.send{border:1px solid rgba(130,209,255,.35);background:linear-gradient(180deg,#153653,#0a2236);color:#e9f8ff;border-radius:15px;padding:0 18px;font-weight:600;cursor:pointer}.send:disabled{opacity:.45;cursor:wait}
.right{display:grid;align-content:start;gap:14px}.panel{border-radius:22px;padding:18px}.panel h3{margin:0 0 14px;font-size:11px;letter-spacing:.16em;color:#a8c6dc;font-weight:600}.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid rgba(126,199,255,.08);font-size:11px;color:#7892a8}.row:first-of-type{border-top:0}.row strong{color:#cae3f4;font-weight:500}.pill{font-size:9px;border:1px solid var(--line);border-radius:999px;padding:4px 7px;color:#96b3c8}.pill.ok{color:var(--ok);border-color:rgba(130,247,207,.24)}.pill.warn{color:var(--warn);border-color:rgba(255,210,139,.24)}
.quote{font-size:11px;line-height:1.7;color:#829eb3}.quote strong{color:#c3deef;display:block;margin-bottom:8px}
@keyframes drift{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.core-stage:before,.core-stage:after{animation:none}}
@media(max-width:1100px){.shell{grid-template-columns:160px 1fr}.right{grid-column:2;grid-template-columns:repeat(3,1fr)}.rail{grid-row:1/3}.command{min-height:620px}}
@media(max-width:760px){.shell{display:block;padding:10px}.rail{position:static;min-height:auto;border-radius:20px;margin-bottom:10px;padding:14px}.brand{padding-bottom:10px}.nav{display:flex;overflow:auto}.nav button{white-space:nowrap}.philosophy{display:none}.topbar{border-radius:20px;height:66px;padding:0 16px}.command{border-radius:22px;min-height:calc(100vh - 190px)}.core-stage{min-height:250px}.orb{width:160px;height:160px}.core-stage:before{width:340px;height:340px}.core-stage:after{width:250px;height:250px}.chat,.quick{padding-left:14px;padding-right:14px}.right{display:grid;grid-template-columns:1fr;margin-top:10px}.composer{position:sticky;bottom:0}}
</style>
</head>
<body>
<div class="shell">
  <aside class="rail glass">
    <div class="brand">JARVIS<small>PERSONAL AI OS</small></div>
    <nav class="nav" aria-label="JARVIS Navigation">
      <button class="active" data-prompt="">● Chat</button>
      <button data-prompt="Was steht heute an?">Today</button>
      <button data-prompt="Was weißt du über mich?">Memory</button>
      <button data-prompt="Was steht morgen in meinem Kalender?">Calendar</button>
      <button data-prompt="Welche Aufgaben sind offen?">Tasks</button>
      <button data-prompt="Welche Projekte sind gerade relevant?">Projects</button>
      <button disabled>Files</button>
      <button disabled>Activity</button>
    </nav>
    <div class="philosophy"><strong>THINK · UNDERSTAND · PLAN</strong>ACT · VERIFY · REMEMBER<br><br>Private by design.</div>
  </aside>

  <main class="main">
    <header class="topbar glass">
      <div class="greeting"><strong id="greeting">JARVIS</strong><span id="session-label">Private session wird geprüft…</span></div>
      <div class="live"><span class="dot"></span><span id="live-label">CORE ONLINE</span></div>
    </header>

    <section class="command glass">
      <div class="core-stage">
        <div class="orb" aria-hidden="true"></div>
        <div class="orb-label">JARVIS<small>A BRIGHTER YOU</small></div>
      </div>
      <div id="chat" class="chat" aria-live="polite">
        <div class="bubble assistant">Bereit. Der private JARVIS-Runtime-Pfad wird geladen.</div>
      </div>
      <div class="quick">
        <button data-q="Was steht heute an?">Heute</button>
        <button data-q="Was steht morgen an?">Morgen</button>
        <button data-q="Was weißt du über meine Projekte?">Memory</button>
        <button data-q="Systemstatus">Systemstatus</button>
      </div>
      <form id="composer" class="composer">
        <textarea id="message" maxlength="4000" placeholder="Sprich mit JARVIS…" aria-label="Nachricht an JARVIS"></textarea>
        <button id="send" class="send" type="submit">SEND</button>
      </form>
    </section>
  </main>

  <aside class="right">
    <section class="panel glass"><h3>SYSTEMS</h3>
      <div class="row"><span>JARVIS Core</span><span id="core" class="pill">CHECK</span></div>
      <div class="row"><span>Private Session</span><span id="session" class="pill">CHECK</span></div>
      <div class="row"><span>Memory</span><span id="memory" class="pill">CHECK</span></div>
      <div class="row"><span>Calendar Read</span><span id="calendar" class="pill">CHECK</span></div>
    </section>
    <section class="panel glass"><h3>SAFETY</h3>
      <div class="row"><span>Production</span><strong>OFF</strong></div>
      <div class="row"><span>Billing</span><strong>OFF</strong></div>
      <div class="row"><span>Finance actions</span><strong>OFF</strong></div>
      <div class="row"><span>HAMYREN flow</span><strong>NONE</strong></div>
    </section>
    <section class="panel glass quote"><h3>PRINCIPLE</h3><strong>Intelligence in service of a better you.</strong>Context only when relevant. Actions only when permitted. Memory only when justified.</section>
  </aside>
</div>
<script>
const chat=document.getElementById('chat'),form=document.getElementById('composer'),message=document.getElementById('message'),send=document.getElementById('send');
function bubble(text,type){const el=document.createElement('div');el.className='bubble '+type;el.textContent=String(text||'');chat.appendChild(el);chat.scrollTop=chat.scrollHeight}
function pill(id,text,ok){const el=document.getElementById(id);el.textContent=text;el.className='pill '+(ok?'ok':'warn')}
async function getJson(path,init){const r=await fetch(path,init);const body=await r.json().catch(()=>({error:'INVALID_RESPONSE'}));if(!r.ok)throw Object.assign(new Error(body.error||('HTTP '+r.status)),{body,status:r.status});return body}
async function boot(){
  try{
    const [s,status]=await Promise.all([getJson('/jarvis/api/session'),getJson('/jarvis/api/status')]);
    document.getElementById('session-label').textContent='Private · '+(s.display_name||'Operator');
    pill('core','ONLINE',true);pill('session','PRIVATE',true);
    pill('memory',status.durable_memory_ready?'DURABLE':'NOT BOUND',status.durable_memory_ready);
    pill('calendar',status.calendar_read_bound?'READ ONLY':'PENDING',status.calendar_read_bound);
    if(!status.calendar_read_bound) document.getElementById('live-label').textContent='CORE ONLINE · CALENDAR HOST PENDING';
  }catch(e){pill('session','BLOCKED',false);bubble('Private Session konnte nicht verifiziert werden.','error')}
}
async function ask(text){
  const value=String(text||'').trim();if(!value)return;
  bubble(value,'user');message.value='';send.disabled=true;
  try{
    const r=await getJson('/jarvis/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:value})});
    bubble(r.answer||'Keine Antwort.','assistant');
  }catch(e){bubble((e.body&&e.body.message)||e.message||'JARVIS Anfrage fehlgeschlagen.','error')}
  finally{send.disabled=false;message.focus()}
}
form.addEventListener('submit',e=>{e.preventDefault();ask(message.value)});
message.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.q)));
document.querySelectorAll('.nav button[data-prompt]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.prompt){message.value=b.dataset.prompt;message.focus()}}));
const hour=new Date().getHours();document.getElementById('greeting').textContent=(hour<12?'Guten Morgen':hour<18?'Guten Tag':'Guten Abend')+', JARVIS';
boot();
</script>
</body></html>`;
}
