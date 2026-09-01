-- AURENTARA Customer Privacy Export V1
-- Applied to dedicated Customer project pqmbtfzjcdnihovvppjr on 2026-09-01.

create or replace function aurentara_customer_ai.export_my_workspace()
returns jsonb
language plpgsql
security invoker
set search_path = aurentara_customer_ai, pg_temp
as $$
declare
  v_user_id text := auth.uid()::text;
  v_tenant_id text;
  result jsonb;
begin
  if v_user_id is null or v_user_id = '' then
    raise insufficient_privilege using message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  select m.tenant_id into v_tenant_id
  from aurentara_customer_ai.memberships m
  where m.user_id = v_user_id and m.status = 'active'
  order by m.created_at asc
  limit 1;

  if v_tenant_id is null then
    return jsonb_build_object(
      'schema', 'aurentara.customer.privacy-export.v1',
      'exported_at', now(),
      'user_id', v_user_id,
      'workspace', null
    );
  end if;

  select jsonb_build_object(
    'schema', 'aurentara.customer.privacy-export.v1',
    'exported_at', now(),
    'user_id', v_user_id,
    'tenant_id', v_tenant_id,
    'tenant', (select to_jsonb(t) from aurentara_customer_ai.tenants t where t.tenant_id = v_tenant_id),
    'memberships', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from aurentara_customer_ai.memberships m where m.tenant_id = v_tenant_id), '[]'::jsonb),
    'businesses', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from aurentara_customer_ai.businesses b where b.tenant_id = v_tenant_id), '[]'::jsonb),
    'memory_facts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from aurentara_customer_ai.memory_facts f where f.tenant_id = v_tenant_id), '[]'::jsonb),
    'memory_candidates', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from aurentara_customer_ai.memory_candidates c where c.tenant_id = v_tenant_id), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from aurentara_customer_ai.goals g where g.tenant_id = v_tenant_id), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from aurentara_customer_ai.decisions d where d.tenant_id = v_tenant_id), '[]'::jsonb),
    'business_state_snapshots', coalesce((select jsonb_agg(to_jsonb(s) order by s.generated_at) from aurentara_customer_ai.business_state_snapshots s where s.tenant_id = v_tenant_id), '[]'::jsonb),
    'usage_attribution', coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at) from aurentara_customer_ai.usage_attribution u where u.tenant_id = v_tenant_id), '[]'::jsonb),
    'audit_log', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from aurentara_customer_ai.audit_log a where a.tenant_id = v_tenant_id), '[]'::jsonb),
    'deletion_jobs', coalesce((select jsonb_agg(to_jsonb(j) order by j.requested_at) from aurentara_customer_ai.deletion_jobs j where j.tenant_id = v_tenant_id), '[]'::jsonb),
    'conversations', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from aurentara_customer_ai.conversations c where c.tenant_id = v_tenant_id), '[]'::jsonb),
    'conversation_messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from aurentara_customer_ai.conversation_messages m where m.tenant_id = v_tenant_id), '[]'::jsonb),
    'conversation_turns', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from aurentara_customer_ai.conversation_turns t where t.tenant_id = v_tenant_id), '[]'::jsonb),
    'consent_events', coalesce((select jsonb_agg(to_jsonb(c) order by c.recorded_at, c.consent_id) from aurentara_customer_ai.consent_events c where c.tenant_id = v_tenant_id and c.user_id = v_user_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function aurentara_customer_ai.export_my_workspace() from public, anon;
grant execute on function aurentara_customer_ai.export_my_workspace() to authenticated;
