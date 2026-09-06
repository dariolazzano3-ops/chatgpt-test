import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  approveReference, assertReferenceSourceOfTruth, createReferenceChangeRequest,
  createReferenceRecord, createReferenceRegistry, resolveApprovedReference,
  supersedeReference, updateReferenceRecord
} from '../src/visual-foundry/reference-registry.js';

const base=createReferenceRecord({
  reference_id:'aurentara-hq-desktop-v1',
  project_id:'aurentara-masterdashboard',
  name:'AURENTARA HQ Desktop',
  version:'1.0',
  source_type:'UPLOAD',
  source_path:'references/aurentara/hq-desktop-v1.png',
  viewport:{width:1586,height:992,device_pixel_ratio:1},
  hash:'sha256:synthetic-wave1'
},{now:'2026-09-06T16:00:00.000Z'});

assert.equal(base.status,'CANDIDATE');
assert.throws(()=>assertReferenceSourceOfTruth(base),/REFERENCE_NOT_APPROVED_SOURCE_OF_TRUTH/);

const approved=approveReference(base,{approved_by:'operator',approved_at:'2026-09-06T16:01:00.000Z'});
assert.equal(approved.status,'APPROVED');
assert.equal(approved.locked,true);
assert.equal(assertReferenceSourceOfTruth(approved),true);
assert.throws(()=>updateReferenceRecord(approved,{notes:'silent mutation'}),/REFERENCE_LOCKED_CHANGE_REQUEST_REQUIRED/);

const request=createReferenceChangeRequest(approved,{requested_by:'operator',reason:'New approved design version required',requested_changes:{notes:'candidate v2'}},{now:'2026-09-06T16:02:00.000Z'});
assert.equal(request.status,'OPEN');
assert.throws(()=>updateReferenceRecord(approved,{notes:'even with request'},{change_request:request}),/APPROVED_REFERENCE_IMMUTABLE_CREATE_NEW_VERSION/);

const v2=approveReference(createReferenceRecord({
  reference_id:'aurentara-hq-desktop-v2',
  project_id:'aurentara-masterdashboard',
  name:'AURENTARA HQ Desktop',
  version:'2.0',
  source_type:'UPLOAD',
  source_path:'references/aurentara/hq-desktop-v2.png',
  viewport:{width:1586,height:992,device_pixel_ratio:1},
  hash:'sha256:synthetic-wave1-v2'
},{now:'2026-09-06T16:03:00.000Z'}),{approved_by:'operator',approved_at:'2026-09-06T16:04:00.000Z'});

const superseded=supersedeReference(approved,v2);
assert.equal(superseded.status,'SUPERSEDED');
assert.equal(superseded.superseded_by,v2.reference_id);

const registry=createReferenceRegistry([superseded,v2]);
const resolved=resolveApprovedReference(registry,{project_id:'aurentara-masterdashboard',viewport:{width:1586,height:992}});
assert.equal(resolved.reference_id,v2.reference_id);
assert.throws(()=>resolveApprovedReference(createReferenceRegistry([base]),{project_id:'aurentara-masterdashboard'}),/APPROVED_REFERENCE_NOT_FOUND/);

const evidence={
  ok:true,
  suite:'visual-foundry-wave1-smoke',
  candidate_not_source_of_truth:'PASS',
  approval_lock:'PASS',
  change_request_required:'PASS',
  approved_reference_immutable:'PASS',
  supersede_contract:'PASS',
  approved_resolution:'PASS',
  fail_closed_missing_approved:'PASS',
  production_deploy:false,
  external_writes:false
};
await mkdir('artifacts/visual-foundry/wave1',{recursive:true});
await writeFile(path.join('artifacts/visual-foundry/wave1','evidence.json'),JSON.stringify({evidence,registry},null,2));
console.log(JSON.stringify(evidence,null,2));
