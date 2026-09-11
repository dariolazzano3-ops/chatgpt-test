import assert from 'node:assert/strict';
import fs from 'node:fs';

/* Static, offline validation of the JARVIS audit-read migration.
   This NEVER connects to or mutates a database. */

const PATH = 'supabase/migrations/20260911090000_jarvis_audit_read_v1.sql';
const sql = fs.readFileSync(PATH, 'utf8');
const lower = sql.toLowerCase();

// ── the read RPC exists, is read-only, security-definer, bounded ──
assert.match(lower, /create or replace function public\.jarvis_service_audit_read_v1\s*\(/, 'read RPC defined');
assert.match(lower, /p_owner_id\s+uuid/, 'owner_id param');
assert.match(lower, /p_owner_ref\s+text/, 'owner_ref param');
assert.match(lower, /p_limit\s+integer/, 'limit param');
assert.match(lower, /security definer/, 'security definer');
assert.match(lower, /set search_path\s*=\s*pg_catalog/, 'pinned search_path');
assert.match(lower, /language sql/, 'plain sql body (no dynamic exec)');
assert.match(lower, /returns jsonb/, 'returns jsonb');

// ── bounded to <= 200 rows ──
assert.match(lower, /least\(\s*coalesce\(\s*p_limit\s*,\s*50\s*\)\s*,\s*200\s*\)/, 'limit clamped to <= 200');
assert.match(lower, /greatest\(\s*1\s*,/, 'limit clamped to >= 1');

// ── owner-scoped ──
assert.match(lower, /where\s+owner_id\s*=\s*p_owner_id/, 'owner_id filter');
assert.match(lower, /and\s+owner_ref\s*=\s*p_owner_ref/, 'owner_ref filter');
assert.match(lower, /order by\s+occurred_at\s+desc/, 'deterministic ordering');

// ── privilege hygiene ──
assert.match(lower, /revoke all on function public\.jarvis_service_audit_read_v1\(uuid, text, integer\) from public, anon, authenticated/, 'revoked from public/anon/authenticated');
assert.match(lower, /grant execute on function public\.jarvis_service_audit_read_v1\(uuid, text, integer\) to service_role/, 'granted to service_role only');

// ── NO write / destructive statements anywhere in the file ──
for (const forbidden of [
  /\binsert\s+into\b/, /\bupdate\s+\w+\s+set\b/, /\bdelete\s+from\b/, /\bdrop\s+(table|function|schema|database|role|policy)\b/,
  /\btruncate\b/, /\balter\s+(table|role|database|system)\b/, /\bcreate\s+table\b/, /\bgrant\s+all\b/,
  /\bcreate\s+role\b/, /\bcopy\b/, /pg_read_server_files|pg_write_server_files|lo_import|lo_export/
]) {
  assert.doesNotMatch(lower, forbidden, `migration must not contain a write/destructive statement: ${forbidden}`);
}
// the only mutation-shaped keyword allowed: grant execute / revoke on the one function
const grants = (lower.match(/\bgrant\b/g) || []).length;
assert.ok(grants <= 1, 'at most one GRANT (execute on the read function)');

// ── no secrets; no HAMYREN reference in executable SQL (comments may say "no hamyren") ──
assert.doesNotMatch(lower, /password|service_role_key|['"][a-z0-9_-]{20,}['"]|token\s*=/);
const executableLines = lower.split('\n').filter((l) => !l.trim().startsWith('--'));
assert.ok(!executableLines.some((l) => l.includes('hamyren')), 'no HAMYREN reference in executable SQL');

console.log('JARVIS Supabase audit-read migration static validation: PASS (read-only, security-definer, <=200 rows, service_role only)');
