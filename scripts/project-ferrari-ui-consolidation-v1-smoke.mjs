import assert from 'node:assert/strict';
import {
  normalizePremiumProjectLifecycle,
  derivePremiumNextBestAction,
  injectPremiumMasterdashboard,
  premiumMasterdashboardManifest
} from '../src/operator-premium-masterdashboard-v1.js';

const project={
  name:'Gelato Donatello',
  scope_key:'gelato-donatello:gelato-donatello-website-v1',
  environment:'staging',
  state:'READY',
  open_approval_count:1,
  blocker_count:0,
  project_preview_access:{available:true}
};

const knowledgeContext={
  source_count:7,
  fact_count:30,
  knowledge_attention_count:12,
  conflict_count:2,
  open_input_count:1,
  knowledge_review:{
    status:'IN_REVIEW',
    catch_net:{clear:false,unresolved_count:12,counts:{source_conflicts:2}}
  },
  preview:{available:true}
};

const lifecycle=normalizePremiumProjectLifecycle(project,knowledgeContext);
assert.equal(lifecycle.phase,'KNOWLEDGE','knowledge work must outrank downstream approval/preview presentation');
assert.equal(lifecycle.health,'NEEDS_ATTENTION','unresolved project knowledge must make health need attention');
const action=derivePremiumNextBestAction(project,knowledgeContext);
assert.equal(action.code,'REVIEW_KNOWLEDGE');
assert.equal(action.label,'12 Angaben prüfen');
assert.equal(action.target,'knowledge');

const approvalContext={
  source_count:7,
  fact_count:30,
  knowledge_attention_count:0,
  conflict_count:0,
  open_input_count:0,
  open_approval_count:1,
  knowledge_review:{status:'APPROVED',catch_net:{clear:true,unresolved_count:0}},
  preview:{available:true}
};
const approvalLife=normalizePremiumProjectLifecycle(project,approvalContext);
assert.equal(approvalLife.phase,'APPROVAL');
assert.equal(derivePremiumNextBestAction(project,approvalContext).target,'approvals');

const html=injectPremiumMasterdashboard('<!doctype html><html><body><main><section id="projects"></section></main></body></html>');
for(const marker of [
  'pm-knowledge-slot',
  'data-pm-panel="sources"',
  'data-pm-panel="knowledge"',
  'pm-legacy{display:none!important}',
  'pm-preview-visual',
  'pm-projects-active',
  'data-pm-attention-now',
  'Keine offenen projektbezogenen Prüfungen.'
]) assert.ok(html.includes(marker),marker);

const manifest=premiumMasterdashboardManifest();
assert.equal(manifest.duplicate_runtime_truth,false);
assert.equal(manifest.production_deploy,false);
assert.equal(manifest.external_writes,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-ui-consolidation-v1',
  single_lifecycle_truth:'PASS',
  knowledge_attention_priority:'PASS',
  strict_tab_surfaces:'PASS',
  legacy_surface_hidden:'PASS',
  preview_visual_surface:'PASS',
  production_deploy:false,
  external_writes:false
},null,2));
