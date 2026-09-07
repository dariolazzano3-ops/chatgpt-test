import assert from 'node:assert/strict';
import {
  createReferenceBrief,
  createSketchGenerationContract,
  createCandidateReferenceContract,
  approveReference
} from '../src/web-factory/reference-studio-v1.js';
import {
  createReferenceDesignContract,
  verifyReferenceDesignContract,
  diffReferenceDesignContracts,
  referenceDesignContractManifest
} from '../src/web-factory/reference-design-contract-v1.js';

const now=(minute)=>({now:'2026-09-07T00:' + String(minute).padStart(2,'0') + ':00.000Z'});
const knowledge={
  knowledge_id:'j2-gelato-knowledge-v1',
  scope_key:'customer:gelato-donatello:website-v1',
  revision:'13',
  business_name:'Gelato Donatello',
  industry:'gelateria',
  primary_goal:'Show confirmed assortment and drive visits',
  required_sections:['hero','sortiment','location','contact'],
  facts:[{key:'business_name',value:'Gelato Donatello',status:'CONFIRMED',source:'operator'}]
};
const brief=createReferenceBrief({
  project_knowledge:knowledge,
  project_scope:knowledge.scope_key,
  viewport:'1440_DESKTOP',
  reference_id:'gelato-j2-reference'
},now(10));
const sketch=createSketchGenerationContract(brief.reference,{},now(11));
const candidate=createCandidateReferenceContract(sketch.reference,{
  render_asset_ref:'reference://gelato/j2/desktop.png',
  render_asset_hash:'asset-hash-j2',
  width:1440,
  height:1600,
  unresolved_items:[]
},now(12));
const approved=approveReference(candidate.reference,{approved_by:'operator-dario',approval_kind:'HUMAN'},now(13));
assert.equal(approved.ok,true);

const observation={
  reference_id:approved.reference.reference_id,
  reference_hash:approved.reference.hash,
  observed:true,
  method:'verified-vision-adapter-v1',
  layout:{container_width:'76rem',narrow_container_width:'48rem',hero_min_height:'72vh',section_alignment:'contained'},
  grid:{columns:12,gap:'1.5rem'},
  spacing:{section:'clamp(4rem,9vw,8rem)',grid_gap:'1.5rem',component:'1.5rem'},
  typography:{
    body_family:'system-ui, sans-serif',
    heading_family:'ui-serif, serif',
    heading_scale:{xl:'clamp(2.5rem,6vw,5.5rem)'},
    body_scale:{md:'1rem'},
    line_height_body:1.65,
    line_height_heading:1.04
  },
  colors:{background:'#fffaf4',surface:'#ffffff',text:'#1b1715',muted:'#6f655f',accent:'#773d2b',accent_text:'#ffffff',border:'#eaded4'},
  sections:[
    {id:'hero',order:0,component_intent:'Hero',layout:{alignment:'contained'},image_placement:{role:'background',focal_point:'center'},background_behavior:{type:'image-overlay'}},
    {id:'sortiment',order:1,component_intent:'GelateriaFlavorGrid',layout:{columns:3},image_placement:{role:'card'},background_behavior:{type:'surface'}},
    {id:'location',order:2,component_intent:'LocationCard',layout:{columns:2},background_behavior:{type:'quiet'}},
    {id:'contact',order:3,component_intent:'CTA',layout:{alignment:'center'},background_behavior:{type:'accent'}}
  ],
  component_intent:[
    {component:'Hero',intent:'Establish brand and primary visit CTA',geometry:{content_max_width:'16ch'}},
    {component:'GelateriaFlavorGrid',intent:'Present confirmed assortment',geometry:{columns:3}},
    {component:'LocationCard',intent:'Make place information scannable'},
    {component:'CTA',intent:'Drive contact or visit action',geometry:{prominence:'high'}}
  ],
  hero_geometry:{content_max_width:'16ch',media_mode:'background',vertical_alignment:'center'},
  navigation:{behavior:'sticky',height:'72px',mobile:'drawer'},
  cta_hierarchy:{primary:'visit',secondary:'contact',tertiary:'menu'},
  image_placement:[
    {section:'hero',mode:'background',crop:'cover'},
    {section:'sortiment',mode:'card-media',crop:'1:1'}
  ],
  background_behavior:[
    {section:'hero',type:'image-overlay'},
    {section:'sortiment',type:'surface'}
  ],
  border:{default:'1px solid #eaded4'},
  radius:{card:'0.75rem',button:'999px'},
  shadow:{card:'0 20px 60px rgba(0,0,0,.07)'},
  responsive_behavior:[
    {id:'mobile',viewport:'390_MOBILE',breakpoint:768,behavior:{grid_columns:1,hero_min_height:'auto'}},
    {id:'tablet',viewport:'1024_TABLET',breakpoint:1024,behavior:{grid_columns:2,hero_min_height:'64vh'}}
  ],
  pages:[{id:'home',path:'/',sections:['hero','sortiment','location','contact']}],
  asset_manifest:[{
    asset_id:'generated-placeholder',
    source:'riosystems-generated',
    kind:'image',
    license_status:'generated',
    ownership:'project',
    allowed_for_reimplementation:true,
    replacement_required:false
  }]
};

const first=createReferenceDesignContract({
  approved_reference:approved.reference,
  structured_observation:observation,
  contract_version:'1.0.0'
});
assert.equal(first.ok,true);
assert.equal(first.status,'REFERENCE_DESIGN_CONTRACT_READY');
assert.equal(first.contract.source_reference.hash,approved.reference.hash);
assert.equal(first.contract.extraction.pixel_only_black_box,false);
assert.equal(first.visual_design_validation.status,'VALID');
assert.equal(first.contract.section_order[0],'hero');
assert.equal(first.contract.responsive_behavior.length,2);
assert.equal(verifyReferenceDesignContract(first.contract).ok,true);

const second=createReferenceDesignContract({
  approved_reference:approved.reference,
  structured_observation:structuredClone(observation),
  contract_version:'1.0.0'
});
assert.equal(second.ok,true);
assert.equal(second.contract.hash,first.contract.hash);
assert.deepEqual(second.contract,first.contract);

const tampered=structuredClone(first.contract);
tampered.hero_geometry.content_max_width='99ch';
assert.equal(verifyReferenceDesignContract(tampered).ok,false);

const changedObservation=structuredClone(observation);
changedObservation.spacing.section='clamp(5rem,10vw,9rem)';
const changed=createReferenceDesignContract({
  approved_reference:approved.reference,
  structured_observation:changedObservation,
  contract_version:'1.0.1'
});
assert.equal(changed.ok,true);
const diff=diffReferenceDesignContracts(first.contract,changed.contract);
assert.equal(diff.ok,true);
assert.equal(diff.status,'REFERENCE_DESIGN_CHANGED');
assert.ok(diff.changed_categories.includes('spacing'));
assert.ok(diff.changed_categories.includes('contract_version'));

const mismatch=createReferenceDesignContract({
  approved_reference:approved.reference,
  structured_observation:{...observation,reference_hash:'wrong-hash'}
});
assert.equal(mismatch.ok,false);
assert.equal(mismatch.status,'REFERENCE_DESIGN_EXTRACTION_BLOCKED');

const unapproved=createReferenceDesignContract({
  approved_reference:candidate.reference,
  structured_observation:observation
});
assert.equal(unapproved.ok,false);
assert.equal(unapproved.status,'VALID_APPROVED_REFERENCE_REQUIRED');

const opaque=createReferenceDesignContract({
  approved_reference:approved.reference,
  structured_observation:{...observation,observed:false}
});
assert.equal(opaque.ok,false);
assert.ok(opaque.issues.some(x=>x.code==='STRUCTURED_OBSERVATION_REQUIRED'));

const unsafeAssets=structuredClone(observation);
unsafeAssets.asset_manifest=[{asset_id:'unknown-photo',source:'unknown',kind:'photography',license_status:'unknown',allowed_for_reimplementation:false}];
const rightsBlocked=createReferenceDesignContract({
  approved_reference:approved.reference,
  structured_observation:unsafeAssets
});
assert.equal(rightsBlocked.ok,false);
assert.equal(rightsBlocked.status,'REFERENCE_DESIGN_CONTRACT_VISUAL_VALIDATION_BLOCKED');

const manifest=referenceDesignContractManifest();
assert.equal(manifest.deterministic,true);
assert.equal(manifest.diffable,true);
assert.equal(manifest.pixel_only_black_box,false);
assert.equal(manifest.existing_visual_design_contract_reused,true);
for (const required of ['layout','grid','spacing','typography','colors','section_order','component_intent','hero_geometry','navigation','cta_hierarchy','image_placement','background_behavior','border','radius','shadow','responsive_behavior']) {
  assert.ok(manifest.required_dimensions.includes(required));
}

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j2-reference-design-contract',
  contract_hash:first.contract.hash,
  reproducible_hash:first.contract.hash===second.contract.hash,
  changed_categories:diff.changed_categories,
  visual_design_contract_reused:true,
  pixel_only_black_box:false,
  production_deploy:false,
  variable_cost_eur:0
},null,2));
