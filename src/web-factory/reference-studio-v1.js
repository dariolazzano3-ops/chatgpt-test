import { createHash } from 'node:crypto';

export const REFERENCE_STATES = Object.freeze([
  'DRAFT','SKETCH','WIREFRAME','CANDIDATE','CHANGES_REQUESTED','APPROVED','SUPERSEDED'
]);
export const REFERENCE_VIEWPORTS = Object.freeze([
  '1440_DESKTOP','1024_TABLET','390_MOBILE','320_SMALL_MOBILE'
]);

const states = new Set(REFERENCE_STATES);
const viewports = new Set(REFERENCE_VIEWPORTS);
const arr = (v) => Array.isArray(v) ? v : [];
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? structuredClone(v) : {};
const text = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
function sha(v) {
  return createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
}
function at(options = {}) {
  return text(options.now || new Date().toISOString(), 80);
}
function viewport(v) {
  const key = text(v || '1440_DESKTOP', 40).toUpperCase();
  return viewports.has(key) ? key : '1440_DESKTOP';
}
function scope(input = {}) {
  return text(
    input.project_scope ||
    input.scope_key ||
    input.project_id ||
    input.project_knowledge?.project_scope ||
    input.project_knowledge?.scope_key,
    320
  );
}
function intent(v, fallback) {
  const x = obj(v);
  return {
    purpose: text(x.purpose || fallback, 500),
    constraints: arr(x.constraints).map((i) => text(i, 300)).filter(Boolean).slice(0, 40),
    preferences: arr(x.preferences).map((i) => text(i, 300)).filter(Boolean).slice(0, 40),
    notes: text(x.notes, 1000) || null
  };
}
function facts(knowledge = {}) {
  const source = obj(knowledge);
  const list = Array.isArray(source.facts) ? source.facts : Array.isArray(source.confirmed_facts) ? source.confirmed_facts : [];
  return list.filter((f) => f && typeof f === 'object').map((f) => ({
    key: text(f.key || f.id || f.field, 180),
    value: f.value ?? f.content ?? null,
    status: text(f.status || f.state || 'CONFIRMED', 80),
    source: text(f.source || f.source_id || 'project-knowledge', 300)
  })).filter((f) => f.key).slice(0, 200);
}
function provenance(knowledge = {}, input = {}) {
  const explicit = arr(input.source_provenance).filter((x) => x && typeof x === 'object');
  if (explicit.length) return explicit.map((x) => ({
    source_id: text(x.source_id || x.id, 200),
    source_type: text(x.source_type || x.type || 'project-knowledge', 120),
    revision: text(x.revision || x.version, 120) || null,
    hash: text(x.hash, 128) || null
  })).slice(0, 100);
  const source = obj(knowledge);
  return [{
    source_id: text(source.knowledge_id || source.project_scope || source.scope_key || 'project-knowledge', 200),
    source_type: 'project-knowledge',
    revision: text(input.knowledge_revision || source.revision || source.version, 120) || null,
    hash: sha(source)
  }];
}
function bump(version = '1.0.0', kind = 'patch') {
  const match = text(version, 40).match(/^(\d+)\.(\d+)\.(\d+)$/);
  let [major, minor, patch] = match ? match.slice(1).map(Number) : [1,0,0];
  if (kind === 'major') { major += 1; minor = 0; patch = 0; }
  else if (kind === 'minor') { minor += 1; patch = 0; }
  else patch += 1;
  return [major, minor, patch].join('.');
}
function fail(status, extra = {}) {
  return { ok:false, status, ...extra, variable_cost_eur:0, production_deploy:false };
}
function pass(status, reference, extra = {}) {
  return { ok:true, status, reference, ...extra, variable_cost_eur:0, production_deploy:false };
}

export function createReferenceBrief(input = {}, options = {}) {
  const projectScope = scope(input);
  if (!projectScope) return fail('PROJECT_SCOPE_REQUIRED');
  const createdAt = at(options);
  const projectFacts = facts(input.project_knowledge);
  const reference = {
    schema:'riosystems.reference-studio.v1',
    reference_id:text(input.reference_id || (projectScope + '-' + viewport(input.viewport).toLowerCase() + '-reference'),320),
    version:text(input.version || '1.0.0',40),
    state:'DRAFT',
    hash:null,
    hash_algorithm:'sha256',
    hash_locked:false,
    project_scope:projectScope,
    viewport:viewport(input.viewport),
    source_provenance:provenance(input.project_knowledge,input),
    knowledge_revision:text(input.knowledge_revision || input.project_knowledge?.revision || input.project_knowledge?.version,120) || null,
    created_at:createdAt,
    updated_at:createdAt,
    approved_at:null,
    approved_by:null,
    design_intent:intent(input.design_intent,'Translate approved project knowledge into a premium website reference.'),
    asset_intent:intent(input.asset_intent,'Use only owned, licensed, generated, or explicitly approved assets.'),
    motion_intent:intent(input.motion_intent,'Use motion only when it improves hierarchy or comprehension.'),
    project_knowledge_snapshot_hash:sha(obj(input.project_knowledge)),
    iteration:0,
    parent_version:null,
    change_request:null,
    artifact:null,
    human_approval_required:true,
    automatic_approval_allowed:false,
    visual_source_of_truth:false,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    paid_activation:false
  };
  reference.reference_brief = {
    schema:'riosystems.reference-brief.v1',
    business_name:text(input.project_knowledge?.business_name || input.business_name,240) || null,
    industry:text(input.project_knowledge?.industry || input.industry,180) || null,
    primary_goal:text(input.project_knowledge?.primary_goal || input.primary_goal,500) || null,
    target_audience:text(input.project_knowledge?.target_audience || input.target_audience,500) || null,
    required_sections:arr(input.required_sections || input.project_knowledge?.required_sections).map((i)=>text(i,180)).filter(Boolean).slice(0,40),
    required_facts:projectFacts.filter((f)=>['CONFIRMED','APPROVED','DERIVED_SAFE'].includes(f.status)),
    prohibited_facts:projectFacts.filter((f)=>['PROHIBITED','REJECTED'].includes(f.status)),
    design_intent:structuredClone(reference.design_intent),
    asset_intent:structuredClone(reference.asset_intent),
    motion_intent:structuredClone(reference.motion_intent)
  };
  return pass('REFERENCE_BRIEF_READY', reference);
}

function transition(input, allowed, next, artifact, options = {}) {
  const reference = structuredClone(input || {});
  if (!states.has(reference.state)) return fail('REFERENCE_STATE_INVALID');
  if (reference.hash_locked || reference.state === 'APPROVED') return fail('APPROVED_REFERENCE_IMMUTABLE');
  if (!allowed.includes(reference.state)) return fail('REFERENCE_TRANSITION_BLOCKED',{current_state:reference.state,expected_states:allowed});
  reference.state = next;
  reference.updated_at = at(options);
  reference.artifact = artifact;
  reference.visual_source_of_truth = false;
  return reference;
}

export function createSketchGenerationContract(reference, input = {}, options = {}) {
  const next = transition(reference,['DRAFT','CHANGES_REQUESTED'],'SKETCH',{
    schema:'riosystems.reference-sketch-contract.v1',
    purpose:text(input.purpose || 'Low-cost structural exploration before detailed reference generation.',500),
    required_sections:arr(input.required_sections || reference?.reference_brief?.required_sections).map((i)=>text(i,180)).filter(Boolean).slice(0,40),
    layout_hypotheses:arr(input.layout_hypotheses).map((i)=>text(i,500)).filter(Boolean).slice(0,20),
    fidelity:'LOW',
    text_detail:'LABELS_AND_HIERARCHY_ONLY',
    asset_detail:'PLACEHOLDER_ONLY_UNLESS_APPROVED',
    external_provider_execution:false
  },options);
  return next?.ok === false ? next : pass('SKETCH_CONTRACT_READY',next);
}

export function createWireframeContract(reference, input = {}, options = {}) {
  const sections = arr(input.sections || reference?.reference_brief?.required_sections).map((s,index)=>({
    id:text(s?.id || s?.section_id || s || ('section-' + (index+1)),180),
    purpose:text(s?.purpose,500) || null,
    priority:Number.isFinite(Number(s?.priority)) ? Number(s.priority) : index+1
  })).slice(0,60);
  const next = transition(reference,['SKETCH','CHANGES_REQUESTED'],'WIREFRAME',{
    schema:'riosystems.reference-wireframe-contract.v1',
    sections,
    grid:obj(input.grid),
    hierarchy_notes:arr(input.hierarchy_notes).map((i)=>text(i,500)).filter(Boolean).slice(0,40),
    responsive_assumptions:arr(input.responsive_assumptions).map((i)=>text(i,500)).filter(Boolean).slice(0,40),
    fidelity:'MEDIUM_STRUCTURE',
    external_provider_execution:false
  },options);
  return next?.ok === false ? next : pass('WIREFRAME_CONTRACT_READY',next);
}

export function createCandidateReferenceContract(reference, input = {}, options = {}) {
  const next = transition(reference,['SKETCH','WIREFRAME','CHANGES_REQUESTED'],'CANDIDATE',{
    schema:'riosystems.candidate-reference-contract.v1',
    render_asset_ref:text(input.render_asset_ref,1000) || null,
    render_asset_hash:text(input.render_asset_hash,128) || null,
    mime_type:text(input.mime_type || 'image/png',80),
    width:Number.isFinite(Number(input.width)) ? Number(input.width) : null,
    height:Number.isFinite(Number(input.height)) ? Number(input.height) : null,
    design_notes:arr(input.design_notes).map((i)=>text(i,700)).filter(Boolean).slice(0,60),
    unresolved_items:arr(input.unresolved_items).map((i)=>text(i,700)).filter(Boolean).slice(0,60),
    source_provenance:structuredClone(reference?.source_provenance || []),
    generated_from_project_knowledge_hash:text(reference?.project_knowledge_snapshot_hash,128) || null,
    human_approval_required:true,
    automatic_approval_allowed:false,
    external_provider_execution:false
  },options);
  return next?.ok === false ? next : pass('CANDIDATE_REFERENCE_READY_FOR_HUMAN_REVIEW',next);
}

export function requestReferenceChanges(referenceInput = {}, input = {}, options = {}) {
  const reference = structuredClone(referenceInput);
  if (!['SKETCH','WIREFRAME','CANDIDATE'].includes(reference.state)) return fail('REFERENCE_CHANGE_REQUEST_BLOCKED');
  if (reference.hash_locked) return fail('APPROVED_REFERENCE_IMMUTABLE');
  const requestedBy = text(input.requested_by,200);
  const changes = arr(input.changes).map((i)=>text(i,1000)).filter(Boolean).slice(0,100);
  if (!requestedBy || !changes.length) return fail('HUMAN_CHANGE_REQUEST_REQUIRED');
  reference.state='CHANGES_REQUESTED';
  reference.updated_at=at(options);
  reference.change_request={requested_by:requestedBy,requested_at:reference.updated_at,changes};
  reference.visual_source_of_truth=false;
  return pass('REFERENCE_CHANGES_REQUESTED',reference);
}

export function iterateReference(referenceInput = {}, input = {}, options = {}) {
  const reference = structuredClone(referenceInput);
  if (!['CHANGES_REQUESTED','SKETCH','WIREFRAME','CANDIDATE'].includes(reference.state)) return fail('REFERENCE_ITERATION_BLOCKED');
  if (reference.hash_locked || reference.state === 'APPROVED') return fail('APPROVED_REFERENCE_IMMUTABLE');
  const previous = reference.version;
  reference.version=bump(previous,text(input.version_bump || 'patch',20));
  reference.parent_version=previous;
  reference.iteration=Number(reference.iteration || 0)+1;
  reference.state='CANDIDATE';
  reference.updated_at=at(options);
  reference.hash=null;
  reference.hash_locked=false;
  reference.approved_at=null;
  reference.approved_by=null;
  reference.change_request=null;
  reference.visual_source_of_truth=false;
  reference.artifact={
    ...(reference.artifact || {}),
    schema:'riosystems.candidate-reference-contract.v1',
    revision_notes:arr(input.revision_notes || input.changes).map((i)=>text(i,1000)).filter(Boolean).slice(0,100),
    render_asset_ref:text(input.render_asset_ref || reference.artifact?.render_asset_ref,1000) || null,
    render_asset_hash:text(input.render_asset_hash || reference.artifact?.render_asset_hash,128) || null
  };
  return pass('REFERENCE_ITERATION_READY_FOR_HUMAN_REVIEW',reference);
}

function lockPayload(reference = {}) {
  return {
    schema:'riosystems.reference-studio.v1',
    reference_id:reference.reference_id,
    version:reference.version,
    state:'APPROVED',
    project_scope:reference.project_scope,
    viewport:reference.viewport,
    source_provenance:reference.source_provenance,
    knowledge_revision:reference.knowledge_revision,
    design_intent:reference.design_intent,
    asset_intent:reference.asset_intent,
    motion_intent:reference.motion_intent,
    project_knowledge_snapshot_hash:reference.project_knowledge_snapshot_hash,
    reference_brief:reference.reference_brief,
    artifact:reference.artifact,
    iteration:reference.iteration,
    parent_version:reference.parent_version
  };
}

export function approveReference(referenceInput = {}, input = {}, options = {}) {
  const reference = structuredClone(referenceInput);
  if (reference.state !== 'CANDIDATE') return fail('CANDIDATE_REFERENCE_REQUIRED');
  const approvedBy = text(input.approved_by,200);
  const kind = text(input.approval_kind || 'HUMAN',40).toUpperCase();
  if (!approvedBy || kind !== 'HUMAN' || /^(system|agent|automation|ai)$/i.test(approvedBy)) return fail('EXPLICIT_HUMAN_APPROVAL_REQUIRED');
  if (arr(reference.artifact?.unresolved_items).length) return fail('UNRESOLVED_REFERENCE_ITEMS_BLOCK_APPROVAL',{unresolved_items:reference.artifact.unresolved_items});
  reference.state='APPROVED';
  reference.updated_at=at(options);
  reference.approved_at=reference.updated_at;
  reference.approved_by=approvedBy;
  reference.hash=sha(lockPayload(reference));
  reference.hash_locked=true;
  reference.visual_source_of_truth=true;
  reference.automatic_approval_allowed=false;
  return pass('APPROVED_REFERENCE_HASH_LOCKED',reference);
}

export function verifyApprovedReferenceLock(referenceInput = {}) {
  const reference = structuredClone(referenceInput);
  const required=['reference_id','version','hash','project_scope','viewport','source_provenance','created_at','approved_at','approved_by','design_intent','asset_intent','motion_intent'];
  const missing=required.filter((k)=>reference[k] == null || reference[k] === '' || (Array.isArray(reference[k]) && !reference[k].length));
  const expected=reference.state === 'APPROVED' ? sha(lockPayload(reference)) : null;
  const hashMatches=Boolean(expected && expected === reference.hash);
  const ok=reference.state === 'APPROVED' && reference.hash_locked === true && reference.visual_source_of_truth === true && !missing.length && hashMatches;
  return {ok,status:ok?'APPROVED_REFERENCE_LOCK_VALID':'APPROVED_REFERENCE_LOCK_INVALID',missing_fields:missing,hash_matches:hashMatches,expected_hash:expected,actual_hash:reference.hash || null,variable_cost_eur:0,production_deploy:false};
}

export function supersedeApprovedReference(currentInput = {}, replacementInput = {}, options = {}) {
  const current=structuredClone(currentInput);
  const replacement=structuredClone(replacementInput);
  if (!verifyApprovedReferenceLock(current).ok || !verifyApprovedReferenceLock(replacement).ok) return fail('VALID_APPROVED_REFERENCES_REQUIRED');
  if (current.project_scope !== replacement.project_scope || current.viewport !== replacement.viewport) return fail('REFERENCE_SCOPE_OR_VIEWPORT_MISMATCH');
  current.state='SUPERSEDED';
  current.visual_source_of_truth=false;
  current.updated_at=at(options);
  current.superseded_by={reference_id:replacement.reference_id,version:replacement.version,hash:replacement.hash,at:current.updated_at};
  return {ok:true,status:'APPROVED_REFERENCE_SUPERSEDED',reference:current,replacement,variable_cost_eur:0,production_deploy:false};
}

export function createReferenceRegistry(input = {}) {
  const references=arr(input.references).map((r)=>structuredClone(r));
  const approved=references.filter((r)=>r.state === 'APPROVED' && verifyApprovedReferenceLock(r).ok);
  const active={};
  for (const r of approved.sort((a,b)=>String(a.approved_at).localeCompare(String(b.approved_at)))) active[r.viewport]={reference_id:r.reference_id,version:r.version,hash:r.hash};
  return {schema:'riosystems.reference-registry.v1',project_scope:text(input.project_scope || references[0]?.project_scope,320) || null,references,active_approved_by_viewport:active,approved_reference_count:approved.length,automatic_approval_allowed:false,production_deploy:false};
}

export function referenceStudioDashboardProjection(input = {}) {
  const references=arr(input.references || input.registry?.references);
  const current=structuredClone(input.current_reference || references.at(-1) || null);
  const state=current?.state || 'NONE';
  const actions={
    create_sketch:state === 'DRAFT' || state === 'CHANGES_REQUESTED',
    create_wireframe:state === 'SKETCH' || state === 'CHANGES_REQUESTED',
    create_candidate:['SKETCH','WIREFRAME','CHANGES_REQUESTED'].includes(state),
    request_changes:['SKETCH','WIREFRAME','CANDIDATE'].includes(state),
    approve_reference:state === 'CANDIDATE',
    verify_lock:state === 'APPROVED'
  };
  const next=actions.create_sketch?'SKIZZE_ERSTELLEN':actions.create_wireframe?'WIREFRAME_ERSTELLEN':actions.create_candidate?'REFERENCE_ERSTELLEN':actions.approve_reference?'REFERENCE_FREIGEBEN':actions.verify_lock?'WEBSITE_BAUEN':'PROJEKTWISSEN_PRUEFEN';
  return {schema:'riosystems.reference-studio-dashboard-projection.v1',project_scope:current?.project_scope || input.registry?.project_scope || null,viewport:current?.viewport || null,reference_status:state,reference_id:current?.reference_id || null,reference_version:current?.version || null,reference_hash:current?.hash || null,human_approval_required:state === 'CANDIDATE',visual_source_of_truth:current?.visual_source_of_truth === true,allowed_actions:actions,next_best_action:next,technical_details_available:true,production_deploy:false,public_launch:false};
}

export function executeReferenceStudioTask(task = {}, options = {}) {
  const op=text(task.operation || task.action,80).toLowerCase();
  if (op === 'brief') return createReferenceBrief(task,options);
  if (op === 'sketch') return createSketchGenerationContract(task.reference,task,options);
  if (op === 'wireframe') return createWireframeContract(task.reference,task,options);
  if (op === 'candidate') return createCandidateReferenceContract(task.reference,task,options);
  if (op === 'request_changes') return requestReferenceChanges(task.reference,task,options);
  if (op === 'iterate') return iterateReference(task.reference,task,options);
  if (op === 'approve') return approveReference(task.reference,task,options);
  if (op === 'verify') return verifyApprovedReferenceLock(task.reference);
  if (op === 'registry') return {ok:true,status:'REFERENCE_REGISTRY_READY',registry:createReferenceRegistry(task),variable_cost_eur:0,production_deploy:false};
  if (op === 'dashboard') return {ok:true,status:'REFERENCE_DASHBOARD_PROJECTION_READY',dashboard:referenceStudioDashboardProjection(task),variable_cost_eur:0,production_deploy:false};
  return fail('UNSUPPORTED_REFERENCE_STUDIO_OPERATION',{operation:op});
}
