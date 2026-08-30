export const FIDELITY_LEVELS = Object.freeze({
  STANDARD: { target: 85, minimum_structured_coverage: 0.7, screenshot_required: false },
  PREMIUM: { target: 93, minimum_structured_coverage: 0.8, screenshot_required: false },
  HIGH_FIDELITY: { target: 97, minimum_structured_coverage: 0.9, screenshot_required: true }
});

function stable(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  return JSON.stringify(value);
}

function equal(a, b) {
  return stable(a) === stable(b);
}

function addCheck(checks, category, path, expected, actual, weight = 1) {
  if (expected === undefined) return;
  checks.push({ category, path, expected, actual, weight, verifiable: true, pass: equal(expected, actual) });
}

function componentMap(items = []) {
  return new Map(items.map((item) => [String(item.component), item]));
}

export function evaluateVisualFidelity(reference = {}, implementation = {}, options = {}) {
  const levelName = String(options.level || 'PREMIUM').toUpperCase();
  const level = FIDELITY_LEVELS[levelName] || FIDELITY_LEVELS.PREMIUM;
  const checks = [];

  addCheck(checks, 'layout_similarity', 'layout.container_width', reference.layout?.container_width, implementation.layout?.container_width, 3);
  addCheck(checks, 'layout_similarity', 'layout.hero_min_height', reference.layout?.hero_min_height, implementation.layout?.hero_min_height, 3);
  addCheck(checks, 'layout_similarity', 'layout.grid_columns', reference.layout?.grid_columns, implementation.layout?.grid_columns, 2);
  addCheck(checks, 'layout_similarity', 'layout.navigation_behavior', reference.layout?.navigation_behavior, implementation.layout?.navigation_behavior, 1);
  addCheck(checks, 'layout_similarity', 'layout.section_alignment', reference.layout?.section_alignment, implementation.layout?.section_alignment, 1);
  addCheck(checks, 'spacing', 'spacing.section', reference.spacing?.section, implementation.spacing?.section, 3);
  addCheck(checks, 'spacing', 'spacing.grid_gap', reference.spacing?.grid_gap, implementation.spacing?.grid_gap, 2);

  for (const key of ['background', 'surface', 'text', 'muted', 'accent', 'border']) addCheck(checks, 'colors', `colors.${key}`, reference.colors?.[key], implementation.colors?.[key], 2);

  addCheck(checks, 'typography', 'typography.body_family', reference.typography?.body_family, implementation.typography?.body_family, 2);
  addCheck(checks, 'typography', 'typography.heading_family', reference.typography?.heading_family, implementation.typography?.heading_family, 2);
  addCheck(checks, 'typography', 'typography.heading_scale', reference.typography?.heading_scale, implementation.typography?.heading_scale, 3);
  addCheck(checks, 'component_geometry', 'radius.card', reference.radius?.card, implementation.radius?.card, 2);
  addCheck(checks, 'component_geometry', 'radius.button', reference.radius?.button, implementation.radius?.button, 1);
  addCheck(checks, 'component_geometry', 'shadows.card', reference.shadows?.card, implementation.shadows?.card, 2);

  const referencePages = reference.pages || [];
  const implementationPages = new Map((implementation.pages || []).map((page) => [String(page.id), page]));
  for (const page of referencePages) addCheck(checks, 'section_composition', `pages.${page.id}.section_order`, page.section_order, implementationPages.get(String(page.id))?.section_order, 3);

  const referenceComponents = componentMap(reference.components || []);
  const implementationComponents = componentMap(implementation.components || []);
  for (const [name, component] of referenceComponents.entries()) addCheck(checks, 'component_geometry', `components.${name}.geometry`, component.geometry, implementationComponents.get(name)?.geometry, 2);

  addCheck(checks, 'responsive_behavior', 'responsive', reference.responsive, implementation.responsive, 4);
  addCheck(checks, 'interaction_coverage', 'interactions.native_reproducible', reference.interactions?.coverage?.native_reproducible, implementation.interactions?.coverage?.implemented_native, 3);

  const totalWeight = checks.reduce((sum, item) => sum + item.weight, 0);
  const passedWeight = checks.filter((item) => item.pass).reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight ? Math.round((passedWeight / totalWeight) * 10000) / 100 : null;
  const failed = checks.filter((item) => !item.pass);
  const screenshot = options.screenshot_report || { status: 'NOT_EXECUTED_RUNTIME_UNAVAILABLE', executed: false, pixel_comparison_claimed: false };

  const expectedCategories = new Set(['layout_similarity', 'spacing', 'typography', 'colors', 'component_geometry', 'responsive_behavior', 'section_composition', 'interaction_coverage']);
  const measuredCategories = new Set(checks.map((item) => item.category));
  const structuredCoverage = measuredCategories.size / expectedCategories.size;
  const screenshotBlock = level.screenshot_required && screenshot.executed !== true;
  const insufficientCoverage = structuredCoverage < level.minimum_structured_coverage;
  const blocking = [];
  if (screenshotBlock) blocking.push({ code: 'SCREENSHOT_EVIDENCE_REQUIRED_FOR_HIGH_FIDELITY' });
  if (insufficientCoverage) blocking.push({ code: 'INSUFFICIENT_STRUCTURED_MEASUREMENT_COVERAGE', structured_coverage: structuredCoverage });

  const pass = !blocking.length && score != null && score >= level.target;
  return {
    schema: 'riosystems.visual-fidelity-report.v1',
    status: pass ? 'PASS' : 'FAIL',
    fidelity_level: levelName,
    target: level.target,
    visual_fidelity_score: score,
    reference_alignment: score,
    visual_fidelity_status: pass ? 'PASS' : 'FAIL',
    score_basis: 'weighted exact comparison of provider-neutral structured design properties against native implementation metadata',
    pixel_similarity_score: screenshot.executed === true ? screenshot.pixel_similarity_score ?? null : null,
    screenshot_status: screenshot.status,
    pixel_comparison_executed: screenshot.executed === true,
    structured_measurement_coverage: Math.round(structuredCoverage * 1000) / 1000,
    measured_checks: checks,
    blocking_differences: [...blocking, ...failed.map(({ category, path, expected, actual }) => ({ category, path, expected, actual }))],
    warnings: screenshot.executed === true ? [] : [{ code: 'PIXEL_COMPARISON_NOT_EXECUTED', message: 'No pixel-level claim is included in the structured fidelity score.' }],
    unverified_properties: screenshot.executed === true ? [] : ['pixel_similarity', 'rendered_font_metrics', 'anti_aliasing', 'image_crop_pixels'],
    no_fake_score: true
  };
}
