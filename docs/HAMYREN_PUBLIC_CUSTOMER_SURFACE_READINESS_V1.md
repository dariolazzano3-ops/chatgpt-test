# HAMYREN Public Customer Surface Readiness V1

Visible product identity:

- **HAMYREN**
- **Your Personal Business AI**
- **by AURENTARA SYSTEMS**

This block prepares the customer-facing surface for a later controlled public activation. It does **not** activate public traffic and does **not** approve real-customer AI processing.

## Reused architecture

The block reuses the existing Customer Data Plane, Supabase Auth/RLS, privacy export, consent, account deletion, launch shield, rate limiting, trusted retrieval boundary, observability, economics and Customer/Operator separation. Stable internal `aurentara_*` technical namespaces are intentionally preserved.

## Surface readiness

The visible synthetic customer shell and the production account shell now present HAMYREN as the product while retaining AURENTARA SYSTEMS as the maker.

The readiness contract requires:

- HAMYREN visible product identity
- Supabase production account contract
- HttpOnly session cookies
- no service role in browser
- custom-schema RLS
- privacy export
- append-only consent
- JWT/RLS privacy access
- launch shield
- public mode default OFF
- explicit public activation approval
- explicit real-data approval
- production runtime binding
- Customer/Operator route separation

## Explicitly still OFF

The following remain false by design:

- `legal_privacy_review_complete`
- `public_customer_surface_active`
- `real_customer_ai_processing_active`

A unit-level synthetic test may exercise the public-mode state machine with fake configuration, but no public production route is activated by this block.

## Safety

- no public customer traffic
- no real customer data
- no AI provider execution for real customer data
- no paid provider calls
- no billing activation
- no domain/DNS change
- no Production deploy
- variable cost: €0

## Remaining operator gates

1. Legal/Privacy final review and acceptance
2. Public Customer Surface activation
3. Real-Customer AI Processing approval

These are not silently satisfied by technical readiness.
