# LUNARA FACTORY V2 | Premium PDF Visual Acceptance | 27 October 2026

## Source of truth
The user-uploaded original `Lunara – Mia.pdf` is the design benchmark. The reusable background images are extracted from its cover and story pages; no fonts are redistributed. The original is 9 pages at 720×1224 pt and includes a full-bleed violet star field, crescent/Lunara brand mark on cover, serif ivory copy, seven numbered story pages and a separate good-night closing page.

## Implemented, locally rendered and verified
- Standalone Python/ReportLab renderer `render_lunara_premium_v2.py` exists in the conversation export `LUNARA_V2_Premium_Renderer_Paket.zip` (source + original two JPG backgrounds + sample JSON and design spec; no font binaries).
- Input schema: `{child_name, story_title, story_paragraphs: string[], closing_text}`; dynamic paragraph-aware pagination with no rasterized text, vector diamond ornaments, numbered body pages, personalized cover and closing.
- Uses the original full-page background JPEG assets embedded into a searchable PDF.
- Uses substitute EB Garamond + Charis SIL due to original Cormorant Garamond / Lora file-redistribution restrictions. Test PDF itself embeds font subsets, but no standalone fonts are shipped.
- Output verified: `LUNARA_V2_Premium_Mia_Designprobe.pdf`, exactly 9 pages of 720×1224 pt, 7 story pages, 43/43 original story paragraphs present, correct Mia name on first and last page, PDF searchable; raster visual review of title, ornament, body paragraph spacing, and full-bleed background passed.
- Reusable sample is the exact *original user-provided Mia story*, not a newly generated synthetic AI story. This isolates design comparison from text quality changes.
- A contact-sheet preview `LUNARA_V2_Premium_Vorschau.png` shows cover, story and closing.

## Make production: remain on verified safe core
- Make scenario `8209196` already validated: one-time Cloudflare D1 claim → OpenAI story/QA → Google Docs text-first PDF → protected Cloudflare R2; idempotent duplicates fail 409 before AI. Production disabled.
- The original Slides module was not repaired, and Google Docs cannot be assumed to preserve a full-bleed original PDF background, exact typography, and content-aware page composition.
- **The premium offline renderer is NOT yet deployed to Make/Cloudflare.** Do not claim the Make generated PDF matches the original visual quality.

## Target integration (requires secure media deployment)
1. Privately install both original JPEG assets in a dedicated EU-only Cloudflare R2 media location, not publicly accessible.
2. Deploy a Cloudflare Browser Run PDF renderer or appropriately isolated existing VPS renderer with access-controlled job token; accept the four schema fields from the already-QA-approved Make story.
3. Verify one sandbox PDF from Make generated story uses these exact assets and selectable text, handles overflow and page count, and returns actual PDF bytes.
4. Route bytes to the existing single-use R2 storage worker without losing D1 claim or replay protection; do not retry the expensive AI stages.
5. Visually compare cover, a middle spread and closing with the user-provided original. Check line wraps, font glyphs, and 30-day sandbox lifecycle.
6. Only after visual and automated tests pass, switch the **inactive staging scenario** from Google Docs export to premium renderer and run one synthetic E2E test. Do not activate any customer emails or live Stripe.

## Known blockers
- Transfer of original user-uploaded JPEGs from this sandbox to the connected R2 bucket has not yet been completed through available connector capabilities. The local package contains both JPEGs ready for secure upload.
- No truthful assertion of production-wide premium parity or automated delivery before that media transfer and complete Make test.
- Stripe-to-D1 signed webhook for the earlier paid test still recorded pending; unrelated to this visual-design acceptance.
