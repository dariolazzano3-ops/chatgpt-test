# PROJECT VISUAL FOUNDRY — Wave 8 Reference Fixture Mode

Visual fixtures are explicitly labeled `truth_class=VISUAL_FIXTURE`. They exist only to make reference replication deterministic.

Fixture sessions are restricted to local/test/CI/private staging. Production and public runtime are hard-blocked.

Fixtures cannot write Project Knowledge, Runtime Truth, Customer Truth, database state, or production state. Runtime view-model overlay is in-memory only and leaves the original runtime object unchanged. A leak detector fail-closes on forbidden write capabilities.
