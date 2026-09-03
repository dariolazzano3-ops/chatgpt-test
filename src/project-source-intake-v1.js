const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = (value) => clean(value, 80) || new Date().toISOString();

export const PROJECT_SOURCE_TYPES = Object.freeze(['OWNED_WEBSITE', 'REFERENCE_WEBSITE', 'FILE_DOCUMENT', 'IMAGE_VISUAL', 'MANUAL_INPUT']);
export const FACT_ORIGINS = Object.freeze(['MANUAL', 'EXTRACTED', 'INFERRED']);
export const FACT_VERIFICATION = Object.freeze(['UNVERIFIED', 'OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED', 'SOURCE_CONFLICT', 'OUTDATED', 'REJECTED']);
export const RIGHTS_STATUSES = Object.freeze(['OWNED_CONFIRMED', 'CUSTOMER_LICENSED', 'CUSTOMER_ASSERTED', 'PUBLIC_REFERENCE_ONLY', 'UNKNOWN', 'RESTRICTED', 'DO_NOT_PUBLISH']);
export const READINESS_STATUSES = Object.freeze(['READY', 'READY_WITH_WARNINGS', 'BLOCKED']);

const USABLE_FACT_STATES = new Set(['OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED']);
const PUBLISHABLE_RIGHTS = new Set(['OWNED_CONFIRMED', 'CUSTOMER_LICENSED', 'CUSTOMER_ASSERTED']);
const CRITICAL_PATH_PATTERNS = [
  /(^|\.)price(s|ing)?($|\.)/i,
  /(^|\.)business(_|\.)?name$/i,
  /(^|\.)(phone|email|address|opening(_|\.)?hours)($|\.)/i,
  /(^|\.)legal($|\.)/i,
  /(^|\.)offerings?($|\.)/i,
  /(^|\.)services?($|\.)/i,
  /(^|\.)products?($|\.)/i
];

function id(prefix = 'item') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function enumValue(value, allowed, fallback) {
  const normalized = clean(value, 80).toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizedValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => normalizedValue(item)).sort());
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return JSON.stringify(Object.fromEntries(keys.map((key) => [key, normalizedValue(value[key])])));
  }
  return clean(value).toLowerCase();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function scopeParts(scopeKey = '') {
  const scope = clean(scopeKey, 320);
  const index = scope.indexOf(':');
  return index > 0 ? { customer_id: scope.slice(0, index), project_id: scope.slice(index + 1) } : null;
}

export function validateProjectIdentity(input = {}) {
  const customerId = clean(input.customer_id, 160);
  const projectId = clean(input.project_id, 160);
  const scopeKey = clean(input.scope_key, 320);
  const operatorId = clean(input.operator_id, 160) || null;
  if (!customerId || !projectId || !scopeKey) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED' };
  const parsed = scopeParts(scopeKey);
  if (!parsed || parsed.customer_id !== customerId || parsed.project_id !== projectId) {
    return { ok: false, error: 'PROJECT_SCOPE_MISMATCH', customer_id: customerId, project_id: projectId, scope_key: scopeKey };
  }
  return { ok: true, project: { operator_id: operatorId, customer_id: customerId, project_id: projectId, scope_key: scopeKey } };
}

export function createProjectSourceIntakeState(input = {}) {
  const identity = validateProjectIdentity(input);
  if (!identity.ok) return identity;
  const at = iso(input.at);
  return {
    ok: true,
    state: {
      schema: 'aurentara.project-source-intake.v1',
      ...identity.project,
      knowledge_revision: 1,
      sources: [],
      facts: [],
      assets: [],
      content_packs: [],
      visual_packs: [],
      readiness_snapshots: [],
      created_at: at,
      updated_at: at,
      audit: [{ event: 'PROJECT_SOURCE_INTAKE_CREATED', at, actor: identity.project.operator_id }],
      safety: { production_deploy: false, external_writes: false, paid_provider_calls: 0, variable_cost_eur: 0 }
    },
    production_deploy: false
  };
}

function validState(state = {}) {
  const identity = validateProjectIdentity(state);
  return state?.schema === 'aurentara.project-source-intake.v1' && identity.ok && Number.isInteger(state.knowledge_revision) && state.knowledge_revision >= 1;
}

function assertScope(state, input = {}) {
  if (!validState(state)) return { ok: false, error: 'VALID_PROJECT_SOURCE_INTAKE_STATE_REQUIRED' };
  const candidate = {
    customer_id: clean(input.customer_id, 160) || state.customer_id,
    project_id: clean(input.project_id, 160) || state.project_id,
    scope_key: clean(input.scope_key, 320) || state.scope_key
  };
  const identity = validateProjectIdentity(candidate);
  if (!identity.ok || identity.project.scope_key !== state.scope_key) return { ok: false, error: 'PROJECT_SOURCE_CROSS_SCOPE_REJECTED' };
  return { ok: true };
}

function mutate(state, event, at, details = {}) {
  const next = clone(state);
  next.knowledge_revision += 1;
  next.updated_at = iso(at);
  next.audit = [...(next.audit || []), { event, at: next.updated_at, actor: next.operator_id || null, scope_key: next.scope_key, ...details }];
  return next;
}

function sourceRights(source = {}) {
  if (source.source_type === 'REFERENCE_WEBSITE') return 'PUBLIC_REFERENCE_ONLY';
  const ownership = enumValue(source.ownership_status, RIGHTS_STATUSES, 'UNKNOWN');
  return ownership;
}

export function registerProjectSource(state = {}, input = {}, options = {}) {
  const scope = assertScope(state, input);
  if (!scope.ok) return scope;
  const sourceType = enumValue(input.source_type, PROJECT_SOURCE_TYPES, null);
  if (!sourceType) return { ok: false, error: 'PROJECT_SOURCE_TYPE_INVALID' };
  const locator = clean(input.locator || input.storage_ref, 2000);
  if (!locator && sourceType !== 'MANUAL_INPUT') return { ok: false, error: 'PROJECT_SOURCE_LOCATOR_REQUIRED' };
  const contentHash = clean(input.content_hash, 240) || null;
  const existing = (state.sources || []).find((item) => !item.deleted_at && item.source_type === sourceType && clean(item.locator || item.storage_ref, 2000) === locator);
  if (existing && contentHash && existing.content_hash === contentHash) {
    return { ok: true, state: clone(state), source: clone(existing), changed: false, duplicate: true, production_deploy: false };
  }

  const at = iso(options.at || input.at);
  const next = mutate(state, existing ? 'PROJECT_SOURCE_VERSIONED' : 'PROJECT_SOURCE_REGISTERED', at, { source_id: existing?.source_id || input.source_id || null });
  const source = {
    source_id: clean(input.source_id, 200) || existing?.source_id || id('src'),
    customer_id: state.customer_id,
    project_id: state.project_id,
    scope_key: state.scope_key,
    source_type: sourceType,
    source_role: clean(input.source_role, 120) || (sourceType === 'REFERENCE_WEBSITE' ? 'VISUAL_REFERENCE' : 'PROJECT_SOURCE'),
    locator: locator || null,
    storage_ref: clean(input.storage_ref, 2000) || null,
    display_name: clean(input.display_name, 300) || locator || sourceType,
    mime_type: clean(input.mime_type, 160) || null,
    ownership_status: sourceType === 'REFERENCE_WEBSITE' ? 'PUBLIC_REFERENCE_ONLY' : enumValue(input.ownership_status, RIGHTS_STATUSES, 'UNKNOWN'),
    ingestion_status: clean(input.ingestion_status, 120) || 'REGISTERED',
    content_hash: contentHash,
    version: existing ? Number(existing.version || 1) + 1 : Math.max(1, Number(input.version || 1)),
    created_at: existing?.created_at || at,
    updated_at: at,
    deleted_at: null,
    previous_version: existing ? clone(existing) : null,
    usage_attestation: input.usage_attestation ? clone(input.usage_attestation) : existing?.usage_attestation || null
  };
  if (existing) next.sources = next.sources.map((item) => item === existing ? source : item);
  else next.sources.push(source);
  return { ok: true, state: next, source: clone(source), changed: true, duplicate: false, production_deploy: false };
}

export function deleteProjectSource(state = {}, sourceId, options = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const source = (state.sources || []).find((item) => item.source_id === clean(sourceId, 200) && !item.deleted_at);
  if (!source) return { ok: false, error: 'PROJECT_SOURCE_NOT_FOUND' };
  const at = iso(options.at);
  const next = mutate(state, 'PROJECT_SOURCE_DELETED', at, { source_id: source.source_id });
  next.sources = next.sources.map((item) => item.source_id === source.source_id ? { ...item, ingestion_status: 'DELETED', deleted_at: at, updated_at: at } : item);
  next.facts = next.facts.map((fact) => (fact.source_refs || []).includes(source.source_id) && !USABLE_FACT_STATES.has(fact.verification_status)
    ? { ...fact, verification_status: 'OUTDATED', version: Number(fact.version || 1) + 1 }
    : fact);
  return { ok: true, state: next, changed: true, production_deploy: false };
}

export function isCriticalProjectFact(fieldPath = '') {
  const field = clean(fieldPath, 320);
  return CRITICAL_PATH_PATTERNS.some((pattern) => pattern.test(field));
}

export function upsertProjectFact(state = {}, input = {}, options = {}) {
  const scope = assertScope(state, input);
  if (!scope.ok) return scope;
  const fieldPath = clean(input.field_path, 320);
  if (!fieldPath) return { ok: false, error: 'PROJECT_FACT_FIELD_PATH_REQUIRED' };
  if (input.value === undefined || input.value === null || clean(input.value, 1) === '' && typeof input.value === 'string') return { ok: false, error: 'PROJECT_FACT_VALUE_REQUIRED' };
  const origin = enumValue(input.origin, FACT_ORIGINS, 'EXTRACTED');
  const requestedVerification = enumValue(input.verification_status, FACT_VERIFICATION, 'UNVERIFIED');
  const sourceRefs = unique(Array.isArray(input.source_refs) ? input.source_refs.map((value) => clean(value, 200)) : []);
  for (const ref of sourceRefs) if (!(state.sources || []).some((source) => source.source_id === ref && !source.deleted_at)) return { ok: false, error: 'PROJECT_FACT_SOURCE_REF_INVALID', source_ref: ref };
  const normalized = normalizedValue(input.value);
  const activeSameField = (state.facts || []).filter((fact) => fact.field_path === fieldPath && !['REJECTED', 'OUTDATED'].includes(fact.verification_status));
  const same = activeSameField.find((fact) => normalizedValue(fact.value) === normalized);
  const at = iso(options.at || input.at);
  if (same) {
    const mergedRefs = unique([...(same.source_refs || []), ...sourceRefs]);
    if (JSON.stringify(mergedRefs) === JSON.stringify(same.source_refs || [])) return { ok: true, state: clone(state), fact: clone(same), changed: false, duplicate: true };
    const next = mutate(state, 'PROJECT_FACT_EVIDENCE_MERGED', at, { fact_id: same.fact_id, field_path: fieldPath });
    const merged = { ...same, source_refs: mergedRefs, version: Number(same.version || 1) + 1 };
    next.facts = next.facts.map((fact) => fact.fact_id === same.fact_id ? merged : fact);
    return { ok: true, state: next, fact: clone(merged), changed: true, duplicate: true };
  }

  const critical = input.critical === true || isCriticalProjectFact(fieldPath);
  const conflicts = activeSameField.filter((fact) => normalizedValue(fact.value) !== normalized);
  const fact = {
    fact_id: clean(input.fact_id, 200) || id('fact'),
    scope_key: state.scope_key,
    field_path: fieldPath,
    value_type: clean(input.value_type, 80) || (Array.isArray(input.value) ? 'array' : typeof input.value),
    value: clone(input.value),
    origin,
    verification_status: critical && conflicts.length ? 'SOURCE_CONFLICT' : requestedVerification,
    source_refs: sourceRefs,
    confidence: Number.isFinite(Number(input.confidence)) ? Math.max(0, Math.min(1, Number(input.confidence))) : null,
    verified_by: clean(input.verified_by, 200) || null,
    verified_at: clean(input.verified_at, 80) || null,
    version: Math.max(1, Number(input.version || 1)),
    critical,
    created_at: at,
    updated_at: at
  };
  const next = mutate(state, conflicts.length ? 'PROJECT_FACT_CONFLICT_DETECTED' : 'PROJECT_FACT_REGISTERED', at, { fact_id: fact.fact_id, field_path: fieldPath });
  if (critical && conflicts.length) {
    const conflictIds = new Set(conflicts.map((item) => item.fact_id));
    next.facts = next.facts.map((item) => conflictIds.has(item.fact_id) && !USABLE_FACT_STATES.has(item.verification_status)
      ? { ...item, verification_status: 'SOURCE_CONFLICT', version: Number(item.version || 1) + 1, updated_at: at }
      : item);
  }
  next.facts.push(fact);
  return { ok: true, state: next, fact: clone(fact), changed: true, conflict: conflicts.length > 0 };
}

export function reviewProjectFact(state = {}, factId, decision = {}, options = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const target = (state.facts || []).find((fact) => fact.fact_id === clean(factId, 200));
  if (!target) return { ok: false, error: 'PROJECT_FACT_NOT_FOUND' };
  const verification = enumValue(decision.verification_status || decision.status, FACT_VERIFICATION, null);
  if (!['OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED', 'REJECTED', 'OUTDATED'].includes(verification)) return { ok: false, error: 'PROJECT_FACT_REVIEW_STATUS_INVALID' };
  const at = iso(options.at || decision.at);
  const next = mutate(state, 'PROJECT_FACT_REVIEWED', at, { fact_id: target.fact_id, field_path: target.field_path });
  next.facts = next.facts.map((fact) => {
    if (fact.fact_id === target.fact_id) return { ...fact, verification_status: verification, verified_by: clean(decision.verified_by, 200) || state.operator_id || null, verified_at: verification === 'REJECTED' || verification === 'OUTDATED' ? null : at, version: Number(fact.version || 1) + 1, updated_at: at };
    if (USABLE_FACT_STATES.has(verification) && fact.field_path === target.field_path && normalizedValue(fact.value) !== normalizedValue(target.value) && fact.verification_status === 'SOURCE_CONFLICT') {
      return { ...fact, verification_status: 'REJECTED', version: Number(fact.version || 1) + 1, updated_at: at };
    }
    return fact;
  });
  return { ok: true, state: next, fact: clone(next.facts.find((fact) => fact.fact_id === target.fact_id)), changed: true };
}

export function confirmTrustedBaseline(state = {}, options = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const allowedOrigins = new Set(['EXTRACTED', 'MANUAL']);
  const conflictFields = new Set((state.facts || []).filter((fact) => fact.verification_status === 'SOURCE_CONFLICT').map((fact) => fact.field_path));
  const candidates = (state.facts || []).filter((fact) => fact.verification_status === 'UNVERIFIED' && allowedOrigins.has(fact.origin) && !fact.critical && !conflictFields.has(fact.field_path));
  if (!candidates.length) return { ok: true, state: clone(state), confirmed_count: 0, changed: false };
  const at = iso(options.at);
  const next = mutate(state, 'PROJECT_TRUSTED_BASELINE_CONFIRMED', at, { count: candidates.length });
  const ids = new Set(candidates.map((fact) => fact.fact_id));
  next.facts = next.facts.map((fact) => ids.has(fact.fact_id) ? { ...fact, verification_status: 'OPERATOR_CONFIRMED', verified_by: state.operator_id || 'operator', verified_at: at, version: Number(fact.version || 1) + 1, updated_at: at } : fact);
  return { ok: true, state: next, confirmed_count: candidates.length, changed: true };
}

function rightsFlags(rightsStatus, input = {}) {
  const rights = enumValue(rightsStatus, RIGHTS_STATUSES, 'UNKNOWN');
  const allowed = PUBLISHABLE_RIGHTS.has(rights);
  return {
    rights_status: rights,
    publishable: allowed && input.publishable !== false,
    editable: allowed && input.editable !== false,
    derivative_allowed: allowed && input.derivative_allowed !== false
  };
}

export function registerProjectAsset(state = {}, input = {}, options = {}) {
  const scope = assertScope(state, input);
  if (!scope.ok) return scope;
  const source = (state.sources || []).find((item) => item.source_id === clean(input.source_id, 200) && !item.deleted_at) || null;
  if (input.source_id && !source) return { ok: false, error: 'PROJECT_ASSET_SOURCE_NOT_FOUND' };
  const parent = (state.assets || []).find((item) => item.asset_id === clean(input.parent_asset_id, 200)) || null;
  if (input.parent_asset_id && !parent) return { ok: false, error: 'PROJECT_ASSET_PARENT_NOT_FOUND' };
  let status = enumValue(input.rights_status, RIGHTS_STATUSES, null) || (parent ? parent.rights_status : sourceRights(source || {}));
  if (source?.source_type === 'REFERENCE_WEBSITE' && !input.rights_status) status = 'PUBLIC_REFERENCE_ONLY';
  let flags = rightsFlags(status, input);
  if (parent) flags = { ...flags, publishable: flags.publishable && parent.publishable === true && parent.derivative_allowed === true, editable: flags.editable && parent.editable === true, derivative_allowed: flags.derivative_allowed && parent.derivative_allowed === true };
  if (['PUBLIC_REFERENCE_ONLY', 'UNKNOWN', 'RESTRICTED', 'DO_NOT_PUBLISH'].includes(flags.rights_status)) flags = { ...flags, publishable: false };
  const at = iso(options.at || input.at);
  const next = mutate(state, 'PROJECT_ASSET_REGISTERED', at, { source_id: source?.source_id || null });
  const asset = {
    asset_id: clean(input.asset_id, 200) || id('asset'),
    scope_key: state.scope_key,
    source_id: source?.source_id || null,
    storage_ref: clean(input.storage_ref, 2000) || null,
    original_url: clean(input.original_url, 2000) || null,
    mime_type: clean(input.mime_type, 160) || null,
    hash: clean(input.hash, 240) || null,
    dimensions: input.dimensions ? clone(input.dimensions) : null,
    usage_role: clean(input.usage_role, 120) || 'VISUAL_REFERENCE',
    ...flags,
    parent_asset_id: parent?.asset_id || null,
    transformation: input.transformation ? clone(input.transformation) : null,
    created_at: at
  };
  next.assets.push(asset);
  return { ok: true, state: next, asset: clone(asset), changed: true, production_deploy: false };
}

function usableFacts(state = {}) {
  const conflictFields = new Set((state.facts || []).filter((fact) => fact.verification_status === 'SOURCE_CONFLICT').map((fact) => fact.field_path));
  return (state.facts || []).filter((fact) => USABLE_FACT_STATES.has(fact.verification_status) && !conflictFields.has(fact.field_path));
}

function nextVersion(items = []) {
  return items.reduce((max, item) => Math.max(max, Number(item.version || 0)), 0) + 1;
}

export function createContentPack(state = {}, options = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const facts = usableFacts(state);
  const at = iso(options.at);
  const pack = {
    pack_id: clean(options.pack_id, 200) || id('content_pack'),
    schema: 'aurentara.project-content-pack.v1',
    scope_key: state.scope_key,
    version: nextVersion(state.content_packs),
    knowledge_revision: state.knowledge_revision,
    fact_refs: facts.map((fact) => ({ fact_id: fact.fact_id, version: fact.version, field_path: fact.field_path })),
    canonical_values: Object.fromEntries(facts.map((fact) => [fact.field_path, clone(fact.value)])),
    created_at: at,
    immutable: true
  };
  const next = mutate(state, 'PROJECT_CONTENT_PACK_CREATED', at, { pack_id: pack.pack_id, pack_version: pack.version });
  next.content_packs.push(pack);
  return { ok: true, state: next, pack: clone(pack), changed: true };
}

export function createVisualPack(state = {}, options = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const approved = (state.assets || []).filter((asset) => asset.publishable === true && PUBLISHABLE_RIGHTS.has(asset.rights_status));
  const references = (state.assets || []).filter((asset) => asset.usage_role === 'VISUAL_REFERENCE' || asset.rights_status === 'PUBLIC_REFERENCE_ONLY');
  const brandFacts = usableFacts(state).filter((fact) => fact.field_path.startsWith('brand.') || fact.field_path.startsWith('visual.'));
  const at = iso(options.at);
  const pack = {
    pack_id: clean(options.pack_id, 200) || id('visual_pack'),
    schema: 'aurentara.project-visual-pack.v1',
    scope_key: state.scope_key,
    version: nextVersion(state.visual_packs),
    knowledge_revision: state.knowledge_revision,
    approved_assets: approved.map((asset) => ({ asset_id: asset.asset_id, rights_status: asset.rights_status, publishable: true, usage_role: asset.usage_role, storage_ref: asset.storage_ref })),
    visual_references: references.map((asset) => ({ asset_id: asset.asset_id, rights_status: asset.rights_status, publishable: asset.publishable === true, usage_role: asset.usage_role, original_url: asset.original_url })),
    brand_information: Object.fromEntries(brandFacts.map((fact) => [fact.field_path, clone(fact.value)])),
    visual_constraints: clone(options.visual_constraints || []),
    created_at: at,
    immutable: true
  };
  const next = mutate(state, 'PROJECT_VISUAL_PACK_CREATED', at, { pack_id: pack.pack_id, pack_version: pack.version });
  next.visual_packs.push(pack);
  return { ok: true, state: next, pack: clone(pack), changed: true };
}

function factFor(state, paths = []) {
  const allowed = usableFacts(state);
  return allowed.find((fact) => paths.includes(fact.field_path)) || null;
}

export function evaluateContentReadiness(state = {}, input = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const blockers = [];
  const warnings = [];
  const unresolvedCritical = (state.facts || []).filter((fact) => fact.critical && fact.verification_status === 'SOURCE_CONFLICT');
  if (unresolvedCritical.length) blockers.push({ code: 'CRITICAL_CONTENT_CONFLICT', fields: unique(unresolvedCritical.map((fact) => fact.field_path)) });

  const requireFact = (code, paths) => { if (!factFor(state, paths)) blockers.push({ code, fields: paths }); };
  requireFact('BUSINESS_IDENTITY_REQUIRED', ['business.name', 'business.identity']);
  requireFact('OFFERINGS_REQUIRED', ['business.offerings', 'business.services', 'business.products']);
  requireFact('PRIMARY_WEBSITE_GOAL_REQUIRED', ['website.primary_goal']);
  if (!factFor(state, ['content.summary', 'content.existing', 'business.description']) && usableFacts(state).length < 4) blockers.push({ code: 'SUFFICIENT_CONTENT_BASIS_REQUIRED' });

  if (input.will_show_pricing === true) requireFact('PRICING_REQUIRED_FOR_RENDER', ['business.pricing', 'business.price', 'pricing']);
  if (input.will_show_opening_hours === true) requireFact('OPENING_HOURS_REQUIRED_FOR_RENDER', ['business.opening_hours', 'contact.opening_hours']);
  if (input.will_show_address === true) requireFact('ADDRESS_REQUIRED_FOR_RENDER', ['business.address', 'contact.address']);
  if (input.will_show_phone === true) requireFact('PHONE_REQUIRED_FOR_RENDER', ['business.phone', 'contact.phone']);
  if (input.will_show_email === true) requireFact('EMAIL_REQUIRED_FOR_RENDER', ['business.email', 'contact.email']);
  if (input.legal_required === true) requireFact('LEGAL_DETAILS_REQUIRED', ['business.legal', 'legal.details']);

  if (input.requires_assets === true) {
    const publishable = (state.assets || []).filter((asset) => asset.publishable === true && PUBLISHABLE_RIGHTS.has(asset.rights_status));
    if (!publishable.length) blockers.push({ code: 'PUBLISHABLE_ASSET_REQUIRED' });
  }
  const intended = new Set(Array.isArray(input.intended_asset_ids) ? input.intended_asset_ids.map((value) => clean(value, 200)) : []);
  for (const asset of (state.assets || []).filter((item) => intended.has(item.asset_id))) {
    if (!PUBLISHABLE_RIGHTS.has(asset.rights_status) || asset.publishable !== true) blockers.push({ code: 'ASSET_RIGHTS_BLOCKED', asset_id: asset.asset_id, rights_status: asset.rights_status });
  }
  if (!validateProjectIdentity(state).ok) blockers.push({ code: 'PROJECT_SCOPE_INVALID' });
  if (input.production_locked === false) blockers.push({ code: 'PRODUCTION_MUST_REMAIN_LOCKED' });

  const optional = ['social.links', 'testimonials', 'seo.secondary', 'gallery', 'company.story'];
  const optionalFound = optional.filter((path) => Boolean(factFor(state, [path])));
  if (optionalFound.length < optional.length) warnings.push({ code: 'OPTIONAL_CONTENT_INCOMPLETE', completed: optionalFound.length, total: optional.length });
  const noncriticalConflicts = (state.facts || []).filter((fact) => !fact.critical && fact.verification_status === 'SOURCE_CONFLICT');
  if (noncriticalConflicts.length) warnings.push({ code: 'NONCRITICAL_CONTENT_CONFLICT', fields: unique(noncriticalConflicts.map((fact) => fact.field_path)) });

  const status = blockers.length ? 'BLOCKED' : warnings.length ? 'READY_WITH_WARNINGS' : 'READY';
  return {
    ok: true,
    snapshot: {
      readiness_id: clean(input.readiness_id, 200) || id('readiness'),
      schema: 'aurentara.content-readiness.v1',
      scope_key: state.scope_key,
      status,
      knowledge_revision: state.knowledge_revision,
      blockers,
      warnings,
      optional_completion_pct: Math.round((optionalFound.length / optional.length) * 100),
      evaluated_at: iso(input.at),
      authoritative: true,
      ai_estimate_used: false,
      production_deploy: false
    }
  };
}

export function recordContentReadiness(state = {}, input = {}) {
  const evaluated = evaluateContentReadiness(state, input);
  if (!evaluated.ok) return evaluated;
  const at = evaluated.snapshot.evaluated_at;
  const next = mutate(state, 'PROJECT_CONTENT_READINESS_RECORDED', at, { readiness_id: evaluated.snapshot.readiness_id, status: evaluated.snapshot.status });
  next.readiness_snapshots.push(evaluated.snapshot);
  return { ok: true, state: next, snapshot: clone(evaluated.snapshot), changed: true };
}

export function buildProjectMissionContext(state = {}, input = {}) {
  const scope = assertScope(state);
  if (!scope.ok) return scope;
  const contentPack = input.content_pack || state.content_packs?.at(-1);
  const visualPack = input.visual_pack || state.visual_packs?.at(-1);
  const readiness = input.readiness || state.readiness_snapshots?.at(-1);
  if (!contentPack || !visualPack || !readiness) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_PACKS_REQUIRED' };
  if ([contentPack.scope_key, visualPack.scope_key, readiness.scope_key].some((value) => value !== state.scope_key)) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_SCOPE_MISMATCH' };
  return {
    ok: true,
    context: {
      schema: 'aurentara.project-mission-context.v1',
      project: { operator_id: state.operator_id || null, customer_id: state.customer_id, project_id: state.project_id, scope_key: state.scope_key },
      knowledge_revision: state.knowledge_revision,
      content_pack_ref: { pack_id: contentPack.pack_id, version: contentPack.version, knowledge_revision: contentPack.knowledge_revision },
      visual_pack_ref: { pack_id: visualPack.pack_id, version: visualPack.version, knowledge_revision: visualPack.knowledge_revision },
      readiness_ref: { readiness_id: readiness.readiness_id, status: readiness.status, knowledge_revision: readiness.knowledge_revision },
      verified_content: clone(contentPack.canonical_values || {}),
      visual_context: clone(visualPack.brand_information || {}),
      assets: clone(visualPack.approved_assets || []),
      constraints: clone(input.constraints || []),
      quality_contract: clone(input.quality_contract || { provenance_required: true, rights_enforced: true, critical_conflicts_blocked: true }),
      deployment_policy: clone(input.deployment_policy || { staging_only: true, production_deploy: false })
    },
    production_deploy: false
  };
}

export function projectSourceIntakeManifest() {
  return {
    schema: 'aurentara.project-source-intake.v1',
    version: '1.0',
    contracts: ['ProjectSource', 'ProjectFact', 'ProjectAsset', 'ContentPack', 'VisualPack', 'ContentReadinessSnapshot'],
    project_scope_enforced: true,
    deterministic_readiness: true,
    critical_conflicts_auto_resolved: false,
    reference_assets_publishable_by_default: false,
    binary_data_in_runtime_json: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
