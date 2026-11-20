# FollowClean — Live Smart Scan Blocker Report

Date: 2026-11-20  
Branch: `factory/followclean-mvp-v1-20261109`  
Selected pilot profile: `julic.00` (146 followers / 217 following per user screenshot)

## Decision

**NO-GO for a paid Apify scan and for live activation in this session.** This is not waiting on user approval. The profile has been selected, but the provider call cannot currently be launched and bounded safely from the connected tools.

## Verified state

- Cloudflare Worker `followclean-mvp-preview` is still on the V17.1 deployment from commit `0453e8be99bf6f60009fa17d43cd9f5aa6e42a03`; its settings show the D1 binding `FC_APIFY_BUDGET_DB` points to shared `chatgpt-test-db` (`24bce336-3a04-4517-bd12-c9e713068d58`).
- The dedicated `followclean-db` (`28194058-2779-4b6d-ab81-b38459d5f6a8`) contains the V2 ledger schema and its append-only triggers. The shared database does not contain `fc_apify_v2_runs`.
- The V20 branch source has provider execution hard-disabled (`FC_PROVIDER_EXECUTION_ENABLED=false)); it contains planning and ledger logic but no implemented paid Actor start. The Worker therefore cannot return a real scan result today.
- Cloudflare reports an `FC_APIFY_TOKEN` secret binding exists. The secret value is not readable here, and its rights for the current Following/Checker Actors have not been verified.
- No Apify connector is available in this session. The earlier Apify Console attempt hung before any run started. No new run or cost occurred.
- The ledger records one actual historical provider charge of $0.032 against a $0.05 reservation. The earlier V11 accounting gives $0.124 remaining from the $0.20 overall test ceiling. The dedicated pilot scope separately reports $0.15 remaining; that scoped number is not the overall remaining budget.
- The branch has a $0.05-per-run reservation design, but a local reservation is not proof that the Actor will enforce a provider-side cap.

## Why the test cannot safely start yet

A $0.05 client parameter is only effective if the selected Actor's pricing model supports `maxTotalChargeUsd` and its minimum cap is at most $0.05. Those facts and the restricted token's run permission have not been checked against the authenticated Apify account. The Worker also needs a new version that points to the dedicated ledger database while retaining its existing secrets.

## Next safe implementation sequence

1. Add a read-only Apify preflight in the Worker that checks token authentication and reads Actor pricing metadata; it must never start a run or reveal account details.
2. Create a preview Worker version with `FC_APIFY_BUDGET_DB` bound to `followclean-db`, inheriting the current secret bindings unchanged. Check the status endpoint against the existing ledger.
3. If the selected Actor is pay-per-event and confirms an enforceable cap of $0.05 or less, use the already-selected `julic.00` pilot and start only the first bounded data call. Record the actual charge before any next call.
4. Keep the result `UNKNOWN` unless the candidate list and target follower evidence pass completeness checks. No deployment of a public live feature until quality and compliance gates pass.

No Instagram password, session cookie, or new subscription is required for this sequence.
