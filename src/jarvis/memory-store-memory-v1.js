const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export function createMemoryJarvisStoreV1(seed = []) {
  const memories = new Map();
  const audits = [];

  for (const item of Array.isArray(seed) ? seed : []) {
    if (!item?.owner_id || !item?.owner_ref || !item?.entry?.memory_id) continue;
    const key = clean(item.owner_id, 80) + '|' + clean(item.owner_ref, 320) + '|' + clean(item.entry.memory_id, 320);
    memories.set(key, clone(item.entry));
  }

  return {
    kind: 'memory-jarvis-store',
    durable: false,
    auth_mode: 'local_ephemeral',

    async loadMemory({ owner_id, owner_ref } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      return [...memories.entries()]
        .filter(([key]) => key.startsWith(ownerId + '|' + ownerRef + '|'))
        .map(([, value]) => clone(value));
    },

    async upsertMemory({ owner_id, owner_ref, entry } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      if (!ownerId || !ownerRef || !entry?.memory_id) throw new Error('JARVIS_MEMORY_STORE_SCOPE_REQUIRED');
      if (entry.owner_ref && entry.owner_ref !== ownerRef) throw new Error('JARVIS_MEMORY_OWNER_REF_MISMATCH');
      memories.set(ownerId + '|' + ownerRef + '|' + clean(entry.memory_id, 320), clone({ ...entry, owner_ref: ownerRef }));
      return { ok: true, entry: clone({ ...entry, owner_ref: ownerRef }) };
    },

    async appendAudit({ owner_id, owner_ref, event } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      if (!ownerId || !ownerRef) throw new Error('JARVIS_AUDIT_STORE_SCOPE_REQUIRED');
      audits.push({ owner_id: ownerId, owner_ref: ownerRef, event: clone(event) });
      return { ok: true, event_id: 'memory-audit-' + audits.length };
    },

    inspect() {
      return { memories: clone([...memories.values()]), audits: clone(audits) };
    }
  };
}
