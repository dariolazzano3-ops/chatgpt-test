-- JARVIS durable Program Approval state reader V1.
-- Read-only, owner + program scoped, service-role only. This prevents a valid
-- long-lived grant/revoke from disappearing behind the general 200-row audit
-- projection during 24/7 runner operation. No data is written or rewritten.

create or replace function public.jarvis_service_program_approval_read_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_program text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select to_jsonb(a)
    from (
      select
        event_id,
        owner_ref,
        request_id,
        intent,
        tools_used,
        permissions,
        action,
        result,
        approval,
        cost,
        memory_updates,
        isolation,
        occurred_at
      from jarvis_private.audit_events_v1
      where owner_id = p_owner_id
        and owner_ref = p_owner_ref
        and action = 'PROGRAM_APPROVAL'
        and upper(coalesce(result ->> 'program', '')) = upper(trim(p_program))
        and intent ->> 'intent_type' in ('PROGRAM_APPROVAL_GRANT', 'PROGRAM_APPROVAL_REVOKE')
      order by occurred_at desc
      limit 1
    ) a
  ), 'null'::jsonb);
$$;

revoke all on function public.jarvis_service_program_approval_read_v1(uuid, text, text) from public, anon, authenticated;
grant execute on function public.jarvis_service_program_approval_read_v1(uuid, text, text) to service_role;

comment on function public.jarvis_service_program_approval_read_v1(uuid, text, text) is
  'Read-only latest JARVIS Program Approval GRANT/REVOKE for one owner and program. Service-role only; independent of the bounded general audit window.';
