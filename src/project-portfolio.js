const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function customerReviewSummary(review = null) {
  if (!review || review.schema !== 'aurentara.customer-review-lifecycle.v1') return null;
  return {
    schema: review.schema,
    status: clean(review.status, 80) || null,
    review_revision: Math.max(0, finite(review.review_revision, 0)),
    normal_revision_count: Math.max(0, finite(review.normal_revision_count, 0)),
    preview_id: clean(review.current_preview?.preview_id, 200) || null,
    source_revision: clean(review.current_preview?.source_revision, 160) || null,
    unresolved_feedback_count: (review.feedback || []).filter((item) => item.resolved !== true).length,
    approval_count: (review.approvals || []).filter((item) => item.granted === true).length,
    production_deploy: false
  };
}

function reviewNextAction(review = null) {
  const status = review?.status || null;
  if (status === 'AWAITING_PRIVATE_PREVIEW') return 'PREPARE_PRIVATE_PREVIEW';
  if (status === 'PREVIEW_REPAIR_REQUIRED') return 'REPAIR_PRIVATE_PREVIEW';
  if (status === 'CUSTOMER_REVIEW') return 'AWAIT_CUSTOMER_REVIEW';
  if (status === 'REVISION_REQUIRED') return 'CUSTOMER_REVISION_REQUIRED';
  if (status === 'SCOPE_REASSESSMENT_REQUIRED') return 'REASSESS_SCOPE_AND_COST';
  if (status === 'CUSTOMER_APPROVED') return 'DELIVERY_REVIEW';
  return null;
}

export function createProjectPortfolio(input = {}) {
  const operatorId = clean(input.operator_id, 160);
  if (!operatorId) return { ok: false, error: 'PORTFOLIO_OPERATOR_REQUIRED' };
  return {
    ok: true,
    portfolio: {
      schema_version: 'riosystems.project-portfolio.v1',
      operator_id: operatorId,
      projects: [],
      audit: [{ event: 'PORTFOLIO_CREATED', actor: operatorId }],
      production_deploy: false
    }
  };
}

export function upsertPortfolioProject(portfolio = {}, project = {}, metadata = {}) {
  if (!project.customer_id || !project.project_id || !project.scope_key) return { ok: false, error: 'PORTFOLIO_PROJECT_INVALID' };
  const next = clone(portfolio);
  const review = customerReviewSummary(project.customer_review);
  const record = {
    customer_id: project.customer_id,
    project_id: project.project_id,
    scope_key: project.scope_key,
    name: project.name || null,
    state: project.state || 'DRAFT',
    budget_cost_units: Math.max(0, finite(project.budget_cost_units, 0)),
    capability_count: (project.capabilities || []).length,
    mission_count: (project.missions || []).length,
    delivery_count: (project.deliveries || []).length,
    customer_review: review,
    priority: Math.max(0, finite(metadata.priority, 100)),
    blocked: metadata.blocked === true || review?.status === 'SCOPE_REASSESSMENT_REQUIRED',
    blocker_count: Math.max(0, finite(metadata.blocker_count, 0)) + (review?.status === 'SCOPE_REASSESSMENT_REQUIRED' ? 1 : 0),
    next_action: clean(metadata.next_action, 500) || reviewNextAction(review),
    production_deploy: false
  };
  const index = (next.projects || []).findIndex((item) => item.scope_key === record.scope_key);
  if (index >= 0) next.projects[index] = record;
  else next.projects = [...(next.projects || []), record];
  next.audit = [...(next.audit || []), { event: index >= 0 ? 'PORTFOLIO_PROJECT_UPDATED' : 'PORTFOLIO_PROJECT_ADDED', scope_key: record.scope_key, actor: portfolio.operator_id || 'system' }];
  return { ok: true, portfolio: next };
}

export function buildOperatorQueue(portfolio = {}) {
  const stateRank = { ACTIVE: 0, READY: 1, PAUSED: 2, DRAFT: 3, DELIVERED: 4, ARCHIVED: 5 };
  const projects = clone(portfolio.projects || []).sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
    const stateDelta = (stateRank[a.state] ?? 9) - (stateRank[b.state] ?? 9);
    if (stateDelta) return stateDelta;
    const priorityDelta = finite(a.priority, 100) - finite(b.priority, 100);
    if (priorityDelta) return priorityDelta;
    return String(a.scope_key).localeCompare(String(b.scope_key));
  });
  return {
    ok: true,
    queue: projects.map((project, index) => ({ rank: index + 1, ...project })),
    blocked_count: projects.filter((item) => item.blocked).length,
    active_count: projects.filter((item) => item.state === 'ACTIVE').length,
    production_deploy: false
  };
}

export function portfolioSnapshot(portfolio = {}) {
  const projects = portfolio.projects || [];
  const byState = {};
  for (const project of projects) byState[project.state] = (byState[project.state] || 0) + 1;
  return {
    operator_id: portfolio.operator_id || null,
    project_count: projects.length,
    blocked_count: projects.filter((item) => item.blocked).length,
    customer_review_pending_count: projects.filter((item) => item.customer_review && item.customer_review.status !== 'CUSTOMER_APPROVED').length,
    total_budget_cost_units: projects.reduce((sum, item) => sum + finite(item.budget_cost_units, 0), 0),
    states: byState,
    production_deploy: false
  };
}

export function projectPortfolioManifest() {
  return {
    version: 'riosystems.project-portfolio.v1',
    single_operator_multi_customer: true,
    deterministic_operator_queue: true,
    dashboard_snapshot_ready: true,
    customer_review_projection: true,
    production_deploy: false
  };
}
