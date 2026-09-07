# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J5

## Motion Contract V1

J5 extends the existing riosystems.motion-design-contract.v1 and existing Web OS motion quality gate.

It does not create a parallel animation engine.

### Supported motion types

- page entry
- hero reveal
- text reveal
- image reveal
- scroll reveal
- parallax
- hover
- navigation
- section transitions
- marquee
- background motion
- video hero
- legacy fade
- legacy slide
- sticky
- microinteraction

### Per-motion contract

Each motion item contains:

- purpose
- trigger
- duration
- easing
- intensity
- mobile/tablet/desktop breakpoint behavior
- reduced-motion behavior
- accessibility fallback
- runtime engine
- performance budget

Layout-affecting animation is forbidden by the quality gate.

### Reduced motion

Every motion item must have a reduced-motion rule.

Parallax, marquee, ambient background motion and video-hero motion default to disabled/static behavior under reduced motion.

### GSAP

GSAP is optional and must never be loaded globally.

Simple motion stays CSS-native.

Only declared complex motion may require GSAP, and the runtime plan uses dynamic on-demand loading only when at least one declared motion needs it.

The quality gate blocks:

- global GSAP loading
- loading GSAP when no declared motion needs it
- a mismatch between declared GSAP requirement and actual motion items

### Web OS V2

Web OS V2 now returns:

motion.contract
motion.runtime
motion.quality

and writes:

web-os-v2-motion-contract.json

Existing blocking behavior through createMotionQualityGate remains authoritative.

### Adapter

Capability:

web.motion.contract.v1

The adapter returns contract, runtime plan and quality evidence.

### Safety

Production, public launch, DNS, billing and automatic paid activation remain disabled.
