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
assert.equal(manifest.public_distribution_allowed,false);

const b64=(await readFile('factory-state/visual-foundry/assets/hero-earth-pure.png.b64','utf8')).replace(/\s+/g,'');
const bytes=Buffer.from(b64,'base64');
const actualHash=sha256(bytes);
const signature=bytes.subarray(0,8).toString('hex');
assert.equal(signature,'89504e470d0a1a0a','REFERENCE_EXTRACTED_HERO_NOT_PNG');

let decoded=null,decodeError=null;
try{decoded=PNG.sync.read(bytes)}catch(error){decodeError=error?.message||String(error)}

await mkdir('artifacts/visual-foundry/stencil-constraint-v1',{recursive:true});
await writeFile('artifacts/visual-foundry/stencil-constraint-v1/hero-earth-reconstructed.png',bytes);

const result={
  schema:'riosystems.reference-extracted-asset-reconstruction.v3',
  asset_id:asset.asset_id,
  format:'PNG',
  actual_sha256:actualHash,
  canonical_png_sha256:asset.output_sha256,
  canonical_hash_match:actualHash===asset.output_sha256,
  dimensions:decoded?{width:decoded.width,height:decoded.height}:null,
  expected_dimensions:asset.output_dimensions,
  dimensions_match:!!decoded&&decoded.width===asset.output_dimensions.width&&decoded.height===asset.output_dimensions.height,
  decode_error:decodeError,
  transport:'SINGLE_CANONICAL_PNG_BASE64',
  derivative_used:false,
  provenance:manifest.provenance,
  usage_scope:manifest.usage_scope,
  production_use_allowed:false,
  public_distribution_allowed:false
};
await writeFile('artifacts/visual-foundry/stencil-constraint-v1/hero-asset-reconstruction.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

assert.equal(result.decode_error,null,'REFERENCE_EXTRACTED_HERO_DECODE_FAILED');
assert.equal(result.canonical_hash_match,true,'REFERENCE_EXTRACTED_HERO_HASH_MISMATCH');
assert.equal(result.dimensions_match,true,'REFERENCE_EXTRACTED_HERO_DIMENSIONS_MISMATCH');
assert.equal(result.derivative_used,false);
