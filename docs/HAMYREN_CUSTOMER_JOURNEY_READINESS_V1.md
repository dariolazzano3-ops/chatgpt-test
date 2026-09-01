# HAMYREN Customer Journey Readiness V1

Product identity:

- **HAMYREN**
- **Your Personal Business AI**
- **by AURENTARA SYSTEMS**

This block completes the closed-surface technical contract for the intended first customer journey without activating public traffic, real-customer AI processing, billing, Stripe, or real customer data.

## Journey contract

1. Visitor enters HAMYREN.
2. HAMYREN requests only minimal business context: name, business/company or idea, industry, current objective, and optional country/region.
3. The customer can progress through exactly five free business questions.
4. After the fifth question, the journey hands off to account creation or persistent business context rather than silently creating an account.
5. Subscription readiness is represented as a later handoff. Billing remains inactive.

The goal is to demonstrate persistent business understanding rather than expose a generic chatbot experience.

## Reused architecture

This readiness block does not build a second runtime. It relies on the existing Customer Product Surface, Customer AI foundation, Business State, Memory, goals/decisions, economics/fair-use controls, account surface, launch shield, Legal/Privacy controls and Customer/Operator separation.

Stable internal `aurentara_*` namespaces remain valid. HAMYREN is the visible product identity.

## Fail-closed state

The following remain false:

- `public_customer_surface_active`
- `real_customer_ai_processing_active`
- `billing_active`
- `stripe_active`
- `real_customer_data`

The customer intake normalization explicitly does not authorize persistence or real-customer processing. The five-question contract does not automatically create an account, activate a subscription, expose Operator Control, or activate the public surface.

## Remaining operator gates

The technical journey readiness block does not satisfy or bypass:

1. final Legal/Privacy human review
2. Public Customer Surface activation
3. Real-Customer AI Processing approval

Payment/Stripe activation remains separately deferred and is not required for this zero-cost closed-surface readiness block.

## Validation

Run:

```bash
node --check src/customer-product/hamyren-customer-journey-readiness-v1.js
node --check scripts/hamyren-customer-journey-readiness-v1-smoke.mjs
node scripts/hamyren-customer-journey-readiness-v1-smoke.mjs
node scripts/hamyren-public-customer-surface-readiness-v1-smoke.mjs
node scripts/hamyren-legal-privacy-readiness-v1-smoke.mjs
```

Safety envelope: synthetic validation only, no real customer data, no paid provider call, no Production deploy, variable cost €0.
