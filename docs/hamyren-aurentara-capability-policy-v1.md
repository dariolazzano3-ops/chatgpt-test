# HAMYREN × AURENTARA Capability Policy V1

HAMYREN is the customer-facing Personal Business AI. It understands business context, advises, diagnoses, plans, specifies requirements and prepares solutions. AURENTARA SYSTEMS is the professional implementation and business-systems engine for higher-complexity, custom, migration-heavy, security-sensitive, multi-system or business-critical production work.

The existing `src/capability-router.js` remains the canonical capability registry and routing point. V1 adds three responsibility classes without creating a second router: `AUTONOMOUS`, `SELF_SERVICE` and `AURENTARA_REQUIRED`.

Thinking authority is separate from execution authority. HAMYREN can analyze and plan a complex CRM migration autonomously while its implementation classification remains `AURENTARA_REQUIRED`.

Self-Service eligibility is separate from customer availability. Availability is represented as `DEFINED`, `INTERNAL_ONLY`, `STAGING`, `CUSTOMER_DISABLED` or `CUSTOMER_ENABLED`. Current standardized Self-Service policies remain `CUSTOMER_DISABLED`; defining eligibility does not activate customer execution.

Classification is driven by scope and risk rather than domain alone. Complexity, migration, custom code, integration count, security sensitivity, business criticality, production/customer-data/credential combinations, external writes, cost class and provider readiness can alter the execution path.

The HAMYREN-facing adapter is `src/customer-ai/capability-policy-v1.js`. When professional implementation is required it prepares a structured AURENTARA handoff containing tenant/business identity, goal, problem statement, business context, solution, capabilities, existing systems, integration/migration/data requirements, complexity, risk, priorities, success criteria and open questions. The handoff reuses `compileProjectBlueprint()` and the existing web/automation/ai/business factory mapping instead of creating a parallel project contract.

Every professional handoff is `planned_only`, `execution_authorized: false` and `production_deploy: false`. Existing approval, production, provider, cost and external-write gates remain authoritative.

Capabilities may move from `AURENTARA_REQUIRED` to `SELF_SERVICE` over time by changing policy metadata, maturity and thresholds rather than redesigning HAMYREN or duplicating AURENTARA architecture.
