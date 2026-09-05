const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const iso = (value) => clean(value, 80) || new Date().toISOString();

export const PROJECT_KNOWLEDGE_REVIEW_SECTIONS = Object.freeze([
  { id: 'COMPANY', label: 'Unternehmen' },
  { id: 'OFFERINGS', label: 'Angebot & Produkte' },
  { id: 'PRICING', label: 'Preise' },
  { id: 'CONTACT', label: 'Kontakt & Standort' },
  { id: 'OPENING_HOURS', label: 'Öffnungszeiten' },
  { id: 'BRAND', label: 'Marke & Gestaltung' },
  { id: 'VISUALS', label: 'Bilder & Medien' },
  { id: 'LEGAL', label: 'Rechtliches' },
  { id: 'OTHER', label: 'Weitere Informationen' }
]);

const SECTION_IDS = new Set(PROJECT_KNOWLEDGE_REVIEW_SECTIONS.map((item) => item.id));
const FACT_CONFIRMED = new Set(['OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED']);
const FACT_IGNORED = new Set(['REJECTED', 'OUTDATED']);

function validState(state = {}) {
  return state?.schema === 'aurentara.project-source-intake.v1'
    && clean(state.scope_key, 640)
    && clean(state.project_id, 320)
    && clean(state.customer_id, 320);
}

function sectionForFact(path = '') {
  const p = clean(path, 320).toLowerCase();
  if (/^(business\.(name|identity|industry|model)|company\.)/.test(p)) return 'COMPANY';
  if (/(price|pricing|preise)/.test(p)) return 'PRICING';
  if (/(opening_hours|opening\.hours|hours)/.test(p)) return 'OPENING_HOURS';
  if (/(phone|email|address|contact|location|region|service_area)/.test(p)) return 'CONTACT';
  if (/^(brand\.|visual\.)/.test(p)) return 'BRAND';
  if (/^(legal\.|business\.legal)/.test(p)) return 'LEGAL';
  if (/(product|service|offering|sortiment|menu|angebot)/.test(p)) return 'OFFERINGS';
  return 'OTHER';
}

function factLabel(path = '') {
  const map = {
    'business.name': 'Unternehmensname',
    'business.identity': 'Unternehmen',
    'business.products': 'Produkte',
    'business.offerings': 'Angebot',
    'business.services': 'Leistungen',
    'business.pricing': 'Preise',
    'business.opening_hours': 'Öffnungszeiten',
    'business.phone': 'Telefon',
    'business.email': 'E-Mail',
    'business.address': 'Adresse',
    'business.description': 'Beschreibung',
    'content.summary': 'Beschreibung',
    'website.primary_goal': 'Primäres Website-Ziel',
    'website.primary_conversion': 'Primäre Conversion',
    'brand.positioning': 'Markenpositionierung',
    'brand.tone': 'Tonalität',
    'legal.details': 'Rechtliche Angaben'
  };
  return map[clean(path, 320)] || clean(path, 320).replace(/[._]/g, ' ');
}

function sourceSection(source = {}) {
  if (source.source_type === 'IMAGE_VISUAL') return 'VISUALS';
  if (source.source_type === 'FILE_DOCUMENT') return 'OTHER';
  if (source.source_type === 'OWNED_WEBSITE' || source.source_type === 'REFERENCE_WEBSITE') return 'COMPANY';
  return 'OTHER';
}

function itemKey(type, id) {
  return `${type}:${id}`;
}

function deterministicItems(state = {}) {
  const items = [];
  for (const fact of state.facts || []) {
    if (FACT_IGNORED.has(fact.verification_status)) continue;
    items.push({
      type: 'FACT',
      id: fact.fact_id,
      section_id: sectionForFact(fact.field_path),
      label: factLabel(fact.field_path),
      field_path: fact.field_path,
      value: clone(fact.value),
      verification_status: fact.verification_status,
      source_refs: clone(fact.source_refs || []),
      critical: fact.critical === true,
      editable: true
    });
  }
  for (const source of state.sources || []) {
    if (source.deleted_at) continue;
    items.push({
      type: 'SOURCE',
      id: source.source_id,
      section_id: sourceSection(source),
      label: source.display_name || source.source_type,
      source_type: source.source_type,
      mime_type: source.mime_type || null,
      rights_status: source.ownership_status || null,
      storage_ref: source.storage_ref || null,
      editable: true
    });
  }
  for (const asset of state.assets || []) {
    items.push({
      type: 'ASSET',
      id: asset.asset_id,
      section_id: 'VISUALS',
      label: asset.usage_role || 'Projektbild',
      usage_role: asset.usage_role,
      source_id: asset.source_id || null,
      rights_status: asset.rights_status,
      publishable: asset.publishable === true,
      editable: true
    });
  }
  return items;
}

function normalizeSections(state = {}, proposed = null) {
  const items = deterministicItems(state);
  const byKey = new Map(items.map((item) => [itemKey(item.type, item.id), item]));
  const assigned = new Set();
  const sections = [];

  for (const raw of Array.isArray(proposed?.sections) ? proposed.sections : []) {
    const id = clean(raw.id, 80).toUpperCase();
    if (!SECTION_IDS.has(id)) continue;
    const refs = [];
    for (const ref of Array.isArray(raw.item_refs) ? raw.item_refs : []) {
      const type = clean(ref.type, 40).toUpperCase();
      const targetId = clean(ref.id, 240);
      const key = itemKey(type, targetId);
      if (!byKey.has(key) || assigned.has(key)) continue;
      const base = byKey.get(key);
      refs.push({ ...base, section_id: id });
      assigned.add(key);
    }
    if (refs.length) {
      sections.push({
        id,
        label: PROJECT_KNOWLEDGE_REVIEW_SECTIONS.find((item) => item.id === id)?.label || id,
        summary: clean(raw.summary, 700) || null,
        items: refs
      });
    }
  }

  for (const def of PROJECT_KNOWLEDGE_REVIEW_SECTIONS) {
    const remainder = items.filter((item) => !assigned.has(itemKey(item.type, item.id)) && item.section_id === def.id);
    if (!remainder.length) continue;
    const existing = sections.find((section) => section.id === def.id);
    if (existing) existing.items.push(...remainder);
    else sections.push({ id: def.id, label: def.label, summary: null, items: remainder });
    for (const item of remainder) assigned.add(itemKey(item.type, item.id));
  }

  const leftovers = items.filter((item) => !assigned.has(itemKey(item.type, item.id)));
  if (leftovers.length) {
    let other = sections.find((section) => section.id === 'OTHER');
    if (!other) {
      other = { id: 'OTHER', label: 'Weitere Informationen', summary: null, items: [] };
      sections.push(other);
    }
    other.items.push(...leftovers);
  }
  return sections;
}

export function buildDeterministicProjectKnowledgeStructure(state = {}) {
  if (!validState(state)) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_STATE_REQUIRED' };
  return {
    ok: true,
    schema: 'aurentara.project-knowledge-structure.v1',
    sections: normalizeSections(state),
    ai_used: false,
    source_count: (state.sources || []).filter((source) => !source.deleted_at).length,
    fact_count: (state.facts || []).filter((fact) => !FACT_IGNORED.has(fact.verification_status)).length,
    asset_count: (state.assets || []).length,
    production_deploy: false,
    external_writes: false
  };
}

export function knowledgeUseGate(state = {}) {
  const review = state?.knowledge_review;
  if (!review) return { allowed: true, status: 'LEGACY_NOT_GATED', legacy_compatible: true };
  const allowed = review.status === 'APPROVED' && review.gate_active !== true;
  return {
    allowed,
    status: review.status || 'COLLECTING',
    gate_active: review.gate_active === true,
    approved_knowledge_revision: review.approved_knowledge_revision || null,
    error: allowed ? null : 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED',
    legacy_compatible: false
  };
}

export function invalidateProjectKnowledgeApproval(review = null, event = 'PROJECT_KNOWLEDGE_CHANGED', at = null) {
  if (!review || review.status !== 'APPROVED') return review ? clone(review) : null;
  return {
    ...clone(review),
    status: 'CHANGES_PENDING',
    gate_active: true,
    invalidated_at: iso(at),
    invalidated_by_event: clean(event, 180) || 'PROJECT_KNOWLEDGE_CHANGED'
  };
}

function mutateReviewState(state, event, actor, at, knowledgeChange = true) {
  const next = clone(state);
  next.record_revision = Number(next.record_revision || 1) + 1;
  if (knowledgeChange) next.knowledge_revision = Number(next.knowledge_revision || 1) + 1;
  next.updated_at = iso(at);
  next.audit = [...(next.audit || []), {
    event,
    at: next.updated_at,
    actor: clean(actor, 240) || next.operator_id || null,
    scope_key: next.scope_key
  }];
  return next;
}

export function prepareProjectKnowledgeReview(state = {}, structure = {}, options = {}) {
  if (!validState(state)) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_STATE_REQUIRED' };
  const at = iso(options.at);
  const next = mutateReviewState(state, 'PROJECT_KNOWLEDGE_REVIEW_PREPARED', options.actor_id, at, true);
  const sections = normalizeSections(next, structure);
  next.knowledge_review = {
    schema: 'aurentara.project-knowledge-review.v1',
    status: 'IN_REVIEW',
    gate_active: true,
    prepared_at: at,
    prepared_by: clean(options.actor_id, 240) || state.operator_id || null,
    prepared_knowledge_revision: next.knowledge_revision,
    organization_source: structure.ai_used === true ? 'AI' : 'DETERMINISTIC',
    organizer_provider: clean(structure.provider, 160) || null,
    organizer_model: clean(structure.model, 160) || null,
    sections: clone(sections),
    notes: Array.isArray(structure.notes) ? structure.notes.map((note) => clean(note, 500)).filter(Boolean).slice(0, 12) : [],
    review_seen: false,
    approved_at: null,
    approved_by: null,
    approved_knowledge_revision: null,
    approval_invalidated_at: null
  };
  return { ok: true, state: next, review: clone(next.knowledge_review), changed: true, production_deploy: false, external_writes: false };
}

function moveReviewItem(review, type, id, targetSectionId) {
  const sectionId = clean(targetSectionId, 80).toUpperCase();
  if (!SECTION_IDS.has(sectionId)) return review;
  const next = clone(review);
  let found = null;
  for (const section of next.sections || []) {
    const index = (section.items || []).findIndex((item) => item.type === type && item.id === id);
    if (index >= 0) found = section.items.splice(index, 1)[0];
  }
  if (!found) return next;
  let target = (next.sections || []).find((section) => section.id === sectionId);
  if (!target) {
    const def = PROJECT_KNOWLEDGE_REVIEW_SECTIONS.find((item) => item.id === sectionId);
    target = { id: sectionId, label: def?.label || sectionId, summary: null, items: [] };
    next.sections.push(target);
  }
  target.items.push({ ...found, section_id: sectionId });
  next.sections = next.sections.filter((section) => (section.items || []).length > 0);
  return next;
}

export function editProjectKnowledgeReviewItem(state = {}, input = {}, options = {}) {
  if (!validState(state)) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_STATE_REQUIRED' };
  if (!state.knowledge_review || state.knowledge_review.status === 'APPROVED') return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_REOPEN_REQUIRED' };
  const type = clean(input.item_type, 40).toUpperCase();
  const targetId = clean(input.item_id, 240);
  if (!['FACT', 'SOURCE', 'ASSET'].includes(type) || !targetId) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_ITEM_REQUIRED' };
  const at = iso(options.at);
  const next = mutateReviewState(state, 'PROJECT_KNOWLEDGE_REVIEW_ITEM_EDITED', options.actor_id, at, true);
  let found = false;

  if (type === 'FACT') {
    next.facts = (next.facts || []).map((fact) => {
      if (fact.fact_id !== targetId) return fact;
      found = true;
      const fieldPath = clean(input.field_path, 320) || fact.field_path;
      const value = Object.prototype.hasOwnProperty.call(input, 'value') ? clone(input.value) : clone(fact.value);
      return {
        ...fact,
        field_path: fieldPath,
        value,
        verification_status: FACT_CONFIRMED.has(fact.verification_status) ? 'UNVERIFIED' : fact.verification_status,
        verified_by: null,
        verified_at: null,
        version: Number(fact.version || 1) + 1,
        review_edited_at: at,
        updated_at: at
      };
    });
  } else if (type === 'SOURCE') {
    next.sources = (next.sources || []).map((source) => {
      if (source.source_id !== targetId || source.deleted_at) return source;
      found = true;
      return { ...source, display_name: clean(input.display_name, 300) || source.display_name, review_edited_at: at, updated_at: at };
    });
  } else {
    next.assets = (next.assets || []).map((asset) => {
      if (asset.asset_id !== targetId) return asset;
      found = true;
      return { ...asset, usage_role: clean(input.usage_role, 120) || asset.usage_role, knowledge_approved: false, review_edited_at: at };
    });
  }
  if (!found) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_ITEM_NOT_FOUND' };

  next.knowledge_review = {
    ...clone(state.knowledge_review),
    status: 'IN_REVIEW',
    gate_active: true,
    last_edited_at: at,
    last_edited_by: clean(options.actor_id, 240) || state.operator_id || null
  };
  if (input.section_id) next.knowledge_review = moveReviewItem(next.knowledge_review, type, targetId, input.section_id);
  next.knowledge_review.sections = normalizeSections(next, next.knowledge_review);
  return { ok: true, state: next, review: clone(next.knowledge_review), changed: true, production_deploy: false, external_writes: false };
}

export function approveProjectKnowledgeReview(state = {}, input = {}, options = {}) {
  if (!validState(state)) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_STATE_REQUIRED' };
  if (!state.knowledge_review || !['IN_REVIEW', 'CHANGES_PENDING', 'COLLECTING'].includes(state.knowledge_review.status)) {
    return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_NOT_READY' };
  }
  if (input.review_seen !== true || input.approval_confirmed !== true) {
    return { ok: false, error: 'PROJECT_KNOWLEDGE_EXPLICIT_APPROVAL_REQUIRED' };
  }
  const conflicts = (state.facts || []).filter((fact) => fact.verification_status === 'SOURCE_CONFLICT');
  if (conflicts.length) {
    return { ok: false, error: 'PROJECT_KNOWLEDGE_CONFLICTS_MUST_BE_RESOLVED', conflict_fact_ids: conflicts.map((fact) => fact.fact_id) };
  }
  const at = iso(options.at);
  const actor = clean(options.actor_id, 240) || state.operator_id || 'operator';
  const next = mutateReviewState(state, 'PROJECT_KNOWLEDGE_APPROVED_FOR_USE', actor, at, true);
  next.facts = (next.facts || []).map((fact) => {
    if (FACT_IGNORED.has(fact.verification_status)) return fact;
    if (FACT_CONFIRMED.has(fact.verification_status)) return fact;
    return {
      ...fact,
      verification_status: 'OPERATOR_CONFIRMED',
      verified_by: actor,
      verified_at: at,
      version: Number(fact.version || 1) + 1,
      updated_at: at
    };
  });
  next.sources = (next.sources || []).map((source) => source.deleted_at ? source : { ...source, knowledge_approved: true, knowledge_approved_at: at });
  next.assets = (next.assets || []).map((asset) => ({ ...asset, knowledge_approved: true, knowledge_approved_at: at }));
  next.knowledge_review = {
    ...clone(state.knowledge_review),
    status: 'APPROVED',
    gate_active: false,
    review_seen: true,
    approved_at: at,
    approved_by: actor,
    approved_knowledge_revision: next.knowledge_revision,
    approval_invalidated_at: null,
    invalidated_at: null,
    invalidated_by_event: null
  };
  next.knowledge_review.sections = normalizeSections(next, next.knowledge_review);
  return {
    ok: true,
    state: next,
    review: clone(next.knowledge_review),
    approved_fact_count: next.facts.filter((fact) => FACT_CONFIRMED.has(fact.verification_status)).length,
    approved_asset_count: next.assets.filter((asset) => asset.knowledge_approved === true).length,
    changed: true,
    production_deploy: false,
    external_writes: false
  };
}

export function reopenProjectKnowledgeReview(state = {}, options = {}) {
  if (!validState(state)) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_STATE_REQUIRED' };
  if (!state.knowledge_review) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_NOT_STARTED' };
  const at = iso(options.at);
  const next = mutateReviewState(state, 'PROJECT_KNOWLEDGE_REVIEW_REOPENED', options.actor_id, at, false);
  next.knowledge_review = {
    ...clone(state.knowledge_review),
    status: 'IN_REVIEW',
    gate_active: true,
    reopened_at: at,
    reopened_by: clean(options.actor_id, 240) || state.operator_id || null
  };
  return { ok: true, state: next, review: clone(next.knowledge_review), changed: true, production_deploy: false, external_writes: false };
}

export function buildProjectKnowledgeReviewView(state = {}) {
  if (!validState(state)) return { ok: false, error: 'PROJECT_KNOWLEDGE_REVIEW_STATE_REQUIRED' };
  const deterministic = buildDeterministicProjectKnowledgeStructure(state);
  const review = state.knowledge_review ? clone(state.knowledge_review) : null;
  const sections = review?.sections?.length ? normalizeSections(state, review) : deterministic.sections;
  const gate = knowledgeUseGate(state);
  return {
    ok: true,
    schema: 'aurentara.project-knowledge-review-view.v1',
    status: review?.status || 'NOT_STARTED',
    gate,
    stages: [
      { id: 'COLLECT', label: '1. Wäschekorb', complete: (state.sources || []).some((source) => !source.deleted_at) },
      { id: 'ORGANIZE', label: '2. KI sortiert', complete: Boolean(review?.prepared_at) },
      { id: 'REVIEW', label: '3. Prüfen & bearbeiten', complete: review?.status === 'APPROVED' || review?.review_seen === true },
      { id: 'APPROVE', label: '4. Für Nutzung freigeben', complete: review?.status === 'APPROVED' }
    ],
    sections,
    source_count: deterministic.source_count,
    fact_count: deterministic.fact_count,
    asset_count: deterministic.asset_count,
    organized_by: review?.organization_source || null,
    organizer_provider: review?.organizer_provider || null,
    organizer_model: review?.organizer_model || null,
    approved_at: review?.approved_at || null,
    approved_by: review?.approved_by || null,
    approved_knowledge_revision: review?.approved_knowledge_revision || null,
    production_deploy: false,
    external_writes: false
  };
}

export function projectKnowledgeReviewManifest() {
  return {
    schema: 'aurentara.project-knowledge-review.v1',
    flow: ['RAW_SOURCE_BASKET', 'AI_ORGANIZATION', 'HUMAN_EDITABLE_REVIEW', 'EXPLICIT_APPROVAL', 'FACTORY_USE'],
    project_scoped: true,
    hard_usage_gate_after_review_starts: true,
    changes_invalidate_approval: true,
    rights_remain_authoritative: true,
    creates_new_factory: false,
    creates_new_provider: false,
    production_deploy: false,
    external_writes: false
  };
}
