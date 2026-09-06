import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { assetDisplayLabel, createAssetLedger, createAssetRecord, evaluateAssetPipeline } from '../src/visual-foundry/asset-ledger.js';

const original=createAssetRecord({
  asset_id:'logo-original',reference_id:'ref',type:'logo',category:'ORIGINAL_ASSET',source:'assets/logo.svg',
  original_available:true,license_status:'owned',fidelity_importance:'CRITICAL',approved:true,allowed_for_reimplementation:true
});
const photo=createAssetRecord({
  asset_id:'hero-photo',reference_id:'ref',type:'image',category:'OPERATOR_SUPPLIED',source:'assets/hero.webp',
  original_available:true,operator_supplied:true,license_status:'licensed',fidelity_importance:'HIGH',approved:true,allowed_for_reimplementation:true
});
const good=createAssetLedger([original,photo]);
assert.equal(evaluateAssetPipeline(good).status,'PASS');
assert.equal(assetDisplayLabel(original),'Original Asset');

const missing=createAssetRecord({
  asset_id:'critical-illustration',reference_id:'ref',type:'illustration',category:'REFERENCE_EXTRACTED',source:'reference-crop',
  original_available:false,extractable:true,license_status:'unknown',fidelity_importance:'CRITICAL',approved:false,allowed_for_reimplementation:false
});
const blocked=evaluateAssetPipeline(createAssetLedger([missing]));
assert.equal(blocked.status,'BLOCKED');
assert.ok(blocked.blockers.some(x=>x.code==='ASSET_BLOCKER'));

const placeholder=createAssetRecord({
  asset_id:'placeholder',reference_id:'ref',type:'image',category:'TEMPORARY_PLACEHOLDER',source:'generated-placeholder.png',
  original_available:false,placeholder:true,license_status:'generated',fidelity_importance:'HIGH',approved:false,allowed_for_reimplementation:true,replacement_for:'critical-illustration'
});
const replacement=createAssetRecord({
  asset_id:'replacement',reference_id:'ref',type:'illustration',category:'GENERATED_REPLACEMENT',source:'generated-final.png',
  original_available:false,generated:true,license_status:'generated',fidelity_importance:'HIGH',approved:true,allowed_for_reimplementation:true,replacement_for:'critical-illustration'
});
const replaced=evaluateAssetPipeline(createAssetLedger([missing,replacement]));
assert.ok(replaced.blockers.some(x=>x.code==='ASSET_RIGHTS_BLOCKER'&&x.asset_id==='critical-illustration'),'original rights blocker remains explicit even when replacement exists');
assert.equal(assetDisplayLabel(replacement),'Generated Replacement');
assert.equal(assetDisplayLabel(placeholder),'Temporary Placeholder');

assert.throws(()=>createAssetRecord({asset_id:'x',reference_id:'ref',category:'SILENT_FAKE',source:'x'}),/ASSET_CATEGORY_INVALID/);

const evidence={ok:true,suite:'visual-foundry-wave14-smoke',asset_ledger:'PASS',asset_rights_reused:'PASS',fidelity_asset_blocker:'PASS',generated_replacement_explicit:'PASS',placeholder_explicit:'PASS',silent_replacements_allowed:false,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave14',{recursive:true});
await writeFile('artifacts/visual-foundry/wave14/evidence.json',JSON.stringify({evidence,good:evaluateAssetPipeline(good),blocked,replaced},null,2));
console.log(JSON.stringify(evidence,null,2));
