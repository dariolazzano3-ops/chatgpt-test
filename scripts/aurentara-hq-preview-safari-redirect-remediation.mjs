#!/usr/bin/env node
const API='https://api.cloudflare.com/client/v4';
const clean=(v,max=1600)=>String(v??'').trim().slice(0,max);
const token=clean(process.env.CLOUDFLARE_API_TOKEN,1800);
const accountId=clean(process.env.CLOUDFLARE_ACCOUNT_ID,80);
const previewHost='aurentara-hq-private-preview.gelato-donatello-dario-a5a5376c.workers.dev';
if(!token||!/^[a-f0-9]{32}$/i.test(accountId))throw new Error('CLOUDFLARE_CREDENTIALS_REQUIRED');

async function cf(path,{method='GET',body}={}){
  const r=await fetch(API+path,{
    method,
    headers:{authorization:'Bearer '+token,accept:'application/json',...(body?{'content-type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
    redirect:'error'
  });
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.success===false){
    const code=b?.errors?.[0]?.code||r.status;
    const msg=b?.errors?.[0]?.message||'Cloudflare API request failed';
    throw new Error('CF_'+method+'_'+code+':'+clean(msg,240));
  }
  return b?.result;
}
function target(app={}){
  try{
    const raw=clean(app.domain,500);
    const u=new URL(raw.includes('://')?raw:'https://'+raw);
    return {hostname:u.hostname.toLowerCase(),pathname:u.pathname.replace(/\/+$/,'')||'/'};
  }catch{return null;}
}
function selectorKeys(rule={}){
  return rule&&typeof rule==='object'&&!Array.isArray(rule)?Object.keys(rule).map(k=>k.toLowerCase()):[];
}
function emailFromRule(rule={}){
  const v=rule?.email;
  if(typeof v==='string')return clean(v,320).toLowerCase();
  if(v&&typeof v==='object')return clean(v.email,320).toLowerCase();
  return '';
}
function ownerOnly(policies=[]){
  if(policies.some(p=>clean(p?.decision,80).toLowerCase()==='bypass'))return false;
  const allow=policies.filter(p=>clean(p?.decision,80).toLowerCase()==='allow');
  if(allow.length!==1)return false;
  const include=Array.isArray(allow[0]?.include)?allow[0].include:[];
  if(!include.length)return false;
  const emails=new Set();
  for(const rule of include){
    const keys=selectorKeys(rule);
    if(keys.includes('everyone')||keys.includes('login_method'))return false;
    const email=emailFromRule(rule); if(email)emails.add(email);
  }
  return emails.size===1;
}

const appsRaw=await cf('/accounts/'+accountId+'/access/apps?per_page=100');
const apps=Array.isArray(appsRaw)?appsRaw:[];
const matches=apps.filter(app=>target(app)?.hostname===previewHost&&target(app)?.pathname==='/');
if(matches.length!==1)throw new Error(matches.length?'PREVIEW_ACCESS_APP_AMBIGUOUS':'PREVIEW_ACCESS_APP_NOT_FOUND');
const app=matches[0];
if(clean(app.name,160)!=='AURENTARA HQ Private Preview'||clean(app.type,80)!=='self_hosted')throw new Error('PREVIEW_ACCESS_APP_IDENTITY_MISMATCH');

const policiesRaw=await cf('/accounts/'+accountId+'/access/apps/'+app.id+'/policies?per_page=100');
const policies=Array.isArray(policiesRaw)?policiesRaw:[];
if(!ownerOnly(policies))throw new Error('PREVIEW_ACCESS_OWNER_ONLY_POLICY_REQUIRED');

const before={
  same_site_cookie_attribute:app.same_site_cookie_attribute??null,
  eager_redirect_cookie_setting:app.eager_redirect_cookie_setting??null,
  enable_binding_cookie:app.enable_binding_cookie??null,
  http_only_cookie_attribute:app.http_only_cookie_attribute??null
};

await cf('/accounts/'+accountId+'/access/apps/'+app.id,{
  method:'PUT',
  body:{
    type:'self_hosted',
    name:'AURENTARA HQ Private Preview',
    domain:previewHost,
    session_duration:'24h',
    app_launcher_visible:false,
    auto_redirect_to_identity:false,
    http_only_cookie_attribute:true,
    same_site_cookie_attribute:'lax',
    eager_redirect_cookie_setting:false,
    enable_binding_cookie:false,
    options_preflight_bypass:false
  }
});

await cf('/accounts/'+accountId+'/access/apps/'+app.id+'/revoke_tokens',{method:'POST',body:{}});

const after=await cf('/accounts/'+accountId+'/access/apps/'+app.id);
const afterTarget=target(after);
const afterPoliciesRaw=await cf('/accounts/'+accountId+'/access/apps/'+app.id+'/policies?per_page=100');
const afterPolicies=Array.isArray(afterPoliciesRaw)?afterPoliciesRaw:[];
const valid=
  afterTarget?.hostname===previewHost&&
  afterTarget?.pathname==='/'&&
  clean(after.type,80)==='self_hosted'&&
  after.same_site_cookie_attribute==='lax'&&
  after.eager_redirect_cookie_setting===false&&
  after.enable_binding_cookie===false&&
  after.http_only_cookie_attribute===true&&
  ownerOnly(afterPolicies);
if(!valid)throw new Error('PREVIEW_ACCESS_COOKIE_REMEDIATION_VERIFY_FAILED');

const first=await fetch('https://'+previewHost+'/',{redirect:'manual'});
const loc=first.headers.get('location');
let safeLocation=null;
if(loc){
  const u=new URL(loc,'https://'+previewHost+'/');
  safeLocation={hostname:u.hostname,pathname:u.pathname};
}
if(first.status!==302||safeLocation?.hostname!=='riosystems.cloudflareaccess.com')throw new Error('PREVIEW_ACCESS_UNAUTHENTICATED_GATE_VERIFY_FAILED');

console.log(JSON.stringify({
  ok:true,
  schema:'aurentara.hq-private-preview-safari-redirect-remediation.v1',
  preview_url:'https://'+previewHost+'/',
  before,
  after:{
    same_site_cookie_attribute:after.same_site_cookie_attribute??null,
    eager_redirect_cookie_setting:after.eager_redirect_cookie_setting??null,
    enable_binding_cookie:after.enable_binding_cookie??null,
    http_only_cookie_attribute:after.http_only_cookie_attribute??null,
    owner_only_policy_verified:true
  },
  access_tokens_revoked:true,
  unauthenticated_gate:{status:first.status,location:safeLocation},
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  external_writes:false
},null,2));
