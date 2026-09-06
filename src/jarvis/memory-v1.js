const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];

export const JARVIS_MEMORY_NAMESPACE = 'jarvis.personal';

export const JARVIS_MEMORY_CATEGORIES = Object.freeze([
  'PERSONAL_FACTS',
  'PREFERENCES',
  'PEOPLE',
  'RELATIONSHIPS',
  'PROJECTS',
  'GOALS',
  'DECISIONS',
  'ROUTINES',
  'TASKS',
  'PLACES',
  'EVENTS',
  'DOCUMENT_CONTEXT',
  'CONVERSATION_MEMORY',
  'DEVICE_CONTEXT',
  'AUTOMATION_CONTEXT'
]);

export const JARVIS_MEMORY_STATES = Object.freeze([
  'CONFIRMED',
  'INFERRED',
  'TEMPORARY',
  'UNVERIFIED',
  'CONFLICTED',
  'HISTORICAL'
]);

const SENSITIVE_CATEGORIES = new Set(['HEALTH', 'FINANCE', 'LEGAL', 'AUTHENTICATION', 'PRIVATE_MESSAGES', 'LOCATION_HISTORY', 'FAMILY_INFORMATION']);
const CREDENTIAL_KEYS = /(password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|cookie|credential|secret)/i;
const CREDENTIAL_TEXT = /\b(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,})\b/i;

function canonicalSensitivity(value) {
  const v = clean(value, 40).toUpperCase();
  return ['PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED', 'SECRET', 'CREDENTIAL'].includes(v) ? v : 'INTERNAL';
}

function containsCredentials(value, key = '') {
  if (CREDENTIAL_KEYS.test(key)) return value !== undefined && value !== null && clean(value, 200).length > 0;
  if (typeof value === 'string') return CREDENTIAL_TEXT.test(value);
  if (Array.isArray(value)) return value.some((item) => containsCredentials(item));
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => containsCredentials(v, k));
  return false;
}

function tokenize(value) {
  return new Set(clean(value, 12000).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((part) => part.length > 2));
}

function relevance(query, entry) {
  const q = tokenize(query);
  const t = tokenize(`${entry.subject || ''} ${JSON.stringify(entry.value ?? '')} ${entry.category || ''}`);
  let score = 0;
  for (const token of q) if (t.has(token)) score += 1;
  if (entry.status === 'CONFIRMED') score += 2;
  if (entry.status === 'CURRENT') score += 1;
  if (entry.status === 'HISTORICAL') score -= 1;
  return score;
}

function makeMemoryId(input) {
  const raw = [input.category, input.subject, input.valid_from || input.created_at || 'current']
    .map((part) => clean(part, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join(':');
  return `jarvis:${raw || 'memory'}`;
}

export function normalizeJarvisMemoryEntryV1(input = {}, options = {}) {
  const category = clean(input.category, 80).toUpperCase();
  const status = clean(input.status, 40).toUpperCase() || 'UNVERIFIED';
  const subject = clean(input.subject, 240);
  const ownerRef = clean(input.owner_ref || options.owner_ref, 200);
  const namespace = clean(input.namespace, 120) || JARVIS_MEMORY_NAMESPACE;
  if (namespace !== JARVIS_MEMORY_NAMESPACE) return { ok: false, error: 'JARVIS_MEMORY_NAMESPACE_VIOLATION' };
  if (!ownerRef) return { ok: false, error: 'JARVIS_MEMORY_OWNER_REQUIRED' };
  if (!JARVIS_MEMORY_CATEGORIES.includes(category)) return { ok: false, error: 'JARVIS_MEMORY_CATEGORY_INVALID' };
  if (!JARVIS_MEMORY_STATES.includes(status)) return { ok: false, error: 'JARVIS_MEMORY_STATUS_INVALID' };
  if (!subject) return { ok: false, error: 'JARVIS_MEMORY_SUBJECT_REQUIRED' };
  if (containsCredentials(input.value) || containsCredentials(input.provenance) || containsCredentials(input.source)) {
    return { ok: false, error: 'JARVIS_MEMORY_CREDENTIAL_DATA_BLOCKED' };
  }
  const sourceSystem = clean(input.source_system || input.provenance?.system, 120).toLowerCase();
  if (sourceSystem === 'hamyren' || sourceSystem.startsWith('hamyren.')) {
    return { ok: false, error: 'JARVIS_HAMYREN_MEMORY_IMPORT_BLOCKED' };
  }

  const confidenceRaw = Number(input.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : (status === 'CONFIRMED' ? 1 : 0.5);
  const sensitivity = canonicalSensitivity(input.sensitivity);
  const createdAt = clean(input.created_at || options.now, 80) || null;
  const validFrom = clean(input.valid_from || createdAt, 80) || null;

  return {
    ok: true,
    entry: {
      schema: 'aurentara.jarvis.memory-entry.v1',
      namespace: JARVIS_MEMORY_NAMESPACE,
      memory_id: clean(input.memory_id, 260) || makeMemoryId({ ...input, category, subject, valid_from: validFrom, created_at: createdAt }),
      owner_ref: ownerRef,
      category,
      subject,
      value: structuredClone(input.value ?? null),
      source: structuredClone(input.source ?? null),
      source_system: sourceSystem || null,
      confidence,
      created_at: createdAt,
      updated_at: clean(input.updated_at || createdAt, 80) || null,
      valid_from: validFrom,
      valid_until: clean(input.valid_until, 80) || null,
      status,
      sensitivity,
      provenance: structuredClone(input.provenance ?? {}),
      historical: status === 'HISTORICAL'
    }
  };
}

export function retrieveJarvisMemoryV1(entries = [], query = '', options = {}) {
  const ownerRef = clean(options.owner_ref, 200);
  const allowSensitive = options.allow_sensitive === true;
  const max = Math.max(1, Math.min(50, Number(options.max_items) || 20));
  const allowed = arr(entries)
    .filter((entry) => entry && entry.namespace === JARVIS_MEMORY_NAMESPACE)
    .filter((entry) => !ownerRef || entry.owner_ref === ownerRef)
    .filter((entry) => allowSensitive || !['SENSITIVE', 'RESTRICTED', 'SECRET', 'CREDENTIAL'].includes(clean(entry.sensitivity, 40).toUpperCase()))
    .filter((entry) => clean(entry.source_system, 120).toLowerCase() !== 'hamyren');

  const ranked = allowed
    .map((entry) => ({ ...structuredClone(entry), relevance_score: relevance(query, entry) }))
    .sort((a, b) => b.relevance_score - a.relevance_score || String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, max);

  return {
    ok: true,
    schema: 'aurentara.jarvis.memory-retrieval.v1',
    namespace: JARVIS_MEMORY_NAMESPACE,
    query: clean(query, 6000),
    owner_ref: ownerRef || null,
    items: ranked,
    count: ranked.length,
    sensitive_loaded: allowSensitive,
    hamyren_memory_loaded: false
  };
}

function isElevatedMemory(entry = {}) {
  if (['SENSITIVE', 'RESTRICTED', 'SECRET', 'CREDENTIAL'].includes(clean(entry.sensitivity, 40).toUpperCase())) return true;
  return SENSITIVE_CATEGORIES.has(clean(entry.domain, 80).toUpperCase());
}

export function evaluateJarvisMemoryWriteV1(candidate = {}, options = {}) {
  const normalized = normalizeJarvisMemoryEntryV1(candidate, options);
  if (!normalized.ok) return { ...normalized, accepted: false };

  const entry = normalized.entry;
  if (entry.sensitivity === 'CREDENTIAL' || entry.sensitivity === 'SECRET') {
    return { ok: false, accepted: false, error: 'JARVIS_MEMORY_SECRET_STORAGE_BLOCKED', entry };
  }
  if (options.allow_memory_writeback !== true) {
    return { ok: true, accepted: false, status: 'PROPOSED', approval_required: true, reason: 'MEMORY_WRITEBACK_NOT_ENABLED', entry };
  }
  if (isElevatedMemory(entry) && options.allow_sensitive_memory_writeback !== true) {
    return { ok: true, accepted: false, status: 'PROPOSED', approval_required: true, reason: 'SENSITIVE_MEMORY_REQUIRES_EXPLICIT_POLICY', entry };
  }
  if (entry.status === 'UNVERIFIED' || entry.status === 'CONFLICTED') {
    return { ok: true, accepted: false, status: 'PROPOSED', approval_required: true, reason: 'UNTRUSTED_MEMORY_REQUIRES_REVIEW', entry };
  }
  return { ok: true, accepted: true, status: 'ACCEPTED', approval_required: false, entry };
}

export function applyJarvisMemoryWritebackV1(existingEntries = [], candidates = [], options = {}) {
  const next = arr(existingEntries).map((entry) => structuredClone(entry));
  const accepted = [];
  const proposed = [];
  const rejected = [];

  for (const candidate of arr(candidates)) {
    const decision = evaluateJarvisMemoryWriteV1(candidate, options);
    if (!decision.ok) {
      rejected.push(decision);
      continue;
    }
    if (!decision.accepted) {
      proposed.push(decision);
      continue;
    }

    const entry = decision.entry;
    if (entry.status === 'CONFIRMED') {
      for (let i = 0; i < next.length; i += 1) {
        const prior = next[i];
        if (prior.namespace === JARVIS_MEMORY_NAMESPACE && prior.owner_ref === entry.owner_ref && prior.category === entry.category && prior.subject === entry.subject && prior.status === 'CONFIRMED' && prior.memory_id !== entry.memory_id) {
          next[i] = { ...prior, status: 'HISTORICAL', historical: true, valid_until: entry.valid_from || entry.updated_at || null };
        }
      }
    }
    const idx = next.findIndex((item) => item.memory_id === entry.memory_id && item.owner_ref === entry.owner_ref);
    if (idx >= 0) next[idx] = entry;
    else next.push(entry);
    accepted.push(decision);
  }

  return {
    ok: rejected.length === 0,
    schema: 'aurentara.jarvis.memory-writeback.v1',
    namespace: JARVIS_MEMORY_NAMESPACE,
    next_entries: next,
    accepted,
    proposed,
    rejected,
    hamyren_memory_write: false
  };
}

export function jarvisMemoryManifestV1() {
  return {
    schema: 'aurentara.jarvis.memory.v1',
    namespace: JARVIS_MEMORY_NAMESPACE,
    categories: [...JARVIS_MEMORY_CATEGORIES],
    states: [...JARVIS_MEMORY_STATES],
    temporal_versioning: true,
    credential_storage: false,
    hamyren_memory_access: false,
    hamyren_memory_write: false,
    automatic_hamyren_sync: false
  };
}
