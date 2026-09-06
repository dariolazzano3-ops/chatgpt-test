#!/usr/bin/env node
const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const accountId=clean(process.env.CLOUDFLARE_ACCOUNT_ID,64);
const token=clean(process.env.CLOUDFLARE_API_TOKEN,2000);
const rootHost=clean(process.env.JAGUAR_PAGES_ROOT_HOST||'chatgpt-factory-preview.pages.dev',500).toLowerCase();
const previewHost=clean(process.env.JAGUAR_PAGES_PREVIEW_HOST||'project-jaguar-gelato-v1.chatgpt-factory-preview.pages.dev',500).toLowerCase();

if(!/^[a-f0-9]{32}$/i.test(accountId)||!token) {
  console.error(JSON.stringify({ok:false,error:'CLOUDFLARE_READONLY_CREDENTIALS_REQUIRED',secrets_returned:false,external_write:false,production_deploy:false}));
  process.exit(2);
}
const api='https://api.cloudflare.com';
async function getJson(path){
  const url=new URL(path,api);
  if(url.origin!==api||!url.pathname.startsWith('/client/v4/')) throw new Error('CLOUDFLARE_READONLY_PATH_REJECTED');
  const res=await fetch(url,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
  const body=await res.json().catch(()=>null);
  if(!res.ok||body?.success===false) throw new Error(`CLOUDFLARE_READONLY_HTTP_${res.status}`);
  return body?.result;
}
function targetStrings(app={}){
  const vals=[];
  if(app.domain) vals.push(String(app.domain));
  for(const d of Array.isArray(app.destinations)?app.destinations:[]) if(String(d?.type||'').toLowerCase()==='public'&&d?.uri) vals.push(String(d.uri));
  return vals;
}
function hostname(value){
  try{return new URL(String(value).includes('://')?String(value):`https://${value}`).hostname.toLowerCase()}catch{return''}
}
function hostCovers(pattern,target){
  const p=hostname(pattern), t=target.toLowerCase();
  if(!p||!t) return false;
  if(p===t) return true;
  if(p.startsWith('*.')) return t.endsWith(p.slice(1)) && t!==p.slice(2);
  return false;
}
function ruleKeys(rule){return rule&&typeof rule==='object'&&!Array.isArray(rule)?Object.keys(rule).map(k=>k.toLowerCase()):[]}
function broadAllow(policy={}){
  if(String(policy.decision||'').toLowerCase()!=='allow') return false;
  const include=Array.isArray(policy.include)?policy.include:[];
  if(!include.length) return true;
  return include.some(rule=>ruleKeys(rule).some(k=>['everyone','login_method'].includes(k)));
}
function restrictiveAllow(policy={}){
  if(String(policy.decision||'').toLowerCase()!=='allow') return false;
  const include=Array.isArray(policy.include)?policy.include:[];
  return include.length>0&&!broadAllow(policy);
}

try{
  const apps=await getJson(`/client/v4/accounts/${accountId}/access/apps?per_page=100`);
  const matches=(Array.isArray(apps)?apps:[]).filter(app=>{
    if(String(app.type||'').toLowerCase()!=='self_hosted') return false;
    const targets=targetStrings(app);
    return targets.some(t=>hostCovers(t,previewHost)) && targets.some(t=>hostCovers(t,rootHost)||hostCovers(t,previewHost));
  });
  if(matches.length!==1){
    console.error(JSON.stringify({ok:false,error:matches.length?'ACCESS_APPLICATION_AMBIGUOUS':'ACCESS_APPLICATION_NOT_FOUND_FOR_PREVIEW_HOST',matching_application_count:matches.length,preview_host:previewHost,secrets_returned:false,external_write:false,production_deploy:false}));
    process.exit(3);
  }
  const id=clean(matches[0].id,80);
  const policies=await getJson(`/client/v4/accounts/${accountId}/access/apps/${id}/policies?per_page=100`);
  const list=Array.isArray(policies)?policies:[];
  const bypass=list.filter(p=>String(p.decision||'').toLowerCase()==='bypass').length;
  const broad=list.filter(broadAllow).length;
  const restrictive=list.filter(restrictiveAllow).length;
  const ok=bypass===0&&broad===0&&restrictive>=1;
  console.log(JSON.stringify({
    ok,
    schema:'riosystems.project-jaguar.pages-access-readonly.v1',
    root_host:rootHost,
    preview_host:previewHost,
    matching_application_count:matches.length,
    restrictive_allow_policy_count:restrictive,
    broad_allow_policy_count:broad,
    bypass_policy_count:bypass,
    private_access_verified:ok,
    secrets_returned:false,
    external_write:false,
    production_deploy:false
  },null,2));
  if(!ok) process.exit(4);
}catch(error){
  console.error(JSON.stringify({ok:false,error:clean(error?.message||error,240),private_access_verified:false,secrets_returned:false,external_write:false,production_deploy:false}));
  process.exit(5);
}
