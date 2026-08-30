const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildIdempotencyKey({ project_id, workflow_id, node_id, payload, namespace = 'automation-v1' } = {}) {
  const raw = `${clean(namespace, 80)}|${clean(project_id, 160)}|${clean(workflow_id, 240)}|${clean(node_id, 120)}|${stable(payload)}`;
  return `${clean(namespace, 80)}:${fnv1a(raw)}`;
}

export class InMemoryIdempotencyStore {
  #entries = new Map();

  claim(key, metadata = {}) {
    const id = clean(key, 300);
    if (!id) return { ok: false, error: 'IDEMPOTENCY_KEY_REQUIRED' };
    if (this.#entries.has(id)) return { ok: true, claimed: false, duplicate: true, existing: structuredClone(this.#entries.get(id)) };
    const entry = { key: id, status: 'CLAIMED', metadata: structuredClone(metadata ?? {}) };
    this.#entries.set(id, entry);
    return { ok: true, claimed: true, duplicate: false, entry: structuredClone(entry) };
  }

  complete(key, result = {}) {
    const id = clean(key, 300);
    const current = this.#entries.get(id);
    if (!current) return { ok: false, error: 'IDEMPOTENCY_CLAIM_NOT_FOUND' };
    const next = { ...current, status: 'COMPLETED', result: structuredClone(result ?? {}) };
    this.#entries.set(id, next);
    return { ok: true, entry: structuredClone(next) };
  }

  release(key) {
    return this.#entries.delete(clean(key, 300));
  }

  snapshot() {
    return [...this.#entries.values()].map((item) => structuredClone(item));
  }
}
