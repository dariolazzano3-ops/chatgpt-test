# PROJECT VISUAL FOUNDRY — Wave 11 Visual Model Router

Wave 11 reuses the existing RIOSYSTEMS `ai.providers.v1` registry. It does not create a second provider registry.

Visual tasks are provider-neutral: REFERENCE_SEMANTIC_ANALYSIS, REFERENCE_REGION_LABELING, UI_IMPLEMENTATION, DELTA_REASONING, REPAIR_CODING, SEMANTIC_VISUAL_REVIEW.

Routing considers task support, quality tier, benchmark score, estimated cost, latency, and availability. Cost and latency guards fail closed. Provider/model identity is recorded only in VisualTaskResult/evidence and never written into ReferenceSpec.

All visual provider calls disable tools, external data, external writes, and production deployment by default.
