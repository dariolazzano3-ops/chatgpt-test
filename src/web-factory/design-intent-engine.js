import { planWebsite } from './planner.js';

const clone = (v) => v == null ? v : structuredClone(v);
const text = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (v) => Array.isArray(v) ? v : [];

const DEFAULTS = {
  visual_style: 'premium, clear, restrained',
  color_palette: { background:'#f7f7f4', surface:'#ffffff', text:'#171717', muted:'#646464', accent:'#24403a', accent_text:'#ffffff', border:'#deded8' },
  contrast: 'accessible-high',
  typography_character: 'editorial restraint with highly readable body text',
  heading_scale: { '2xl':'clamp(2.75rem,7vw,6rem)', xl:'clamp(1.8rem,4vw,3rem)', lg:'1.5rem' },
  body_scale: { md:'1rem', lg:'1.125rem' },
  spacing_rhythm: { section:'clamp(4rem,9vw,8rem)', grid_gap:'1.5rem', component:'1.5rem' },
  grid: { columns:12, gap:'1.5rem' },
  containers: { content:'76rem', narrow:'48rem' },
  section_density: 'medium-low',
  card_geometry: { radius:'0.5rem', padding:'2rem' },
  borders: 'subtle',
  shadows: { card:'0 20px 60px rgba(0,0,0,.07)' },
  background_style: 'quiet layered surfaces',
  image_treatment: 'editorial crop, restrained saturation',
  navigation_style: 'sticky, minimal, high clarity',
  cta_style: 'high contrast, concise, prominent but not aggressive',
  visual_hierarchy: 'strong headline > proof > offer > CTA',
  alignment: 'contained editorial grid',
  decorative_patterns: 'minimal',
  motion_intent: 'purposeful subtle transitions',
  responsive_assumptions: [{ id:'tablet', breakpoint:1024, behavior:{grid_columns:2,container_gutter:'2rem',hero_min_height:'64vh'}},{id:'mobile', breakpoint:768, behavior:{grid_columns:1,container_gutter:'1.25rem',hero_min_height:'auto'}}]
};

function brandInfluence(existingBrand = {}) {
  const colors = existingBrand.colors && typeof existingBrand.colors === 'object' ? existingBrand.colors : null;
  return {
    ...(colors ? { color_palette: { ...DEFAULTS.color_palette, ...clone(colors) } } : {}),
    ...(existingBrand.typography_character ? { typography_character: text(existingBrand.typography_character) } : {}),
    ...(existingBrand.description ? { brand_description: text(existingBrand.description, 800) } : {}),
    ...(existingBrand.tone ? { brand_tone: text(existingBrand.tone) } : {})
  };
}

function applyOperatorOverrides(intent, instruction = {}) {
  const out = clone(intent);
  const direct = instruction.overrides && typeof instruction.overrides === 'object' ? instruction.overrides : {};
  Object.assign(out, clone(direct));
  const direction = text(instruction.direction || instruction.instructions || '', 600).toLowerCase();
  if (/less futuristic/.test(direction)) out.decorative_patterns = 'minimal non-futuristic';
  if (/more trustworthy/.test(direction)) { out.visual_style = `${out.visual_style}, trustworthy`; out.cta_style = 'clear, calm, high contrast'; }
  if (/more premium/.test(direction)) { out.visual_style = `${out.visual_style}, premium`; out.section_density = 'low'; }
  if (/more minimal/.test(direction)) { out.decorative_patterns = 'minimal'; out.section_density = 'low'; }
  if (/more playful/.test(direction)) out.visual_style = `${out.visual_style}, playful but controlled`;
  if (/more luxurious/.test(direction)) { out.visual_style = `${out.visual_style}, luxurious editorial`; out.section_density = 'low'; }
  if (/more corporate/.test(direction)) out.visual_style = `${out.visual_style}, structured corporate`;
  if (/more editorial/.test(direction)) out.typography_character = 'editorial hierarchy with expressive headings and restrained body copy';
  return out;
}

export function createDesignIntent({ mission = {}, fusion = {}, industry_pattern = {}, operator_intent = {}, brand = null } = {}) {
  const referenceDefaults = fusion.fused_attributes || {};
  const brandRules = brandInfluence(brand || mission.existing_brand || {});
  const merged = { ...clone(DEFAULTS), ...clone(referenceDefaults), ...clone(brandRules) };
  const finalIntent = applyOperatorOverrides(merged, operator_intent);
  return {
    schema: 'riosystems.web-design-intent.v1', status: 'READY', project_id: mission.project_slug,
    business_type: mission.industry, target_audience: mission.target_audience, operator_intent: clone(operator_intent),
    industry_pattern_id: industry_pattern.pattern_id || null, intent: finalIntent,
    precedence: ['operator_instruction','explicit_reference_priority','brand_rules','reference_defaults','safe_defaults'],
    reference_provenance: clone(fusion.provenance || {}), conflicts_resolved: clone(fusion.conflicts || []), coherent_single_design: true
  };
}

export function designIntentToVisualContract({ mission = {}, design_intent, industry_pattern = {}, references = [], motion = null } = {}) {
  const intent = design_intent?.intent || DEFAULTS;
  const missionForPlan = { ...structuredClone(mission), required_pages:[...new Set([...(mission.required_pages || []), ...(industry_pattern.recommended_pages || [])])] };
  const blueprint = planWebsite(missionForPlan);
  const pageEntries = blueprint.pages.map((page) => ({ id:page.id, path:page.path, sections:[...page.sections] }));
  const sections = [...new Set(pageEntries.flatMap((page) => page.sections))].map((id, order) => ({ id, type:id, order, layout:{alignment:'contained'}, visual_hierarchy:{role:id === 'hero' ? 'primary' : 'supporting'} }));
  const palette = intent.color_palette || DEFAULTS.color_palette;
  const spacing = intent.spacing_rhythm || DEFAULTS.spacing_rhythm;
  const assets = arr(mission.existing_brand?.assets).map((asset, index) => ({
    asset_id: String(asset.asset_id || `brand-asset-${index + 1}`), source:String(asset.source || 'brand'), kind:String(asset.kind || 'asset'), font_family:asset.font_family || null,
    license_status:String(asset.license_status || 'unknown'), ownership:String(asset.ownership || 'unknown'), allowed_for_reimplementation:asset.allowed_for_reimplementation === true, replacement_required:asset.replacement_required === true
  }));
  if (!assets.length) assets.push({ asset_id:'generated-placeholder', source:'riosystems-generated', kind:'brand-mark', license_status:'generated', ownership:'riosystems-test-or-project', allowed_for_reimplementation:true, replacement_required:false });
  return {
    schema:'riosystems.visual-design-contract.v1',
    design_id:`design-${mission.project_slug || 'website'}-autonomous-v1`, project_id:mission.project_slug || 'website-project', source_provider:'provider-neutral-autonomous-web-intelligence', source_kind:'fused-reference-brand-industry-intent',
    pages:pageEntries, sections,
    layout_system:{ container_width:intent.containers?.content || '76rem', narrow_container_width:intent.containers?.narrow || '48rem', hero_min_height:'68vh', grid_columns:Number(intent.grid?.columns || 12), grid_gap:intent.grid?.gap || spacing.grid_gap || '1.5rem', section_alignment:'contained', navigation_behavior:'sticky' },
    color_tokens:{ background:palette.background || '#f7f7f4', surface:palette.surface || '#fff', text:palette.text || '#171717', muted:palette.muted || '#646464', accent:palette.accent || '#24403a', accent_text:palette.accent_text || '#fff', border:palette.border || '#deded8' },
    typography_tokens:{ body_family:'system-ui, sans-serif', heading_family:'ui-serif, serif', heading_scale:intent.heading_scale || DEFAULTS.heading_scale, body_scale:intent.body_scale || DEFAULTS.body_scale, line_height_body:1.65, line_height_heading:1.04 },
    spacing_tokens:{ section:spacing.section || 'clamp(4rem,9vw,8rem)', grid_gap:spacing.grid_gap || '1.5rem', component:spacing.component || '1.5rem' },
    radius_tokens:{ card:intent.card_geometry?.radius || '0.5rem', button:'999px' }, shadow_tokens:{ card:intent.shadows?.card || '0 20px 60px rgba(0,0,0,.07)' },
    component_specs:[{component:'Hero',geometry:{content_max_width:'15ch',text_align:'left'}},{component:'Card',geometry:{padding:intent.card_geometry?.padding || '2rem'}},{component:'CTA',geometry:{prominence:'high'}}],
    interaction_specs:arr(motion?.items).map((item) => ({ type:item.type, purpose:item.purpose, trigger:item.trigger, duration:item.duration, intensity:item.intensity, accessibility_fallback:item.accessibility_fallback })),
    animation_specs:[], responsive_rules:arr(intent.responsive_assumptions).length ? clone(intent.responsive_assumptions) : clone(DEFAULTS.responsive_assumptions),
    asset_manifest:assets, visual_references:clone(references), implementation_notes:['Independent reconstruction only','No raw provider HTML or proprietary component extraction','Respect reduced-motion and asset rights']
  };
}
