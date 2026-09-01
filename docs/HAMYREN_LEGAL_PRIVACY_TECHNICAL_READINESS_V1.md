# HAMYREN Legal & Privacy Technical Readiness V1

## Product identity

**HAMYREN**  
**Your Personal Business AI**  
**by AURENTARA SYSTEMS**

This document is a technical readiness package. It is not legal advice, does not certify GDPR or AI-law compliance, and does not complete the human `legal_privacy_review` launch gate.

## Reused technical controls

HAMYREN reuses the existing Customer AI architecture rather than creating a second privacy stack. The current technical foundation already provides a dedicated Customer Data Plane separate from the private AURENTARA control environment, tenant and conversation-owner isolation, RLS/JWT authorization, append-only consent events with policy versions and withdrawal, business-data export, correction/supersession, an authenticated hard-delete executor with synthetic end-to-end verification, retention contracts, trusted-research controls and content-minimized technical telemetry.

The existing stable technical namespaces remain unchanged, including the `aurentara_customer_ai` database schema, `aurentara-delete-account-v1` Edge Function, AURENTARA-prefixed runtime environment variables and internal session-cookie names.

## HAMYREN-visible privacy contract

The customer-facing deletion confirmation phrase is now `DELETE_MY_HAMYREN_DATA`. The existing internal deletion Edge Function contract remains unchanged and is mapped only inside the server-side privacy adapter. The internal confirmation token is not exposed in the public manifest or customer response.

The trust-surface copy must communicate that HAMYREN is an AI system, that important outputs require review, that customers can review/correct/export/delete stored business information and manage supported consent choices, and that high-impact tax/legal/employment/regulatory questions require current authoritative sources and professional verification where appropriate.

No customer-facing text may imply that technical readiness itself equals legal approval.

## Current processor and service categories represented by the architecture

The technical review pack must account for the services actually represented in the product architecture: Cloudflare for the dedicated Customer Worker and observability path, Supabase for the separate Customer Data Plane and authentication, PostHog for minimized technical/product analytics where customer business content is forbidden, official-source retrieval for current trusted research, and AI providers routed through the existing provider abstraction when real-customer processing is later explicitly approved.

Real-customer AI processing is currently disabled, paid provider execution is not part of this block, and the Customer Surface remains closed.

## Human legal review checklist

Before `legal_privacy_review_complete` can be recorded, a qualified human reviewer must complete the final review of at least:

- final privacy notice text;
- final terms text;
- controller identity and contact details;
- legal bases and purpose mapping;
- retention schedule and deletion exceptions;
- subprocessors and international data transfers;
- DPA/SCC/TIA requirements where applicable;
- intended customer/business scope;
- age/minor policy;
- AI regulatory classification and transparency duties;
- high-risk disclaimers and professional-escalation language.

The repository intentionally represents every item above as `REQUIRES_HUMAN_REVIEW`. No automated test may convert those items into legal acceptance.

## Gate state after this block

Technical Legal/Privacy Readiness can be `true` while all of the following remain `false`:

- `legal_privacy_review_complete`
- `public_customer_surface_active`
- `real_customer_ai_processing_approved`

The expected variable AI/provider cost for this block is €0 and all validation uses existing live evidence plus synthetic deterministic tests only.
