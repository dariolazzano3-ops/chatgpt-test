import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');

function detectFormat(bytes){
  if(bytes.length>=8&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return 'PNG';
  if(bytes.length>=16&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return 'WEBP';
  return 'UNKNOWN';
}
function webpDimensions(bytes){
  if(bytes.subarray(0,4).toString('ascii')!=='RIFF'||bytes.subarray(8,12).toString('ascii')!=='WEBP')throw new Error('WEBP_HEADER_INVALID');
  const fourcc=bytes.subarray(12,16).toString('ascii');
  if(fourcc==='VP8L'){
    if(bytes[20]!==0x2f)throw new Error('WEBP_VP8L_SIGNATURE_INVALID');
    const b0=bytes[21],b1=bytes[22],b2=bytes[23],b3=bytes[24];
    const width=1+(b0|((b1&0x3f)<<8));
    const height=1+(((b1&0xc0)>>6)|(b2<<2)|((b3&0x0f)<<10));
    return {width,height,codec:'VP8L',lossless:true};
  }
  if(fourcc==='VP8X'){
    const width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);
    const height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);
    return {width,height,codec:'VP8X',lossless:null};
  }
  if(fourcc==='VP8 '){
    const payload=20;
    const signature=bytes.subarray(payload+3,payload+6).toString('hex');
    if(signature!=='9d012a')throw new Error('WEBP_VP8_SIGNATURE_INVALID');
    const width=(bytes[payload+6]|(bytes[payload+7]<<8))&0x3fff;
    const height=(bytes[payload+8]|(bytes[payload+9]<<8))&0x3fff;
    return {width,height,codec:'VP8',lossless:false};
  }
  throw new Error('WEBP_CODEC_UNSUPPORTED:'+fourcc);
}

const manifest=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-reference-extracted-assets-v1.json','utf8'));
const asset=manifest.assets.find(x=>x.asset_id==='hero_earth_reference_extracted');
assert.ok(asset,'hero asset manifest missing');
assert.equal(manifest.provenance,'REFERENCE_EXTRACTED');
assert.equal(manifest.usage_scope,'GOLD_STANDARD_POC_ONLY');
assert.equal(manifest.production_use_allowed,false);

let b64='';
for(let i=1;i<=6;i++){
  const part=await readFile(`factory-state/visual-foundry/assets/hero-earth-lossless.part0${i}.b64`,'utf8');
  b64+=part.replace(/\s+/g,'');
}
const bytes=Buffer.from(b64,'base64');
const hash=sha256(bytes);
const format=detectFormat(bytes);
await mkdir('artifacts/visual-foundry/stencil-constraint-v1',{recursive:true});
const extension=format==='WEBP'?'webp':format==='PNG'?'png':'bin';
await writeFile(`artifacts/visual-foundry/stencil-constraint-v1/hero-earth-reconstructed.${extension}`,bytes);

let dimensions=null,codec=null,lossless=null,decode_error=null;
try{
  if(format==='PNG'){
    const decoded=PNG.sync.read(bytes);
    dimensions={width:decoded.width,height:decoded.height};
    codec='PNG';lossless=true;
  }else if(format==='WEBP'){
    const info=webpDimensions(bytes);
    dimensions={width:info.width,height:info.height};
    codec=info.codec;lossless=info.lossless;
  }else throw new Error('REFERENCE_ASSET_FORMAT_UNKNOWN');
}catch(error){decode_error=error?.message||String(error);}

const bound=asset.ci_representation||null;
const representationBound=!!bound&&bound.sha256===hash&&bound.format===format&&bound.pixel_equivalent_to_reference_extracted===true;
const result={
  schema:'riosystems.reference-extracted-asset-reconstruction.v2',
  asset_id:asset.asset_id,
  format,codec,lossless,
  actual_sha256:hash,
  canonical_png_sha256:asset.output_sha256,
  canonical_hash_match:hash===asset.output_sha256,
  dimensions,
  expected_dimensions:asset.output_dimensions,
  dimensions_match:!!dimensions&&dimensions.width===asset.output_dimensions.width&&dimensions.height===asset.output_dimensions.height,
  decode_error,
  ci_representation:bound,
  representation_bound:representationBound,
  requires_pixel_equivalence_verification:format!=='PNG'&&hash!==asset.output_sha256,
  provenance:manifest.provenance,
  usage_scope:manifest.usage_scope,
  production_use_allowed:false
};
await writeFile('artifacts/visual-foundry/stencil-constraint-v1/hero-asset-reconstruction.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

assert.equal(result.decode_error,null,'REFERENCE_EXTRACTED_HERO_DECODE_FAILED');
assert.equal(result.dimensions_match,true,'REFERENCE_EXTRACTED_HERO_DIMENSIONS_MISMATCH');
if(result.canonical_hash_match){
  assert.equal(format,'PNG');
}else{
  assert.equal(result.representation_bound,true,'REFERENCE_EXTRACTED_DERIVATIVE_UNBOUND');
}
