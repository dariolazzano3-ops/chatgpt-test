import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {makeDailyPlan,makeRunwayRequest,checkReadiness,
  submitRunwayPilot,prepareBufferVideoRequests} from '../src/marketing-factory/lunara-autopilot-pilot-v1.mjs';
const date='2026-10-23';
const plan=makeDailyPlan(date);
assert.equal(plan.estimatedVideoUsd,0.25);
assert.equal(plan.publishing,false);
assert.equal(plan.aiClipSeconds,5);
const readiness=checkReadiness();
assert.equal(readiness.stage,'NOT_READY');
assert.ok(readiness.blocked.includes('RUNWAY_API_KEY_MISSING'));
assert.ok(readiness.blocked.includes('ORIGINAL_LOGO_MISSING'));
const img='data:image/png;base64,'+'QUJD'.repeat(400);
const request=makeRunwayRequest({promptImage:img,promptText:'A cozy bedtime reading scene, slow gentle camera movement, natural warm lighting, cinematic image-to-video framing'});
assert.equal(request.model,'gen4_turbo');
assert.equal(request.duration,5);
assert.throws(()=>makeRunwayRequest({promptImage:'https://random-server.com/a.png',promptText:request.promptText}),/PRIVATE_OWNED_IMAGE/);
let externalCalls=0;
const fakeFetch=async(url,options)=>{
 externalCalls++;assert.equal(url,'https://api.dev.runwayml.com/v1/image_to_video');
 assert.ok(options.headers.Authorization.startsWith('Bearer '));
 return {ok:true,json:async()=>({id:'mock-runway-job-'+externalCalls})};
};
const workspace='/home/jarvis/marketing-factory-v2/lunara-pilot-v1-smoke';
await rm(workspace,{recursive:true,force:true});
try{
 await assert.rejects(submitRunwayPilot({workspace,date,attempt:1,request,apiKey:'fake',fetchImpl:fakeFetch}),/EXTERNAL_SPEND_APPROVAL_REQUIRED/);
 assert.equal(externalCalls,0);
 const first=await submitRunwayPilot({workspace,date,attempt:1,request,apiKey:'fake',
   spendApproved:true,accountFundingConfirmed:true,fetchImpl:fakeFetch});
 assert.equal(first.usdReserved,0.25);
 const second=await submitRunwayPilot({workspace,date,attempt:2,request,apiKey:'fake',
   spendApproved:true,accountFundingConfirmed:true,fetchImpl:fakeFetch});
 assert.equal(second.monthReservedUsd,0.50);
 assert.equal(externalCalls,2);
 await assert.rejects(submitRunwayPilot({workspace,date,attempt:3,request,apiKey:'fake',
   spendApproved:true,accountFundingConfirmed:true,fetchImpl:fakeFetch}),/MAX_TWO_ATTEMPTS/);
}finally{await rm(workspace,{recursive:true,force:true})}
const channels=[
 {id:'6ad6365c778b240e2f59f8d3',name:'lunara.geschichten',service:'instagram',type:'business',isDisconnected:false},
 {id:'6ada8bd2778b240e2f93a963',name:'lunara.geschichten',service:'tiktok',type:'account',isDisconnected:false},
 {id:'6ada9aae778b240e2f94eeb1',name:'Lunara Geschichten',service:'facebook',type:'page',isDisconnected:false}
];
const base={channels,publicVideoUrl:'https://lunara-media-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/media/reel-01.mp4',qaPassed:true,brandApproved:true};
const drafts=prepareBufferVideoRequests(base);
assert.equal(drafts.length,3);
assert.ok(drafts.every(x=>x.input.saveToDraft===true && x.input.mode==='addToQueue'));
assert.throws(()=>prepareBufferVideoRequests({...base,publishApproved:true}),/LAUNCH_GATES/);
const scheduled=prepareBufferVideoRequests({...base,publishApproved:true,shopVerified:true,providerWriteCleared:true});
assert.ok(scheduled.every(x=>x.input.saveToDraft===false && x.input.mode==='addToQueue'));
assert.throws(()=>prepareBufferVideoRequests({...base,qaPassed:false}),/REVIEW_NOT_PASSED/);
assert.throws(()=>prepareBufferVideoRequests({...base,channels:channels.slice(0,2)}),/CHANNEL_NOT_VERIFIED_facebook/);
console.log('LUNARA_AUTOPILOT_PILOT_V1: PASS | plan; 2 mock Runway requests; $0.50 daily cap; 3 Buffer draft payloads; launch gates; NO network or posts');
