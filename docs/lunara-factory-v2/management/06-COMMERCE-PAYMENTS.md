# Track 06 | Bestellung, Stripe & Zahlungsbestätigung
**Mission:** Genau ein sicher bestätigter Kauf erlaubt exakt eine Produktionsauslösung.

## Verifiziert
- Shopify ist nicht mehr die Zielplattform.
- Stripe **Sandbox** hat einen abgeschlossenen Testkauf über **12,90 EUR**.
- Derselbe Order-Datensatz in EU-D1 blieb **pending_payment**; Stripe meldete zuvor `pending_webhooks=1`.
- Worker `lunara-factory-v2-stripe-test-hook` besitzt D1 und geheimen Stripe-Signatur-Schlüssel, signaturprüfenden Test-Only-Handler; zwei `invalid_signature`-Diagnostikzähler beweisen **nicht** die tatsächliche Stripe-Fehlerursache.
- Test-Checkout-/Make-Freigabe im privaten Frontend AUS.

## Aufgaben in Reihenfolge
- [ ] Stripe-Endpunkt-Zustellversuche inkl. Zeit/HTTP-Status authentisch prüfen; Eventtyp, Endpoint und Secret-Konfiguration gegen Test-Only-Worker vergleichen.
- [ ] Signierte Sandbox-Zahlung mit passender Session, Order-ID, Währung, Betrag und Produkt in D1 **genau einmal** auf paid bringen. Ungültige Signatur/falscher Betrag/falscher Modus → abweisen.
- [ ] Webhook-Replays und gleichzeitige Ereignisse testen: idempotente Order-Transitions, kein doppelter Make-Start.
- [ ] Erst danach einen serverseitigen Paid-Claim und autorisierte Make-Sandbox-Dispatch testen; kein Trigger durch eine bloße Success-Seite.
- [ ] Produktpreis, Steuer-/Belegangaben, Widerruf bei digitalen Gütern und Rückerstattung mit 01/10 abstimmen.
- [ ] Live-Schlüssel, Live-Stripe-Checkout und echter Geldverkehr bleiben AUS bis ausdrücklicher separater Freigabe.

**Definition of Done:** Reale **Stripe-Test**-Zustellung reproduzierbar: paid→D1 paid→einmalige Sandbox-Freigabe; negative/replay/unknown order Tests. Keine Annahmen über Stripe-Fehlerdiagnose.
**Abhängigkeiten:** 01, 04, 07, 10.
**Status:** BLOCKED, höchster operativer Hebel.