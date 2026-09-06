import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateReferenceRecord, createReferenceRegistry, resolveApprovedReference } from '../src/visual-foundry/reference-registry.js';
import { validateReferenceSpec } from '../src/visual-foundry/reference-spec.js';
import { detectFixtureLeak } from '../src/visual-foundry/fixture-mode.js';

const registry=JSON.parse(await readFile('factory-state/visual-foundry/reference-registry.json','utf8'));
assert.equal(registry.records.length,1,'Gold Standard scope must have exactly one registered reference');
const record=registry.records[0];
assert.equal(validateReferenceRecord(record).ok,true);
assert.equal(record.status,'APPROVED');
assert.equal(record.locked,true);
assert.equal(record.provenance,'OPERATOR_SUPPLIED');
assert.equal(record.hash,'6352c9e756d13e41382817bc9da265013c5721ac674b820f9962b113fe3a0d8b');
assert.deepEqual(record.viewport,{width:1536,height:1024,device_pixel_ratio:1});
const canonical=createReferenceRegistry(registry.records);
const resolved=resolveApprovedReference(canonical,{project_id:'aurentara-masterdashboard',viewport:{width:1536,height:1024}});
assert.equal(resolved.reference_id,'aurentara-hq-control-center-reference-v1-0');

const spec=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-spec-v1.json','utf8'));
const specValidation=validateReferenceSpec(spec);
assert.equal(specValidation.ok,true,JSON.stringify(specValidation.issues));
assert.equal(spec.reference_id,record.reference_id);
assert.equal(spec.version,'1.0');

const fixture=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-gold-standard-fixture-v1.json','utf8'));
assert.equal(fixture.truth_class,'VISUAL_FIXTURE');
assert.equal(fixture.runtime_truth_write_allowed,false);
assert.equal(fixture.production_allowed,false);
assert.equal(detectFixtureLeak(fixture).status,'PASS');

console.log(JSON.stringify({
  ok:true,
  suite:'visual-foundry-aurentara-reference-registration',
  approved_reference_count:1,
  reference_id:record.reference_id,
  reference_hash:record.hash,
  reference_lock:true,
  provenance:record.provenance,
  canvas:record.viewport,
  reference_spec:'PASS',
  fixture_isolation:'PASS',
  gold_standard_poc:'READY_FOR_3_ISOLATED_RUNS',
  wave20_locked:true
},null,2));
