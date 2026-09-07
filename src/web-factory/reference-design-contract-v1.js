import { createHash } from 'node:crypto';
import { verifyApprovedReferenceLock } from './reference-studio-v1.js';
import { validateVisualDesignContract } from './visual-design-contract.js';

const arr = (v) => Array.isArray(v) ? v : [];
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? structuredClone(v) : {};
const text = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const clone = (v) => v == null ? v : structuredClone(v);

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
function digest(v) {
  return createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
}
function fail(status, extra = {}) {
  return { ok:false, status, ...extra, variable_cost_eur:0, production_deploy:false };
}

function normalizeTokenMap(value = {}) {
  const source=obj(value);
  return Object.fromEntries(Object.entries(source).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[
    text(k,120),
    typeof v === 'object' && v !== null ? stable(v) : v
  ]));
}
function normalizeSections(value = []) {
  return arr(value).map((section,index)=>({
    id:text(section?.id || section?.section_id || section || ('section-' + (index+1)),180),
    order:Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
    component_intent:text(section?.component_intent || section?.component || section?.type,240) || null,
    layout:obj(section?.layout),
    image_placement:obj(section?.image_placement),
    background_behavior:obj(section?.background_behavior)
  })).filter(x=>x.id).sort((a,b)=>a.order-b.order || a.id.localeCompare(b.id));
}
function normalizeResponsive(value = []) {
  return arr(value).map((rule,index)=>({
    id:text(rule?.id || rule?.viewport || rule?.breakpoint || ('responsive-' + (index+1)),120),
    viewport:text(rule?.viewport,80) || null,
    breakpoint:Number.isFinite(Number(rule?.breakpoint)) ? Number(rule.breakpoint) : null,
    behavior:stable(obj(rule?.behavior || rule?.rules))
  })).sort((a,b)=>(a.breakpoint ?? Number.MAX_SAFE_INTEGER)-(b.breakpoint ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
}
function normalizeComponents(value = []) {
  return arr(value).map((component,index)=>({
    component:text(component?.component || component?.id || component?.type || ('component-' + (index+1)),180),
    intent:text(component?.intent || component?.purpose,500) || null,
    geometry:stable(obj(component?.geometry)),
    variants:stable(obj(component?.variants)),
    responsive:stable(obj(component?.responsive))
  })).sort((a,b)=>a.component.localeCompare(b.component));
}
function sourceObservation(input = {}) {
  return obj(input.structured_observation || input.observation || input.reference_observation);
}

function extractCore(reference, observation, version) {
  const layout=obj(observation.layout || observation.layout_system);
  const grid=obj(observation.grid || layout.grid);
  const typography=obj(observation.typography || observation.typography_tokens);
  const colors=obj(observation.colors || observation.color_tokens);
  const spacing=obj(observation.spacing || observation.spacing_tokens);
  const border=obj(observation.border || observation.border_tokens);
  const radius=obj(observation.radius || observation.radius_tokens);
  const shadow=obj(observation.shadow || observation.shadow_tokens);
  const hero=obj(observation.hero_geometry || observation.hero);
  const navigation=obj(observation.navigation || observation.navigation_behavior);
  const cta=obj(observation.cta_hierarchy || observation.cta);
  const sections=normalizeSections(observation.sections || observation.section_order);
  const components=normalizeComponents(observation.component_intent || observation.components || observation.component_specs);
  const responsive=normalizeResponsive(observation.responsive_behavior || observation.responsive || observation.responsive_rules);
  const imagePlacement=arr(observation.image_placement).map(x=>stable(obj(x)));
  const backgroundBehavior=arr(observation.background_behavior).map(x=>stable(obj(x)));

  return {
    schema:'riosystems.reference-design-contract.v1',
    contract_version:text(version || '1.0.0',40),
    project_scope:reference.project_scope,
    viewport:reference.viewport,
    source_reference:{
      reference_id:reference.reference_id,
      version:reference.version,
      hash:reference.hash
    },
    extraction:{
      method:text(observation.method || 'structured-reference-observation',120),
      observed:observation.observed === true,
      observation_hash:digest(observation),
      pixel_only_black_box:false
    },
    layout:stable(layout),
    grid:stable(grid),
    spacing:normalizeTokenMap(spacing),
    typography:normalizeTokenMap(typography),
    colors:normalizeTokenMap(colors),
    section_order:sections.map(s=>s.id),
    sections,
    component_intent:components,
    hero_geometry:stable(hero),
    navigation:stable(navigation),
    cta_hierarchy:stable(cta),
    image_placement:imagePlacement,
    background_behavior:backgroundBehavior,
    border:normalizeTokenMap(border),
    radius:normalizeTokenMap(radius),
    shadow:normalizeTokenMap(shadow),
    responsive_behavior:responsive,
    provenance:{
      approved_reference_hash:reference.hash,
      approved_reference_id:reference.reference_id,
      approved_reference_version:reference.version,
      project_knowledge_snapshot_hash:reference.project_knowledge_snapshot_hash || null,
      source_provenance:clone(reference.source_provenance || [])
    },
    deterministic:true,
    diffable:true,
    production_deploy:false
  };
}

function requiredEvidenceIssues(observation = {}) {
  const issues=[];
  if (observation.observed !== true) issues.push({code:'STRUCTURED_OBSERVATION_REQUIRED'});
  const required=[
    ['layout', observation.layout || observation.layout_system],
    ['typography', observation.typography || observation.typography_tokens],
    ['colors', observation.colors || observation.color_tokens],
    ['sections', observation.sections || observation.section_order]
  ];
  for (const [field,value] of required) {
    const present=Array.isArray(value) ? value.length>0 : value && typeof value === 'object' && Object.keys(value).length>0;
    if (!present) issues.push({code:'REFERENCE_DESIGN_EVIDENCE_MISSING',field});
  }
  return issues;
}

function visualContractFromReferenceDesign(contract, observation = {}) {
  const pages=arr(observation.pages).length
    ? arr(observation.pages).map(p=>clone(p))
    : [{id:'home',path:'/',sections:[...contract.section_order]}];

  const componentSpecs=contract.component_intent.map(c=>({
    component:c.component,
    intent:c.intent,
    geometry:clone(c.geometry),
    variants:clone(c.variants),
    responsive:clone(c.responsive)
  }));

  const layoutSystem={
    ...clone(contract.layout),
    grid:clone(contract.grid),
    grid_columns:Number(contract.grid?.columns || contract.layout?.grid_columns || 12),
    grid_gap:String(contract.grid?.gap || contract.spacing?.grid_gap || contract.layout?.grid_gap || '1.5rem')
  };

  return {
    schema:'riosystems.visual-design-contract.v1',
    design_id:'reference-design-' + contract.source_reference.reference_id + '-' + contract.contract_version,
    project_id:contract.project_scope,
    source_provider:'riosystems-reference-studio',
    source_kind:'approved-reference-structured-extraction',
    pages,
    sections:contract.sections.map((s,index)=>({
      id:s.id,
      type:s.component_intent || s.id,
      order:index,
      layout:clone(s.layout),
      image_placement:clone(s.image_placement),
      background_behavior:clone(s.background_behavior)
    })),
    layout_system:layoutSystem,
    color_tokens:clone(contract.colors),
    typography_tokens:clone(contract.typography),
    spacing_tokens:clone(contract.spacing),
    radius_tokens:clone(contract.radius),
    shadow_tokens:clone(contract.shadow),
    component_specs:componentSpecs,
    interaction_specs:arr(observation.interaction_specs).map(clone),
    animation_specs:arr(observation.animation_specs).map(clone),
    responsive_rules:contract.responsive_behavior.map(r=>({id:r.id,breakpoint:r.breakpoint,behavior:clone(r.behavior)})),
    asset_manifest:arr(observation.asset_manifest).map(clone),
    visual_references:[{
      reference_id:contract.source_reference.reference_id,
      version:contract.source_reference.version,
      hash:contract.source_reference.hash,
      viewport:contract.viewport,
      approved:true
    }],
    implementation_notes:[
      'Approved Reference is the visual source of truth.',
      'Values are derived from structured reference observation, not an opaque pixel-only clone.',
      'Independent implementation only; asset-rights validation remains fail-closed.'
    ]
  };
}

export function createReferenceDesignContract(input = {}) {
  const reference=input.approved_reference || input.reference;
  const verification=verifyApprovedReferenceLock(reference || {});
  if (!verification.ok) return fail('VALID_APPROVED_REFERENCE_REQUIRED',{reference_verification:verification});

  const observation=sourceObservation(input);
  const issues=requiredEvidenceIssues(observation);
  if (text(observation.reference_hash,128) && observation.reference_hash !== reference.hash) {
    issues.push({code:'REFERENCE_OBSERVATION_HASH_MISMATCH',expected:reference.hash,actual:observation.reference_hash});
  }
  if (text(observation.reference_id,320) && observation.reference_id !== reference.reference_id) {
    issues.push({code:'REFERENCE_OBSERVATION_ID_MISMATCH',expected:reference.reference_id,actual:observation.reference_id});
  }
  if (issues.length) return fail('REFERENCE_DESIGN_EXTRACTION_BLOCKED',{issues,reference_verification:verification});

  const core=extractCore(reference,observation,input.contract_version || '1.0.0');
  const hash=digest(core);
  const contract={...core,hash,hash_algorithm:'sha256'};
  const visualDesignContract=visualContractFromReferenceDesign(contract,observation);
  const validation=validateVisualDesignContract(visualDesignContract);
  if (!validation.ok) {
    return fail('REFERENCE_DESIGN_CONTRACT_VISUAL_VALIDATION_BLOCKED',{
      contract,
      visual_design_validation:validation
    });
  }
  return {
    ok:true,
    status:'REFERENCE_DESIGN_CONTRACT_READY',
    contract,
    visual_design_contract:validation.contract,
    visual_design_validation:validation,
    variable_cost_eur:0,
    production_deploy:false
  };
}

export function verifyReferenceDesignContract(contractInput = {}) {
  const contract=structuredClone(contractInput || {});
  const actual=contract.hash || null;
  delete contract.hash;
  delete contract.hash_algorithm;
  const expected=digest(contract);
  const required=[
    'schema','contract_version','project_scope','viewport','source_reference','layout','grid','spacing',
    'typography','colors','section_order','component_intent','hero_geometry','navigation','cta_hierarchy',
    'image_placement','background_behavior','border','radius','shadow','responsive_behavior','provenance'
  ];
  const missing=required.filter(k=>contract[k] == null);
  const ok=contract.schema === 'riosystems.reference-design-contract.v1' && actual === expected && !missing.length && contract.deterministic === true && contract.diffable === true;
  return {ok,status:ok?'REFERENCE_DESIGN_CONTRACT_VALID':'REFERENCE_DESIGN_CONTRACT_INVALID',hash_matches:actual===expected,expected_hash:expected,actual_hash:actual,missing_fields:missing,production_deploy:false};
}

function flatten(value,prefix='',out={}) {
  if (Array.isArray(value)) {
    value.forEach((v,i)=>flatten(v,prefix + '[' + i + ']',out));
    if (!value.length) out[prefix]='[]';
    return out;
  }
  if (value && typeof value === 'object') {
    const keys=Object.keys(value).sort();
    if (!keys.length) out[prefix]='{}';
    for (const key of keys) flatten(value[key],prefix ? prefix + '.' + key : key,out);
    return out;
  }
  out[prefix]=value;
  return out;
}

export function diffReferenceDesignContracts(beforeInput = {}, afterInput = {}) {
  const before=structuredClone(beforeInput || {});
  const after=structuredClone(afterInput || {});
  const beforeVerify=verifyReferenceDesignContract(before);
  const afterVerify=verifyReferenceDesignContract(after);
  if (!beforeVerify.ok || !afterVerify.ok) return fail('VALID_REFERENCE_DESIGN_CONTRACTS_REQUIRED',{before_verification:beforeVerify,after_verification:afterVerify});
  if (before.project_scope !== after.project_scope) return fail('REFERENCE_DESIGN_SCOPE_MISMATCH');
  if (before.viewport !== after.viewport) return fail('REFERENCE_DESIGN_VIEWPORT_MISMATCH');

  const omit=(x)=>{
    const y=structuredClone(x);
    delete y.hash; delete y.hash_algorithm;
    return flatten(y);
  };
  const a=omit(before), b=omit(after);
  const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
  const changes=keys.filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(path=>({
    path,
    before:Object.prototype.hasOwnProperty.call(a,path)?a[path]:null,
    after:Object.prototype.hasOwnProperty.call(b,path)?b[path]:null
  }));
  const categories=[...new Set(changes.map(c=>c.path.split(/[.[]/)[0]).filter(Boolean))];
  return {
    ok:true,
    status:changes.length?'REFERENCE_DESIGN_CHANGED':'REFERENCE_DESIGN_UNCHANGED',
    project_scope:before.project_scope,
    viewport:before.viewport,
    before_hash:before.hash,
    after_hash:after.hash,
    changed_paths:changes,
    changed_categories:categories,
    deterministic:true,
    production_deploy:false
  };
}

export function referenceDesignContractManifest() {
  return {
    schema:'riosystems.reference-design-contract-manifest.v1',
    contract_schema:'riosystems.reference-design-contract.v1',
    source_requirement:'valid-hash-locked-approved-reference',
    extraction_requirement:'structured-observation',
    required_dimensions:[
      'layout','grid','spacing','typography','colors','section_order','component_intent','hero_geometry',
      'navigation','cta_hierarchy','image_placement','background_behavior','border','radius','shadow','responsive_behavior'
    ],
    machine_readable:true,
    versioned:true,
    project_scoped:true,
    deterministic:true,
    diffable:true,
    pixel_only_black_box:false,
    existing_visual_design_contract_reused:true,
    production_deploy:false
  };
}
