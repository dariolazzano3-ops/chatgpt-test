import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createReferenceSpec, measurement, referenceSpecManifest, validateReferenceSpec } from '../src/visual-foundry/reference-spec.js';

const spec=createReferenceSpec({
  reference_id:'aurentara-hq-desktop-v1',
  version:'1.0',
  viewport:{width:1586,height:992,device_pixel_ratio:1},
  regions:[{region_id:'sidebar',critical:true,bounds:{x:measurement(0,{unit:'px',source_method:'PIXEL',confidence:0.99}),width:measurement(238,{unit:'px',tolerance:2,source_method:'PIXEL',confidence:0.98})}}],
  components:[{component_id:'hero',region_id:'hero',metrics:{height:measurement(320,{unit:'px',tolerance:3,source_method:'PIXEL',confidence:0.97})}}],
  tokens:{radius_card:measurement(16,{unit:'px',tolerance:1,source_method:'VISION',confidence:0.8})},
  typography:{h1:{font_size:measurement(42,{unit:'px',tolerance:1,source_method:'PIXEL',confidence:0.95}),line_height:measurement(48,{unit:'px',tolerance:1,source_method:'PIXEL',confidence:0.95})}},
  spacing:{content_padding:measurement(24,{unit:'px',tolerance:2,source_method:'PIXEL',confidence:0.94})},
  colors:{background:measurement('#0b0d10',{unit:'color',source_method:'PIXEL',confidence:0.99})},
  effects:{card_shadow:measurement('0 12px 30px rgba(0,0,0,.25)',{unit:'string',source_method:'VISION',confidence:0.72})},
  assets:[],
  responsive_rules:[],
  fixture_contract:{truth_class:'VISUAL_FIXTURE',runtime_truth_write_allowed:false},
  measurement_confidence:0.94
});
assert.equal(validateReferenceSpec(spec).ok,true);
assert.equal(referenceSpecManifest().provider_neutral,true);
assert.equal(referenceSpecManifest().unstructured_llm_prose_source_of_truth,false);

assert.throws(()=>createReferenceSpec({...spec,provider:'OpenAI'}),/REFERENCE_SPEC_PROVIDER_COUPLING_FORBIDDEN/);
const broken=structuredClone(spec); broken.spacing.content_padding.confidence=1.2;
assert.equal(validateReferenceSpec(broken).ok,false);
assert.throws(()=>measurement(10,{unit:'bananas',source_method:'PIXEL',confidence:1}),/MEASUREMENT_UNIT_INVALID/);
assert.throws(()=>measurement(10,{unit:'px',source_method:'UNKNOWN_MODEL',confidence:1}),/MEASUREMENT_SOURCE_METHOD_INVALID/);

const evidence={
  ok:true,
  suite:'visual-foundry-wave2-smoke',
  reference_spec_validation:'PASS',
  structured_measurement_contract:'PASS',
  provider_neutrality:'PASS',
  invalid_confidence_fail_closed:'PASS',
  invalid_unit_fail_closed:'PASS',
  unstructured_llm_prose_source_of_truth:false,
  production_deploy:false,
  external_writes:false
};
await mkdir('artifacts/visual-foundry/wave2',{recursive:true});
await writeFile('artifacts/visual-foundry/wave2/evidence.json',JSON.stringify({evidence,spec,manifest:referenceSpecManifest()},null,2));
console.log(JSON.stringify(evidence,null,2));
