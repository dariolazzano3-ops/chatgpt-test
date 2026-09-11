import assert from 'node:assert/strict';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';
import {
  createJ10RevisionLedger,
  createJ10Revision,
  verifyJ10RevisionLedger,
  createJ11WebFactoryControlPlane,
  deriveJ12NextBestAction,
  createJ13DeliveryLifecycle,
  registerJ13PrivatePreview,
  approveJ13CustomerReview,
  evaluateJ13Delivery,
  createJ13Handoff,
  createJ13DeliveryPackage,
  verifyJ13DeliveryPackage,
  evaluateJ14FullDogfoodClosure,
  j14FullDogfoodClosureManifest
} from '../src/web-factory/index.js';

const scope='synthetic-j14:full-dogfood-v1';
const source={
  workspace:{
    knowledge_review:{status:'APPROVED',current_knowledge_revision:'knowledge-j14-1'},
    sections:{project_knowledge:[{fact_id:'business_name',verification_status:'VERIFIED',value:'J14 Fixture'}]}
  }
};
const reference={status:'APPROVED',version:'reference-j14-1',approved:true};
const build={build_id:'build-j14-1',accepted:true,build_profile:'PREMIUM'};
const qa={status:'PASS',passed:true};
const visual={status:'PASS',delta_count:0,score:0.99};
const j9={
  browser:{status:'PASS'},
  performance:{status:'PASS',lighthouse:{status:'PASS',performance:0.96}},
  accessibility:{status:'PASS',state:'FULL_ACCEPTED',axe:{critical:0,serious:0}}
};
const preview={available:true,review_status:'APPROVED',preview_url:'https://private.example.invalid/j14',reviewed:true};
const websiteApproval={status:'APPROVED',approved:true};

let ledger=createJ10RevisionLedger({project_scope:scope,created_at:'2026-09-12T00:00:00.000Z'}).ledger;
const revision=createJ10Revision(ledger,{
  revision_id:'j14-build-revision-1',
  domain:'BUILD',
  version:'1.0.0',
  change_reason:'J14 synthetic accepted build',
  created_at:'2026-09-12T00:01:00.000Z',
  source_revision:'synthetic-j14',
  acceptance_status:'KNOWN_GOOD',
  artifact_ref:'artifact://j14/build/1',
  artifact_payload:{build_id:'build-j14-1',files:{'index.html':'<main>J14</main>'}},
  snapshot:{build_id:'build-j14-1',qa:'PASS'}
});
assert.equal(revision.ok,true);
ledger=revision.ledger;
const ledgerIntegrity=verifyJ10RevisionLedger(ledger);
assert.equal(ledgerIntegrity.status,'PASS');

const controlPlane=createJ11WebFactoryControlPlane({
  project:{scope_key:scope,name:'J14 Fixture',build_profile:'PREMIUM',current_cost_eur:0},
  jaguar_version:'J14',source,reference,visual,build,qa,j9,preview,
  delivery:{status:'READY',ready:true},
  change_impact:{action:'NO_REBUILD'}
});
assert.equal(controlPlane.status,'READY');
assert.equal(controlPlane.no_fake_pass,true);

const j12=deriveJ12NextBestAction({
  project:{scope_key:scope,name:'J14 Fixture'},
  source,reference,build,qa,visual,j9,preview,website_approval:websiteApproval
});
assert.equal(j12.status,'READY');
assert.equal(j12.primary_action.code,'READY_FOR_DELIVERY_LIFECYCLE');
assert.equal(j12.exactly_one_primary_action,true);

const project={
  customer_id:'synthetic-j14',
  project_id:'full-dogfood-v1',
  scope_key:scope,
  name:'J14 Full Dogfood Fixture',
  capabilities:[{id:'web_presence',required:true}],
  missions:[{mission_id:'j14-mission-1'}],
  deliveries:[],
  delivery_contract:{
    schema:'aurentara.customer-delivery-contract.v1',
    customer_review_required:true,
    production_approval_required:true
  }
};

let lifecycle=createJ13DeliveryLifecycle(project,{
  pre_delivery_evidence:{project:{scope_key:scope},source,reference,build,qa,visual,j9,preview,website_approval:websiteApproval},
  j12
},{at:'2026-09-12T00:02:00.000Z',actor:'operator'});
assert.equal(lifecycle.ok,true);
assert.equal(lifecycle.status,'AWAITING_PRIVATE_PREVIEW');
let state=lifecycle.state;

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

lifecycle=registerJ13PrivatePreview(state,{
  preview_id:'j14-preview-1',
  preview_url:'https://private.example.invalid/j14-review',
  source_revision:'j14-source-1',
  private_access_verified:true,
  qa_passed:true,
  human_outcome_acceptance:humanOutcome
},{at:'2026-09-12T00:03:00.000Z',actor:'operator'});
assert.equal(lifecycle.ok,true);
assert.equal(lifecycle.status,'CUSTOMER_REVIEW');
state=lifecycle.state;

lifecycle=approveJ13CustomerReview(state,{actor_id:'synthetic-customer'},{at:'2026-09-12T00:04:00.000Z',actor:'synthetic-customer'});
assert.equal(lifecycle.ok,true);
assert.equal(lifecycle.status,'CUSTOMER_APPROVED');
state=lifecycle.state;

lifecycle=evaluateJ13Delivery(state,{
  capabilities:[{id:'web_presence',completed:true}],
  qa_passed:true,
  scope_verified:true,
  costs_reconciled:true,
  production_deploy:false
},{now:new Date('2026-09-12T00:05:00.000Z'),at:'2026-09-12T00:05:00.000Z',actor:'operator'});
assert.equal(lifecycle.ok,true);
assert.equal(lifecycle.status,'STRUCTURAL_DELIVERY_READY');
state=lifecycle.state;

lifecycle=createJ13Handoff(state,{
  capabilities:[{id:'web_presence',completed:true}],
  qa_passed:true,
  scope_verified:true,
  costs_reconciled:true,
  production_deploy:false
},{now:new Date('2026-09-12T00:06:00.000Z'),at:'2026-09-12T00:06:00.000Z',actor:'operator'});
assert.equal(lifecycle.ok,true);
assert.equal(lifecycle.status,'HANDOFF_READY');
state=lifecycle.state;

lifecycle=createJ13DeliveryPackage(state,{
  package_id:'j14-delivery-package-1',
  artifacts:[{artifact_ref:'artifact://j14/build/1',sha256:'b'.repeat(64),kind:'WEB_BUILD',revision:'1.0.0'}],
  source_revision:'j14-source-1',
  knowledge_revision:'knowledge-j14-1',
  reference_version:'reference-j14-1',
  j10_revision_id:'j14-build-revision-1',
  j9_acceptance_ref:'evidence://j9/j14',
  visual_acceptance_ref:'evidence://visual/j14'
},{at:'2026-09-12T00:07:00.000Z',now:new Date('2026-09-12T00:07:00.000Z'),actor:'operator'});
assert.equal(lifecycle.ok,true);
assert.equal(lifecycle.status,'DELIVERY_PACKAGE_READY');
const packageVerification=verifyJ13DeliveryPackage(lifecycle.delivery_package);
assert.equal(packageVerification.ok,true);

const prerequisites={
  waves:Array.from({length:13},(_,i)=>({wave:'J'+(i+1),status:'CANONICAL_ACCEPTED',exact_head_verified:true})),
  safety:{automatic_execution:false,automatic_merge:false,production_deploy:false,public_launch:false,dns_change:false,billing_activation:false,automatic_paid_activation:false,external_writes:false}
};

const stages=[
  ['PROJECT_KNOWLEDGE',source.workspace.knowledge_review.status==='APPROVED'],
  ['REFERENCE',reference.approved===true],
  ['BUILD',build.accepted===true&&qa.status==='PASS'],
  ['VISUAL_CLOSURE',visual.status==='PASS'&&visual.delta_count===0],
  ['BROWSER_ACCESSIBILITY_PERFORMANCE',j9.browser.status==='PASS'&&j9.performance.status==='PASS'&&j9.accessibility.state==='FULL_ACCEPTED'],
  ['VERSIONING_DIFF_ROLLBACK',ledgerIntegrity.status==='PASS'],
  ['DASHBOARD_CONTROL_PLANE',controlPlane.status==='READY'],
  ['NEXT_BEST_ACTION',j12.primary_action.code==='READY_FOR_DELIVERY_LIFECYCLE'],
  ['DELIVERY_LIFECYCLE',lifecycle.status==='DELIVERY_PACKAGE_READY'],
  ['DELIVERY_PACKAGE_VERIFICATION',packageVerification.ok===true]
].map(([stage,ok])=>({stage,status:ok?'PASS':'FAIL'}));

const closure=evaluateJ14FullDogfoodClosure({
  prerequisites,
  synthetic_full_dogfood:{
    project_scope:scope,
    stages,
    delivery_package_verified:packageVerification.ok,
    exactly_one_primary_action:j12.exactly_one_primary_action,
    variable_cost_eur:0,
    safety:{automatic_execution:false,automatic_merge:false,production_deploy:false,public_launch:false,dns_change:false,billing_activation:false,automatic_paid_activation:false,external_writes:false},
    evidence:{j10_revision_id:'j14-build-revision-1',delivery_package_id:lifecycle.delivery_package.package_id}
  },
  real_project_integrity:{
    project_scope:'gelato-donatello:gelato-donatello-website-v1',
    project_kind:'REAL',
    blockers:['CONTACT_DETAILS','OPENING_HOURS','LEGAL_CURRENTNESS','TARGET_CUSTOMERS','PRIMARY_CONVERSION','FINAL_ASSET_QUALITY_APPROVAL','FINAL_HUMAN_QUALITY_APPROVAL'],
    expected_blocked:true,
    claimed_ready:false,
    mutated:false,
    safety:{automatic_execution:false,automatic_merge:false,production_deploy:false,public_launch:false,dns_change:false,billing_activation:false,automatic_paid_activation:false,external_writes:false},
    evidence:{full_dogfood:'NOT_YET_PASS',premium_delivery_ready:false,public_launch_ready:false}
  }
});

assert.equal(closure.status,'ACCEPTED_FOR_CANONICAL_MERGE');
assert.equal(closure.ready_for_canonical_merge,true);
assert.equal(closure.canonical_wave_count_before_merge,13);
assert.equal(closure.canonical_wave_count_after_verified_merge,14);
assert.equal(closure.canonical_percent_after_verified_merge,100);
assert.equal(closure.synthetic_full_dogfood.status,'PASS');
assert.equal(closure.real_project_integrity.status,'PASS');
assert.equal(closure.real_project_integrity.claimed_ready,false);
assert.equal(closure.real_project_integrity.fake_pass_detected,false);
assert.deepEqual(closure.blockers,[]);
assert.equal(closure.no_fake_pass,true);
assert.equal(closure.production_deploy,false);
assert.equal(closure.external_writes,false);

const manifest=j14FullDogfoodClosureManifest();
assert.equal(manifest.final_canonical_percent,100);
assert.equal(manifest.fake_real_project_pass_forbidden,true);
assert.equal(manifest.post_merge_exact_head_verification_required,true);
assert.equal(manifest.production_deploy,false);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j14-full-dogfood-closure',
  prerequisite_waves:closure.prerequisites.accepted_count,
  synthetic_full_lifecycle:closure.synthetic_full_dogfood.status,
  synthetic_stage_count:closure.synthetic_full_dogfood.passed_stage_count,
  real_project_integrity:closure.real_project_integrity.status,
  real_project_claimed_ready:closure.real_project_integrity.claimed_ready,
  ready_for_canonical_merge:closure.ready_for_canonical_merge,
  canonical_percent_after_verified_merge:closure.canonical_percent_after_verified_merge,
  no_fake_pass:true,
  automatic_execution:false,
  automatic_merge:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
