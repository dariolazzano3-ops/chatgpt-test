const COOKIE='riosystems_session';
const enc=new TextEncoder();

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function hmac(value,secret){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))))}
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))}
function equal(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const item of raw.split(';')){const [k,...v]=item.trim().split('=');if(k===name)return v.join('=')}return ''}
async function validSession(req,env){if(!env.DASHBOARD_SESSION_SECRET)return false;const token=cookie(req,COOKIE);const parts=token.split('.');if(parts.length!==3)return false;const [issued,nonce,sig]=parts;const ts=Number(issued);if(!Number.isFinite(ts)||Date.now()-ts>8*60*60*1000)return false;const expected=await hmac(`${issued}.${nonce}`,env.DASHBOARD_SESSION_SECRET);return equal(await digest(sig),await digest(expected))}
function loginHtml(configured,error=''){return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIOSYSTEMS Login</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090c;color:#edf5f2;font-family:Inter,system-ui,sans-serif;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:48px 48px}.card{width:min(92vw,430px);padding:30px;border:1px solid #ffffff18;border-radius:22px;background:#0c1217ee;box-shadow:0 30px 100px #0008}.mark{width:14px;height:14px;border:1px solid #72f0c2;box-shadow:0 0 18px #72f0c255;margin-bottom:28px}small{color:#72f0c2;letter-spacing:.18em;font-weight:800}h1{font-size:36px;line-height:.95;letter-spacing:-.04em;margin:10px 0 12px}p{color:#8fa39d;line-height:1.5}label{display:block;margin:24px 0 8px;font-size:10px;letter-spacing:.14em;color:#758981}input{width:100%;height:52px;padding:0 14px;border:1px solid #ffffff1c;border-radius:13px;background:#080d11;color:white;font:inherit;outline:none}input:focus{border-color:#72f0c266}button{width:100%;height:52px;margin-top:12px;border:0;border-radius:13px;background:#72f0c2;color:#04100c;font-weight:900;letter-spacing:.1em;cursor:pointer}.warn{padding:12px;border:1px solid #ff6b7a35;border-radius:12px;color:#ff9aa4;font-size:12px}.error{color:#ff909b;font-size:12px}</style></head><body><main class="card"><div class="mark"></div><small>RIOSYSTEMS</small><h1>Dashboard access.</h1><p>Protected operations interface for LEAN V3.</p>${configured?`<form method="post" action="/api/login"><label>PASSWORD</label><input type="password" name="password" autocomplete="current-password" required autofocus><button type="submit">UNLOCK DASHBOARD</button>${error?`<p class="error">${error}</p>`:''}</form>`:`<p class="warn">Secure authentication is installed but not configured yet. Set DASHBOARD_PASSWORD and DASHBOARD_SESSION_SECRET in the Cloudflare preview environment.</p>`}</main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
async function github(env,path,init={}){if(!env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');const owner=env.GITHUB_OWNER||'dariolazzano3-ops';const repo=env.GITHUB_REPO||'chatgpt-test';const r=await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`,{...init,headers:{'authorization':`Bearer ${env.GITHUB_TOKEN}`,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'riosystems-dashboard',...(init.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||`GITHUB_${r.status}`);return data}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/login')return loginHtml(Boolean(env.DASHBOARD_PASSWORD&&env.DASHBOARD_SESSION_SECRET));
    if(url.pathname==='/api/login'&&request.method==='POST'){
      if(!env.DASHBOARD_PASSWORD||!env.DASHBOARD_SESSION_SECRET)return loginHtml(false);
      let supplied='';const type=request.headers.get('content-type')||'';
      if(type.includes('application/json')){const body=await request.json().catch(()=>({}));supplied=String(body.password||'')}else{const form=await request.formData();supplied=String(form.get('password')||'')}
      const ok=equal(await digest(supplied),await digest(env.DASHBOARD_PASSWORD));
      if(!ok)return type.includes('application/json')?json({error:'INVALID_PASSWORD'},401):loginHtml(true,'Incorrect password.');
      const issued=String(Date.now());const nonce=crypto.randomUUID();const sig=await hmac(`${issued}.${nonce}`,env.DASHBOARD_SESSION_SECRET);const session=`${issued}.${nonce}.${sig}`;
      const headers={'set-cookie':`${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`};
      return type.includes('application/json')?json({ok:true},200,headers):new Response(null,{status:303,headers:{location:'/',...headers}});
    }
    if(url.pathname==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
    const authed=await validSession(request,env);
    if(!authed){if(url.pathname.startsWith('/api/'))return json({error:'AUTH_REQUIRED'},401);return Response.redirect(new URL('/login',url),302)}
    if(url.pathname==='/api/factory/status')return json({project:'multiproject-alpha',preview_ready:true,qa:'PASS',production:'LOCKED',preview_url:'https://factory-multiproject-alpha-e-huml.chatgpt-factory-preview.pages.dev'});
    if(url.pathname==='/api/factory/request'&&request.method==='POST'){
      const body=await request.json().catch(()=>({}));const mode=body.mode==='evolve'?'evolve':'edit';const prompt=String(body.prompt||'').trim();if(!prompt)return json({error:'PROMPT_REQUIRED'},400);if(prompt.length>4000)return json({error:'PROMPT_TOO_LONG'},400);
      const now=new Date().toISOString().replace(/[:.]/g,'-');const file=`factory-requests/${now}-riosystems-${crypto.randomUUID().slice(0,8)}.json`;
      const payload={mode,prompt,target_project_slug:'multiproject-alpha',active_state_path:'factory-state/projects.json',production_deploy:false};
      const content=btoa(unescape(encodeURIComponent(JSON.stringify(payload,null,2))));
      await github(env,`/contents/${file}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message:`RIOSYSTEMS: ${mode} MultiProject Alpha`,content,branch:'factory-control'})});
      return json({ok:true,request_file:file,mode,production_deploy:false},202);
    }
    if(url.pathname.startsWith('/api/production'))return json({error:'PRODUCTION_GATE_LOCKED'},423);
    return env.ASSETS.fetch(request);
  }
};