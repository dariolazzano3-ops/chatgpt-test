import assert from 'node:assert/strict';
import {prepareLunaraDraftsV4} from '../src/marketing-factory/lunara-buffer-review-v4.mjs';
const channels=[
 {id:'6ad6365c778b240e2f59f8d3',name:'lunara.geschichten',service:'instagram',type:'business',isDisconnected:false},
 {id:'6ada8bd2778b240e2f93a963',name:'lunara.geschichten',service:'tiktok',type:'account',isDisconnected:false},
 {id:'6ada9aae778b240e2f94eeb1',name:'Lunara Geschichten',service:'facebook',type:'page',isDisconnected:false}
];
const video={
 url:'https://lunara-media-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/media/reel-01.mp4',
 sha256:'445f513acec6996538652d4e4a07c55255b6fe7fd5d31f826757d50ff36ddd24',
 reviewApproved:true,fictionalSample:true,containsCustomerData:false,durationSeconds:22,aspectRatio:'9:16'
};
const out=prepareLunaraDraftsV4({video,channels,mediaHttpVerified:true});
assert.equal(out.mode,'DRAFT_ONLY');
assert.equal(out.publicPosts,0);
assert.equal(Object.keys(out.drafts).length,3);
for(const p of Object.values(out.drafts)){
 assert.equal(p.saveToDraft,true);
 assert.equal(p.schedulingType,'automatic');
 assert.equal('mode' in p,false);
 assert.equal('dueAt' in p,false);
 assert.equal(p.assets.length,1);
}
assert.throws(()=>prepareLunaraDraftsV4({video:{...video,containsCustomerData:true},channels,mediaHttpVerified:true}),/PRIVATE_CUSTOMER_CONTENT/);
assert.throws(()=>prepareLunaraDraftsV4({video:{...video,reviewApproved:false},channels,mediaHttpVerified:true}),/VIDEO_REVIEW/);
assert.throws(()=>prepareLunaraDraftsV4({video:{...video,url:'https://evil.com/media/reel-01.mp4'},channels,mediaHttpVerified:true}),/UNSAFE_VIDEO_URL/);
assert.throws(()=>prepareLunaraDraftsV4({video,channels,mediaHttpVerified:false}),/REMOTE_MEDIA_QA/);
assert.throws(()=>prepareLunaraDraftsV4({video,channels:channels.filter(c=>c.service!=='facebook'),mediaHttpVerified:true}),/CHANNEL_NOT_VERIFIED:facebook/);
assert.throws(()=>prepareLunaraDraftsV4({video,channels:channels.map(c=>({...c,isDisconnected:true})),mediaHttpVerified:true}),/CHANNEL_NOT_VERIFIED:instagram/);
console.log('LUNARA_BUFFER_REVIEW_V4: PASS (3 draft payloads, 0 scheduled, 0 published, 6 safety checks)');
