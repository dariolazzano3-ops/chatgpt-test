# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J6

## Evidence-Safe Content + SEO V2

J6 extends the existing content, Project Content Rights QA and SEO V2 architecture. It does not create a parallel content engine or SEO engine.

### Fact states

Every factual claim entering the J6 evidence layer is normalized to exactly one state:

- CONFIRMED
- DERIVED_SAFE
- NEEDS_CONFIRMATION
- PROHIBITED

Renderable claims require source references and confidence.

DERIVED_SAFE additionally requires an explicit derivation.

NEEDS_CONFIRMATION and PROHIBITED are never renderable.

### Content surfaces

The evidence registry supports:

- Brand Voice
- Page Intent
- Section Copy
- Product Copy
- Menu Copy
- FAQ
- CTA
- Microcopy
- Alt Text

The contract emits only renderable fact IDs as generation inputs.

### Render Guard

The Web OS scans rendered HTML for non-renderable claims.

If a PROHIBITED claim appears in rendered HTML:

BLOCK.

If a NEEDS_CONFIRMATION claim appears in rendered HTML:

BLOCK.

Factual supplied content such as pricing, phone, address, opening hours, testimonials, product/menu/service claims must be covered by evidence-safe facts.

### SEO evidence

J6 reuses:

- createSeoArchitecture
- createStructuredDataContract
- runTechnicalSeoQa
- createLocalSeoContract

and adds an evidence bundle for:

- title
- meta description
- canonical
- heading hierarchy
- internal linking
- alt-text policy
- sitemap
- robots
- 404
- redirects
- structured data
- Local SEO
- NAP integrity

Gelateria / gelato / Eisdiele are now included in the existing Local SEO classification.

### Structured data

Schema fields may only be sourced from CONFIRMED facts.

DERIVED_SAFE facts may support normal copy, but are not schema-eligible.

NEEDS_CONFIRMATION and PROHIBITED facts never enter schema.

### NAP integrity

Name, address and phone occurrences are compared against confirmed canonical facts.

Mismatch is blocking.

No local address, phone, opening hours or legal fact is fabricated to complete schema.

### Static SEO artifacts

Web OS V2 now writes:

- robots.txt
- sitemap.xml
- 404.html
- _redirects
- web-os-v2-content-evidence.json
- web-os-v2-seo-evidence.json

Staging remains noindex/disallow-all.

Production indexing policy remains a separate future approval.

### Adapter

Capability:

web.content-seo.v2

Operations:

- content
- seo
- render_guard
- apply_seo_artifacts
- manifest

### Architecture safety

Existing SEO V2 remains authoritative.

Existing Project Content Rights QA remains authoritative for project-pack provenance and rights.

J6 is the evidence and render-safety contract between project truth, content generation, render output and SEO.

### Safety

Production, public launch, DNS, billing and automatic paid activation remain disabled.
