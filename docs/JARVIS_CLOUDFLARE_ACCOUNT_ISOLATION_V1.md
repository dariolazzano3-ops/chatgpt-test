# JARVIS Cloudflare Account Isolation V1

Status: PREPARED / HUMAN ACCOUNT SETUP REQUIRED

Goal:
Run the JARVIS Worker in a Cloudflare account that is administratively and technically separate from AURENTARA / RIOSYSTEMS.

Repository guarantees:
- deployment uses only `JARVIS_CLOUDFLARE_ACCOUNT_ID`
- deployment uses only `JARVIS_CLOUDFLARE_API_TOKEN`
- shared generic Cloudflare GitHub secrets are not consumed by the JARVIS deploy workflow
- the RIOSYSTEMS Cloudflare zero-cost variable is not consumed
- no Cloudflare account ID is hardcoded in source
- `workers_dev = false`
- no custom route exists
- neutral JARVIS host is still required
- Production OFF
- Public OFF
- DNS unchanged

Activation gate:
1. create dedicated personal Cloudflare account
2. create a JARVIS-scoped API token in that account
3. bind account ID and token through secret storage, never source or chat
4. verify account differs from the business Cloudflare account
5. establish a neutral JARVIS-only host
6. create dedicated Access protection for that host
7. only then bind the isolated JARVIS Supabase data plane
