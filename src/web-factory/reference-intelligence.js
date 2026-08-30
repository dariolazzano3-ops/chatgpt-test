const REFERENCE_ROLES = new Set(['global_style','hero','navigation','typography','colors','layout','cards','components','footer','motion','imagery','spacing']);
const ELEMENT_TYPES = new Set(['generic_design_principle','brand_identity','logo','photography','illustration','copy','paid_asset','custom_icon','proprietary_component']);

const clean = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const array = (v) => Array.isArray(v) ? v : [];
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export function normalizeVisualReferences(input = []) {
  return array(input).slice(0, 24).map((reference, index) => ({
    reference_id: clean(reference?.reference_id || `reference-${index + 1}`, 120),
    source: clean(reference?.source || 'operator-supplied', 500),
    role: REFERENCE_ROLES.has(String(reference?.role)) ? String(reference.role) : 'global_style',
    priority: Math.max(0, Math.min(100, num(reference?.priority, 50))),
    instructions: clean(reference?.instructions, 600),
    allowed_influence: array(reference?.allowed_influence).map(String).slice(0, 24),
    excluded_elements: array(reference?.excluded_elements).map(String).slice(0, 24),
    match_strength: Math.max(0, Math.min(1, num(reference?.match_strength, 0.5))),
    analysis: reference?.analysis && typeof reference.analysis === 'object' ? structuredClone(reference.analysis) : null,
    elements: array(reference?.elements).map((item, elementIndex) => ({
      element_id: clean(item?.element_id || `element-${elementIndex + 1}`, 120),
      element_type: ELEMENT_TYPES.has(String(item?.element_type)) ? String(item.element_type) : 'generic_design_principle',
      rights_status: clean(item?.rights_status || 'unknown', 80),
      allowed_for_reimplementation: item?.allowed_for_reimplementation === true
    }))
  }));
}

export function screenshotToDesignSpecManifest() {
  return {
    schema: 'riosystems.screenshot-to-design-spec.v1',
    provider_neutral: true,
    extractable_fields: ['visual_style','color_palette','contrast','typography_character','heading_scale','body_scale','spacing_rhythm','grid','containers','section_density','card_geometry','borders','shadows','background_style','image_treatment','navigation_style','cta_style','visual_hierarchy','alignment','decorative_patterns','motion_intent','responsive_assumptions'],
    runtime_policy: 'Only supplied structured evidence or a verified vision adapter may mark properties as observed.',
    pixel_clone_allowed: false,
    variable_cost_ceiling_eur: 0
  };
}

export function analyzeVisualReference(reference = {}) {
  const [normalized] = normalizeVisualReferences([reference]);
  const observed = normalized.analysis;
  if (!observed) {
    return {
      schema: 'riosystems.visual-reference-analysis.v1', reference_id: normalized.reference_id,
      status: 'EXTERNAL_ANALYSIS_REQUIRED', observed: false, attributes: null, verified_properties: [],
      unverified_properties: screenshotToDesignSpecManifest().extractable_fields, pixel_analysis_executed: false
    };
  }
  const allowed = new Set(screenshotToDesignSpecManifest().extractable_fields);
  const attributes = Object.fromEntries(Object.entries(observed).filter(([key]) => allowed.has(key)));
  return {
    schema: 'riosystems.visual-reference-analysis.v1', reference_id: normalized.reference_id,
    status: 'STRUCTURED_EVIDENCE_ANALYZED', observed: true, attributes,
    verified_properties: Object.keys(attributes), unverified_properties: [...allowed].filter((key) => !Object.prototype.hasOwnProperty.call(attributes, key)),
    pixel_analysis_executed: false
  };
}

export function fuseVisualReferences(input = []) {
  const references = normalizeVisualReferences(input);
  const analyses = references.map(analyzeVisualReference);
  const candidates = references.flatMap((reference, index) => {
    const analysis = analyses[index];
    if (!analysis.observed) return [];
    return Object.entries(analysis.attributes).map(([attribute, value]) => ({ attribute, value, reference_id: reference.reference_id, role: reference.role, priority: reference.priority, match_strength: reference.match_strength, score: reference.priority * Math.max(0.1, reference.match_strength) }));
  });
  const grouped = new Map();
  for (const candidate of candidates) grouped.set(candidate.attribute, [...(grouped.get(candidate.attribute) || []), candidate]);
  const fused = {}; const provenance = {}; const conflicts = [];
  for (const [attribute, items] of grouped) {
    items.sort((a, b) => b.score - a.score || b.priority - a.priority || a.reference_id.localeCompare(b.reference_id));
    fused[attribute] = structuredClone(items[0].value);
    provenance[attribute] = { reference_id: items[0].reference_id, role: items[0].role, priority: items[0].priority, match_strength: items[0].match_strength };
    if (new Set(items.map((item) => JSON.stringify(item.value))).size > 1) conflicts.push({ attribute, winner: items[0].reference_id, competing_references: items.slice(1).map((item) => item.reference_id), resolution: 'explicit_priority_then_match_strength' });
  }
  return {
    schema: 'riosystems.multi-reference-fusion.v1', status: analyses.some((item) => item.observed) ? 'FUSED' : 'NO_ANALYZED_REFERENCES',
    references, analyses, fused_attributes: fused, provenance, conflicts,
    coherence_rule: 'operator_instruction > explicit_priority > brand_rules > reference_defaults', collage_mode: false
  };
}

export function evaluateReferenceOriginality(input = []) {
  const refs = normalizeVisualReferences(input);
  const protectedTypes = new Set(['brand_identity','logo','photography','illustration','copy','paid_asset','custom_icon','proprietary_component']);
  const items = refs.flatMap((reference) => reference.elements.map((element) => {
    const protectedElement = protectedTypes.has(element.element_type);
    const allowed = !protectedElement || (element.allowed_for_reimplementation && ['owned','licensed','public_domain','generated'].includes(element.rights_status));
    return { reference_id: reference.reference_id, ...element, classification: protectedElement ? 'rights_sensitive' : 'generic_principle', status: allowed ? 'ALLOWED_AS_INFLUENCE' : 'REPLACEMENT_REQUIRED' };
  }));
  const blocked = items.filter((item) => item.status === 'REPLACEMENT_REQUIRED');
  return {
    schema: 'riosystems.reference-originality-report.v1', originality_status: blocked.length ? 'REPLACEMENT_REQUIRED' : 'PASS',
    replacement_required: blocked.map((item) => ({ reference_id: item.reference_id, element_id: item.element_id, element_type: item.element_type })),
    asset_warnings: blocked.map((item) => `Do not reimplement ${item.element_type} ${item.element_id} from ${item.reference_id}; replace with owned/licensed/generated material.`),
    blind_pixel_clone: false, high_fidelity_overrides_rights: false
  };
}
