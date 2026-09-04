import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLOBAL_OPERATOR_AI_SECTIONS, sanitizeGlobalOperatorAiUiContext, injectGlobalOperatorAiAccessUi, globalOperatorAiAccessManifest } from '../src/operator-ai/global-access-v1.js';
import { handleOperatorAiMessage } from '../src/operator-ai/service-v1.js';
import { buildOperatorAiLlmContextProjection } from '../src/operator-ai/inference-v1.js';

const MATRIX=['hq','projects','mission','approvals','deliveries','executions','factories','capabilities','providers','costs','quality','health','audit','settings'];
const manifest=globalOperatorAiAccessManifest();
assert.equal(manifest.schema,'aurentara.global-operator-ai-access.v1');
assert.equal(manifest.dashboard_wide_trigger,true);
assert.equal(manifest.nav_rebuild_independent,true);
assert.equal(manifest.sidepanel,true);
assert.equal(manifest.full_workspace_preserved,true);
for(const section of MATRIX) assert.ok(manifest.sections.includes(section),section+' must be globally covered');
assert.ok(manifest.sections.includes('missions'));
assert.ok(manifest.sections.includes('alerts'));
assert.equal(manifest.desktop_drawer,true);
assert.equal(manifest.mobile_drawer,true);
assert.equal(manifest.project_resolution_authoritative,true);
assert.equal(manifest.ui_context_hint_only,true);
assert.equal(manifest.paid_provider_calls_for_acceptance,0);
assert.equal(manifest.production_deploy,false);
assert.equal(manifest.external_writes,false);
assert.equal(manifest.level_4_status,'NOT_ACTIVATED');

const html=injectGlobalOperatorAiAccessUi('<!doctype html><html><body><div class="app"><nav class="nav"></nav><main class="main"></main></div></body></html>');
assert.match(html,/id="global-operator-ai-trigger"/);
assert.match(html,/ASK OPERATOR AI/);
assert.match(html,/id="global-operator-ai-panel"/);
assert.match(html,/REAL AI CONNECTED/);
assert.match(html,/IN OPERATOR AI ÖFFNEN/);
assert.match(html,/global-operator-ai-backdrop/);
assert.match(html,/@media\(max-width:760px\)/);
assert.match(html,/height:min\(92vh,780px\)/);
assert.equal((html.match(/aurentara-global-operator-ai-access-v1-script/g)||[]).length,1);
assert.equal(injectGlobalOperatorAiAccessUi(html),html,'injection must be idempotent');
const globalScriptMatch=html.match(/<script id="aurentara-global-operator-ai-access-v1-script">([\s\S]*?)<\/script>/);
assert.ok(globalScriptMatch,'global access script must be embedded');
assert.doesNotThrow(()=>new Function(globalScriptMatch[1]),'embedded global access script must parse');

const scope='gelato-donatello:website-v1';
const projects=[{scope_key:scope,name:'Gelato Donatello',project_id:'gelato'}];
const safe=sanitizeGlobalOperatorAiUiContext({
  section:'quality',
  selected_project_scope:'attacker:scope',
  selected_project_name:'Fake Project',
  secret:'SHOULD_NOT_SURVIVE',
  token:'SHOULD_NOT_SURVIVE',
  arbitrary_runtime_dump:{password:'x'}
},{selected_project_scope:scope,projects});
assert.equal(safe.section,'quality');
assert.equal(safe.section_label,'Quality');
assert.equal(safe.view_identity,'masterdashboard:quality');
assert.equal(safe.selected_project_scope,scope);
assert.equal(safe.selected_project_name,'Gelato Donatello');
assert.equal(safe.conversation_project_scope,scope);
assert.equal(safe.hint_only,true);
assert.equal(safe.authoritative,false);
assert.equal(JSON.stringify(safe).includes('SHOULD_NOT_SURVIVE'),false);
assert.equal(safe.production_authorized,false);
assert.equal(safe.external_writes_authorized,false);
assert.equal(safe.level_4_active,false);

const NOW='2026-09-04T13:30:00.000Z';
const base={
  projects,selected_project_scope:scope,operator_runtime_revision:1,
  canonical_source:{canonical_branch:'factory-control',canonical_head:'87c49a3ba7affc1a45a4e1e330ef964751446274',verified_at:NOW},
  project_state:{...projects[0],state:'READY',environment:'staging'},
  project_context:{scope_key:scope,status:'READY'},
  mission_state:{status:'READY'},quality_state:{status:'SUPPORTED',weighted_score:80,hard_failures:[]},
  provider_state:{items:[]},cost_state:{route:'BALANCED',approval_required:false,cost_ceiling:0},
  approval_state:{operator_production_approval:false,external_write_approved:false},
  release_state:{status:'STAGING_ONLY',production_approved:false},delivery_state:{status:'READY'},
  recent_evidence:[],unknowns:[],conflicts:[],ui_context_hint:safe
};
const deterministic=handleOperatorAiMessage({message:'Was ist hier der größte Qualitätshebel?',conversation_project_scope:scope},base,{now:NOW,safe_internal_execution_active:false});
assert.equal(deterministic.ok,true);
assert.equal(deterministic.project_resolution.scope_key,scope);
assert.equal(deterministic.context_snapshot.ui_context_hint.section,'quality');
assert.equal(deterministic.execution.started,false);
assert.equal(deterministic.execution.safe_internal_execution_status,'NOT_ACTIVATED');
assert.equal(deterministic.production_deploy,false);
assert.equal(deterministic.external_writes,false);
assert.equal(deterministic.paid_provider_calls,0);

const projection=buildOperatorAiLlmContextProjection({message:'Was ist hier der größte Qualitätshebel?',deterministic});
assert.equal(projection.ok,true);
assert.equal(projection.projection.ui_context_hint.section,'quality');
assert.equal(projection.projection.ui_context_hint.selected_project_scope,scope);
assert.equal(projection.projection.ui_context_hint.selected_project_name,'Gelato Donatello');
assert.equal(projection.projection.ui_context_hint.authoritative,false);
assert.equal(projection.projection.hard_constraints.production_authorized,false);
assert.equal(projection.projection.hard_constraints.external_writes_authorized,false);
assert.equal(projection.projection.hard_constraints.level_4_active,false);

const staleHint={...safe,selected_project_scope:'other:scope',selected_project_name:'Other'};
const staleDet=handleOperatorAiMessage({message:'Wie steht Gelato Donatello?',conversation_project_scope:scope},{...base,ui_context_hint:staleHint},{now:NOW});
assert.equal(staleDet.ok,true);
const staleProjection=buildOperatorAiLlmContextProjection({message:'Wie steht Gelato Donatello?',deterministic:staleDet});
assert.equal(staleProjection.projection.ui_context_hint.selected_project_scope,null);
assert.equal(staleProjection.projection.ui_context_hint.selected_project_name,null);
assert.equal(staleProjection.projection.ui_context_hint.scope_mismatch_ignored,true);

const mismatch=handleOperatorAiMessage({message:'Wie steht Gelato Donatello?',conversation_project_scope:scope},{
  ...base,
  project_context:{scope_key:'other:scope',status:'READY'}
},{now:NOW});
assert.equal(mismatch.ok,false);
assert.equal(mismatch.error,'OPERATOR_AI_PROJECT_CONTEXT_MISMATCH');
assert.equal(mismatch.execution_started,false);

const dashboardSource=fs.readFileSync(new URL('../src/operator-ai/dashboard-v1.js',import.meta.url),'utf8');
assert.equal(dashboardSource.includes("nav.appendChild(btn)"),false,'fragile post-hoc Operator AI nav injection must be removed');
assert.match(dashboardSource,/injectGlobalOperatorAiAccessUi\(injectOperatorAiUi\(source\)\)/);
assert.match(dashboardSource,/sanitizeGlobalOperatorAiUiContext\(body\.ui_context/);

console.log(JSON.stringify({
  ok:true,
  schema:'aurentara.global-operator-ai-access-v1-smoke.result',
  matrix_scenarios:24,
  dashboard_sections:MATRIX,
  navigation_rebuild_independent:'PASS',
  gelato_context_hint:'PASS',
  project_isolation:'PASS',
  full_workspace_preserved:'PASS',
  desktop:'CONTRACT_PASS',
  mobile:'CONTRACT_PASS',
  production:'LOCKED',
  external_writes:0,
  paid_provider_calls:0,
  level_4:'NOT_ACTIVATED'
},null,2));
