import assert from 'node:assert/strict';
import {
  J11_CONTROL_FIELDS,
  J11_CONTROL_ACTIONS,
  J11_ACTION_STATES,
  deriveJ11ActionMatrix,
  createJ11WebFactoryControlPlane,
  j11WebFactoryControlPlaneManifest
} from '../src/web-factory/dashboard-control-plane-v1.js';
import {
  injectJ11OperatorControlPlane,
  j11OperatorControlPlaneManifest
} from '../src/operator-webfactory-control-plane-v1.js';
import {
  executeWebFactoryTask,
  webFactoryProviderManifest
} from '../src/web-factory/index.js';
import {
  injectPremiumMasterdashboard,
  premiumMasterdashboardManifest
} from '../src/operator-premium-masterdashboard-v1.js';

const manifest=j11WebFactoryControlPlaneManifest();
assert.deepEqual(manifest.fields,[
  'BUILD_PROFILE','JAGUAR_VERSION','KNOWLEDGE_REVISION','REFERENCE','VISUAL_SCORE',
  'BUILD_QA','PERFORMANCE','ACCESSIBILITY','PREVIEW','COST','DELIVERY_STATE'
]);
assert.deepEqual(manifest.actions,[
  'SKETCH','REFERENCE','VARIANT','APPROVAL','BUILD','VISUAL_QA','DELTA_CLOSURE',
  'REBUILD','PREVIEW','CHANGES','DELIVERY'
]);
assert.deepEqual(manifest.action_states,['AVAILABLE','BLOCKED','REVIEW_REQUIRED','NOT_VERIFIED']);
assert.equal(manifest.existing_j9_acceptance_reused,true);
assert.equal(manifest.existing_j10_versioning_reused,true);
assert.equal(manifest.duplicate_runtime_truth,false);
assert.equal(manifest.missing_evidence_stays_not_verified,true);
assert.equal(manifest.automatic_action_execution,false);
assert.equal(manifest.production_deploy,false);

assert.deepEqual(J11_CONTROL_FIELDS,manifest.fields);
assert.deepEqual(J11_CONTROL_ACTIONS,manifest.actions);
assert.deepEqual(J11_ACTION_STATES,manifest.action_states);

const fullInput={
  project:{
    scope_key:'gelato-donatello:gelato-donatello-website-v1',
    name:'Gelato Donatello',
    build_profile:'PREMIUM',
    current_cost_eur:1.2345
  },
  jaguar_version:'J11',
  source:{
    workspace:{
      knowledge_review:{
        status:'APPROVED',
        current_knowledge_revision:'knowledge-r7'
      }
    }
  },
  reference:{
    status:'APPROVED',
    version:'ref-v4',
    approved:true
  },
  visual:{
    status:'PASS',
    score:0.9731,
    evidence:{source:'J8/J7'}
  },
  build:{
    build_id:'build-42',
    build_profile:'PREMIUM',
    accepted:true
  },
  qa:{
    status:'PASS',
    passed:true
  },
  j9:{
    performance:{
      status:'PASS',
      lighthouse:{status:'PASS',performance:0.96}
    },
    accessibility:{
      status:'PASS',
      state:'FULL_ACCEPTED',
      axe:{critical:0,serious:0}
    }
  },
  preview:{
    available:true,
    status:'AVAILABLE',
    preview_url:'/operator/preview/gelato'
  },
  delivery:{
    status:'READY',
    ready:true
  },
  j10:{
    impact:{action:'PARTIAL_REBUILD'}
  },
  change_impact:{action:'PARTIAL_REBUILD'}
};

const full=createJ11WebFactoryControlPlane(fullInput);
assert.equal(full.status,'READY');
assert.equal(full.project_scope,'gelato-donatello:gelato-donatello-website-v1');
assert.equal(full.field_map.BUILD_PROFILE.value,'PREMIUM');
assert.equal(full.field_map.JAGUAR_VERSION.value,'J11');
assert.equal(full.field_map.KNOWLEDGE_REVISION.value,'knowledge-r7');
assert.equal(full.field_map.KNOWLEDGE_REVISION.status,'APPROVED');
assert.equal(full.field_map.REFERENCE.value,'APPROVED · ref-v4');
assert.equal(full.field_map.VISUAL_SCORE.value,0.9731);
assert.equal(full.field_map.BUILD_QA.value,'PASS · build-42');
assert.equal(full.field_map.PERFORMANCE.value,'96 %');
assert.equal(full.field_map.ACCESSIBILITY.value,'FULL_ACCEPTED');
assert.equal(full.field_map.PREVIEW.value,'/operator/preview/gelato');
assert.equal(full.field_map.COST.value,1.2345);
assert.equal(full.field_map.DELIVERY_STATE.value,'READY');
assert.deepEqual(full.not_verified_fields,[]);
assert.equal(full.technical_drawer.enabled,true);
assert.equal(full.technical_drawer.default_open,false);
assert.equal(full.no_fake_pass,true);
assert.equal(full.missing_evidence_stays_not_verified,true);
assert.equal(full.automatic_action_execution,false);
assert.equal(full.production_deploy,false);
assert.equal(full.external_writes,false);

const byAction=Object.fromEntries(full.actions.actions.map(x=>[x.id,x]));
for(const id of ['SKETCH','REFERENCE','VARIANT','APPROVAL','BUILD','VISUAL_QA','DELTA_CLOSURE','REBUILD','PREVIEW','CHANGES','DELIVERY']){
  assert.ok(byAction[id],id);
}
assert.equal(byAction.SKETCH.state,'AVAILABLE');
assert.equal(byAction.REFERENCE.state,'AVAILABLE');
assert.equal(byAction.VARIANT.state,'AVAILABLE');
assert.equal(byAction.APPROVAL.state,'AVAILABLE');
assert.equal(byAction.BUILD.state,'AVAILABLE');
assert.equal(byAction.VISUAL_QA.state,'AVAILABLE');
assert.equal(byAction.DELTA_CLOSURE.state,'AVAILABLE');
assert.equal(byAction.REBUILD.state,'AVAILABLE');
assert.equal(byAction.PREVIEW.state,'AVAILABLE');
assert.equal(byAction.CHANGES.state,'AVAILABLE');
assert.equal(byAction.DELIVERY.state,'AVAILABLE');
for(const row of full.actions.actions){
  assert.equal(row.automatic_execution,false,row.id);
  assert.equal(row.production_deploy,false,row.id);
  assert.equal(row.external_writes,false,row.id);
}

const missing=createJ11WebFactoryControlPlane({
  project:{scope_key:'synthetic:missing',name:'Missing Evidence Project'}
});
assert.equal(missing.status,'READY');
for(const id of ['BUILD_PROFILE','JAGUAR_VERSION','KNOWLEDGE_REVISION','REFERENCE','VISUAL_SCORE','BUILD_QA','PERFORMANCE','ACCESSIBILITY','PREVIEW','COST','DELIVERY_STATE']){
  assert.ok(missing.not_verified_fields.includes(id)||id==='PREVIEW',id);
}
assert.equal(missing.field_map.REFERENCE.status,'NOT_VERIFIED');
assert.equal(missing.field_map.VISUAL_SCORE.status,'NOT_VERIFIED');
assert.equal(missing.field_map.PERFORMANCE.status,'NOT_VERIFIED');
assert.equal(missing.field_map.ACCESSIBILITY.status,'NOT_VERIFIED');
assert.equal(missing.field_map.DELIVERY_STATE.status,'NOT_VERIFIED');
assert.equal(missing.no_fake_pass,true);

const missingActions=Object.fromEntries(missing.actions.actions.map(x=>[x.id,x]));
assert.equal(missingActions.BUILD.state,'BLOCKED');
assert.equal(missingActions.VISUAL_QA.state,'BLOCKED');
assert.equal(missingActions.DELTA_CLOSURE.state,'BLOCKED');
assert.equal(missingActions.REBUILD.state,'NOT_VERIFIED');
assert.equal(missingActions.DELIVERY.state,'BLOCKED');
assert.equal(missingActions.SKETCH.state,'AVAILABLE');
assert.equal(missingActions.CHANGES.state,'AVAILABLE');

const knowledgeReadyNoReference=deriveJ11ActionMatrix({
  project:{scope_key:'synthetic:review'},
  source:{workspace:{knowledge_review:{status:'APPROVED',current_knowledge_revision:'k1'}}}
});
const reviewMap=Object.fromEntries(knowledgeReadyNoReference.actions.map(x=>[x.id,x]));
assert.equal(reviewMap.REFERENCE.state,'REVIEW_REQUIRED');
assert.equal(reviewMap.APPROVAL.state,'REVIEW_REQUIRED');
assert.equal(reviewMap.BUILD.state,'BLOCKED');

const noScope=createJ11WebFactoryControlPlane({});
assert.equal(noScope.status,'BLOCKED');
assert.ok(noScope.blockers.some(x=>x.code==='J11_PROJECT_SCOPE_REQUIRED'));

const adapterManifest=executeWebFactoryTask({
  capability:'web.dashboard.control-plane.v1',
  operation:'manifest'
});
assert.equal(adapterManifest.ok,true);
assert.equal(adapterManifest.status,'J11_CONTROL_PLANE_MANIFEST_READY');
assert.equal(adapterManifest.manifest.schema,'riosystems.j11-webfactory-control-plane-manifest.v1');

const adapterProject=executeWebFactoryTask({
  capability:'web.dashboard.control-plane.v1',
  operation:'project',
  input:fullInput
});
assert.equal(adapterProject.ok,true);
assert.equal(adapterProject.status,'J11_CONTROL_PLANE_READY');
assert.equal(adapterProject.control_plane.field_map.DELIVERY_STATE.value,'READY');

const adapterActions=executeWebFactoryTask({
  capability:'web.dashboard.control-plane.v1',
  operation:'actions',
  input:fullInput
});
assert.equal(adapterActions.ok,true);
assert.equal(adapterActions.actions.schema,'riosystems.j11-webfactory-action-matrix.v1');
assert.ok(adapterActions.actions.available.includes('DELIVERY'));

const provider=webFactoryProviderManifest();
assert.ok(provider.capabilities.includes('web.dashboard.control-plane.v1'));
assert.equal(provider.production_deploy,false);

const uiManifest=j11OperatorControlPlaneManifest();
assert.equal(uiManifest.new_workspace_tab,'WebFactory');
assert.equal(uiManifest.fields.length,11);
assert.equal(uiManifest.actions.length,11);
assert.equal(uiManifest.technical_detail_drawer,true);
assert.equal(uiManifest.automatic_execution,false);
assert.equal(uiManifest.production_deploy,false);

const base='<!doctype html><html><body><section id="projects"></section></body></html>';
const directUi=injectJ11OperatorControlPlane(base);
for(const marker of [
  'aurentara-j11-webfactory-control-plane-script',
  'PROJECT JAGUAR · WEBFACTORY CONTROL PLANE',
  'Build Profile',
  'Knowledge Revision',
  'Visual Score',
  'Delta Closure',
  'Technische Details',
  'NOT_VERIFIED',
  'Keine automatische Ausführung'
]) assert.ok(directUi.includes(marker),marker);
assert.equal(injectJ11OperatorControlPlane(directUi),directUi);

const premium=injectPremiumMasterdashboard(base);
for(const marker of [
  'aurentara-premium-masterdashboard-v1-script',
  'aurentara-j11-webfactory-control-plane-script',
  'WebFactory',
  'PROJECT JAGUAR · WEBFACTORY CONTROL PLANE'
]) assert.ok(premium.includes(marker),marker);
const premiumManifest=premiumMasterdashboardManifest();
assert.equal(premiumManifest.j11_webfactory_control_plane,true);
assert.ok(premiumManifest.project_navigation.includes('WEBFACTORY'));
assert.equal(premiumManifest.duplicate_runtime_truth,false);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j11-dashboard-control-plane',
  field_count:J11_CONTROL_FIELDS.length,
  action_count:J11_CONTROL_ACTIONS.length,
  full_evidence_control_plane:'PASS',
  missing_evidence_not_verified:'PASS',
  no_fake_pass:'PASS',
  action_gating:'PASS',
  j9_reuse:'PASS',
  j10_reuse:'PASS',
  operator_tab_integration:'PASS',
  technical_drawer:'PASS',
  automatic_execution:false,
  automatic_merge:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
