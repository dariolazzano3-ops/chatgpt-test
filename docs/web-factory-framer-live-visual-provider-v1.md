# Framer Live Visual Provider V1

## Purpose

Framer is integrated as the Web Factory's **visual specialist**, not as the production website owner.

Canonical flow:

`Website Mission → Web Factory → Framer Visual Provider → provider-neutral visual design contract → RIOSYSTEMS native reconstruction → QA → Cloudflare staging`

For the visible operating brand this enables AURENTARA SYSTEMS to use Framer for premium visual exploration while keeping the existing RIOSYSTEMS technical substrate, GitHub source of truth, and Cloudflare delivery architecture intact.

## Hard boundaries

The live provider fails closed for:

- Framer publish
- Framer deployment
- Production actions
- DNS or domain changes
- paid actions or variable cost above 0 EUR
- real customer data
- destructive canvas operations
- redirects, custom code, CMS writes, and external file uploads
- arbitrary attributes outside the visual allowlist
- unsafe or remotely linked SVG content

The provider never stores or returns the Framer API key.

## Credential model

`FRAMER_API_KEY` is a runtime secret only.

It must never be:

- committed to GitHub
- stored in a fixture
- written into Framer canvas content
- copied into delivery artifacts
- returned in provider evidence

The project URL is non-secret configuration. The API key is project-bound and should be created for the intended Framer Visual Lab project.

## Supported V1 modes

### inspect

Read:

- project info
- color styles
- text styles
- canvas structure
- selected portable visual attributes
- responsive/breakpoint hints visible in the canvas tree

Normalize the result into `riosystems.visual-design-contract.v1`.

### visual_edit

Requires `allow_visual_write: true`.

Allowed operation types:

- `inspect_project`
- `create_frame`
- `add_text`
- `add_svg`
- `set_attributes`
- `set_text`

The allowlist intentionally excludes any publishing, deployment, site-setting, CMS, redirect, custom-code, destructive, or paid action.

## Production ownership

Framer output is a visual design source and evidence layer.

The final website must still be reconstructed through the native Web Factory using portable primitives such as:

- HTML
- CSS
- SVG
- standard DOM
- lightweight JavaScript

The final site must not require Framer at runtime.

## Web Factory integration

Legacy synchronous callers keep using:

`executeWebFactoryTask()`

The live provider path uses the new async sibling:

`executeWebFactoryTaskWithVisualProvider()`

This avoids changing the semantics of existing synchronous factory integrations.

When the Framer route is selected, the async path:

1. validates the guarded Framer request
2. connects through the Framer Server API
3. snapshots the project before changes
4. executes only allowlisted visual operations
5. snapshots the project after changes
6. normalizes visual evidence into the existing provider-neutral visual design contract
7. disconnects in a `finally` block
8. sends the selected design contract to native reconstruction
9. returns provider evidence with Production, deploy, paid action, and domain change locked to false

## Zero-network smoke test

Run:

`npm run check:web-framer-live`

The smoke test uses an injected fake Framer connection. It verifies the provider contract without contacting Framer or using a real credential.

It covers:

- forbidden publish/deploy/domain/paid/customer-data/destructive actions
- runtime-secret requirement
- safe visual inspection
- guarded visual edits
- visual design contract normalization
- disconnect cleanup
- legacy synchronous Web Factory regression
- integrated Framer → native reconstruction flow

## Live activation gate

Live activation is intentionally separate from implementation.

Required before the first real Framer Server API read:

1. operator creates a project-bound Framer API key in the intended Visual Lab project
2. key is stored only in the local/runtime secret environment as `FRAMER_API_KEY`
3. project URL is configured for the intended AURENTARA SYSTEMS Visual Lab
4. first live run uses `mode: inspect`
5. verify project identity and provider evidence
6. only then enable a scoped `visual_edit` request

No publish, deploy, DNS, custom domain, Production, real customer data, or paid action is part of this activation.
