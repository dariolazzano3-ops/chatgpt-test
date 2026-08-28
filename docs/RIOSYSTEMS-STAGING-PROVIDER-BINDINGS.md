# RIOSYSTEMS Staging Provider Bindings

This block converts provider discovery into secretless staging binding contracts. It does not inject credentials and does not call any provider.

## Read-only discovery status

- Supabase is discoverable through the connected account and a RIOSYSTEMS project exists. The repository stores only stable logical references, never project secrets or connector tokens.
- PostHog is discoverable through the connected account. The repository stores only a logical project reference and an environment credential reference, never token values.
- Cloudflare account access was verified read-only on 2026-08-28. A dedicated `riosystems-staging` Worker is still required; the existing `chatgpt-test` Worker is not treated as staging.

## Contract

- Credential values are never committed. Runtime configuration receives references such as env://, binding://, vault:// or secret://.
- External writes remain explicitly approval-gated, including Supabase mutations and PostHog event ingestion.
- A separate Cloudflare staging project is required before the zero-cost real AI staging path can move beyond planning.
- There is no automatic paid overflow.
- Production deployment remains disabled.

## Next boundary

The next real-provider step is creation of an isolated Cloudflare staging project plus secret injection through a safe secret mechanism. The account connection is already verified, but this must not be interpreted as permission to deploy production, call a paid service, use real customer data, or expose public production access.
