# Concurrent base note

Web OS V2 started from `ed836e8b6402879bfd71a39c944f06324dd916ce`.

Before PR creation, canonical `factory-control` advanced to `6e2fcaf75291e2c5cb75b96a5ae85ddb39c14474` with two Automation Factory V2 commits only. The compare contains no `src/web-factory`, Web Factory fixture, Web Factory script, or Web Factory workflow overlap.

Integration policy: rely on the pull-request merge test against the current canonical base; do not rewrite or overwrite the parallel Automation Factory changes. Recheck canonical base again immediately before merge.
