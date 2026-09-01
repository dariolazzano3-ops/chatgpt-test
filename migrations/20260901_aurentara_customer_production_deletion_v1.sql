-- AURENTARA Customer AI production deletion V1
-- Applied to dedicated Customer project pqmbtfzjcdnihovvppjr on 2026-09-01.

create extension if not exists pgcrypto with schema extensions;

create table if not exists aurentara_customer_ai.deletion_receipts (
  audit_id text primary key,
  tenant_fingerprint text not null,
  deleted_counts jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

alter table aurentara_customer_ai.deletion_receipts enable row level security;
revoke all on aurentara_customer_ai.deletion_receipts from anon, authenticated;
grant all privileges on aurentara_customer_ai.deletion_receipts to service_role;

create policy deletion_receipts_service_only on aurentara_customer_ai.deletion_receipts
  for all to service_role using (true) with check (true);

create or replace function aurentara_customer_ai.hard_delete_tenant(
  p_tenant_id text,
  p_audit_id text
) returns jsonb
language plpgsql
security definer
set search_path = aurentara_customer_ai, extensions, pg_temp
as $$
declare
  counts jsonb;
  deleted_tenant integer := 0;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'DELETION_TENANT_REQUIRED';
  end if;
  if p_audit_id is null or btrim(p_audit_id) = '' then
    raise exception 'DELETION_AUDIT_ID_REQUIRED';
  end if;
  if exists (select 1 from aurentara_customer_ai.deletion_receipts where audit_id = p_audit_id) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'audit_id', p_audit_id);
  end if;

  select jsonb_build_object(
    'businesses', (select count(*) from aurentara_customer_ai.businesses where tenant_id = p_tenant_id),
    'memory_facts', (select count(*) from aurentara_customer_ai.memory_facts where tenant_id = p_tenant_id),
    'memory_candidates', (select count(*) from aurentara_customer_ai.memory_candidates where tenant_id = p_tenant_id),
    'goals', (select count(*) from aurentara_customer_ai.goals where tenant_id = p_tenant_id),
    'decisions', (select count(*) from aurentara_customer_ai.decisions where tenant_id = p_tenant_id),
    'conversations', (select count(*) from aurentara_customer_ai.conversations where tenant_id = p_tenant_id),
    'messages', (select count(*) from aurentara_customer_ai.conversation_messages where tenant_id = p_tenant_id),
    'turns', (select count(*) from aurentara_customer_ai.conversation_turns where tenant_id = p_tenant_id),
    'usage', (select count(*) from aurentara_customer_ai.usage_attribution where tenant_id = p_tenant_id),
    'audit_rows', (select count(*) from aurentara_customer_ai.audit_log where tenant_id = p_tenant_id),
    'deletion_jobs', (select count(*) from aurentara_customer_ai.deletion_jobs where tenant_id = p_tenant_id)
  ) into counts;

  delete from aurentara_customer_ai.tenants where tenant_id = p_tenant_id;
  get diagnostics deleted_tenant = row_count;
  if deleted_tenant <> 1 then
    raise exception 'TENANT_NOT_FOUND';
  end if;

  insert into aurentara_customer_ai.deletion_receipts(audit_id, tenant_fingerprint, deleted_counts)
  values (
    p_audit_id,
    encode(extensions.digest(p_tenant_id, 'sha256'), 'hex'),
    counts
  );

  return jsonb_build_object(
    'ok', true,
    'audit_id', p_audit_id,
    'tenant_fingerprint', encode(extensions.digest(p_tenant_id, 'sha256'), 'hex'),
    'deleted_counts', counts
  );
end;
$$;

revoke all on function aurentara_customer_ai.hard_delete_tenant(text,text) from public, anon, authenticated;
grant execute on function aurentara_customer_ai.hard_delete_tenant(text,text) to service_role;
