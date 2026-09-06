import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');

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
let decoded;
try{decoded=PNG.sync.read(bytes);}catch(error){
  console.error(JSON.stringify({code:'HERO_ASSET_DECODE_FAILED',hash,bytes:bytes.length,message:error?.message},null,2));
  throw error;
}
const result={
  schema:'riosystems.reference-extracted-asset-reconstruction.v1',
  asset_id:asset.asset_id,
  actual_sha256:hash,
  expected_sha256:asset.output_sha256,
  hash_match:hash===asset.output_sha256,
  dimensions:{width:decoded.width,height:decoded.height},
  expected_dimensions:asset.output_dimensions,
  dimensions_match:decoded.width===asset.output_dimensions.width&&decoded.height===asset.output_dimensions.height,
  provenance:manifest.provenance,
  usage_scope:manifest.usage_scope,
  production_use_allowed:false
};
await mkdir('artifacts/visual-foundry/stencil-constraint-v1',{recursive:true});
await writeFile('artifacts/visual-foundry/stencil-constraint-v1/hero-asset-reconstruction.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
assert.equal(result.hash_match,true,'REFERENCE_EXTRACTED_HERO_HASH_MISMATCH');
assert.equal(result.dimensions_match,true,'REFERENCE_EXTRACTED_HERO_DIMENSIONS_MISMATCH');
