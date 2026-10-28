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
