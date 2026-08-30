const CLASS_BY_TYPE = new Map([
  ['scroll_reveal', 'approximation_possible'],
  ['hover_transition', 'native_reproducible'],
  ['sticky_section', 'native_reproducible'],
  ['accordion', 'native_reproducible'],
  ['mobile_navigation', 'native_reproducible'],
  ['parallax', 'approximation_possible'],
  ['spring_motion', 'approximation_possible'],
  ['cms_driven_interaction', 'requires_specialist_runtime'],
  ['framer_component_runtime', 'requires_specialist_runtime'],
  ['proprietary_motion', 'unsupported']
]);

export function classifyInteraction(spec = {}) {
  const type = String(spec.type || 'unknown');
  const classification = CLASS_BY_TYPE.get(type) || 'unsupported';
  return {
    interaction_id: String(spec.id || type),
    type,
    target: String(spec.target || 'unspecified'),
    classification,
    implementation: classification === 'native_reproducible'
      ? 'Implement with owned HTML/CSS/JS and reduced-motion fallback'
      : classification === 'approximation_possible'
        ? 'Implement a documented native approximation without provider runtime'
        : classification === 'requires_specialist_runtime'
          ? 'Do not silently reproduce; route or disclose runtime dependency'
          : 'Do not implement automatically',
    deviation_required: classification !== 'native_reproducible'
  };
}

export function translateInteractions(interactionSpecs = [], animationSpecs = []) {
  const translated = [...interactionSpecs, ...animationSpecs].map(classifyInteraction);
  const deviations = translated
    .filter((item) => item.deviation_required)
    .map(({ interaction_id, type, classification, implementation }) => ({ interaction_id, type, classification, implementation }));

  return {
    schema: 'riosystems.interaction-translation.v1',
    items: translated,
    coverage: {
      requested: translated.length,
      native_reproducible: translated.filter((item) => item.classification === 'native_reproducible').length,
      approximation_possible: translated.filter((item) => item.classification === 'approximation_possible').length,
      requires_specialist_runtime: translated.filter((item) => item.classification === 'requires_specialist_runtime').length,
      unsupported: translated.filter((item) => item.classification === 'unsupported').length
    },
    deviations,
    provider_runtime_dependency_required: translated.some((item) => item.classification === 'requires_specialist_runtime')
  };
}
