/**
 * Seven-day, multi-brand editorial backlog. Pure data; no scheduler or posts.
 * Can be called each day by a future JARVIS-owned scheduler after activation.
 */
import { createHash } from 'node:crypto';
import { planMarketingDayV1 } from './marketing-factory-v1.mjs';
import { prepareSocialHandoffV2 } from './social-dispatch-v2.mjs';

export function createMarketingBacklogV2(profile,{startDate,days=7,channelIds={}}={}){
  if (!Number.isInteger(days)||days<1||days>14) throw new Error('INVALID_BACKLOG_DAYS');
  const anchor=new Date(startDate+'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate||'') || !Number.isFinite(anchor.getTime())
    || anchor.toISOString().slice(0,10)!==startDate) throw new Error('INVALID_START_DATE');
  const items=[];
  for(let i=0;i<days;i++){
    const date=new Date(anchor.getTime()+i*86400000).toISOString().slice(0,10);
    const plan=planMarketingDayV1(profile,{day:date});
    items.push({date,plan_id:plan.plan_id,hook:plan.creative.hook,creative:plan.creative,
      storyboard:plan.production.storyboard,brand_id:plan.brand_id,
      media_state:'NOT_RENDERED',approval_state:'REQUIRES_REVIEW',
      channels:prepareSocialHandoffV2(plan,{channelIds}).channels,
      external_posts_created:0,verified_publications:0});
  }
  return {
    schema:'jarvis.marketing.editorial-backlog.v2',brand_id:profile.brand_id,
    start_date:startDate,end_date:items[items.length-1].date,
    content_items:items,post_count:0,scheduler_active:false,
    live_channels_bound:false,owner_approval_required:true,
    idempotency_key:createHash('sha256').update(profile.brand_id+'|'+startDate+'|'+days).digest('hex').slice(0,24)
  };
}
