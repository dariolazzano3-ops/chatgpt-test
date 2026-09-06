const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];

function tokenize(value) {
  return new Set(clean(value, 12000).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((part) => part.length > 2));
}

function score(query, item) {
  const q = tokenize(query);
  const t = tokenize(typeof item === 'string' ? item : JSON.stringify(item ?? ''));
  let n = 0;
  for (const token of q) if (t.has(token)) n += 1;
  return n;
}

function sensitivityAllowed(item = {}, allowSensitive = false) {
  if (allowSensitive) return true;
  return !['sensitive', 'restricted', 'secret', 'credential'].includes(clean(item.sensitivity, 40).toLowerCase());
}

function ranked(query, items, max) {
  return arr(items)
    .map((item) => ({ item, relevance_score: score(query, item) }))
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, max)
    .map(({ item, relevance_score }) => ({ ...structuredClone(item), relevance_score }));
}

export function buildJarvisContextV1(input = {}, options = {}) {
  const query = clean(input.query || input.message, 6000);
  const allowSensitive = options.allow_sensitive_context === true;
  const facts = ranked(query, arr(input.personal_facts).filter((item) => sensitivityAllowed(item, allowSensitive)), 20);
  const preferences = ranked(query, arr(input.preferences).filter((item) => sensitivityAllowed(item, allowSensitive)), 12);
  const routines = ranked(query, arr(input.routines).filter((item) => sensitivityAllowed(item, allowSensitive)), 12);
  const goals = ranked(query, arr(input.goals).filter((item) => sensitivityAllowed(item, allowSensitive)), 10);
  const commitments = ranked(query, arr(input.commitments).filter((item) => sensitivityAllowed(item, allowSensitive)), 12);
  const projects = ranked(query, arr(input.projects).filter((item) => sensitivityAllowed(item, allowSensitive)), 12);

  return {
    schema: 'aurentara.jarvis.context.v1',
    namespace: 'jarvis.personal',
    owner_ref: clean(input.owner_ref, 200) || null,
    query,
    now: clean(input.now, 80) || null,
    location: input.location ? structuredClone(input.location) : null,
    personal_facts: facts,
    preferences,
    routines,
    goals,
    commitments,
    projects,
    transient_context: structuredClone(input.transient_context || {}),
    isolation: {
      hamyren_data_loaded: false,
      hamyren_memory_access: false,
      hamyren_memory_write: false,
      shared_memory: false
    }
  };
}
