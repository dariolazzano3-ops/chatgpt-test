import assert from 'node:assert/strict';
import {
  createProjectSourceIntakeState,
  registerProjectSource,
  registerProjectAsset,
  upsertProjectFact,
  reviewProjectFact,
  createContentPack,
  createVisualPack,
  recordContentReadiness,
  evaluatePremiumDiscoveryReadiness
} from '../src/project-source-intake-v1.js';
import { intakeManualSource } from '../src/project-source-workspace-intake-v1.js';
import { createCustomerDeliveryContractV1 } from '../src/customer-delivery-contract-v1.js';
import {
  createPremiumInputReadiness,
  createPremiumBrandReadiness,
  evaluatePremiumWebsiteStandard
} from '../src/web-factory/premium-standard-v1.js';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';
import {
  createCustomerReviewLifecycleV1,
  registerPrivatePreviewV1,
  submitCustomerFeedbackV1,
  recordCustomerRevisionV1,
  approveCustomerReviewV1,
  evaluateCustomerReviewLifecycleV1
} from '../src/customer-review-lifecycle-v1.js';
import { evaluateProjectDelivery } from '../src/project-delivery-gate.js';

const scopeKey = 'gelato-donatello:gelato-donatello-website-v1';
const at = (minute) => `2026-09-04T20:${String(minute).padStart(2,'0')}:00.000Z`;

const actualSources = {
  website: 'src_c72e57c7-00b8-4b40-b924-2dbf173920aa',
  logo: 'src_7653bfaf-6ac7-41ec-91b5-8ac50b899842',
  rental: 'src_faad6303-bede-431f-b167-daeb666ddf14',
  scoopVoucher: 'src_0c808147-1124-4a04-a910-a69648719feb',
  giftVoucher: 'src_a6e14587-a411-452d-8449-6b09764f952f',
  cappuccino: 'src_efd054e7-0915-4651-80be-c54c2fbd36c3'
};
const actualAssets = [
  { asset_id:'asset_src_7653bfaf-6ac7-41ec-91b5-8ac50b899842', source_id:actualSources.logo, usage_role:'LOGO', hash:'sha256:64d172f8dd0c6e793dacd118456e10ef8c1a9a817bfef092fb5dd2bbe70d29f3' },
  { asset_id:'asset_src_faad6303-bede-431f-b167-daeb666ddf14', source_id:actualSources.rental, usage_role:'GALLERY', hash:'sha256:51d800e60faf313b51f8666cbc59c0edff4cc6254fc4f4e0914591829d7c8551' },
  { asset_id:'asset_src_0c808147-1124-4a04-a910-a69648719feb', source_id:actualSources.scoopVoucher, usage_role:'GALLERY', hash:'sha256:70a1d9021209af6da065058555114608f669a264e62aba240103598c534a406f' },
  { asset_id:'asset_src_a6e14587-a411-452d-8449-6b09764f952f', source_id:actualSources.giftVoucher, usage_role:'GALLERY', hash:'sha256:3d781fdb8b2b294d7e98186b040f54381239165b1948a6b326c4cef75fc1aafd' },
  { asset_id:'asset_src_efd054e7-0915-4651-80be-c54c2fbd36c3', source_id:actualSources.cappuccino, usage_role:'GALLERY', hash:'sha256:813984cda62796fdf3869ebc82de0dac96b35b92ca2dafe7ea6cb6bdb5f34fb5' }
];

let state = createProjectSourceIntakeState({
  operator_id:'operator:gelato-ferrari-dogfood',
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:scopeKey,
  at:at(0)
}).state;

let source = registerProjectSource(state, {
  source_id:actualSources.website,
  source_type:'OWNED_WEBSITE',
  locator:'https://gelato-donatello.de/',
  display_name:'Website source',
  ownership_status:'CUSTOMER_ASSERTED',
  ingestion_status:'IMPORTED',
  website_usage:{ content:true, structure_reference:false, design_reference:false }
}, { at:at(1) });
assert.equal(source.ok,true);
state=source.state;

for (const [source_id,display_name] of [
  [actualSources.logo,'Gelato Donatello Logo'],
  [actualSources.rental,'Eisvitrine vermietung'],
  [actualSources.scoopVoucher,'Gutschein für Eiskugeln'],
  [actualSources.giftVoucher,'Geschenkgutschein'],
  [actualSources.cappuccino,'Capucchino']
]) {
  source=registerProjectSource(state,{
    source_id,source_type:'IMAGE_VISUAL',locator:`private://gelato-source/${source_id}`,
    display_name,ownership_status:'OWNED_CONFIRMED',ingestion_status:'IMPORTED'
  },{at:at(2)});
  assert.equal(source.ok,true);
  state=source.state;
}

for (const asset of actualAssets) {
  const registered=registerProjectAsset(state,{
    ...asset,
    storage_ref:`private://gelato-asset/${asset.asset_id}`,
    mime_type:'image/png',
    rights_status:'OWNED_CONFIRMED',
    publishable:true,
    editable:true,
    derivative_allowed:true
  },{at:at(3)});
  assert.equal(registered.ok,true);
  assert.equal(registered.asset.publishable,true);
  state=registered.state;
}

const manual=intakeManualSource(state,{
  source_id:'gelato-manual-confirmed-inputs-v1',
  display_name:'Gelato confirmed project inputs',
  ownership_status:'CUSTOMER_ASSERTED',
  facts:[
    {fact_id:'gelato-name-confirmed',field_path:'business.name',value:'Gelato Donatello',verification_status:'OPERATOR_CONFIRMED'},
    {fact_id:'gelato-products-confirmed',field_path:'business.products',value:['Eis','Eisbecher','Spaghetti-Eis','Shakes','Joghurt','Kinderangebote','Eistorten','Eisbomben','Eisvitrinen-Vermietung'],verification_status:'OPERATOR_CONFIRMED'},
    {fact_id:'gelato-pricing-confirmed',field_path:'business.pricing',value:{
      kugel_eis_eur:1.60,sahne_eur:1.20,sosse_eur:1.00,cremes_likoere_eur:1.50,
      eistorten_eur:{'18_cm':65,'20_cm':75,'24_cm':95,'26_cm':109},
      eisbombe_aufschlag_eur:10,premiumsorten_aufschlag_eur:5,
      eisvitrine:{miete_eur:250,kaution_eur:100,eis_liter:5,sorten:4,zubehoer_inklusive:true}
    },verification_status:'OPERATOR_CONFIRMED'},
    {fact_id:'gelato-flavor-count-confirmed',field_path:'products.flavor_count',value:40,verification_status:'OPERATOR_CONFIRMED',critical:true},
    {fact_id:'gelato-mocca-confirmed',field_path:'products.mocca_included',value:true,verification_status:'OPERATOR_CONFIRMED',critical:false},
    {fact_id:'gelato-private-goal',field_path:'website.primary_goal',value:'Sortiment und bestätigte Preise verständlich präsentieren; externe Kontakt- oder Bestellwege erst nach Customer Confirmation aktivieren.',verification_status:'OPERATOR_CONFIRMED',critical:false}
  ]
},{at:at(4)});
assert.equal(manual.ok,true);
state=manual.state;

const addExtracted=(fact_id,field_path,value,{critical=false}={})=>{
  const added=upsertProjectFact(state,{
    fact_id,field_path,value,origin:'EXTRACTED',verification_status:'UNVERIFIED',
    source_refs:[actualSources.website],critical
  },{at:at(5)});
  assert.equal(added.ok,true);
  state=added.state;
  return added.fact;
};

const oldFlavor=addExtracted('gelato-live-flavor-claim','products.flavor_count','über 45 verschiedene Eissorten',{critical:true});
assert.equal(oldFlavor.verification_status,'SOURCE_CONFLICT');
assert.equal(state.facts.find((f)=>f.fact_id==='gelato-flavor-count-confirmed').verification_status,'SOURCE_CONFLICT');

const phoneA=addExtracted('gelato-live-phone-home','business.phone','06806 9394980',{critical:true});
const phoneB=addExtracted('gelato-live-phone-imprint','business.phone','+49 176 200 150 65',{critical:true});
assert.equal(phoneA.verification_status,'UNVERIFIED');
assert.equal(phoneB.verification_status,'SOURCE_CONFLICT');
assert.equal(state.facts.find((f)=>f.fact_id==='gelato-live-phone-home').verification_status,'SOURCE_CONFLICT');

addExtracted('gelato-live-address','business.address','Hauptstraße 4, 66346 Köllerbach',{critical:true});
addExtracted('gelato-live-hours','business.opening_hours','täglich 12:00–22:00 Uhr, März–Oktober',{critical:true});
addExtracted('gelato-live-email','business.email','Fabrizio.lazzano@freenet.de',{critical:true});
addExtracted('gelato-live-history','trust.history_since',1965,{critical:false});
addExtracted('gelato-live-generation','trust.second_generation',true,{critical:false});
addExtracted('gelato-live-legal','legal.details',{
  entity:'Gelato Donatello UG (haftungsbeschränkt)',
  responsible_person:'Fabrizio Lazzano',
  vat_id:'DE 306 726 779'
},{critical:true});

let reviewed=reviewProjectFact(state,'gelato-flavor-count-confirmed',{
  verification_status:'OPERATOR_CONFIRMED',verified_by:'operator:gelato-ferrari-dogfood'
},{at:at(6)});
assert.equal(reviewed.ok,true);
state=reviewed.state;
assert.equal(state.facts.find((f)=>f.fact_id==='gelato-live-flavor-claim').verification_status,'REJECTED');

for (const factId of ['gelato-live-phone-home','gelato-live-phone-imprint']) {
  reviewed=reviewProjectFact(state,factId,{
    verification_status:'REJECTED',verified_by:'operator:gelato-ferrari-dogfood'
  },{at:at(7)});
  assert.equal(reviewed.ok,true);
  state=reviewed.state;
}
assert.equal(state.facts.filter((f)=>f.field_path==='business.phone'&&f.verification_status==='SOURCE_CONFLICT').length,0);

const contentPackResult=createContentPack(state,{pack_id:'gelato-ferrari-content-v1',at:at(8)});
assert.equal(contentPackResult.ok,true);
state=contentPackResult.state;
const visualPackResult=createVisualPack(state,{
  pack_id:'gelato-ferrari-visual-v1',
  visual_constraints:['Use only OWNED_CONFIRMED project assets','No asset byte substitution by filename']
},{at:at(9)});
assert.equal(visualPackResult.ok,true);
state=visualPackResult.state;
assert.equal(visualPackResult.pack.approved_assets.length,5);

const readinessResult=recordContentReadiness(state,{
  will_show_pricing:true,
  will_show_address:false,
  will_show_phone:false,
  will_show_email:false,
  will_show_opening_hours:false,
  legal_required:false,
  requires_assets:true,
  intended_asset_ids:actualAssets.map((x)=>x.asset_id),
  production_locked:true,
  readiness_id:'gelato-ferrari-readiness-v1',
  at:at(10)
});
assert.equal(readinessResult.ok,true);
state=readinessResult.state;
assert.equal(readinessResult.snapshot.status,'READY_WITH_WARNINGS');
assert.equal(readinessResult.snapshot.blockers.length,0);

const premiumDiscovery=evaluatePremiumDiscoveryReadiness(state,{
  required_inputs:['business_identity','business_model','products_services','target_customers','primary_conversion'],
  legal_required:true,
  required_asset_roles:['LOGO','GALLERY'],
  asset_quality:Object.fromEntries(actualAssets.map((x)=>[x.asset_id,'NOT_APPROVED'])),
  brand_path:'USE_EXISTING_BRAND'
});
assert.equal(premiumDiscovery.ok,true);
assert.equal(premiumDiscovery.projection.status,'BLOCKED');
assert.deepEqual(premiumDiscovery.projection.missing_customer_inputs.sort(),['business_model','target_customers']);
assert.deepEqual(premiumDiscovery.projection.missing_legal_inputs,['legal.details']);
assert.equal(premiumDiscovery.projection.unverified_critical_fact_count > 0,true);

const missingInputs=[
  'business_model',
  'target_customers',
  'primary_conversion_channel',
  'current_contact_details',
  'opening_hours_confirmation',
  'legal_details',
  'final_asset_quality_approval'
];
const contractResult=createCustomerDeliveryContractV1({
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:scopeKey,
  customer_problem:'Die bestehende Gelato-Website evidence-backed modernisieren und als private Premium-Vorschau mit bestätigten Inhalten bereitstellen.',
  desired_outcomes:['confirmed-content premium private preview','rights-safe visual pack','customer-reviewable website candidate'],
  requested_capabilities:['web_presence'],
  required_capabilities:['web_presence'],
  optional_capabilities:[],
  excluded_capabilities:['lead_capture','business_crm','automation_followup','analytics','ai_assistance'],
  required_customer_inputs:['business_identity','products_services','pricing',...missingInputs],
  available_customer_inputs:['business_identity','products_services','pricing'],
  missing_inputs:missingInputs,
  human_decisions_required:[
    'confirm business model and target customers',
    'choose primary conversion channel',
    'confirm current contact details and opening hours',
    'confirm current legal details',
    'complete final visual quality review',
    'customer approve final preview',
    'production approval remains separate'
  ],
  source_readiness:readinessResult.snapshot.status,
  rights_readiness:'READY_WITH_WARNINGS',
  provider_plan:{route:'existing-ferrari-web-factory',providers:['project-source-intake','web-factory']},
  cost_preflight:{approved_ceiling_eur:0,actual_variable_cost_eur:0,paid_overflow:false},
  quality_contract:{schema:'aurentara.premium-website-standard.v1',browser_qa_required:true,human_outcome_required:true,unconfirmed_critical_facts_publishable:false},
  acceptance_criteria:['source_provenance','critical_fact_resolution','rights_enforcement','premium_standard','human_outcome','customer_review','delivery_gate'],
  customer_review_required:true,
  production_approval_required:true,
  delivery_definition:{kind:'private_premium_customer_review_candidate',public:false,production:false},
  scope_confirmation_status:'HUMAN_CONFIRMED',
  current_status:'CUSTOMER_INPUT_CLOSURE'
});
assert.equal(contractResult.ok,true);
assert.equal(contractResult.readiness.ready_for_build,false);
assert.equal(contractResult.readiness.blockers.includes('REQUIRED_CUSTOMER_INPUTS_MISSING'),true);

const dimensionChecks={
  business_understanding:['PASS','PASS','PASS','PASS','NOT_VERIFIED','NOT_VERIFIED'],
  brand_foundation_fit:['PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  content_copy:['PASS','PASS','PASS','PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  information_architecture_ux:['PASS','PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  visual_design_art_direction:['PASS','PASS','PASS','NOT_VERIFIED','NOT_VERIFIED'],
  conversion:['PASS','PASS','PASS','PASS','NOT_VERIFIED','NOT_VERIFIED','NOT_VERIFIED'],
  trust:['PASS','PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  seo_discoverability:['PASS','PASS','PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  performance:['PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  accessibility:['PASS','PASS','PASS','PASS','PASS','PASS','PASS','PASS','NOT_VERIFIED','NOT_VERIFIED'],
  technical_quality_security:['PASS','PASS','PASS','PASS','PASS','PASS','PASS','PASS'],
  mobile_responsive:['PASS','PASS','PASS','PASS','PASS','NOT_VERIFIED'],
  legal_rights_readiness:['PASS','PASS','PASS','PASS','NOT_VERIFIED','NOT_VERIFIED','NOT_VERIFIED'],
  launch_handover_readiness:['PASS','PASS','PASS','PASS','NOT_VERIFIED','NOT_VERIFIED','NOT_VERIFIED']
};
const dimensionScores=Object.fromEntries(Object.entries(dimensionChecks).map(([id,checks])=>{
  const pass=checks.filter((x)=>x==='PASS').length;
  return [id,{score:Math.round((pass/checks.length)*10000)/100,verification:checks.every((x)=>x==='PASS')?'PASS':'NOT_VERIFIED',evidence_refs:['gelato-ferrari-realistic-input-v1']}];
}));

const premiumInput=createPremiumInputReadiness({
  values:{
    business_identity:'Gelato Donatello',
    business_model:null,
    products_services:['Eis','Eistorten','Eisvitrinen-Vermietung'],
    target_customers:null,
    primary_conversion:'Private confirmed-content review; external channel not yet selected'
  }
});
assert.equal(premiumInput.status,'BLOCKED');

const hardPass=[
  'fabricated_trust_claim','fabricated_review','fabricated_qualification','fabricated_certification',
  'fabricated_customer_project_evidence','fake_location','critical_source_conflict_in_rendered_content',
  'blocked_or_unknown_rights_on_published_asset','critical_accessibility_failure','broken_responsive_primary_journey',
  'secret_leakage','pii_analytics_leakage','critical_security_failure','tracking_outside_required_consent_policy',
  'incorrect_production_indexing_state','project_isolation_violation','production_action_without_existing_operator_approval'
];
const hardNotVerified=[
  'broken_primary_conversion','critical_canonical_redirect_route_failure','missing_required_public_legal_input',
  'missing_final_human_approval','missing_required_customer_approval'
];
const hardGates=Object.fromEntries([...hardPass.map((x)=>[x,'PASS']),...hardNotVerified.map((x)=>[x,'NOT_VERIFIED'])]);

const premium=evaluatePremiumWebsiteStandard({
  project_ref:{customer_id:'gelato-donatello',project_id:'gelato-donatello-website-v1',scope_key:scopeKey},
  industry:'gelateria',
  quality_dimensions:dimensionScores,
  hard_gates:hardGates,
  input_readiness:premiumInput,
  brand_readiness:createPremiumBrandReadiness({path:'USE_EXISTING_BRAND'}),
  assets:actualAssets.map((x)=>({
    asset_id:x.asset_id,usage_role:x.usage_role,central:x.usage_role==='LOGO',
    rights_status:'OWNED_CONFIRMED',publishable:true,quality_state:'NOT_APPROVED'
  })),
  legal_readiness:{
    state:'LEGAL_REVIEW_REQUIRED',
    missing_required_inputs:['current legal entity','responsible person','current contact details','privacy processing inventory','cookie/tracking requirements'],
    technical_readiness:'NOT_VERIFIED'
  },
  human_review:{
    state:'CHANGES_REQUIRED',
    areas:{
      business_relevance:'PASS',brand_fit:'NOT_VERIFIED',visual_quality:'NOT_VERIFIED',individuality:'PASS',copy:'PASS',trust:'PASS',
      conversion:'NOT_VERIFIED',mobile:'PASS',polish:'NOT_VERIFIED',consistency:'PASS',customer_relevance:'NOT_VERIFIED',template_ai_genericness:'PASS'
    },
    evidence:{desktop:'PASS',tablet:'PASS',mobile:'PASS',small_mobile:'PASS',primary_conversion_flow:'NOT_VERIFIED',representative_pages:'PASS'}
  },
  preview_qa:'PASS',
  responsive_qa:'PASS',
  customer_review:{required_review_content_present:true},
  launch_governance:'NOT_VERIFIED',
  evaluated_at:at(11)
});
assert.equal(premium.weighted_score,76.07);
assert.equal(premium.delivery_readiness.build_ready,false);
assert.equal(premium.delivery_readiness.customer_review_ready,false);
assert.equal(premium.delivery_readiness.premium_delivery_ready,false);
assert.equal(premium.hard_failures.length,0);
assert.ok(premium.not_verified_hard_gates.length>0);

const humanOutcome=evaluateHumanOutcomeAcceptance({
  technical_implementation:true,technical_integration:true,final_dom_presence:true,human_visibility:true,human_reachability:true,
  primary_interaction:true,expected_result:true,desktop_acceptance:true,mobile_acceptance:true,composition_regression:true,safety_regression:true
});
assert.equal(humanOutcome.human_outcome_accepted,true);

const project={
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:scopeKey,
  name:'Gelato Donatello',
  capabilities:[{id:'web_presence',required:true}],
  missions:[{mission_id:'gelato-ferrari-realistic-input-v1'}],
  deliveries:[],
  website_standard:'aurentara.premium-website-standard.v1',
  premium_website_standard_required:true,
  delivery_contract:contractResult.contract
};

let review=createCustomerReviewLifecycleV1(project,{actor:'operator:synthetic-dogfood',at:at(12)}).state;
let preview=registerPrivatePreviewV1(review,{
  preview_id:'gelato-ferrari-preview-v1',
  preview_url:'http://127.0.0.1:4183/ferrari-preview-v1.html',
  source_revision:'gelato-ferrari-preview-rev-1',
  private_access_verified:true,
  qa_passed:true,
  human_outcome_acceptance:humanOutcome
},{actor:'operator:synthetic-dogfood',at:at(13)});
assert.equal(preview.ok,true);
review=preview.state;

const feedback=submitCustomerFeedbackV1(review,{
  feedback_id:'gelato-synthetic-feedback-001',
  type:'CONTENT_CORRECTION',
  summary:'SYNTHETIC_DOGFOOD: Preise und Vermietung klarer als getrennte Bereiche führen.',
  submitted_by:'customer:synthetic-dogfood'
},{actor:'customer:synthetic-dogfood',at:at(14)});
assert.equal(feedback.ok,true);
review=feedback.state;

const revision=recordCustomerRevisionV1(review,{
  revision_id:'gelato-synthetic-revision-001',
  source_revision:'gelato-ferrari-preview-rev-2',
  summary:'SYNTHETIC_DOGFOOD_REVISION: Preis- und Vermietungsbereiche getrennt bestätigt.'
},{actor:'operator:synthetic-dogfood',at:at(15)});
assert.equal(revision.ok,true);
review=revision.state;

preview=registerPrivatePreviewV1(review,{
  preview_id:'gelato-ferrari-preview-v2',
  preview_url:'http://127.0.0.1:4183/ferrari-preview-v1.html',
  source_revision:'gelato-ferrari-preview-rev-2',
  private_access_verified:true,
  qa_passed:true,
  human_outcome_acceptance:humanOutcome
},{actor:'operator:synthetic-dogfood',at:at(16)});
assert.equal(preview.ok,true);
review=preview.state;

const approval=approveCustomerReviewV1(review,{
  actor_id:'customer:synthetic-dogfood',
  approval_id:'gelato-synthetic-customer-delivery-approval-v1'
},{actor:'customer:synthetic-dogfood',at:at(17)});
assert.equal(approval.ok,true);
review=approval.state;
const reviewEvidence=evaluateCustomerReviewLifecycleV1(review);
assert.equal(reviewEvidence.ready_for_delivery,true);
assert.equal(reviewEvidence.normal_revision_count,1);

const delivery=evaluateProjectDelivery(project,{
  capabilities:[{id:'web_presence',completed:true}],
  qa_passed:true,
  scope_verified:true,
  costs_reconciled:true,
  premium_standard:premium,
  customer_review:review,
  production_deploy:false
});
assert.equal(delivery.ready_for_structural_delivery,false);
assert.equal(delivery.blockers.some((x)=>x.code==='PREMIUM_WEBSITE_STANDARD_DELIVERY_NOT_READY'),true);

const unresolvedCritical=state.facts.filter((f)=>f.critical&&f.verification_status==='SOURCE_CONFLICT');
assert.equal(unresolvedCritical.length,0);

const evidence={
  status:'BLOCKED_BY_CUSTOMER_AND_HUMAN_INPUT',
  source_readiness:readinessResult.snapshot.status,
  fact_readiness:{
    confirmed_fact_count:state.facts.filter((f)=>['OPERATOR_CONFIRMED','CUSTOMER_CONFIRMED','VERIFIED'].includes(f.verification_status)).length,
    unresolved_critical_conflicts:0,
    unverified_critical_fact_count:premiumDiscovery.projection.unverified_critical_fact_count,
    rejected_phone_candidates:2,
    flavor_conflict_resolution:'OPERATOR_CONFIRMED_40_RETAINED_OLD_OVER_45_REJECTED'
  },
  rights_readiness:{owned_confirmed_assets:5,publishable_assets:5,status:'READY'},
  content_readiness:readinessResult.snapshot.status,
  visual_readiness:{rights:'READY',asset_quality:'HUMAN_REVIEW_REQUIRED',approved_asset_metadata_count:5,asset_bytes_in_repo_preview:0},
  delivery_contract:{ready_for_build:contractResult.readiness.ready_for_build,missing_inputs:contractResult.contract.missing_inputs},
  premium:{weighted_score:premium.weighted_score,state:premium.delivery_readiness.state,premium_delivery_ready:false},
  human_outcome:{accepted:true,verdict:humanOutcome.verdict},
  customer_review:{status:reviewEvidence.status,synthetic_dogfood:true,normal_revision_count:1,ready_for_delivery:true},
  delivery_gate:{ready:false,blockers:delivery.blockers.map((x)=>x.code)},
  efficiency:{
    measurement_boundary:'AFTER_INITIAL_RUN_SUBMISSION',
    operator_touch_count:1,
    active_operator_minutes:0,
    initial_instruction_composition_time:'OUT_OF_SCOPE_UNKNOWN',
    external_waiting_time_seconds:0,
    waiting_state:'CUSTOMER_INPUT_WAIT_NOT_STARTED_DURING_AUTOMATED_RUN',
    repair_count:1,
    retry_count:0,
    revision_count:1,
    actual_human_approval_count:0,
    synthetic_customer_approval_count:1,
    customer_input_requests:1,
    missing_input_events:missingInputs.length,
    scope_reassessment_events:0,
    provider_runs:0,
    actual_variable_cost_eur:0
  },
  safety:{production:false,public:false,dns_changed:false,billing:false,new_providers:0,paid_overflow:false,real_customer_data:false}
};

console.log('PROJECT FERRARI Gelato realistic customer input dogfood V1: CONTROLLED BLOCK');
console.log(JSON.stringify(evidence,null,2));
