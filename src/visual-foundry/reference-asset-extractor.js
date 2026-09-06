import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pngjs from 'pngjs';
import jpeg from 'jpeg-js';

const { PNG }=pngjs;
const clean=(v,max=1200)=>String(v??'').trim().slice(0,max);
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

function decodeImage(buffer){
  if(buffer.length>=8&&buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
    const img=PNG.sync.read(buffer);
    return {format:'PNG',width:img.width,height:img.height,data:img.data};
  }
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff){
    const img=jpeg.decode(buffer,{useTArray:true,formatAsRGBA:true});
    return {format:'JPEG',width:img.width,height:img.height,data:img.data};
  }
  throw new Error('REFERENCE_ASSET_FORMAT_UNSUPPORTED');
}

function normalizeCrop(crop={},canvas={}){
  const x=Math.floor(Number(crop.x)),y=Math.floor(Number(crop.y));
  const width=Math.floor(Number(crop.width)),height=Math.floor(Number(crop.height));
  if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<1||height<1) throw new Error('REFERENCE_CROP_INVALID');
  if(x+width>canvas.width||y+height>canvas.height) throw new Error('REFERENCE_CROP_OUT_OF_BOUNDS');
  return {x,y,width,height};
}

function cropRgba(image,crop){
  const out=new PNG({width:crop.width,height:crop.height});
  for(let y=0;y<crop.height;y++){
    const sourceStart=((crop.y+y)*image.width+crop.x)*4;
    const targetStart=y*crop.width*4;
    image.data.copy
      ? image.data.copy(out.data,targetStart,sourceStart,sourceStart+crop.width*4)
      : out.data.set(image.data.subarray(sourceStart,sourceStart+crop.width*4),targetStart);
  }
  return out;
}

export function validateReferenceCropContract(contract={}){
  const issues=[];
  if(contract.schema!=='riosystems.reference-crop-contract.v1')issues.push('REFERENCE_CROP_SCHEMA_INVALID');
  for(const key of ['reference_id','reference_hash','asset_id'])if(!clean(contract[key],300))issues.push('REFERENCE_CROP_FIELD_REQUIRED:'+key);
  if(contract.provenance!=='REFERENCE_EXTRACTED')issues.push('REFERENCE_CROP_PROVENANCE_INVALID');
  if(contract.usage_scope!=='GOLD_STANDARD_POC_ONLY')issues.push('REFERENCE_CROP_USAGE_SCOPE_INVALID');
  if(contract.production_use_allowed!==false)issues.push('REFERENCE_CROP_PRODUCTION_MUST_BE_FALSE');
  try{normalizeCrop(contract.crop,contract.canvas||{});}catch(e){issues.push(String(e.message||e));}
  return {ok:issues.length===0,issues};
}

export function createReferenceCropContract(input={}){
  const canvas={width:Number(input.canvas?.width),height:Number(input.canvas?.height)};
  if(!Number.isInteger(canvas.width)||!Number.isInteger(canvas.height)||canvas.width<1||canvas.height<1) throw new Error('REFERENCE_CROP_CANVAS_INVALID');
  const contract={
    schema:'riosystems.reference-crop-contract.v1',
    reference_id:clean(input.reference_id,300),
    reference_version:clean(input.reference_version||'1.0',80),
    reference_hash:clean(input.reference_hash,300),
    asset_id:clean(input.asset_id,300),
    role:clean(input.role||'VISUAL_ASSET',120),
    fidelity_importance:clean(input.fidelity_importance||'HIGH',40).toUpperCase(),
    canvas,
    crop:normalizeCrop(input.crop,canvas),
    provenance:'REFERENCE_EXTRACTED',
    usage_scope:'GOLD_STANDARD_POC_ONLY',
    operator_approved_reference_required:true,
    production_use_allowed:false,
    public_distribution_allowed:false,
    rights_inference_allowed:false,
    notes:clean(input.notes,1200)
  };
  const validation=validateReferenceCropContract(contract);
  if(!validation.ok)throw new Error('REFERENCE_CROP_CONTRACT_INVALID:'+validation.issues.join(','));
  return contract;
}

export async function extractReferenceAsset(input={}){
  const contract=input.contract;
  const validation=validateReferenceCropContract(contract||{});
  if(!validation.ok)throw new Error('REFERENCE_CROP_CONTRACT_INVALID:'+validation.issues.join(','));
  const referencePath=path.resolve(clean(input.reference_path,2000));
  const outputPath=path.resolve(clean(input.output_path,2000));
  if(!referencePath||!outputPath)throw new Error('REFERENCE_ASSET_PATH_REQUIRED');
  const source=await fs.readFile(referencePath);
  const actualHash=sha256(source);
  if(actualHash!==contract.reference_hash)throw new Error('REFERENCE_HASH_MISMATCH');
  const image=decodeImage(source);
  if(image.width!==contract.canvas.width||image.height!==contract.canvas.height)throw new Error('REFERENCE_CANVAS_MISMATCH');
  const cropped=cropRgba(image,contract.crop);
  const png=PNG.sync.write(cropped);
  await fs.mkdir(path.dirname(outputPath),{recursive:true});
  await fs.writeFile(outputPath,png);
  return {
    schema:'riosystems.reference-extracted-asset.v1',
    asset_id:contract.asset_id,
    reference_id:contract.reference_id,
    reference_version:contract.reference_version,
    source_reference_hash:actualHash,
    output_hash:sha256(png),
    source_format:image.format,
    output_format:'PNG',
    canvas:contract.canvas,
    crop:contract.crop,
    dimensions:{width:contract.crop.width,height:contract.crop.height},
    role:contract.role,
    fidelity_importance:contract.fidelity_importance,
    provenance:'REFERENCE_EXTRACTED',
    usage_scope:'GOLD_STANDARD_POC_ONLY',
    production_use_allowed:false,
    public_distribution_allowed:false,
    rights_inference_allowed:false,
    output_path:outputPath
  };
}
