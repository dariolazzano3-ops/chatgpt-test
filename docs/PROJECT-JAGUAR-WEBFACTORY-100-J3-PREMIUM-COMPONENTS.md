# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J3

## Premium Component Registry V1

J3 extends riosystems.component-system.v2 and the existing renderers. It does not create a parallel component engine.

Each registered component carries:

- semantic contract
- responsive contract
- accessibility contract
- content requirements
- asset requirements
- visual variants
- motion variants
- renderer binding

The registry contains the required core components and Local Business components, including RestaurantMenu, GelateriaFlavorGrid, BakeryProductGrid, PricingBoard, BookingCTA, LocationCard, OpeningHoursCard and ContactActions.

### Evidence safety

Component payload validation blocks:

- facts outside CONFIRMED / APPROVED / DERIVED_SAFE
- unverified testimonials
- missing required assets
- assets with unknown or disallowed rights
- unsupported visual variants
- unsupported motion variants

No component contract permits fabricated facts.

### Architecture

Existing WebFactory renderers are reused where present. Components that require richer premium rendering are registry extensions within the same WebFactory component system.

Adapter capability:

web.components.registry.v1

Operations:

- registry
- get
- validate
- select

Production, public launch, DNS, billing and paid activation remain disabled.
