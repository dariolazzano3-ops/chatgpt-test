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

## Autonomous Commerce Completion | 28.10.2026 | Iterationen 1–2

### Iteration 1: aktuelle Diagnose — PARTIAL
- Ist-Zustand frisch per Stripe-Connector: YSRIO Sandbox `acct_1UUVycB93JLuapUu`, `livemode=false`; Event `evt_1UV7MvB93JLuapUuivWMhl9I`, `checkout.session.completed`, weiterhin `pending_webhooks=1`. Session komplett/bezahlt, 1290 EUR-Cent; Session-ID und client_reference_id stimmen mit der bestehenden D1-Order überein.
- Endpoint `we_1UV6YhB93JLuapUur7B9GSpN` enabled, unveränderte `/stripe`-URL und beide Checkout-Eventtypen. Keine Endpoint-Änderung.
- EU-D1 unabhängig gelesen: Order `00000000-0000-4000-8000-000000000028` weiterhin `pending_payment`, `paid_at=NULL`. Read-Metadaten EEUR/WAW, rows_written=0. Diagnose weiterhin nur invalid_signature=2, last_seen 2026-10-27 11:13:35. Kein neuer eindeutig Stripe zuordenbarer Attempt.
- Cloudflare: registrierter Ingress besitzt DB und STRIPE_WEBHOOK_SECRET-Binding. Keine Secretwerte gelesen. Kein Beweis einer falschen Secret-Zuordnung.
- Tatsächliche Ursache des Stripe-Zustellfehlers: **unbekannt**. Work Cloud Browser zur Sandbox-Workbench geöffnet; Weiterleitung auf Stripe-Anmeldeseite. Delivery-Attempt-Zeitpunkt/HTTP/Antwort und Worker-Aufrufkorrelation bleiben BLOCKED durch fehlende Dashboard-Anmeldung. Kein Replay ausgelöst; keine Signature-Ursache geraten.
- Änderungen/Commit/Deployment in diesem Diagnoseblock: keine. Tests: Read-Abgleich PASS; authentischer Stripe→D1-Test BLOCKED. Kosten: keine echte Zahlung, KI oder E-Mail.

### Iteration 2: alternative Zahlungsroute entfernen — PARTIAL
- Nachgewiesene Ursache: der separate API-Handler enthielt einen Paid-Write ohne explizite Sandbox-, Produkt-, Betrags- und Währungsprüfung. Live-Source vor Änderung bytegleich mit Git-Source. Er war aktuell mangels Secret nicht ausführbar, konnte aber durch spätere Konfiguration unsicher aktiviert werden.
- Kleinste Korrektur: ausschließlich den Handler `/api/webhooks/stripe` in `src/lunara-factory-v2/worker.mjs` stillgelegt. Jede Methode erhält 410 `payment_route_retired`, fulfillment=false. Kein D1-Zugriff, keine Weiterleitung und kein Make-Aufruf über diese Route, selbst bei später vorhandenem Secret. Die bisherige Implementierung wurde entfernt. Der registrierte `stripe-test-ingress.mjs` bleibt unverändert und ist der einzige Stripe-Paid-Writer. Neue Zahlungsrouten müssen dessen geprüften Vertrag wiederverwenden und dieselbe Sicherheitsmatrix bestehen; reine Umgebungsvariablen können die entfernte Route nicht reaktivieren.
- Regressionstest vor Korrektur: 2 FAIL, darunter tatsächlicher unerlaubter D1-Zugriff mit gültiger synthetischer Signatur. Nach Korrektur: **28/28 PASS**, 0 FAIL (`node --test test/lunara-factory-v2.test.mjs test/lunara-stripe-ingress.test.mjs`, Node 24.22.1); Syntaxprüfung und git diff --check PASS.
- Testmatrix: gültige signierte Zahlung, Replay, 16 parallele Callbacks, falscher Betrag/Währung/Order/Session, unpaid, Event-/Session-livemode, abgelaufene Signatur, manipulierte Bytes, fehlende/falsche Signatur, Success-URL-Bypass, async success und bereits verarbeitete Order. Zusätzlich alternative Route mit gültiger Signatur und aktivierten synthetischen Dispatch-Flags 16-fach parallel: 0 DB-Aufrufe und 0 Netzwerkaufrufe. **D1-Mock, kein echter Stripe→EU-D1-Beweis.**
- Cloudflare-Staging: nur `lunara-factory-v2-api-private` aktualisiert, Version `9cfdc3d3-1021-4046-97a9-60b344d449e3`, Deployment `61d29f94-c6fa-45bd-9e8a-108226779bbf`, 100 %, 2026-10-28T15:51:08.11476Z. Nach Upload unabhängig ausgelesene Source bytegleich mit getesteter Datei. Bestehende Bindings geerbt; CHECKOUT_ENABLED, MAKE_DISPATCH_ENABLED, ALLOW_LIVE_PAYMENT und AUDIO_ENABLED alle weiterhin false. Keine Secrets hinzugefügt, keine Access-/DNS-Änderung.
- Externer HTTP-Smoke aus Work-Runtime: `/health`, POST `/api/webhooks/stripe`, POST `/api/checkout` jeweils HTTP 403, `error code: 1010`. Das ist **kein** Nachweis der Worker-410/423-Antwort und **keine** Erklärung für das registrierte Stripe-Event. Nicht umgangen. Deployment-/Source-Nachweis PASS, externer API-Runtime-Smoke BLOCKED.
- D1 nach Deployment erneut unabhängig gelesen: weiterhin pending_payment, paid_at NULL, Diagnose unverändert, 0 geschriebene Zeilen.
- Git-Commit: dieser Commit enthält Worker, Regressionstests und diese Evidenz. Ausgangs-HEAD `52309bd`; Commit-ID über Git-Historie dieser Sektion ermittelbar.
- Rollback vorbereitet, nicht ausgeführt: nur diesen Commerce-Commit revertieren; bei notwendigem Staging-Rollback frühere API-Version `4fc43661-90eb-49b8-b610-e93d13068b75` wieder zu 100 % deployen. Alle Aktivierungsflags false und keine Secrets beibehalten, da alte Version den unvollständigen Handler enthält. Keine D1-Migration oder Datenkorrektur erforderlich.
- Kosten-/Datensicherheitsauswirkung: ein Update bestehender Staging-Infrastruktur und begrenzte Tests; keine neuen Dienste, Live-Zahlungen, echten Abbuchungen, Story-Generierung, Kunden-E-Mails oder Make-Aktivierung. Kein Secret in Code oder Bericht.

### Offene Gates und nächster größter Hebel
- L06-01 **BLOCKED**: Stripe-Dashboard-Anmeldung, dann authentischen Attempt für exakt das bekannte Event/Endpoint lesen. Erst danach notwendige Reparatur und echten Stripe-Retry bestimmen.
- L06-02 **BLOCKED**: echte Raw-Byte-Signaturprüfung und einmaliger EU-D1-Paid-Übergang fehlen weiterhin; lokale Tests ersetzen sie nicht.
- Alternative Route: Codeentfernung, Regressionen und Staging-Source **DONE-VERIFIED**, externer HTTP-Smoke **BLOCKED**.
- L06-03 / Phase E **NOT-STARTED** in dieser Ausführung: erst nach echtem Stripe→D1-PASS Produktions-Claim, Track-04-Idempotenz und Recovery konkret abnehmen. Bestehender Schnittstellenentwurf bleibt unverbindlich; keine Schema- oder Make-Änderung. Exactly-once Story-Produktion nicht behauptet.
- Gesamtstatus **PARTIAL**, Definition of Done nicht erreicht. Original-90-Modul-Factory unverändert. Kostenpflichtiger Track-04-E2E bleibt separates GO.
