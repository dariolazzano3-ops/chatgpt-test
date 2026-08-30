-- RIOSYSTEMS Business / CRM Factory V1
-- Deployment-ready only. Applying this migration is an external Supabase write and
-- requires a fresh explicit staging approval. No production or customer data is included.

begin;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  external_ref text,
  name text not null,
  status text not null default 'prospect',
  industry text,
  source text not null default 'riosystems',
  attributes jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id)
);
create unique index companies_project_external_ref_uq on public.companies(project_id, external_ref) where external_ref is not null;
create index companies_project_created_idx on public.companies(project_id, created_at desc);

alter table public.contacts add column company_id uuid;
alter table public.contacts add column title text;
alter table public.contacts add column phone text;
alter table public.contacts add constraint contacts_project_company_fk
  foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict;

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  pipeline_key text not null,
  name text not null,
  entity_type text not null default 'deal',
  is_default boolean not null default false,
  active boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, pipeline_key)
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  pipeline_id uuid not null,
  stage_key text not null,
  name text not null,
  position integer not null check (position >= 0),
  terminal boolean not null default false,
  outcome text check (outcome is null or outcome in ('none','won','lost')),
  stage_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, pipeline_id, stage_key),
  unique (project_id, pipeline_id, position),
  constraint pipeline_stages_project_pipeline_fk
    foreign key (project_id, pipeline_id) references public.pipelines(project_id, id) on delete restrict
);

create table public.pipeline_transitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  pipeline_id uuid not null,
  from_stage_id uuid not null,
  to_stage_id uuid not null,
  transition_key text not null,
  rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, pipeline_id, transition_key),
  unique (project_id, pipeline_id, from_stage_id, to_stage_id),
  constraint pipeline_transitions_project_pipeline_fk
    foreign key (project_id, pipeline_id) references public.pipelines(project_id, id) on delete restrict,
  constraint pipeline_transitions_from_stage_fk
    foreign key (project_id, from_stage_id) references public.pipeline_stages(project_id, id) on delete restrict,
  constraint pipeline_transitions_to_stage_fk
    foreign key (project_id, to_stage_id) references public.pipeline_stages(project_id, id) on delete restrict,
  constraint pipeline_transitions_distinct_check check (from_stage_id <> to_stage_id)
);

alter table public.leads add column company_id uuid;
alter table public.leads add column pipeline_id uuid;
alter table public.leads add column stage_id uuid;
alter table public.leads add column score integer not null default 0 check (score between 0 and 100);
alter table public.leads add column owner_ref text;
alter table public.leads add column last_activity_at timestamptz;
alter table public.leads add column next_action text;
alter table public.leads add constraint leads_project_company_fk
  foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict;
alter table public.leads add constraint leads_project_pipeline_fk
  foreign key (project_id, pipeline_id) references public.pipelines(project_id, id) on delete restrict;
alter table public.leads add constraint leads_project_stage_fk
  foreign key (project_id, stage_id) references public.pipeline_stages(project_id, id) on delete restrict;

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  pipeline_id uuid not null,
  stage_id uuid not null,
  idempotency_key text not null,
  title text not null,
  status text not null default 'open' check (status in ('open','won','lost','cancelled')),
  value_minor bigint not null default 0 check (value_minor >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  owner_ref text,
  next_action text,
  expected_close_at timestamptz,
  attributes jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, idempotency_key),
  constraint deals_project_lead_fk foreign key (project_id, lead_id) references public.leads(project_id, id) on delete restrict,
  constraint deals_project_contact_fk foreign key (project_id, contact_id) references public.contacts(project_id, id) on delete restrict,
  constraint deals_project_company_fk foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict,
  constraint deals_project_pipeline_fk foreign key (project_id, pipeline_id) references public.pipelines(project_id, id) on delete restrict,
  constraint deals_project_stage_fk foreign key (project_id, stage_id) references public.pipeline_stages(project_id, id) on delete restrict
);
create index deals_project_stage_created_idx on public.deals(project_id, stage_id, created_at desc);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  company_id uuid,
  idempotency_key text not null,
  resource_type text not null,
  resource_id text,
  activity_type text not null check (activity_type in ('email','call','note','form','automation','ai_action','status_change','meeting','other')),
  direction text check (direction is null or direction in ('inbound','outbound','internal')),
  summary text not null,
  occurred_at timestamptz not null default now(),
  source text not null default 'business-factory',
  metadata jsonb not null default '{}'::jsonb,
  audit_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, idempotency_key),
  constraint activities_project_lead_fk foreign key (project_id, lead_id) references public.leads(project_id, id) on delete restrict,
  constraint activities_project_deal_fk foreign key (project_id, deal_id) references public.deals(project_id, id) on delete restrict,
  constraint activities_project_contact_fk foreign key (project_id, contact_id) references public.contacts(project_id, id) on delete restrict,
  constraint activities_project_company_fk foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict
);
create index activities_project_occurred_idx on public.activities(project_id, occurred_at desc);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  company_id uuid,
  idempotency_key text not null,
  resource_type text not null,
  resource_id text,
  body text not null,
  author_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, idempotency_key),
  constraint notes_project_lead_fk foreign key (project_id, lead_id) references public.leads(project_id, id) on delete restrict,
  constraint notes_project_deal_fk foreign key (project_id, deal_id) references public.deals(project_id, id) on delete restrict,
  constraint notes_project_contact_fk foreign key (project_id, contact_id) references public.contacts(project_id, id) on delete restrict,
  constraint notes_project_company_fk foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  company_id uuid,
  idempotency_key text not null,
  resource_type text not null,
  resource_id text,
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  owner_ref text,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, idempotency_key),
  constraint tasks_project_lead_fk foreign key (project_id, lead_id) references public.leads(project_id, id) on delete restrict,
  constraint tasks_project_deal_fk foreign key (project_id, deal_id) references public.deals(project_id, id) on delete restrict,
  constraint tasks_project_contact_fk foreign key (project_id, contact_id) references public.contacts(project_id, id) on delete restrict,
  constraint tasks_project_company_fk foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict
);
create index tasks_project_status_due_idx on public.tasks(project_id, status, due_at);

create table public.business_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  company_id uuid,
  business_run_id text,
  event_type text not null,
  resource_type text not null,
  resource_id text,
  idempotency_key text not null,
  source text not null default 'business-factory',
  event_payload jsonb not null default '{}'::jsonb,
  analytics_state text not null default 'mapped' check (analytics_state in ('not_required','mapped','sent','failed')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, idempotency_key),
  constraint business_events_project_lead_fk foreign key (project_id, lead_id) references public.leads(project_id, id) on delete restrict,
  constraint business_events_project_deal_fk foreign key (project_id, deal_id) references public.deals(project_id, id) on delete restrict,
  constraint business_events_project_contact_fk foreign key (project_id, contact_id) references public.contacts(project_id, id) on delete restrict,
  constraint business_events_project_company_fk foreign key (project_id, company_id) references public.companies(project_id, id) on delete restrict
);
create index business_events_project_type_occurred_idx on public.business_events(project_id, event_type, occurred_at desc);

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  entity_type text not null,
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('text','number','boolean','date','datetime','select','multiselect','json')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, entity_type, field_key)
);

create table public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  definition_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, definition_id, entity_id),
  constraint custom_field_values_project_definition_fk
    foreign key (project_id, definition_id) references public.custom_field_definitions(project_id, id) on delete restrict
);

create table public.idempotency_registry (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  idempotency_key text not null,
  operation text not null,
  resource_type text not null,
  resource_id text,
  request_hash text,
  state text not null default 'claimed' check (state in ('claimed','completed','failed')),
  response_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create table public.business_run_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  business_run_id text not null,
  operation text not null,
  resource text not null,
  provider text not null,
  status text not null,
  side_effect text not null default 'none',
  validation text not null default 'not_run',
  error text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index business_run_log_project_run_idx on public.business_run_log(project_id, business_run_id, occurred_at);

create table public.project_access_grants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete restrict,
  subject_ref text not null,
  role text not null check (role in ('operator','client_admin','client_viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, subject_ref, role)
);

create or replace view public.projects with (security_invoker = true) as
select id, slug, display_name, environment, status, external_customer_ref, source, audit_meta, created_at, updated_at
from public.customer_projects;

create trigger companies_touch_updated_at before update on public.companies for each row execute function public.riosystems_touch_updated_at();
create trigger pipelines_touch_updated_at before update on public.pipelines for each row execute function public.riosystems_touch_updated_at();
create trigger pipeline_stages_touch_updated_at before update on public.pipeline_stages for each row execute function public.riosystems_touch_updated_at();
create trigger deals_touch_updated_at before update on public.deals for each row execute function public.riosystems_touch_updated_at();
create trigger notes_touch_updated_at before update on public.notes for each row execute function public.riosystems_touch_updated_at();
create trigger tasks_touch_updated_at before update on public.tasks for each row execute function public.riosystems_touch_updated_at();
create trigger custom_field_definitions_touch_updated_at before update on public.custom_field_definitions for each row execute function public.riosystems_touch_updated_at();
create trigger custom_field_values_touch_updated_at before update on public.custom_field_values for each row execute function public.riosystems_touch_updated_at();
create trigger idempotency_registry_touch_updated_at before update on public.idempotency_registry for each row execute function public.riosystems_touch_updated_at();

-- Fail closed by default. All customer-owned tables remain project-scoped.
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies','pipelines','pipeline_stages','pipeline_transitions','deals','activities','notes','tasks',
    'business_events','custom_field_definitions','custom_field_values','idempotency_registry','business_run_log','project_access_grants'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke all on public.%I from public', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant select, insert, update on public.%I to service_role', t);
    execute format('create policy %I on public.%I for select to authenticated using (project_id = public.riosystems_current_project_id())', t || '_project_scope_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (project_id = public.riosystems_current_project_id())', t || '_project_scope_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (project_id = public.riosystems_current_project_id()) with check (project_id = public.riosystems_current_project_id())', t || '_project_scope_update', t);
  end loop;
end $$;

-- Append-only records: authenticated and service-role UPDATE is not needed.
revoke update on public.activities, public.business_events, public.business_run_log, public.project_access_grants from authenticated, service_role;

revoke all on public.projects from anon, public;
grant select on public.projects to authenticated, service_role;

comment on view public.projects is 'Logical CRM V1 projects entity backed by the existing customer_projects registry; RLS inherited through security_invoker.';
comment on table public.business_events is 'Canonical project-scoped business event stream for CRM automation and privacy-minimized analytics mapping.';
comment on table public.idempotency_registry is 'Project-scoped idempotency registry. Duplicate webhook keys must resolve to one logical operation.';
comment on table public.business_run_log is 'Business Factory observability: run, project, operation, resource, provider, status, side effect, validation and error.';
comment on table public.project_access_grants is 'Role-ready access model. V1 remains single-operator; client roles are architectural only until explicitly activated.';

commit;
