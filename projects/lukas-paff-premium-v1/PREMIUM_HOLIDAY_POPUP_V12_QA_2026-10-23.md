# Lukas Paff | Premium-Ferienprogramm-Popup V12 – QA und Private Deploy

**Datum:** 23.10.2026  
**Status:** Privat deployed und mit Browser-Rendering überprüft; keine öffentliche Freigabe.

## Ziel
Den aus der bisherigen Live-Website bekannten Einstieg mit **X** und **„Jetzt mehr erfahren“** in eine zur Premium-Onepager-Marke passende Version übertragen. Kein alter Oktoberkurs als aktuell beworben.

## Umsetzung
- Native HTML-`<dialog>`-Komponente mit echtem Originalporträt von Lukas Paff, Creme-/Anthrazit-/Terrakotta-Design, responsiver Aufteilung und dezentem Erscheinen.
- Titel „Stärker durch die Ferien.“ mit Ferienprogramm-Informationen und Hinweis: Termine/Verfügbarkeit auf Anfrage. **Keine erfundenen künftigen Veranstaltungstermine, keine abgelaufenen Buchungsmöglichkeiten.**
- Klick auf X schließt, Escape schließt, Klick außerhalb des Dialogs schließt. Standard-Dialogfokus plus sichtbare Tastaturfokus-Ringe.
- CTA „Jetzt mehr erfahren“ schließt, navigiert zu `#schulangebote`, scrollt in den Ferienprogramm-Abschnitt und öffnet die bestehenden Detailinformationen.
- Popup nur auf der Startseiten-URL ohne Deep-Link beim ersten Aufruf der Sitzung; `sessionStorage` vermeidet aufdringliches erneutes Anzeigen nach Schließen.
- `prefers-reduced-motion` wird berücksichtigt; Originalmedien, Trainingsinhalte, Privatheit und ursprüngliche Hero-Seite unverändert.

## GitHub
- Repository: `dariolazzano3-ops/chatgpt-test`
- Branch: `factory/lukas-paff-premium-v1`
- Popup-Commit: `173dea57743c87d4a1b0bdd1b10887b33e1078dc`
- Originalporträt-Feinschliff: `a16fc8e1589ce6a6c0c6bead8a3c5aaa275a7c29`
- Website-Datei: `projects/lukas-paff-premium-v1/preview.html`

## Cloudflare Proof
- Private Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/
- Deployment-ID: `23ddec90-e3a7-4eb0-b642-c54bf2d13c90`
- Aktive Version: `939bb467-e8b3-4756-a7ae-82d852b744b3` mit 100% Traffic
- Cloudflare-Readback bestätigt Popup, Originalporträt, CTA, Session-Schließlogik, Video-Erhalt und `noindex`.
- Owner-only-Cloudflare-Access-Policy unverändert. Anonyme Requests auf / sowie Medien wurden mit HTTP 302 zum Login weitergeleitet.

## Browser QA
- **390 px mobile:** echtes Browser-Rendering der Dialog-Darstellung auf dem aktuellen Worker-HTML mit Originalporträt (QA öffnete das Dialogfenster manuell im Testdokument, da das HTML-Testdokument `about:blank` nutzt). Bildaufteilung, Close-X und CTA visuell geprüft.
- **320 px mobile:** DOM-/Interaktionstest. `scrollWidth=320`, Modalbreite 282 px, Modalhöhe 502 px bei 740 px Bildschirmhöhe, X schließt, CTA schließt, Deep-Link `#schulangebote` wird gesetzt und die Angebotsdetails öffnen.
- **1440 px desktop:** DOM-/Layouttest. Kein horizontaler Überlauf, Modalbreite 860 px, Modalhöhe 618 px bei 900 px Viewporthöhe, Bildbereich 380 × 607 px.
- Syntax- und Git-Diff-Prüfungen bestanden.
- Nicht geprüft: physisches iPhone Safari, 360/430/768/820/1024/1280/1920 px und vollständige WCAG-AA-/Lighthouse-Abnahme.

## Inhaltliche Grenze
Der alte Ferienkurs am **07./08.10.2026** ist vorbei. Auf der neuen Vorschau wird bewusst nur das Ferienprogramm allgemein beworben, bis Lukas Paff einen neuen bestätigten Kurs mit Datum, Ort und Verfügbarkeit freigibt.
