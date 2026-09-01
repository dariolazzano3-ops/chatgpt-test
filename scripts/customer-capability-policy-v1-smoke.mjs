import { planCustomerCapabilityPathV1 } from '../src/customer-ai/capability-policy-v1.js';

const simple = planCustomerCapabilityPathV1({
  tenant_id: 'synthetic-tenant', business_id: 'synthetic-business', intent: 'ACTION_REQUEST', capability: 'web',
  message: 'Build a simple five-page local business website', requirements: { complexity: 'low', risk_class: 'low' }
});
if (simple.decision.execution_class !== 'SELF_SERVICE') throw new Error('simple self-service classification failed');
if (simple.decision.availability !== 'CUSTOMER_DISABLED') throw new Error('availability truth failed');
if (simple.execution_authorized !== false || simple.production_deploy !== false) throw new Error('safety status failed');

const complex = planCustomerCapabilityPathV1({
  tenant_id: 'synthetic-tenant', business_id: 'synthetic-business', intent: 'ACTION_REQUEST', capability: 'crm',
  message: 'Migrate our CRM with several connected systems', requirements: { complexity: 'high', migration_required: true, integration_count: 4, production_required: true },
  business_context: { industry: 'synthetic' }
});
if (complex.decision.execution_class !== 'AURENTARA_REQUIRED') throw new Error('professional classification failed');
if (!complex.handoff || complex.handoff.execution_authorized !== false) throw new Error('handoff safety failed');
console.log(JSON.stringify({ ok: true, simple: simple.decision.execution_class, complex: complex.decision.execution_class, production: false }));
