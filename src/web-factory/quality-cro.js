function pxLike(value) {
  const match = String(value || '').match(/([0-9.]+)rem/);
  return match ? Number(match[1]) : null;
}

function check(id, category, pass, evidence, repair, severity = 'block') {
  return { id, category, status: pass ? 'PASS' : severity === 'warn' ? 'WARN' : 'BLOCK', verified: true, evidence, repair_instruction: pass ? null : repair };
}

export function directVisualQuality({ design_intent = {}, visual_contract = {}, implementation = null } = {}) {
  const intent = design_intent.intent || {};
  const spacing = visual_contract.spacing_tokens || {};
  const layout = visual_contract.layout_system || {};
  const components = visual_contract.component_specs || [];
  const checks = [];
  const sectionRem = pxLike(spacing.section);
  checks.push(check('whitespace','whitespace', sectionRem == null || sectionRem >= 3.5, { section_spacing: spacing.section }, 'Increase section spacing to at least a calm premium rhythm.'));
  checks.push(check('hierarchy','visual_hierarchy', Boolean(intent.visual_hierarchy), { visual_hierarchy: intent.visual_hierarchy }, 'Define an explicit headline/proof/offer/CTA hierarchy.'));
  checks.push(check('typography','typography_consistency', Boolean(visual_contract.typography_tokens?.heading_family && visual_contract.typography_tokens?.body_family), { heading_family: visual_contract.typography_tokens?.heading_family, body_family: visual_contract.typography_tokens?.body_family }, 'Use explicit heading and body typography tokens.'));
  checks.push(check('balance','balance', ['contained','centered','editorial','full'].some((token) => String(layout.section_alignment || intent.alignment || '').includes(token)), { alignment: layout.section_alignment || intent.alignment }, 'Use a coherent contained alignment system.', 'warn'));
  checks.push(check('components','component_consistency', components.length >= 2, { component_specs: components.length }, 'Define shared component geometry instead of page-local styling.'));
  checks.push(check('cta','cta_prominence', components.some((item) => String(item.component).toLowerCase() === 'cta') || Boolean(intent.cta_style), { cta_style: intent.cta_style }, 'Define a consistent primary CTA style and prominence.'));
  checks.push(check('density','density', ['low','medium-low','medium'].includes(String(intent.section_density || 'medium-low')), { section_density: intent.section_density }, 'Reduce section density and visual noise for the premium direction.', 'warn'));
  checks.push({ id:'premium_impression', category:'premium_impression', status:'WARN', verified:false, evidence:null, repair_instruction:'Human or screenshot-based art-direction review is required for subjective premium impression.' });
  checks.push({ id:'visual_noise', category:'visual_noise', status:'WARN', verified:false, evidence:null, repair_instruction:'Rendered screenshot review is required to verify visual noise and repetition.' });
  const blocking = checks.filter((item) => item.status === 'BLOCK');
  const warnings = checks.filter((item) => item.status === 'WARN');
  return {
    schema:'riosystems.visual-quality-director.v1',
    status:blocking.length ? 'BLOCK' : warnings.some((item) => item.verified) ? 'WARN' : 'PASS',
    checks,
    blocking_issues:blocking,
    warnings,
    verified_categories:checks.filter((item) => item.verified).map((item) => item.category),
    unverified_categories:checks.filter((item) => !item.verified).map((item) => item.category),
    repair_instructions:[...blocking,...warnings].map((item) => item.repair_instruction).filter(Boolean),
    fake_metrics:false
  };
}

function hasPage(build, id) {
  return (build?.blueprint?.pages || build?.base_build?.blueprint?.pages || []).some((page) => page.id === id);
}

function homeContent(build) {
  return build?.content?.pages?.home || build?.base_build?.content?.pages?.home || {};
}

export function reviewCro({ build = {}, mission = {}, industry_pattern = {}, integration_plan = {} } = {}) {
  const home = homeContent(build);
  const checks = [
    check('value_prop','value_proposition_clarity', Boolean(home.headline || mission.brand_positioning), { headline: home.headline || null, positioning: mission.brand_positioning }, 'Add a specific value proposition to the home hero.'),
    check('cta_clarity','cta_clarity', Boolean(home.cta?.label || home.primary_cta || mission.conversion_goal), { cta: home.cta?.label || home.primary_cta || mission.conversion_goal }, 'Define one clear primary action.'),
    check('contact','contact_options', hasPage(build,'contact'), { contact_page: hasPage(build,'contact') }, 'Add a dedicated contact path.'),
    check('objections','objection_handling', hasPage(build,'faq'), { faq_page: hasPage(build,'faq') }, 'Add an FAQ or objection-handling section.'),
    check('trust','trust_signals', (industry_pattern.trust_patterns || []).length > 0, { recommended_trust_patterns: industry_pattern.trust_patterns || [] }, 'Add industry-appropriate trust patterns.'),
    check('lead_capture','lead_capture', (integration_plan.hooks || []).some((hook) => hook.hook_id === 'lead_capture'), { hook_present:(integration_plan.hooks || []).some((hook) => hook.hook_id === 'lead_capture') }, 'Emit a standardized lead capture hook.'),
    check('ordering','section_ordering', (build?.blueprint?.pages || build?.base_build?.blueprint?.pages || []).length >= 5, { pages:(build?.blueprint?.pages || build?.base_build?.blueprint?.pages || []).length }, 'Ensure enough page depth for value, proof, objections and contact.')
  ];
  const blocking = checks.filter((item) => item.status === 'BLOCK');
  return {
    schema:'riosystems.web-cro-review.v1', status:blocking.length ? 'BLOCK' : 'PASS', checks,
    blocking_issues:blocking, warnings:[], repair_instructions:blocking.map((item) => item.repair_instruction),
    dark_patterns_allowed:false, verified_from_structured_build:true
  };
}

export function applyCroMissionRepairs(mission = {}, industryPattern = {}) {
  const requiredPages = [...new Set([...(mission.required_pages || []), ...(industryPattern.recommended_pages || []), 'contact', 'faq'])];
  const special = [...new Set([...(mission.special_requirements || []), ...(industryPattern.trust_patterns || []).map((item) => `trust:${item}`), 'cro:no-dark-patterns'])];
  const changed = JSON.stringify(requiredPages) !== JSON.stringify(mission.required_pages || []) || JSON.stringify(special) !== JSON.stringify(mission.special_requirements || []);
  return {
    mission:{ ...structuredClone(mission), required_pages:requiredPages, special_requirements:special },
    repair_history:changed ? [{ type:'cro_mission_repair', before_state:{ required_pages:mission.required_pages || [], special_requirements:mission.special_requirements || [] }, after_state:{ required_pages:requiredPages, special_requirements:special }, deterministic:true }] : []
  };
}
