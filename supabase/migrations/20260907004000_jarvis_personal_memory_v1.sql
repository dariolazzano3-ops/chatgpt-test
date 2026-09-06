-- JARVIS Personal Memory V1
-- Private-by-design personal memory and audit domain.
-- Development/staging foundation only. No production activation in this migration.

create schema if not exists jarvis_private;

revoke all on schema jarvis_private from public;
revoke all on schema jarvis_private from anon;
grant usage on schema jarvis_private to authenticated, service_role;

create or replace function jarvis_private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = jarvis_private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function jarvis_private.touch_updated_at() from public;
grant execute on function jarvis_private.touch_updated_at() to authenticated, service_role;

create table if not exists jarvis_private.personal_memory_v1 (
  owner_id uuid not null,
  owner_ref text not null,
  memory_id text not null,
  namespace text not null default 'jarvis.personal',
  category text not null,
  subject text not null,
  value jsonb,
  source jsonb,
  source_system text,
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  status text not null,
  sensitivity text not null default 'INTERNAL',
  provenance jsonb not null default '{}'::jsonb,
  valid_from timestamptz,
  valid_until timestamptz,
  historical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (owner_id, memory_id),

  constraint jarvis_memory_namespace_check
    check (namespace = 'jarvis.personal'),

  constraint jarvis_memory_category_check
    check (category in (
      'PERSONAL_FACTS',
      'PREFERENCES',
      'PEOPLE',
      'RELATIONSHIPS',
      'PROJECTS',
      'GOALS',
      'DECISIONS',
      'ROUTINES',
      'TASKS',
      'PLACES',
      'EVENTS',
      'DOCUMENT_CONTEXT',
      'CONVERSATION_MEMORY',
      'DEVICE_CONTEXT',
      'AUTOMATION_CONTEXT'
    )),

  constraint jarvis_memory_status_check
    check (status in (
      'CONFIRMED',
      'INFERRED',
      'TEMPORARY',
      'UNVERIFIED',
      'CONFLICTED',
      'HISTORICAL'
    )),

  constraint jarvis_memory_sensitivity_check
    check (sensitivity in ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED')),

  constraint jarvis_memory_no_hamyren_source_check
    check (
      source_system is null
      or (
        lower(source_system) <> 'hamyren'
        and lower(source_system) not like 'hamyren.%'
      )
    ),

  constraint jarvis_memory_historical_consistency_check
    check (
      (status = 'HISTORICAL' and historical = true)
      or (status <> 'HISTORICAL')
    )
);

create index if not exists jarvis_personal_memory_owner_updated_idx
  on jarvis_private.personal_memory_v1(owner_id, updated_at desc);

create index if not exists jarvis_personal_memory_owner_ref_idx
  on jarvis_private.personal_memory_v1(owner_id, owner_ref);

create index if not exists jarvis_personal_memory_owner_category_idx
  on jarvis_private.personal_memory_v1(owner_id, category, status);

create index if not exists jarvis_personal_memory_owner_subject_idx
  on jarvis_private.personal_memory_v1(owner_id, subject);

drop trigger if exists jarvis_personal_memory_touch_updated_at
  on jarvis_private.personal_memory_v1;

create trigger jarvis_personal_memory_touch_updated_at
before update on jarvis_private.personal_memory_v1
for each row execute function jarvis_private.touch_updated_at();

create table if not exists jarvis_private.audit_events_v1 (
  owner_id uuid not null,
  owner_ref text not null,
  event_id uuid primary key default gen_random_uuid(),
  schema_id text not null default 'aurentara.jarvis.audit-event.v1',
  request_id text,
  intent jsonb,
  tools_used jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  action text,
  result jsonb,
  approval jsonb,
  cost jsonb,
  memory_updates jsonb,
  isolation jsonb not null,
  occurred_at timestamptz not null default now(),

  constraint jarvis_audit_schema_check
    check (schema_id = 'aurentara.jarvis.audit-event.v1'),

  constraint jarvis_audit_isolation_check
    check (
      isolation ->> 'namespace' = 'jarvis.personal'
      and coalesce((isolation ->> 'hamyren_memory_access')::boolean, false) = false
      and coalesce((isolation ->> 'hamyren_memory_write')::boolean, false) = false
    )
);

create index if not exists jarvis_audit_events_owner_occurred_idx
  on jarvis_private.audit_events_v1(owner_id, occurred_at desc);

alter table jarvis_private.personal_memory_v1 enable row level security;
alter table jarvis_private.personal_memory_v1 force row level security;
alter table jarvis_private.audit_events_v1 enable row level security;
alter table jarvis_private.audit_events_v1 force row level security;

revoke all on table jarvis_private.personal_memory_v1 from public;
revoke all on table jarvis_private.personal_memory_v1 from anon;
revoke all on table jarvis_private.audit_events_v1 from public;
revoke all on table jarvis_private.audit_events_v1 from anon;

grant select, insert, update, delete on table jarvis_private.personal_memory_v1 to authenticated;
grant select, insert on table jarvis_private.audit_events_v1 to authenticated;

grant select, insert, update, delete on table jarvis_private.personal_memory_v1 to service_role;
grant select, insert, update, delete on table jarvis_private.audit_events_v1 to service_role;

drop policy if exists jarvis_memory_owner_select on jarvis_private.personal_memory_v1;
create policy jarvis_memory_owner_select
on jarvis_private.personal_memory_v1
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists jarvis_memory_owner_insert on jarvis_private.personal_memory_v1;
create policy jarvis_memory_owner_insert
on jarvis_private.personal_memory_v1
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and namespace = 'jarvis.personal'
);

drop policy if exists jarvis_memory_owner_update on jarvis_private.personal_memory_v1;
create policy jarvis_memory_owner_update
on jarvis_private.personal_memory_v1
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and namespace = 'jarvis.personal'
);

drop policy if exists jarvis_memory_owner_delete on jarvis_private.personal_memory_v1;
create policy jarvis_memory_owner_delete
on jarvis_private.personal_memory_v1
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists jarvis_audit_owner_select on jarvis_private.audit_events_v1;
create policy jarvis_audit_owner_select
on jarvis_private.audit_events_v1
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists jarvis_audit_owner_insert on jarvis_private.audit_events_v1;
create policy jarvis_audit_owner_insert
on jarvis_private.audit_events_v1
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and isolation ->> 'namespace' = 'jarvis.personal'
  and coalesce((isolation ->> 'hamyren_memory_access')::boolean, false) = false
  and coalesce((isolation ->> 'hamyren_memory_write')::boolean, false) = false
);

comment on schema jarvis_private is
  'Private JARVIS personal data domain. No shared HAMYREN memory or automatic cross-product data path.';

comment on table jarvis_private.personal_memory_v1 is
  'JARVIS-owned temporal personal memory. Credentials and secrets are rejected by application policy and are not valid sensitivity states in this table.';

comment on table jarvis_private.audit_events_v1 is
  'Owner-scoped JARVIS audit events. Payloads must be redacted before persistence.';
