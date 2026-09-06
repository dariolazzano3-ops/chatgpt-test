# PROJECT VISUAL FOUNDRY — Wave 18 Cost Architecture / Cost Guards

Visual measurement is local-first: pixel diff, SSIM, DOM measurements, and geometry are ledgered at zero variable AI cost.

The PoC cost policy uses a 0.50–3.00 USD soft target and a 5.00 USD hard review threshold. Projected cost above 5 USD returns COST_REVIEW_REQUIRED and stops the bounded repair loop.

Reference analysis can be cached by reference hash/analyzer version. Repair contexts reject full-codebase prompts and keep only relevant component code, CSS, delta records, and reference crop.
