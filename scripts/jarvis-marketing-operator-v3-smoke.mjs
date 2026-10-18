import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runJarvisMarketingTaskV3,jarvisMarketingCapabilityV3} from '../src/marketing-factory/jarvis-marketing-task-v3.mjs';
import {inspectBufferAccountV3,inspectBufferChannelsV3,assessLunaraPublishingReadinessV3} from '../src/marketing-factory/buffer-connection-v3.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ws=await mkdtemp(join(tmpdir(),'jarvis-marketing-v3-test-'));
try {
 const options={repoRoot:root,privateWorkspace:ws};
 const req={brandId:'lunara',day:'2026-10-19'};
 const denied=await runJarvisMarketingTaskV3({...req,task:'publish'},options);
 assert.equal(denied.ok,false);
 assert.equal(denied.reason,'EXTERNAL_ACTION_NOT_SUPPORTED');
 const plan=await runJarvisMarketingTaskV3({...req,task:'plan_day'},options);
 assert.equal(plan.ok,true);
 assert.equal(plan.published,false);
 assert.equal(plan.state,'PLAN_PREPARED');
 const week=await runJarvisMarketingTaskV3({...req,task:'plan_week'},options);
 assert.equal(week.items,7);
 assert.equal(week.scheduler_active,false);
 const status=await runJarvisMarketingTaskV3({...req,task:'status'},options);
 assert.equal(status.state,'PLAN_PREPARED');
 assert.equal(status.publishing,'BLOCKED');
 const noArt=await runJarvisMarketingTaskV3({...req,task:'render_private',artworkPath:'/tmp/missing.png'},options);
 assert.equal(noArt.reason,'ARTWORK_RIGHTS_CONFIRMATION_REQUIRED');
 await assert.rejects(runJarvisMarketingTaskV3({task:'plan_day',brandId:'../../other',day:req.day},options),/INVALID_BRAND/);
 await assert.rejects(runJarvisMarketingTaskV3({task:'plan_day',brandId:'lunara',day:'2026-02-30'},options),/INVALID_CALENDAR_DAY/);
 assert.equal(jarvisMarketingCapabilityV3().public_posting,false);
 let externalCalls=0;
 const missing=await inspectBufferAccountV3({fetchImpl:async()=>{externalCalls++;throw Error('should not call')}});
 assert.equal(missing.status,'NOT_CONNECTED');
 assert.equal(externalCalls,0);
 const fakeFetch=async(url,opts)=>{
  externalCalls++;
  assert.equal(url,'https://api.buffer.com');
  assert.ok(opts.body.includes('query '));
  assert.ok(!opts.body.includes('mutation '));
  if(opts.body.includes('GetOrganizations'))return {ok:true,json:async()=>({data:{account:{organizations:[{id:'org_lunara',name:'LUNARA'}]}}})};
  return {ok:true,json:async()=>({data:{channels:[
   {id:'ig_123',name:'lunara',displayName:'Lunara',service:'instagram',isQueuePaused:false},
   {id:'tik_123',name:'lunara',displayName:'Lunara',service:'tiktok',isQueuePaused:false}
  ]}})};
 };
 const account=await inspectBufferAccountV3({token:'MOCK_NOT_REAL',fetchImpl:fakeFetch});
 assert.equal(account.status,'ACCOUNT_READ_ONLY');
 const channels=await inspectBufferChannelsV3({token:'MOCK_NOT_REAL',organizationId:'org_lunara',fetchImpl:fakeFetch});
 assert.equal(channels.channels.length,2);
 assert.equal(externalCalls,2);
 const ready=assessLunaraPublishingReadinessV3({account,channels});
 assert.equal(ready.execution_allowed,false);
 assert.equal(ready.next_gate,'PLATFORM_CHANNEL_CONNECTION_REQUIRED');
 assert.deepEqual(ready.missing_channels,['facebook','youtube']);
 const absent=assessLunaraPublishingReadinessV3();
 assert.equal(absent.next_gate,'BUFFER_CONNECTION_REQUIRED');
 assert.equal(absent.execution_allowed,false);
 console.log('JARVIS_MARKETING_OPERATOR_V3: PASS (offline planner, approval gates, read-only Buffer mock)');
} finally {await rm(ws,{recursive:true,force:true});}
