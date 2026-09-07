#!/usr/bin/env node
const API='https://api.cloudflare.com/client/v4';
const clean=(v,max=1200)=>String(v??'').trim().slice(0,max);
const token=clean(process.env.CLOUDFLARE_API_TOKEN,1800);
const accountId=clean(process.env.CLOUDFLARE_ACCOUNT_ID,80);
const previewHost='aurentara-hq-private-preview.gelato-donatello-dario-a5a5376c.workers.dev';
if(!token||!/^[a-f0-9]{32}$/i.test(accountId))throw new Error('CLOUDFLARE_CREDENTIALS_REQUIRED');

async function cf(path){
  const r=await fetch(API+path,{headers:{authorization:'Bearer '+token,accept:'application/json'},redirect:'error'});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.success===false)throw new Error('CF_GET_'+r.status);
  return b?.result;
}
function target(app={}){
  try{
    const raw=clean(app.domain,500);
    const u=new URL(raw.includes('://')?raw:'https://'+raw);
    return {hostname:u.hostname.toLowerCase(),pathname:u.pathname.replace(/\/+$/,'')||'/'};
  }catch{return null;}
}
const appsRaw=await cf('/accounts/'+accountId+'/access/apps?per_page=100');
const apps=Array.isArray(appsRaw)?appsRaw:[];
const relevant=[];
for(const app of apps){
  const t=target(app);
  const destinations=Array.isArray(app.destinations)?app.destinations:[];
  const domainMatch=t?.hostname===previewHost;
  const workersDevDomain=Boolean(t?.hostname&&t.hostname.endsWith('.workers.dev'));
  const workerScoped=destinations.some(d=>['worker','preview_worker','all_workers','all_preview_workers'].includes(clean(d?.type,80)));
  if(!domainMatch&&!workersDevDomain&&!workerScoped)continue;
  let policies=[];
  if(app.id){
    const p=await cf('/accounts/'+accountId+'/access/apps/'+app.id+'/policies?per_page=100').catch(()=>[]);
    policies=Array.isArray(p)?p:[];
  }
  relevant.push({
    id:app.id||null,
    name:app.name||null,
    type:app.type||null,
    domain:t?{hostname:t.hostname,pathname:t.pathname}:null,
    destinations:destinations.map(d=>({type:d?.type||null,worker_id:d?.worker_id||null})),
    session_duration:app.session_duration||null,
    auto_redirect_to_identity:app.auto_redirect_to_identity??null,
    http_only_cookie_attribute:app.http_only_cookie_attribute??null,
    options_preflight_bypass:app.options_preflight_bypass??null,
    same_site_cookie_attribute:app.same_site_cookie_attribute??null,
    eager_redirect_cookie_setting:app.eager_redirect_cookie_setting??null,
    enable_binding_cookie:app.enable_binding_cookie??null,
    path_cookie_attribute:app.path_cookie_attribute??null,
    skip_interstitial:app.skip_interstitial??null,
    policies:policies.map(p=>({
      id:p.id||null,
      name:p.name||null,
      decision:p.decision||null,
      precedence:p.precedence??null,
      include_types:(Array.isArray(p.include)?p.include:[]).map(x=>Object.keys(x||{})).flat()
    }))
  });
}

const chain=[];
let next='https://'+previewHost+'/';
for(let i=0;i<12;i++){
  let r;
  try{r=await fetch(next,{redirect:'manual',headers:{'user-agent':'aurentara-preview-diagnostic/1.0'}})}
  catch(e){chain.push({step:i+1,error:clean(e?.message||e,240)});break;}
  const loc=r.headers.get('location');
  let safeLoc=null;
  if(loc){
    try{
      const u=new URL(loc,next);
      safeLoc={hostname:u.hostname,pathname:u.pathname};
    }catch{safeLoc={hostname:null,pathname:'INVALID_LOCATION'};}
  }
  chain.push({step:i+1,status:r.status,url:(()=>{const u=new URL(next);return {hostname:u.hostname,pathname:u.pathname};})(),location:safeLoc});
  if(!(r.status>=300&&r.status<400)||!loc)break;
  next=new URL(loc,next).toString();
}
console.log(JSON.stringify({ok:true,preview_host:previewHost,relevant_access_apps:relevant,redirect_chain:chain},null,2));
