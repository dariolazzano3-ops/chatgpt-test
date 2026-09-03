import {
  CONTROLLED_PAID_STAGING_PROJECT_ID,
  CONTROLLED_PAID_STAGING_MAX_EUR,
  CONTROLLED_PAID_STAGING_CONFIRMATION,
  activateControlledPaidStagingProject,
  controlledPaidStagingSnapshot
} from './operator-controlled-paid-staging-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 320) => String(value ?? '').trim().slice(0, max);

function result(status, body, runtime, changed = false) {
  return {
    ok: status >= 200 && status < 400,
    status,
    body,
    runtime: clone(runtime),
    changed,
    production_deploy: false
  };
}

function atIso(value) {
  const raw = clean(value, 100);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function withControlledPaidStagingActivationService({ service, store, operator_id } = {}) {
  if (!service || typeof service.handle !== 'function') throw new Error('OPERATOR_RUNTIME_SERVICE_REQUIRED');
  if (!store || typeof store.load !== 'function' || typeof store.compareAndSwap !== 'function') throw new Error('OPERATOR_RUNTIME_STORE_REQUIRED');
  const operatorId = clean(operator_id, 160);
  if (!operatorId) throw new Error('OPERATOR_ID_REQUIRED');

  return {
    ...service,

    async activateControlledPaidStaging(input = {}, options = {}) {
      const current = await store.load(operatorId);
      if (!current) return result(404, { error: 'OPERATOR_RUNTIME_NOT_FOUND', production_deploy: false }, null);

      const expectedRevision = Number(input.expected_revision);
      if (!Number.isInteger(expectedRevision)) {
        return result(409, { error: 'RUNTIME_EXPECTED_REVISION_REQUIRED', actual_revision: current.revision, production_deploy: false }, current);
      }
      if (expectedRevision !== current.revision) {
        return result(409, { error: 'RUNTIME_REVISION_CONFLICT', expected_revision: expectedRevision, actual_revision: current.revision, production_deploy: false }, current);
      }

      const scopeKey = clean(input.scope_key, 320);
      const projects = current.command_center_state?.portfolio?.projects || [];
      const index = projects.findIndex((project) => project.scope_key === scopeKey);
      if (index < 0) return result(404, { error: 'PROJECT_NOT_FOUND', scope_key: scopeKey, production_deploy: false }, current);
      const project = projects[index];
      if (clean(project.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID) {
        return result(400, { error: 'CONTROLLED_PAID_STAGING_PROJECT_NOT_ELIGIBLE', production_deploy: false }, current);
      }

      const activation = activateControlledPaidStagingProject(project, {
        project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
        scope_key: scopeKey,
        confirmation_text: clean(input.confirmation_text, 200),
        project_budget_ceiling_eur: Number(input.project_budget_ceiling_eur),
        environment: 'staging',
        paid_provider_permission: true,
        production_locked: true,
        external_write_locked: true,
        public_deploy: false,
        dns_change: false,
        billing: false,
        checkout: false,
        public_indexing: false,
        real_end_customer_data: false,
        automatic_budget_increase: false
      });
      if (!activation.ok) return result(400, activation, current);

      if (!activation.changed) {
        return result(200, {
          schema: 'aurentara.controlled-paid-staging.activation.v1',
          status: 'ACTIVE',
          project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
          scope_key: scopeKey,
          controlled_paid_staging: controlledPaidStagingSnapshot(project),
          runtime_revision: current.revision,
          mission_executed: false,
          idempotent_replay: true,
          production_deploy: false
        }, current, false);
      }

      const next = clone(current);
      next.command_center_state.portfolio.projects[index] = clone(activation.project);
      next.command_center_state.portfolio.production_deploy = false;
      next.selected_project_scope = scopeKey;
      next.revision = current.revision + 1;
      next.updated_at = atIso(options.at);
      next.audit = [
        ...(next.audit || []),
        {
          event: 'CONTROLLED_PAID_STAGING_ACTIVATED',
          actor: operatorId,
          scope_key: scopeKey,
          project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
          project_budget_ceiling_eur: CONTROLLED_PAID_STAGING_MAX_EUR,
          production_deploy: false,
          external_writes: false,
          mission_executed: false,
          at: next.updated_at
        }
      ];
      next.safety = {
        ...(next.safety || {}),
        automatic_paid_overflow: false,
        production_deploy: false
      };

      const saved = await store.compareAndSwap(next, current.revision);
      if (!saved.ok) {
        return result(409, {
          error: saved.error || 'RUNTIME_STORE_CONFLICT',
          expected_revision: current.revision,
          actual_revision: saved.actual_revision ?? null,
          production_deploy: false
        }, current);
      }

      const savedProject = (saved.runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey) || activation.project;
      return result(201, {
        schema: 'aurentara.controlled-paid-staging.activation.v1',
        status: 'ACTIVE',
        project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
        scope_key: scopeKey,
        confirmation: CONTROLLED_PAID_STAGING_CONFIRMATION,
        controlled_paid_staging: controlledPaidStagingSnapshot(savedProject),
        runtime_revision: saved.runtime.revision,
        mission_executed: false,
        production_deploy: false,
        external_writes: false
      }, saved.runtime, true);
    }
  };
}

export function controlledPaidStagingRuntimeServiceManifest() {
  return {
    schema: 'aurentara.controlled-paid-staging-runtime-service.v1',
    existing_runtime_store_reused: true,
    compare_and_swap_persistence: true,
    reference_project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
    budget_eur: CONTROLLED_PAID_STAGING_MAX_EUR,
    mission_execution_on_activation: false,
    external_writes: false,
    production_deploy: false
  };
}
