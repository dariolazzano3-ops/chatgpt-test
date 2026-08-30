create extension if not exists pgcrypto;

create or replace function public.riosystems_current_project_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  claims jsonb;
  project_text text;
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  project_text := claims ->> 'project_id';
  if project_text is null or project_text = '' then
    return null;
  end if;
  return project_text::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.riosystems_current_project_id() from public;
grant execute on function public.riosystems_current_project_id() to authenticated, service_role;

create or replace function public.riosystems_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.riosystems_touch_updated_at() from public;

grant execute on function public.riosystems_touch_updated_at() to authenticated, service_role;

create table public.customer_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  environment text not null default 'staging' check (environment in ('staging', 'production')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  external_customer_ref text,
  source text not null default 'riosystems',
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, environment)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  external_ref text,
  email text,
  full_name text,
  source text not null default 'synthetic',
  provider_ref text,
  attributes jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id)
);

create unique index contacts_project_external_ref_uq
  on public.contacts(project_id, external_ref)
  where external_ref is not null;

create index contacts_project_created_idx
  on public.contacts(project_id, created_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  contact_id uuid,
  idempotency_key text not null,
  status text not null default 'new' check (status in ('new', 'validated', 'qualified', 'rejected', 'converted', 'failed')),
  source text not null default 'website',
  source_ref text,
  provider_ref text,
  payload jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, idempotency_key),
  constraint leads_project_contact_fk
    foreign key (project_id, contact_id)
    references public.contacts(project_id, id)
    on delete restrict
);

create index leads_project_status_created_idx
  on public.leads(project_id, status, created_at desc);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid not null,
  event_type text not null,
  idempotency_key text not null,
  source text not null default 'riosystems',
  provider_ref text,
  event_payload jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key),
  constraint lead_events_project_lead_fk
    foreign key (project_id, lead_id)
    references public.leads(project_id, id)
    on delete cascade
);

create index lead_events_project_lead_created_idx
  on public.lead_events(project_id, lead_id, created_at desc);

create table public.provider_execution_refs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid,
  provider text not null,
  capability text not null,
  external_execution_ref text,
  idempotency_key text not null,
  execution_state text not null default 'prepared' check (execution_state in ('prepared', 'running', 'succeeded', 'failed', 'dead_lettered')),
  cost_eur numeric(12,6) not null default 0 check (cost_eur >= 0),
  metadata jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider, idempotency_key),
  constraint provider_execution_refs_project_lead_fk
    foreign key (project_id, lead_id)
    references public.leads(project_id, id)
    on delete set null
);

create index provider_execution_refs_project_created_idx
  on public.provider_execution_refs(project_id, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_type text not null default 'system',
  actor_ref text,
  request_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create unique index audit_log_project_idempotency_uq
  on public.audit_log(project_id, idempotency_key)
  where idempotency_key is not null;

create index audit_log_project_occurred_idx
  on public.audit_log(project_id, occurred_at desc);

create trigger customer_projects_touch_updated_at
before update on public.customer_projects
for each row execute function public.riosystems_touch_updated_at();

create trigger contacts_touch_updated_at
before update on public.contacts
for each row execute function public.riosystems_touch_updated_at();

create trigger leads_touch_updated_at
before update on public.leads
for each row execute function public.riosystems_touch_updated_at();

create trigger provider_execution_refs_touch_updated_at
before update on public.provider_execution_refs
for each row execute function public.riosystems_touch_updated_at();

alter table public.customer_projects enable row level security;
alter table public.customer_projects force row level security;
alter table public.contacts enable row level security;
alter table public.contacts force row level security;
alter table public.leads enable row level security;
alter table public.leads force row level security;
alter table public.lead_events enable row level security;
alter table public.lead_events force row level security;
alter table public.provider_execution_refs enable row level security;
alter table public.provider_execution_refs force row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

revoke all on public.customer_projects, public.contacts, public.leads, public.lead_events, public.provider_execution_refs, public.audit_log from anon;
revoke all on public.customer_projects, public.contacts, public.leads, public.lead_events, public.provider_execution_refs, public.audit_log from public;

grant select, insert, update on public.customer_projects, public.contacts, public.leads, public.lead_events, public.provider_execution_refs, public.audit_log to authenticated;
grant select, insert, update, delete on public.customer_projects, public.contacts, public.leads, public.lead_events, public.provider_execution_refs, public.audit_log to service_role;

create policy customer_projects_project_scope_select
on public.customer_projects for select to authenticated
using (id = public.riosystems_current_project_id());

create policy customer_projects_project_scope_insert
on public.customer_projects for insert to authenticated
with check (id = public.riosystems_current_project_id() and environment = 'staging');

create policy customer_projects_project_scope_update
on public.customer_projects for update to authenticated
using (id = public.riosystems_current_project_id())
with check (id = public.riosystems_current_project_id() and environment = 'staging');

create policy contacts_project_scope_select
on public.contacts for select to authenticated
using (project_id = public.riosystems_current_project_id());

create policy contacts_project_scope_insert
on public.contacts for insert to authenticated
with check (project_id = public.riosystems_current_project_id());

create policy contacts_project_scope_update
on public.contacts for update to authenticated
using (project_id = public.riosystems_current_project_id())
with check (project_id = public.riosystems_current_project_id());

create policy leads_project_scope_select
on public.leads for select to authenticated
using (project_id = public.riosystems_current_project_id());

create policy leads_project_scope_insert
on public.leads for insert to authenticated
with check (project_id = public.riosystems_current_project_id());

create policy leads_project_scope_update
on public.leads for update to authenticated
using (project_id = public.riosystems_current_project_id())
with check (project_id = public.riosystems_current_project_id());

create policy lead_events_project_scope_select
on public.lead_events for select to authenticated
using (project_id = public.riosystems_current_project_id());

create policy lead_events_project_scope_insert
on public.lead_events for insert to authenticated
with check (project_id = public.riosystems_current_project_id());

create policy lead_events_project_scope_update
on public.lead_events for update to authenticated
using (project_id = public.riosystems_current_project_id())
with check (project_id = public.riosystems_current_project_id());

create policy provider_execution_refs_project_scope_select
on public.provider_execution_refs for select to authenticated
using (project_id = public.riosystems_current_project_id());

create policy provider_execution_refs_project_scope_insert
on public.provider_execution_refs for insert to authenticated
with check (project_id = public.riosystems_current_project_id());

create policy provider_execution_refs_project_scope_update
on public.provider_execution_refs for update to authenticated
using (project_id = public.riosystems_current_project_id())
with check (project_id = public.riosystems_current_project_id());

create policy audit_log_project_scope_select
on public.audit_log for select to authenticated
using (project_id = public.riosystems_current_project_id());

create policy audit_log_project_scope_insert
on public.audit_log for insert to authenticated
with check (project_id = public.riosystems_current_project_id());

comment on table public.customer_projects is 'RIOSYSTEMS project registry. Block 2 staging foundation; no production data inserted by this activation.';
comment on table public.leads is 'Project-isolated lead records with per-project idempotency keys.';
comment on function public.riosystems_current_project_id() is 'Returns project_id claim used by RLS. Missing or invalid claims resolve to null.';
