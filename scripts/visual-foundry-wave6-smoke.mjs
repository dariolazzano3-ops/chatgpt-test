import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createVisualDelta, deltasFromGeometryComparison, deltasFromVisualMeasurement, validateVisualDelta } from '../src/visual-foundry/visual-delta.js';

const base={reference_id:'ref-v1',implementation_commit:'abc123',viewport:{width:1440,height:1100,device_pixel_ratio:1}};
const delta=createVisualDelta({...base,region:'hero',category:'GEOMETRY',severity:'CRITICAL',expected:320,actual:440,difference:120,unit:'px',score:0.62,blocking:false,evidence:{metric:'height'},repair_hint:'Reduce hero height.'});
assert.equal(delta.blocking,true);
assert.equal(validateVisualDelta(delta).ok,true);

const visual=deltasFromVisualMeasurement({...base,measurement_report:{
  schema:'riosystems.visual-measurement-report.v1',
  pixel_difference:{ratio:0.02,percent:2},
  perceptual:{score:0.97},
  geometry:{dimensions_equal:true,reference:{width:1440,height:1100},actual:{width:1440,height:1100}},
  color:{score:0.99},
  edge:{score:0.98},
  regions:[{region_id:'hero',critical:true,bounds:{x:0,y:0,width:1440,height:400},pixel_difference_ratio:0.08,perceptual_score:0.91}]
}});
const hero=visual.find(x=>x.region==='hero');
assert.ok(hero);
assert.equal(hero.blocking,true);
assert.ok(['HIGH','CRITICAL'].includes(hero.severity));

const dim=deltasFromVisualMeasurement({...base,measurement_report:{
  schema:'riosystems.visual-measurement-report.v1',
  pixel_difference:{ratio:1},perceptual:{score:0},color:{score:0},edge:{score:0},
  geometry:{dimensions_equal:false,reference:{width:1440,height:1100},actual:{width:1400,height:1100}},regions:[]
}});
assert.equal(dim.length,1);
assert.equal(dim[0].severity,'CRITICAL');
assert.equal(dim[0].category,'GEOMETRY');

const geometry=deltasFromGeometryComparison({...base,geometry_report:{
  schema:'riosystems.geometry-comparison.v1',score:0.5,blocking_count:1,
  components:[{component_id:'hero',status:'MEASURED',score:0.75,deltas:{x:{expected:20,actual:20,difference:0,tolerance:2,pass:true},y:{expected:20,actual:20,difference:0,tolerance:2,pass:true},width:{expected:1000,actual:1000,difference:0,tolerance:2,pass:true},height:{expected:300,actual:420,difference:120,tolerance:2,pass:false}}}]
}});
assert.equal(geometry.length,1);
assert.equal(geometry[0].category,'GEOMETRY');
assert.equal(geometry[0].blocking,true);

const evidence={ok:true,suite:'visual-foundry-wave6-smoke',visual_delta_contract:'PASS',critical_always_blocking:'PASS',critical_region_gate:'PASS',dimension_mismatch_critical:'PASS',geometry_delta_generation:'PASS',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave6',{recursive:true});
await writeFile('artifacts/visual-foundry/wave6/evidence.json',JSON.stringify({evidence,visual,dimension_delta:dim,geometry},null,2));
console.log(JSON.stringify(evidence,null,2));
