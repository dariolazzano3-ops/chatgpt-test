import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';
import ssimPackage from 'ssim.js';

const ssim = typeof ssimPackage === 'function'
  ? ssimPackage
  : typeof ssimPackage?.ssim === 'function'
    ? ssimPackage.ssim
    : typeof ssimPackage?.default === 'function'
      ? ssimPackage.default
      : null;

const { PNG } = pngjs;

const round=(v,d=6)=>{const f=10**d;return Math.round(Number(v||0)*f)/f;};
const clamp=v=>Math.max(0,Math.min(1,v));

async function readPng(filePath){
  const buffer=await fs.readFile(filePath).catch(()=>null);
  if(!buffer) throw new Error('COMPARATOR_IMAGE_MISSING:'+filePath);
  try{return PNG.sync.read(buffer);}catch{throw new Error('COMPARATOR_PNG_INVALID:'+filePath);}
}

function averageColor(image,region=null){
  const x0=Math.max(0,Math.floor(region?.x||0));
  const y0=Math.max(0,Math.floor(region?.y||0));
  const x1=Math.min(image.width,Math.ceil(region?(region.x+region.width):image.width));
  const y1=Math.min(image.height,Math.ceil(region?(region.y+region.height):image.height));
  let r=0,g=0,b=0,n=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*image.width+x)*4;
    const a=image.data[i+3]/255;
    r+=image.data[i]*a;g+=image.data[i+1]*a;b+=image.data[i+2]*a;n+=a;
  }
  return n?{r:r/n,g:g/n,b:b/n}:{r:0,g:0,b:0};
}

function colorScore(a,b){
  const ca=averageColor(a),cb=averageColor(b);
  const dist=Math.hypot(ca.r-cb.r,ca.g-cb.g,ca.b-cb.b);
  return {score:round(clamp(1-dist/(Math.sqrt(3)*255))),expected:ca,actual:cb,distance:round(dist,3)};
}

function grayscale(image){
  const out=new Float32Array(image.width*image.height);
  for(let i=0,p=0;i<image.data.length;i+=4,p++)out[p]=0.2126*image.data[i]+0.7152*image.data[i+1]+0.0722*image.data[i+2];
  return out;
}

function edgeMap(image){
  const gray=grayscale(image),out=new Uint8Array(image.width*image.height);
  const w=image.width,h=image.height;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const p=y*w+x;
    const gx=-gray[p-w-1]+gray[p-w+1]-2*gray[p-1]+2*gray[p+1]-gray[p+w-1]+gray[p+w+1];
    const gy=-gray[p-w-1]-2*gray[p-w]-gray[p-w+1]+gray[p+w-1]+2*gray[p+w]+gray[p+w+1];
    out[p]=Math.hypot(gx,gy)>=80?1:0;
  }
  return out;
}

function edgeScore(a,b){
  const ea=edgeMap(a),eb=edgeMap(b);
  let union=0,intersection=0;
  for(let i=0;i<ea.length;i++){if(ea[i]||eb[i])union++;if(ea[i]&&eb[i])intersection++;}
  return round(union?intersection/union:1);
}

function crop(image,region){
  const x=Math.max(0,Math.floor(region.x)),y=Math.max(0,Math.floor(region.y));
  const width=Math.max(1,Math.min(image.width-x,Math.floor(region.width)));
  const height=Math.max(1,Math.min(image.height-y,Math.floor(region.height)));
  const out=new PNG({width,height});
  PNG.bitblt(image,out,x,y,width,height,0,0);
  return out;
}

function compareDecoded(reference,actual,options={}){
  if(reference.width!==actual.width||reference.height!==actual.height){
    return {
      status:'DIMENSION_MISMATCH',
      dimensions_equal:false,
      reference_dimensions:{width:reference.width,height:reference.height},
      actual_dimensions:{width:actual.width,height:actual.height},
      pixel_difference_ratio:1,
      pixel_difference_percent:100,
      perceptual_score:0,
      color_score:0,
      edge_score:0
    };
  }
  const diff=new PNG({width:reference.width,height:reference.height});
  const diffPixels=pixelmatch(reference.data,actual.data,diff.data,reference.width,reference.height,{
    threshold:Number(options.pixel_threshold??0.1),
    includeAA:Boolean(options.include_antialiasing??false)
  });
  const total=reference.width*reference.height;
  const pixelRatio=total?diffPixels/total:0;
  if(typeof ssim!=='function') throw new Error('SSIM_ADAPTER_UNAVAILABLE');
  const perceptual=ssim(
    {data:reference.data,width:reference.width,height:reference.height},
    {data:actual.data,width:actual.width,height:actual.height}
  );
  const colors=colorScore(reference,actual);
  return {
    status:'MEASURED',
    dimensions_equal:true,
    reference_dimensions:{width:reference.width,height:reference.height},
    actual_dimensions:{width:actual.width,height:actual.height},
    different_pixels:diffPixels,
    total_pixels:total,
    pixel_difference_ratio:round(pixelRatio),
    pixel_difference_percent:round(pixelRatio*100,4),
    perceptual_score:round(perceptual.mssim),
    color_score:colors.score,
    color_difference:colors,
    edge_score:edgeScore(reference,actual),
    diff_png:diff
  };
}

export async function compareVisualImages(input={}){
  const reference=await readPng(path.resolve(String(input.reference_path||'')));
  const actual=await readPng(path.resolve(String(input.actual_path||'')));
  const base=compareDecoded(reference,actual,input);
  const regions=[];
  if(base.dimensions_equal){
    for(const region of Array.isArray(input.regions)?input.regions:[]){
      const id=String(region.region_id||region.id||'').trim();
      if(!id) throw new Error('COMPARATOR_REGION_ID_REQUIRED');
      const refCrop=crop(reference,region),actualCrop=crop(actual,region);
      const result=compareDecoded(refCrop,actualCrop,input);
      delete result.diff_png;
      regions.push({region_id:id,critical:region.critical===true,bounds:{x:region.x,y:region.y,width:region.width,height:region.height},...result});
    }
  }
  if(base.diff_png&&input.diff_path){
    await fs.mkdir(path.dirname(path.resolve(input.diff_path)),{recursive:true});
    await fs.writeFile(path.resolve(input.diff_path),PNG.sync.write(base.diff_png));
  }
  delete base.diff_png;
  return {
    schema:'riosystems.visual-measurement-report.v1',
    status:base.status,
    pixel_difference:{ratio:base.pixel_difference_ratio,percent:base.pixel_difference_percent,different_pixels:base.different_pixels??null,total_pixels:base.total_pixels??null},
    perceptual:{algorithm:'SSIM',score:base.perceptual_score},
    geometry:{dimensions_equal:base.dimensions_equal,reference:base.reference_dimensions,actual:base.actual_dimensions},
    color:{score:base.color_score,details:base.color_difference||null},
    edge:{algorithm:'sobel-jaccard',score:base.edge_score},
    regions,
    deterministic:true,
    ai_acceptance_authority:false
  };
}

export function compareGeometrySnapshots(reference={},actual={},options={}){
  const toleranceDefault=Number(options.tolerance_px??2);
  const actualMap=new Map((actual.components||[]).map(x=>[x.component_id,x]));
  const components=[];
  for(const expected of reference.components||[]){
    if(expected.status&&expected.status!=='MEASURED')continue;
    const got=actualMap.get(expected.component_id);
    if(!got||got.status!=='MEASURED'){
      components.push({component_id:expected.component_id,status:'MISSING',score:0,blocking:true});
      continue;
    }
    const deltas={};
    let passed=0,total=0;
    for(const key of ['x','y','width','height']){
      total++;
      const e=Number(expected.geometry?.[key]),a=Number(got.geometry?.[key]);
      const diff=Math.abs(e-a);
      const tolerance=Number(options.component_tolerances?.[expected.component_id]?.[key]??toleranceDefault);
      const ok=Number.isFinite(diff)&&diff<=tolerance;
      if(ok)passed++;
      deltas[key]={expected:e,actual:a,difference:round(diff,3),tolerance,pass:ok};
    }
    components.push({component_id:expected.component_id,status:'MEASURED',score:round(passed/total),blocking:passed!==total,deltas});
  }
  const score=components.length?round(components.reduce((s,c)=>s+c.score,0)/components.length):1;
  return {schema:'riosystems.geometry-comparison.v1',score,components,blocking_count:components.filter(x=>x.blocking).length};
}
