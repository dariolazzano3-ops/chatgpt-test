# PROJECT VISUAL FOUNDRY — Wave 13 Responsive Reference Engine

Each viewport is evaluated in one of two explicit modes.

EXPLICIT_REFERENCE requires an approved ReferenceRecord at that exact viewport and can report REFERENCE_MATCH_PASS/FAIL.

INFERRED_RESPONSIVE is used when no approved viewport reference exists. It may report INFERRED_RESPONSIVE_PASS/FAIL based on overflow and usability invariants, but it can never claim REFERENCE_MATCH.

This prevents an unreferenced mobile layout from being mislabeled as a reference reproduction.
