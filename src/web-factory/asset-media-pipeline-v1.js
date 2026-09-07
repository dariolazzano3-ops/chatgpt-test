import { createAssetInventory, createImageOptimizationContract } from './seo-quality-v2.js';

const arr=(v)=>Array.isArray(v)?v:[];
const text=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);
const number=(v,fallback=null)=>Number.isFinite(Number(v))?Number(v):fallback;

const SAFE_RIGHTS=new Set([
  'owned','licensed','public_domain','generated',
  'owned_confirmed','customer_licensed','customer_asserted'
]);
const IMAGE_TYPES=new Set(['image','photo','illustration','background','logo']);
const VIDEO_TYPES=new Set(['video','background_video','background-video']);
const FALLBACK_FORMATS=new Set(['jpeg','jpg','png']);

function slug(value){
  return text(value,160).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'')||'asset';
}
function normalizeRights(asset={}){
  const raw=text(asset.rights_status||asset.license_status||asset.rights||'unknown',80).toLowerCase();
  const normalized=raw.replace(/\s+/g,'_');
  return {
    raw,
    normalized,
    safe:SAFE_RIGHTS.has(normalized),
    allowed_for_reimplementation:asset.allowed_for_reimplementation===true||asset.publishable===true||SAFE_RIGHTS.has(normalized)
  };
}
function normalizeType(asset={}){
  const raw=text(asset.type||asset.kind||asset.media_type||'',80).toLowerCase();
  if(VIDEO_TYPES.has(raw)||/\bvideo\b/.test(raw))return 'video';
  if(IMAGE_TYPES.has(raw)||/\b(image|photo|illustration|background|logo)\b/.test(raw))return 'image';
  return raw||'document';
}
function focalPoint(asset={}){
  const f=asset.focal_point&&typeof asset.focal_point==='object'?asset.focal_point:{};
  return {
    x:Math.max(0,Math.min(1,number(f.x??asset.focal_x,0.5))),
    y:Math.max(0,Math.min(1,number(f.y??asset.focal_y,0.5))),
    preset:text(f.preset||asset.focal_preset||'custom',40)
  };
}
function imageWidths(width,requested=[]){
  const defaults=[320,480,768,1024,1440,1920];
  const max=number(width,null);
  const source=arr(requested).length?arr(requested):defaults;
  const widths=[...new Set(source.map(v=>Math.round(number(v,0))).filter(v=>v>0&&(!max||v<=max)))].sort((a,b)=>a-b);
  if(max&&max>0&&!widths.includes(max))widths.push(max);
  return widths.slice(0,8);
}
function dimensionsFor(width,height,targetWidth){
  const w=number(width,null),h=number(height,null);
  if(!w||!h)return{width:targetWidth,height:null};
  return{width:targetWidth,height:Math.max(1,Math.round(targetWidth*h/w))};
}
function fallbackFormat(asset={}){
  const raw=text(asset.fallback_format||asset.format||'',20).toLowerCase();
  if(FALLBACK_FORMATS.has(raw))return raw==='jpg'?'jpeg':raw;
  return asset.has_alpha===true?'png':'jpeg';
}
function variantPath(assetId,width,format){
  const ext=format==='jpeg'?'jpg':format;
  return '/assets/generated/'+slug(assetId)+'-'+width+'.'+ext;
}
function qualityAssessment(asset={},usage=[]){
  const width=number(asset.width,null),height=number(asset.height,null);
  const hero=usage.some(x=>/hero|background|cover/i.test(String(x)));
  const issues=[];
  if(!width||!height)issues.push({code:'DIMENSIONS_MISSING',severity:'BLOCK'});
  else if(hero&&width<1200)issues.push({code:'HERO_SOURCE_RESOLUTION_LOW',severity:'WARN',width});
  else if(Math.min(width,height)<320)issues.push({code:'SOURCE_RESOLUTION_LOW',severity:'WARN',width,height});
  return{
    status:issues.some(i=>i.severity==='BLOCK')?'BLOCK':issues.length?'WARN':'PASS',
    width,height,issues
  };
}

export function createImageMediaContract(asset={}){
  const assetId=text(asset.asset_id||asset.id||'image',160);
  const rights=normalizeRights(asset);
  const usage=arr(asset.usage||asset.roles).map(v=>text(v,100));
  const base=createImageOptimizationContract({
    ...asset,
    asset_id:assetId,
    source:asset.source,
    responsive_variants:imageWidths(asset.width,asset.responsive_variants),
    above_fold:asset.above_fold===true||usage.some(x=>/hero|above-fold|critical/i.test(x))
  });
  const fallback=fallbackFormat(asset);
  const widths=imageWidths(asset.width,asset.responsive_variants);
  const variants=widths.map(width=>({
    ...dimensionsFor(asset.width,asset.height,width),
    formats:{
      avif:variantPath(assetId,width,'avif'),
      webp:variantPath(assetId,width,'webp'),
      fallback:variantPath(assetId,width,fallback)
    }
  }));
  const eager=base.lazy_policy==='eager';
  const quality=qualityAssessment(asset,usage);
  const issues=[];
  if(!asset.source)issues.push({code:'ASSET_SOURCE_REQUIRED',severity:'BLOCK'});
  if(!rights.safe||!rights.allowed_for_reimplementation)issues.push({code:'ASSET_RIGHTS_BLOCKED',severity:'BLOCK',rights_status:rights.raw});
  if(quality.status==='BLOCK')issues.push(...quality.issues);
  return{
    schema:'riosystems.image-media-contract.v1',
    asset_id:assetId,
    type:'image',
    source:text(asset.source,1000),
    rights,
    classification:text(asset.classification||asset.category||'website-image',120),
    usage,
    quality,
    focal_point:focalPoint(asset),
    crop:{mode:text(asset.crop_mode||'cover',40),aspect_ratio:text(asset.aspect_ratio||'auto',40)},
    source_dimensions:{width:number(asset.width,null),height:number(asset.height,null)},
    responsive_widths:widths,
    formats:{preferred:['avif','webp'],fallback},
    variants,
    srcset:{
      avif:variants.map(v=>({src:v.formats.avif,width:v.width})),
      webp:variants.map(v=>({src:v.formats.webp,width:v.width})),
      fallback:variants.map(v=>({src:v.formats.fallback,width:v.width}))
    },
    loading:{strategy:eager?'eager':'lazy',decoding:'async',fetchpriority:eager?'high':'auto'},
    optimization:{executor:'sharp',quality:asset.quality??80,strip_metadata:asset.keep_metadata===true?false:true,oversized_original_disallowed:true},
    manifest_required:true,
    issues,
    status:issues.some(i=>i.severity==='BLOCK')?'BLOCK':quality.status==='WARN'?'WARN':'PASS',
    production_deploy:false
  };
}

export function createVideoMediaContract(asset={}){
  const assetId=text(asset.asset_id||asset.id||'video',160);
  const rights=normalizeRights(asset);
  const usage=arr(asset.usage||asset.roles).map(v=>text(v,100));
  const role=text(asset.role||asset.video_role||(usage.some(x=>/background|hero/i.test(x))?'background':'foreground'),80).toLowerCase();
  const background=role==='background'||role==='background_video'||role==='background-video';
  const source=text(asset.source,1000);
  const duration=number(asset.duration_seconds||asset.duration,null);
  const sizeMb=number(asset.size_mb,null);
  const localPreferred=asset.delivery_strategy==='stream'?false:(asset.delivery_strategy==='local'||sizeMb===null||sizeMb<=20)&&(duration===null||duration<=45);
  const strategy=localPreferred?'local-static':'stream-adapter-review';
  const posterSource=text(asset.poster_source||asset.poster,1000)||null;
  const generatedPoster='/assets/generated/'+slug(assetId)+'-poster.jpg';
  const issues=[];
  if(!source)issues.push({code:'VIDEO_SOURCE_REQUIRED',severity:'BLOCK'});
  if(!rights.safe||!rights.allowed_for_reimplementation)issues.push({code:'ASSET_RIGHTS_BLOCKED',severity:'BLOCK',rights_status:rights.raw});
  if(background&&asset.audio_required===true)issues.push({code:'BACKGROUND_VIDEO_AUDIO_NOT_ALLOWED',severity:'BLOCK'});
  return{
    schema:'riosystems.video-media-contract.v1',
    asset_id:assetId,
    type:'video',
    source,
    rights,
    classification:text(asset.classification||'website-video',120),
    usage,
    role:background?'background':'foreground',
    source_metadata:{width:number(asset.width,null),height:number(asset.height,null),duration_seconds:duration,size_mb:sizeMb},
    delivery:{
      strategy,
      local_outputs:strategy==='local-static'?[
        {format:'webm',codec:'vp9',path:'/assets/generated/'+slug(assetId)+'.webm'},
        {format:'mp4',codec:'h264',path:'/assets/generated/'+slug(assetId)+'.mp4'}
      ]:[],
      stream_provider:null,
      automatic_paid_activation:false,
      external_review_required:strategy==='stream-adapter-review'
    },
    compression:{
      executor:'ffmpeg',
      required:true,
      max_width:background?1920:1440,
      webm:{codec:'libvpx-vp9',crf:34,no_audio:background},
      mp4:{codec:'libx264',crf:24,preset:'medium',faststart:true,no_audio:background}
    },
    poster:{
      source:posterSource,
      output:posterSource||generatedPoster,
      generation_required:!posterSource,
      executor:posterSource?null:'ffmpeg',
      timestamp_seconds:number(asset.poster_timestamp_seconds,0.25)
    },
    mobile_fallback:{
      behavior:text(asset.mobile_behavior||'poster-first-then-video-when-allowed',120),
      poster:posterSource||generatedPoster,
      max_width:960
    },
    reduced_data:{
      save_data_behavior:'poster_only',
      prefers_reduced_data_behavior:'poster_only',
      network_sensitive:true
    },
    autoplay:{
      allowed:background,
      muted:background,
      playsinline:background,
      loop:background,
      controls:!background,
      user_gesture_required:!background
    },
    background_video_preserved:background&&Boolean(source),
    issues,
    status:issues.some(i=>i.severity==='BLOCK')?'BLOCK':strategy==='stream-adapter-review'?'REVIEW_REQUIRED':'PASS',
    production_deploy:false
  };
}

function mergeInputs(input={}){
  const generic=arr(input.assets);
  const images=arr(input.images).map(x=>({...x,type:x.type||x.kind||'image'}));
  const videos=arr(input.videos).map(x=>({...x,type:x.type||x.kind||'video'}));
  const byId=new Map();
  for(const item of [...generic,...images,...videos]){
    const id=text(item?.asset_id||item?.id||('asset-'+(byId.size+1)),160);
    byId.set(id,{...clone(byId.get(id)||{}),...clone(item),asset_id:id});
  }
  return[...byId.values()];
}

export function validateAssetMediaPipeline(manifest={}){
  const items=arr(manifest.items);
  const issues=[];
  for(const item of items){
    if(item.status==='BLOCK')issues.push(...arr(item.issues).map(issue=>({...issue,asset_id:item.asset_id})));
    if(item.type==='image'&&!arr(item.variants).length)issues.push({code:'IMAGE_VARIANTS_MISSING',severity:'BLOCK',asset_id:item.asset_id});
    if(item.type==='image'&&!item.formats?.preferred?.includes('avif'))issues.push({code:'AVIF_VARIANT_MISSING',severity:'BLOCK',asset_id:item.asset_id});
    if(item.type==='image'&&!item.formats?.preferred?.includes('webp'))issues.push({code:'WEBP_VARIANT_MISSING',severity:'BLOCK',asset_id:item.asset_id});
    if(item.type==='video'&&item.role==='background'){
      if(item.background_video_preserved!==true)issues.push({code:'BACKGROUND_VIDEO_DROPPED',severity:'BLOCK',asset_id:item.asset_id});
      if(!(item.autoplay?.muted&&item.autoplay?.playsinline&&item.autoplay?.loop))issues.push({code:'BACKGROUND_VIDEO_AUTOPLAY_POLICY_UNSAFE',severity:'BLOCK',asset_id:item.asset_id});
      if(item.reduced_data?.save_data_behavior!=='poster_only')issues.push({code:'BACKGROUND_VIDEO_REDUCED_DATA_FALLBACK_MISSING',severity:'BLOCK',asset_id:item.asset_id});
    }
  }
  return{
    schema:'riosystems.asset-media-pipeline-validation.v1',
    status:issues.some(i=>i.severity==='BLOCK')?'BLOCK':issues.length?'WARN':'PASS',
    issues,
    blocking_issues:issues.filter(i=>i.severity==='BLOCK'),
    production_deploy:false
  };
}

export function createAssetMediaPipeline(input={}){
  const projectScope=text(input.project_scope||input.project_scope_key||input.project_id,320)||null;
  const raw=mergeInputs(input);
  const legacyInventory=createAssetInventory(raw.map(item=>({
    ...item,
    type:normalizeType(item)==='image'?(text(item.type||item.kind,80)||'photo'):normalizeType(item),
    license_status:text(item.license_status||item.rights_status||'unknown',80).toLowerCase(),
    allowed_for_reimplementation:normalizeRights(item).safe&&normalizeRights(item).allowed_for_reimplementation
  })));
  const items=raw.map(item=>{
    const type=normalizeType(item);
    if(type==='image')return createImageMediaContract(item);
    if(type==='video')return createVideoMediaContract(item);
    return{
      schema:'riosystems.generic-asset-contract.v1',
      asset_id:item.asset_id,
      type,
      source:text(item.source,1000),
      rights:normalizeRights(item),
      status:normalizeRights(item).safe?'PASS':'BLOCK',
      issues:normalizeRights(item).safe?[]:[{code:'ASSET_RIGHTS_BLOCKED',severity:'BLOCK'}],
      production_deploy:false
    };
  });
  const manifest={
    schema:'riosystems.asset-media-pipeline.v1',
    version:'1.0.0',
    project_scope:projectScope,
    extends:'riosystems.asset-pipeline.v2',
    static_first:true,
    image_executor:'sharp',
    video_executor:'ffmpeg',
    items,
    image_count:items.filter(i=>i.type==='image').length,
    video_count:items.filter(i=>i.type==='video').length,
    legacy_inventory:legacyInventory,
    external_paid_provider_required:false,
    automatic_paid_activation:false,
    production_deploy:false
  };
  const validation=validateAssetMediaPipeline(manifest);
  return{
    ...manifest,
    status:raw.length===0?'EMPTY':validation.status,
    validation
  };
}

export function assetMediaPipelineManifest(){
  return{
    schema:'riosystems.asset-media-pipeline-manifest.v1',
    extends:'riosystems.asset-pipeline.v2',
    image_pipeline:['source','rights','classification','quality','focal_point','crop','responsive_variants','avif','webp','fallback','dimensions','srcset','loading','manifest'],
    video_pipeline:['source','rights','poster','compression','mobile_fallback','reduced_data','autoplay_policy','background_video','delivery_strategy'],
    image_executor:'sharp',
    video_executor:'ffmpeg',
    background_video_regression_required:true,
    unknown_rights_allowed:false,
    automatic_paid_activation:false,
    production_deploy:false
  };
}
