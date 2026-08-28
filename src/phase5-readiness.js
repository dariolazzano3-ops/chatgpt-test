import { commandCenterManifest } from './command-center.js';
import { commandCenterApiManifest } from './command-center-api.js';
import { phase4ReadinessManifest } from './phase4-readiness.js';
import { projectPortfolioManifest } from './project-portfolio.js';

export function evaluatePhase5Readiness() {
  const phase4 = phase4ReadinessManifest();
  const center = commandCenterManifest();
  const api = commandCenterApiManifest();
  const portfolio = projectPortfolioManifest();
  const checks = {
    phase4_complete_contract: phase4.production_deploy === false,
    operator_portfolio_surface: center.surfaces?.includes('portfolio') === true && portfolio.dashboard_snapshot_ready === true,
    approvals_surface: center.surfaces?.includes('approvals') === true,
    executions_surface: center.surfaces?.includes('executions') === true,
    integration_health_surface: center.surfaces?.includes('integration_health') === true,
    alert_surface: center.surfaces?.includes('alerts') === true,
    command_api: api.routes?.includes('POST /commands') === true,
    snapshot_api: api.routes?.includes('GET /snapshot') === true,
    supervised_dispatch: api.supervised_dispatch_injection === true,
    fail_closed_commands: center.command_dispatch_fail_closed === true,
    no_implicit_external_side_effects: center.external_side_effects_implicit === false,
    production_disabled: [phase4, center, api, portfolio].every((item) => item.production_deploy === false)
  };
  const blockers = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  return { ok: true, phase: 5, status: blockers.length ? 'INCOMPLETE' : 'ARCHITECTURE_COMPLETE', ready: blockers.length === 0, checks, blockers, production_deploy: false };
}

export function phase5ReadinessManifest() {
  return {
    version: 'riosystems.phase5.readiness.v1',
    scope: ['command_center','operator_dashboard_contract','command_api','supervised_dispatch'],
    visual_frontend_optional_for_architecture_completion: true,
    production_deploy: false
  };
}
