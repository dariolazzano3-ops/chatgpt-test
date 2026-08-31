-- AURENTARA PERSONAL BUSINESS AI / FOUNDATION V1
-- BUILD ARTIFACT ONLY. DO NOT APPLY AUTOMATICALLY.
-- This schema is the production-direction contract for a dedicated Customer AI data plane.
-- It MUST NOT share the private Operator Control database in production.

begin;

create schema if not exists aurentara_customer_ai;

create table if not exists aurentara_customer_ai.tenants (
  tenant_id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active','suspended','deleting')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists aurentara_customer_ai.memberships (
  tenant_id text not null references aurentara_customer_ai.tenants(tenant_id) on delete cascade,
  user_id text not null,
  role text not null default 'member' check (role in ('owner','member','viewer')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists aurentara_customer_ai.businesses (
  tenant_id text not null references aurentara_customer_ai.tenants(tenant_id) on delete cascade,
  business_id text not null,
  name text not null,
  industry text,
  business_type text,
  country text not null default 'DE',
  region text,
  language text not null default 'de',
  currency text not null default 'EUR',
  business_stage text,
  founded_at date,
  owner_user_id text,
  profile jsonb not null default '{}'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (tenant_id, business_id)
);

create table if not exists aurentara_customer_ai.memory_facts (
  tenant_id text not null,
  business_id text not null,
  memory_id text not null,
  category text not null,
  fact_key text not null,
  subject text,
  value jsonb,
  status text not null check (status in ('CONFIRMED_FACT','INFERRED_INFORMATION','TEMPORARY_CONTEXT','HISTORICAL_FACT','OUTDATED_INFORMATION')),
  source_type text not null,
  source_reference text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  sensitivity text not null default 'normal',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  supersedes text,
  superseded_by text,
  previous_status text,
  deleted_at timestamptz,
  deletion_reason text,
  primary key (tenant_id, business_id, memory_id),
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade,
  foreign key (tenant_id, business_id, supersedes) references aurentara_customer_ai.memory_facts(tenant_id, business_id, memory_id),
  foreign key (tenant_id, business_id, superseded_by) references aurentara_customer_ai.memory_facts(tenant_id, business_id, memory_id)
);

create table if not exists aurentara_customer_ai.memory_candidates (
  tenant_id text not null,
  business_id text not null,
  candidate_id text not null,
  category text not null,
  fact_key text not null,
  subject text,
  value jsonb,
  status text not null check (status in ('pending','accepted','rejected','needs_confirmation')),
  source_type text not null,
  source_reference text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  sensitivity text not null default 'normal',
  accepted_memory_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, business_id, candidate_id),
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade,
  foreign key (tenant_id, business_id, accepted_memory_id) references aurentara_customer_ai.memory_facts(tenant_id, business_id, memory_id)
);

create table if not exists aurentara_customer_ai.goals (
  tenant_id text not null,
  business_id text not null,
  goal_id text not null,
  title text not null,
  description text,
  status text not null check (status in ('PROPOSED','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  priority integer not null default 0,
  target jsonb,
  target_date date,
  source text not null,
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (tenant_id, business_id, goal_id),
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade
);

create table if not exists aurentara_customer_ai.decisions (
  tenant_id text not null,
  business_id text not null,
  decision_id text not null,
  title text not null,
  decision text not null,
  reasoning_summary text,
  alternatives_considered jsonb not null default '[]'::jsonb,
  expected_outcome jsonb,
  actual_outcome jsonb,
  status text not null check (status in ('RECORDED','REVIEW_DUE','OUTCOME_RECORDED','SUPERSEDED')),
  decided_at timestamptz not null,
  review_at timestamptz,
  source text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (tenant_id, business_id, decision_id),
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade
);

create table if not exists aurentara_customer_ai.business_state_snapshots (
  tenant_id text not null,
  business_id text not null,
  snapshot_id text not null,
  state jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (tenant_id, business_id, snapshot_id),
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade
);

create table if not exists aurentara_customer_ai.usage_attribution (
  tenant_id text not null,
  business_id text not null,
  usage_id text not null,
  user_id text,
  conversation_id text,
  operation_id text,
  provider_id text,
  model_id text,
  usage_class text not null,
  estimated_cost_units numeric not null default 0 check (estimated_cost_units >= 0),
  actual_cost_units numeric check (actual_cost_units >= 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, business_id, usage_id),
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade
);

create table if not exists aurentara_customer_ai.audit_log (
  tenant_id text not null,
  business_id text,
  audit_id text not null,
  actor_user_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, audit_id),
  foreign key (tenant_id) references aurentara_customer_ai.tenants(tenant_id) on delete cascade,
  foreign key (tenant_id, business_id) references aurentara_customer_ai.businesses(tenant_id, business_id) on delete cascade
);

create table if not exists aurentara_customer_ai.deletion_jobs (
  tenant_id text not null,
  business_id text,
  deletion_job_id text not null,
  deletion_scope text not null check (deletion_scope in ('MEMORY','BUSINESS','TENANT','ACCOUNT')),
  subject_id text not null,
  status text not null default 'planned' check (status in ('planned','approved','running','completed','failed')),
  requested_by text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  primary key (tenant_id, deletion_job_id),
  foreign key (tenant_id) references aurentara_customer_ai.tenants(tenant_id) on delete cascade
);

create index if not exists memory_current_scope_idx
  on aurentara_customer_ai.memory_facts (tenant_id, business_id, fact_key, status)
  where deleted_at is null;
create index if not exists memory_history_scope_idx
  on aurentara_customer_ai.memory_facts (tenant_id, business_id, updated_at desc);
create index if not exists goals_scope_idx
  on aurentara_customer_ai.goals (tenant_id, business_id, status) where deleted_at is null;
create index if not exists decisions_scope_idx
  on aurentara_customer_ai.decisions (tenant_id, business_id, decided_at desc) where deleted_at is null;
create index if not exists usage_scope_idx
  on aurentara_customer_ai.usage_attribution (tenant_id, business_id, created_at desc);

-- Membership lookup is the tenant authorization root. SECURITY DEFINER is used only for
-- membership lookup to avoid RLS recursion. The function has a fixed search_path and
-- returns only a boolean. Service credentials remain server-side and are not a customer bypass.
create or replace function aurentara_customer_ai.is_tenant_member(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = aurentara_customer_ai, pg_temp
as $$
  select exists (
    select 1
    from aurentara_customer_ai.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()::text
      and m.status = 'active'
  );
$$;

revoke all on function aurentara_customer_ai.is_tenant_member(text) from public;
grant execute on function aurentara_customer_ai.is_tenant_member(text) to authenticated;

alter table aurentara_customer_ai.tenants enable row level security;
alter table aurentara_customer_ai.memberships enable row level security;
alter table aurentara_customer_ai.businesses enable row level security;
alter table aurentara_customer_ai.memory_facts enable row level security;
alter table aurentara_customer_ai.memory_candidates enable row level security;
alter table aurentara_customer_ai.goals enable row level security;
alter table aurentara_customer_ai.decisions enable row level security;
alter table aurentara_customer_ai.business_state_snapshots enable row level security;
alter table aurentara_customer_ai.usage_attribution enable row level security;
alter table aurentara_customer_ai.audit_log enable row level security;
alter table aurentara_customer_ai.deletion_jobs enable row level security;

create policy tenants_read_member on aurentara_customer_ai.tenants
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy memberships_read_member on aurentara_customer_ai.memberships
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));

create policy businesses_read_member on aurentara_customer_ai.businesses
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy businesses_insert_member on aurentara_customer_ai.businesses
  for insert to authenticated with check (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy businesses_update_member on aurentara_customer_ai.businesses
  for update to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id))
  with check (aurentara_customer_ai.is_tenant_member(tenant_id));

create policy memory_read_member on aurentara_customer_ai.memory_facts
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy memory_insert_member on aurentara_customer_ai.memory_facts
  for insert to authenticated with check (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy memory_update_member on aurentara_customer_ai.memory_facts
  for update to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id))
  with check (aurentara_customer_ai.is_tenant_member(tenant_id));

create policy candidates_read_member on aurentara_customer_ai.memory_candidates
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy candidates_insert_member on aurentara_customer_ai.memory_candidates
  for insert to authenticated with check (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy candidates_update_member on aurentara_customer_ai.memory_candidates
  for update to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id))
  with check (aurentara_customer_ai.is_tenant_member(tenant_id));

create policy goals_read_member on aurentara_customer_ai.goals
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy goals_insert_member on aurentara_customer_ai.goals
  for insert to authenticated with check (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy goals_update_member on aurentara_customer_ai.goals
  for update to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id))
  with check (aurentara_customer_ai.is_tenant_member(tenant_id));

create policy decisions_read_member on aurentara_customer_ai.decisions
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy decisions_insert_member on aurentara_customer_ai.decisions
  for insert to authenticated with check (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy decisions_update_member on aurentara_customer_ai.decisions
  for update to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id))
  with check (aurentara_customer_ai.is_tenant_member(tenant_id));

create policy snapshots_read_member on aurentara_customer_ai.business_state_snapshots
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy usage_read_member on aurentara_customer_ai.usage_attribution
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy audit_read_member on aurentara_customer_ai.audit_log
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));
create policy deletion_jobs_read_member on aurentara_customer_ai.deletion_jobs
  for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));

-- No customer DELETE policy is intentionally granted. Hard deletion is a later, explicit,
-- audited server-side executor. Normal product deletion first marks records as deleted and
-- excludes them from context. Tenant/business hard purge must remove child data, retrieval
-- indexes and cache entries as one scoped operation.

-- SEMANTIC / VECTOR SECURITY CONTRACT
-- Future pgvector queries MUST constrain tenant_id AND business_id in the SQL WHERE clause
-- before/during nearest-neighbour ordering. The forbidden implementation is a global vector
-- query followed by tenant filtering in application code.
-- Example future shape:
--   SELECT ... FROM aurentara_customer_ai.memory_facts
--   WHERE tenant_id = $tenant AND business_id = $business AND deleted_at IS NULL
--   ORDER BY embedding <=> $query_embedding LIMIT $limit;

comment on schema aurentara_customer_ai is
  'Dedicated AURENTARA Customer AI data plane. Must remain separate from Operator Control in production.';
comment on table aurentara_customer_ai.memory_facts is
  'Longitudinal business memory with epistemic status, provenance, validity and supersession.';

rollback;
-- Intentionally ROLLBACK: this file is a reviewed schema contract in Build Block 01, not an authorized production migration.
