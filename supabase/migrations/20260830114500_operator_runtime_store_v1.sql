-- RIOSYSTEMS Operator Runtime V1 durable persistence.
-- Staging/synthetic only until an explicit production approval exists.

create table if not exists public.riosystems_operator_runtime_v1 (
  operator_id text primary key,
  revision bigint not null check (revision >= 1),
  runtime jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint riosystems_operator_runtime_schema_check
    check (runtime ->> 'schema' = 'riosystems.operator-runtime.v1'),
  constraint riosystems_operator_runtime_operator_check
    check (runtime ->> 'operator_id' = operator_id),
  constraint riosystems_operator_runtime_revision_check
    check ((runtime ->> 'revision')::bigint = revision)
);

alter table public.riosystems_operator_runtime_v1 enable row level security;

revoke all on table public.riosystems_operator_runtime_v1 from anon;
revoke all on table public.riosystems_operator_runtime_v1 from authenticated;

grant select, insert, update on table public.riosystems_operator_runtime_v1 to service_role;

comment on table public.riosystems_operator_runtime_v1 is
  'Private single-operator RIOSYSTEMS runtime persistence. Server-side service-role access only.';
