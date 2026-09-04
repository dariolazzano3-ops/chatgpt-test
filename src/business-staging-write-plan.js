const cleanSlug = (value) => String(value || '').trim().toLowerCase();
const SCOPE_PART = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCHEMA = 'public';
const TABLES = Object.freeze(['customer_projects','contacts','leads','lead_events','provider_execution_refs','audit_log']);
const CONFIRMATION = 'APPLY_SUPABASE_STAGING_CRM_ONCE';

function validScopePart(value) {
  return SCOPE_PART.test(value);
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function uuidLiteral(value) {
  return `${literal(value)}::uuid`;
}

function identifiers(scope) {
  const base = `${scope.customer_id}-${scope.project_id}`;
  return {
    project_slug: `${base}-staging`,
    contact_ref: `${base}-synthetic-contact-001`,
    lead_key: `${base}-synthetic-lead-001`,
    event_key: `${base}-synthetic-lead-event-001`,
    provider_key: `${base}-synthetic-provider-ref-001`,
    audit_key: `${base}-synthetic-audit-001`
  };
}

function relationalUpsertSql(scope) {
  const ids = identifiers(scope);
  return `begin;
insert into public.customer_projects (id, slug, display_name, environment, source, audit_meta)
values (
  ${uuidLiteral(scope.project_uuid)},
  ${literal(ids.project_slug)},
  'Synthetic Staging Project',
  'staging',
  'riosystems-staging-write-plan',
  '{"synthetic":true,"source":"business-staging-write-plan"}'::jsonb
)
on conflict (slug) do update set
  updated_at = now()
where public.customer_projects.id = excluded.id
  and public.customer_projects.environment = 'staging';

insert into public.contacts (project_id, external_ref, email, full_name, source, attributes, audit_meta)
values (
  ${uuidLiteral(scope.project_uuid)},
  ${literal(ids.contact_ref)},
  null,
  null,
  'synthetic-website',
  '{"synthetic":true,"consent":false}'::jsonb,
  '{"synthetic":true,"source":"business-staging-write-plan"}'::jsonb
)
on conflict (project_id, external_ref) where external_ref is not null
do update set
  full_name = excluded.full_name,
  attributes = excluded.attributes,
  audit_meta = excluded.audit_meta;

insert into public.leads (project_id, contact_id, idempotency_key, status, source, source_ref, payload, audit_meta)
values (
  ${uuidLiteral(scope.project_uuid)},
  (select id from public.contacts where project_id = ${uuidLiteral(scope.project_uuid)} and external_ref = ${literal(ids.contact_ref)}),
  ${literal(ids.lead_key)},
  'validated',
  'synthetic-website',
  'business-staging-write-plan',
  '{"synthetic":true,"classification":"staging_e2e"}'::jsonb,
  '{"synthetic":true,"source":"business-staging-write-plan"}'::jsonb
)
on conflict (project_id, idempotency_key)
do update set
  status = excluded.status,
  payload = excluded.payload,
  audit_meta = excluded.audit_meta,
  updated_at = now();

insert into public.lead_events (project_id, lead_id, event_type, idempotency_key, source, event_payload, audit_meta)
select
  ${uuidLiteral(scope.project_uuid)},
  id,
  'lead_persisted',
  ${literal(ids.event_key)},
  'riosystems-staging-write-plan',
  '{"synthetic":true}'::jsonb,
  '{"synthetic":true}'::jsonb
from public.leads
where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.lead_key)}
on conflict (project_id, idempotency_key)
do update set event_payload = excluded.event_payload;

insert into public.provider_execution_refs (project_id, lead_id, provider, capability, external_execution_ref, idempotency_key, execution_state, cost_eur, metadata, audit_meta)
select
  ${uuidLiteral(scope.project_uuid)},
  id,
  'supabase-free',
  'crm-persist',
  'business-staging-write-plan',
  ${literal(ids.provider_key)},
  'succeeded',
  0,
  '{"synthetic":true}'::jsonb,
  '{"synthetic":true}'::jsonb
from public.leads
where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.lead_key)}
on conflict (project_id, provider, idempotency_key)
do update set execution_state = excluded.execution_state, cost_eur = excluded.cost_eur;

insert into public.audit_log (project_id, entity_type, entity_id, action, actor_type, actor_ref, request_id, idempotency_key, metadata)
select
  ${uuidLiteral(scope.project_uuid)},
  'lead',
  id,
  'synthetic_staging_write_verified',
  'riosystems-operator',
  'business-staging-write-plan',
  ${literal(`${ids.audit_key}-request`)},
  ${literal(ids.audit_key)},
  '{"synthetic":true,"production":false,"external_paid_cost_eur":0}'::jsonb
from public.leads
where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.lead_key)}
on conflict (project_id, idempotency_key) where idempotency_key is not null
do update set metadata = excluded.metadata;
commit;`;
}

function verificationSql(scope) {
  const ids = identifiers(scope);
  return `select
  count(*)::int as synthetic_row_count,
  coalesce(bool_and((payload ->> 'synthetic') = 'true'), false) as synthetic_only,
  (select count(*)::int from public.audit_log where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.audit_key)}) as audit_count
from public.leads
where project_id = ${uuidLiteral(scope.project_uuid)}
  and idempotency_key = ${literal(ids.lead_key)};`;
}

function cleanupSql(scope) {
  const ids = identifiers(scope);
  return `begin;
delete from public.provider_execution_refs where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.provider_key)};
delete from public.lead_events where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.event_key)};
delete from public.audit_log where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.audit_key)};
delete from public.leads where project_id = ${uuidLiteral(scope.project_uuid)} and idempotency_key = ${literal(ids.lead_key)} and (payload ->> 'synthetic') = 'true';
delete from public.contacts where project_id = ${uuidLiteral(scope.project_uuid)} and external_ref = ${literal(ids.contact_ref)} and (attributes ->> 'synthetic') = 'true';
commit;`;
}

export function buildSupabaseStagingCrmWritePlan(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const customerId = cleanSlug(input.customer_id);
  const projectId = cleanSlug(input.project_id);
  const projectUuid = String(input.project_uuid || '').trim().toLowerCase();
  if (!validScopePart(customerId) || !validScopePart(projectId) || !UUID.test(projectUuid)) {
    return { ok: false, error: 'STAGING_PROJECT_SCOPE_INVALID', production_deploy: false };
  }
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.real_customer_data === true) {
    return { ok: false, error: 'SYNTHETIC_ISOLATED_STAGING_REQUIRED', production_deploy: false };
  }
  const scope = {
    customer_id: customerId,
    project_id: projectId,
    project_uuid: projectUuid,
    scope_key: `${customerId}:${projectId}`
  };
  return {
    ok: true,
    schema: 'riosystems.supabase-staging-crm-write-plan.v2',
    provider_id: 'supabase-free',
    capability: 'business.crm.write',
    state: 'WRITE_PLAN_READY_EXISTING_FOUNDATION',
    scope,
    database: {
      schema_name: SCHEMA,
      tables: [...TABLES],
      foundation_migrations_required: ['20260830013445','20260830013612'],
      data_api_exposure: 'not_relied_upon',
      rls_enabled: true,
      rls_forced: true,
      anon_access: false,
      authenticated_access: 'project_claim_scoped',
      idempotency_scope: 'project_id_plus_idempotency_key'
    },
    statements: {
      apply: relationalUpsertSql(scope),
      verify: verificationSql(scope),
      cleanup_synthetic_rows: cleanupSql(scope)
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
  if (plan.schema !== 'riosystems.supabase-staging-crm-write-plan.v2' || plan.state !== 'WRITE_PLAN_READY_EXISTING_FOUNDATION' || plan.provider_id !== 'supabase-free') {
    return { ok: false, error: 'SUPABASE_STAGING_WRITE_PLAN_REQUIRED' };
  }
  const canonical = buildSupabaseStagingCrmWritePlan({
    customer_id: plan.scope?.customer_id,
    project_id: plan.scope?.project_id,
    project_uuid: plan.scope?.project_uuid,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    production_deploy: false
  });
  if (!canonical.ok) return { ok: false, error: 'SUPABASE_STAGING_WRITE_PLAN_REQUIRED' };
  const sameScope = JSON.stringify(plan.scope) === JSON.stringify(canonical.scope);
  const sameDatabase = JSON.stringify(plan.database) === JSON.stringify(canonical.database);
  const sameStatements = plan.statements?.apply === canonical.statements.apply
    && plan.statements?.verify === canonical.statements.verify
    && plan.statements?.cleanup_synthetic_rows === canonical.statements.cleanup_synthetic_rows;
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
    applied = await runtime.execute_sql({ provider_id: 'supabase-free', operation: 'staging_relational_synthetic_upsert', sql: checked.canonical.statements.apply });
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
  if (Number(row.synthetic_row_count) !== 1 || row.synthetic_only !== true || Number(row.audit_count) !== 1) {
    return { ok: false, error: 'SUPABASE_STAGING_VERIFY_MISMATCH', external_side_effect_performed: true, production_deploy: false };
  }
  return {
    ok: true,
    schema: 'riosystems.supabase-staging-crm-write-result.v2',
    stage: 'SUPABASE_STAGING_CRM_WRITE_VERIFIED',
    provider_id: 'supabase-free',
    scope_key: plan.scope.scope_key,
    project_uuid: plan.scope.project_uuid,
    synthetic_row_count: 1,
    audit_count: 1,
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
    schema: 'riosystems.supabase-staging-write-runner.v2',
    provider_id: 'supabase-free',
    capability: 'business.crm.write',
    foundation_schema: SCHEMA,
    foundation_tables: [...TABLES],
    foundation_migrations: ['20260830013445','20260830013612'],
    rls_required: true,
    public_anonymous_access: false,
    authenticated_access: 'project_claim_scoped',
    data_api_exposure: 'not_relied_upon',
    synthetic_test_data_only: true,
    exact_scope_approval_required: true,
    explicit_external_write_execution_approval_required: true,
    supervised_execution_required: true,
    zero_cost_confirmation_required: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
