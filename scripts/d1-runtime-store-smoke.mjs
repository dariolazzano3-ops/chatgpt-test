import assert from 'node:assert/strict';
import { createD1RuntimeStore, evaluateD1StagingReadiness } from '../src/d1-runtime-store.js';

function createFakeD1() {
  const rows = new Map();
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (!sql.startsWith('SELECT revision')) throw new Error(`Unexpected first SQL: ${sql}`);
          const [scope, collection, id] = args;
          return rows.get(`${scope}:${collection}:${id}`) ?? null;
        },
        async all() {
          if (!sql.startsWith('SELECT record_id')) throw new Error(`Unexpected all SQL: ${sql}`);
          const [scope, collection] = args;
          const prefix = `${scope}:${collection}:`;
          return {
            results: [...rows.entries()]
              .filter(([key]) => key.startsWith(prefix))
              .map(([key, row]) => ({ record_id: key.slice(prefix.length), revision: row.revision, value_json: row.value_json }))
              .sort((a, b) => a.record_id.localeCompare(b.record_id))
          };
        },
        async run() {
          if (sql.startsWith('INSERT INTO')) {
            const [scope, collection, id, revision, valueJson, updatedAt] = args;
            const key = `${scope}:${collection}:${id}`;
            if (rows.has(key)) return { meta: { changes: 0 } };
            rows.set(key, { revision, value_json: valueJson, updated_at: updatedAt });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('UPDATE')) {
            const [nextRevision, valueJson, updatedAt, scope, collection, id, expectedRevision] = args;
            const key = `${scope}:${collection}:${id}`;
            const current = rows.get(key);
            if (!current || Number(current.revision) !== Number(expectedRevision)) return { meta: { changes: 0 } };
            rows.set(key, { revision: nextRevision, value_json: valueJson, updated_at: updatedAt });
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected run SQL: ${sql}`);
        }
      };
    }
  };
}

const db = createFakeD1();
const readonly = createD1RuntimeStore(db);
assert.equal(readonly.ok, true);
assert.equal(readonly.write_enabled, false);
const blockedWrite = await readonly.put('customer:project', 'projects', 'root', { ok: true });
assert.equal(blockedWrite.ok, false);
assert.equal(blockedWrite.error, 'D1_WRITES_DISABLED');

const store = createD1RuntimeStore(db, { write_enabled: true });
const first = await store.put('customer:project', 'projects', 'root', { name: 'Bäckerei Müller' }, { expected_revision: 0 });
assert.equal(first.ok, true);
assert.equal(first.revision, 1);

const read = await store.get('customer:project', 'projects', 'root');
assert.equal(read.revision, 1);
assert.equal(read.value.name, 'Bäckerei Müller');

const conflict = await store.put('customer:project', 'projects', 'root', { name: 'stale' }, { expected_revision: 0 });
assert.equal(conflict.ok, false);
assert.equal(conflict.error, 'STORE_REVISION_CONFLICT');

const second = await store.put('customer:project', 'projects', 'root', { name: 'Bäckerei Müller v2' }, { expected_revision: 1 });
assert.equal(second.ok, true);
assert.equal(second.revision, 2);

const listed = await store.list('customer:project', 'projects');
assert.equal(listed.length, 1);
assert.equal(listed[0].revision, 2);

const declared = evaluateD1StagingReadiness({ binding_present: true, migration_declared: true, migration_applied: false });
assert.equal(declared.ok, true);
assert.equal(declared.stage, 'D1_STAGING_CONTRACT_READY');
assert.equal(declared.migration_auto_apply, false);

const unauthorizedApply = evaluateD1StagingReadiness({ binding_present: true, migration_declared: true, migration_applied: true });
assert.equal(unauthorizedApply.ok, false);
assert.ok(unauthorizedApply.blockers.some((item) => item.code === 'D1_MIGRATION_WRITE_REQUIRES_APPROVAL'));

const production = evaluateD1StagingReadiness({ binding_present: true, migration_declared: true, production: true });
assert.equal(production.ok, false);
assert.ok(production.blockers.some((item) => item.code === 'PRODUCTION_NOT_AUTHORIZED'));

console.log('RIOSYSTEMS_D1_RUNTIME_STORE_OK');
