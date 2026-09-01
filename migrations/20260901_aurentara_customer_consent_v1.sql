-- AURENTARA Customer Consent V1
-- Applied to dedicated Customer project pqmbtfzjcdnihovvppjr on 2026-09-01.

create table if not exists aurentara_customer_ai.consent_events (
  tenant_id text not null,
  consent_id text not null,
  user_id text not null,
  purpose text not null check (purpose in ('persistent_business_memory','trusted_research','product_analytics','service_handoff')),
  granted boolean not null,
  policy_version text not null,
  source text not null default 'customer_ui',
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, consent_id),
  foreign key (tenant_id, user_id) references aurentara_customer_ai.memberships(tenant_id, user_id) on delete cascade
);

create index if not exists consent_events_current_idx
  on aurentara_customer_ai.consent_events(tenant_id, user_id, purpose, recorded_at desc, consent_id desc);

alter table aurentara_customer_ai.consent_events enable row level security;
grant select, insert on aurentara_customer_ai.consent_events to authenticated;
grant all privileges on aurentara_customer_ai.consent_events to service_role;

create policy consent_events_read_owner on aurentara_customer_ai.consent_events
  for select to authenticated using (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and user_id = (select auth.uid())::text
  );
create policy consent_events_insert_owner on aurentara_customer_ai.consent_events
  for insert to authenticated with check (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and user_id = (select auth.uid())::text
  );

revoke update, delete on aurentara_customer_ai.consent_events from authenticated;
