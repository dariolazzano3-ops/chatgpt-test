# Gelato Donatello V125 private Events image replacement: exact-asset gate

Source: user-uploaded PNG `AF38B251-D59A-4AD6-89B8-71F7103E1035.PNG` available in conversation attachment, not on GitHub build machine.

- Expected repository path: `projects/gelato-donatello-premium-v6/assets/images/events/gelato-event-eislabor-original-v125.png`
- Original bytes: **4087171**; dimensions **1672 x 941**; RGB PNG.
- Exact SHA256: `c1072c61d3b0ef5d70b1dafe1dad1b130129ec25f9848bc0be0f546086237d8c`
- Image must be copied bit-for-bit into the GitHub branch; *do not transcode or resize*. New V125 test fails deployment closed unless content, dimensions and hash match.
- The markup/CSS are prepared: full original aspect, no object-fit cover, no crop, no zoom, no overlay, centered subject mobile, caption on discrete espresso strip.
- Temporary synthetic 1672x941 PNG was used only for responsive geometry checks on 320, 360, 390, 412, 768 and 1440px and was removed before commit.
- No live or private preview deploy occurred from this branch while the PNG was absent. Original V124 working branch and Cloudflare remain unchanged.
