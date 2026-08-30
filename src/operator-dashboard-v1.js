const clone = (value) => structuredClone(value ?? null);

export function buildOperatorDashboardView(controlPlane = {}) {
  if (!controlPlane.ok || controlPlane.schema !== 'riosystems.operator-control-plane.v1') {
    return { ok: false, error: 'VALID_CONTROL_PLANE_REQUIRED', production_deploy: false };
  }
  const ready = controlPlane.readiness.live_staging_control_ready === true;
  const attention = controlPlane.readiness.status === 'OPERATOR_ATTENTION_REQUIRED';
  const metrics = {
    projects: controlPlane.command_center.portfolio.project_count,
    blocked_projects: controlPlane.command_center.portfolio.blocked_count,
    pending_approvals: controlPlane.command_center.approvals.pending_count,
    execution_runs: controlPlane.command_center.executions.count,
    waiting_runs: controlPlane.command_center.executions.waiting_count,
    live_factories: controlPlane.factories.summary.live_staging_verified,
    strategy_factories: controlPlane.factories.summary.strategy_engines_ready,
    live_e2e_proofs: controlPlane.deliveries.summary.live_e2e_proof_count,
    mission_reports: controlPlane.deliveries.summary.mission_count,
    variable_cost_eur: controlPlane.cost.live_proof_variable_cost_eur
  };

  const deliveryFeed = [
    ...(controlPlane.deliveries.live_proofs || []).map((proof) => ({
      id: proof.proof_id,
      kind: proof.kind,
      scope: proof.project_scope,
      status: proof.status,
      qa_passed: proof.qa_passed,
      providers: clone(proof.provider_chain),
      variable_cost_eur: proof.variable_cost_eur,
      production_deploy: false
    })),
    ...(controlPlane.deliveries.mission_reports || []).map((report) => ({
      id: report.mission_id,
      kind: 'mission_delivery',
      scope: report.project?.scope_key || report.project?.project_id || null,
      status: report.completion_class,
      qa_passed: report.structural_completion === true,
      providers: Object.keys(report.by_engine || {}),
      unresolved_count: (report.unresolved || []).length,
      production_deploy: false
    }))
  ];

  return {
    ok: true,
    schema: 'riosystems.operator-dashboard-view.v1',
    hero: {
      code: controlPlane.readiness.status,
      label: attention ? 'ATTENTION REQUIRED' : ready ? 'LIVE STAGING READY' : 'CONTROL PLANE READY',
      subtitle: ready ? 'Core factories and cross-provider staging proof are verified.' : 'The control plane is active; remaining readiness gates are visible below.'
    },
    metrics,
    project_queue: clone(controlPlane.command_center.queue),
    factory_cards: controlPlane.factories.items.map((item) => ({ factory: item.factory, role: item.role, status: item.status, provider_path: clone(item.provider_path), production_deploy: false })),
    delivery_feed: deliveryFeed,
    approvals: clone(controlPlane.command_center.approvals),
    execution_summary: clone(controlPlane.command_center.executions),
    alerts: clone(controlPlane.alerts),
    action_queue: clone(controlPlane.next_actions),
    safety_panel: {
      production: 'LOCKED',
      external_writes: 'EXPLICIT_APPROVAL_ONLY',
      paid_execution: 'EXPLICIT_APPROVAL_ONLY',
      automatic_paid_overflow: 'DISABLED',
      customer_data: 'SYNTHETIC_ONLY_FOR_CURRENT_STAGING',
      development_cost_ceiling_eur: controlPlane.cost.development_ceiling_eur
    },
    production_deploy: false
  };
}

export function operatorDashboardManifest() {
  return {
    schema: 'riosystems.operator-dashboard-view.v1',
    presentation_only: true,
    backend_contract: 'riosystems.operator-control-plane.v1',
    sections: ['hero','metrics','project_queue','factory_cards','delivery_feed','approvals','execution_summary','alerts','action_queue','safety_panel'],
    direct_provider_calls: false,
    external_mutations: false,
    production_deploy: false
  };
}
