# PROJECT VISUAL FOUNDRY — Wave 1 Reference Registry

Wave 1 introduces the system-wide Reference Registry contract.

Only records with `status=APPROVED` are eligible as Visual Source of Truth. Approved records are locked. A design change must start with a `riosystems.reference-change-request.v1` and produce a new reference version; approved reference bytes/metadata are not silently mutated.

States: CANDIDATE, APPROVED, SUPERSEDED, REVOKED.

The empty canonical registry seed lives at `factory-state/visual-foundry/reference-registry.json`. No AURENTARA approved image is fabricated or inserted by this wave.
