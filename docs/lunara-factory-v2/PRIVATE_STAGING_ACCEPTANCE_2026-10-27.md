# LUNARA FACTORY V2 | Verifizierter privater Staging-Stand

**Datum:** 27.10.2026 · **Kein Produktivlaunch** · **Keine Kundenbestellungen**

## Bestätigt

| Baustein | Verifizierter Zustand |
| --- | --- |
| Private Shop-Vorschau | Worker `lunara-factory-v2-private`, Cloudflare-Upload 200 |
| Frontend URL | https://lunara-factory-v2-private.gelato-donatello-dario-a5a5376c.workers.dev |
| Frontend Source | `src/lunara-factory-v2/private-preview-worker.js` (aus deployed Worker ausgelesen) |
| Private API | Worker `lunara-factory-v2-api-private`, Quellcode `src/lunara-factory-v2/worker.mjs` |
| API URL | https://lunara-factory-v2-api-private.gelato-donatello-dario-a5a5376c.workers.dev |
| API D1 Binding | `DB`, EU-staging DB `lunara-factory-v2-staging-eu` |
| D1 DB ID | `c33f0647-f15d-439b-bdb1-0aa3afd21703` |
| EU Database | `lunara_orders` mit Statusindex, Ablaufdatum und Ablaufindex angelegt/ausgelesen |
| Access | Owner-only-Applikationen auf **beiden** Worker-Hostnamen erstellt |
| Externer Zugriffstest | Beide Hostnamen liefern unangemeldet **HTTP 302** zur Cloudflare Access Loginseite (27.10.) |
| Make Sandbox | Szenario `8203564`: `LUNARA FACTORY V2 \| SHOPIFY-FREE SANDBOX - INAKTIV` |
| Make Trigger | Neuer Custom Webhook: Sandbox-Schema **mit synthetischem Payload gelernt**, HTTP 200 Accepted |
| Make Mapping | 14 erwartete JSON-Felder erkannt, 0 wartende Webhook-Lieferungen, 0 Szenario-Ausführungen |
| Make Shopify Module | 0 von 74 Modulen (Review-Version) |
| Alte Produktionskopien | Unverändert und inaktiv |
| Node Testprototyp | 12 von 12 lokale Unit-/Smoke-Tests bestanden (Stand-alone-Paket; **nicht** als produktiver E2E-Test ausgeben) |

## Derzeit unveränderliche Grenzen

- Frontend `/api/*` liefert 423, sichtbare Kaufbuttons sind deaktiviert.
- API Worker `CHECKOUT_ENABLED=false`, `MAKE_DISPATCH_ENABLED=false`, `AUDIO_ENABLED=false`, `ALLOW_LIVE_PAYMENT=false`.
- Kein Stripe Secret, kein Stripe Price-ID und keine Make Webhook Credentials im API Worker gesetzt.
- Make-Sandbox nur `mode=sandbox`, `schema=lunara.order.paid.v2`, `product=story_pdf`.
- Make-Testempfänger `test_email` ist im Bridge-Code auf `sandbox@example.invalid` gesetzt, damit keine versehentliche Kundenmail stattfindet. Für ein genehmigtes Test-E-Mail muss das ausdrücklich und sicher umgestellt werden.
- HTTP 200/Accepted des Make Webhooks beweist **Datenschema gelernt**, nicht PDF-Erstellung oder E-Mail-Versand.
- Die API Worker-Meldung `dispatched` bedeutet Make akzeptierte den Eingang, **nicht** erfolgreiche Zustellung.
- Kein automatischer Lauf, kein echter PDF-Kauf, kein Stripe Live Mode, keine Domain-Umstellung und kein öffentliches Marketing.
- Aufbewahrungsfeld `expires_at` löscht Daten **nicht** von selbst; Job + Löschprüfung noch nötig.

## Offene Gates vor echtem Kaufbetrieb

1. **Stripe-Testkonto verbinden** (nächste erforderliche Nutzer-Autorisierung). Nur Testprodukt/-preis und Webhook Secret im geschützten Secret Store einrichten, keine Livekeys.
2. Bestelleingang in eigener Entwicklungsumgebung mit Stripe Test Checkout E2E prüfen, inkl. Signatur, D1 Deduplizierung, Zahlstatus, Abbruch und Rückerstattung.
3. Make Sandbox Review: Apps Script URL, Google Slides/Drive, GPT Modelle, QA, Branches und Fehler-E-Mail-Konfiguration sorgfältig prüfen, bevor *ein* genehmigter synthetischer Lauf mit realer API-Nutzung entsteht.
4. Authentifizierte Make-Produktionsabschlussmeldung zurück in D1 + Reconciliation; kein success aus HTTP Accepted ableiten.
5. Kinderbezogene Daten minimieren, verschlüsseln, Aufbewahrung/Löschung nachprüfbar umsetzen; Datenschutz, Steuer, Impressum, AGB, Digital-Widerruf und Zahlungs-Compliance prüfen.
6. Audio erst anbieten, wenn separate Audio-Factory inklusive QA bestätigt ist.
7. Geschützte Preview testen (Desktop + Mobile) und ausdrücklich freigeben, bevor externe Reichweite Traffic erhält.

## Kosten-/Sicherheitsrahmen

Cloudflare D1 arbeitet nutzungsbasiert, ohne Kapazitäts-Leerlaufgebühr im Rahmen der jeweiligen Tarifgrenzen. Keine bezahlten Make-, GPT- oder Stripe-Testaktionen durchgeführt. Keine produktiven Systeme oder anderen Website-Projekte geändert.
