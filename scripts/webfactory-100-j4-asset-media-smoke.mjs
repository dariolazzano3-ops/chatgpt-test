import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { readFile as readJsonFile } from 'node:fs/promises';
import {
  createImageMediaContract,
  createVideoMediaContract,
  createAssetMediaPipeline,
  validateAssetMediaPipeline,
  assetMediaPipelineManifest,
  runWebOperatingSystemV2
} from '../src/web-factory/index.js';

const image={
  asset_id:'hero-gelato',
  type:'photo',
  source:'project://assets/hero-gelato.jpg',
  rights_status:'generated',
  allowed_for_reimplementation:true,
  width:2400,
  height:1600,
  usage:['hero','above-fold'],
  focal_point:{x:0.35,y:0.42},
  crop_mode:'cover',
  format:'jpeg',
  quality:82
};

const imageContract=createImageMediaContract(image);
assert.equal(imageContract.status,'PASS');
assert.equal(imageContract.formats.preferred.includes('avif'),true);
assert.equal(imageContract.formats.preferred.includes('webp'),true);
assert.equal(imageContract.formats.fallback,'jpeg');
assert.equal(imageContract.loading.strategy,'eager');
assert.equal(imageContract.loading.fetchpriority,'high');
assert.equal(imageContract.focal_point.x,0.35);
assert.ok(imageContract.responsive_widths.includes(1920));
assert.ok(imageContract.srcset.avif.length>=5);
assert.ok(imageContract.variants.every(v=>v.formats.avif&&v.formats.webp&&v.formats.fallback));

const masonVideo={
  asset_id:'mason-like-background-video',
  type:'video',
  source:'project://assets/mason-hero.mp4',
  rights_status:'owned',
  allowed_for_reimplementation:true,
  role:'background',
  usage:['hero','background-video'],
  width:1920,
  height:1080,
  duration_seconds:14,
  size_mb:8
};
const videoContract=createVideoMediaContract(masonVideo);
assert.equal(videoContract.status,'PASS');
assert.equal(videoContract.role,'background');
assert.equal(videoContract.background_video_preserved,true);
assert.equal(videoContract.delivery.strategy,'local-static');
assert.equal(videoContract.delivery.local_outputs.some(x=>x.format==='mp4'),true);
assert.equal(videoContract.delivery.local_outputs.some(x=>x.format==='webm'),true);
assert.equal(videoContract.poster.generation_required,true);
assert.equal(videoContract.mobile_fallback.poster,videoContract.poster.output);
assert.equal(videoContract.reduced_data.save_data_behavior,'poster_only');
assert.equal(videoContract.autoplay.allowed,true);
assert.equal(videoContract.autoplay.muted,true);
assert.equal(videoContract.autoplay.playsinline,true);
assert.equal(videoContract.autoplay.loop,true);
assert.equal(videoContract.autoplay.controls,false);

const foreground=createVideoMediaContract({
  asset_id:'story-video',
  type:'video',
  source:'project://assets/story.mp4',
  rights_status:'licensed',
  allowed_for_reimplementation:true,
  role:'foreground',
  duration_seconds:20,
  size_mb:10
});
assert.equal(foreground.autoplay.allowed,false);
assert.equal(foreground.autoplay.user_gesture_required,true);
assert.equal(foreground.autoplay.controls,true);

const streamReview=createVideoMediaContract({
  asset_id:'long-video',
  type:'video',
  source:'project://assets/long.mp4',
  rights_status:'owned',
  allowed_for_reimplementation:true,
  role:'foreground',
  duration_seconds:300,
  size_mb:80
});
assert.equal(streamReview.status,'REVIEW_REQUIRED');
assert.equal(streamReview.delivery.strategy,'stream-adapter-review');
assert.equal(streamReview.delivery.automatic_paid_activation,false);
assert.equal(streamReview.delivery.external_review_required,true);

const pipeline=createAssetMediaPipeline({
  project_scope:'customer:gelato-donatello:website-v1',
  images:[image],
  videos:[masonVideo,{
    asset_id:'story-video',
    type:'video',
    source:'project://assets/story.mp4',
    rights_status:'licensed',
    allowed_for_reimplementation:true,
    role:'foreground',
    duration_seconds:20,
    size_mb:10
  }]
});
assert.equal(pipeline.validation.status,'PASS');
assert.equal(pipeline.image_count,1);
assert.equal(pipeline.video_count,2);
assert.equal(pipeline.items.find(x=>x.asset_id==='mason-like-background-video').background_video_preserved,true);
assert.equal(validateAssetMediaPipeline(pipeline).status,'PASS');

const unsafe=createAssetMediaPipeline({
  project_scope:'unsafe',
  images:[{
    asset_id:'unknown-photo',
    type:'photo',
    source:'project://unknown.jpg',
    rights_status:'unknown',
    width:1200,
    height:800
  }]
});
assert.equal(unsafe.validation.status,'BLOCK');
assert.ok(unsafe.validation.blocking_issues.some(x=>x.code==='ASSET_RIGHTS_BLOCKED'));

const dropped=structuredClone(pipeline);
dropped.items.find(x=>x.asset_id==='mason-like-background-video').background_video_preserved=false;
const masonRegression=validateAssetMediaPipeline(dropped);
assert.equal(masonRegression.status,'BLOCK');
assert.ok(masonRegression.blocking_issues.some(x=>x.code==='BACKGROUND_VIDEO_DROPPED'));

const fixture=JSON.parse(await readJsonFile(new URL('../fixtures/web-factory/autonomous-local-service-bakery.json',import.meta.url),'utf8'));
const osResult=runWebOperatingSystemV2({
  ...fixture,
  images:[image],
  videos:[masonVideo]
},{now:'2026-09-07T01:10:00.000Z',build_duration_ms:1});
assert.equal(osResult.ok,true);
assert.equal(osResult.assets.media.validation.status,'PASS');
assert.equal(osResult.assets.media.video_count,1);
assert.ok(osResult.artifact.files[osResult.artifact.project_root+'/web-os-v2-media-manifest.json']);
assert.equal(osResult.delivery_manifest.rights_status.media_pipeline.validation.status,'PASS');

const manifest=assetMediaPipelineManifest();
assert.equal(manifest.image_executor,'sharp');
assert.equal(manifest.video_executor,'ffmpeg');
assert.equal(manifest.background_video_regression_required,true);
assert.equal(manifest.unknown_rights_allowed,false);
assert.equal(manifest.automatic_paid_activation,false);

const temp=await mkdtemp(path.join(os.tmpdir(),'jaguar-j4-media-'));
try{
  const sourceImage=path.join(temp,'source.jpg');
  await sharp({
    create:{width:1200,height:800,channels:3,background:{r:245,g:236,b:220}}
  }).jpeg({quality:90}).toFile(sourceImage);

  const avif=path.join(temp,'hero-768.avif');
  const webp=path.join(temp,'hero-768.webp');
  const jpeg=path.join(temp,'hero-768.jpg');
  await sharp(sourceImage).resize({width:768}).avif({quality:60}).toFile(avif);
  await sharp(sourceImage).resize({width:768}).webp({quality:80}).toFile(webp);
  await sharp(sourceImage).resize({width:768}).jpeg({quality:82}).toFile(jpeg);
  assert.ok((await stat(avif)).size>100);
  assert.ok((await stat(webp)).size>100);
  assert.ok((await stat(jpeg)).size>100);

  const sourceVideo=path.join(temp,'source.mp4');
  const compressedMp4=path.join(temp,'compressed.mp4');
  const compressedWebm=path.join(temp,'compressed.webm');
  const poster=path.join(temp,'poster.jpg');

  const makeVideo=spawnSync('ffmpeg',[
    '-hide_banner','-loglevel','error',
    '-f','lavfi','-i','color=c=black:s=320x180:d=1',
    '-vf','format=yuv420p',
    '-c:v','libx264','-movflags','+faststart','-an',
    sourceVideo,'-y'
  ],{encoding:'utf8'});
  assert.equal(makeVideo.status,0,'FFmpeg source generation failed: '+makeVideo.stderr);

  const mp4=spawnSync('ffmpeg',[
    '-hide_banner','-loglevel','error','-i',sourceVideo,
    '-c:v','libx264','-crf','24','-preset','medium','-movflags','+faststart','-an',
    compressedMp4,'-y'
  ],{encoding:'utf8'});
  assert.equal(mp4.status,0,'FFmpeg MP4 compression failed: '+mp4.stderr);

  const webm=spawnSync('ffmpeg',[
    '-hide_banner','-loglevel','error','-i',sourceVideo,
    '-c:v','libvpx-vp9','-crf','34','-b:v','0','-an',
    compressedWebm,'-y'
  ],{encoding:'utf8'});
  assert.equal(webm.status,0,'FFmpeg WebM compression failed: '+webm.stderr);

  const posterRun=spawnSync('ffmpeg',[
    '-hide_banner','-loglevel','error','-ss','0.1','-i',sourceVideo,
    '-frames:v','1',poster,'-y'
  ],{encoding:'utf8'});
  assert.equal(posterRun.status,0,'FFmpeg poster generation failed: '+posterRun.stderr);

  assert.ok((await stat(compressedMp4)).size>100);
  assert.ok((await stat(compressedWebm)).size>100);
  assert.ok((await stat(poster)).size>100);

  const posterBytes=await readFile(poster);
  assert.ok(posterBytes.length>100);

  console.log(JSON.stringify({
    ok:true,
    suite:'webfactory-100-j4-asset-media',
    image_contract:'PASS',
    avif_materialization:'PASS',
    webp_materialization:'PASS',
    fallback_materialization:'PASS',
    ffmpeg_mp4_compression:'PASS',
    ffmpeg_webm_compression:'PASS',
    ffmpeg_poster:'PASS',
    mason_background_video_regression:'PASS',
    reduced_data_fallback:'PASS',
    web_os_v2_integration:'PASS',
    unsafe_rights_fail_closed:'PASS',
    production_deploy:false,
    automatic_paid_activation:false
  },null,2));
}finally{
  await rm(temp,{recursive:true,force:true});
}
