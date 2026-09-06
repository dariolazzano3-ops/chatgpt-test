# PROJECT VISUAL FOUNDRY — Wave 2 ReferenceSpec V1

ReferenceSpec V1 is a provider-neutral, machine-readable measurement contract. It stores structured measurements with value, unit, tolerance, source method, confidence, and human-override state.

Provider/model identifiers are forbidden inside ReferenceSpec. They belong to execution evidence, not design truth.

The contract intentionally separates observed measurements from semantic interpretation and prevents free-form LLM prose from becoming the visual source of truth.
