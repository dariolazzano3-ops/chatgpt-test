import assert from 'node:assert/strict';
import { evaluateProductionReadiness, authorizeProductionActivation } from '../src/production-readiness.js';
import { createResiliencePolicy, evaluateResilienceEvidence } from '../src/operations-resilience.js';
import { defineTenantPlan, evaluateProductizationReadiness } from '../src/productization-boundary.js';

const base = {
  source_revision_bound:true, phase5_ready:true, ci_green:true, secrets_externalized:true,
  credential_rotation_defined:true, least_privilege_reviewed:true, backup_defined:true,
  restore_tested:true, observability_defined:true, incident_runbook_defined:true,
  rollback_defined:true, provider_cost_limits_defined:true, customer_isolation_verified:true,
  external_write_approvals_defined:true
};
const blocked = evaluateProductionReadiness(base);
assert.equal(blocked.ready_for_production_activation, false);
assert.equal(authorizeProductionActivation(blocked,{explicit_go:true,actor:'operator'}).ok,false);
const ready = evaluateProductionReadiness({...base,operator_production_approval:true});
assert.equal(ready.ready_for_production_activation,true);
assert.equal(authorizeProductionActivation(ready,{explicit_go:true,actor:'operator',revision:'a'.repeat(40)}).ok,true);

const policy=createResiliencePolicy({incident_runbook:'docs/INCIDENT-RUNBOOK.md'});
assert.equal(evaluateResilienceEvidence(policy,{backup_recent:true,backup_encrypted:true,restore_test_passed:true,rollback_revision_verified:true,incident_runbook_verified:true,observability_alerts_verified:true}).ok,true);
assert.equal(defineTenantPlan({tenant_id:'customer-a',allowed_capabilities:['website','crm']}).ok,true);
assert.equal(evaluateProductizationReadiness({tenant_isolation:true,tenant_scoped_approvals:true,tenant_scoped_costs:true,tenant_scoped_audit:true,onboarding_contract:true,offboarding_export_contract:true,role_model_defined:true,billing_boundary_defined:true}).ready,true);
console.log('RIOSYSTEMS_PHASE6_SMOKE_OK');
