# JARVIS Personal AI Operating System V1

JARVIS is the private personal intelligence, memory, planning, tool-routing, connector-routing, and action-control layer for the operator.

## Hard isolation rule

HAMYREN is a separate product and a separate data domain.

JARVIS:
- uses its own personal memory namespace: `jarvis.personal`
- does not read HAMYREN memory
- does not write HAMYREN memory
- does not share personal facts, goals, decisions, routines, preferences, files, calendar data, email data, or device context with HAMYREN
- has no automatic HAMYREN connector, memory sync, or data-return path
- rejects HAMYREN-sourced records from the JARVIS personal memory write path in V1
- rejects HAMYREN connector registrations in the connector registry
- has an independent persistence schema: `jarvis_private`

Any future HAMYREN use must be implemented as an explicit connector boundary carrying only the minimum approved request payload. It must never become shared memory.

## V1 core foundation

Implemented:
- one JARVIS Core service
- explicit intent contract
- minimal relevant personal context snapshot
- temporal personal memory contract
- memory trust states: CONFIRMED, INFERRED, TEMPORARY, UNVERIFIED, CONFLICTED, HISTORICAL
- controlled memory retrieval
- controlled memory writeback policy
- credential and secret rejection for memory
- JARVIS tool registry and tool router
- risk and autonomy action gate
- action planning contract
- action result verification contract
- privacy-preserving audit events
- cost estimate field and high-cost approval signal
- explicit production, billing, finance, and credential safeguards

## Personal Memory Persistence V1

Migration:
`supabase/migrations/20260907004000_jarvis_personal_memory_v1.sql`

The persistence domain provides:
- dedicated `jarvis_private` schema
- owner-scoped `personal_memory_v1`
- owner-scoped `audit_events_v1`
- forced Row Level Security
- `auth.uid()` owner isolation
- no anonymous access
- no foreign keys into HAMYREN
- fixed `jarvis.personal` namespace
- HAMYREN source-system rejection
- temporal memory fields
- secret/credential sensitivity states excluded from persistence

The original migration was exercised in a shared technical staging environment only as acceptance evidence. That environment is not an allowed persistent data plane for the standalone JARVIS architecture.

Physical isolation state:
- dedicated JARVIS Supabase account = ACTIVE
- dedicated JARVIS organization = ACTIVE
- dedicated JARVIS project = ACTIVE_HEALTHY
- personal memory migration = APPLIED
- private RPC + encrypted OAuth vault migration = APPLIED
- Row Level Security = ENABLED + FORCED on all JARVIS private tables
- anon RPC execution = DENIED
- authenticated RPC execution = DENIED
- service-role RPC execution = ALLOWED
- HAMYREN objects in the JARVIS private schema = 0
- initial personal memory / audit / OAuth rows = 0

The standalone Worker now has only the dedicated JARVIS Supabase API URL configured as a non-secret target. The service-role credential remains absent, so durable memory is fail-closed until the dedicated secret is installed. No shared Supabase project is used as fallback.

## JARVIS Runtime V1

Implemented at:
`src/jarvis/runtime-v1.js`

Runtime flow:
1. load durable JARVIS personal memory
2. resolve intent and minimal context
3. apply policy/action gate
4. route permitted connector
5. execute read-only connector
6. verify result
7. persist accepted memory updates
8. append redacted audit event

Current connector execution enabled in Runtime V1:
- `calendar.read`

Write connectors remain disabled.

## Google Calendar Read V1

Implemented at:
`src/jarvis/google-calendar-read-v1.js`

Properties:
- OAuth token injected only by connector host
- token is never returned or persisted
- only `calendar.read`
- no create/update/delete capability
- maximum 31-day query window
- maximum 50 events per request
- minimized event fields
- no external write effect

A live connected Google Calendar account was verified through the connector host with a bounded read-only query. Repository CI continues to use synthetic fixtures only and never reads personal calendar data.

## Connector Runtime V1

Implemented as a provider-neutral adapter boundary:
- Calendar connector contract
- Email connector contract
- Files connector contract
- Tasks connector contract
- Reminders connector contract
- authenticated/available state separation
- capability routing
- required-permission enforcement
- secret-bearing payload rejection
- write authorization enforcement
- high-cost approval hook
- synthetic execution acceptance
- HAMYREN connector registration block

The connector runtime stores no credentials. OAuth tokens, API keys, session cookies, and passwords remain in provider secret stores or connector hosts.

## Reuse / no parallel engines

JARVIS does not create a second AI provider registry, mission engine, automation engine, cost engine, or production runtime. Existing RIOSYSTEMS infrastructure remains the reusable execution backbone where appropriate.

The JARVIS action gate is a personal policy adapter, not a second production approval system. The connector runtime is an execution boundary, not a new automation engine.

## Current binding state

Implemented and verified:
- core
- memory contract
- durable private schema
- RLS policies
- service-role store adapter
- authenticated-user store adapter
- connector runtime
- Google Calendar read-only adapter
- durable JARVIS runtime path
- audit persistence contract
- HAMYREN isolation gates

Still intentionally unbound:
- Gmail live binding
- Files/Drive live binding
- Tasks live binding
- Reminders live binding
- Calendar write
- voice and wake word
- proactive monitoring
- device and smart-home execution
- financial execution
- public product surface
- HAMYREN integration
- production deployment

## Development safety

- Production OFF
- Public OFF
- Billing OFF
- Paid provider calls OFF
- External writes OFF in CI
- Calendar writes OFF
- Financial actions OFF

GitHub acceptance is synthetic and repository-local. Live staging verification is read-only.


## Private Chat & Session V1

Implemented on the isolated route:
`/jarvis`

The route is separate from the AURENTARA operator dashboard and HAMYREN customer surface.

Security and session model:
- Cloudflare Access identity is required before any JARVIS UI or API response
- the verified operator email is deterministically mapped to a stable JARVIS owner UUID
- no JARVIS bearer token is issued to browser JavaScript
- no database service-role credential is exposed to the browser
- no OAuth credential is persisted in chat, memory, audit, HTML, or browser storage
- the browser transcript is ephemeral in V1
- durable memory remains in `jarvis_private`
- staging fails closed when the durable memory store is not configured

UI/API:
- `GET /jarvis` private premium command-center shell
- `GET /jarvis/api/session` safe session projection
- `GET /jarvis/api/status` capability and safety projection
- `POST /jarvis/api/chat` JARVIS runtime request

The visual language follows the operator-approved reference direction: dark architectural command center, restrained blue light, central intelligence core, left navigation, status rail, and conversational command surface. It does not copy literal scene assets.

## Standalone Calendar Binding Truth

The repository contains a read-only Google Calendar adapter and the private chat can consume a host-injected calendar connector. The ChatGPT-connected Google Calendar account proved the read contract externally, but that OAuth session is not automatically available to the standalone Cloudflare Worker.

Therefore:
- Calendar read contract = IMPLEMENTED
- Calendar read synthetic end-to-end chat = PASS
- standalone Worker Google OAuth binding = NOT YET ACTIVATED
- Calendar write = OFF

No repository code pretends the ChatGPT connector session is a Worker credential.


## Private Supabase RPC Gateway V1

The private schema is intentionally not required to be exposed directly through PostgREST.

The standalone Worker uses service-role-only public RPC functions as a narrow gateway:
- memory load
- memory upsert
- redacted audit append
- encrypted OAuth connection load/upsert/touch/delete

All RPC execution grants are revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`.

The OAuth table lives in `jarvis_private.oauth_connections_v1` and stores only encrypted refresh-token envelopes. Plain refresh tokens, access tokens, Google client secrets, and OAuth root secrets are not table fields.


## Google Calendar OAuth Bridge V1

Implemented:
- dedicated JARVIS Access contract for `/jarvis`
- Google OAuth authorization-code flow
- minimal scope: `calendar.readonly`
- offline access with explicit consent
- HMAC-SHA-256 signed state
- HttpOnly + Secure + SameSite=Lax state cookie
- AES-256-GCM refresh-token encryption
- domain-separated cryptographic keys derived from a JARVIS OAuth root secret
- refresh token stored only as ciphertext + IV in `jarvis_private.oauth_connections_v1`
- access tokens are ephemeral and never persisted
- automatic access-token refresh for Calendar Read
- no Calendar Write scope or capability

Required activation secrets are intentionally absent from source:
- `JARVIS_GOOGLE_OAUTH_CLIENT_ID`
- `JARVIS_GOOGLE_OAUTH_CLIENT_SECRET`
- `JARVIS_OAUTH_ROOT_SECRET`

The dedicated Cloudflare Access application for `/jarvis` is also activation-gated. The repository defaults the JARVIS private surface to `prepared`, not public/private-live. Activation must provide a dedicated JARVIS Access audience; the existing `/operator` Access audience is not reused.

This means the OAuth implementation can be fully CI-accepted without pretending that ChatGPT's connected Google account is a credential for the standalone Worker.


## Standalone Private Worker Host V1

JARVIS is no longer routed through the AURENTARA / RIOSYSTEMS Worker.

Dedicated runtime:
- Worker name: `jarvis-private-staging`
- entrypoint: `src/jarvis/standalone-worker-v1.js`
- config: `wrangler.jarvis-private.jsonc`
- first host type: private/fail-closed `workers.dev`
- root UI: `/`
- API: `/api/*`
- Google connect path: `/connect/google`
- OAuth callback: `/oauth/google/callback`

The AURENTARA Worker entry, AURENTARA Wrangler config, AURENTARA staging deploy workflow, and operator runtime binding script contain no JARVIS runtime/bindings in this branch after the host split.

The standalone Worker deliberately starts with:
- no custom AURENTARA domain
- no RIOSYSTEMS environment variables
- no HAMYREN variables
- only the dedicated JARVIS Supabase URL
- no database credential in source
- no shared database credential
- no Google OAuth secret
- no production capability
- no public-access mode
- no external writes

Its current data-plane state is `ISOLATED_SUPABASE_TARGET_CONFIGURED_SECRET_REQUIRED`. A physically separate JARVIS Supabase project now exists and contains the accepted private memory, audit, RPC, and OAuth-vault schema.

The historical JARVIS test schema in the shared technical environment remains acceptance evidence only and is not an allowed runtime fallback.

Next activation milestone:
- bind only the dedicated JARVIS Supabase project to the standalone Worker through secrets
- keep credentials out of source and memory
- activate durable memory only after the neutral private JARVIS host exists
- keep Google OAuth and external writes separately approval-gated


## Neutral Host Isolation V1

The inherited account-level workers.dev hostname has been disabled for JARVIS and is not an allowed future JARVIS endpoint.

Current policy:
- `workers_dev = false`
- no active public or private hostname until a neutral JARVIS host is selected
- JARVIS hostnames containing legacy business, AURENTARA, RIOSYSTEMS, or HAMYREN naming are rejected
- AURENTARA routes are not modified
- no shared application runtime
- Production OFF
- Public OFF

The next host activation must use a neutral JARVIS-specific hostname and a dedicated Access application. The prior inherited workers.dev endpoint is historical evidence only and is not part of the current architecture.

## Physical Isolation Acceptance V1

The dedicated JARVIS Supabase data plane is now evidence-backed and accepted as an isolated persistence target.

Acceptance checks:
- dedicated account / organization / project boundary
- private `jarvis_private` schema
- `personal_memory_v1`, `audit_events_v1`, `oauth_connections_v1`
- forced RLS on all three tables
- service-role-only private RPC gateway
- OAuth refresh tokens represented only as encrypted envelopes
- no initial personal records copied from RIOSYSTEMS, AURENTARA, or HAMYREN
- no HAMYREN object exists in the JARVIS private schema
- worker binding remains fail-closed until dedicated secrets and neutral host are present

This is physical storage isolation, not yet full runtime activation.

## Cloudflare Resource Isolation V1

The operator approved the pragmatic deployment model: JARVIS may run inside the existing Cloudflare account, but its runtime resources remain strictly separated from business workloads.

Required boundaries:
- dedicated Worker: `jarvis-private-staging`
- dedicated GitHub secret names: `JARVIS_CLOUDFLARE_ACCOUNT_ID` and `JARVIS_CLOUDFLARE_API_TOKEN`
- dedicated JARVIS-scoped Cloudflare API token
- dedicated Cloudflare Access application and audience
- neutral JARVIS-only hostname
- no reuse of the AURENTARA operator Access audience
- no shared Worker routes
- no shared runtime variables
- no shared Supabase data plane

The Cloudflare account itself may be shared. The account ID can therefore point to the existing Cloudflare account, but the JARVIS deployment workflow never consumes the generic business secret names.

Current activation state:
- shared Cloudflare account = APPROVED
- dedicated JARVIS Worker package = READY
- dedicated secret names = ENFORCED
- dedicated Access application = ACTIVE
- neutral host = ACTIVE / RESERVED
- workers.dev = OFF
- custom routes = NONE
- JARVIS Supabase = ISOLATED / TARGET CONFIGURED / SECRET REQUIRED
- Production = OFF
- Public = OFF
- external writes = OFF


## Shared-account fail-closed hardening

Additional runtime hardening for the approved shared Cloudflare account:
- JARVIS authentication reads only `JARVIS_OPERATOR_EMAIL`; there is no RIOSYSTEMS operator-email fallback
- environment detection reads only `JARVIS_ENVIRONMENT`
- `private-staging` is treated as staging and therefore cannot fall back to ephemeral memory
- the dedicated JARVIS Supabase URL is configured as the only persistence target
- the Supabase service-role credential is not stored in source
- missing durable-memory secret causes the private chat path to fail closed
- standalone manifest requires a neutral custom host and keeps workers.dev disabled


## Cloudflare Pages Private Runtime V1

The neutral-host strategy now uses Cloudflare Pages instead of the inherited Workers account subdomain.

Target:
- Pages project: `jarvis-private-core`
- neutral host: `jarvis-private-core.pages.dev` if Cloudflare accepts the project name
- runtime: Pages Functions Advanced Mode using a bundled `_worker.js`
- custom purchased domain: NOT REQUIRED
- `ysrio.com`: NOT USED
- workers.dev: NOT USED

Security:
- Cloudflare Access remains mandatory before any real JARVIS deployment
- Pages Access JWT is cryptographically validated with RS256 against the Cloudflare Access JWKS endpoint
- issuer, audience, expiry, signature, and operator email are validated
- no identity is trusted from an unsigned header alone
- dedicated JARVIS Supabase remains the only persistence target
- service-role key remains secret-only
- Production OFF
- Public OFF
- External writes OFF

The Pages project and dedicated Access foundation are now active. Deployment remains request-gated and exact-head pinned. The first private preview may occur only after the required encrypted Pages preview bindings and dedicated JARVIS deploy credentials are present.


## Pages activation gate V1

Cloudflare Pages foundation is active:
- `jarvis-private-core`
- `jarvis-private-core.pages.dev`
- dedicated JARVIS Access application and audience
- owner-only policy
- preview and production fail closed
- no custom domain, no `ysrio.com`, no workers.dev

The repository now contains a separate exact-head deployment workflow. It deploys only to the Pages preview branch `private-staging` and verifies the Cloudflare project plus encrypted preview secret-name presence before any upload.
