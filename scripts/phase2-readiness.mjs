import assert from 'node:assert/strict';
import { prepareCustomerProject } from '../src/project-control-plane.js';
import { transitionCustomerProject } from '../src/project-operating-layer.js';
import { createProjectPortfolio, upsertPortfolioProject, buildOperatorQueue, portfolioSnapshot } from '../src/project-portfolio.js';
import { evaluateProjectDelivery } from '../src/project-delivery-gate.js';
import { evaluatePhase2Readiness, phase2ReadinessManifest } from '../src/phase2-readiness.js';

const first = prepareCustomerProject({ customer_id: 'customer-a', project_id: 'alpha', name: 'Alpha', objective: 'Website mit CRM und Lead Automation', budget_cost_units: 50 });
const second = prepareCustomerProject({ customer_id: 'customer-b', project_id: 'beta', name: 'Beta', objective: 'Support KI und Website', budget_cost_units: 30 });
assert.equal(first.ok, true);
assert.equal(second.ok, true);
const firstReady = transitionCustomerProject(first.project, { state: 'READY', actor: 'operator' });
const firstActive = transitionCustomerProject(firstReady.project, { state: 'ACTIVE', actor: 'operator' });
const secondReady = transitionCustomerProject(second.project, { state: 'READY', actor: 'operator' });

let portfolio = createProjectPortfolio({ operator_id: 'rio-operator' }).portfolio;
portfolio = upsertPortfolioProject(portfolio, firstActive.project, { priority: 10, blocked: true, blocker_count: 2, next_action: 'Provider approvals' }).portfolio;
portfolio = upsertPortfolioProject(portfolio, secondReady.project, { priority: 20, blocked: false, next_action: 'Start mission' }).portfolio;
const queue = buildOperatorQueue(portfolio);
assert.equal(queue.queue[0].scope_key, 'customer-a:alpha');
assert.equal(queue.blocked_count, 1);
const snapshot = portfolioSnapshot(portfolio);
assert.equal(snapshot.project_count, 2);
assert.equal(snapshot.total_budget_cost_units, 80);

const deliveryGate = evaluateProjectDelivery(firstActive.project, { capabilities: [], qa_passed: false, scope_verified: true, costs_reconciled: true });
assert.equal(deliveryGate.ready_for_structural_delivery, false);
assert.ok(deliveryGate.blockers.some((item) => item.code === 'PROJECT_QA_REQUIRED'));

const readiness = evaluatePhase2Readiness();
assert.equal(readiness.status, 'ARCHITECTURE_COMPLETE');
assert.equal(readiness.ready, true);
assert.equal(readiness.production_deploy, false);
const manifest = phase2ReadinessManifest();
assert.equal(manifest.dashboard_contract_ready, true);
assert.equal(manifest.production_deploy, false);
console.log(JSON.stringify({ ok: true, suite: 'phase2-readiness', status: readiness.status, snapshot }, null, 2));
