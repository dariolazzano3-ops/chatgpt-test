import {
  createProjectSourceIntakeState,
  registerProjectSource,
  registerProjectAsset,
  upsertProjectFact,
  createContentPack,
  createVisualPack,
  recordContentReadiness
} from './project-source-intake-v1.js';
import { importProjectWebsiteSource } from './project-source-website-import-v1.js';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const SAFE_TEXT_MIME = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/json']);
const DEFERRED_PARSER_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function ensureState(state) {
  return state?.schema === 'aurentara.project-source-intake.v1' ? { ok: true } : { ok: false, error: 'PROJECT_SOURCE_WORKSPACE_STATE_REQUIRED' };
}

function extractedWebsiteFactInputs(imported = {}, sourceId = '') {
  const candidates = imported?.extracted_candidates || {};
  const rows = [];
  const addMany = (fieldPath, values, { critical = true } = {}) => {
    for (const value of Array.isArray(values) ? values : []) {
      if (value === null || value === undefined || String(value).trim() === '') continue;
      rows.push({ field_path: fieldPath, value, critical });
    }
  };
  const addArray = (fieldPath, values, { critical = true } = {}) => {
    const cleanValues = [...new Set((Array.isArray(values) ? values : []).filter((value) => value !== null && value !== undefined && String(value).trim() !== ''))];
    if (cleanValues.length) rows.push({ field_path: fieldPath, value: cleanValues, critical });
  };

  addMany('business.email', candidates.contacts?.emails);
  addMany('business.phone', candidates.contacts?.phones);
  addMany('business.opening_hours', candidates.opening_hours);
  addMany('business.address', candidates.addresses);
  addArray('business.products', candidates.services_products);
  addArray('business.pricing', candidates.prices);
  addArray('legal.source_links', candidates.legal_links);
  addArray('social.links', candidates.social_links, { critical: false });

  return rows.map((fact, index) => ({
    ...fact,
    fact_id: `${sourceId || 'website'}-extracted-${index + 1}`,
    origin: 'EXTRACTED',
    verification_status: 'UNVERIFIED',
    source_refs: sourceId ? [sourceId] : []
  }));
}

export function openProjectSourceWorkspace(project = {}) {
  const created = createProjectSourceIntakeState(project);
  if (!created.ok) return created;
  return {
    ...created,
    workspace: {
      schema: 'aurentara.project-source-workspace.v1',
      scope_key: created.state.scope_key,
      modes: ['WEBSITE_QUICK_IMPORT', 'FILE', 'IMAGE', 'MANUAL_INPUT'],
      binary_storage_policy: 'PRIVATE_STORAGE_REF_ONLY',
      variable_cost_eur: 0,
      production_deploy: false
    }
  };
}

export function intakeManualSource(state = {}, input = {}, options = {}) {
  const valid = ensureState(state); if (!valid.ok) return valid;
  const registered = registerProjectSource(state, {
    source_id: input.source_id,
    source_type: 'MANUAL_INPUT',
    locator: clean(input.locator || `manual://${state.scope_key}/${input.source_id || 'entry'}`),
    display_name: clean(input.display_name || 'Manual project input', 300),
    ownership_status: input.ownership_status || 'CUSTOMER_ASSERTED',
    ingestion_status: 'IMPORTED',
    content_hash: clean(input.content_hash, 240) || null
  }, options);
  if (!registered.ok) return registered;
  let next = registered.state;
  const facts = [];
  for (const fact of Array.isArray(input.facts) ? input.facts : []) {
    const added = upsertProjectFact(next, {
      ...fact,
      origin: fact.origin || 'MANUAL',
      source_refs: [...new Set([...(fact.source_refs || []), registered.source.source_id])]
    }, options);
    if (!added.ok) return added;
    next = added.state;
    facts.push(added.fact);
  }
  return { ok: true, state: next, source: registered.source, facts, variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };
}

export function intakeFileSource(state = {}, input = {}, options = {}) {
  const valid = ensureState(state); if (!valid.ok) return valid;
  const mime = clean(input.mime_type, 160).toLowerCase();
  const storageRef = clean(input.storage_ref, 2000);
  if (!storageRef) return { ok: false, error: 'PRIVATE_STORAGE_REF_REQUIRED' };
  if (/^(?:data:|https?:)/i.test(storageRef)) return { ok: false, error: 'FILE_STORAGE_REF_MUST_BE_PRIVATE_REFERENCE' };
  const parsedText = clean(input.extracted_text, 100_000);
  if (parsedText && !SAFE_TEXT_MIME.has(mime)) return { ok: false, error: 'UNVERIFIED_BINARY_PARSER_OUTPUT_REJECTED' };
  const parserStatus = SAFE_TEXT_MIME.has(mime) ? 'DETERMINISTIC_TEXT_SUPPORTED' : DEFERRED_PARSER_MIME.has(mime) ? 'PARSER_DEFERRED_V1' : 'METADATA_ONLY';
  const registered = registerProjectSource(state, {
    source_id: input.source_id,
    source_type: 'FILE_DOCUMENT',
    storage_ref: storageRef,
    locator: storageRef,
    display_name: clean(input.display_name || input.filename || 'Project file', 300),
    mime_type: mime || null,
    ownership_status: input.ownership_status || 'CUSTOMER_ASSERTED',
    ingestion_status: parsedText ? 'IMPORTED' : parserStatus,
    content_hash: clean(input.content_hash, 240) || null,
    usage_attestation: input.usage_attestation || null
  }, options);
  if (!registered.ok) return registered;
  return { ok: true, state: registered.state, source: registered.source, parser_status: parserStatus, extracted_text: parsedText || null, binary_in_runtime_json: false, variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };
}

export function intakeImageSource(state = {}, input = {}, options = {}) {
  const valid = ensureState(state); if (!valid.ok) return valid;
  const storageRef = clean(input.storage_ref, 2000);
  if (!storageRef) return { ok: false, error: 'PRIVATE_STORAGE_REF_REQUIRED' };
  if (/^(?:data:|https?:)/i.test(storageRef)) return { ok: false, error: 'IMAGE_STORAGE_REF_MUST_BE_PRIVATE_REFERENCE' };
  const source = registerProjectSource(state, {
    source_id: input.source_id,
    source_type: 'IMAGE_VISUAL',
    storage_ref: storageRef,
    locator: storageRef,
    display_name: clean(input.display_name || input.filename || 'Project image', 300),
    mime_type: clean(input.mime_type, 160) || 'application/octet-stream',
    ownership_status: input.ownership_status || 'UNKNOWN',
    ingestion_status: 'IMPORTED',
    content_hash: clean(input.content_hash, 240) || null,
    usage_attestation: input.usage_attestation || null
  }, options);
  if (!source.ok) return source;
  const asset = registerProjectAsset(source.state, {
    asset_id: input.asset_id,
    source_id: source.source.source_id,
    storage_ref: storageRef,
    mime_type: input.mime_type,
    hash: input.content_hash,
    dimensions: input.dimensions,
    usage_role: input.usage_role || 'VISUAL_REFERENCE',
    rights_status: input.rights_status || input.ownership_status,
    publishable: input.publishable
  }, options);
  if (!asset.ok) return asset;
  return { ok: true, state: asset.state, source: source.source, asset: asset.asset, binary_in_runtime_json: false, variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };
}

export async function intakeWebsiteSource(state = {}, input = {}, deps = {}, options = {}) {
  const valid = ensureState(state); if (!valid.ok) return valid;
  const imported = await importProjectWebsiteSource(input, deps);
  if (!imported.ok) return imported;
  const source = registerProjectSource(state, {
    source_id: input.source_id,
    source_type: input.reference_only === true ? 'REFERENCE_WEBSITE' : 'OWNED_WEBSITE',
    locator: imported.canonical_source_url || imported.source_url,
    display_name: clean(input.display_name || 'Existing website', 300),
    ownership_status: input.reference_only === true ? 'PUBLIC_REFERENCE_ONLY' : (input.ownership_status || 'CUSTOMER_ASSERTED'),
    ingestion_status: imported.import_status,
    content_hash: clean(input.content_hash, 240) || null,
    website_usage: input.website_usage && typeof input.website_usage === 'object'
      ? input.website_usage
      : (input.reference_only === true
        ? { content: false, structure_reference: false, design_reference: false }
        : { content: true, structure_reference: false, design_reference: false })
  }, options);
  if (!source.ok) return source;
  let next = source.state;
  const extractedFacts = [];
  if (input.record_extracted_facts === true) {
    for (const factInput of extractedWebsiteFactInputs(imported, source.source.source_id)) {
      const added = upsertProjectFact(next, factInput, options);
      if (!added.ok) return added;
      next = added.state;
      extractedFacts.push(added.fact);
    }
  }
  return {
    ok: true,
    state: next,
    source: source.source,
    import_result: imported,
    extracted_facts: extractedFacts,
    extracted_fact_count: extractedFacts.length,
    extracted_is_verified: false,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  };
}

export function buildWorkspacePacksAndReadiness(state = {}, readinessInput = {}, options = {}) {
  const content = createContentPack(state, { ...options, pack_id: options.content_pack_id });
  if (!content.ok) return content;
  const visual = createVisualPack(content.state, { ...options, pack_id: options.visual_pack_id, visual_constraints: options.visual_constraints || [] });
  if (!visual.ok) return visual;
  const readiness = recordContentReadiness(visual.state, { ...readinessInput, production_locked: true, readiness_id: options.readiness_id, at: options.at });
  if (!readiness.ok) return readiness;
  return { ok: true, state: readiness.state, content_pack: content.pack, visual_pack: visual.pack, readiness: readiness.snapshot, variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };
}

export function projectSourceWorkspaceManifest() {
  return {
    schema: 'aurentara.project-source-workspace.v1',
    extends_existing_operator_workspace: true,
    modes: ['WEBSITE_QUICK_IMPORT', 'FILE', 'IMAGE', 'MANUAL_INPUT'],
    binary_storage_policy: 'PRIVATE_STORAGE_REF_ONLY',
    binary_parser_scope: 'TEXT_NATIVE_ONLY_V1',
    new_storage_resource_required: false,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  };
}
