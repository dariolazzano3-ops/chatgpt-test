-- AURENTARA PERSONAL BUSINESS AI / CUSTOMER CHAT INTELLIGENCE & CONTEXT RUNTIME V1
-- BUILD ARTIFACT ONLY. DO NOT APPLY AUTOMATICALLY.
-- Requires the Foundation V1 customer data-plane schema to be reviewed/applied first.
-- No Production database change is authorized by this file.

begin;

create table if not exists aurentara_customer_ai.conversations (
  tenant_id text not null,
  business_id text not null,
  conversation_id text not null,
  owner_user_id text not null,
  title text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  data_sensitivity text not null default 'customer' check (data_sensitivity in ('synthetic','internal','customer','sensitive')),
  message_count integer not null default 0,
  turn_count integer not null default 0,
  last_intent text,
  last_error text,
  operator_plane_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (tenant_id, business_id, conversation_id),
  foreign key (tenant_id, business_id)
    references aurentara_customer_ai.businesses(tenant_id, business_id)
    on delete cascade
);

create table if not exists aurentara_customer_ai.conversation_messages (
  tenant_id text not null,
  business_id text not null,
  conversation_id text not null,
  message_id text not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  ordinal integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (tenant_id, business_id, conversation_id, message_id),
  foreign key (tenant_id, business_id, conversation_id)
    references aurentara_customer_ai.conversations(tenant_id, business_id, conversation_id)
    on delete cascade,
  unique (tenant_id, business_id, conversation_id, ordinal)
);

create table if not exists aurentara_customer_ai.conversation_turns (
  tenant_id text not null,
  business_id text not null,
  conversation_id text not null,
  turn_id text not null,
  user_message_id text,
  assistant_message_id text,
  intent text not null,
  status text not null check (status in ('COMPLETED','FAILED','BLOCKED')),
  context_manifest jsonb not null default '{}'::jsonb,
  output jsonb,
  proposal_links jsonb not null default '{}'::jsonb,
  confirmations jsonb not null default '[]'::jsonb,
  ai_metadata jsonb,
  external_research jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, business_id, conversation_id, turn_id),
  foreign key (tenant_id, business_id, conversation_id)
    references aurentara_customer_ai.conversations(tenant_id, business_id, conversation_id)
    on delete cascade
);

create index if not exists conversations_owner_scope_idx
  on aurentara_customer_ai.conversations (tenant_id, business_id, owner_user_id, updated_at desc)
  where deleted_at is null;
create index if not exists conversation_messages_scope_idx
  on aurentara_customer_ai.conversation_messages (tenant_id, business_id, conversation_id, ordinal)
  where deleted_at is null;
create index if not exists conversation_turns_scope_idx
  on aurentara_customer_ai.conversation_turns (tenant_id, business_id, conversation_id, created_at desc);

alter table aurentara_customer_ai.conversations enable row level security;
alter table aurentara_customer_ai.conversation_messages enable row level security;
alter table aurentara_customer_ai.conversation_turns enable row level security;

-- V1 conversations are personal to the authenticated user even if a tenant later contains
-- multiple members. Shared/team conversation policies can be added explicitly in a later block.
create policy conversations_read_owner on aurentara_customer_ai.conversations
  for select to authenticated using (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = auth.uid()::text
  );
create policy conversations_insert_owner on aurentara_customer_ai.conversations
  for insert to authenticated with check (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = auth.uid()::text
  );
create policy conversations_update_owner on aurentara_customer_ai.conversations
  for update to authenticated using (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = auth.uid()::text
  ) with check (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = auth.uid()::text
  );

create policy conversation_messages_read_owner on aurentara_customer_ai.conversation_messages
  for select to authenticated using (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_messages.tenant_id
        and c.business_id = conversation_messages.business_id
        and c.conversation_id = conversation_messages.conversation_id
        and c.owner_user_id = auth.uid()::text
        and c.deleted_at is null
    )
  );
create policy conversation_messages_insert_owner on aurentara_customer_ai.conversation_messages
  for insert to authenticated with check (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_messages.tenant_id
        and c.business_id = conversation_messages.business_id
        and c.conversation_id = conversation_messages.conversation_id
        and c.owner_user_id = auth.uid()::text
        and c.deleted_at is null
    )
  );

create policy conversation_turns_read_owner on aurentara_customer_ai.conversation_turns
  for select to authenticated using (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_turns.tenant_id
        and c.business_id = conversation_turns.business_id
        and c.conversation_id = conversation_turns.conversation_id
        and c.owner_user_id = auth.uid()::text
        and c.deleted_at is null
    )
  );
create policy conversation_turns_insert_owner on aurentara_customer_ai.conversation_turns
  for insert to authenticated with check (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_turns.tenant_id
        and c.business_id = conversation_turns.business_id
        and c.conversation_id = conversation_turns.conversation_id
        and c.owner_user_id = auth.uid()::text
        and c.deleted_at is null
    )
  );
create policy conversation_turns_update_owner on aurentara_customer_ai.conversation_turns
  for update to authenticated using (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_turns.tenant_id
        and c.business_id = conversation_turns.business_id
        and c.conversation_id = conversation_turns.conversation_id
        and c.owner_user_id = auth.uid()::text
        and c.deleted_at is null
    )
  ) with check (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_turns.tenant_id
        and c.business_id = conversation_turns.business_id
        and c.conversation_id = conversation_turns.conversation_id
        and c.owner_user_id = auth.uid()::text
        and c.deleted_at is null
    )
  );

-- No customer DELETE policy. Hard deletion remains an explicit audited server-side purge.
-- No vector query is introduced here. Any future semantic conversation retrieval must retain
-- tenant_id + business_id + conversation ownership scope before/during retrieval.

comment on table aurentara_customer_ai.conversations is
  'Personal Business AI conversation registry. Customer plane only; never Operator Control session state.';
comment on table aurentara_customer_ai.conversation_turns is
  'Bounded chat turn metadata, context references and explicit proposal confirmations; no private model chain-of-thought.';

rollback;
-- Intentionally ROLLBACK: reviewed deployment-direction contract only.
