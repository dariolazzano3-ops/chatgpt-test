# LUNARA | Zentrale Projektsteuerung V1
Stand: 28.10.2026 | Quelle: bestehende GitHub-Nachweise und Make-/Cloudflare-Prüfungen | Status: Planung und private Sandbox, **kein Live-Shop**.

## 1. Produktmission
Lunara verkauft Eltern eine liebevoll personalisierte, **ruhige Einschlafgeschichte für Kinder im ursprünglich vorgesehenen Alter 2–7 Jahre**. Das erste Produkt ist ein hochwertig gestaltetes **digitales PDF** mit originaler Lunara-Geschichtenproduktion und originaler Mia-Designsprache. Ein optionaler webbasierter Lesezugang ist eine UX-Funktion, nicht automatisch ein zusätzliches verkaufsfähiges Produkt. Preis 12,90 € ist bislang **Testkonfiguration**, keine freigegebene Preisstrategie.

**Ein Kernangebot, eine Zielgruppe, ein primärer Kaufweg.** Audio, Abo, Hardcover, native iOS-/Android-App und Community sind später separat zu bewerten; nicht in MVP hineinziehen.

## 2. Getrennte Verantwortungsbereiche
| Track | Arbeitsbereich | Scope | Stand |
|---|---|---|---|
| 01 | [Produkt & Marke](01-PRODUKT-MARKE.md) | Angebot, Originalität, Positionierung, Musterprodukt | Teilweise definiert |
| 02 | [Website & Conversion](02-WEBSITE-SHOP.md) | Startseite, Beispielgeschichte, Produktseite, Checkout-UX | Private Vorschau; Verkauf gesperrt |
| 03 | [Web-App / Reader](03-WEBAPP-READER.md) | Story Builder, Personalisierung, iPad-Leseansicht | Private Funktionsprobe |
| 04 | [Geschichten-Factory](04-ORIGINAL-STORY-FACTORY.md) | Original-Prompts, QA, Reparatur, Make-Orchestrierung | Produktionskern getestet; Fehlerpfad offen |
| 05 | [Premium-PDF & Medien](05-PREMIUM-PDF.md) | Original-Mia-Layout, Renderer, Private R2 | Offline qualitätsgeprüft; Integration offen |
| 06 | [Zahlung & Bestellung](06-COMMERCE-PAYMENTS.md) | Stripe, Webhooks, D1, Paid-Gate, Duplikatschutz | **Blockiert: Stripe→D1** |
| 07 | [Auslieferung & Kundenservice](07-DELIVERY-SUPPORT.md) | gesicherter Download, E-Mail, Reklamation, Erstattung | Offen |
| 08 | [Marketing & Wachstum](08-MARKETING-GROWTH.md) | Landing-Traffic, Content, Creator, Paid-Tests, Retargeting | Planung; keine Live-Kampagne |
| 09 | [Analytics & Wirtschaftlichkeit](09-ANALYTICS-UNIT-ECONOMICS.md) | Funnel, Messung, Marge, CAC, Conversion | Anforderungen offen |
| 10 | [Recht, Datenschutz & Betrieb](10-LEGAL-SECURITY-OPERATIONS.md) | Impressum, GDPR, Einwilligung, Sicherheit, Aufbewahrung | Launch-Blocker |
| 11 | [Launch & Abnahme](11-LAUNCH-GATES.md) | E2E-Tests, Soft Launch, Freigabeentscheidung | Nicht erreicht |

## 3. Trennung der Oberflächen
**Website** = verkauft, erklärt, schafft Vertrauen, zeigt Beispiel/CTA, rechtliche Inhalte. **Web-App** = vierstufiger Story-Builder + iPad-Reader im Browser. **Native App** = **nicht in V1**, erst bei konkretem Kunden-/ROI-Nachweis. **System** = Make/Cloudflare/Stripe/PDF/D1/R2, getrennte Worker und Zugriffsrechte. **Marketing** = Reichweite und Kampagnen; nie an den Produktionskern gekoppelt, ohne definierte Schnittstellen. **Betrieb** = Support, Recht, Datenschutz, Kosten, Sicherheit, Analytics.

## 4. Technischer Ist-Zustand, keine Erfindungen
- Original Make-Factory **5464576** mit 90 Modulen ist Referenz und bleibt unverändert/inaktiv; hat ersten QA- und Reparatur-/zweiten QA-Pfad.
- Make V2 **8209196** mit 29 Modulen hat erfolgreich synthetisch neue Geschichte → QA → Google-Docs-PDF → privates Cloudflare R2 getestet. Fünf Kern-Promptkonfigurationen sind identisch mit der originalen Factory. Die zweite QA-Route fehlt; Szenario inaktiv.
- Cloudflare-Access-geschützter Story Builder mit vier Schritten und iPad-Leseansicht lädt das **Originalbeispiel Mia**. Er erzeugt beim Eingeben eines Namens noch keine neue Geschichte. Checkout deaktiviert.
- Premium-Renderer mit originalem Mia-Hintergrund ist **lokal** mit Make-Adapter geprüft (8/8 Tests, neunseitige Mia-Ausgabe). Noch nicht in der automatischen Make→R2-Strecke.
- Private EU-D1-/R2-Sandbox, Claim-/Import-Duplikatprüfungen bestanden; kein öffentlicher PDF-Download.
- Stripe-Sandbox-Zahlung über 12,90 € ist bezahlt; zugehörige D1-Bestellung blieb `pending_payment`. Webhook-Zustellung ungeklärt. Kein Live-Verkauf.
- Neuere `story_id=latest`-Reader-Änderung liegt im GitHub-Branch, ist **nicht als deployed abgenommen**. Nicht vom Code-Commit auf den Live-Zustand schließen.
- Es gibt bisher keinen komplett nachgewiesenen Kauf→Original-Story→Premium-PDF→Kundenzustellung-Lauf.

## 5. Reihenfolge der Arbeit (keine isolierten Schönheitsrunden)
**A | Produktklarheit & sichere Pipeline:** 01 Angebot fixieren; 06 Stripe-Testzustellung und D1-Paid-Gate beweisen; 04 Original QA-Fail→Reparatur→QA2 anbinden; 05 Renderer automatisiert sicher bereitstellen; 07 private Zustellung nachweisen.
**B | Verkaufserlebnis:** 02 klare Landingpage, Vertrauensbeweise, rechtliche Links, kaufstarker aber ehrlicher CTA; 03 mobile Personalisierung & richtige Test-/Live-Trennung; 09 datensparsames Tracking.
**C | Nachfrage:** 08 Beispielgeschichte, organische Kreativtests und Content vorbereiten; erst **nach E2E-Freigabe** Traffic auf bezahlten Checkout bringen.
**D | Freigabe:** 10 Recht/Datenschutz/Retention, 11 Testbestellung und manuelles Go. Keine weiteren Produktlinien vor dem ersten verlässlich erfüllten Auftrag.

## 6. Regeln für jeden ausführenden Chat / Operator
1. Zuerst diesen Index und den **einen** angeforderten Track lesen; keine unnötige Vollprüfung aller Lunara-Teile. Reuse-First: vorhandene Komponenten prüfen und anpassen.
2. Ein Ticket, ein Track, ein nachweisbares Ergebnis. Nicht gleichzeitig Website, Marketing, Factory oder andere Projekte verändern, außer eine dokumentierte Schnittstelle verlangt es.
3. Jede Aufgabe hat: **Ziel, Scope, Voraussetzungen, Akzeptanztests, Risiken, Beweis**. Ergebnis: Commit, Tests, betroffene Systeme, Preview-Link und Rollback. Kein „fertig“ ohne Nachweis.
4. Zustände: `DONE-VERIFIED`, `PARTIAL`, `BLOCKED`, `NOT-STARTED`, `DEFERRED`. Keine frei erfundenen Gesamtprozente.
5. Keine produktive Veröffentlichung, DNS-Änderung, echte Zahlung, kostenpflichtige API-Ausführung, echte E-Mail, echte Kindesdaten oder Live-Marketingausgabe ohne entsprechende explizite Freigabe.
6. Alle Tests mit synthetischen Daten. Kein Kindesname / Storytext im Analytics-Tracking, keine Kundendaten in GitHub.
7. Blockierte Sicherheits- oder Connector-Aktion dokumentieren, nicht umgehen. Keine zweite Technik nur als Ausweichroute.
8. **Single source of truth:** dieser Index und die Track-Dateien. Bestehende Auditberichte sind Belege, nicht konkurrierende Roadmaps.
9. Jeder Track dokumentiert bei Änderungen zuletzt verifizierten Stand; Schnittstellenverträge werden vor Codeänderungen mit den abhängigen Tracks abgestimmt.
10. Die ursprüngliche 90-Modul-Factory und Designreferenz werden nicht überschrieben.

## 7. Nächster Fokus
**Track 06 → 04 → 05 → 07**, während **01/02/08** parallel ohne Produktionsfreigabe vorbereitet werden können. Größter Blocker ist derzeit nicht das iPad-Design, sondern der vollständige, sichere Kauf-bis-Auslieferung-Ablauf.

## 8. Abnahmepunkte
Technische Readiness: eine synthetische, signierte Stripe-Testzahlung → korrekter D1-Zahlungsstatus → genau eine originalgenerierte/QA-geprüfte Geschichte → Premium-PDF im privaten R2 → berechtigte Testzustellung → Wiederholungs- und Negativtests bestehen. Verkaufs-Readiness: Angebot, Preis, Beispiel, Mobile-Funnel, Support, Rechtsseiten und Tracking geprüft. Erst **beides** erlaubt eine gesonderte Live-Freigabe.

## 9. Referenz-Nachweise
- `../AUTONOMOUS_LOOP_CHECKPOINT_2026-10-28.md`
- `../ORIGINAL_STORY_IPAD_READER_ACCEPTANCE_2026-10-27.md`
- `../PREMIUM_LAYOUT_V2_ACCEPTANCE_2026-10-27.md`
- `../MAKE_STORY_IMPORT_IDEMPOTENCY_CHECK_2026-10-28.md`
- `../staging-schema.sql`

## 10. Verbindliches Program-Backlog und Dependency-Steuerung (28.10.2026)

Dieser Index ist die **einzige zentrale Management-Übersicht**. Track-Dateien bleiben die fachlichen Spezifikationen. Audits belegen einzelne Teilergebnisse, sind keine konkurrierenden Roadmaps. Jeder offene Arbeitspaket-Eintrag hat genau einen Owner. Die Zuordnung erlaubt keine fachfremden Änderungen durch den Program-Operator. Ein Statuswechsel erfordert datierten Test, Commit, Sicherheitsbeleg und Rückfallweg.

| Ticket | P | Owner-Track / Quelle | Scope | Status | Blocker / Voraussetzungen | Konkretes Abnahmekriterium | Nächster Übergabeschritt |
|---|---|---|---|---|---|---|---|
| L06-01 | P0 | [Track 06](06-COMMERCE-PAYMENTS.md) | Stripe-Testwebhook: Delivery Attempts, Zeit, HTTP und Ursache prüfen | BLOCKED | checkout.session.completed pending_webhooks=1; HTTP-Details fehlen | Event, Endpoint, Signature und HTTP-Ergebnis verifiziert | 06 recherchiert Delivery-Log; keine Secret-Ursache raten |
| L06-02 | P0 | [Track 06](06-COMMERCE-PAYMENTS.md) | Signiertes Testevent führt D1 einmalig nach paid | BLOCKED | L06-01; echter Zustellnachweis | D1 paid 1x; ungültige Signatur/Betrag/Order/Replay führen zu 0 neuen Übergängen | 06 übergibt D1-Transition und Negativtests an 11/04 |
| L06-03 | P0 | [Track 06](06-COMMERCE-PAYMENTS.md) | Paid-Claim vor KI und einmaliger Make-Dispatch | BLOCKED | L06-02 und abgestimmter 04-Input | Doppel-/Parallelevents bewirken maximal einen Make-Start | 06 definiert Dispatch-Vertrag; 04 allein ändert Make |
| L04-01 | P0 | [Track 04](04-ORIGINAL-STORY-FACTORY.md) | Original-Prompt- und QA-Vertrag mit Positiv-/Negativsamples | PARTIAL | Fünf Stufen promptgleich, QA2-Schema nicht vollständig abgenommen | Felder und Fail-closed-Regeln für lunara.story.qa.v1 dokumentiert | 04 gibt Vertrag an 05/07 |
| L04-02 | P0 | [Track 04](04-ORIGINAL-STORY-FACTORY.md) | Original-QA1-Fail, Reparatur, QA2 in Make V2 | BLOCKED | Fehlender autorisierter Transfer-/Editierweg; Modelltest kostet ggf. Geld | Erzwungener Fehler wird repariert und per QA2 beurteilt, negatives Endergebnis stoppt | 04 alleiniger Make-8209196-Writer; Budgetgate vor kostenpflichtigem Test |
| L04-03 | P0 | [Track 04](04-ORIGINAL-STORY-FACTORY.md) | Maximale Aufrufzahl, Fail-closed und sicherer einmaliger Post-QA-Import | BLOCKED | L04-02 und L06-03; Security-Blocker nicht umgehen | D1 first insert 1, Replay 0, Netzwerk-E2E PASS, keine Ausgabe bei QA-Fail | 04 verifiziert Import über freigegebenen legitimen Weg |
| L05-01 | P0 | [Track 05](05-PREMIUM-PDF.md) | Originale PDF-Medien sicher privat bereitstellen | BLOCKED | Rechteprüfung und R2-Asset-Transfer offen | Nur private Originalassets, kein öffentlicher Medienlink | 05 klärt mit 10 Rechte und 07 Storage-Vertrag |
| L05-02 | P0 | [Track 05](05-PREMIUM-PDF.md) | Vorhandenen Premium-Renderer ohne neuen Server integrieren | BLOCKED | L05-01 und sicherer Aufrufweg fehlen | Neu erzeugte QA-bestandene Geschichte automatisiert lesbar ohne Textverlust gerendert | 05 übergibt Renderer-API an 04 |
| L05-03 | P0 | [Track 05](05-PREMIUM-PDF.md) | Neu generierte Geschichte als visuell geprüftes Premium-PDF in R2 | BLOCKED | L04-03, L05-02, 07 Storage-Interface | PDF-Bytes/Seiten/Metadaten/R2 privat und visueller Vergleich PASS | 05 übergibt Artefaktbeweis an 07/11 |
| L07-01 | P0 | [Track 07](07-DELIVERY-SUPPORT.md) | Berechtigter Token-Download und R2-Entitlement | BLOCKED | L05-03, L06-02, 10 Retention | Fremdzugriff, Replay, Timeout abgewiesen; Testkäufer zugelassen | 07 stimmt Reader-Vertrag mit 03 ab |
| L07-02 | P0 | [Track 07](07-DELIVERY-SUPPORT.md) | Synthetische Einzelzustellung über genehmigtes Testpostfach | BLOCKED | L07-01, E-Mail-Dienst und Empfängerfreigabe | Ein gültiger sicherer Link, kein doppelter Versand, Ablauf geprüft | 07 liefert Mail-/Auslieferungs-Test an 11 |
| L03-01 | P0 | [Track 03](03-WEBAPP-READER.md) | Original-Mia-Demo gegen unberechtigte latest-/Kundenstory isolieren | PARTIAL | story_id=latest nur committed, nicht als deployed verifiziert | Demo und berechtigter Kundenabruf strikt getrennt; Zugriffstests PASS | 03 sperrt ungeprüften latest-Deploy und wartet auf 07-Entitlement |
| L10-01 | P0 | [Track 10](10-LEGAL-SECURITY-OPERATIONS.md) | D1-/R2-/Token-/Log-Retention und echte Löschung | BLOCKED | 30-Tage-R2-Lifecycle ist keine D1-Löschung | Expiry plus echte Löschung und synthetischer Restore/Retention-Test | 10 gibt Löschvertrag an 06/07/11 |
| L11-01 | P0 | [Track 11](11-LAUNCH-GATES.md) | G1 vollständige synthetische technische Abnahme | BLOCKED | 06,04,05,07,03,10 Einzelbelege fehlen | Signierter Kauf, einmalige Originalstory, QA2, Premium-PDF, berechtigter Zugriff, Retry/Löschung PASS | 11 sammelt unabhängige Belege; keine Teiltests als Gesamt-PASS |
| L01-01 | P1 | [Track 01](01-PRODUKT-MARKE.md) | Produktbriefing mit Preis, Umfang, Lieferung und Rechten | PARTIAL | 12,90 € nur Testwert; 05/09/10 noch offen | Ein freigegebenes überprüfbares Produktangebot | 01 übergibt an 02/08/11 |
| L01-02 | P1 | [Track 01](01-PRODUKT-MARKE.md) | Marken-/Demo-Freigabe, Tokens, Design- und Medienrechte | PARTIAL | Rechte und echte Vertrauenselemente offen | Mia als Demo gekennzeichnet, keine erfundenen Reviews | 01 gibt Assets und Claims an 02/08 |
| L02-01 | P1 | [Track 02](02-WEBSITE-SHOP.md) | Premium-Mobile-Landingpage, Demo und primäre CTA | PARTIAL | 01 Briefing/10 Pflichtangaben, gemeinsamer Preview-Worker mit 03 | Testperson versteht Angebot und Weg; mobile UX/Performance PASS | 02 setzt nur eigene Frontend-Dateien nach Worker-Lock um |
| L02-02 | P1 | [Track 02](02-WEBSITE-SHOP.md) | Ehrliche Checkout- und Bestätigungs-UX | BLOCKED | L06-02 und L07-01, Checkout aus | Keine Erfolgsmeldung ohne Paid-Nachweis, Abbruch/Retry getestet | 02 holt Interfaces von 06/07 |
| L03-02 | P1 | [Track 03](03-WEBAPP-READER.md) | Datensparsamer 4-Schritte-Builder mit Draft-Vertrag | PARTIAL | 01/10/06 Feld- und Consent-Abnahme | lunara.story.draft.v1, mobile Fehlertexte, keine Kinderinfos in URLs | 03 übergibt Vertrag an 04/06 |
| L03-03 | P1 | [Track 03](03-WEBAPP-READER.md) | Reader-Zustände und autorisierter Testkäuferzugriff | PARTIAL | L03-01, L07-01 | Zoom, Scroll, Schließen, leer, lädt, Fehler, Zugriffsprüfung PASS | 03 liefert Abnahme an 02/11 |
| L07-03 | P1 | [Track 07](07-DELIVERY-SUPPORT.md) | Support, Refund, Korrektur, Löschung und manuelles Resend | NOT-STARTED | 07 Liefervertrag und 10 Rechtsregeln fehlen | Verifizierter Support- und Fehlerleitfaden | 07 liefert Support-Prozess an 11 |
| L09-01 | P1 | [Track 09](09-ANALYTICS-UNIT-ECONOMICS.md) | Privacy-first Funnel-Events mit Serverstatus als Wahrheit | NOT-STARTED | 10 Privacy-Freigabe und 06/07 Datenquellen | Keine Kinddaten in Analytics, paid_verified nur serverseitig | 09 gibt Eventvertrag an 02/03/06/07 |
| L09-02 | P1 | [Track 09](09-ANALYTICS-UNIT-ECONOMICS.md) | Story-Stückkosten, Marge, Fehler- und Blocker-Dashboard | NOT-STARTED | L04-02, 06/07 Status und 10 Analytics-Regeln | Reale synthetische Kosten inkl. QA2, blocked orders sichtbar | 09 informiert 01/11 vor Preisentscheidung |
| L10-02 | P1 | [Track 10](10-LEGAL-SECURITY-OPERATIONS.md) | Juristische Pflichttexte, AV-Verträge, Security und Live-Gates | BLOCKED | Betreiberfreigabe und finale Datenflüsse fehlen | Verantwortliche Abnahme von Recht, Datenschutz, Incident, Rollback | 10 gibt Pflichttexte an 02, G2-Nachweis an 11 |
| L11-02 | P1 | [Track 11](11-LAUNCH-GATES.md) | G2 separate Verkaufs-, Legal- und Go-to-Market-Abnahme | BLOCKED | 01,02,03,07,08,09,10 Abnahmen offen | Preis/Angebot, mobile Demo, Support, Recht, Tracking, Marketing geprüft | 11 bewertet G2 unabhängig von G1 |
| L08-01 | P2 | [Track 08](08-MARKETING-GROWTH.md) | Drei Content-Winkel, zehn Ideen und erlaubter Mia-Demo-Clip | NOT-STARTED | 01/02 Marken- und Medienfreigabe | Inhalt, CTA, Rechte und echte Demo geprüft | 08 bereitet nur privat vor, keine Veröffentlichung |
| L08-02 | P2 | [Track 08](08-MARKETING-GROWTH.md) | Organischen Kanaltest ohne Live-Checkout vorbereiten | NOT-STARTED | L08-01, 09 Tracking, 10 rechtliche Freigabe | Ein Kanalplan und messbare Builder-Start-Ziele | 08 verlangt GO vor Veröffentlichung |
| L11-03 | P2 | [Track 11](11-LAUNCH-GATES.md) | G3 echter Kleinpilot | DEFERRED | Manuelle G1- und G2-Abnahme plus separates G3-GO | Nach Freigabe wenige echte Bestellungen und Support gemessen | 11 darf G3 nicht automatisch aktivieren |
| L08-03 | P3 | [Track 08](08-MARKETING-GROWTH.md) | Bezahlte Kampagnen und CAC-Skalierung | DEFERRED | G3, Kosten/Marge und Budgetfreigabe fehlen | CAC/Deckungsbeitrag, Stop-Loss und ausdrückliches Budget-GO | 08 nicht starten |
| L11-04 | P3 | [Track 11](11-LAUNCH-GATES.md) | G4 Audio, Abo, Hardcover, PWA und native App | DEFERRED | Produkt-MVP, Nachfrage und ROI unbelegt | Separate wirtschaftliche Entscheidung je Variante | 11 erst nach G3 bewerten |

### 10.1 Die drei größten messbaren Hebel

1. **P0 06 Stripe Test → D1 paid:** Erst authentische Stripe-Zustellversuche und HTTP-Ergebnis ermitteln; dann genau einen signierten bezahlten Übergang nach D1 plus negative und Replay-Tests nachweisen. Checkout bleibt AUS.
2. **P0 04 Original QA-Fail → Reparatur → QA2:** Die Originalversion als Vorlage unverändert lassen. 29-Modul-Sandbox nur über den freigegebenen Make-Writer ändern; begrenzte KI-Aufrufe und kontrollierte Negativtests, vor kostenpflichtigen Tests separate Freigabe.
3. **P0 05 + 07 Premium-PDF → sichere Zustellung:** Vorhandenen Renderer integrieren, neue QA-bestandene Geschichte privat in R2 prüfen, dann nur per befristetem Entitlement zustellen. Keine öffentliche PDF-URL.

### 10.2 Sperren gegen doppelte oder widersprüchliche Implementierung

| Geteiltes System oder Artefakt | Exklusiver Writer-Track | Pflichtgrenze |
|---|---|---|
| Make Original 5464576 | [Track 04](04-ORIGINAL-STORY-FACTORY.md) | Lesereferenz, nicht verändern |
| Make V2 8209196 | [Track 04](04-ORIGINAL-STORY-FACTORY.md) | Alleiniger Szenario-Writer; 05/06/07 nur Input-/Output-Tickets |
| Stripe-Sandbox Webhook und Test-Worker | [Track 06](06-COMMERCE-PAYMENTS.md) | Keine Live-Keys oder Checkout-Aktivierung |
| D1 Payment/Order und Paid-Claim | [Track 06](06-COMMERCE-PAYMENTS.md) | Schemaänderung vorab mit 04/07/10 abstimmen |
| QA-Import-Worker und Story-QA | [Track 04](04-ORIGINAL-STORY-FACTORY.md) | Token-/Story-ID-Vertrag mit 06/07 vereinbaren |
| Premium-Renderer und Originalassets | [Track 05](05-PREMIUM-PDF.md) | Eigener Renderer; Make-Änderungen ausschließlich durch 04 |
| Privater PDF-Download, R2-Entitlement und Mail | [Track 07](07-DELIVERY-SUPPORT.md) | 05 liefert PDF; 06 Payment; 03 Reader |
| Private Preview-Worker und Reader | [Track 03](03-WEBAPP-READER.md) | 02 und 03 niemals parallel auf derselben Worker-Datei |
| Landing-Copy und UX-Dateien | [Track 02](02-WEBSITE-SHOP.md) | Eigener Frontend-Scope; Shared-Worker nur nach Lock-Übergabe durch 03 |
| Analytics-Eventvertrag | [Track 09](09-ANALYTICS-UNIT-ECONOMICS.md) | 10 bestätigt datensparsame Feldliste |
| Recht, Sicherheitsgates und Löschregeln | [Track 10](10-LEGAL-SECURITY-OPERATIONS.md) | Policy-Owner; technische Umsetzungen an Fach-Writer delegieren |
| G1/G2/G3-Abnahmestatus | [Track 11](11-LAUNCH-GATES.md) | Nur unabhängige Abnahme, keine technische Live-Freigabe |

Insbesondere: Nie parallele Patches von 04/05/06/07 an Make 8209196. Nie parallele Änderungen von 02/03 an der privaten Preview-Worker-Datei. Keine konkurrierenden D1-Schemamigrationen von 04/06/07. Schnittstellenwunsch zuerst als konkret abnahmefähige Übergabe an den Writer, dann fachlicher Test und dokumentierter Commit.

### 10.3 Unabhängige Readiness-Spuren und manuelle Gates

| Gate | Status | Abnahmepflicht | Owner |
|---|---|---|---|
| G0 private Basis | PARTIAL | Kernkomponenten getestet, Integrationsdepl​oyments teilweise offen | 11 |
| **G1 technische End-to-End-Bereitschaft** | BLOCKED | Ein signierter synthetischer Stripe-Testkauf bis D1 paid, genau eine Originalgeschichte mit QA-Reparatur, automatischem Premium-R2-PDF, berechtigtem Download, Zustellung, Negativ-, Replay- und Löschtests | 11 |
| **G2 Sales-, Legal- und Go-to-Market-Bereitschaft** | BLOCKED | Angebot und Preis 01; Website 02; Reader 03; Support 07; Content 08; Datenschutz-Tracking/Kosten 09; Recht 10 | 11 |
| G3 realer kleiner Pilot | DEFERRED | **Manuelle** Abnahme von G1 und G2 sowie zusätzlich ausdrückliches eigenständiges **GO für G3** | 11 |
| G4 Wachstum und Zusatzprodukte | DEFERRED | Erst nach G3: Kundenbelege, CAC/Deckungsbeitrag, separater Plan und Budgetfreigabe | 11 |

### 10.4 Freshness und Beweisgrenzen

- **Live-Read Stripe Testkonto, 28.10.2026:** eine abgeschlossene Test-Checkout-Session mit payment_status=paid, 1290 Cent EUR; checkout.session.completed hat weiter pending_webhooks=1; genau ein aktiver Test-Webhook-Endpoint mit passendem Eventtyp. Die ausgelesenen Eventdaten enthielten keinen HTTP-Zustellversuchsverlauf. **Der D1-Paid-Zustand wurde in dieser Iteration nicht neu unabhängig gelesen**; letzter dokumentierter Zustand pending_payment. Keine unbelegte Signaturursache.
- **Live-Read Make, 28.10.2026:** 5464576 inactive mit 90 Modulen und zwei orphan warnings; 8209196 inactive mit 29 Modulen ohne Modulwarnungen. Letzte gelistete V2-Runs am 27.10.: zuerst success (27 Operations), danach error Conflict (2 Operations). Conflict beweist keine vollständige Fehlerpfadabnahme.
- **GitHub vor diesem Program-Commit:** Branch-HEAD e90b3b2b500bea02edc2c6f097088e4709c17424; Index und alle 11 Track-Dateien gelesen. Belege: [Checkpoint](../AUTONOMOUS_LOOP_CHECKPOINT_2026-10-28.md), [Import-Test](../MAKE_STORY_IMPORT_IDEMPOTENCY_CHECK_2026-10-28.md), [Reader-Test](../ORIGINAL_STORY_IPAD_READER_ACCEPTANCE_2026-10-27.md), [PDF-Test](../PREMIUM_LAYOUT_V2_ACCEPTANCE_2026-10-27.md). Die story_id=latest-Änderung wurde nicht frisch als deployed bestätigt und ist kein Nachweis kundeneigener Zugriffssicherung.
- **Iteration 1 Management-Scope:** nur 00-START-HIER.md aktualisiert; keine Änderungen an Stripe, Make, Cloudflare, D1, R2, kein KI-Aufruf, keine Mail, kein Produktionsdeploy. Gates G1/G2 bleiben BLOCKED. Erste konkrete Übergabe an Track 06: Ticket L06-01.
