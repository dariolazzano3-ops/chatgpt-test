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
## Iteration vom 28.10.2026 | L06-01 / L06-02 | PARTIAL

### Top-3-Hebel, messbare Akzeptanz
1. **L06-01 P0, Stripe-Zustellweg:** Im Sandbox-Workbench-Event-Delivery-Protokoll zu `evt_1UV7MvB93JLuapUuivWMhl9I` für Endpoint `we_1UV6YhB93JLuapUur7B9GSpN` tatsächlichen Attempt-Zeitpunkt, HTTP-Code und Antworttext belegen. Erst daraus exakt eine Ursache ableiten. **BLOCKED**: Stripe REST/MCP liefert keinen Attempt-HTTP-Verlauf; Stripe CLI ist auf dem verbundenen VPS nicht vorhanden.
2. **L06-02 P0, signierter D1-Paid-Übergang:** Nach erwiesener Ursache genau einen authentischen Stripe-Sandbox-Retry mit `D1 pending_payment → paid`, `paid_at` und genau einem geänderten Datensatz nachweisen; danach unveränderten Replay/Parallel/Negativtest. **BLOCKED** durch L06-01, aber lokale Handler-Unit-Tests **DONE-VERIFIED**.
3. **L06-03 P0, Produktionsfreigabe:** Nur nach L06-02 serverseitiges D1-Claim/Outbox und genau einen autorisierten kostenfreigegebenen Track-04-Sandbox-Dispatch nachweisen. Bis dahin **BLOCKED**; keine Make-Änderung, keine Story-Produktion, kein Checkout.

### Frisch verifiziert, 28.10.2026
- Stripe-Konto **YSRIO Sandbox** (livemode=false); exakt ein aktiver Endpoint `we_1UV6YhB93JLuapUur7B9GSpN`, URL `https://lunara-factory-v2-stripe-test-hook.gelato-donatello-dario-a5a5376c.workers.dev/stripe`, aktiviert für `checkout.session.completed` und `checkout.session.async_payment_succeeded`.
- Stripe-Testevent `evt_1UV7MvB93JLuapUuivWMhl9I` hat weiterhin `pending_webhooks=1`. Referenz-Session `cs_test_a1Ewwg1g7rXgvJjFz6RnplcvkNJ3sSzsvZeWswm13ZZ1i49TXcFgQD6kk9` ist `complete/paid`, `livemode=false`, `amount_total=1290`, `currency=eur`; `client_reference_id` entspricht der D1-Order `00000000-0000-4000-8000-000000000028`.
- Cloudflare Worker ist deployed (100 % aktuelle Version `c4a217c8-452e-467e-83ac-08176bf2de9d`); Live-Ingress-Source exakt bytegleich mit `src/lunara-factory-v2/stripe-test-ingress.mjs` im Projektbranch. `DB` zeigt auf D1 `c33f0647-f15d-439b-bdb1-0aa3afd21703`, Binding `STRIPE_WEBHOOK_SECRET` vom Typ `secret_text` vorhanden. **Der tatsächliche Signing-Secret-Wert und seine Zuordnung zum Stripe-Endpoint bleiben unbestätigt.** Kein Secretwert gelesen/kopiert.
- Echter HTTP-Smoke: `GET /health → 200`; unsignierter `POST /stripe → 400 invalid_signature`. In EU-D1 hat die bestehende Order nach diesem Test weiterhin `status=pending_payment`, `paid_at=NULL`; keine manuelle Mutation.
- Diagnose-Tabelle `lunara_webhook_diagnostic`: `invalid_signature`, Count `2`, letzter Eintrag `2026-10-27 11:13:35`. Diese Einträge sind **nicht** der Stripe-Ereignisquelle zuordenbar; einen davon erzeugte ein dokumentierter eigener Negativtest. Keine unbelegte Zuschreibung.
- Online erreichbar: GitHub, Stripe-Testkonto, Cloudflare API/EU-D1, Desktop Commander VPS. Original-Make-Factory, Track-04-Szenario, produktive Worker und Checkout unangetastet.

### Tests und Codebeleg
- Neue Testsuite: `test/lunara-stripe-ingress.test.mjs`, Commit `f0405cd47f69e51716d7e37bc2a6a393a03c361d`.
- Node.js 24 auf bestehendem VPS, isoliert in `/tmp/lunara-commerce-track06`: **19/19 PASS, 0 FAIL**. Synthetische signierte HMAC/Raw-Body-Payloads, D1-Mock mit bedingtem Atomic-CAS; gültig bezahlt, Replay, 16 parallele Calls, falscher Betrag/Währung, unbekannte Order/Session, unpaid, livemode, stale/tampered/wrong/missing signature, success-page bypass, async paid, unrelated event, fehlendes Secret/DB, nicht-pending Order.
- Test-Grenze: simulierte D1-Schnittstelle und synthetisches Secret, **kein Beleg** für eine von Stripe unter echtem Endpoint-Secret signierte Delivery und **kein echter EU-D1-Paid-Claim**. Ein Worker-Test-POST ohne Signatur prüft ausschließlich die Ablehnung.

### Kleinster verbleibender Blocker und sichere Fortsetzung
Im **YSRIO Sandbox** Stripe Dashboard → **Workbench → Webhooks → Endpoint `we_1UV6YhB93JLuapUur7B9GSpN` → Event deliveries** → Event `evt_1UV7MvB93JLuapUuivWMhl9I`: Attempt-Zeit, HTTP-Code und **nicht-sensitive** Antwortursache ablesen. Falls 400, Response-Text prüfen; **nur wenn `invalid_signature` für diesen Stripe-Attempt nachgewiesen wird**, Signing Secret zwischen genau diesem Sandbox-Endpoint und Cloudflare `STRIPE_WEBHOOK_SECRET` **innerhalb der jeweiligen Dashboards** prüfen/korrigieren, nie durch Chat oder Git. Falls 403/404/409/5xx, zuerst den konkreten nachgewiesenen Pfad korrigieren. Dann Stripe-Sandbox-Delivery gezielt erneut zustellen, D1 vor/nach prüfen, eventuelles Replay vergleichen. Keine automatische Auszahlung, kein Make-Dispatch.

### Track-04-Übergabe-Ticket (nur Schnittstellenentwurf, keine Implementierung)
**L06→L04-01:** Nach authentischem D1-`paid` soll nur ein atomar erzeugtes, dauerhaftes `order_id`-gebundenes Claim/Outbox-Element einen Produktionsaufruf freigeben. Ein Retry darf einen bestehenden Claim nicht erneut senden; eine unbestätigte Make-Antwort braucht idempotenten Eingangsvertrag und kontrollierte Nachverarbeitung. Nur IDs/Version/autorisiertes `story_pdf`-Produkt, keine Kinddaten/Secrets in Logs oder Stripe-Metadaten. Track 04 bleibt alleiniger Writer für Make 8209196. D1-Schema oder Dispatch erst nach Interface-Abstimmung mit 04,07,10 und separater Test-Kostenfreigabe.

### Rollback, Kosten, Sicherheitsgrenzen
- Diese Iteration ändert **nur** einen isolierten GitHub-Unit-Test und diese Track-Dokumentation. Rollback bei Bedarf: Test-Datei `test/lunara-stripe-ingress.test.mjs` auf dem Branch per Revert von Commit `f0405cd47f69e51716d7e37bc2a6a393a03c361d` entfernen, Track-Evidenz historisch belassen. Kein Cloudflare-/D1-/Stripe-/Make-Konfigurations-Rollback nötig.
- Testaufrufe: ausschließlich Node lokal und kostenlose Test-/Read-APIs; **0 echte Abbuchungen, 0 KI-Story-Generierungen, 0 Kunden-E-Mails, keine Secrets offengelegt**. Keine neue Infrastruktur und keine produktive Veröffentlichung.
- **Status L06-01 BLOCKED, L06-02 BLOCKED (19 Unit-Tests bestanden), L06-03 BLOCKED.** Nicht als E2E-Fertigstellung ausgeben.

### Zusätzlicher Scope-06-Sicherheitscheck: separater API-Adapter
- Der private Worker `lunara-factory-v2-api-private` ist **nicht** der bei Stripe registrierte Endpoint. Frischer Cloudflare-Read: `CHECKOUT_ENABLED=false`, `MAKE_DISPATCH_ENABLED=false`, `ALLOW_LIVE_PAYMENT=false`, `AUDIO_ENABLED=false`; aktuell **keine** Secrets in diesem API-Worker, ausdrücklich auch kein `STRIPE_WEBHOOK_SECRET`. Sein separater `/api/webhooks/stripe`-Handler ist damit derzeit **fail-closed (503)** und kann keinen Paid-/Dispatch-Übergang auslösen.
- Source-Audit `src/lunara-factory-v2/worker.mjs`: Dieser **inaktive alternative Handler** prüft nach Signatur aktuell noch nicht ausdrücklich `event.livemode=false`, `session.livemode=false`, Checkout-Produkt/Betrag/Währung, bevor er `paid` setzt; er darf nicht als Ersatz für den getesteten schmalen Ingress aktiviert werden. **L06-Security-Follow-up (PARTIAL):** Vor jeder zukünftigen Konfiguration/Aktivierung diesen alternativen Handler auf denselben fail-closed Vertrag bringen oder entfernen, separate Tests verlangen. Kein zusätzlicher Stripe-Endpoint, kein Secret, kein Dispatch aktiviert.
