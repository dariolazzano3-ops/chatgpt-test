const clone = (value) => structuredClone(value ?? null);
const money = (value) => Number(value || 0);

function runMatches(run = {}, project = {}) {
  return run?.mission?.customer_id === project.customer_id && run?.mission?.project_id === project.project_id;
}

function latestRunAt(runtime = {}, missionId = '') {
  return (runtime.audit || []).findLast?.((item) => item.mission_id === missionId)?.at
    || [...(runtime.audit || [])].reverse().find((item) => item.mission_id === missionId)?.at
    || null;
}

function groupRows(rows = [], keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    const current = groups.get(key) || { key, runs: 0, spent_eur: 0, reserved_eur: 0, estimated_eur: 0 };
    current.runs += 1;
    current.spent_eur += money(row.spent_eur);
    current.reserved_eur += money(row.reserved_eur);
    current.estimated_eur += money(row.estimated_eur);
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function buildOperatorProjectDetail({ runtime = {}, scope_key = '', pending_plans = [], ui_audit = [] } = {}) {
  const projects = runtime.command_center_state?.portfolio?.projects || [];
  const project = projects.find((item) => item.scope_key === scope_key);
  if (!project) return { ok: false, error: 'OPERATOR_PROJECT_DETAIL_NOT_FOUND', scope_key, production_deploy: false };

  const runs = (runtime.universal_runs || []).filter((run) => runMatches(run, project));
  const latest = runs.at(-1) || null;
  const pending = pending_plans.filter((item) => item.scope_key === scope_key);
  const execution = latest?.execution?.results || [];
  const capabilities = latest
    ? (latest.plan?.selected_capabilities || []).map((task) => {
        const result = execution.find((item) => item.capability === task.capability);
        return {
          capability: task.capability,
          factory: task.factory,
          provider: result?.provider || task.provider?.primary || null,
          provider_reason: result?.provider_selection_reason || task.provider?.selection_reason || null,
          alternatives: [task.provider?.fallback].filter(Boolean),
          status: result?.status || task.status || 'PLANNED',
          reality: result ? 'SYNTHETIC' : 'PLANNED',
          dependencies: clone(task.dependencies || []),
          retry_count: result?.retries?.length || 0,
          quality_score: latest.quality?.quality_score ?? null,
          expected_deliverable: task.expected_deliverable || null,
          last_action: result ? 'SYNTHETIC_EXECUTION_COMPLETED' : 'PLAN_CREATED',
          next_action: result ? (latest.quality?.status === 'PASS' ? 'DELIVERY_REVIEW' : 'QUALITY_REVIEW') : 'APPROVAL_REQUIRED'
        };
      })
    : (pending.at(-1)?.selected_capabilities || []).map((task) => ({ ...clone(task), status: 'PLANNED', reality: 'PLANNED' }));

  const blockers = [
    ...(project.blocked ? [project.blocker || 'PROJECT_BLOCKED'] : []),
    ...(latest?.quality?.failures || [])
  ].filter(Boolean);

  let progress = 0;
  if (latest?.delivery?.final_delivery_status === 'SIMULATED_HANDOFF_READY' && latest?.quality?.status === 'PASS') progress = 100;
  else if (latest?.execution?.status === 'SYNTHETIC_STAGING_COMPLETED') progress = 80;
  else if (latest?.plan) progress = 40;
  else if (pending.length) progress = 25;

  const missionIds = new Set(runs.map((run) => run.mission?.mission_id).filter(Boolean));
  const timeline = [
    ...(runtime.audit || []).filter((item) => item.scope_key === scope_key || missionIds.has(item.mission_id)),
    ...ui_audit.filter((item) => item.scope_key === scope_key || missionIds.has(item.mission_id))
  ].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

  const delivery = latest?.delivery || null;
  const projectCost = runs.reduce((sum, run) => sum + money(run.execution?.variable_cost_eur), 0);

  return {
    ok: true,
    schema: 'riosystems.operator-project-detail.v1',
    project: {
      ...clone(project),
      environment: latest?.mission?.environment || 'staging',
      data_mode: latest?.mission?.data_policy?.synthetic_only === true ? 'synthetic_only' : 'NOT_VERIFIED',
      mission_status: latest?.delivery?.final_delivery_status || (pending.length ? 'APPROVAL_REQUIRED' : project.state || 'READY'),
      progress_percent: progress,
      mission_count: runs.length,
      delivery_count: runs.filter((run) => Boolean(run.delivery)).length,
      current_cost_eur: projectCost,
      open_approval_count: pending.length,
      blocker_count: blockers.length,
      last_status_change: timeline.at(-1)?.at || latestRunAt(runtime, latest?.mission?.mission_id) || runtime.updated_at || null
    },
    current_mission: latest?.mission || null,
    capabilities,
    dependencies: capabilities.map((item) => ({ capability: item.capability, depends_on: clone(item.dependencies || []) })),
    execution_order: clone(latest?.plan?.execution_order || []),
    approvals: clone(pending),
    blockers,
    timeline,
    results: {
      delivery,
      deliverables: clone(delivery?.deliverables || []),
      quality: clone(latest?.quality || null),
      execution_evidence: clone(delivery?.execution_evidence || null)
    },
    reality: latest ? 'SYNTHETIC' : pending.length ? 'PLANNED' : 'NOT_VERIFIED',
    production_deploy: false
  };
}

export function buildOperatorCostCenter({ runtime = {}, snapshot = {} } = {}) {
  const projects = runtime.command_center_state?.portfolio?.projects || [];
  const runs = runtime.universal_runs || [];
  const rows = [];
  for (const run of runs) {
    const project = projects.find((item) => runMatches(run, item));
    const runCost = money(run.execution?.variable_cost_eur);
    const results = run.execution?.results || [];
    if (!results.length) {
      rows.push({ project: project?.name || run.mission?.project_id, project_id: run.mission?.project_id, mission_id: run.mission?.mission_id, factory: 'unknown', capability: 'unknown', provider: 'unknown', spent_eur: runCost, reserved_eur: 0, estimated_eur: 0 });
      continue;
    }
    for (const result of results) {
      rows.push({
        project: project?.name || run.mission?.project_id,
        project_id: run.mission?.project_id,
        mission_id: run.mission?.mission_id,
        factory: result.factory,
        capability: result.capability,
        provider: result.provider,
        spent_eur: runCost / results.length,
        reserved_eur: 0,
        estimated_eur: 0
      });
    }
  }

  const universalCost = rows.reduce((sum, row) => sum + money(row.spent_eur), 0);
  const liveProofCost = money(snapshot.control_plane?.cost?.live_proof_variable_cost_eur);
  const spent = universalCost + liveProofCost;
  const ceiling = money(snapshot.control_plane?.cost?.development_ceiling_eur);
  return {
    schema: 'riosystems.operator-cost-center.v2',
    spent_eur: spent,
    reserved_eur: 0,
    estimated_eur: 0,
    fixed_cost_eur: 0,
    variable_cost_eur: spent,
    remaining_development_budget_eur: Math.max(0, ceiling - spent),
    development_ceiling_eur: ceiling,
    variable_cost_state: spent === 0 ? 'ESTIMATED_ZERO' : 'PAID_APPROVAL_REQUIRED',
    unallocated_live_proof_cost_eur: liveProofCost,
    by_project: groupRows(rows, (row) => row.project),
    by_mission: groupRows(rows, (row) => row.mission_id),
    by_factory: groupRows(rows, (row) => row.factory),
    by_capability: groupRows(rows, (row) => row.capability),
    by_provider: groupRows(rows, (row) => row.provider),
    automatic_paid_overflow: false,
    paid_execution_authorized: false,
    production_deploy: false
  };
}

export function buildFactoryOperations({ runtime = {}, snapshot = {} } = {}) {
  const runs = runtime.universal_runs || [];
  const base = snapshot.control_plane?.factories?.items || [];
  return {
    schema: 'riosystems.operator-factory-operations.v1',
    items: base.map((factory) => {
      const results = runs.flatMap((run) => (run.execution?.results || []).map((result) => ({ run, result }))).filter((item) => item.result.factory === factory.factory);
      const scores = results.map((item) => Number(item.run.quality?.quality_score)).filter(Number.isFinite);
      const last = results.at(-1);
      return {
        ...clone(factory),
        current_jobs: 0,
        queue_depth: 0,
        execution_count: results.length,
        last_successful_execution: last ? latestRunAt(runtime, last.run.mission?.mission_id) : null,
        last_failed_execution: null,
        active_providers: [...new Set(results.map((item) => item.result.provider).filter(Boolean))],
        variable_cost_eur: results.reduce((sum, item) => sum + money(item.run.execution?.variable_cost_eur) / Math.max(1, item.run.execution?.results?.length || 1), 0),
        quality_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        open_blockers: results.flatMap((item) => item.run.quality?.failures || []),
        ci_verification: 'NOT_PROJECTED_IN_RUNTIME',
        production_deploy: false
      };
    }),
    production_deploy: false
  };
}

export function buildProviderOperations({ runtime = {}, snapshot = {} } = {}) {
  const activation = snapshot.control_plane?.providers || {};
  const results = (runtime.universal_runs || []).flatMap((run) => (run.execution?.results || []).map((result) => ({ run, result })));
  const names = [...new Set(results.map((item) => item.result.provider).filter(Boolean))];
  return {
    schema: 'riosystems.operator-provider-operations.v1',
    source_of_truth: activation.source_of_truth || 'provider-stack-v1',
    activation_matrix: clone(activation.activation_matrix || {}),
    active_runtime_providers: names.map((name) => ({
      name,
      execution_count: results.filter((item) => item.result.provider === name).length,
      variable_cost_eur: 0,
      reality: 'SYNTHETIC_ROUTE_ONLY',
      credentials_exposed: false,
      production_deploy: false
    })),
    production_deploy: false
  };
}

export function buildAuditView({ runtime = {}, ui_audit = [] } = {}) {
  return {
    schema: 'riosystems.operator-audit-view.v2',
    items: [...(runtime.command_center_state?.audit || []), ...(runtime.audit || []), ...ui_audit]
      .map((item) => clone(item))
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))),
    production_deploy: false
  };
}
