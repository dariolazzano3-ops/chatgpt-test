import assert from 'node:assert/strict';
import fs from 'node:fs';

const PATH = 'supabase/migrations/20260916175500_jarvis_program_approval_read_v1.sql';
const sql = fs.readFileSync(PATH, 'utf8');
const lower = sql.toLowerCase();

assert.match(lower, /create or replace function public\.jarvis_service_program_approval_read_v1\s*\(/);
assert.match(lower, /p_owner_id\s+uuid/);
assert.match(lower, /p_owner_ref\s+text/);
assert.match(lower, /p_program\s+text/);
assert.match(lower, /returns jsonb/);
assert.match(lower, /language sql/);
assert.match(lower, /security definer/);
assert.match(lower, /set search_path\s*=\s*pg_catalog/);
assert.match(lower, /owner_id\s*=\s*p_owner_id/);
assert.match(lower, /owner_ref\s*=\s*p_owner_ref/);
assert.match(lower, /action\s*=\s*'program_approval'/);
assert.match(lower, /result\s*->>\s*'program'/);
assert.match(lower, /program_approval_grant/);
assert.match(lower, /program_approval_revoke/);
assert.match(lower, /order by occurred_at desc/);
assert.match(lower, /limit 1/);
assert.match(lower, /revoke all on function public\.jarvis_service_program_approval_read_v1\(uuid, text, text\) from public, anon, authenticated/);
assert.match(lower, /grant execute on function public\.jarvis_service_program_approval_read_v1\(uuid, text, text\) to service_role/);
for (const forbidden of [
  /\binsert\s+into\b/, /\bupdate\s+\w+\s+set\b/, /\bdelete\s+from\b/, /\btruncate\b/,
  /\bdrop\s+(table|schema|database|role|policy)\b/, /\balter\s+(table|role|database|system)\b/,
  /\bcreate\s+table\b/, /\bcreate\s+role\b/, /\bgrant\s+all\b/
]) assert.doesNotMatch(lower, forbidden);
const executable = lower.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
assert.doesNotMatch(executable, /hamyren/);
assert.doesNotMatch(lower, /service_role_key|password|token\s*=/);
console.log('JARVIS Program Approval targeted read migration: PASS');
