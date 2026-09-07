# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J4

## Asset & Media Pipeline V1

J4 extends the existing riosystems.asset-pipeline.v2 and Web OS V2. It does not create a second project truth, rights engine, provider registry or preview system.

### Image pipeline

Every image contract carries:

- source
- rights
- classification
- quality assessment
- focal point
- crop behavior
- source dimensions
- responsive widths
- AVIF variants
- WebP variants
- JPEG/PNG fallback
- structured srcset
- lazy/eager decision
- decoding and fetch priority
- Sharp materialization contract
- manifest evidence

Unknown rights fail closed.

### Video pipeline

Every video contract carries:

- source
- rights
- role: background or foreground
- source metadata
- local vs stream-review strategy
- MP4/H.264 compression plan
- WebM/VP9 compression plan
- poster source or poster generation
- mobile poster-first fallback
- Save-Data and reduced-data poster-only behavior
- autoplay policy
- background-video preservation assertion

Background autoplay is only allowed muted, playsinline and looped. Foreground videos require user interaction and controls.

A stream route never activates a paid provider automatically.

### Mason regression

The J4 acceptance fixture includes a Mason-like background hero video.

The test explicitly fails if the background video disappears from the media manifest or is silently replaced by a poster in the normal desktop path. Posters remain fallbacks for mobile/reduced-data behavior, not replacements for the approved background-video intent.

### Real materialization evidence

The J4 workflow performs real transformations:

- Sharp AVIF
- Sharp WebP
- Sharp JPEG fallback
- FFmpeg H.264 MP4
- FFmpeg VP9 WebM
- FFmpeg poster extraction

No synthetic PASS is claimed for these capabilities.

### Web OS integration

Web OS V2 now creates the project-scoped media pipeline automatically and writes:

web-os-v2-media-manifest.json

A blocking media validation error becomes a Web OS blocking condition.

### Adapter

Capability:

web.assets.media.v1

Operations:

- pipeline
- image
- video
- validate

### Safety

Production, public launch, DNS, billing and automatic paid activation remain disabled.
