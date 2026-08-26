# Factory Cost / Usage Guard

Project Factory V3 includes a conservative cost and usage guard around automatic preview and QA work.

## What it does

- Counts Factory Control workflow runs in the current UTC month as a conservative proxy for preview-build pressure.
- Warns at 350 monthly Factory Control runs.
- Marks usage critical at 450 monthly runs.
- Stops new automatic QA-only preview work at 475 monthly runs, leaving headroom below the current Cloudflare Pages Free-plan build ceiling.
- Never enables or performs production deployment.
- Does not block normal generate, rebuild, or edit work solely because the QA-only monthly stop threshold was reached.

## QA deduplication

The guard fingerprints the staged Visual QA runtime and combines that fingerprint with the active project commit. When the same project commit has already passed the same QA runtime version, a QA-only recheck reuses the prior successful preview URL instead of creating another Cloudflare preview deployment and reinstalling/rerunning the browser suite.

A project code change creates a new commit and therefore requires fresh QA. A Visual QA runtime change creates a new fingerprint and therefore also requires fresh QA.

## Visibility

Every Factory Control summary reports:

- current monthly Factory Control run count
- usage level (`normal`, `warning`, or `critical`)
- whether the QA cache was reused
- preview URL

The guard is intentionally conservative: the monthly workflow count can overestimate actual Cloudflare builds because a Factory Control run may fail before deployment. This gives us safety margin rather than optimistic accounting.
