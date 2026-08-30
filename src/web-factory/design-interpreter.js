import { validateVisualDesignContract } from './visual-design-contract.js';
import { translateInteractions } from './interaction-translation.js';

function normalizeSections(contract) {
  const byId = new Map(contract.sections.map((section, index) => [
    String(section.id || section.section_id || `section-${index + 1}`),
    {
      id: String(section.id || section.section_id || `section-${index + 1}`),
      type: String(section.type || 'generic'),
      order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
      layout: section.layout || {},
      visual_hierarchy: section.visual_hierarchy || {},
      image_treatment: section.image_treatment || null,
      notes: Array.isArray(section.notes) ? section.notes : []
    }
  ]));

  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function interpretVisualDesign(input = {}) {
  const validation = validateVisualDesignContract(input);
  if (!validation.ok) {
    return {
      ok: false,
      status: 'BLOCKED_DESIGN_CONTRACT',
      validation,
      structured_spec: null
    };
  }

  const contract = validation.contract;
  const interactions = translateInteractions(contract.interaction_specs, contract.animation_specs);
  const sections = normalizeSections(contract);

  const structured = {
    schema: 'riosystems.structured-design-spec.v1',
    design_id: contract.design_id,
    project_id: contract.project_id,
    source_provider: contract.source_provider,
    interpretation_method: 'provider-neutral-structured-contract',
    pages: contract.pages.map((page) => ({
      id: String(page.id),
      path: String(page.path || '/'),
      section_order: Array.isArray(page.sections) ? page.sections.map(String) : []
    })),
    sections,
    layout: {
      container_width: String(contract.layout_system.container_width || '72rem'),
      narrow_container_width: String(contract.layout_system.narrow_container_width || '48rem'),
      hero_min_height: String(contract.layout_system.hero_min_height || 'auto'),
      grid_columns: Number(contract.layout_system.grid_columns || 12),
      grid_gap: String(contract.layout_system.grid_gap || contract.spacing_tokens.grid_gap || '1.5rem'),
      section_alignment: String(contract.layout_system.section_alignment || 'contained'),
      navigation_behavior: String(contract.layout_system.navigation_behavior || 'sticky')
    },
    colors: { ...contract.color_tokens },
    typography: {
      body_family: String(contract.typography_tokens.body_family || "system-ui, sans-serif"),
      heading_family: String(contract.typography_tokens.heading_family || "system-ui, sans-serif"),
      heading_scale: contract.typography_tokens.heading_scale || {},
      body_scale: contract.typography_tokens.body_scale || {},
      line_height_body: Number(contract.typography_tokens.line_height_body || 1.65),
      line_height_heading: Number(contract.typography_tokens.line_height_heading || 1.05)
    },
    spacing: { ...contract.spacing_tokens },
    radius: { ...contract.radius_tokens },
    shadows: { ...contract.shadow_tokens },
    components: contract.component_specs.map((component) => ({
      component: String(component.component || component.id || 'Unknown'),
      geometry: component.geometry || {},
      variants: component.variants || {},
      responsive: component.responsive || {}
    })),
    responsive: contract.responsive_rules.map((rule) => ({
      id: String(rule.id || rule.breakpoint || 'rule'),
      breakpoint: Number(rule.breakpoint || 0),
      behavior: rule.behavior || {}
    })),
    interactions,
    asset_rights: validation.asset_rights,
    visual_references: contract.visual_references,
    implementation_notes: contract.implementation_notes,
    constraints: {
      raw_provider_html_allowed: false,
      proprietary_code_extraction_allowed: false,
      provider_runtime_dependency_required: interactions.provider_runtime_dependency_required,
      independent_reimplementation_required: true
    }
  };

  return { ok: true, status: 'INTERPRETED', validation, structured_spec: structured };
}
