# GELATO DONATELLO | PREMIUM LAUNCH READINESS V129

**Audit:** 16. Oktober 2026 · **Launch-Status: NO-GO (noch nicht freigeben)**
**Repository:** dariolazzano3-ops/chatgpt-test
**Projekt:** projects/gelato-donatello-premium-v6
**Arbeitsbranch:** factory/aurentara-gelato-donatello-working-v1
**Umgebung:** nur Cloudflare Access-geschützte Preview gelato-donatello-private-preview-v2, keine Live-Domain, keine DNS-Änderung.

## Überblick

**Technische private Vorschau nach erfolgreicher V129-Verifikation: bereit. Öffentlicher Launch und reale Interessenten: ausdrücklich NO-GO.**

V126 Events → V127 Eistorten → V128 Eisvitrine: alle drei Operator-Aufträge sind auf dem Arbeitsbranch linear zusammengeführt. V129 ist ein Qualitäts-, Performance- und Freigabe-Audit. Die Premium-Designs, 24 Eistortenbilder, 41 bestehende Eissorten, ursprünglichen Event- und Vitrinenmotive bleiben erhalten.

## Geprüfter Umfang und Beweis

1. **Versionsquelle:** GitHub HEAD, Cloudflare Deployment und 100%-Version mit Commit-Kommentar; private Cloudflare Access-Anwendung.
2. **Automatische Tests:** vollständige Node-Regressionen inklusive aller vorherigen Operator-Releases sowie V129-SEO-, Design-, Schutz- und Performance-Gates.
3. **Formulare:** Eistorten, Events und Eisvitrine vollständig im Chromium-Browser mit rein synthetischen Daten, jeweils 360, 390, 412 und 1440 Pixel, inklusive serverseitiger Testbestätigung (HTTP 200), abgewiesener Echtnamen vor dem POST, No-JS-Sperre und reduzierter Animation.
4. **Seitenprüfung:** alle acht Hauptseiten plus zwei Altadressen auf 390px iPhone und 1440px Desktop. 20/20 Aufrufe HTTP 200, gültige H1/Titel, keine JS-/Netzwerkfehler oder horizontalen Überläufe, mobiles Menü geöffnet und geschlossen, interne Navigationsziele.
5. **Bilder:** Originale unverändert, Eisvitrine 1254px AVIF, Eislabor 1536×864 JPEG, 24 Kreationen. Einige leere Bild-Src-Werte waren absichtlich inaktive Animations-Layer beziehungsweise die geschlossene Lightbox, nicht defekte Bilder.
6. **Performance:** Unterhalb der ersten Ansicht liegende drei Drinks-Motive auf Lazy Loading umgestellt; Eisbecher-Hero auf hohe Bildpriorität gesetzt; Logo-Intrinsic-Größe ergänzt. Kein Originalbild neu gerendert oder verlustbehaftet umgewandelt. Reduzierte Bewegung getestet.

### Bildnachweise

- [Acht Seiten auf iPhone](./evidence/iphone-pages-v129.webp)
- [Acht Seiten auf Desktop](./evidence/desktop-pages-v129.webp)
- [Drei erfolgreiche synthetische Bestätigungen](./evidence/forms-success-v129.webp)

Die Screenshots zeigen reale Browsertest-Renderings und keine künstlich erzeugten Website-Mockups. Keine echten Kundendaten enthalten.

**Grenze:** Die E2E-Tests liefen lokal auf Basis desselben Worker-Quellcodes, nicht über eine in Cloudflare Access angemeldete Browser-Sitzung. Auf der echten privaten Preview sind der erfolgreiche Worker-Deploy und die Access-Weiterleitung HTTP 302 separat überprüft. Dies ist keine authentifizierte Remote-E2E-Abnahme.

## SEO-Audit

- Acht Hauptseiten haben eigene Seitentitel, Meta-Descriptions und H1.
- Private Robots-Metadaten: noindex,nofollow,noarchive. Header X-Robots-Tag und robots.txt mit Disallow: / bleiben für die private Preview absichtlich aktiv. **Auf keinen Fall unverändert als öffentliches SEO-Setup verwenden.**
- Altadressen sortiment und eistorten-eisbomben leiten browserseitig auf die aktuellen Seiten. HTTP-301, kanonische Produktions-URLs und Sitemap sind vor Go-Live gesondert zu planen.
- Finaler SEO-Go: Domainvariante, absolute Canonicals, strukturierte LocalBusiness-Daten (nur geprüfte Daten), Sitemap, produktiver Robots-Status und Search Console nach Freigabe ergänzen.
- CSS-Hauptdatei noch etwa 209 KiB unkomprimiert. Brotli/Lighthouse/Core Web Vitals müssen später unter echter Ziel-Domain und Netzwerkprofilen gemessen werden. Die lokalen Testlaufzeiten sind kein Lighthouse-Nachweis.

## Blocker / offene Entscheidungen

### P0: Rechtliche Pflichtinhalte fehlen in der neuen Preview

Die neue Premiumseite besitzt noch keine integrierten und bestätigten Impressum- und Datenschutzseiten und keine zugehörigen Footer-Links.

Das bisherige öffentliche System hat unter https://gelato-donatello.de/impressum/ ein Impressum und unter https://gelato-donatello.de/datenschutzerklaerung/ eine Datenschutzerklärung. Diese Dokumente sind **nicht** automatisch für die neue Website freigegeben. In der alten Datenschutzerklärung stehen offenbar veraltete Textbausteine, unter anderem zum früheren EU-US Privacy Shield. Die tatsächliche verantwortliche Stelle, Firmenangaben, Kontaktwege und alle neuen Provider-/Formular-Datenflüsse müssen fachlich geprüft und autorisiert werden.

**Freigabe nötig:** aktualisiertes Impressum und abgestimmte DSGVO-Datenschutzinformation samt Speicherzweck, Rechtsgrundlage, Empfängern/AVV, Cloudflare-Konfiguration, Cookie-/Log-Prozessen und Löschkonzept.

### P0: Reale Kundenanfragen bleiben technisch gesperrt

Aktuell ausschließlich definierte Testdaten. Die APIs bestätigen Validierung, speichern und versenden **keine** Daten. Weder verbindliche Buchung noch Zahlung. Echte Datenspeicherung, Rollen/Zugriff, Löschung, transaktionale E-Mail, idempotente Zustellung, Anti-Spam/Rate-Limiting und Vorfallbehandlung sind vor Aktivierung nötig. Kein leiser Fallback auf E-Mail oder CRM.

### P1: Produktversprechen prüfen

Eistorten: Preise und Größen, 24 Kreationen, verfügbare Sorten, Allergene, Mindestvorlauf und Premiumaufschläge aktuell bestätigen. Eisvitrine: Mietkonditionen, Lieferumfang, Kühlung, Transport, Reinigung, Eigenservice, Lieferung/Abholung und Kapazitäten bestätigen. Events: Winter-Event ist vorläufig eine **Idee ohne bestätigte Termine**, keine verbindliche Reservierung. Nichts davon ohne Betreiber-GO zusagen.

### P1: Technische und manuelle Endabnahme

Mit einer autorisierten Cloudflare-Access-Browsersitzung alle Routen erneut smoke-testen. Auf echtem iPhone/Safari, Android, Desktop Firefox, Tastatur und Screenreader prüfen. Core Web Vitals und Performance-Limits nach Übergang in realistische Hosting-/Caching-Konfiguration messen. Rollback und Preview-/Produktions-Trennung verifizieren.

### P2: Sichtbare Optimierung nach Freigabe

CSS-Größe reduzieren, wenn eine gemessene Ladezeitverbesserung den Umbau rechtfertigt. Externe Karten-/Analytics-Einbindungen und etwaige Cookie-Anforderungen gesondert prüfen. Bildlizenzen und finalen Markenauftritt bestätigen.

## Konkrete GO-Reihenfolge

1. **GO RECHT:** Rechtsträger/Firmendaten/Verantwortliche bestätigen; rechtlich überarbeitetes Impressum und Datenschutzerklärung genehmigen, in die neue Website integrieren und korrekt verlinken.
2. **GO PRODUKT:** Mietpreise, Lieferumfang, Eistortenpreise, Verfügbarkeit, Allergene und Events abschließend freigeben.
3. **GO ECHTDATEN-TECHNIK:** Minimale datenschutzkonforme Speicherung, sichere Benachrichtigung, Löschfristen, Anti-Spam und eindeutige Bedien-/Fehlerprozesse implementieren und privat mit synthetischen Daten testen.
4. **GO ABNAHME:** Angemeldeter Cloudflare-Access-Test, mobile Safari, Screenreader, Performance, Zustellung, Löschung, Recovery und Rollback.
5. **GO PRODUKTION separat:** erst nach ausdrücklicher finaler Freigabe die Produktiv-Konfiguration, DNS, öffentliche Formulare, Canonical/Robots/Sitemap und Indexierung ändern.

**Keine Produktion, kein DNS-Switch, keine echten Kundendaten und kein kostenpflichtiger neuer Dienst in V129.**

### Abnahmekriterien für den nächsten Operator

Keine Erfolgsaussage ohne echte Commit-/Test-/Cloudflare-Nachweise. Private Demo-Receipts sind keine Kundenzustellung. Nicht geprüfte Rechtstexte nicht automatisch kopieren. Originalbilder und Premium-Designs unverändert lassen. Diese Readiness-Version ist kein GO zum öffentlichen Launch.
