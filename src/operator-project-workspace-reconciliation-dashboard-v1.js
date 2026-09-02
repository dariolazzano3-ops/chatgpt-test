import { handleOperatorDashboard as handleExistingProjectWorkspaceDashboard } from './operator-project-workspace-dashboard-v1.js';
import {
  resolveAurentaraProjectCurrentTruth,
  reconcileOperatorProjectWorkspace
} from './operator-project-workspace-reconciliation-v1.js';

function jsonResponse(body, source) {
  const headers = new Headers(source.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-aurentara-project-workspace-reconciliation-v1', 'enabled');
  return new Response(JSON.stringify(body, null, 2), {
    status: source.status,
    statusText: source.statusText,
    headers
  });
}

function isWorkspaceSnapshotGet(request) {
  if (request.method !== 'GET') return false;
  const pathname = new URL(request.url).pathname;
  return /^\/operator\/api\/project-workspace\/[^/]+$/.test(pathname);
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const response = await handleExistingProjectWorkspaceDashboard(request, env, ctx, options);
  if (!response || response.status !== 200 || !isWorkspaceSnapshotGet(request)) return response;

  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response;

  let snapshot;
  try { snapshot = await response.clone().json(); } catch { return response; }
  if (snapshot?.schema !== 'riosystems.operator-project-workspace.v1') return response;

  const truth = await resolveAurentaraProjectCurrentTruth(env, options.runtime_service || null);
  const reconciled = reconcileOperatorProjectWorkspace(snapshot, truth);
  return jsonResponse(reconciled, response);
}

export function operatorProjectWorkspaceReconciliationDashboardManifest() {
  return {
    schema: 'riosystems.operator-project-workspace-reconciliation-dashboard.v1',
    wraps_existing_workspace_dashboard: true,
    registration_metadata_is_historical: true,
    current_project_truth: 'github_canonical_project_path_plus_existing_runtime',
    preview_truth_unchanged: true,
    production_deploy: false,
    external_writes: false,
    paid_provider_calls: 0,
    additional_variable_cost_eur: 0
  };
}
