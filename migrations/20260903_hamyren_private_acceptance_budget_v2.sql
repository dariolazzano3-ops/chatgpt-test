create schema if not exists aurentara_customer_ai;

create table if not exists aurentara_customer_ai.hamyren_ai_test_budgets (
  tenant_id text primary key references aurentara_customer_ai.tenants(tenant_id) on delete cascade,
  hard_limit_eur numeric(12,6) not null default 10.000000 check (hard_limit_eur > 0 and hard_limit_eur <= 10.000000),
  spent_eur numeric(12,6) not null default 0 check (spent_eur >= 0),
  reserved_eur numeric(12,6) not null default 0 check (reserved_eur >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','LOCKED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (spent_eur + reserved_eur <= hard_limit_eur)
);

create table if not exists aurentara_customer_ai.hamyren_ai_test_budget_reservations (
  tenant_id text not null references aurentara_customer_ai.tenants(tenant_id) on delete cascade,
  operation_id text not null,
  provider_id text not null,
  model_id text not null,
  estimated_eur numeric(12,6) not null check (estimated_eur > 0),
  actual_eur numeric(12,6),
  status text not null check (status in ('RESERVED','SETTLED','RELEASED','UNKNOWN_COST_LOCKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, operation_id)
);

alter table aurentara_customer_ai.hamyren_ai_test_budgets enable row level security;
alter table aurentara_customer_ai.hamyren_ai_test_budget_reservations enable row level security;

drop policy if exists hamyren_ai_test_budgets_select_member on aurentara_customer_ai.hamyren_ai_test_budgets;
create policy hamyren_ai_test_budgets_select_member on aurentara_customer_ai.hamyren_ai_test_budgets
for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));

drop policy if exists hamyren_ai_test_budget_reservations_select_member on aurentara_customer_ai.hamyren_ai_test_budget_reservations;
create policy hamyren_ai_test_budget_reservations_select_member on aurentara_customer_ai.hamyren_ai_test_budget_reservations
for select to authenticated using (aurentara_customer_ai.is_tenant_member(tenant_id));

revoke all on aurentara_customer_ai.hamyren_ai_test_budgets from anon;
revoke all on aurentara_customer_ai.hamyren_ai_test_budget_reservations from anon;
revoke insert, update, delete on aurentara_customer_ai.hamyren_ai_test_budgets from authenticated;
revoke insert, update, delete on aurentara_customer_ai.hamyren_ai_test_budget_reservations from authenticated;
grant select on aurentara_customer_ai.hamyren_ai_test_budgets to authenticated;
grant select on aurentara_customer_ai.hamyren_ai_test_budget_reservations to authenticated;

create or replace function aurentara_customer_ai.hamyren_ai_budget_can_reserve_v2(
  p_spent_eur numeric,
  p_reserved_eur numeric,
  p_requested_eur numeric,
  p_hard_limit_eur numeric default 10.000000
) returns boolean
language sql immutable
as $$
  select p_spent_eur is not null
    and p_reserved_eur is not null
    and p_requested_eur is not null
    and p_requested_eur > 0
    and p_hard_limit_eur is not null
    and p_hard_limit_eur > 0
    and p_hard_limit_eur <= 10.000000
    and p_spent_eur >= 0
    and p_reserved_eur >= 0
    and p_spent_eur + p_reserved_eur + p_requested_eur <= p_hard_limit_eur;
$$;

create or replace function aurentara_customer_ai.hamyren_ai_budget_reserve_v2(
  p_tenant_id text,
  p_operation_id text,
  p_provider_id text,
  p_model_id text,
  p_estimated_eur numeric
) returns jsonb
language plpgsql security definer
set search_path = aurentara_customer_ai, pg_temp
as $$
declare
  b aurentara_customer_ai.hamyren_ai_test_budgets%rowtype;
  r aurentara_customer_ai.hamyren_ai_test_budget_reservations%rowtype;
begin
  if auth.uid() is null or not aurentara_customer_ai.is_tenant_member(p_tenant_id) then
    return jsonb_build_object('ok', false, 'reason', 'AUTH_REQUIRED');
  end if;
  if p_operation_id is null or length(trim(p_operation_id)) = 0 or p_estimated_eur is null or p_estimated_eur <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_OR_INVALID_COST');
  end if;

  select * into r from aurentara_customer_ai.hamyren_ai_test_budget_reservations
    where tenant_id = p_tenant_id and operation_id = p_operation_id;
  if found then
    return jsonb_build_object('ok', r.status = 'RESERVED', 'reason', 'IDEMPOTENT_EXISTING', 'status', r.status,
      'reserved_eur', r.estimated_eur);
  end if;

  insert into aurentara_customer_ai.hamyren_ai_test_budgets(tenant_id)
    values (p_tenant_id) on conflict (tenant_id) do nothing;

  select * into b from aurentara_customer_ai.hamyren_ai_test_budgets
    where tenant_id = p_tenant_id for update;

  if b.status <> 'ACTIVE' then
    return jsonb_build_object('ok', false, 'reason', 'BUDGET_NOT_ACTIVE');
  end if;
  if not aurentara_customer_ai.hamyren_ai_budget_can_reserve_v2(b.spent_eur,b.reserved_eur,p_estimated_eur,b.hard_limit_eur) then
    return jsonb_build_object('ok', false, 'reason', 'HARD_BUDGET_BLOCKED', 'spent_eur', b.spent_eur,
      'reserved_eur', b.reserved_eur, 'remaining_eur', greatest(0,b.hard_limit_eur-b.spent_eur-b.reserved_eur));
  end if;

  insert into aurentara_customer_ai.hamyren_ai_test_budget_reservations
    (tenant_id,operation_id,provider_id,model_id,estimated_eur,status)
    values (p_tenant_id,p_operation_id,p_provider_id,p_model_id,p_estimated_eur,'RESERVED');
  update aurentara_customer_ai.hamyren_ai_test_budgets
    set reserved_eur = reserved_eur + p_estimated_eur, updated_at = now()
    where tenant_id = p_tenant_id;

  return jsonb_build_object('ok', true, 'reason', 'RESERVED', 'reserved_eur', p_estimated_eur,
    'remaining_eur', b.hard_limit_eur-b.spent_eur-b.reserved_eur-p_estimated_eur);
end;
$$;

create or replace function aurentara_customer_ai.hamyren_ai_budget_settle_v2(
  p_tenant_id text,
  p_operation_id text,
  p_actual_eur numeric
) returns jsonb
language plpgsql security definer
set search_path = aurentara_customer_ai, pg_temp
as $$
declare
  b aurentara_customer_ai.hamyren_ai_test_budgets%rowtype;
  r aurentara_customer_ai.hamyren_ai_test_budget_reservations%rowtype;
begin
  if auth.uid() is null or not aurentara_customer_ai.is_tenant_member(p_tenant_id) then
    return jsonb_build_object('ok', false, 'reason', 'AUTH_REQUIRED');
  end if;
  select * into r from aurentara_customer_ai.hamyren_ai_test_budget_reservations
    where tenant_id=p_tenant_id and operation_id=p_operation_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'RESERVATION_NOT_FOUND'); end if;
  if r.status = 'SETTLED' then return jsonb_build_object('ok', true, 'reason', 'IDEMPOTENT_SETTLED', 'actual_eur', r.actual_eur); end if;
  if r.status <> 'RESERVED' then return jsonb_build_object('ok', false, 'reason', 'RESERVATION_NOT_SETTLEABLE'); end if;

  select * into b from aurentara_customer_ai.hamyren_ai_test_budgets where tenant_id=p_tenant_id for update;
  if p_actual_eur is null or p_actual_eur < 0 or p_actual_eur > r.estimated_eur then
    update aurentara_customer_ai.hamyren_ai_test_budget_reservations
      set status='UNKNOWN_COST_LOCKED', actual_eur=p_actual_eur, updated_at=now()
      where tenant_id=p_tenant_id and operation_id=p_operation_id;
    update aurentara_customer_ai.hamyren_ai_test_budgets set status='LOCKED', updated_at=now() where tenant_id=p_tenant_id;
    return jsonb_build_object('ok', false, 'reason', 'UNKNOWN_OR_OVER_RESERVATION_COST_LOCKED');
  end if;

  update aurentara_customer_ai.hamyren_ai_test_budgets
    set reserved_eur = reserved_eur-r.estimated_eur,
        spent_eur = spent_eur+p_actual_eur,
        updated_at=now()
    where tenant_id=p_tenant_id;
  update aurentara_customer_ai.hamyren_ai_test_budget_reservations
    set actual_eur=p_actual_eur,status='SETTLED',updated_at=now()
    where tenant_id=p_tenant_id and operation_id=p_operation_id;
  return jsonb_build_object('ok', true, 'reason', 'SETTLED', 'actual_eur', p_actual_eur,
    'remaining_eur', b.hard_limit_eur-b.spent_eur-b.reserved_eur+r.estimated_eur-p_actual_eur);
end;
$$;

create or replace function aurentara_customer_ai.hamyren_ai_budget_release_v2(
  p_tenant_id text,
  p_operation_id text
) returns jsonb
language plpgsql security definer
set search_path = aurentara_customer_ai, pg_temp
as $$
declare
  r aurentara_customer_ai.hamyren_ai_test_budget_reservations%rowtype;
begin
  if auth.uid() is null or not aurentara_customer_ai.is_tenant_member(p_tenant_id) then
    return jsonb_build_object('ok', false, 'reason', 'AUTH_REQUIRED');
  end if;
  select * into r from aurentara_customer_ai.hamyren_ai_test_budget_reservations
    where tenant_id=p_tenant_id and operation_id=p_operation_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'RESERVATION_NOT_FOUND'); end if;
  if r.status = 'RELEASED' then return jsonb_build_object('ok', true, 'reason', 'IDEMPOTENT_RELEASED'); end if;
  if r.status <> 'RESERVED' then return jsonb_build_object('ok', false, 'reason', 'RESERVATION_NOT_RELEASABLE'); end if;
  update aurentara_customer_ai.hamyren_ai_test_budgets
    set reserved_eur=reserved_eur-r.estimated_eur,updated_at=now() where tenant_id=p_tenant_id;
  update aurentara_customer_ai.hamyren_ai_test_budget_reservations
    set status='RELEASED',updated_at=now() where tenant_id=p_tenant_id and operation_id=p_operation_id;
  return jsonb_build_object('ok', true, 'reason', 'RELEASED');
end;
$$;

grant execute on function aurentara_customer_ai.hamyren_ai_budget_can_reserve_v2(numeric,numeric,numeric,numeric) to authenticated;
grant execute on function aurentara_customer_ai.hamyren_ai_budget_reserve_v2(text,text,text,text,numeric) to authenticated;
grant execute on function aurentara_customer_ai.hamyren_ai_budget_settle_v2(text,text,numeric) to authenticated;
grant execute on function aurentara_customer_ai.hamyren_ai_budget_release_v2(text,text) to authenticated;
revoke execute on function aurentara_customer_ai.hamyren_ai_budget_reserve_v2(text,text,text,text,numeric) from anon;
revoke execute on function aurentara_customer_ai.hamyren_ai_budget_settle_v2(text,text,numeric) from anon;
revoke execute on function aurentara_customer_ai.hamyren_ai_budget_release_v2(text,text) from anon;
