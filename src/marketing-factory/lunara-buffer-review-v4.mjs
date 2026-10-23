/**
 * LUNARA Marketing Factory V4: review-only Buffer handoff.
 * Pure, offline. Creates request objects only; never performs HTTP calls.
 * Publish, queue, spend, login, credential handling and timers are out of scope.
 */
const EXPECTED = Object.freeze({instagram:'business',tiktok:'account',facebook:'page'});
const CAPTION = Object.freeze({
  instagram:'Was wäre, wenn dein Kind die Hauptrolle seiner eigenen Gute-Nacht-Geschichte spielt? 🌙✨ LUNARA erstellt personalisierte digitale Geschichten als PDF. Eine beispielhafte Geschichte zeigt, wie persönlich das werden kann. #LUNARA #GuteNachtGeschichte #Vorlesezeit',
  tiktok:'Dein Kind ist die Hauptfigur einer ganz persönlichen Gute-Nacht-Geschichte. 🌙✨ LUNARA: digitale Geschichten als PDF. Beispiel mit erfundenen Namen. #LUNARA #Vorlesezeit',
  facebook:'Was wäre, wenn eine Gute-Nacht-Geschichte den Namen deines Kindes trägt? 🌙 LUNARA erstellt personalisierte digitale PDF-Geschichten. In unserer Videodemo verwenden wir nur erfundene Namen und Figuren. #LUNARA #GuteNachtGeschichte'
});
const SHA256=/^[a-f0-9]{64}$/i, ID=/^[a-f0-9]{24}$/i;
const HOST='lunara-media-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev';
function verifyVideo(video){
  if(!video || video.reviewApproved!==true) throw Error('VIDEO_REVIEW_REQUIRED');
  if(video.fictionalSample!==true || video.containsCustomerData!==false) throw Error('PRIVATE_CUSTOMER_CONTENT_NOT_ALLOWED');
  if(!SHA256.test(String(video.sha256||''))) throw Error('SHA256_REQUIRED');
  if(video.durationSeconds<5 || video.durationSeconds>60 || video.aspectRatio!=='9:16') throw Error('INVALID_REEL_FORMAT');
  let url;
  try{url=new URL(video.url)}catch{throw Error('VIDEO_URL_REQUIRED')}
  if(url.protocol!=='https:' || url.hostname!==HOST || !/^\/media\/reel-[0-9]{2}\.mp4$/.test(url.pathname) || url.username || url.password || url.search || url.hash) throw Error('UNSAFE_VIDEO_URL');
  return url.href;
}
/**
 * Requires live-read channel IDs and a reviewed video, with separately verified
 * HEAD/GET/content-type/size/hash. Only prepares official Buffer create_post args.
 */
export function prepareLunaraDraftsV4({video,channels,mediaHttpVerified=false}={}){
  const url=verifyVideo(video);
  if(!mediaHttpVerified) throw Error('REMOTE_MEDIA_QA_REQUIRED');
  if(!Array.isArray(channels)) throw Error('CHANNELS_REQUIRED');
  const drafts={};
  for(const [platform,type] of Object.entries(EXPECTED)){
    const expectedName=platform==='facebook'?'lunara geschichten':'lunara.geschichten';
    const found=channels.filter(c=>c.service===platform && c.name?.toLowerCase()===expectedName);
    if(found.length!==1 || found[0].type!==type || found[0].isDisconnected!==false || !ID.test(String(found[0].id||'')))
      throw Error('CHANNEL_NOT_VERIFIED:'+platform);
    drafts[platform]={
      channelId:found[0].id,schedulingType:'automatic',saveToDraft:true,
      text:CAPTION[platform],
      assets:[{video:{url,metadata:{title:'LUNARA | Deine persönliche Gute-Nacht-Geschichte'}}}],
      metadata:platform==='instagram'?{instagram:{type:'reel',shouldShareToFeed:true}}:
        platform==='facebook'?{facebook:{type:'reel'}}:
        {tiktok:{title:'LUNARA Gute-Nacht-Geschichte'}}
    };
  }
  return Object.freeze({
    schema:'lunara.buffer.review.v4',mode:'DRAFT_ONLY',
    bufferWriteExecuted:false,publicPosts:0,scheduledPosts:0,storeUrlVerified:false,
    disclaimer:'Demo sample; product shop URL must be separately verified before publishing',
    channelCount:3,drafts
  });
}
