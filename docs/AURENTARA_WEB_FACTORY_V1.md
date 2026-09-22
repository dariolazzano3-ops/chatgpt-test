# AURENTARA WEB FACTORY V1

Status: CANONICAL DRAFT
Branch: factory/aurentara-web-factory-v1

## Purpose

AURENTARA WEB FACTORY V1 is the permanent reference-driven workflow for producing premium websites quickly without rebuilding solved primitives.

Owner priority:

TIME FIRST → REUSE FIRST → REFERENCE FIRST → BUILD ONLY THE MISSING DIFFERENCE

The existing Project Factory remains the execution/preview backbone. This workflow upgrades how a website is specified, assembled, visually verified and closed.

## Existing proven backbone to reuse

- Project Factory V3 chat -> edit -> validate -> preview loop
- existing factory project branches and draft PR previews
- Cloudflare private/shared preview path
- Playwright in the repository
- scripts/visual-qa.mjs desktop/mobile screenshots and viewport checks
- production remains explicit and approval-gated

Do not build replacements for those capabilities.

## Input contract

A job may contain reference URLs/videos/screenshots, business facts, brand assets, required pages/conversion goal, and an existing project/branch when evolving a site.
References are visual/interaction sources, not permission to copy protected brand assets or another site's complete identity.

## Canonical production loop

### 0. Truth scan
Target: 60-90 seconds. Determine new vs existing project, active path/branch/preview, current stack, reusable components, assets and real-data boundaries. Do not redesign architecture.

### 1. Reference DNA
Extract layout/silhouette, spacing/density, typography, color/material language, imagery, navigation, section rhythm, motion/scroll behavior, hover/interactions and desktop/mobile differences. Output a compact DESIGN_DNA before implementation.

### 2. Reuse scan
Search in this order:
1. existing project component/code
2. existing repository/factory primitive
3. installed package/library
4. proven external reusable component/template/tool
5. tiny adaptation
6. custom implementation only for the missing delta

Candidate sources may include UI kits, templates, Framer components, shadcn/21st-style components, motion libraries, GSAP examples, Rive assets or suitable open-source packages.
If a new tool/dependency path consumes more than about 90 seconds without concrete progress, drop it and use the next proven path.

### 3. Lane selection
Use the simplest proven lane. Presentation-heavy marketing work uses the fastest proven visual route. Framer is only a candidate when a real adapter/workflow is available and faster. Application/runtime-heavy work keeps the existing app/runtime stack. Never migrate frameworks just for one page.

### 4. Assets first
Resolve hero media, renders, transparent layers, logos/icons, textures, video/animation material and available fonts before large layout rewrites. Generate new assets only when deliberately required.

### 5. Compose first pass
Target: strongest useful first pass in roughly 10-20 active minutes when assets/content are ready.
Priority: silhouette -> hero -> typography -> major media -> section proportions -> navigation -> responsive composition -> motion -> fine polish.
Engineering agents assemble and integrate. They do not invent a generic design when a reference spec exists.

### 6. Motion layer
Use motion only where it improves storytelling, hierarchy or conversion. Prefer CSS/native motion, then existing project primitives, then Motion/Framer-native effects, GSAP/ScrollTrigger for complex scroll choreography, Rive for interactive state-machine animation, and 3D only when genuinely required.

### 7. Visual QA
Run existing Playwright visual QA on desktop and mobile, adding tablet/project-specific widths when necessary. scripts/visual-qa.mjs remains the viewport/safety baseline. A technical PASS alone is not a visual PASS.

### 8. Visual closure loop
SCREENSHOT -> COMPARE TO REFERENCE -> FIND 3 HIGHEST-IMPACT DIFFERENCES -> FIX ONLY THOSE -> SCREENSHOT AGAIN
Fix silhouette, scale, hierarchy, typography, media placement, density and responsive behavior before tiny pixel details.

### 9. Preview
Reuse Project Factory preview behavior. Every accepted iteration should have one canonical review destination. Production stays OFF until explicitly approved through existing governance.

### 10. Acceptance gate
Accept only when real DOM/components are used, screenshots are not embedded as the UI, required functionality works, real data is used where applicable, desktop/mobile are intentionally composed, major overflow/errors are absent, major reference mismatches are closed, preview evidence exists, and production state is explicit.

## Permanent output for every website job

1. DESIGN_DNA
2. REUSE_PLAN
3. LANE
4. ASSET_PLAN
5. FIRST_PASS
6. VISUAL_QA
7. CLOSURE_DIFFS
8. PREVIEW
9. ACCEPTANCE_EVIDENCE

## Current implementation truth

Already available: Project Factory execution/edit/preview backbone, Playwright, and desktop/mobile screenshot QA.
Not yet assumed wired: automatic TikTok/video frame extraction, automatic component-marketplace search, Framer write adapter, GSAP/Rive adapters, or semantic image-diff scoring against arbitrary references.
Add those only when a real pilot proves they save more time than they cost.