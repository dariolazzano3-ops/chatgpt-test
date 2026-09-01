# HAMYREN Legal / Privacy Final Review Preparation V1

Status: **REVIEW PACK PREPARED — NOT LEGALLY APPROVED**  
Baseline date: **2026-09-01**  
Product: **HAMYREN — Your Personal Business AI — by AURENTARA SYSTEMS**

## Purpose and hard boundary

This pack turns the existing technical privacy evidence into a structured handoff for a qualified human legal reviewer. It is not legal advice, a compliance certification, or a final privacy/terms publication. It must not set `legal_privacy_review_complete=true`.

The following remain OFF throughout this block:

- public Customer Surface;
- real-customer AI processing;
- real customer data;
- paid provider calls, billing and Stripe;
- domain or DNS changes.

## What the reviewer receives

1. The existing technical evidence in `HAMYREN_LEGAL_PRIVACY_TECHNICAL_READINESS_V1.md`.
2. A machine-readable processing, service, transfer-candidate, retention and decision register in `src/customer-product/hamyren-legal-privacy-final-review-preparation-v1.js`.
3. A German privacy-notice review draft in `docs/legal/HAMYREN_DATENSCHUTZERKLAERUNG_REVIEW_DRAFT_V1.md`.
4. A German B2B terms review draft in `docs/legal/HAMYREN_NUTZUNGSBEDINGUNGEN_REVIEW_DRAFT_V1.md`.
5. A deterministic acceptance test that proves preparation is complete while all activation and legal-acceptance gates remain false.

## Verified technical facts available to counsel

- Customer Data Plane and private Operator Control Plane are separate.
- Customer project region is recorded as `eu-central-1`.
- Customer JWT, tenant membership and RLS authorization are live-verified.
- Conversation access is owner-scoped.
- Customer business export, memory correction, consent-event history and authenticated hard deletion exist.
- Customer-facing deletion uses `DELETE_MY_HAMYREN_DATA`; the internal executor token is server-side only.
- Technical telemetry is designed to exclude prompts, messages, answers, email, authorization data and customer business content.
- The dedicated Customer Worker is closed and the public launch shield is live-verified OFF.
- Real-customer AI processing has not been approved.

These facts establish technical evidence only. Counsel must decide whether the implementation, contracts and customer wording meet the applicable legal standard.

## Recorded V1 customer-scope decision

HAMYREN V1 is **B2B-only**. It is offered exclusively to entrepreneurs within the meaning of [§ 14 BGB](https://www.gesetze-im-internet.de/bgb/__14.html) who conclude and use HAMYREN in the exercise of their commercial or independent professional activity, or to authorized representatives acting for such an entrepreneur.

Consumers within the meaning of § 13 BGB, mixed private/business use and a B2C contract flow are excluded from V1. This is a recorded operator decision, not a final legal conclusion. Counsel must review the definition, eligibility evidence, customer wording and enforcement flow. Any later B2C release requires a separate legal, contractual and technical review before activation.

HAMYREN remains a personal AI workspace for business users. It organizes user-supplied business context, supports goals and decisions, answers questions, and may later retrieve authoritative sources. It does not make a binding decision for the user and must not be positioned as legal, tax, medical, employment, financial or other regulated professional advice.

## Primary-law baseline to refresh at final review

- [GDPR — Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng): transparency, legal bases, rights, privacy by design, processors, security, DPIA and international transfers.
- [EU AI Act — Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng): intended-purpose classification, prohibited/high-risk boundaries, AI literacy and human-interaction transparency.
- [TDDDG § 25](https://www.gesetze-im-internet.de/ttdsg/__25.html): storage/access on terminal equipment and the strict-necessity exception.
- [DDG § 5](https://www.gesetze-im-internet.de/ddg/__5.html): service-provider identity information.
- [BGB](https://www.gesetze-im-internet.de/bgb/): online contracting and, if applicable, consumer/digital-product duties.

The reviewer must verify the current consolidated law, guidance, court decisions and provider contracts on the actual sign-off date.

## Human decision register

Every row is blocking until decided and evidenced.

| Decision | Required evidence | Owner |
|---|---|---|
| Controller identity | legal name/form, authorized representative, complete postal address | Operator |
| Privacy contact | monitored email; DPO/representative determination | Operator + counsel |
| Customer scope | **Operator decision recorded: B2B-only V1 under § 14 BGB.** Counsel must review eligibility wording/evidence and prohibited consumer flow. | Counsel |
| Age policy | minimum age, verification and minor handling | Operator + counsel |
| Purpose/legal-basis map | Article 6 basis per processing activity; role of consent | Counsel |
| Retention schedule | approved periods, deletion propagation, backups, legal holds | Operator + counsel |
| Processor register | executed DPA/AVV and current subprocessor list per active service | Operator + counsel |
| International transfers | locations, adequacy/SCC module, TIA and supplementary measures | Counsel |
| DPIA | documented threshold assessment and, if required, completed DPIA | Counsel |
| AI Act | intended-purpose classification, Article 50 copy and AI-literacy process | Counsel |
| Use restrictions | forbidden/high-impact uses and professional escalation language | Operator + counsel |
| Terms risk allocation | service description, warranty, liability, availability, termination | Counsel |
| Cookie/analytics model | strictly necessary storage and consent-managed optional analytics | Operator + counsel |
| Complaint information | competent authority and customer-facing wording | Counsel |
| Versions | final document hashes/versions, effective date and publication owner | Operator + counsel |

## Processing register summary

The machine-readable register covers:

- lightweight visitor intake and five free questions;
- account, authentication and tenant membership;
- business profile, memory, goals, decisions and state snapshots;
- conversations, AI output, safety/source metadata and usage attribution;
- trusted research;
- consent/preferences;
- technical observability and optional product analytics;
- customer-approved AURENTARA service handoff;
- future subscription/payment records (inactive).

Each legal basis in the register is a review candidate, not a determination. In particular, a consent ledger does not make consent the correct legal basis for every feature.

## B2B eligibility and contract-flow contract

Before any real-customer account, persistent workspace or contractual use can be activated, the reviewed customer journey must fail closed unless the user confirms all of the following:

- the contracting customer is an entrepreneur within the meaning of § 14 BGB or the user acts with authority for one;
- HAMYREN is concluded and used exclusively for commercial or independent professional activity;
- HAMYREN is not concluded or used as a consumer under § 13 BGB;
- the supplied business and representative information is complete and accurate.

The pre-contract evidence candidate contains business/trade name, business address/country, activity, representative name and authority, attestation timestamp and accepted terms version. No checkbox may be preselected. A failed or missing attestation must block V1 eligibility without activating the public surface or real-customer processing.

Counsel must approve the exact UI wording, timing, evidence minimization/retention, treatment of sole traders, mixed-purpose contracts and consequences of a false declaration.

## Processor and transfer evidence request

Before real-customer processing, collect the current signed contract package for each actually activated service:

- Cloudflare: DPA, service locations/subprocessors, retention/security settings and transfer terms;
- Supabase: DPA, project region, support/subprocessors, backups/deletion propagation and transfer terms;
- PostHog, only if activated: hosting region, DPA, data capture configuration and cookie/TDDDG analysis;
- selected AI provider: DPA, model-training opt-out/contract terms, abuse-monitoring retention, region, subprocessors, transfer mechanism and deletion behavior;
- trusted-retrieval provider or direct official-source hosts: transmitted fields and role/transfer analysis;
- payment provider, only in a later activation block.

Repository architecture names are not sufficient contract evidence.

## Retention decision proposal

The pack proposes short, reviewable defaults rather than claiming an approved policy:

- guest state: non-durable session/process lifetime;
- account/workspace and conversation data: active relationship, customer-controlled deletion, proposed 30-day deletion/recovery window;
- technical security logs: proposed 30 days;
- raw product analytics: proposed 90 days, then aggregate/delete;
- consent/policy evidence and minimized deletion receipts: proposed three years;
- backups: provider-specific rolling window still to be evidenced;
- future billing/tax records: applicable statutory period only after billing exists.

Counsel must approve, shorten, extend or split these periods and document the justification and deletion exceptions. No runtime retention configuration is activated by this preparation block.

## DPIA and AI Act screening

The product combines persistent personalized business context with AI recommendations. Free text can contain unintended personal or special-category data. Multiple processors and international transfers may arise after provider activation. Those factors require a documented DPIA threshold decision before real-customer processing.

The current intended-purpose candidate is a conversational business-assistance system, not an Annex III high-risk decision system. The following uses must remain forbidden unless a new legal/technical assessment explicitly authorizes them:

- employment scoring, selection, termination or worker-management decisions;
- creditworthiness, lending, insurance or essential-service eligibility decisions;
- biometric categorization, emotion recognition or manipulative/prohibited uses;
- regulated professional advice presented as a substitute for a qualified professional;
- solely automated decisions with legal or similarly significant effects.

The final AI Act classification, Article 50 customer disclosure and AI-literacy process remain counsel decisions.

## Final review protocol

Counsel should return a signed or otherwise attributable review record containing:

1. reviewer name, role and organization;
2. review timestamp and jurisdiction/scope;
3. exact final document versions/hashes;
4. decisions for every row in the register;
5. provider-contract and transfer evidence references;
6. DPIA decision and AI Act classification;
7. required changes, residual risks and any expiry/re-review date;
8. explicit statement whether `legal_privacy_review_complete` may be changed to true.

No code test or AI agent may create that acceptance record on behalf of the reviewer. Even after legal sign-off, public activation and real-customer AI processing remain two separate operator gates.

## State after preparation

```json
{
  "legal_privacy_final_review_preparation": true,
  "customer_scope": "B2B_ONLY_V1",
  "b2c_allowed": false,
  "final_legal_acceptance_recorded": false,
  "legal_privacy_review_complete": false,
  "public_customer_surface_active": false,
  "real_customer_ai_processing_approved": false,
  "real_customer_data": false,
  "variable_cost_eur": 0
}
```
