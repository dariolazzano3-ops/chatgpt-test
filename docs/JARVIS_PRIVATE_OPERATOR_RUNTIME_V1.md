# JARVIS Private 24/7 Operator Runtime V1

Status: CODE PREPARED / NOT ACTIVATED — awaiting operator-performed VPS + Cloudflare Access setup.

## Why this exists

The accepted V2 Program Controller (`program-controller-v1.js`) needs real
Node `git` access (`branch-manager-v1.js`) and a real repo-bound Claude Code
worker (`claude-code-repo-bound-executor-v1.js` /
`claude-code-repo-bound-runtime-binding-v1.js`). A deployed Cloudflare Worker
(`pages-worker-v1.js` / `standalone-worker-v1.js`, e.g. the existing
`jarvis-private-staging` Worker) has no filesystem or `child_process` and
structurally cannot provide either. `src/jarvis/http-v1.js` only ever
receives `program_controller` / `program_repo_dir` / `program_target_branch`
through a Node-only dependency-injection seam (`options`), and until now the
only entrypoint that filled that seam was `local-operator-server-v1.js`,
which is intentionally local-only (fixed `LOCAL_OPERATOR_AUTH`, binds
`127.0.0.1`, meant for an operator's own machine).

`src/jarvis/remote-operator-server-v1.js` is the new, dedicated entrypoint
that fills the same seam for a 24/7 process running on the operator's own
private VPS, reusing everything already accepted:

- `handleJarvisStandaloneWorkerV1` (same request pipeline the deployed
  Worker runs)
- real Cloudflare Access JWT authorization (`access-v1.js` /
  `access-jwt-v1.js`) — **not** `LOCAL_OPERATOR_AUTH`
- `resolveJarvisMemoryStoreV1` (Supabase RPC store only)
- the Program Controller runtime (`program-controller-v1.js`)
- the existing repo-bound Claude Code binding ("Bridge V5" —
  `claude-code-repo-bound-runtime-binding-v1.js`)

It is a brand-new file. `local-operator-server-v1.js` is unmodified and
unreferenced by it (see the smoke test's checks B/C).

## What is different from the local operator

| | Local operator | Remote operator |
|---|---|---|
| Auth | `LOCAL_OPERATOR_AUTH` (fixed identity, ignores request) | Real Cloudflare Access JWT, dedicated audience |
| Bind | `127.0.0.1:8787` | `127.0.0.1:8788` (still never `0.0.0.0`; reached only via a private tunnel/reverse proxy in front) |
| Repo/branch | optional — UI renders "nicht konfiguriert" if unset | **required** at startup — fails closed if unprovable (including detached HEAD) |
| Claude execution | repo-bound OR disposable-tmp | **repo-bound only** — the disposable-tmp path is never imported |
| Supabase | must be `supabase-rpc` | must be `supabase-rpc` (same rule, independently enforced) |

## Fail-closed startup gates (`startJarvisRemoteOperatorV1`)

In order, any failure refuses to start (no partial/degraded listen):

1. `JARVIS_PUBLIC_ACCESS` and `JARVIS_PRODUCTION_DEPLOY` must not be true.
2. `JARVIS_ACCESS_AUD`, `JARVIS_ACCESS_TEAM_DOMAIN`, `JARVIS_OPERATOR_EMAIL`
   must all be set (real Access enforcement must be configurable at all).
3. `JARVIS_PERSONAL_MEMORY_STORE=supabase-rpc` plus its URL and
   service-role key must be set (the legacy direct-table store is refused).
4. `JARVIS_CLAUDE_REPO_DIR` must point at a real git checkout on a
   resolvable, non-detached branch.
5. If `JARVIS_CLAUDE_REPO_BOUND_EXECUTION=on`, the repo-bound Claude bridge
   must actually bind (CLI present, repo not on a protected branch) — else
   startup fails with `JARVIS_CLAUDE_REPO_BOUND_EXECUTION_REQUESTED_BUT_UNBOUND`.
   Execution stays fully opt-in: the runtime can run read-only with it unset.

Proven in `scripts/jarvis-remote-operator-server-v1-smoke.mjs` (checks
D–I), with no live Claude CLI spawn, Supabase call, or Cloudflare Access
JWKS fetch.

## Required environment (secrets via runtime env, never committed)

```
JARVIS_ACCESS_AUD=<dedicated audience — NOT the Pages Command Center's audience>
JARVIS_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com
JARVIS_OPERATOR_EMAIL=<the single allowed operator identity>
JARVIS_PERSONAL_MEMORY_STORE=supabase-rpc
JARVIS_PERSONAL_MEMORY_SUPABASE_URL=<dedicated JARVIS Supabase project URL>
JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY=<service-role secret>
JARVIS_CLAUDE_REPO_DIR=/absolute/path/to/the/real/checkout
JARVIS_PUBLIC_ACCESS=false
JARVIS_PRODUCTION_DEPLOY=false
JARVIS_EXTERNAL_WRITES=false
JARVIS_CALENDAR_WRITE=false
JARVIS_FINANCIAL_ACTIONS=false
# optional, opt-in, off by default:
JARVIS_CLAUDE_REPO_BOUND_EXECUTION=on
JARVIS_REMOTE_PORT=8788
```

No AURENTARA / HAMYREN / RIOSYSTEMS credential or generic shared Cloudflare
secret is read by this file (it reads only the `JARVIS_*` names above, all
already part of the accepted V1/V2 surface).

## Exact external actions still required (cannot be done from this repo/session)

This session has no VPS shell access and no Cloudflare account access, so
none of the following were performed — they are the smallest exact steps
left for the operator, mirroring the existing
`JARVIS_CLOUDFLARE_ACCOUNT_ISOLATION_V1` boundary (same account allowed,
same Worker/Access-app/audience forbidden):

1. **Dedicated Cloudflare Access application** for this runtime, with its
   own audience (never the Pages Command Center's `JARVIS_ACCESS_AUD`), an
   owner-only Allow policy, and no public/App-Launcher exposure.
2. **Private reverse-proxy path** from that Access application to
   `127.0.0.1:8788` on the VPS — a Cloudflare Tunnel (`cloudflared`)
   pointed at the loopback port is the smallest option that needs no
   inbound firewall rule and no raw public Node port at all. No DNS record
   needs to change beyond what the tunnel/Access app itself requires.
3. **Runtime secrets** set as VPS process environment (systemd
   `EnvironmentFile=`, see `deploy/jarvis-remote-operator.service.example`
   in this repo), never committed.
4. **Start the service** (`systemctl enable --now jarvis-remote-operator`)
   and confirm `/api/status` responds through the Access-fronted URL with a
   valid Access session, and with 401 without one.

Until step 4, `PRIVATE 24/7 OPERATOR RUNTIME` stays READY-AT-CODE-LEVEL, not
ACTIVE.

## Explicitly not done by this change

- No public deployment, DNS change, or billing change.
- No production activation (`JARVIS_PRODUCTION_DEPLOY` stays `false`).
- No Wave 3 (or any wave) acceptance — this is non-wave infrastructure, out
  of the `JARVIS_MASTERARCHITECTURE_V2` wave sequence entirely.
- No program tick and no paid Claude dispatch.
- No Docker socket, no live Cloudflare/DNS/billing credential, and no
  unrestricted GitHub write credential is ever handed to the Claude worker
  — same Bridge V5 boundary as the accepted repo-bound executor.
