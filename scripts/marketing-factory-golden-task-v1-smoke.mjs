import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planMarketingDayV1, evaluatePublicationReadinessV1, marketingFactoryV1Manifest } from '../src/marketing-factory/marketing-factory-v1.mjs';

const profile = JSON.parse(readFileSync(new URL('../projects/marketing-factory/brands/lunara.json', import.meta.url)));
const day = '2026-10-19';
const plan = planMarketingDayV1(profile, { day });
assert.equal(plan.brand_id,'lunara');
assert.equal(plan.production.storyboard.length,4);
assert.equal(plan.production.duration_seconds,22);
assert.equal(plan.production.media_rendered,false);
assert.equal(plan.proof.posted_and_verified,false);
assert.equal(Object.keys(plan.channels).length,5);
assert.equal(plan.channels.snapchat_spotlight.publish_allowed,false);
assert.match(plan.production.storyboard[1].scene,/PDF/);
assert.ok(plan.creative.hook.length>10);
assert.deepEqual(plan,planMarketingDayV1(profile,{day}),'idempotent plan');
assert.notEqual(plan.plan_id,planMarketingDayV1(profile,{day:'2026-10-20'}).plan_id);
assert.notEqual(plan.plan_id,planMarketingDayV1(profile,{day,creativeIndex:1}).plan_id);
assert.throws(() => planMarketingDayV1(profile,{day:'2026-02-30'}),/INVALID_CALENDAR_DAY/);
assert.throws(() => planMarketingDayV1(profile,{day,creativeIndex:-1}),/INVALID_CREATIVE_INDEX/);
assert.throws(() => planMarketingDayV1({...profile,marketing_angles:[]},{day}),/INVALID_MARKETING_ANGLES/);
const readiness=evaluatePublicationReadinessV1(plan);
assert.equal(readiness.publish_authorized,false);
assert.equal(readiness.per_platform.tiktok.connection,'NOT_CONNECTED');
assert.equal(readiness.per_platform.snapchat_spotlight.publish_authorized,false);
const allReported=evaluatePublicationReadinessV1(plan,{
  contentApproved:true,publicationApproved:true,verifiedRender:true,
  connectedPlatforms:marketingFactoryV1Manifest().platforms
});
assert.equal(allReported.publish_authorized,false,'V1 must be fail-closed');
assert.equal(allReported.per_platform.instagram.publish_authorized,false);
assert.equal(marketingFactoryV1Manifest().mode,'PREPARE_ONLY');
console.log('MARKETING_FACTORY_GOLDEN_TASK_V1: PASS (offline, 5 channels, fail-closed)');
console.log(JSON.stringify({
  plan_id:plan.plan_id,brand:plan.brand_id,day:plan.day,
  video_seconds:plan.production.duration_seconds,
  hook:plan.creative.hook,status:'CONTENT_PLAN_ONLY',live_posts:0
},null,2));
