import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
import { compareGeometrySnapshots, compareVisualImages } from '../src/visual-foundry/visual-comparator.js';

const {PNG}=pngjs;
await mkdir('artifacts/visual-foundry/wave5',{recursive:true});
function make(file,mutate=false){
  const img=new PNG({width:100,height:80});
  for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
    const i=(y*img.width+x)*4;
    img.data[i]=x<50?20:180;img.data[i+1]=y<40?40:160;img.data[i+2]=80;img.data[i+3]=255;
    if(mutate&&x>=40&&x<60&&y>=30&&y<50){img.data[i]=255;img.data[i+1]=0;img.data[i+2]=0;}
  }
  return writeFile(file,PNG.sync.write(img));
}
await make('artifacts/visual-foundry/wave5/reference.png',false);
await make('artifacts/visual-foundry/wave5/actual-identical.png',false);
await make('artifacts/visual-foundry/wave5/actual-delta.png',true);

const same=await compareVisualImages({reference_path:'artifacts/visual-foundry/wave5/reference.png',actual_path:'artifacts/visual-foundry/wave5/actual-identical.png',diff_path:'artifacts/visual-foundry/wave5/diff-identical.png',regions:[{region_id:'center',x:35,y:25,width:30,height:30,critical:true}]});
assert.equal(same.pixel_difference.percent,0);
assert.equal(same.perceptual.score,1);
assert.equal(same.color.score,1);
assert.equal(same.edge.score,1);

const delta=await compareVisualImages({reference_path:'artifacts/visual-foundry/wave5/reference.png',actual_path:'artifacts/visual-foundry/wave5/actual-delta.png',diff_path:'artifacts/visual-foundry/wave5/diff-delta.png',regions:[{region_id:'center',x:35,y:25,width:30,height:30,critical:true}]});
assert.ok(delta.pixel_difference.percent>0);
assert.ok(delta.perceptual.score<1);
assert.ok(delta.color.score<1);
assert.ok(delta.regions[0].pixel_difference_percent>delta.pixel_difference.percent);

const refDom={components:[{component_id:'hero',status:'MEASURED',geometry:{x:10,y:20,width:500,height:200}}]};
const actualDom={components:[{component_id:'hero',status:'MEASURED',geometry:{x:11,y:20,width:501,height:200}}]};
const geo=compareGeometrySnapshots(refDom,actualDom,{tolerance_px:2});
assert.equal(geo.score,1);
const geoFail=compareGeometrySnapshots(refDom,{components:[{component_id:'hero',status:'MEASURED',geometry:{x:30,y:20,width:501,height:200}}]},{tolerance_px:2});
assert.ok(geoFail.score<1);
assert.equal(geoFail.blocking_count,1);

const evidence={ok:true,suite:'visual-foundry-wave5-smoke',pixel_difference:'PASS',ssim:'PASS',geometry_comparison:'PASS',color_comparison:'PASS',edge_structural_comparison:'PASS',region_comparison:'PASS',ai_only_acceptance:false,production_deploy:false,external_writes:false};
await writeFile('artifacts/visual-foundry/wave5/evidence.json',JSON.stringify({evidence,same,delta,geo,geoFail},null,2));
console.log(JSON.stringify(evidence,null,2));
