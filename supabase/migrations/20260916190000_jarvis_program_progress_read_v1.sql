-- JARVIS durable Program Progress reader V1.
-- Read-only, owner + program scoped, service-role only. Returns at most one
-- latest IMPLEMENTATION_MISSION audit row per wave, immune to audit noise.

create or replace function public.jarvis_service_program_progress_read_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_program text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.occurred_at desc), '[]'::jsonb)
  from (
    select distinct on ((result ->> 'wave_index')::integer)
      event_id, owner_ref, request_id, intent, tools_used, permissions, action,
      result, approval, cost, memory_updates, isolation, occurred_at
    from jarvis_private.audit_events_v1
    where owner_id = p_owner_id
      and owner_ref = p_owner_ref
      and action = 'IMPLEMENTATION_MISSION'
      and upper(coalesce(result ->> 'program', '')) = upper(trim(p_program))
      and coalesce(result ->> 'wave_index', '') ~ '^[0-9]+$'
      and (result ->> 'wave_index')::integer between 0 and 63
    order by (result ->> 'wave_index')::integer, occurred_at desc
  ) a;
$$;

revoke all on function public.jarvis_service_program_progress_read_v1(uuid, text, text) from public, anon, authenticated;
grant execute on function public.jarvis_service_program_progress_read_v1(uuid, text, text) to service_role;

comment on function public.jarvis_service_program_progress_read_v1(uuid, text, text) is
  'Read-only latest JARVIS implementation audit row per wave for one owner and program. Service-role only; independent of bounded general audit window.';
