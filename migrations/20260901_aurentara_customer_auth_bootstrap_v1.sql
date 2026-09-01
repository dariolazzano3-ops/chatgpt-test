-- AURENTARA Customer Auth Bootstrap V1
-- Applied to dedicated Customer project pqmbtfzjcdnihovvppjr on 2026-09-01.

alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,aurentara_customer_ai';
notify pgrst, 'reload config';

create or replace function aurentara_customer_ai.bootstrap_personal_workspace(
  p_business_name text default 'My Business'
) returns jsonb
language plpgsql
security definer
set search_path = aurentara_customer_ai, auth, pg_temp
as $$
declare
  v_user_id text := auth.uid()::text;
  v_tenant_id text;
  v_business_id text;
  v_existing_tenant text;
  v_existing_business text;
begin
  if v_user_id is null or v_user_id = '' then
    raise insufficient_privilege using message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  select m.tenant_id into v_existing_tenant
  from aurentara_customer_ai.memberships m
  where m.user_id = v_user_id and m.status = 'active'
  order by m.created_at asc
  limit 1;

  if v_existing_tenant is not null then
    select b.business_id into v_existing_business
    from aurentara_customer_ai.businesses b
    where b.tenant_id = v_existing_tenant and b.deleted_at is null
    order by b.created_at asc
    limit 1;
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'tenant_id', v_existing_tenant,
      'business_id', v_existing_business,
      'user_id', v_user_id
    );
  end if;

  v_tenant_id := 'tenant_' || replace(v_user_id, '-', '');
  v_business_id := 'business_' || replace(v_user_id, '-', '');

  insert into aurentara_customer_ai.tenants(tenant_id, name)
  values (v_tenant_id, 'AURENTARA Personal Workspace');

  insert into aurentara_customer_ai.memberships(tenant_id, user_id, role, status)
  values (v_tenant_id, v_user_id, 'owner', 'active');

  insert into aurentara_customer_ai.businesses(
    tenant_id, business_id, name, country, language, currency, business_stage, owner_user_id, profile
  ) values (
    v_tenant_id,
    v_business_id,
    coalesce(nullif(left(btrim(p_business_name), 240), ''), 'My Business'),
    'DE', 'de', 'EUR', 'exploration', v_user_id,
    jsonb_build_object('source','authenticated_bootstrap_v1')
  );

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'tenant_id', v_tenant_id,
    'business_id', v_business_id,
    'user_id', v_user_id
  );
end;
$$;

revoke all on function aurentara_customer_ai.bootstrap_personal_workspace(text) from public, anon;
grant execute on function aurentara_customer_ai.bootstrap_personal_workspace(text) to authenticated;
