# PROJECT VISUAL FOUNDRY — Wave 9 Runtime Binding Contract

Visual stability can now be tested against six binding states: EMPTY, LOADING, REFERENCE, NORMAL, LONG_CONTENT, STRESS.

The first canonical contract targets `ProjectPortfolio → GET /operator/api/projects`.

Bindings declare minimum/maximum dimensions, overflow strategy, wrapping/truncation, item ceilings, and loading skeleton policy. The REFERENCE state requires `VISUAL_FIXTURE` and is forbidden as runtime truth. All normal runtime states reject fixture truth.
