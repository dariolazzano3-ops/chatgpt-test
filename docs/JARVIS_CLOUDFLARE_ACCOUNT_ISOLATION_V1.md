# JARVIS Cloudflare Resource Isolation V1

Status: PREPARED / ACCOUNT SHARING APPROVED

Decision:
JARVIS remains in the existing Cloudflare account, while Worker, secrets, Access, host, runtime bindings, and persistence remain independently isolated.

Accepted boundary:
- same Cloudflare account: ALLOWED
- same Worker: FORBIDDEN
- generic shared deploy secrets: FORBIDDEN
- same Access application/audience as business operator surface: FORBIDDEN
- same Supabase project: FORBIDDEN
- business-named or inherited workers.dev endpoint: FORBIDDEN

JARVIS resources:
- Worker: `jarvis-private-staging`
- account secret: `JARVIS_CLOUDFLARE_ACCOUNT_ID`
- API token secret: `JARVIS_CLOUDFLARE_API_TOKEN`
- Access app: dedicated JARVIS app required
- host: neutral JARVIS-only host required
- workers.dev: OFF
- Public: OFF
- Production: OFF
- DNS: unchanged until a neutral host is explicitly selected

Runtime activation remains fail-closed until the dedicated Access audience and neutral host are present.
