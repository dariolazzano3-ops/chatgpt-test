/**
 * Buffer account/channel readiness V3 (read-only).
 * All requests go to the fixed API endpoint and no token is persisted/logged.
 * Call only with operator-provided account credentials; the default is offline.
 */
const BASE='https://api.buffer.com';
const MAX_ITEMS=100;
async function queryReadOnly(query,{token,fetchImpl=globalThis.fetch}={}){
 if(!token)return {ok:false,reason:'BUFFER_ACCOUNT_NOT_CONNECTED'};
 if(typeof fetchImpl!=='function')return {ok:false,reason:'FETCH_UNAVAILABLE'};
 const response=await fetchImpl(BASE,{
  method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},
  body:JSON.stringify({query}),signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)return {ok:false,reason:'BUFFER_HTTP_'+response.status};
 const body=await response.json();
 if(body.errors?.length)return {ok:false,reason:'BUFFER_GRAPHQL_READ_ERROR'};
 return {ok:true,data:body.data};
}
export async function inspectBufferAccountV3({token,fetchImpl}={}){
 const result=await queryReadOnly('query GetOrganizations { account { organizations { id name } } }',{token,fetchImpl});
 if(!result.ok)return {status:'NOT_CONNECTED',reason:result.reason,organizations:[]};
 const orgs=result.data?.account?.organizations;
 if(!Array.isArray(orgs))return {status:'UNKNOWN',reason:'NO_ORGANIZATIONS_RETURNED',organizations:[]};
 return {status:'ACCOUNT_READ_ONLY',organizations:orgs.slice(0,MAX_ITEMS).map(x=>({id:String(x.id),name:String(x.name||'')}))};
}
export async function inspectBufferChannelsV3({token,organizationId,fetchImpl}={}){
 if(!/^[a-z0-9_-]{2,160}$/i.test(String(organizationId||'')))
    return {status:'BLOCKED',reason:'ORG_ID_REQUIRED',channels:[]};
 const query='query GetChannels { channels(input: {organizationId: '+JSON.stringify(String(organizationId))
   +'}) { id name displayName service isQueuePaused } }';
 const result=await queryReadOnly(query,{token,fetchImpl});
 if(!result.ok)return {status:'NOT_CONNECTED',reason:result.reason,channels:[]};
 const channels=result.data?.channels;
 if(!Array.isArray(channels))return {status:'UNKNOWN',reason:'NO_CHANNELS_RETURNED',channels:[]};
 return {status:'CHANNELS_READ_ONLY',channels:channels.slice(0,MAX_ITEMS).map(x=>({
    id:String(x.id||''),name:String(x.displayName||x.name||''),
    service:String(x.service||'').toLowerCase(),queue_paused:x.isQueuePaused===true
 }))};
}
export function assessLunaraPublishingReadinessV3({account=null,channels=null,mediaPublicUrl=null,ownerApproval=false}={}){
 const listed=Array.isArray(channels?.channels)?channels.channels:[];
 const services=['instagram','facebook','tiktok','youtube'];
 const known=services.filter(s=>listed.some(c=>c.service===s));
 const missing=services.filter(s=>!known.includes(s));
 const hasPublicMedia=typeof mediaPublicUrl==='string' && /^https:\/\/[^/]+\.[^/]+\//.test(mediaPublicUrl);
 return {
  schema:'jarvis.marketing.provider-readiness.v3',brand_id:'lunara',
  connected_account:account?.status==='ACCOUNT_READ_ONLY',
  verified_channels:known,missing_channels:missing,
  media_hosted_publicly:hasPublicMedia,
  owner_approved:ownerApproval===true,
  execution_allowed:false, // V3 has no external publish path
  next_gate:!account||account.status!=='ACCOUNT_READ_ONLY'?'BUFFER_CONNECTION_REQUIRED':
   missing.length?'PLATFORM_CHANNEL_CONNECTION_REQUIRED':!hasPublicMedia?'PUBLIC_MEDIA_HOST_REQUIRED':
   !ownerApproval?'OWNER_PUBLICATION_APPROVAL_REQUIRED':'PUBLISH_EXECUTOR_NOT_IMPLEMENTED'
 };
}
