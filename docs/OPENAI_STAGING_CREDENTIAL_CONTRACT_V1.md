# AURENTARA SYSTEMS — OpenAI Staging Credential Contract V1

## Purpose

Define one canonical, staging-only credential reference for the existing `openai-api` provider without storing a secret value, calling OpenAI, enabling paid inference, or changing Production.

## Canonical contract

- Provider ID: `openai-api`
- Target runtime: `riosystems-staging`
- Runtime secret name: `OPENAI_API_KEY`
- Provider credential reference: `env://OPENAI_API_KEY`
- Secret value in GitHub: **never**
- Secret value in logs/evidence: **never**
- Connection status after this contract: **NOT_CONNECTED**
- Paid execution after this contract: **not approved**
- Production deploy after this contract: **false**

The actual API key must be stored only in the runtime's encrypted secret store. The repository contains only the name/reference contract.

## Activation sequence

1. Merge this contract into `factory-control`.
2. Operator adds an existing OpenAI API credential to the encrypted secret store of `riosystems-staging` using the exact secret name `OPENAI_API_KEY`.
3. Perform a presence-only runtime check that returns only whether the binding exists; never return the value.
4. A real authenticated OpenAI connection check is a separate external API action and requires explicit operator authorization before execution.
5. Only verified connection evidence may move OpenAI from `NOT_CONNECTED` to a connected staging state.
6. Paid inference remains separately blocked by paid-execution approval and mission budget/cost gates.

## Safety invariants

This contract does not create or rotate credentials, does not call OpenAI, does not alter billing, does not enable automatic paid overflow, does not enable Production, and does not process real customer data.
