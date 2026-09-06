#!/usr/bin/env node
const clean=(v,max=2000)=>String(v??'').trim().slice(0,max);
const accountId=clean(process.env.CLOUDFLARE_ACCOUNT_ID,64);
const token=clean(process.env.CLOUDFLARE_API_TOKEN,4000);
const previewHost=clean(process.env.JAGUAR_PAGES_PREVIEW_HOST||'project-jaguar-gelato-v1.chatgpt-factory-preview.pages.dev',500).toLowerCase();
const sourceHost=clean(process.env.JAGUAR_ACCESS_SOURCE_HOST||'control.aurentarasystems.com',500).toLowerCase();

if(!/^[a-f0-9]{32}$/i.test(accountId)||!token){
  console.error(JSON.stringify({ok:false,error:'CLOUDFLARE_ACCESS_WRITE_CREDENTIALS_REQUIRED',secrets_returned:false,production_deploy:false}));
  process.exit(2);
}
const api='https://api.cloudflare.com';
async function request(method,path,body){
  const url=new URL(path,api);
  if(url.origin!==api||!url.pathname.startsWith('/client/v4/')) throw new Error('CLOUDFLARE_API_PATH_REJECTED');
  const res=await fetch(url,{
    method,
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined
  });
  const text=await res.text();
  let json=null; try{json=JSON.parse(text)}catch{}
  if(!res.ok||json?.success===false){
    const code=json?.errors?.[0]?.code||res.status;
    throw Object.assign(new Error(`CLOUDFLARE_API_${method}_FAILED:${code}`),{status:res.status});
  }
  return json?.result;
}
function targets(app={}){
  const out=[];
  if(app.domain) out.push(String(app.domain));
  for(const d of Array.isArray(app.destinations)?app.destinations:[]) if(String(d?.type||'').toLowerCase()==='public'&&d?.uri) out.push(String(d.uri));
  return out;
}
function hostname(value){try{return new URL(String(value).includes('://')?String(value):`https://${value}`).hostname.toLowerCase()}catch{return''}}
function hostEquals(app,host){return targets(app).some(v=>hostname(v)===host)}
function keys(rule){return rule&&typeof rule==='object'&&!Array.isArray(rule)?Object.keys(rule).map(k=>k.toLowerCase()):[]}
function broad(policy={}){
  if(String(policy.decision||'').toLowerCase()!=='allow') return false;
  const include=Array.isArray(policy.include)?policy.include:[];
  return !include.length||include.some(r=>keys(r).some(k=>['everyone','login_method'].includes(k)));
}
function restrictive(policy={}){
  return String(policy.decision||'').toLowerCase()==='allow'
    && Array.isArray(policy.include)
    && policy.include.length>0
    && !broad(policy);
}
async function listApps(){return await request('GET',`/client/v4/accounts/${accountId}/access/apps?per_page=100`)}
async function policies(appId){return await request('GET',`/client/v4/accounts/${accountId}/access/apps/${appId}/policies?per_page=100`)}

let createdAppId=null;
try{
  const apps=Array.isArray(await listApps())?await listApps():[];
  const existing=apps.filter(a=>String(a.type||'').toLowerCase()==='self_hosted'&&hostEquals(a,previewHost));
  if(existing.length>1) throw new Error('JAGUAR_ACCESS_APP_AMBIGUOUS');

  let app=existing[0]||null;
  if(!app){
    const sourceApps=apps.filter(a=>String(a.type||'').toLowerCase()==='self_hosted'&&hostEquals(a,sourceHost));
    if(sourceApps.length!==1) throw new Error(sourceApps.length?'SOURCE_ACCESS_APP_AMBIGUOUS':'SOURCE_ACCESS_APP_NOT_FOUND');
    const sourcePolicies=Array.isArray(await policies(sourceApps[0].id))?await policies(sourceApps[0].id):[];
    const bypass=sourcePolicies.filter(p=>String(p.decision||'').toLowerCase()==='bypass').length;
    const broadCount=sourcePolicies.filter(broad).length;
    const restrictivePolicies=sourcePolicies.filter(restrictive);
    if(bypass||broadCount||!restrictivePolicies.length) throw new Error('SOURCE_ACCESS_POLICY_NOT_RESTRICTIVE');

    app=await request('POST',`/client/v4/accounts/${accountId}/access/apps`,{
      name:'PROJECT JAGUAR Gelato Private Preview',
      domain:previewHost,
      type:'self_hosted',
      session_duration:'4h',
      app_launcher_visible:false
    });
    createdAppId=clean(app?.id,80);
    if(!createdAppId) throw new Error('JAGUAR_ACCESS_APP_CREATE_NO_ID');

    let precedence=1;
    for(const sourcePolicy of restrictivePolicies){
      await request('POST',`/client/v4/accounts/${accountId}/access/apps/${createdAppId}/policies`,{
        name:`PROJECT JAGUAR preview allow ${precedence}`,
        decision:'allow',
        include:sourcePolicy.include,
        exclude:Array.isArray(sourcePolicy.exclude)?sourcePolicy.exclude:[],
        require:Array.isArray(sourcePolicy.require)?sourcePolicy.require:[],
        precedence
      });
      precedence+=1;
    }
  }

  const appId=clean(app.id,80);
  const finalPolicies=Array.isArray(await policies(appId))?await policies(appId):[];
  const bypass=finalPolicies.filter(p=>String(p.decision||'').toLowerCase()==='bypass').length;
  const broadCount=finalPolicies.filter(broad).length;
  const restrictiveCount=finalPolicies.filter(restrictive).length;
  if(bypass||broadCount||restrictiveCount<1) throw new Error('JAGUAR_ACCESS_FINAL_POLICY_NOT_RESTRICTIVE');

  console.log(JSON.stringify({
    ok:true,
    schema:'riosystems.project-jaguar.access-provision.v1',
    preview_host:previewHost,
    source_access_host:sourceHost,
    app_created:Boolean(createdAppId),
    restrictive_allow_policy_count:restrictiveCount,
    broad_allow_policy_count:broadCount,
    bypass_policy_count:bypass,
    private_access_ready:true,
    production_deploy:false,
    dns_changes:false,
    billing_changes:false,
    secrets_returned:false
  },null,2));
}catch(error){
  if(createdAppId){
    try{await request('DELETE',`/client/v4/accounts/${accountId}/access/apps/${createdAppId}`)}catch{}
  }
  console.error(JSON.stringify({
    ok:false,
    error:clean(error?.message||error,300),
    preview_host:previewHost,
    rollback_attempted:Boolean(createdAppId),
    production_deploy:false,
    dns_changes:false,
    billing_changes:false,
    secrets_returned:false
  }));
  process.exit(3);
}
