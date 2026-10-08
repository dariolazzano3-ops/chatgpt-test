# GelatoDonatello

Standalone Cloudflare Worker mirror of the current public Gelato Donatello website.

Source reference: https://gelato-donatello.pages.dev/

The worker proxies every route, asset, legal page and interaction from the current production site so the preview stays visually and functionally identical while we prepare an independent static snapshot.

## Local

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Cloudflare project/worker name: `gelatodonatello`.

## Independence note

This first exact mirror intentionally uses the current production site as its origin. The next hardening step is to snapshot HTML/CSS/JS/images into this project so it no longer depends on the origin while preserving pixel/behavior parity.
