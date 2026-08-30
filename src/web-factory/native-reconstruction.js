import { buildWebsiteProject } from './factory.js';
import { renderDesignCss } from './design-system.js';
import { runWebsiteQa } from './qa.js';
import { interpretVisualDesign } from './design-interpreter.js';
import { evaluateVisualFidelity } from './visual-fidelity.js';
import { createScreenshotComparisonJob } from './screenshot-comparison.js';
import { runVisualRepairLoop } from './visual-repair.js';
import { renderVisualDesignOverlay } from './visual-style.js';
import { selectWebBuildRoute } from './routing.js';
import { deriveFramerProviderStatus } from './framer-provider.js';

function systemFontSafe(family = '') {
  const first = String(family).split(',')[0].trim().replace(/^[\'\"]|[\'\"]$/g, '').toLowerCase();
  return ['system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'sans-serif', 'serif', 'monospace'].includes(first);
}

function fontRightsSafe(family, assetReport) {
  if (systemFontSafe(family)) return true;
  const name = String(family).split(',')[0].trim().replace(/^[\'\"]|[\'\"]$/g, '').toLowerCase();
  return assetReport.items.some((asset) =>
    asset.status === 'APPROVED'
    && String(asset.kind || '').toLowerCase() === 'font'
    && String(asset.font_family || '').toLowerCase() === name
  );
}

function designSystemFromSpec(base, spec) {
  const colors = { ...base.tokens.colors };
  for (const [key, value] of Object.entries(spec.colors || {})) {
    if (value != null && Object.prototype.hasOwnProperty.call(colors, key)) colors[key] = value;
  }

  return {
    ...base,
    schema: 'riosystems.web-design-system.v1',
    direction: `${base.direction} + structured visual specialist reconstruction`,
    tokens: {
      ...base.tokens,
      colors,
      typography: {
        ...base.tokens.typography,
        font_family_body: spec.typography.body_family,
        font_family_heading: spec.typography.heading_family,
        line_height_body: spec.typography.line_height_body,
        line_height_heading: spec.typography.line_height_heading,
        scale: { ...base.tokens.typography.scale, ...(spec.typography.heading_scale || {}) }
      },
      radius: {
        ...base.tokens.radius,
        md: spec.radius.card || base.tokens.radius.md,
        pill: spec.radius.button || base.tokens.radius.pill
      },
      shadows: {
        ...base.tokens.shadows,
        card: spec.shadows.card || base.tokens.shadows.card
      },
      containers: {
        ...base.tokens.containers,
        content: spec.layout.container_width,
        narrow: spec.layout.narrow_container_width
      }
    },
    visual_specialist_source: spec.source_provider,
    provider_runtime_dependency_required: false
  };
}

function componentImplementation(spec) {
  return (spec.components || []).map((item) => ({
    component: item.component,
    geometry: structuredClone(item.geometry || {}),
    variants: structuredClone(item.variants || {}),
    responsive: structuredClone(item.responsive || {}),
    emitted_as_owned_code: true
  }));
}

function implementationSnapshot(baseBuild, spec) {
  return {
    schema: 'riosystems.native-visual-implementation.v1',
    design_id: spec.design_id,
    project_id: spec.project_id,
    implementation_owner: 'riosystems',
    runtime: 'owned-html-css-js',
    provider_runtime_dependency: false,
    layout: structuredClone(spec.layout),
    colors: structuredClone(spec.colors),
    typography: structuredClone(spec.typography),
    spacing: structuredClone(spec.spacing),
    radius: structuredClone(spec.radius),
    shadows: structuredClone(spec.shadows),
    components: componentImplementation(spec),
    responsive: structuredClone(spec.responsive),
    pages: baseBuild.blueprint.pages.map((page) => ({
      id: page.id,
      path: page.path,
      section_order: [...page.sections]
    })),
    interactions: {
      schema: 'riosystems.native-interaction-implementation.v1',
      items: spec.interactions.items.map((item) => ({
        ...structuredClone(item),
        implementation_status: item.classification === 'native_reproducible'
          ? 'EMITTED_OWNED_CODE'
          : item.classification === 'approximation_possible'
            ? 'REQUIRES_EXPLICIT_APPROXIMATION_REVIEW'
            : item.classification === 'requires_specialist_runtime'
              ? 'NOT_EMITTED_SPECIALIST_RUNTIME_REQUIRED'
              : 'NOT_EMITTED_UNSUPPORTED'
      })),
      coverage: {
        requested: spec.interactions.coverage.requested,
        implemented_native: spec.interactions.coverage.native_reproducible,
        approximation_pending: spec.interactions.coverage.approximation_possible,
        specialist_runtime_required: spec.interactions.coverage.requires_specialist_runtime,
        unsupported: spec.interactions.coverage.unsupported
      }
    },
    generated_properties: [
      'layout', 'colors', 'typography', 'spacing', 'radius', 'shadows',
      'component_geometry', 'responsive_rules', 'section_order', 'interaction_translation'
    ]
  };
}

function enrichDelivery(baseManifest, route, fidelity, screenshotJob, interactionTranslation, assetRights, framerStatus, visualRepairHistory) {
  return {
    ...baseManifest,
    schema: 'riosystems.web-delivery-manifest.v1',
    visual_design: {
      design_provider: route.selected.design_provider,
      design_contract: 'riosystems.visual-design-contract.v1',
      structured_spec: 'riosystems.structured-design-spec.v1',
      implementation: 'riosystems.native-visual-implementation.v1',
      independent_reimplementation: true,
      provider_runtime_dependency: false
    },
    provider_route: route,
    cost_metadata: route.selected.cost_metadata,
    visual_fidelity: fidelity,
    screenshot_comparison: {
      job: screenshotJob,
      execution_status: fidelity.screenshot_status,
      pixel_comparison_executed: fidelity.pixel_comparison_executed
    },
    interaction_translation: interactionTranslation,
    design_deviations: interactionTranslation.deviations,
    asset_rights: assetRights,
    framer_provider_status: framerStatus,
    visual_repair_history: visualRepairHistory,
    hosting_policy: {
      preferred: 'cloudflare',
      framer_hosting_default: false,
      framer_hosting_requires_project_need_or_operator_approval: true
    },
    production_status: 'DISABLED',
    production_deploy: false
  };
}

export function reconstructPremiumWebsite(input = {}, options = {}) {
  const mission = input.mission || {};
  const interpretation = interpretVisualDesign(input.design_contract || {});
  if (!interpretation.ok) {
    return {
      ok: false,
      status: 'BLOCKED_DESIGN_CONTRACT',
      interpretation,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  const spec = interpretation.structured_spec;
  if (!fontRightsSafe(spec.typography.body_family, spec.asset_rights) || !fontRightsSafe(spec.typography.heading_family, spec.asset_rights)) {
    return {
      ok: false,
      status: 'BLOCKED_FONT_RIGHTS',
      blocking_issue: 'A non-system font requires an APPROVED font asset with matching font_family rights metadata.',
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  const route = selectWebBuildRoute({
    ...(input.routing_context || {}),
    premium_visual: true,
    quality_level: options.fidelity_level || input.routing_context?.quality_level || 'PREMIUM',
    synthetic_test_data_only: mission.synthetic_test_data_only === true,
    environment: 'staging'
  });

  if (!['framer-design-native-cloudflare', 'native-premium-cloudflare'].includes(route.selected.route_id)) {
    return {
      ok: false,
      status: 'PREMIUM_RECONSTRUCTION_ROUTE_NOT_SELECTED',
      route,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  const base = buildWebsiteProject(mission, options);
  if (!base.ok) return { ...base, route };

  const designSystem = designSystemFromSpec(base.design_system, spec);
  const artifact = { ...base.artifact, files: { ...base.artifact.files }, design_system: designSystem };
  const stylesFile = `${artifact.project_root}/assets/styles.css`;
  artifact.files[stylesFile] = `${renderDesignCss(designSystem)}\n${renderVisualDesignOverlay(spec)}`;
  artifact.files[`${artifact.project_root}/design-tokens.json`] = JSON.stringify(designSystem, null, 2);

  const implementation = implementationSnapshot(base, spec);
  artifact.files[`${artifact.project_root}/structured-design-spec.json`] = JSON.stringify(spec, null, 2);
  artifact.files[`${artifact.project_root}/visual-implementation.json`] = JSON.stringify(implementation, null, 2);
  artifact.files[`${artifact.project_root}/interaction-translation.json`] = JSON.stringify(spec.interactions, null, 2);
  artifact.files[`${artifact.project_root}/asset-rights-report.json`] = JSON.stringify(spec.asset_rights, null, 2);
  artifact.files[`${artifact.project_root}/provider-route.json`] = JSON.stringify(route, null, 2);

  const screenshotJob = createScreenshotComparisonJob({
    design_id: spec.design_id,
    project_id: spec.project_id,
    reference_source: spec.visual_references,
    generated_source: { project_root: artifact.project_root }
  });
  const screenshotReport = options.screenshot_report || {
    schema: 'riosystems.screenshot-comparison-report.v1',
    status: 'NOT_EXECUTED_RUNTIME_UNAVAILABLE',
    executed: false,
    pixel_comparison_claimed: false,
    metrics: null,
    differences: []
  };

  const initialFidelity = evaluateVisualFidelity(spec, implementation, {
    level: options.fidelity_level || 'PREMIUM',
    screenshot_report: screenshotReport
  });

  const repair = runVisualRepairLoop(
    { artifact, implementation },
    spec,
    {
      max_attempts: options.max_visual_repair_attempts ?? 3,
      level: options.fidelity_level || 'PREMIUM',
      screenshot_report: screenshotReport
    }
  );
  const finalArtifact = repair.artifact;
  const finalImplementation = repair.implementation;
  const fidelity = repair.fidelity_report;
  const websiteQa = runWebsiteQa(finalArtifact);
  const framerStatus = deriveFramerProviderStatus(input.framer_status || {});

  const delivery = enrichDelivery(
    base.delivery_manifest,
    route,
    fidelity,
    screenshotJob,
    spec.interactions,
    spec.asset_rights,
    framerStatus,
    repair.repair_history
  );

  finalArtifact.design_system = designSystem;
  finalArtifact.qa_result = websiteQa;
  finalArtifact.visual_implementation = finalImplementation;
  finalArtifact.visual_fidelity = fidelity;
  finalArtifact.delivery_manifest = delivery;
  finalArtifact.files[`${finalArtifact.project_root}/visual-fidelity-report.json`] = JSON.stringify(fidelity, null, 2);
  finalArtifact.files[`${finalArtifact.project_root}/screenshot-comparison-job.json`] = JSON.stringify(screenshotJob, null, 2);
  finalArtifact.files[`${finalArtifact.project_root}/visual-repair-history.json`] = JSON.stringify(repair.repair_history, null, 2);
  finalArtifact.files[`${finalArtifact.project_root}/delivery-manifest.json`] = JSON.stringify(delivery, null, 2);

  const ok = websiteQa.status === 'PASS' && fidelity.status === 'PASS';
  return {
    ok,
    status: ok ? 'VERIFIED_PREMIUM_WEB_DELIVERABLE' : 'BLOCKED_BY_PREMIUM_QA',
    base_build: base,
    interpretation,
    route,
    design_system: designSystem,
    artifact: finalArtifact,
    website_qa: websiteQa,
    initial_fidelity: initialFidelity,
    visual_fidelity: fidelity,
    visual_repair_history: repair.repair_history,
    screenshot_comparison: {
      job: screenshotJob,
      report: screenshotReport
    },
    asset_rights: spec.asset_rights,
    interaction_translation: spec.interactions,
    delivery_manifest: delivery,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
