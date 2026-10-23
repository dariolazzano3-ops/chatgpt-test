# Lukas Paff | Ferienkurs-Originalanalyse und Premium-Übertragung V14

**Stand:** 23.10.2026 · **Status:** Private Preview deployed, technische Quellprüfung und mobile Renderkontrolle bestanden.

## Originalseite
Analysegegenstand: https://www.lukaspaffantimobbing.com/ferienkurs (Original-HTML am 23. Oktober 2026 erfolgreich mit HTTP 200 abgerufen und auf sichtbare Inhaltsbausteine analysiert).

Originale Struktur und Inhalte:
- „Aktueller Ferienkurs: Handlungsfähig, selbstbewusst und stark ins restliche Schuljahr“.
- Veranstaltungsort Saarbrücken; Datum **07. & 08.10.2026**, jeweils **10:00–12:00 Uhr**.
- Begrüßung „Schön, dass du da bist! Schön, dass du dein Kind stärken möchtest“.
- Basismodul: **Handlungsfähigkeit, Achtsamkeit, Körpersprache, Empathie** mit je eigener Erklärung.
- Zielgruppe des damaligen Kurses: **Kinder von 7–11 Jahren**.
- Genaue Lage des damaligen Kursorts: zentrale Kursräume in **66121 Saarbrücken**, Adresse nach Anmeldung.
- **50 € pro Kind**, inklusive Kursmaterialien und Snacks; bei Anmeldung von zwei Kindern **20 € Nachlass auf den Gesamtpreis**.
- Historischer Anmelde-CTA, direkter Telefonkontakt, fachlicher Hinweis.

## Unterschiede zu V13
Die V13 enthielt nur allgemein gehaltene Ferienprogramm-Texte. Die originale Basismodul-Struktur, Altersgruppe des konkreten Kurses, ursprüngliche Preislogik und die genaue Kursortangabe fehlten.

## V14-Änderungen
- `projects/lukas-paff-premium-v1/ferienkurse.html` vollständig neu strukturiert.
- Historischen Kurstitel originalgetreu übernommen; im Seitenkopf „Oktoberkurs 2026 abgeschlossen“ ergänzt.
- Realen Originalflyer `/media/original/herbstferien-archiv.jpg` sichtbar eingebunden und als vergangener Kurs bezeichnet.
- Drei Kursdaten-Kacheln: 07./08.10.2026, 10–12 Uhr, 66121 Saarbrücken, 7–11 Jahre.
- Vier redaktionelle Modulkarten mit bestehenden KI-Konzeptillustrationen, Beschreibungen und ausdrücklich illustrativem Label.
- Ausführlicher Informationsbereich mit den ursprünglichen Preisen und dem Geschwisterrabatt, jeweils eindeutig als **historische Konditionen** ausgewiesen.
- Aktuelle Handlungsaufforderung ist nur eine unverbindliche Anfrage zu **neuen Ferienkursen**, keine nicht mehr mögliche Oktoberbuchung.
- Bestehender Popup-Link `/ferienkurse/`, übriger Onepager, Media-Maps, Originalmedien und Cloudflare Access unverändert.

## Technischer Nachweis
- Repo: `dariolazzano3-ops/chatgpt-test`
- Branch: `factory/lukas-paff-premium-v1`
- Implementierung: `6b68f0006e17fb23cd43e4aa0a4a7bdc418258e0`
- Original-Kurstitel nachgezogen: `97d42ef9c88fd8eee825a1c447673b742ecfda83`
- Private Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/ferienkurse/
- Aktives Cloudflare-Deployment: `be414612-f01a-4385-96ef-e72565f538bf`
- Worker-Version: `83872aef-c7b0-40cd-8bc2-a9c9d349bb63`, 100 % aktiviert.
- Cloudflare-Readback: 4 Trainingskarten, Titel, Preis, Geschwisterrabatt, Archivmarkierung, Standort, Kurszeiten, Mailto-Anfrage und alle Medien-Routen nachgewiesen.
- Cloudflare Access: Owner-only-Policy aktiv; anonyme Aufrufe /, /ferienkurse/, alte Bilder und Trainingsbilder ergeben HTTP 302 zur Access-Anmeldung. `noindex` bleibt gesetzt.
- iPhone-Viewport **390 px**: Browser-Rendering der ersten Bildschirmhöhe mit originalgetreuem Titel und Kursarchiv-Hinweis visuell geprüft.
- Weitere Browser-Inhaltsprüfungen bei 390 und 1440 px wurden wegen Cloudflare Rate Limit 429 nicht abgeschlossen. Ein 320-px-Content-Aufruf ergab HTTP 200, jedoch keine verlässlich auslesbaren Layoutmetriken. **Keine vollständige Cross-Device-, Safari-Hardware-, Core-Web-Vitals- oder WCAG-AA-Abnahme.**

**Redaktioneller Hinweis:** Die alten 50 € und 20 € Geschwisterrabatt sind historische Kurskonditionen. Es wird keine Gültigkeit für neue Termine behauptet.
