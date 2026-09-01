-- AURENTARA Customer AI production hardening V1
-- Applied to dedicated Customer project pqmbtfzjcdnihovvppjr on 2026-09-01.
-- Operator project pgzayxpqiakuvibhonwh is intentionally separate.

create index if not exists audit_log_business_fk_idx
  on aurentara_customer_ai.audit_log (tenant_id, business_id)
  where business_id is not null;
create index if not exists memory_candidates_accepted_memory_fk_idx
  on aurentara_customer_ai.memory_candidates (tenant_id, business_id, accepted_memory_id)
  where accepted_memory_id is not null;
create index if not exists memory_facts_supersedes_fk_idx
  on aurentara_customer_ai.memory_facts (tenant_id, business_id, supersedes)
  where supersedes is not null;
create index if not exists memory_facts_superseded_by_fk_idx
  on aurentara_customer_ai.memory_facts (tenant_id, business_id, superseded_by)
  where superseded_by is not null;

drop policy if exists conversations_read_owner on aurentara_customer_ai.conversations;
drop policy if exists conversations_insert_owner on aurentara_customer_ai.conversations;
drop policy if exists conversations_update_owner on aurentara_customer_ai.conversations;
drop policy if exists conversation_messages_read_owner on aurentara_customer_ai.conversation_messages;
drop policy if exists conversation_messages_insert_owner on aurentara_customer_ai.conversation_messages;
drop policy if exists conversation_turns_read_owner on aurentara_customer_ai.conversation_turns;
drop policy if exists conversation_turns_insert_owner on aurentara_customer_ai.conversation_turns;
drop policy if exists conversation_turns_update_owner on aurentara_customer_ai.conversation_turns;

create policy conversations_read_owner on aurentara_customer_ai.conversations
  for select to authenticated using (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = (select auth.uid())::text
  );
create policy conversations_insert_owner on aurentara_customer_ai.conversations
  for insert to authenticated with check (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = (select auth.uid())::text
  );
create policy conversations_update_owner on aurentara_customer_ai.conversations
  for update to authenticated using (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = (select auth.uid())::text
  ) with check (
    aurentara_customer_ai.is_tenant_member(tenant_id)
    and owner_user_id = (select auth.uid())::text
  );

create policy conversation_messages_read_owner on aurentara_customer_ai.conversation_messages
  for select to authenticated using (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_messages.tenant_id
        and c.business_id = conversation_messages.business_id
        and c.conversation_id = conversation_messages.conversation_id
        and c.owner_user_id = (select auth.uid())::text
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
        and c.owner_user_id = (select auth.uid())::text
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
        and c.owner_user_id = (select auth.uid())::text
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
        and c.owner_user_id = (select auth.uid())::text
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
        and c.owner_user_id = (select auth.uid())::text
        and c.deleted_at is null
    )
  ) with check (
    exists (
      select 1 from aurentara_customer_ai.conversations c
      where c.tenant_id = conversation_turns.tenant_id
        and c.business_id = conversation_turns.business_id
        and c.conversation_id = conversation_turns.conversation_id
        and c.owner_user_id = (select auth.uid())::text
        and c.deleted_at is null
    )
  );
