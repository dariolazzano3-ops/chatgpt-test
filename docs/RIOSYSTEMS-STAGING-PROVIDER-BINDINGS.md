# RIOSYSTEMS Staging Provider Bindings

This block converts provider discovery into secretless staging binding contracts. It does not inject credentials and does not call any provider.

## Read-only discovery status

- Supabase is discoverable through the connected account and a RIOSYSTEMS project exists. The repository stores only stable logical references, never project secrets or connector tokens.
- PostHog is discoverable through the connected account. The repository stores only a logical project reference and an environment credential reference, never token values.
- Cloudflare remains connection-required for account-specific staging activation. Generic account, project and binding references are prepared, but no Cloudflare credential or deployment is configured.

## Contract

- Credential values are never committed. Runtime configuration receives references such as env://, binding://, vault:// or secret://.
- External writes remain explicitly approval-gated, including Supabase mutations and PostHog event ingestion.
- Cloudflare account connection is required before the zero-cost real AI staging path can move beyond planning.
- There is no automatic paid overflow.
- Production deployment remains disabled.

## Next boundary

The next real-provider step is Cloudflare account binding plus secret injection through a safe secret mechanism. This must not be interpreted as permission to deploy, call a paid service, write external data, or expose public access.
