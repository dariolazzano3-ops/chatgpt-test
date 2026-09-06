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

The migration is applied to the private `riosystems-core` Supabase environment for JARVIS staging acceptance. Production deployment remains OFF.

Two store paths exist:
- `memory-store-supabase-v1.js`: server-side service-role adapter for controlled internal use
- `memory-store-supabase-user-v1.js`: preferred personal runtime adapter using authenticated-user JWT + Supabase RLS

The user-scoped adapter never persists the user access token and requires RLS owner scope.

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
- no shared Supabase URL
- no shared database credential
- no Google OAuth secret
- no production capability
- no public-access mode
- no external writes

Its initial data plane is `EPHEMERAL_UNTIL_ISOLATED`. The existing JARVIS test schema in `riosystems-core` remains migration evidence only and is not automatically bound to the standalone Worker.

The next isolation milestone is a physically separate JARVIS persistence project. Only after that data plane exists should durable personal memory and Google OAuth be activated on the standalone host.


## Dedicated Cloudflare Access V1

The standalone JARVIS workers.dev host receives its own Cloudflare Access application. It does not reuse the AURENTARA /operator application audience.

Bootstrap rules:
- target only `jarvis-private-staging.gelato-donatello-dario-a5a5376c.workers.dev`
- derive the single human operator identity from the existing private operator Access policy
- reject bypass, everyone, login-method, email-domain, multi-email, or otherwise broad rules
- create exactly one JARVIS allow policy for that single operator identity
- write only `JARVIS_OPERATOR_EMAIL` and `JARVIS_ACCESS_AUD` to the JARVIS Worker
- do not modify an AURENTARA route
- do not bind shared memory or Google credentials during this step
- verify an unauthenticated request cannot receive the JARVIS Command Center
