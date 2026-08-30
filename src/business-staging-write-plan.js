const cleanSlug = (value) => String(value || '').trim().toLowerCase();
const SCOPE_PART = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SCHEMA = 'riosystems_staging';
const TABLE = 'crm_leads';
const CONFIRMATION = 'APPLY_SUPABASE_STAGING_CRM_ONCE';

function validScopePart(value) {
  return SCOPE_PART.test(value);
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function schemaSql(scope) {
  const externalRef = `${scope.customer_id}-${scope.project_id}-lead-001`;
  return `begin;
create schema if not exists ${SCHEMA};
revoke all on schema ${SCHEMA} from public;

create table if not exists ${SCHEMA}.${TABLE} (
  id bigint generated always as identity primary key,
  customer_id text not null,
  project_id text not null,
  external_ref text not null,
  lead_name text not null,
  email text not null,
  status text not null default 'new' check (status in ('new', 'qualified', 'contacted', 'closed')),
  synthetic_test_data boolean not null default false check (synthetic_test_data = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, project_id, external_ref)
);

alter table ${SCHEMA}.${TABLE} enable row level security;
alter table ${SCHEMA}.${TABLE} force row level security;
revoke all on ${SCHEMA}.${TABLE} from public, anon, authenticated;

create index if not exists crm_leads_scope_status_idx
  on ${SCHEMA}.${TABLE} (customer_id, project_id, status);

insert into ${SCHEMA}.${TABLE} (
  customer_id, project_id, external_ref, lead_name, email, status, synthetic_test_data
) values (
  ${literal(scope.customer_id)},
  ${literal(scope.project_id)},
  ${literal(externalRef)},
  'Synthetic Bakery Lead',
  'lead-001@example.invalid',
  'new',
  true
)
on conflict (customer_id, project_id, external_ref)
do update set
  lead_name = excluded.lead_name,
  email = excluded.email,
  status = excluded.status,
  synthetic_test_data = true,
  updated_at = now();
commit;`;
}

function verificationSql(scope) {
  return `select
  count(*)::int as synthetic_row_count,
  bool_and(synthetic_test_data) as synthetic_only
from ${SCHEMA}.${TABLE}
where customer_id = ${literal(scope.customer_id)}
  and project_id = ${literal(scope.project_id)}
  and external_ref = ${literal(`${scope.customer_id}-${scope.project_id}-lead-001`)};`;
}

function cleanupSql(scope) {
  return `delete from ${SCHEMA}.${TABLE}
where customer_id = ${literal(scope.customer_id)}
  and project_id = ${literal(scope.project_id)}
  and external_ref = ${literal(`${scope.customer_id}-${scope.project_id}-lead-001`)}
  and synthetic_test_data = true;`;
}

export function buildSupabaseStagingCrmWritePlan(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const customerId = cleanSlug(input.customer_id);
  const projectId = cleanSlug(input.project_id);
  if (!validScopePart(customerId) || !validScopePart(projectId)) {
    return { ok: false, error: 'STAGING_PROJECT_SCOPE_INVALID', production_deploy: false };
  }
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.real_customer_data === true) {
    return { ok: false, error: 'SYNTHETIC_ISOLATED_STAGING_REQUIRED', production_deploy: false };
  }
  const scope = { customer_id: customerId, project_id: projectId, scope_key: `${customerId}:${projectId}` };
  return {
    ok: true,
    schema: 'riosystems.supabase-staging-crm-write-plan.v1',
    provider_id: 'supabase-free',
    capability: 'business.crm.write',
    state: 'WRITE_PLAN_READY_NOT_EXECUTED',
    scope,
    database: {
      schema_name: SCHEMA,
      table_name: TABLE,
      exposed_via_data_api: false,
      rls_enabled: true,
      rls_forced: true,
      anon_access: false,
      authenticated_access: false,
      upsert_conflict_key: ['customer_id', 'project_id', 'external_ref']
    },
    statements: {
      apply: schemaSql(scope),
      verify: verificationSql(scope),
      cleanup_synthetic_row: cleanupSql(scope)
    },
    confirmation: CONFIRMATION,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    external_write: true,
    execute_sql: false,
    estimated_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

function resultRows(result) {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result)) return result;
  return [];
}

function validateCanonicalPlan(plan = {}) {
  if (plan.schema !== 'riosystems.supabase-staging-crm-write-plan.v1' || plan.state !== 'WRITE_PLAN_READY_NOT_EXECUTED' || plan.provider_id !== 'supabase-free') {
    return { ok: false, error: 'SUPABASE_STAGING_WRITE_PLAN_REQUIRED' };
  }
  const canonical = buildSupabaseStagingCrmWritePlan({
    customer_id: plan.scope?.customer_id,
    project_id: plan.scope?.project_id,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    production_deploy: false
  });
  if (!canonical.ok) return { ok: false, error: 'SUPABASE_STAGING_WRITE_PLAN_REQUIRED' };
  const sameScope = plan.scope?.scope_key === canonical.scope.scope_key;
  const sameDatabase = JSON.stringify(plan.database) === JSON.stringify(canonical.database);
  const sameStatements = plan.statements?.apply === canonical.statements.apply
    && plan.statements?.verify === canonical.statements.verify
    && plan.statements?.cleanup_synthetic_row === canonical.statements.cleanup_synthetic_row;
  const sameSafety = plan.confirmation === canonical.confirmation
    && plan.staging_only === true
    && plan.synthetic_test_data_only === true
    && plan.real_customer_data === false
    && plan.external_write === true
    && plan.execute_sql === false
    && plan.estimated_variable_cost_eur === 0
    && plan.automatic_paid_overflow === false
    && plan.production_deploy === false;
  return sameScope && sameDatabase && sameStatements && sameSafety
    ? { ok: true, canonical }
    : { ok: false, error: 'SUPABASE_STAGING_WRITE_PLAN_TAMPERED' };
}

export async function runSupabaseStagingCrmWrite(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const checked = validateCanonicalPlan(plan);
  if (!checked.ok) return { ...checked, production_deploy: false };
  if (runtime.confirmation !== CONFIRMATION) return { ok: false, error: 'SUPABASE_STAGING_WRITE_CONFIRMATION_REQUIRED', production_deploy: false };
  if (runtime.external_write_execution_approved !== true) return { ok: false, error: 'SUPABASE_EXTERNAL_WRITE_EXECUTION_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.supervised_execution_approved !== true) return { ok: false, error: 'SUPABASE_SUPERVISED_EXECUTION_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.project_isolation_approved !== true || runtime.approved_scope_key !== plan.scope?.scope_key) return { ok: false, error: 'SUPABASE_PROJECT_ISOLATION_APPROVAL_REQUIRED', production_deploy: false };
  if (runtime.zero_cost_confirmed !== true || Number(runtime.max_variable_cost_eur) !== 0) return { ok: false, error: 'SUPABASE_ZERO_COST_CONFIRMATION_REQUIRED', production_deploy: false };
  if (typeof runtime.execute_sql !== 'function') return { ok: false, error: 'SUPABASE_SQL_EXECUTOR_REQUIRED', production_deploy: false };

  let applied;
  try {
    applied = await runtime.execute_sql({ provider_id: 'supabase-free', operation: 'staging_schema_and_synthetic_upsert', sql: checked.canonical.statements.apply });
  } catch (error) {
    return { ok: false, error: 'SUPABASE_STAGING_WRITE_FAILED', message: String(error?.message || '').slice(0, 300), external_side_effect_state: 'UNKNOWN_REQUIRES_READ_VERIFICATION', production_deploy: false };
  }
  if (applied?.ok !== true) return { ok: false, error: 'SUPABASE_STAGING_WRITE_REJECTED', external_side_effect_state: 'UNKNOWN_REQUIRES_READ_VERIFICATION', production_deploy: false };

  let verified;
  try {
    verified = await runtime.execute_sql({ provider_id: 'supabase-free', operation: 'verify_synthetic_scope', sql: checked.canonical.statements.verify });
  } catch (error) {
    return { ok: false, error: 'SUPABASE_STAGING_VERIFY_FAILED', message: String(error?.message || '').slice(0, 300), external_side_effect_performed: true, production_deploy: false };
  }
  const row = resultRows(verified)[0] || {};
  if (Number(row.synthetic_row_count) !== 1 || row.synthetic_only !== true) {
    return { ok: false, error: 'SUPABASE_STAGING_VERIFY_MISMATCH', external_side_effect_performed: true, production_deploy: false };
  }
  return {
    ok: true,
    schema: 'riosystems.supabase-staging-crm-write-result.v1',
    stage: 'SUPABASE_STAGING_CRM_WRITE_VERIFIED',
    provider_id: 'supabase-free',
    scope_key: plan.scope.scope_key,
    synthetic_row_count: 1,
    synthetic_test_data_only: true,
    cleanup_available: true,
    secrets_returned: false,
    estimated_variable_cost_eur: 0,
    external_side_effect_performed: true,
    production_deploy: false
  };
}

export function supabaseStagingWriteManifest() {
  return {
    schema: 'riosystems.supabase-staging-write-runner.v1',
    provider_id: 'supabase-free',
    capability: 'business.crm.write',
    isolated_schema: SCHEMA,
    rls_required: true,
    public_roles_revoked: true,
    data_api_exposure: false,
    synthetic_test_data_only: true,
    exact_scope_approval_required: true,
    explicit_external_write_execution_approval_required: true,
    supervised_execution_required: true,
    zero_cost_confirmation_required: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
