const REQUIRED_FIELDS = [
  'design_id',
  'project_id',
  'pages',
  'sections',
  'layout_system',
  'color_tokens',
  'typography_tokens',
  'spacing_tokens',
  'radius_tokens',
  'shadow_tokens',
  'component_specs',
  'interaction_specs',
  'animation_specs',
  'responsive_rules',
  'asset_manifest',
  'visual_references',
  'implementation_notes'
];

const ALLOWED_LICENSE = new Set(['owned', 'licensed', 'public_domain', 'generated', 'unknown']);

function nonEmpty(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

export function validateAssetRights(assetManifest = []) {
  const items = array(assetManifest).map((asset, index) => {
    const licenseStatus = String(asset?.license_status || 'unknown');
    const allowedLicense = ALLOWED_LICENSE.has(licenseStatus);
    const explicitlyAllowed = asset?.allowed_for_reimplementation === true;
    const replacementRequired = asset?.replacement_required === true;
    const rightsKnown = allowedLicense && licenseStatus !== 'unknown';
    const safe = rightsKnown && explicitlyAllowed && !replacementRequired;

    return {
      index,
      asset_id: String(asset?.asset_id || `asset-${index + 1}`),
      source: String(asset?.source || 'unknown'),
      kind: String(asset?.kind || 'asset'),
      font_family: asset?.font_family ? String(asset.font_family) : null,
      license_status: allowedLicense ? licenseStatus : 'unknown',
      ownership: String(asset?.ownership || 'unknown'),
      allowed_for_reimplementation: explicitlyAllowed,
      replacement_required: !safe,
      status: safe ? 'APPROVED' : 'REPLACEMENT_REQUIRED',
      reason: safe
        ? 'Rights metadata permits independent reimplementation'
        : 'Rights are unknown, disallowed, or replacement is explicitly required'
    };
  });

  const blocking = items.filter((item) => item.status !== 'APPROVED');
  return {
    schema: 'riosystems.asset-rights-report.v1',
    status: blocking.length ? 'BLOCKED' : 'PASS',
    items,
    blocking_assets: blocking.map(({ asset_id, reason }) => ({ asset_id, reason })),
    fail_closed: blocking.length > 0,
    unlicensed_asset_reuse: false
  };
}

export function validateVisualDesignContract(input = {}) {
  const missing = REQUIRED_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(input, field));
  const issues = [];

  if (input.schema && input.schema !== 'riosystems.visual-design-contract.v1') {
    issues.push({ code: 'SCHEMA_UNSUPPORTED', field: 'schema' });
  }
  if (!nonEmpty(input.design_id)) issues.push({ code: 'DESIGN_ID_REQUIRED', field: 'design_id' });
  if (!nonEmpty(input.project_id)) issues.push({ code: 'PROJECT_ID_REQUIRED', field: 'project_id' });
  if (!array(input.pages).length) issues.push({ code: 'PAGES_REQUIRED', field: 'pages' });
  if (!array(input.sections).length) issues.push({ code: 'SECTIONS_REQUIRED', field: 'sections' });
  if (!input.layout_system || typeof input.layout_system !== 'object') issues.push({ code: 'LAYOUT_SYSTEM_REQUIRED', field: 'layout_system' });
  if (!input.color_tokens || typeof input.color_tokens !== 'object') issues.push({ code: 'COLOR_TOKENS_REQUIRED', field: 'color_tokens' });
  if (!input.typography_tokens || typeof input.typography_tokens !== 'object') issues.push({ code: 'TYPOGRAPHY_TOKENS_REQUIRED', field: 'typography_tokens' });
  if (!input.spacing_tokens || typeof input.spacing_tokens !== 'object') issues.push({ code: 'SPACING_TOKENS_REQUIRED', field: 'spacing_tokens' });
  if (!input.radius_tokens || typeof input.radius_tokens !== 'object') issues.push({ code: 'RADIUS_TOKENS_REQUIRED', field: 'radius_tokens' });
  if (!input.shadow_tokens || typeof input.shadow_tokens !== 'object') issues.push({ code: 'SHADOW_TOKENS_REQUIRED', field: 'shadow_tokens' });

  const rights = validateAssetRights(input.asset_manifest);
  if (rights.status !== 'PASS') {
    issues.push({ code: 'ASSET_RIGHTS_BLOCKED', field: 'asset_manifest', blocking_assets: rights.blocking_assets });
  }

  const contract = {
    schema: 'riosystems.visual-design-contract.v1',
    design_id: String(input.design_id || ''),
    project_id: String(input.project_id || ''),
    source_provider: String(input.source_provider || 'provider-neutral'),
    source_kind: String(input.source_kind || 'structured-design-handoff'),
    pages: array(input.pages),
    sections: array(input.sections),
    layout_system: input.layout_system || {},
    color_tokens: input.color_tokens || {},
    typography_tokens: input.typography_tokens || {},
    spacing_tokens: input.spacing_tokens || {},
    radius_tokens: input.radius_tokens || {},
    shadow_tokens: input.shadow_tokens || {},
    component_specs: array(input.component_specs),
    interaction_specs: array(input.interaction_specs),
    animation_specs: array(input.animation_specs),
    responsive_rules: array(input.responsive_rules),
    asset_manifest: array(input.asset_manifest),
    visual_references: array(input.visual_references),
    implementation_notes: array(input.implementation_notes),
    provider_runtime_dependency_required: false,
    raw_provider_html_allowed: false,
    proprietary_code_extraction_allowed: false
  };

  return {
    ok: missing.length === 0 && issues.length === 0,
    status: missing.length === 0 && issues.length === 0 ? 'VALID' : 'BLOCKED',
    missing_fields: missing,
    issues,
    asset_rights: rights,
    contract
  };
}

export function visualDesignContractManifest() {
  return {
    schema: 'riosystems.visual-design-contract-manifest.v1',
    contract_schema: 'riosystems.visual-design-contract.v1',
    required_fields: REQUIRED_FIELDS,
    provider_neutral: true,
    raw_provider_html_allowed: false,
    proprietary_code_extraction_allowed: false,
    asset_rights_fail_closed: true
  };
}
