# LUNARA original visual standard: "Lunara – Mia.pdf"

Status: **Design benchmark**, not a production launch authorization. Based solely on the user-uploaded original 9-page PDF (27 Oct 2026). Use its **design language** for V2 PDF rendering; retain personalized storytelling and all staging safeguards.

## Original PDF composition (verified by inspecting the uploaded PDF)

- Exactly **9 pages**, custom **720 × 1224 pt** portrait page size, not A4.
- Page 1: violet/black star-field background, crescent/moon **Lunara** logo image at top, centered personalized heading "Schlaf gut, Mia", ornamental star divider and quiet introduction.
- Pages 2–8: seven story pages (printed numbers 1–7) with exactly one repeating, full-bleed starry violet background image behind **selectable/searchable text**. Story starts on p2 with a large centered title, `Mia im Schimmergarten der leuchtenden Tierfreunde`.
- Page 9: matching star background, personalized short ending and large bottom "Schlaf gut, Mia 🌙".
- PDF text color **#F4EBDD** (verified spans).
- Real font metadata: **Cormorant Garamond Regular** for cover/title (36 pt on cover, 30 pt story title), **Lora Regular** for body (~19 pt) and ending (~21 pt); ~29.5 pt line separation in story. Fonts **must not be distributed** with extracted assets.
- Two reusable full-page raster assets are embedded: cover image (1024×1536 JPEG, contains original moon/Lunara logo), and inner-page background (1024×1536 JPEG, contains no overlaid text). The latter is reused on all story/end pages. Text is not baked into the background.
- Original personalization: Mia, favorite bunny named Coco, painting, warm light/colors, soothing animal friends, a calm sleep-oriented ending.

## Acceptance rules for Lunara Factory V2

1. Generate story using the existing Make LUNARA production modules; **do not re-generate story at each rendering retry**.
2. Use original starry full-bleed page artwork and cover moon brand mark, with user-specific cover headline.
3. Preserve warm ivory typography and book-like serif text with comfortable margins and justified/consistently aligned paragraphs as verified by visual QA.
4. Dynamic pagination must be content aware. Story may vary in length; **no clipped lines, overlapping text, widows or orphaned headings**. Story pages should be numbered from 1.
5. Always have a personalized cover page, story body, and personalized closing page.
6. Text must remain accessible/searchable in the final PDF; do not rasterize the whole output.
7. Compare an exported V2 PDF visually with the uploaded original. `%PDF` header, file size, or passing text QA **does not establish premium visual parity**.
8. Only test with fictitious child data. Never activate real deliveries, Stripe Live, or a public shop as part of layout recreation.

## Current implementation gap

Make scenario 8209196 has verified AI story → quality evaluation → Google Docs → PDF → one-time R2 upload in sandbox, but its Google Docs HTML document uses a **plain text-first layout** with default PDF pagination. It does NOT yet reproduce original full-bleed background, logo, typography or page composition. The visual-output renderer is the next design bottleneck; do not rewrite the AI story pipeline or replace the secure D1/R2 scheme merely for a visual upgrade.

## Reusable asset handoff

User-provided original backgrounds were successfully extracted without the original text. The local QA asset package contains `cover_background.jpeg`, `story_background.jpeg`, and `design_spec.json`. Treat the original itself as the authoritative visual reference. Do not add font files to the package.

Avoid modifying the existing live website or production data based on the visual reference alone.
