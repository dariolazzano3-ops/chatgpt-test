# HAMYREN Private Prelaunch Preview V1

**HAMYREN · Your Personal Business AI · by AURENTARA SYSTEMS**

This directory is the visual/productization layer for a protected private prelaunch preview. It does not create a second HAMYREN runtime and does not replace the existing Customer Product Surface, Customer AI, Memory, Business State, Economics, Account, Privacy, Launch Shield or Operator Control architecture in `factory-control`.

## Productization objective

Translate the existing technical contracts into a coherent customer-visible experience:

`PRODUCT PRESENTATION → MINIMAL BUSINESS INTAKE → 5 FREE BUSINESS QUESTIONS → ACCOUNT / PERSISTENT CONTEXT HANDOFF → PLAN / UPGRADE PREVIEW → MEMORY / GOALS / DECISIONS → TRUST / PRIVACY`

The experience must communicate one core idea: HAMYREN is not a generic chatbot. It is a Personal Business AI designed to understand a business over time through structured business context, memory, goals and decisions.

## Files

- `index.html` — HAMYREN product presentation and prelaunch customer story.
- `experience.html` — separate interactive product experience.
- `hamyren.css` — HAMYREN visual system layered on the existing AURENTARA design language.
- `hamyren.js` — deterministic local-only preview interactions. No provider calls and no persistence.
- `project.json` — hard-gate and preview-state contract.

## Reused canonical contracts

The preview reflects existing repository contracts, including:

- exactly five free business questions;
- minimal intake: name, business/company or idea, industry, current objective, optional country/region;
- explicit handoff after question five rather than silent account creation;
- Customer / Operator separation;
- memory, goals and decisions as customer-visible product concepts;
- Free Starter, Founder launch reference and Standard Candidate plan architecture;
- payment/checkout gate remaining inactive;
- controlled prelaunch state remaining separate from Public mode;
- B2B-only V1 scope as a recorded operator decision pending final human legal review.

## Hard gates

The preview must remain fail-closed:

- no Public launch;
- no Production deploy;
- no custom domain or DNS switch;
- no real customer data;
- no real-customer AI processing;
- no Stripe, checkout, invoices or billing activation;
- no paid provider calls;
- no external writes;
- no Operator Control access;
- no automatic account creation;
- no automatic plan activation;
- no claim that final Legal/Privacy review is complete.

The parent website `_headers` contract sets `X-Robots-Tag: noindex, nofollow`, denies payment/camera/microphone/geolocation, and sets `connect-src 'none'`. The preview itself therefore makes no network request.

## Demo-data rule

Use only synthetic demonstration data. The interactive experience keeps state in JavaScript memory for the current page lifetime only. It intentionally does not use LocalStorage, IndexedDB, cookies or external APIs.

## Pricing wording

Repository economics currently define:

- Free · Starter: €0;
- Personal Business AI · Founder: €19.90/month launch reference, planned and not currently sold;
- Personal Business AI · Standard Candidate: €24.90/month long-term candidate, not a public launch plan.

The preview must preserve those qualifiers. Upgrade actions are presentation-only and must resolve to a closed payment-provider gate.

## Legal wording boundary

The V1 customer scope is recorded as B2B-only, but final legal/privacy acceptance remains pending. Any eligibility or legal language in the preview is therefore marked as review copy and must not be treated as approved publication text.

## Completion standard

A Productization pass is complete only when desktop and mobile surfaces tell one coherent story, the five-question journey is understandable without technical knowledge, the plan gate cannot be mistaken for live checkout, privacy/trust states are visible, and the interface never implies that live public processing is active.
