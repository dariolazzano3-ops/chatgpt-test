# LEAN V4.4 — Supervised Automation Runner

LEAN V4.4 connects the Automation Factory's bounded safe execution path with the supervised external-action adapters introduced in V4.3.

## Scope

- Executes safe automation steps in sequence.
- Allows `http_request` and `webhook` steps only through the V4.3 validation boundary.
- Requires explicit authorization and an exact hostname allowlist.
- Requires an injected transport function. The runner never invents or silently enables a network transport.
- Keeps email, CRM writes and database writes disabled.
- Keeps automatic execution disabled.
- Keeps production deployment disabled.
- Supports per-step policy overrides without weakening the production-side-effect guard.

## Safety model

External actions remain supervised. A plan that contains an external step is blocked unless the policy explicitly sets `authorized: true`, supplies an allowed hostname and satisfies the V4.3 URL, method, body-size and secret-header restrictions.

Tests use an injected mock transport and therefore create no external side effects.

## Operational boundary

V4.4 does not alter AI Factory, Factory Control / Dashboard, Project Command, production deployment logic or automatic multi-factory execution. It adds an Automation Factory execution bridge only.
