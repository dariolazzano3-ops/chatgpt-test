/**
 * JARVIS Universal Marketing Factory V1.
 * Pure, deterministic planning capability. NO external writes, keys, or network calls.
 */
import { createHash } from 'node:crypto';

const PLATFORMS = Object.freeze(['tiktok', 'instagram', 'facebook', 'youtube_shorts', 'snapchat_spotlight']);
const clean = (x, max=300) => String(x ?? '').trim().slice(0,max);
function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('INVALID_DAY_FORMAT');
  const date = new Date(day + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day) throw new Error('INVALID_CALENDAR_DAY');
  return date;
}
function validateProfile(p) {
  if (!p || !/^[a-z0-9][a-z0-9_-]{1,47}$/.test(p.brand_id || '')) throw new Error('INVALID_BRAND_ID');
  if (!clean(p.display_name,80) || !clean(p.product?.description,400) || !clean(p.product?.type,100) || !clean(p.audience,300)) throw new Error('INCOMPLETE_BRAND_PROFILE');
  if (!Array.isArray(p.marketing_angles) || p.marketing_angles.length < 2 || p.marketing_angles.some(a => !clean(a?.hook) || !clean(a?.idea))) throw new Error('INVALID_MARKETING_ANGLES');
  if (!Array.isArray(p.allowed_claims) || !p.allowed_claims.length || p.allowed_claims.some(x => !clean(x))) throw new Error('INVALID_ALLOWED_CLAIMS');
  if (!Array.isArray(p.forbidden_claims)) throw new Error('FORBIDDEN_CLAIMS_REQUIRED');
  return p;
}
const idFor = (values) => createHash('sha256').update(values.join('|')).digest('hex').slice(0,16);

/**
 * Generate one human-reviewable vertical video storyboard and five platform
 * drafts. This function DOES NOT generate actual media or publish anything.
 */
export function planMarketingDayV1(profile, { day, creativeIndex=0 }={}) {
  const p = validateProfile(profile);
  const date = validDay(day);
  if (!Number.isSafeInteger(creativeIndex) || creativeIndex < 0 || creativeIndex > 19) throw new Error('INVALID_CREATIVE_INDEX');
  const angle = p.marketing_angles[(Math.floor(date.getTime()/86400000)+creativeIndex)%p.marketing_angles.length];
  const planId = [p.brand_id,day,creativeIndex,idFor([p.brand_id,day,String(creativeIndex),angle.hook])].join('-');
  const caption = [clean(angle.hook,180),clean(angle.idea,220),clean(p.cta,150)].filter(Boolean).join(' ');
  const storyboard = [
    { seconds:'0-3',scene:'Emotionale Einstiegsfrage',overlay:clean(angle.hook,90) },
    { seconds:'3-8',scene:'Das echte Produkt zeigen: '+clean(p.product.description,180),overlay:clean(p.allowed_claims[0],90) },
    { seconds:'8-15',scene:clean(angle.idea,220),overlay:clean(p.allowed_claims[1] || p.allowed_claims[0],90) },
    { seconds:'15-22',scene:'Ruhiger Abschluss, klarer CTA',overlay:clean(p.cta,90) }
  ];
  const channels = Object.fromEntries(PLATFORMS.map(platform => [platform,{
    platform,format:'vertical_9_16_video',caption,
    hashtags:(p.hashtags || []).filter(h => /^#[\p{L}\p{N}_]+$/u.test(h)).slice(0,6),
    publish_state:'DRAFT',publish_allowed:false,auth_status:'UNVERIFIED',
    publication_id:null,verified_live_url:null,
    notes:platform==='snapchat_spotlight'
      ? 'Account-specific official publishing support unverified. Default to manual handoff.'
      : 'Requires account-authorized publishing integration and human approval.'
  }]));
  return {
    schema:'jarvis.universal-marketing-factory.plan.v1',plan_id:planId,brand_id:p.brand_id,
    day,creative_index:creativeIndex,lifecycle:'DRAFT',
    creative:{hook:clean(angle.hook,180),concept:clean(angle.idea,300),cta:clean(p.cta,160),audience:clean(p.audience,300),product_type:clean(p.product.type,120)},
    production:{media_rendered:false,media_location:null,format:'vertical_9_16_video',
      duration_seconds:22,storyboard,generation_prompt:clean(p.visual_direction,380),
      asset_policy:'Owned/licensed media only. Never fabricate reviews or use identifiable children without consent.'},
    channels,
    metrics:{impressions:null,views:null,clicks:null,orders:null,revenue_eur:null,attribution_status:'NOT_CONNECTED'},
    approvals:{content:false,publication:false,marketing_spend:false},
    policy:{no_paid_model_calls:true,no_external_posts:true,no_production_deploy:true,
      no_secret_access:true,no_shared_brand_memory:true,no_fabricated_metrics:true,
      forbidden_claims:p.forbidden_claims},
    proof:{quality_tests_passed:false,posted_and_verified:false,source:'LOCAL_PLAN_ONLY'}
  };
}

/** V1 always remains PREPARE_ONLY, even if all provided readiness flags are true. */
export function evaluatePublicationReadinessV1(plan,{contentApproved=false,publicationApproved=false,verifiedRender=false,connectedPlatforms=[]}={}) {
  if (plan?.schema !== 'jarvis.universal-marketing-factory.plan.v1') throw new Error('INVALID_PLAN');
  const connected = new Set(connectedPlatforms.filter(x => PLATFORMS.includes(x)));
  const gates = {
    content_approved:contentApproved===true,
    publication_approved:publicationApproved===true,
    rendered_asset_verified:verifiedRender===true,
    all_platforms_connected:PLATFORMS.every(x => connected.has(x)),
    paid_spend_approved:false
  };
  return {plan_id:plan.plan_id,state:'PREPARE_ONLY',publish_authorized:false,gates,
    per_platform:Object.fromEntries(PLATFORMS.map(platform => [platform,{
      connection:connected.has(platform)?'OPERATOR_REPORTED':'NOT_CONNECTED',
      ready_for_next_stage:gates.content_approved && gates.publication_approved && gates.rendered_asset_verified && connected.has(platform),
      publish_authorized:false
    }])),
    reason:'V1_HAS_NO_LIVE_PUBLISH_EXECUTOR'
  };
}
export function marketingFactoryV1Manifest() {
  return {schema:'jarvis.universal-marketing-factory.manifest.v1',mode:'PREPARE_ONLY',
    providers_connected:[],live_rendering:false,live_publishing:false,
    platform_api_scopes_verified:false,brand_data_isolation:true,platforms:[...PLATFORMS]};
}
