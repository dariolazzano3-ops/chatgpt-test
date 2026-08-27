# LEAN V3.2

LEAN V3.2 evolves the V3.1 self-healing loop from one generic horizontal-overflow patch into a structured, bounded repair policy.

## What changed

- Visual QA report schema v6 emits machine-readable issue codes while preserving human-readable failure strings.
- Overflow diagnostics now include culprit selector, tag, display mode, position, white-space behavior, text length and measured overflow.
- A central `qa-repair-policy.mjs` classifies safe repair candidates.
- Automatic repair remains limited to `GEOMETRIC_OVERFLOW` and `SCROLL_OVERFLOW`.
- Safe repair profiles are targeted: media containment, text wrapping, layout containment and viewport containment fallback.
- HTTP failures, missing structure, page errors, insufficient content and mixed unsafe failures never auto-repair.
- Repair markers are deterministic and duplicate repairs stop instead of looping.
- Maximum QA attempts remain 3.
- Production remains disabled throughout Factory Control and still requires the existing explicit production approval workflow.

## Runtime states

`IMPLEMENTING -> PREVIEW_BUILDING -> QA_RUNNING`

On safe failure:

`QA_RUNNING -> FIXING -> PREVIEW_BUILDING -> QA_RUNNING`

On success:

`QA_RUNNING -> READY_FOR_REVIEW`

On unsafe or exhausted failure:

`QA_RUNNING -> FAILED`

## Compatibility

The repair policy accepts legacy Visual QA reports without structured `issues`, so existing V3.1 evidence does not become unreadable.

## Version

Factory capability label: `LEAN V3.2`
Package runtime: `1.6.0-alpha.1`
