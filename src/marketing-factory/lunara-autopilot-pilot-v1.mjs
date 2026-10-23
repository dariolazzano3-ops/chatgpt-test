/**
 * LUNARA Autopilot Pilot V1: small, auditable steps, no live scheduler.
 * Brand assets and credentials never go into git. Live provider writes
 * require explicit runtime gates and a verified receipt.
 */
import {mkdir,readdir,readFile,writeFile,unlink,open} from 'node:fs/promises';
import {join} from 'node:path';
const PRICE_USD_PER_SECOND=0.05;
const DAILY_CAP_USD=0.50;
const MONTH_CAP_USD=10;
const BUFFERS={
  instagram:{name:'lunara.geschichten',type:'business'},
  tiktok:{name:'lunara.geschichten',type:'account'},
  facebook:{name:'Lunara Geschichten',type:'page'}
};
const THEMES=[
  ['Die Hauptrolle','Was wäre, wenn dein Kind die Hauptfigur seiner Geschichte ist?'],
  ['Abendritual','Ein kleines Ritual. Eine persönliche Traumwelt.'],
  ['Persönlicher Name','Eine Geschichte, die den Namen deines Kindes trägt.'],
  ['Vorlesezeit','Heute Abend gehört die Geschichte ganz euch.'],
  ['Fantasiereise','Aus kleinen Details wird eine große Geschichte.'],
  ['Digitales Buch','In wenigen Momenten beginnt eine persönliche Reise.'],
  ['Nähe','Eine Geschichte zum gemeinsamen Zuhören und Entdecken.']
];
function fail(code){throw new Error(code)}
export function makeDailyPlan(date,dayIndex=0){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(dayIndex))fail('INVALID_DAY');
  const [theme,hook]=THEMES[((dayIndex%7)+7)%7];
  return {schema:'lunara.autopilot.pilot.v1',date,theme,hook,
    videoFormat:'720:1280',videoSeconds:25,aiClipSeconds:5,
    model:'gen4_turbo',estimatedVideoUsd:0.25,
    originalLogoRequired:true,realPdfPreviewRequired:true,voiceoverRequired:true,
    reviewOnly:true,publishing:false,
    notes:'Fiktives Kundenbeispiel; keine Schlaf- oder Wirkgarantien.'};
}
export function checkReadiness(input={}){
  const blocked=[];
  for(const [field,reason] of Object.entries({
    runwayApiKeyPresent:'RUNWAY_API_KEY_MISSING',
    runwayBalanceApproved:'RUNWAY_BUDGET_NOT_APPROVED',
    bufferApiKeyPresent:'BUFFER_API_KEY_MISSING',
    shopUrlVerified:'SHOP_LINK_NOT_VERIFIED',
    originalLogoConfirmed:'ORIGINAL_LOGO_MISSING',
    realProductPreviewConfirmed:'PRODUCT_MEDIA_MISSING',
    mediaUsageRightsConfirmed:'MEDIA_RIGHTS_NOT_CONFIRMED',
    germanVoiceConfirmed:'VOICE_NOT_VERIFIED',
    bufferVideoWriteTestPassed:'BUFFER_VIDEO_HANDOFF_UNTESTED',
    providerWriteAllowed:'BUFFER_WRITE_PERMISSION_NOT_CONFIRMED'
  })) if(input[field]!==true)blocked.push(reason);
  return {stage:blocked.length?'NOT_READY':'PILOT_READY',blocked,
    dailyGenerationLimitUsd:DAILY_CAP_USD,monthlyGenerationLimitUsd:MONTH_CAP_USD,
    publisherRunning:false,published:false};
}
export function makeRunwayRequest({promptImage,promptText,duration=5}={}){
  if(duration!==5 && duration!==10)fail('UNSUPPORTED_DURATION');
  if(typeof promptImage!=='string'||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(promptImage))
    fail('PRIVATE_OWNED_IMAGE_REQUIRED');
  if(typeof promptText!=='string'||promptText.length<30||promptText.length>900)
    fail('SAFE_CINEMATIC_PROMPT_REQUIRED');
  return {model:'gen4_turbo',ratio:'720:1280',duration,promptImage,promptText};
}
async function allocateBudget({workspace,date,attempt,duration}){
  if(!workspace?.startsWith('/home/jarvis/marketing-factory-v2/'))fail('ISOLATED_WORKSPACE_REQUIRED');
  if(attempt!==1 && attempt!==2)fail('MAX_TWO_ATTEMPTS');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('INVALID_DAY');
  const month=date.slice(0,7),dir=join(workspace,'autopilot-budget',month);
  await mkdir(dir,{recursive:true,mode:0o700});
  const lock=join(dir,'.lock');
  const holder=await open(lock,'wx',0o600);
  try{
    const entries=(await readdir(dir)).filter(x=>/^\d{4}-\d{2}-\d{2}-attempt-[12]\.json$/.test(x));
    const ledgers=await Promise.all(entries.map(x=>readFile(join(dir,x),'utf8').then(JSON.parse)));
    const spent=ledgers.reduce((a,b)=>a+b.reservedUsd,0);
    const daily=ledgers.filter(x=>x.date===date).reduce((a,b)=>a+b.reservedUsd,0);
    const reserve=Number((duration*PRICE_USD_PER_SECOND).toFixed(2));
    if(reserve>DAILY_CAP_USD-daily+1e-6 || reserve>MONTH_CAP_USD-spent+1e-6)
      fail('SPENDING_LIMIT_REACHED');
    const receipt=join(dir,date+'-attempt-'+attempt+'.json');
    await writeFile(receipt,JSON.stringify({date,attempt,reservedUsd:reserve,status:'RESERVED_UNCONFIRMED'})+'\n',{flag:'wx',mode:0o600});
    return {receipt,reserve,monthReservedUsd:spent+reserve};
  }finally{await holder.close();await unlink(lock)}
}
export async function submitRunwayPilot({workspace,date,attempt,request,apiKey,spendApproved=false,
    accountFundingConfirmed=false,fetchImpl=fetch}={}){
  if(spendApproved!==true || accountFundingConfirmed!==true)fail('EXTERNAL_SPEND_APPROVAL_REQUIRED');
  if(!apiKey || typeof apiKey!=='string')fail('RUNWAY_API_KEY_MISSING');
  if(!request || request.model!=='gen4_turbo' || request.ratio!=='720:1280')fail('UNSAFE_RUNWAY_REQUEST');
  makeRunwayRequest(request);
  const accounting=await allocateBudget({workspace,date,attempt,duration:request.duration});
  const result=await fetchImpl('https://api.dev.runwayml.com/v1/image_to_video',{
    method:'POST',headers:{'Authorization':'Bearer '+apiKey,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'},
    body:JSON.stringify(request)});
  if(!result.ok)fail('RUNWAY_HTTP_'+result.status);
  const data=await result.json();
  if(typeof data.id!=='string'||!data.id)fail('RUNWAY_TASK_ID_MISSING');
  await writeFile(accounting.receipt,JSON.stringify({date,attempt,reservedUsd:accounting.reserve,
    status:'RUNWAY_TASK_SUBMITTED',taskId:data.id})+'\n',{mode:0o600});
  return {state:'SUBMITTED',taskId:data.id,usdReserved:accounting.reserve,
    monthReservedUsd:accounting.monthReservedUsd,published:false};
}
export function prepareBufferVideoRequests({channels,publicVideoUrl,qaPassed,brandApproved,
  shopVerified,publishApproved,providerWriteCleared}={}){
  if(!Array.isArray(channels))fail('CHANNEL_LIST_REQUIRED');
  if(!publicVideoUrl?.startsWith('https://lunara-media-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/media/'))
    fail('TRUSTED_MEDIA_URL_REQUIRED');
  if(qaPassed!==true||brandApproved!==true)fail('REVIEW_NOT_PASSED');
  const publish=publishApproved===true;
  if(publish && (shopVerified!==true||providerWriteCleared!==true))fail('LAUNCH_GATES_NOT_VERIFIED');
  return Object.entries(BUFFERS).map(([platform,expected])=>{
    const found=channels.filter(c=>c.service===platform && c.name===expected.name &&
      c.type===expected.type && c.isDisconnected===false);
    if(found.length!==1 || !/^[a-f0-9]{24}$/i.test(found[0].id))fail('CHANNEL_NOT_VERIFIED_'+platform);
    const metadata=platform==='instagram'?{instagram:{type:'reel',shouldShareToFeed:true,isAiGenerated:true}}:
      platform==='facebook'?{facebook:{type:'reel'}}:{tiktok:{isAiGenerated:true}};
    const input={channelId:found[0].id,schedulingType:'automatic',mode:'addToQueue',
      saveToDraft:!publish,
      text:'🌙 Eine persönliche Geschichte, in der dein Kind die Hauptrolle spielt. Digitales Gute-Nacht-Ritual von LUNARA. Beispielillustration. #LUNARA #GuteNachtGeschichte',
      assets:[{video:{url:publicVideoUrl}}],metadata};
    return {platform,input};
  });
}
