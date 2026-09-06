# PROJECT VISUAL FOUNDRY — Wave 4 DOM Measurement Engine

DOM geometry and computed styles are measured from stable `data-visual-id` anchors. The engine records component rectangles, box model, typography, appearance, and grid/flex properties.

Missing or duplicate visual IDs fail closed. Fragile `nth-child` selectors are not a core measurement contract.
