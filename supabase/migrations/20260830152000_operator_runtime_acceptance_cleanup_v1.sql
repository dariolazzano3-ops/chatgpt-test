-- RIOSYSTEMS Operator Runtime acceptance cleanup.
-- Allows service_role to delete only isolated synthetic restart-acceptance rows.

create or replace function public.riosystems_cleanup_operator_runtime_acceptance(p_operator_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_operator_id is null
     or p_operator_id !~ '^operator:runtime-restart-acceptance-[A-Za-z0-9._-]{1,100}@riosystems[.]invalid$' then
    raise exception 'RUNTIME_RESTART_CLEANUP_SCOPE_REJECTED';
  end if;

  delete from public.riosystems_operator_runtime_v1
  where operator_id = p_operator_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.riosystems_cleanup_operator_runtime_acceptance(text) from public;
revoke all on function public.riosystems_cleanup_operator_runtime_acceptance(text) from anon;
revoke all on function public.riosystems_cleanup_operator_runtime_acceptance(text) from authenticated;
grant execute on function public.riosystems_cleanup_operator_runtime_acceptance(text) to service_role;

comment on function public.riosystems_cleanup_operator_runtime_acceptance(text) is
  'Deletes only isolated synthetic RIOSYSTEMS runtime restart acceptance rows; no general runtime DELETE grant.';
