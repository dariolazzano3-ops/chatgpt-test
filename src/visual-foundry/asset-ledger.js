import { validateAssetRights } from '../web-factory/visual-design-contract.js';

export const ASSET_CATEGORIES=Object.freeze([
  'ORIGINAL_ASSET','REFERENCE_EXTRACTED','OPERATOR_SUPPLIED','GENERATED_REPLACEMENT','TEMPORARY_PLACEHOLDER'
]);
export const FIDELITY_IMPORTANCE=Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
const LICENSES=new Set(['owned','licensed','public_domain','generated','unknown']);

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

export function createAssetRecord(input={}){
  const category=clean(input.category,80).toUpperCase();
  if(!ASSET_CATEGORIES.includes(category)) throw new Error('ASSET_CATEGORY_INVALID');
  const importance=clean(input.fidelity_importance||'MEDIUM',40).toUpperCase();
  if(!FIDELITY_IMPORTANCE.includes(importance)) throw new Error('ASSET_FIDELITY_IMPORTANCE_INVALID');
  const license=clean(input.license_status||'unknown',80).toLowerCase();
  if(!LICENSES.has(license)) throw new Error('ASSET_LICENSE_STATUS_INVALID');
  const assetId=clean(input.asset_id,180),referenceId=clean(input.reference_id,180),source=clean(input.source,1000);
  if(!assetId) throw new Error('ASSET_ID_REQUIRED');
  if(!referenceId) throw new Error('ASSET_REFERENCE_ID_REQUIRED');
  if(!source) throw new Error('ASSET_SOURCE_REQUIRED');

  const generated=category==='GENERATED_REPLACEMENT'||input.generated===true;
  const placeholder=category==='TEMPORARY_PLACEHOLDER'||input.placeholder===true;
  const originalAvailable=input.original_available===true;
  return {
    schema:'riosystems.asset-record.v1',
    asset_id:assetId,
    reference_id:referenceId,
    type:clean(input.type||'image',80),
    category,
    source,
    original_available:originalAvailable,
    operator_supplied:category==='OPERATOR_SUPPLIED'||input.operator_supplied===true,
    extractable:input.extractable===true,
    generated,
    placeholder,
    license_status:license,
    fidelity_importance:importance,
    approved:input.approved===true,
    allowed_for_reimplementation:input.allowed_for_reimplementation===true,
    replacement_for:input.replacement_for?clean(input.replacement_for,180):null,
    hash:input.hash?clean(input.hash,180):null,
    notes:clean(input.notes,1200)
  };
}

export function validateAssetRecord(record={}){
  const issues=[];
  if(record.schema!=='riosystems.asset-record.v1') issues.push('ASSET_SCHEMA_INVALID');
  if(!clean(record.asset_id,180)) issues.push('ASSET_ID_REQUIRED');
  if(!clean(record.reference_id,180)) issues.push('ASSET_REFERENCE_ID_REQUIRED');
  if(!ASSET_CATEGORIES.includes(record.category)) issues.push('ASSET_CATEGORY_INVALID');
  if(!FIDELITY_IMPORTANCE.includes(record.fidelity_importance)) issues.push('ASSET_FIDELITY_IMPORTANCE_INVALID');
  if(record.category==='ORIGINAL_ASSET'&&record.original_available!==true) issues.push('ORIGINAL_ASSET_MUST_BE_AVAILABLE');
  if(record.category==='GENERATED_REPLACEMENT'&&record.generated!==true) issues.push('GENERATED_REPLACEMENT_FLAG_REQUIRED');
  if(record.category==='TEMPORARY_PLACEHOLDER'&&record.placeholder!==true) issues.push('PLACEHOLDER_FLAG_REQUIRED');
  if((record.generated||record.placeholder)&&record.category==='ORIGINAL_ASSET') issues.push('ORIGINAL_ASSET_CANNOT_BE_REPLACEMENT');
  return {ok:issues.length===0,issues};
}

function rightsInput(record){
  return {
    asset_id:record.asset_id,
    source:record.source,
    kind:record.type,
    license_status:record.license_status,
    allowed_for_reimplementation:record.allowed_for_reimplementation===true,
    replacement_required:record.placeholder===true
  };
}

export function createAssetLedger(records=[]){
  const items=(Array.isArray(records)?records:[]).map(record=>{
    const validation=validateAssetRecord(record);
    if(!validation.ok) throw new Error('ASSET_RECORD_INVALID:'+record?.asset_id+':'+validation.issues.join(','));
    return clone(record);
  });
  const ids=new Set();
  for(const item of items){
    if(ids.has(item.asset_id)) throw new Error('ASSET_ID_DUPLICATE:'+item.asset_id);
    ids.add(item.asset_id);
  }
  return {schema:'riosystems.asset-ledger.v1',records:items};
}

export function evaluateAssetPipeline(ledger={}){
  const records=Array.isArray(ledger.records)?ledger.records:[];
  const rights=validateAssetRights(records.map(rightsInput));
  const blockers=[];
  for(const asset of records){
    const important=['HIGH','CRITICAL'].includes(asset.fidelity_importance);
    const replacement=asset.category==='GENERATED_REPLACEMENT'||asset.category==='TEMPORARY_PLACEHOLDER';
    if(important&&!asset.original_available&&asset.category!=='OPERATOR_SUPPLIED'){
      const approvedReplacement=records.some(r=>r.replacement_for===asset.asset_id&&r.approved===true&&!r.placeholder&&['owned','licensed','public_domain','generated'].includes(r.license_status));
      if(!approvedReplacement){
        blockers.push({code:'ASSET_BLOCKER',asset_id:asset.asset_id,reason:'FIDELITY_RELEVANT_ORIGINAL_OR_APPROVED_REPLACEMENT_MISSING'});
      }
    }
    if(replacement&&asset.approved!==true&&important){
      blockers.push({code:'ASSET_BLOCKER',asset_id:asset.asset_id,reason:'FIDELITY_RELEVANT_REPLACEMENT_NOT_APPROVED'});
    }
    if(asset.placeholder&&asset.approved===true){
      blockers.push({code:'ASSET_BLOCKER',asset_id:asset.asset_id,reason:'TEMPORARY_PLACEHOLDER_CANNOT_BE_FINAL_APPROVED'});
    }
  }
  for(const item of rights.blocking_assets||[]) blockers.push({code:'ASSET_RIGHTS_BLOCKER',asset_id:item.asset_id,reason:item.reason});
  const unique=[];
  for(const b of blockers) if(!unique.some(x=>x.code===b.code&&x.asset_id===b.asset_id&&x.reason===b.reason)) unique.push(b);
  return {
    schema:'riosystems.asset-pipeline-report.v1',
    status:unique.length?'BLOCKED':'PASS',
    blockers:unique,
    rights,
    silent_replacements_allowed:false,
    asset_count:records.length,
    categories:Object.fromEntries(ASSET_CATEGORIES.map(c=>[c,records.filter(r=>r.category===c).length]))
  };
}

export function assetDisplayLabel(record={}){
  const labels={
    ORIGINAL_ASSET:'Original Asset',
    REFERENCE_EXTRACTED:'Reference Extracted',
    OPERATOR_SUPPLIED:'Operator Supplied',
    GENERATED_REPLACEMENT:'Generated Replacement',
    TEMPORARY_PLACEHOLDER:'Temporary Placeholder'
  };
  return labels[record.category]||'Unknown Asset';
}
