import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL('../supabase/migrations/20260907004000_jarvis_personal_memory_v1.sql', import.meta.url),
  'utf8'
);

const required = [
  'create schema if not exists jarvis_private',
  "namespace text not null default 'jarvis.personal'",
  "check (namespace = 'jarvis.personal')",
  'alter table jarvis_private.personal_memory_v1 enable row level security',
  'alter table jarvis_private.personal_memory_v1 force row level security',
  'alter table jarvis_private.audit_events_v1 enable row level security',
  'alter table jarvis_private.audit_events_v1 force row level security',
  'using (owner_id = auth.uid())',
  'with check (',
  'jarvis_memory_no_hamyren_source_check',
  'hamyren_memory_access',
  'hamyren_memory_write'
];

for (const token of required) {
  assert.ok(sql.toLowerCase().includes(token.toLowerCase()), `missing persistence invariant: ${token}`);
}

assert.ok(!sql.includes("'SECRET'"), 'SECRET must not be a valid persisted sensitivity state');
assert.ok(!sql.includes("'CREDENTIAL'"), 'CREDENTIAL must not be a valid persisted sensitivity state');

const tableRefs = [...sql.matchAll(/references\s+([a-z0-9_.]+)/gi)].map((m) => m[1].toLowerCase());
assert.equal(
  tableRefs.some((ref) => ref.includes('hamyren')),
  false,
  'JARVIS persistence must not have foreign keys into HAMYREN'
);

assert.equal(
  /grant\s+.*\s+to\s+anon\b/i.test(sql),
  false,
  'anon must receive no JARVIS private-table grants'
);

assert.ok(
  /source_system\s+is\s+null[\s\S]*lower\(source_system\)\s*<>\s*'hamyren'/i.test(sql),
  'HAMYREN-origin memory must be blocked at persistence boundary'
);

console.log('JARVIS Personal Memory Persistence V1 smoke: PASS');
