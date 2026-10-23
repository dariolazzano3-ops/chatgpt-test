# Lukas Paff | Premium-Ferienkurse V13 · Private Preview QA

**Geprüfter Stand:** 23. Oktober 2026  
**Status:** Eigene Ferienkurs-Unterseite privat deployed, Source-/Routing-Tests bestanden. Kein öffentliches Deployment.

## Ausgangslage und Auftrag
Der V12-Popup-Button „Jetzt mehr erfahren“ sprang bisher zu `#schulangebote` auf dem Onepager und öffnete eine kompakte Angebotskarte. Gewünscht war stattdessen die Struktur der bisherigen eigenständigen Ferienkurs-Seite, jedoch im modernen Premium-Design.

## Umgesetzte Dateien
- `projects/lukas-paff-premium-v1/preview.html`: Popup-CTA zeigt jetzt auf `/ferienkurse/`, die alte Scroll-/Accordion-JavaScript-Logik wurde entfernt. Auch der Kursarchiv-Link führt zur Informationsseite.
- `projects/lukas-paff-premium-v1/ferienkurse.html`: neue eigenständige responsive HTML-Unterseite mit Premium-Header, zentraler Kurs-Headline, authentischem Originalporträt, Kursbeschreibung, Veranstaltungshinweisen, Terminstatus, Altersbereich und direkter E-Mail-Anfrage.
- Worker-Route `/ferienkurse/`, `/ferienkurse` und `/ferienkurse/index.html` in der bestehenden privaten Worker-Instanz ergänzt. Kein neuer Worker, keine DNS- oder Access-Änderung.

## Inhaltliche Governance
Der Herbstferienkurs vom 7. und 8. Oktober 2026 ist abgelaufen. Ohne bestätigte neue Angaben werden **keine Veranstaltungstermine, Öffnungszeiten, Kursplätze oder Preise behauptet**. Es heißt deshalb „Neue Termine auf Anfrage“ und „Saarland, genauer Ort wird bekanntgegeben“. Die Kursinformationen basieren auf den bereits verwendeten Projektinformationen; echte Verfügbarkeit nicht geprüft.

## Technischer Proof
- Repository: `dariolazzano3-ops/chatgpt-test`
- Branch: `factory/lukas-paff-premium-v1`
- Code-Commit: `4ccd3f7311ef14949f29b528e0164de2e68097a5`
- Preview-URL: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/ferienkurse/
- Cloudflare Deployment-ID: `d09b4f68-6f02-479f-94d2-ba0a6df0c36f`
- Aktive Version: `a835319d-a65d-4c88-80eb-3807a9e00698` (100 %)
- Read-back der aktiven Worker-Skripts bestätigt `HOLIDAY_HTML`, die neue Route, unveränderte Medien-Maps, `noindex`, Originalporträt und die neue Popup-Zieladresse.
- Curl-Anfragen ohne Login auf /, /ferienkurse/, /ferienkurse und /ferienkurse/index.html: HTTP 302 zur Cloudflare-Access-Anmeldung. Zugangsschutz bleibt aktiv.

## Visuelle und funktionale Qualitätssicherung
- Cloudflare Browser Rendering: echte Ansicht der neuen Seite bei iPhone-Breite **390 px** erstellt und überprüft, mit Überschrift, Status, Hauptinhalt und Header.
- Node-JavaScript-Syntaxprüfung der aktualisierten Homepage bestanden; Git Diff/Whitespace-Check bestanden.
- Quellen geprüft: Kursinfos, E-Mail-CTA, Rücknavigation zur Startseite, kein abgelaufener Termin als aktuell, drei Hauptsektionen, weiterhin sechs Trainingsillustrationen und bestehendes Video erhalten.
- Ein Cloudflare Content-Browser-Aufruf bei **320 px** gab HTTP 200 zurück. Die geplanten zusätzlichen Messungen bei 390/1440 px trafen jedoch auf API-Rate-Limit HTTP 429. Deswegen **keine vollständige Cross-Viewport- oder iPhone-Safari-Hardwareabnahme** behauptet.
- Vollständige Funktionsprüfung nach Cloudflare-Access-Login mit echtem iPhone sowie Performance/WCAG-AA-Audit stehen noch aus.

## Erwartetes Verhalten
Startseite: Popup erscheint einmal pro Sitzung. „Jetzt mehr erfahren“ navigiert direkt zu `/ferienkurse/`. Dort werden Kursinformationen und direkter Anfrageweg angezeigt. „Zur Startseite“ kehrt zu `/` zurück. Keine öffentlichen SEO- oder Marketing-Einstellungen geändert.
