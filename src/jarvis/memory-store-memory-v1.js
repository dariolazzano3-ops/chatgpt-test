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
      const eventId = 'memory-audit-' + (audits.length + 1);
      const occurredAt = clean(event?.timestamp, 80) || new Date().toISOString();
      audits.push({ owner_id: ownerId, owner_ref: ownerRef, event_id: eventId, occurred_at: occurredAt, event: clone(event) });
      return { ok: true, event_id: eventId, occurred_at: occurredAt };
    },


    // Unbounded-by-noise targeted state lookup for one Program Approval.
    // Returns ONLY the latest GRANT/REVOKE row for this owner + program.
    async readProgramApproval({ owner_id, owner_ref, program } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      const programUpper = clean(program, 80).toUpperCase();
      if (!ownerId || !ownerRef || !programUpper) throw new Error('JARVIS_PROGRAM_APPROVAL_STORE_SCOPE_REQUIRED');
      const row = audits
        .filter((item) => item.owner_id === ownerId && item.owner_ref === ownerRef)
        .map((item) => ({ event_id: item.event_id, occurred_at: item.occurred_at, ...clone(item.event) }))
        .filter((item) => item.action === 'PROGRAM_APPROVAL'
          && clean(item?.result?.program, 80).toUpperCase() === programUpper
          && ['PROGRAM_APPROVAL_GRANT', 'PROGRAM_APPROVAL_REVOKE'].includes(item?.intent?.intent_type))
        .sort((a, b) => Date.parse(b.occurred_at || b.timestamp || 0) - Date.parse(a.occurred_at || a.timestamp || 0))[0] || null;
      return clone(row);
    },

    // Noise-proof targeted Program Progress reader. Returns only the latest
    // IMPLEMENTATION_MISSION audit row for each wave of one owner + program.
    async readProgramProgress({ owner_id, owner_ref, program } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      const programUpper = clean(program, 80).toUpperCase();
      if (!ownerId || !ownerRef || !programUpper) throw new Error('JARVIS_PROGRAM_PROGRESS_STORE_SCOPE_REQUIRED');
      const byWave = new Map();
      for (const item of audits) {
        if (item.owner_id !== ownerId || item.owner_ref !== ownerRef) continue;
        const row = { event_id: item.event_id, occurred_at: item.occurred_at, ...clone(item.event) };
        if (row.action !== 'IMPLEMENTATION_MISSION' || clean(row?.result?.program, 80).toUpperCase() !== programUpper) continue;
        const wave = Number(row?.result?.wave_index);
        if (!Number.isInteger(wave) || wave < 0 || wave > 63) continue;
        const prior = byWave.get(wave);
        if (!prior || Date.parse(row.occurred_at || row.timestamp || 0) >= Date.parse(prior.occurred_at || prior.timestamp || 0)) byWave.set(wave, row);
      }
      return [...byWave.values()]
        .sort((a, b) => Date.parse(b.occurred_at || b.timestamp || 0) - Date.parse(a.occurred_at || a.timestamp || 0))
        .map(clone);
    },

    // Bounded, owner-scoped, read-only audit reader (Wave 4).
    async readAudit({ owner_id, owner_ref, limit = 50 } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      if (!ownerId || !ownerRef) throw new Error('JARVIS_AUDIT_STORE_SCOPE_REQUIRED');
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
      return audits
        .filter((row) => row.owner_id === ownerId && row.owner_ref === ownerRef)
        .map((row) => ({ event_id: row.event_id, occurred_at: row.occurred_at, ...clone(row.event) }))
        .sort((a, b) => Date.parse(b.occurred_at || b.timestamp || 0) - Date.parse(a.occurred_at || a.timestamp || 0))
        .slice(0, safeLimit);
    },

    inspect() {
      return { memories: clone([...memories.values()]), audits: clone(audits) };
    }
  };
}
