#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const API='https://api.cloudflare.com/client/v4';
const clean=(v,max=1600)=>String(v??'').trim().slice(0,max);
const token=clean(process.env.CLOUDFLARE_API_TOKEN);
const accountId=clean(process.env.CLOUDFLARE_ACCOUNT_ID,80);
const workerName='aurentara-hq-private-preview';

if(!token||!/^[a-f0-9]{32}$/i.test(accountId)){
  throw new Error('CLOUDFLARE_CREDENTIALS_REQUIRED');
}

async function cf(path,{method='GET',body}={}){
  const response=await fetch(API+path,{
    method,
    headers:{
      authorization:'Bearer '+token,
      accept:'application/json',
      ...(body?{'content-type':'application/json'}:{})
    },
    body:body?JSON.stringify(body):undefined,
    redirect:'error'
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.success===false){
    const code=payload?.errors?.[0]?.code||response.status;
    const message=payload?.errors?.[0]?.message||'Cloudflare API request failed';
    throw new Error('CLOUDFLARE_API_'+method+'_'+code+':'+clean(message,240));
  }
  return payload?.result;
}

function targetOf(app={}){
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

function deriveOwnerEmail(policies=[]){
  if(policies.some(p=>clean(p?.decision,80).toLowerCase()==='bypass')) throw new Error('SOURCE_ACCESS_BYPASS_POLICY_REJECTED');
  const allow=policies.filter(p=>clean(p?.decision,80).toLowerCase()==='allow');
  if(!allow.length)throw new Error('SOURCE_ACCESS_ALLOW_POLICY_MISSING');
  const emails=new Set();
  for(const p of allow){
    const include=Array.isArray(p?.include)?p.include:[];
    if(!include.length)throw new Error('SOURCE_ACCESS_BROAD_ALLOW_POLICY_REJECTED');
    for(const rule of include){
      const keys=selectorKeys(rule);
      if(keys.includes('everyone')||keys.includes('login_method'))throw new Error('SOURCE_ACCESS_BROAD_ALLOW_POLICY_REJECTED');
      const email=emailFromRule(rule);
      if(email)emails.add(email);
    }
  }
  if(emails.size!==1)throw new Error(emails.size?'SOURCE_ACCESS_OWNER_AMBIGUOUS':'SOURCE_ACCESS_OWNER_NOT_RESOLVABLE');
  return [...emails][0];
}

function verifyPreviewPolicies(policies=[],ownerEmail=''){
  if(policies.some(p=>clean(p?.decision,80).toLowerCase()==='bypass'))return false;
  const allow=policies.filter(p=>clean(p?.decision,80).toLowerCase()==='allow');
  if(!allow.length)return false;
  const emails=new Set();
  for(const p of allow){
    const include=Array.isArray(p?.include)?p.include:[];
    if(!include.length)return false;
    for(const rule of include){
      const keys=selectorKeys(rule);
      if(keys.includes('everyone')||keys.includes('login_method'))return false;
      const email=emailFromRule(rule);
      if(email)emails.add(email);
    }
  }
  return emails.size===1&&emails.has(ownerEmail);
}

function putSecret(name,value){
  const result=spawnSync('npx',['wrangler','secret','put',name,'--config','wrangler.hq-preview.jsonc'],{
    input:String(value)+'\n',
    encoding:'utf8',
    env:process.env,
    stdio:['pipe','pipe','pipe']
  });
  if(result.status!==0)throw new Error('PREVIEW_WORKER_SECRET_WRITE_FAILED:'+name);
}

const subdomainResult=await cf('/accounts/'+accountId+'/workers/subdomain');
const subdomain=clean(subdomainResult?.subdomain,240).toLowerCase();
if(!subdomain)throw new Error('WORKERS_DEV_SUBDOMAIN_NOT_FOUND');

let apps=await cf('/accounts/'+accountId+'/access/apps?per_page=100');
apps=Array.isArray(apps)?apps:[];

const sourceApp=apps.find(app=>{
  const t=targetOf(app);
  return clean(app.type,80).toLowerCase()==='self_hosted'&&
    t?.hostname===('riosystems-staging.'+subdomain+'.workers.dev')&&
    t?.pathname==='/operator';
});
if(!sourceApp?.id)throw new Error('SOURCE_STAGING_ACCESS_APP_NOT_FOUND');

const sourcePolicies=await cf('/accounts/'+accountId+'/access/apps/'+sourceApp.id+'/policies?per_page=100');
const ownerEmail=deriveOwnerEmail(Array.isArray(sourcePolicies)?sourcePolicies:[]);
console.log('::add-mask::'+ownerEmail);

const previewHost=workerName+'.'+subdomain+'.workers.dev';
let previewApp=apps.find(app=>{
  const t=targetOf(app);
  return clean(app.type,80).toLowerCase()==='self_hosted'&&t?.hostname===previewHost&&t?.pathname==='/';
});

if(!previewApp){
  previewApp=await cf('/accounts/'+accountId+'/access/apps',{
    method:'POST',
    body:{
      name:'AURENTARA HQ Private Preview',
      type:'self_hosted',
      domain:previewHost,
      session_duration:'24h',
      app_launcher_visible:false,
      auto_redirect_to_identity:false
    }
  });
}
if(!previewApp?.id||!clean(previewApp.aud,500))throw new Error('PREVIEW_ACCESS_APP_INVALID');

let previewPolicies=await cf('/accounts/'+accountId+'/access/apps/'+previewApp.id+'/policies?per_page=100');
previewPolicies=Array.isArray(previewPolicies)?previewPolicies:[];

if(!previewPolicies.length){
  await cf('/accounts/'+accountId+'/access/apps/'+previewApp.id+'/policies',{
    method:'POST',
    body:{
      name:'AURENTARA HQ Preview Owner Only',
      precedence:1,
      decision:'allow',
      include:[{email:{email:ownerEmail}}],
      exclude:[],
      require:[]
    }
  });
  previewPolicies=await cf('/accounts/'+accountId+'/access/apps/'+previewApp.id+'/policies?per_page=100');
}
if(!verifyPreviewPolicies(previewPolicies,ownerEmail))throw new Error('PREVIEW_ACCESS_POLICY_NOT_OWNER_ONLY');

putSecret('HQ_PREVIEW_OPERATOR_EMAIL',ownerEmail);

const previewUrl='https://'+previewHost+'/';
if(process.env.GITHUB_OUTPUT){
  await import('node:fs/promises').then(({appendFile})=>appendFile(process.env.GITHUB_OUTPUT,'preview_url='+previewUrl+'\n'));
}
console.log(JSON.stringify({
  ok:true,
  schema:'aurentara.hq-private-preview-access.v1',
  preview_url:previewUrl,
  workers_dev:true,
  access_application_configured:true,
  owner_only_policy_verified:true,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  external_writes:false,
  sensitive_values_returned:false
},null,2));
