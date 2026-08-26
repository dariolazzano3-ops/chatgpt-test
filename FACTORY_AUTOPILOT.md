# Factory Autopilot

Factory Autopilot continues narrowly scoped V3 infrastructure pull requests after CI succeeds.

Eligible branches must use the `factory-v3/auto/` prefix and target `main`. For an eligible green PR, Autopilot merges the PR, synchronizes `factory-control`, and enqueues a QA-only recheck against the active project. Production deployment remains disabled. Blocked or unknown states fail closed and require manual review.
