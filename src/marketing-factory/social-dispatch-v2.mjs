/**
 * Universal Marketing Factory | Buffer draft adapter V2
 * Official Buffer GraphQL API: https://api.buffer.com
 *
 * Only saves drafts after explicit scoped approval. NEVER publishes or queues
 * automatically. No changes to JARVIS/Hermes, production, DNS, billing or secrets.
 */
import { createHash } from 'node:crypto';

export const SOCIAL_PLATFORMS_V2 = Object.freeze([
  'tiktok', 'instagram', 'facebook', 'youtube_shorts', 'snapchat_spotlight'
]);
export const BUFFER_PLATFORMS_V2 = Object.freeze([
  'tiktok', 'instagram', 'facebook', 'youtube_shorts'
]);
const simple = value => String(value ?? '').trim();
const ID_RE = /^[a-zA-Z0-9_-]{2,160}$/;
const isDangerousIP = host => /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|.*\.local)$/i.test(host);

function assertPlan(plan) {
  if (plan?.schema !== 'jarvis.universal-marketing-factory.plan.v1'
      || !ID_RE.test(simple(plan.plan_id))
      || !ID_RE.test(simple(plan.brand_id))) throw new Error('INVALID_MARKETING_PLAN');
  if (plan.lifecycle !== 'DRAFT' || plan.policy?.no_external_posts !== true)
    throw new Error('UNSAFE_PLAN');
  if (!plan.channels || SOCIAL_PLATFORMS_V2.some(platform => !plan.channels[platform]))
    throw new Error('INCOMPLETE_PLATFORM_DRAFTS');
  return plan;
}
function validateMediaUrl(url) {
  if (typeof url !== 'string') throw new Error('MEDIA_PUBLIC_URL_REQUIRED');
  let u;
  try {u=new URL(url);} catch {throw new Error('MEDIA_PUBLIC_URL_REQUIRED');}
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.') || isDangerousIP(u.hostname)
     || url.length > 2000 || /[%]0[0ad]/i.test(url) || u.hash) throw new Error('UNSAFE_MEDIA_URL');
  return u.href;
}
export function prepareSocialHandoffV2(plan,{asset=null,channelIds={}}={}) {
  const p=assertPlan(plan);
  const validAsset=Boolean(asset?.media_rendered===true && asset?.sha256 && /^[a-f0-9]{64}$/i.test(asset.sha256) && asset?.duration_seconds>=3 && asset?.duration_seconds<=180 && asset?.aspect_ratio==='9:16');
  const platforms={};
  for (const platform of SOCIAL_PLATFORMS_V2){
    const channelId=channelIds[platform];
    const provider=platform==='snapchat_spotlight'?'MANUAL':'BUFFER';
    platforms[platform]={
      provider,
      channel_configured:provider==='BUFFER' && ID_RE.test(simple(channelId)),
      approved:false,remote_draft_id:null,published_url:null,
      state:provider==='MANUAL'?'MANUAL_HANDOFF_ONLY':'PREPARE_ONLY',
      reason:provider==='MANUAL'?'SNAPCHAT_SPOTLIGHT_API_NOT_BOUND':!validAsset?'MEDIA_NOT_VERIFIED':
        !ID_RE.test(simple(channelId))?'CHANNEL_UNCONFIGURED':'AWAITING_OWNER_APPROVAL'
    };
  }
  return {schema:'jarvis.marketing.social-handoff.v2',plan_id:p.plan_id,brand_id:p.brand_id,
    media_verified:validAsset,media_sha256:validAsset?asset.sha256:null,
    channels:platforms,external_posts_created:0,published_posts_verified:0,
    no_autopublish:true,no_spend:true};
}
export function buildBufferSaveDraftMutationV2(plan,{platform,channelId,publicMediaUrl}={}) {
  const p=assertPlan(plan);
  if (!BUFFER_PLATFORMS_V2.includes(platform)) throw new Error('UNSUPPORTED_BUFFER_PLATFORM');
  if (!ID_RE.test(simple(channelId))) throw new Error('INVALID_CHANNEL_ID');
  const mediaUrl=validateMediaUrl(publicMediaUrl);
  const c=p.channels[platform];
  if (!c || c.publish_allowed !== false || c.publish_state !== 'DRAFT') throw new Error('UNSAFE_CHANNEL');
  const caption=[simple(c.caption), ...(c.hashtags||[]).filter(x=>/^#[\p{L}\p{N}_]+$/u.test(x))].filter(Boolean).join(' ').slice(0,2100);
  // GraphQL strings escaped via JSON.stringify. saveToDraft:true is the hard gate.
  return {
    operationName:'CreatePost',
    query:'mutation CreatePost { createPost(input: {'
      +'channelId: '+JSON.stringify(channelId)
      +' text: '+JSON.stringify(caption)
      +' schedulingType: automatic mode: addToQueue saveToDraft: true '
      +'assets: [{video: {url: '+JSON.stringify(mediaUrl)+'}}]'
      +'}) { ... on PostActionSuccess { post { id status } } '
      +'... on MutationError { message } } }',
    expected_platform:platform,never_schedule:true
  };
}
/**
 * Bounded operator-approved write: saves ONE draft to Buffer.
 * Does not perform auto-publish, never retries itself; caller stores receipt.
 */
export async function saveBufferDraftApprovedV2(plan,options={}){
  assertPlan(plan);
  const {platform,channelId,publicMediaUrl,mediaSha256,approvedPlanId,approvedMediaSha256,
    ownerApproved,token,fetchImpl=globalThis.fetch}=options;
  if (ownerApproved!==true || approvedPlanId!==plan.plan_id
    || !/^[a-f0-9]{64}$/i.test(simple(mediaSha256))
    || simple(mediaSha256).toLowerCase()!==simple(approvedMediaSha256).toLowerCase())
    return {ok:false,state:'BLOCKED',reason:'SCOPED_OWNER_APPROVAL_REQUIRED'};
  if (!simple(token) || typeof fetchImpl!=='function') return {ok:false,state:'BLOCKED',reason:'BUFFER_TOKEN_NOT_BOUND'};
  const payload=buildBufferSaveDraftMutationV2(plan,{platform,channelId,publicMediaUrl});
  // Never attempt writes with a post already assigned a remote id.
  if (simple(options.existingRemoteDraftId)) return {ok:false,state:'BLOCKED',reason:'DUPLICATE_REMOTE_DRAFT'};
  const response=await fetchImpl('https://api.buffer.com',{
    method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},
    body:JSON.stringify({operationName:payload.operationName,query:payload.query}),
    signal:options.signal
  });
  if (!response.ok) return {ok:false,state:'PROVIDER_ERROR',reason:'BUFFER_HTTP_'+response.status};
  const body=await response.json();
  if (body.errors?.length) return {ok:false,state:'PROVIDER_ERROR',reason:'BUFFER_GRAPHQL_ERROR'};
  const result=body.data?.createPost;
  if (!result?.post?.id) return {ok:false,state:'PROVIDER_ERROR',reason:'BUFFER_DRAFT_NOT_CONFIRMED'};
  // Only a saved draft, NOT a published post or a scheduled item.
  return {ok:true,state:'BUFFER_DRAFT_SAVED',provider:'BUFFER',draft_id:String(result.post.id),
    status:result.post.status||'DRAFT_UNVERIFIED',platform,
    publish_verified:false,scheduled_verified:false,
    receipt_hash:createHash('sha256').update([plan.plan_id,platform,String(result.post.id)].join('|')).digest('hex')};
}
export function socialPublishingCapabilityV2(){
  return {mode:'DRAFT_ONLY',live_posting:false,auto_schedule:false,auto_spend:false,
    secrets_in_code:false,publish_verified:false,
    buffer_drafts_supported:[...BUFFER_PLATFORMS_V2],snapchat:'MANUAL_HANDOFF'};
}
