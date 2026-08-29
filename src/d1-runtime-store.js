const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

function requireBinding(db) {
  return db && typeof db.prepare === 'function';
}

function keyParts(scope, collection, id) {
  return [clean(scope, 240), clean(collection, 80), clean(id, 160)];
}

export function createD1RuntimeStore(db, options = {}) {
  if (!requireBinding(db)) return { ok: false, error: 'D1_BINDING_REQUIRED', production_deploy: false };
  const table = clean(options.table || 'riosystems_runtime_store', 80);
  const writeEnabled = options.write_enabled === true;

  return {
    ok: true,
    schema: 'riosystems.runtime-store.d1.v1',
    table,
    write_enabled: writeEnabled,
    async get(scope, collection, id) {
      const [s, c, i] = keyParts(scope, collection, id);
      const row = await db.prepare(`SELECT revision, value_json FROM ${table} WHERE scope_key = ? AND collection_name = ? AND record_id = ?`).bind(s, c, i).first();
      if (!row) return null;
      return { revision: Number(row.revision || 0), value: JSON.parse(String(row.value_json || 'null')) };
    },
    async put(scope, collection, id, value, putOptions = {}) {
      if (!writeEnabled) return { ok: false, error: 'D1_WRITES_DISABLED', production_deploy: false };
      const [s, c, i] = keyParts(scope, collection, id);
      const current = await this.get(s, c, i);
      const revision = Number(current?.revision || 0);
      if (putOptions.expected_revision !== undefined && Number(putOptions.expected_revision) !== revision) {
        return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: Number(putOptions.expected_revision), actual_revision: revision, production_deploy: false };
      }
      const nextRevision = revision + 1;
      const payload = JSON.stringify(clone(value));
      const now = new Date().toISOString();
      if (revision === 0) {
        await db.prepare(`INSERT INTO ${table} (scope_key, collection_name, record_id, revision, value_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(s, c, i, nextRevision, payload, now).run();
      } else {
        const result = await db.prepare(`UPDATE ${table} SET revision = ?, value_json = ?, updated_at = ? WHERE scope_key = ? AND collection_name = ? AND record_id = ? AND revision = ?`).bind(nextRevision, payload, now, s, c, i, revision).run();
        const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
        if (changes < 1) return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: revision, actual_revision: null, production_deploy: false };
      }
      return { ok: true, revision: nextRevision, value: clone(value), production_deploy: false };
    },
    async list(scope, collection) {
      const [s, c] = keyParts(scope, collection, 'unused');
      const result = await db.prepare(`SELECT record_id, revision, value_json FROM ${table} WHERE scope_key = ? AND collection_name = ? ORDER BY record_id ASC`).bind(s, c).all();
      const rows = Array.isArray(result?.results) ? result.results : [];
      return rows.map((row) => ({ id: String(row.record_id), revision: Number(row.revision || 0), value: JSON.parse(String(row.value_json || 'null')) }));
    }
  };
}

export function evaluateD1StagingReadiness(input = {}) {
  const blockers = [];
  if (input.binding_present !== true) blockers.push({ code: 'D1_BINDING_NOT_PRESENT' });
  if (input.migration_declared !== true) blockers.push({ code: 'D1_MIGRATION_NOT_DECLARED' });
  if (input.migration_applied === true && input.external_write_approved !== true) blockers.push({ code: 'D1_MIGRATION_WRITE_REQUIRES_APPROVAL' });
  if (input.production === true || input.production_deploy === true) blockers.push({ code: 'PRODUCTION_NOT_AUTHORIZED' });
  return {
    ok: blockers.length === 0,
    stage: blockers.length ? 'WAITING_FOR_D1_STAGING_READINESS' : 'D1_STAGING_CONTRACT_READY',
    blockers,
    write_activation_requires_explicit_approval: true,
    migration_auto_apply: false,
    production_deploy: false
  };
}

export function d1RuntimeStoreManifest() {
  return {
    version: 'riosystems.runtime-store.d1.v1',
    compatible_with_runtime_store_contract: true,
    write_disabled_by_default: true,
    optimistic_revision_control: true,
    migration_auto_apply: false,
    production_deploy: false
  };
}
