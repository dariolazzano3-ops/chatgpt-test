-- JARVIS Private RPC Gateway + OAuth Vault V1
-- Staging/private foundation. No production activation and no live OAuth credentials.

create table if not exists jarvis_private.oauth_connections_v1 (
  owner_id uuid not null,
  owner_ref text not null,
  provider text not null default 'google_calendar',
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  crypto_version integer not null default 1,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'ACTIVE',
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  updated_at timestamptz not null default now(),

  primary key (owner_id, provider),

  constraint jarvis_oauth_provider_check
    check (provider = 'google_calendar'),

  constraint jarvis_oauth_crypto_version_check
    check (crypto_version = 1),

  constraint jarvis_oauth_status_check
    check (status in ('ACTIVE', 'REVOKED')),

  constraint jarvis_oauth_ciphertext_nonempty_check
    check (length(refresh_token_ciphertext) >= 16 and length(refresh_token_iv) >= 8)
);

drop trigger if exists jarvis_oauth_connections_touch_updated_at
  on jarvis_private.oauth_connections_v1;

create trigger jarvis_oauth_connections_touch_updated_at
before update on jarvis_private.oauth_connections_v1
for each row execute function jarvis_private.touch_updated_at();

alter table jarvis_private.oauth_connections_v1 enable row level security;
alter table jarvis_private.oauth_connections_v1 force row level security;

revoke all on table jarvis_private.oauth_connections_v1 from public;
revoke all on table jarvis_private.oauth_connections_v1 from anon;
revoke all on table jarvis_private.oauth_connections_v1 from authenticated;
grant select, insert, update, delete on table jarvis_private.oauth_connections_v1 to service_role;

comment on table jarvis_private.oauth_connections_v1 is
  'Server-only encrypted JARVIS OAuth refresh-token envelopes. No access token, client secret, or HAMYREN data is stored here.';

create or replace function public.jarvis_service_memory_load_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_limit integer default 200
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(to_jsonb(m) order by m.updated_at desc), '[]'::jsonb)
  from (
    select *
    from jarvis_private.personal_memory_v1
    where owner_id = p_owner_id
      and owner_ref = p_owner_ref
      and namespace = 'jarvis.personal'
    order by updated_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ) m;
$$;

create or replace function public.jarvis_service_memory_upsert_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_entry jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jarvis_private.personal_memory_v1;
  v_entry_owner_ref text;
begin
  if p_owner_id is null or nullif(trim(p_owner_ref), '') is null then
    raise exception 'JARVIS_RPC_OWNER_SCOPE_REQUIRED';
  end if;
  if p_entry is null or nullif(trim(p_entry ->> 'memory_id'), '') is null then
    raise exception 'JARVIS_RPC_MEMORY_ID_REQUIRED';
  end if;

  v_entry_owner_ref := nullif(trim(p_entry ->> 'owner_ref'), '');
  if v_entry_owner_ref is not null and v_entry_owner_ref <> p_owner_ref then
    raise exception 'JARVIS_RPC_OWNER_REF_MISMATCH';
  end if;

  insert into jarvis_private.personal_memory_v1 (
    owner_id, owner_ref, memory_id, namespace, category, subject, value, source,
    source_system, confidence, status, sensitivity, provenance, valid_from,
    valid_until, historical, created_at, updated_at
  ) values (
    p_owner_id,
    p_owner_ref,
    p_entry ->> 'memory_id',
    coalesce(nullif(p_entry ->> 'namespace', ''), 'jarvis.personal'),
    p_entry ->> 'category',
    p_entry ->> 'subject',
    p_entry -> 'value',
    p_entry -> 'source',
    nullif(p_entry ->> 'source_system', ''),
    coalesce((p_entry ->> 'confidence')::numeric, 0.500),
    p_entry ->> 'status',
    coalesce(nullif(p_entry ->> 'sensitivity', ''), 'INTERNAL'),
    coalesce(p_entry -> 'provenance', '{}'::jsonb),
    nullif(p_entry ->> 'valid_from', '')::timestamptz,
    nullif(p_entry ->> 'valid_until', '')::timestamptz,
    coalesce((p_entry ->> 'historical')::boolean, false),
    coalesce(nullif(p_entry ->> 'created_at', '')::timestamptz, now()),
    coalesce(nullif(p_entry ->> 'updated_at', '')::timestamptz, now())
  )
  on conflict (owner_id, memory_id) do update set
    owner_ref = excluded.owner_ref,
    namespace = excluded.namespace,
    category = excluded.category,
    subject = excluded.subject,
    value = excluded.value,
    source = excluded.source,
    source_system = excluded.source_system,
    confidence = excluded.confidence,
    status = excluded.status,
    sensitivity = excluded.sensitivity,
    provenance = excluded.provenance,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    historical = excluded.historical,
    updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.jarvis_service_audit_append_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jarvis_private.audit_events_v1;
begin
  if p_owner_id is null or nullif(trim(p_owner_ref), '') is null then
    raise exception 'JARVIS_RPC_AUDIT_OWNER_SCOPE_REQUIRED';
  end if;

  insert into jarvis_private.audit_events_v1 (
    owner_id, owner_ref, schema_id, request_id, intent, tools_used, permissions,
    action, result, approval, cost, memory_updates, isolation, occurred_at
  ) values (
    p_owner_id,
    p_owner_ref,
    'aurentara.jarvis.audit-event.v1',
    nullif(p_event ->> 'request_id', ''),
    p_event -> 'intent',
    coalesce(p_event -> 'tools_used', '[]'::jsonb),
    coalesce(p_event -> 'permissions', '[]'::jsonb),
    nullif(p_event ->> 'action', ''),
    p_event -> 'result',
    p_event -> 'approval',
    p_event -> 'cost',
    p_event -> 'memory_updates',
    p_event -> 'isolation',
    coalesce(nullif(p_event ->> 'timestamp', '')::timestamptz, now())
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.jarvis_service_oauth_load_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_provider text default 'google_calendar'
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select to_jsonb(o)
  from jarvis_private.oauth_connections_v1 o
  where o.owner_id = p_owner_id
    and o.owner_ref = p_owner_ref
    and o.provider = p_provider
    and o.status = 'ACTIVE'
  limit 1;
$$;

create or replace function public.jarvis_service_oauth_upsert_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_provider text,
  p_refresh_token_ciphertext text,
  p_refresh_token_iv text,
  p_scopes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jarvis_private.oauth_connections_v1;
begin
  if p_owner_id is null or nullif(trim(p_owner_ref), '') is null then
    raise exception 'JARVIS_RPC_OAUTH_OWNER_SCOPE_REQUIRED';
  end if;
  if p_provider <> 'google_calendar' then
    raise exception 'JARVIS_RPC_OAUTH_PROVIDER_REJECTED';
  end if;

  insert into jarvis_private.oauth_connections_v1 (
    owner_id, owner_ref, provider, refresh_token_ciphertext, refresh_token_iv,
    crypto_version, scopes, status, connected_at, updated_at
  ) values (
    p_owner_id,
    p_owner_ref,
    p_provider,
    p_refresh_token_ciphertext,
    p_refresh_token_iv,
    1,
    coalesce(p_scopes, '[]'::jsonb),
    'ACTIVE',
    now(),
    now()
  )
  on conflict (owner_id, provider) do update set
    owner_ref = excluded.owner_ref,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    refresh_token_iv = excluded.refresh_token_iv,
    crypto_version = 1,
    scopes = excluded.scopes,
    status = 'ACTIVE',
    connected_at = now(),
    updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row) - 'refresh_token_ciphertext' - 'refresh_token_iv';
end;
$$;

create or replace function public.jarvis_service_oauth_touch_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_provider text default 'google_calendar'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update jarvis_private.oauth_connections_v1
  set last_used_at = now(), updated_at = now()
  where owner_id = p_owner_id
    and owner_ref = p_owner_ref
    and provider = p_provider
    and status = 'ACTIVE';
  return found;
end;
$$;

create or replace function public.jarvis_service_oauth_delete_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_provider text default 'google_calendar'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  delete from jarvis_private.oauth_connections_v1
  where owner_id = p_owner_id
    and owner_ref = p_owner_ref
    and provider = p_provider;
  return found;
end;
$$;

revoke all on function public.jarvis_service_memory_load_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.jarvis_service_memory_upsert_v1(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.jarvis_service_audit_append_v1(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.jarvis_service_oauth_load_v1(uuid, text, text) from public, anon, authenticated;
revoke all on function public.jarvis_service_oauth_upsert_v1(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.jarvis_service_oauth_touch_v1(uuid, text, text) from public, anon, authenticated;
revoke all on function public.jarvis_service_oauth_delete_v1(uuid, text, text) from public, anon, authenticated;

grant execute on function public.jarvis_service_memory_load_v1(uuid, text, integer) to service_role;
grant execute on function public.jarvis_service_memory_upsert_v1(uuid, text, jsonb) to service_role;
grant execute on function public.jarvis_service_audit_append_v1(uuid, text, jsonb) to service_role;
grant execute on function public.jarvis_service_oauth_load_v1(uuid, text, text) to service_role;
grant execute on function public.jarvis_service_oauth_upsert_v1(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.jarvis_service_oauth_touch_v1(uuid, text, text) to service_role;
grant execute on function public.jarvis_service_oauth_delete_v1(uuid, text, text) to service_role;

comment on function public.jarvis_service_memory_load_v1(uuid, text, integer) is
  'Service-role-only RPC gateway into private JARVIS memory. Not granted to anon/authenticated.';
comment on function public.jarvis_service_oauth_load_v1(uuid, text, text) is
  'Service-role-only RPC gateway returning encrypted OAuth envelopes only.';
