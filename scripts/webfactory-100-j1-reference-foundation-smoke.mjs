import assert from 'node:assert/strict';
import {
  REFERENCE_STATES,
  createReferenceBrief,
  createSketchGenerationContract,
  createWireframeContract,
  createCandidateReferenceContract,
  requestReferenceChanges,
  iterateReference,
  approveReference,
  verifyApprovedReferenceLock,
  supersedeApprovedReference,
  createReferenceRegistry,
  referenceStudioDashboardProjection,
  executeReferenceStudioTask
} from '../src/web-factory/reference-studio-v1.js';

const knowledge={
  knowledge_id:'gelato-knowledge-v12',
  scope_key:'customer:gelato-donatello:website-v1',
  revision:'12',
  business_name:'Gelato Donatello',
  industry:'gelateria',
  primary_goal:'Show confirmed assortment and drive visits',
  target_audience:'Local guests and families',
  required_sections:['hero','sortiment','opening-hours','location','contact'],
  facts:[
    {key:'business_name',value:'Gelato Donatello',status:'CONFIRMED',source:'operator'},
    {key:'fake_review',value:'4.9/5',status:'PROHIBITED',source:'synthetic'}
  ]
};

assert.deepEqual(REFERENCE_STATES,['DRAFT','SKETCH','WIREFRAME','CANDIDATE','CHANGES_REQUESTED','APPROVED','SUPERSEDED']);

const brief=createReferenceBrief({
  project_knowledge:knowledge,
  project_scope:knowledge.scope_key,
  knowledge_revision:'12',
  viewport:'1440_DESKTOP',
  design_intent:{purpose:'Warm premium local gelateria'}
},{now:'2026-09-07T00:30:00.000Z'});
assert.equal(brief.ok,true);
assert.equal(brief.reference.state,'DRAFT');
assert.equal(brief.reference.reference_brief.required_facts.length,1);
assert.equal(brief.reference.reference_brief.prohibited_facts.length,1);

const sketch=createSketchGenerationContract(brief.reference,{
  layout_hypotheses:['Editorial hero with product-led second section']
},{now:'2026-09-07T00:31:00.000Z'});
assert.equal(sketch.reference.state,'SKETCH');
assert.equal(sketch.reference.artifact.fidelity,'LOW');

const wireframe=createWireframeContract(sketch.reference,{
  sections:[{id:'hero',purpose:'Positioning'},{id:'sortiment',purpose:'Products'}]
},{now:'2026-09-07T00:32:00.000Z'});
assert.equal(wireframe.reference.state,'WIREFRAME');

const candidate=createCandidateReferenceContract(wireframe.reference,{
  render_asset_ref:'reference://gelato/desktop/candidate-v1.png',
  render_asset_hash:'abc123',
  width:1440,
  height:1600,
  design_notes:['Keep product focus'],
  unresolved_items:[]
},{now:'2026-09-07T00:33:00.000Z'});
assert.equal(candidate.reference.state,'CANDIDATE');
assert.equal(candidate.reference.visual_source_of_truth,false);

const fakeApproval=approveReference(candidate.reference,{
  approved_by:'system',
  approval_kind:'HUMAN'
},{now:'2026-09-07T00:34:00.000Z'});
assert.equal(fakeApproval.ok,false);
assert.equal(fakeApproval.status,'EXPLICIT_HUMAN_APPROVAL_REQUIRED');

const changes=requestReferenceChanges(candidate.reference,{
  requested_by:'operator-dario',
  changes:['Increase hero breathing room','Reduce card radius']
},{now:'2026-09-07T00:34:00.000Z'});
assert.equal(changes.reference.state,'CHANGES_REQUESTED');

const iteration=iterateReference(changes.reference,{
  revision_notes:changes.reference.change_request.changes,
  render_asset_ref:'reference://gelato/desktop/candidate-v1-0-1.png',
  render_asset_hash:'def456'
},{now:'2026-09-07T00:35:00.000Z'});
assert.equal(iteration.reference.version,'1.0.1');
assert.equal(iteration.reference.parent_version,'1.0.0');
assert.equal(iteration.reference.state,'CANDIDATE');

const approved=approveReference(iteration.reference,{
  approved_by:'operator-dario',
  approval_kind:'HUMAN'
},{now:'2026-09-07T00:36:00.000Z'});
assert.equal(approved.ok,true);
assert.equal(approved.reference.state,'APPROVED');
assert.equal(approved.reference.hash_locked,true);
assert.equal(approved.reference.hash.length,64);
assert.equal(approved.reference.visual_source_of_truth,true);
assert.equal(verifyApprovedReferenceLock(approved.reference).ok,true);

const tampered=structuredClone(approved.reference);
tampered.design_intent.purpose='tampered';
assert.equal(verifyApprovedReferenceLock(tampered).ok,false);
assert.equal(iterateReference(approved.reference,{revision_notes:['blocked']}).ok,false);

const mobileBrief=createReferenceBrief({
  project_knowledge:knowledge,
  project_scope:knowledge.scope_key,
  knowledge_revision:'12',
  viewport:'390_MOBILE',
  reference_id:'gelato-mobile-reference'
},{now:'2026-09-07T00:40:00.000Z'});
const mobileCandidate=createCandidateReferenceContract(
  createSketchGenerationContract(mobileBrief.reference,{}, {now:'2026-09-07T00:41:00.000Z'}).reference,
  {render_asset_ref:'reference://gelato/mobile/candidate.png',render_asset_hash:'mobile123',unresolved_items:[]},
  {now:'2026-09-07T00:42:00.000Z'}
);
const mobileApproved=approveReference(mobileCandidate.reference,{
  approved_by:'operator-dario',
  approval_kind:'HUMAN'
},{now:'2026-09-07T00:43:00.000Z'});
assert.equal(mobileApproved.ok,true);

const registry=createReferenceRegistry({
  project_scope:knowledge.scope_key,
  references:[approved.reference,mobileApproved.reference]
});
assert.equal(registry.approved_reference_count,2);
assert.equal(registry.active_approved_by_viewport['1440_DESKTOP'].hash,approved.reference.hash);

const dashboard=referenceStudioDashboardProjection({current_reference:candidate.reference});
assert.equal(dashboard.allowed_actions.approve_reference,true);
assert.equal(dashboard.next_best_action,'REFERENCE_FREIGEBEN');

const adapter=executeReferenceStudioTask({operation:'verify',reference:approved.reference});
assert.equal(adapter.ok,true);

const replacementBrief=createReferenceBrief({
  project_knowledge:{...knowledge,revision:'13'},
  project_scope:knowledge.scope_key,
  knowledge_revision:'13',
  viewport:'1440_DESKTOP',
  version:'2.0.0'
},{now:'2026-09-07T00:45:00.000Z'});
const replacementCandidate=createCandidateReferenceContract(
  createSketchGenerationContract(replacementBrief.reference,{}, {now:'2026-09-07T00:46:00.000Z'}).reference,
  {render_asset_ref:'reference://gelato/desktop/v2.png',render_asset_hash:'v2',unresolved_items:[]},
  {now:'2026-09-07T00:47:00.000Z'}
);
const replacementApproved=approveReference(replacementCandidate.reference,{
  approved_by:'operator-dario',
  approval_kind:'HUMAN'
},{now:'2026-09-07T00:48:00.000Z'});
const superseded=supersedeApprovedReference(
  approved.reference,
  replacementApproved.reference,
  {now:'2026-09-07T00:49:00.000Z'}
);
assert.equal(superseded.ok,true);
assert.equal(superseded.reference.state,'SUPERSEDED');
assert.equal(superseded.reference.hash_locked,true);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j1-reference-foundation',
  approved_hash:approved.reference.hash,
  approved_version:approved.reference.version,
  dashboard_next_best_action:dashboard.next_best_action,
  automatic_approval_allowed:false,
  production_deploy:false,
  variable_cost_eur:0
},null,2));
