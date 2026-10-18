import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMarketingBacklogV2} from '../src/marketing-factory/daily-backlog-v2.mjs';
const profile=JSON.parse(readFileSync(new URL('../projects/marketing-factory/brands/lunara.json',import.meta.url),'utf8'));
const backlog=createMarketingBacklogV2(profile,{startDate:'2026-10-19',days:7});
assert.equal(backlog.content_items.length,7);
assert.equal(backlog.end_date,'2026-10-25');
assert.equal(backlog.post_count,0);
assert.equal(backlog.scheduler_active,false);
assert.equal(backlog.live_channels_bound,false);
assert.equal(new Set(backlog.content_items.map(x=>x.plan_id)).size,7);
for(const item of backlog.content_items){
  assert.equal(item.media_state,'NOT_RENDERED');
  assert.equal(item.approval_state,'REQUIRES_REVIEW');
  assert.equal(item.external_posts_created,0);
  assert.equal(Object.keys(item.channels).length,5);
  assert.equal(item.channels.snapchat_spotlight.state,'MANUAL_HANDOFF_ONLY');
}
assert.deepEqual(backlog,createMarketingBacklogV2(profile,{startDate:'2026-10-19',days:7}));
assert.throws(()=>createMarketingBacklogV2(profile,{startDate:'2026-02-30'}),/INVALID_START_DATE/);
assert.throws(()=>createMarketingBacklogV2(profile,{startDate:'2026-10-19',days:15}),/INVALID_BACKLOG_DAYS/);
console.log('MARKETING_BACKLOG_V2: PASS (7 days, 5 destinations, 0 posts, fail-closed)');
