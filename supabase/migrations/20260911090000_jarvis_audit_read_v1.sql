-- JARVIS Command Center Wave 4 — bounded owner-scoped audit reader.
-- Adds a read-only service-role RPC so the Command Center can project real
-- persisted JARVIS audit events into the Runs / Activity / Approvals surfaces.
-- No production activation. No new data written. No HAMYREN reference.

create or replace function public.jarvis_service_audit_read_v1(
  p_owner_id uuid,
  p_owner_ref text,
  p_limit integer default 50
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.occurred_at desc), '[]'::jsonb)
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
    order by occurred_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) a;
$$;

revoke all on function public.jarvis_service_audit_read_v1(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.jarvis_service_audit_read_v1(uuid, text, integer) to service_role;

comment on function public.jarvis_service_audit_read_v1(uuid, text, integer) is
  'Read-only, owner-scoped, bounded JARVIS audit projection for the private Command Center. Service-role only. Returns at most 200 rows.';
