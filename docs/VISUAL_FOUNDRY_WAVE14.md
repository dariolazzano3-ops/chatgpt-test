# PROJECT VISUAL FOUNDRY — Wave 14 Asset Ledger / Asset Pipeline

Asset provenance is explicit: ORIGINAL_ASSET, REFERENCE_EXTRACTED, OPERATOR_SUPPLIED, GENERATED_REPLACEMENT, TEMPORARY_PLACEHOLDER.

The ledger reuses the existing RIOSYSTEMS asset-rights validation. Fidelity-relevant assets (HIGH/CRITICAL) block acceptance when the original or an approved replacement is unavailable.

Generated replacements and temporary placeholders are never silently presented as originals. Temporary placeholders cannot become final approved assets.
