import assert from 'node:assert/strict';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';
import {
  J13_DELIVERY_STATES,
  J13_OPERATIONS,
  createJ13DeliveryLifecycle,
  registerJ13PrivatePreview,
  submitJ13CustomerFeedback,
  recordJ13CustomerRevision,
  approveJ13CustomerReview,
  evaluateJ13Delivery,
  createJ13Handoff,
  createJ13DeliveryPackage,
  verifyJ13DeliveryPackage,
  inspectJ13DeliveryLifecycle,
  j13DeliveryLifecycleManifest
} from '../src/web-factory/delivery-lifecycle-v1.js';
import {
  executeWebFactoryTask,
  webFactoryProviderManifest
} from '../src/web-factory/index.js';
import {
  injectPremiumMasterdashboard,
  premiumMasterdashboardManifest
} from '../src/operator-premium-masterdashboard-v1.js';
import {
  injectJ13OperatorDeliveryLifecycle,
  j13OperatorDeliveryLifecycleManifest
} from '../src/operator-delivery-lifecycle-v1.js';

const project={
  customer_id:'customer-j13',
  project_id:'website-v1',
  scope_key:'customer-j13:website-v1',
  name:'J13 Delivery Fixture',
  capabilities:[{id:'web_presence',required:true}],
  missions:[{mission_id:'mission-1'}],
  deliveries:[],
  delivery_contract:{
    schema:'aurentara.customer-delivery-contract.v1',
    customer_review_required:true,
    production_approval_required:true
  }
};

const preDelivery={
  project:{scope_key:project.scope_key},
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'knowledge-7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-5'},
  build:{build_id:'build-5',accepted:true},
  qa:{status:'PASS'},
  visual:{status:'PASS',delta_count:0},
  j9:{
    browser:{status:'PASS'},
    performance:{status:'PASS'},
    accessibility:{state:'FULL_ACCEPTED'}
  },
  preview:{available:true,review_status:'APPROVED',preview_url:'https://private.example.invalid/j13'},
  website_approval:{status:'APPROVED'}
};

const manifest=j13DeliveryLifecycleManifest();
assert.deepEqual(manifest.states,J13_DELIVERY_STATES);
assert.deepEqual(manifest.operations,J13_OPERATIONS);
assert.equal(manifest.j12_entry_gate_required,'READY_FOR_DELIVERY_LIFECYCLE');
assert.equal(manifest.existing_customer_review_lifecycle_reused,true);
assert.equal(manifest.existing_project_delivery_gate_reused,true);
assert.equal(manifest.existing_project_handoff_reused,true);
assert.equal(manifest.immutable_delivery_package,true);
assert.equal(manifest.external_activation_separate,true);
assert.equal(manifest.production_deploy,false);

const blocked=createJ13DeliveryLifecycle(project,{
  pre_delivery_evidence:{
    project:{scope_key:project.scope_key},
    source:{workspace:{knowledge_review:{status:'IN_REVIEW',catch_net:{unresolved_count:2}},sections:{project_knowledge:[]}}}
  }
});
assert.equal(blocked.ok,false);
assert.equal(blocked.status,'PRE_DELIVERY_BLOCKED');
assert.equal(blocked.error,'J13_J12_DELIVERY_HANDOFF_REQUIRED');
assert.equal(blocked.j12_next_best_action.code,'REVIEW_PROJECT_KNOWLEDGE');

const created=createJ13DeliveryLifecycle(project,{pre_delivery_evidence:preDelivery},{at:'2026-09-07T14:10:00.000Z',actor:'operator'});
assert.equal(created.ok,true);
assert.equal(created.status,'AWAITING_PRIVATE_PREVIEW');
let state=created.state;
assert.equal(state.review_state.schema,'aurentara.customer-review-lifecycle.v1');
assert.equal(state.j12_entry_evidence.primary_action.code,'READY_FOR_DELIVERY_LIFECYCLE');
assert.equal(state.safety.production_deploy,false);

const humanOutcome=evaluateHumanOutcomeAcceptance({
  technical_implementation:true,
  technical_integration:true,
  final_dom_presence:true,
  human_visibility:true,
  human_reachability:true,
  primary_interaction:true,
  expected_result:true,
  desktop_acceptance:true,
  mobile_acceptance:true,
  composition_regression:true,
  safety_regression:true
});
assert.equal(humanOutcome.human_outcome_accepted,true);

const invalidPreview=registerJ13PrivatePreview(state,{
  preview_url:'https://private.example.invalid/j13-v1',
  source_revision:'rev-1',
  private_access_verified:true,
  qa_passed:true
});
assert.equal(invalidPreview.ok,false);
assert.equal(invalidPreview.status,'J13_PRIVATE_PREVIEW_BLOCKED');
assert.equal(invalidPreview.error,'PRIVATE_PREVIEW_HUMAN_OUTCOME_REQUIRED');

let result=registerJ13PrivatePreview(state,{
  preview_id:'preview-1',
  preview_url:'https://private.example.invalid/j13-v1',
  source_revision:'rev-1',
  private_access_verified:true,
  qa_passed:true,
  human_outcome_acceptance:humanOutcome
},{at:'2026-09-07T14:11:00.000Z',actor:'operator'});
assert.equal(result.ok,true);
assert.equal(result.status,'CUSTOMER_REVIEW');
state=result.state;

result=submitJ13CustomerFeedback(state,{
  feedback_id:'feedback-1',
  type:'CONTENT_CORRECTION',
  summary:'CTA wording korrigieren',
  submitted_by:'customer'
},{at:'2026-09-07T14:12:00.000Z',actor:'customer'});
assert.equal(result.ok,true);
assert.equal(result.status,'REVISION_REQUIRED');
assert.equal(result.feedback.normal_revision_eligible,true);
state=result.state;

result=recordJ13CustomerRevision(state,{
  revision_id:'revision-1',
  source_revision:'rev-2',
  summary:'CTA wording korrigiert'
},{at:'2026-09-07T14:13:00.000Z',actor:'operator'});
assert.equal(result.ok,true);
assert.equal(result.status,'AWAITING_PRIVATE_PREVIEW');
assert.equal(result.revision.round,1);
state=result.state;

result=registerJ13PrivatePreview(state,{
  preview_id:'preview-2',
  preview_url:'https://private.example.invalid/j13-v2',
  source_revision:'rev-2',
  private_access_verified:true,
  qa_passed:true,
  human_outcome_acceptance:humanOutcome
},{at:'2026-09-07T14:14:00.000Z',actor:'operator'});
assert.equal(result.ok,true);
state=result.state;

const beforeApproval=evaluateJ13Delivery(state,{
  capabilities:[{id:'web_presence',completed:true}],
  qa_passed:true,
  scope_verified:true,
  costs_reconciled:true
},{now:new Date('2026-09-07T14:14:30.000Z')});
assert.equal(beforeApproval.ok,true);
assert.equal(beforeApproval.gate.ready_for_structural_delivery,false);
assert.ok(beforeApproval.gate.blockers.some(x=>x.code==='CUSTOMER_APPROVAL_REQUIRED'));

result=approveJ13CustomerReview(state,{
  actor_id:'customer-user'
},{at:'2026-09-07T14:15:00.000Z',actor:'customer-user'});
assert.equal(result.ok,true);
assert.equal(result.status,'CUSTOMER_APPROVED');
state=result.state;

const evaluated=evaluateJ13Delivery(state,{
  capabilities:[{id:'web_presence',completed:true}],
  qa_passed:true,
  scope_verified:true,
  costs_reconciled:true
},{now:new Date('2026-09-07T14:16:00.000Z'),at:'2026-09-07T14:16:00.000Z',actor:'operator'});
assert.equal(evaluated.ok,true);
assert.equal(evaluated.status,'STRUCTURAL_DELIVERY_READY');
assert.equal(evaluated.gate.ready_for_structural_delivery,true);
state=evaluated.state;

const handoff=createJ13Handoff(state,{
  capabilities:[{id:'web_presence',completed:true}],
  qa_passed:true,
  scope_verified:true,
  costs_reconciled:true
},{now:new Date('2026-09-07T14:17:00.000Z'),at:'2026-09-07T14:17:00.000Z',actor:'operator'});
assert.equal(handoff.ok,true);
assert.equal(handoff.status,'HANDOFF_READY');
assert.equal(handoff.handoff.handoff_version,'riosystems.project-handoff.v1');
assert.equal(handoff.handoff.customer_review.ready,true);
assert.equal(handoff.handoff.external_activation_separate,true);
state=handoff.state;

const artifactHash='a'.repeat(64);
const packaged=createJ13DeliveryPackage(state,{
  package_id:'package-1',
  artifacts:[{
    artifact_ref:'artifact://web/build-5',
    sha256:artifactHash,
    kind:'WEB_BUILD',
    revision:'build-5'
  }],
  source_revision:'rev-2',
  knowledge_revision:'knowledge-7',
  reference_version:'ref-5',
  j10_revision_id:'j10-build-5',
  j9_acceptance_ref:'evidence://j9/5',
  visual_acceptance_ref:'evidence://visual/5'
},{at:'2026-09-07T14:18:00.000Z',now:new Date('2026-09-07T14:18:00.000Z'),actor:'operator'});
assert.equal(packaged.ok,true);
assert.equal(packaged.status,'DELIVERY_PACKAGE_READY');
assert.equal(packaged.delivery_package.artifacts.length,1);
assert.equal(packaged.delivery_package.artifacts[0].sha256,artifactHash);
assert.equal(packaged.delivery_package.external_activation_separate,true);
assert.match(packaged.delivery_package.package_sha256,/^[a-f0-9]{64}$/);
state=packaged.state;

const verified=verifyJ13DeliveryPackage(packaged.delivery_package);
assert.equal(verified.ok,true);
assert.equal(verified.status,'J13_DELIVERY_PACKAGE_VERIFIED');

const tampered=structuredClone(packaged.delivery_package);
tampered.artifacts[0].artifact_ref='artifact://tampered';
const tamperCheck=verifyJ13DeliveryPackage(tampered);
assert.equal(tamperCheck.ok,false);
assert.equal(tamperCheck.status,'J13_DELIVERY_PACKAGE_TAMPERED');

const inspected=inspectJ13DeliveryLifecycle(state,{now:new Date('2026-09-07T14:19:00.000Z')});
assert.equal(inspected.ok,true);
assert.equal(inspected.status,'DELIVERY_PACKAGE_READY');
assert.equal(inspected.customer_review_ready,true);
assert.equal(inspected.structural_delivery_ready,true);
assert.equal(inspected.handoff_ready,true);
assert.equal(inspected.delivery_package_ready,true);
assert.equal(inspected.delivery_package_verified,true);

let scopeState=createJ13DeliveryLifecycle(project,{pre_delivery_evidence:preDelivery},{at:'2026-09-07T15:00:00.000Z'}).state;
scopeState=registerJ13PrivatePreview(scopeState,{
  preview_url:'https://private.example.invalid/scope',
  source_revision:'scope-1',
  private_access_verified:true,
  qa_passed:true,
  human_outcome_acceptance:humanOutcome
}).state;
const scopeExpansion=submitJ13CustomerFeedback(scopeState,{
  type:'SCOPE_EXPANSION',
  summary:'Zusätzlich Kundenlogin bauen',
  submitted_by:'customer'
});
assert.equal(scopeExpansion.ok,true);
assert.equal(scopeExpansion.status,'SCOPE_REASSESSMENT_REQUIRED');
const illegalRevision=recordJ13CustomerRevision(scopeExpansion.state,{
  source_revision:'scope-2',
  summary:'Kundenlogin schnell ergänzt'
});
assert.equal(illegalRevision.ok,false);
assert.equal(illegalRevision.status,'SCOPE_REASSESSMENT_REQUIRED');
assert.equal(illegalRevision.error,'SCOPE_EXPANSION_REQUIRES_DELIVERY_CONTRACT_REASSESSMENT');

const adapterManifest=executeWebFactoryTask({
  capability:'web.delivery.lifecycle.v1',
  operation:'manifest'
});
assert.equal(adapterManifest.ok,true);
assert.equal(adapterManifest.status,'J13_DELIVERY_LIFECYCLE_MANIFEST_READY');

const adapterCreate=executeWebFactoryTask({
  capability:'web.delivery.lifecycle.v1',
  operation:'create',
  project,
  input:{pre_delivery_evidence:preDelivery}
});
assert.equal(adapterCreate.ok,true);
assert.equal(adapterCreate.status,'AWAITING_PRIVATE_PREVIEW');

const provider=webFactoryProviderManifest();
assert.ok(provider.capabilities.includes('web.delivery.lifecycle.v1'));
assert.equal(provider.production_deploy,false);

const uiManifest=j13OperatorDeliveryLifecycleManifest();
assert.equal(uiManifest.existing_j12_next_best_action_reused,true);
assert.equal(uiManifest.external_activation_separate,true);
assert.equal(uiManifest.automatic_customer_communication,false);

const html='<!doctype html><html><body><section id="projects"></section></body></html>';
const direct=injectJ13OperatorDeliveryLifecycle(html);
for(const marker of [
  'aurentara-j13-delivery-lifecycle-script',
  'DELIVERY LIFECYCLE · J13',
  'PRE_DELIVERY_BLOCKED',
  'READY_TO_START_CUSTOMER_REVIEW',
  'Delivery Package'
]) assert.ok(direct.includes(marker),marker);
assert.equal(injectJ13OperatorDeliveryLifecycle(direct),direct);

const premium=injectPremiumMasterdashboard(html);
assert.ok(premium.includes('aurentara-j13-delivery-lifecycle-script'));
assert.ok(premium.includes('aurentara-j12-next-best-action-script'));
const premiumManifest=premiumMasterdashboardManifest();
assert.equal(premiumManifest.j13_delivery_lifecycle,true);
assert.equal(premiumManifest.j12_next_best_action,true);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j13-delivery-lifecycle',
  states:J13_DELIVERY_STATES,
  operations:J13_OPERATIONS,
  j12_entry_gate:'PASS',
  private_preview_human_outcome_gate:'PASS',
  normal_revision_loop:'PASS',
  scope_expansion_reassessment:'PASS',
  customer_approval:'PASS',
  structural_delivery_gate:'PASS',
  handoff:'PASS',
  immutable_delivery_package:'PASS',
  tamper_detection:'PASS',
  operator_projection:'PASS',
  external_activation_separate:true,
  automatic_customer_communication:false,
  automatic_execution:false,
  automatic_merge:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
