# FollowClean V19 – Premium Conversion (Kandidat, nicht deployt)

## Ablauf
Instagram-Name → „Jetzt analysieren“ → animierte Analyseansicht (Name, Zugang, 10er-Abruf, Rückfolge) → ehrliches Ergebnis → Premium-Angebot (Stripe TEST, 1 €, RIO 100 %) → serverseitige Freischaltung per Webhook → Premium-Bereich mit Exportanleitung und ZIP-Upload (lokal im Browser) → bestehender Cleanup (grün besucht, besucht ≠ entfolgt, Fortschritt, lokale Speicherung).

## Live-Scan-Status (tatsächlich)
**Kein Live-Scan aktiv.** `/api/scan/free` antwortet immer `NO_RELIABLE_LIVE_RESULT` (`provider_not_verified`), 0 geprüfte Accounts, 0 USD. Die UI zeigt „Kein verlässlicher Live-Treffer möglich“ und nie einen Demo-, ZIP- oder erfundenen Treffer. Die Treffer-Darstellung (Name, Prüfzeitpunkt, „Instagram-Profil ansehen“, exakter Premium-Text) existiert und erscheint nur bei `status=CONFIRMED_NONFOLLOWER` und `live=true` vom Server – den der Server derzeit nicht liefern kann.
Gründe: Apify-Token-Rechte (403/404), Actor-Preise/Mindestkosten/Schemas und Negativ-Ergebnisqualität unbelegt; Meta/Instagram-Nutzungsbedingungen zu automatisierter Datenerhebung und DSGVO-Grundlage ungeprüft. Ohne diese Nachweise wird nichts aktiviert.

## Premium-Freischaltung
- Client erzeugt zufällige Claim-ID `fc_<32 hex>`, Checkout-Link `buy.stripe.com/test_…?client_reference_id=<claim>`.
- `POST /api/premium/webhook`: Stripe-Signatur (HMAC-SHA256, 300 s Toleranz, konstante Vergleichszeit), nur `livemode=false`, nur `cs_test_`-Sessions, nur `paid`/`no_payment_required`, optional fester Payment-Link. Idempotent (Session-PK, Event-UNIQUE, INSERT OR IGNORE). Tabelle append-only, keine Namen/E-Mail/Kartendaten.
- `GET /api/premium/status?ref=` → signiertes Token erst nach gespeicherter Bestellung; `POST /api/premium/verify` prüft Signatur, Ablauf und Bestellung erneut.
- Ohne Webhook-Secret/DB: 503, nichts wird freigeschaltet (fail closed).
- Grenze: Der ZIP-Bereich ist clientseitig ausgeblendet; die Auswertung läuft lokal, technisch Versierte könnten das Gate im Browser umgehen. Server-Wahrheit = Bestelltabelle.

## Missbrauchsschutz
Rate Limit 10 Scans/IP/h, 5/Name/h, 120 Status-Abfragen/IP/h; IP nur als gekürzter, gesalzener Hash; alte Fenster werden gelöscht. Same-Origin-Pflicht für Scan/Verify, Body-Limits.

## Tests (lokal, synthetisch)
Alle 11 Suiten grün: 9, 14, 17, 8, 11, 18, 18, 23, release-verify 12 (2 neue V19-Gates), chrome-ux 19, **premium-conversion-e2e 19** (Worker-API + echter Chromium-Durchlauf: Start ohne ZIP, ungültiger Name, Analyse ohne Fake-Treffer, Exporthinweis vor Kauf, Pending, gefälschtes Token abgelehnt, signierter TEST-Webhook schaltet frei, Reload). Nicht getestet: Safari/WebKit, echter Stripe-Webhook, Live-Provider.

## D1
`followclean-db` erhielt additiv `fc_premium_orders_v1` (+ Index, Update-Sperre) und `fc_rate_limit_v1`. Ledger unverändert. Alte DB `chatgpt-test-db` unberührt.

## Deploy-Schritte (Release-Owner)
1. V18 Schritt B (Binding → followclean-db) abgeschlossen und abgenommen.
2. Rio: in Stripe **Testmodus** Webhook-Endpunkt `https://<preview-host>/api/premium/webhook` für `checkout.session.completed` und `checkout.session.async_payment_succeeded`; Signing-Secret als Worker-Secret `FC_STRIPE_WEBHOOK_SECRET` setzen (optional `FC_STRIPE_PAYMENT_LINK_ID`).
3. `release/v19-candidate/worker.mjs` (Hash laut Manifest) mit 0 % hochladen; Gates: Startseite ohne ZIP, Scan = NO_RELIABLE_LIVE_RESULT, `/api/premium/config` → `unlockConfigured:true`, Testkauf mit RIO → Freischaltung erscheint, `/api/analysis/start` = 503.
4. iPhone-Safari-Abnahme, dann Traffic. Rollback: vorherige Version.
**Ohne Schritt 1–2 nicht deployen**, sonst erreicht niemand mehr die ZIP-Analyse.
