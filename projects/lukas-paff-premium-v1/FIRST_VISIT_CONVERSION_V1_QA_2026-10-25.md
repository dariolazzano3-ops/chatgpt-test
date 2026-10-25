# Lukas Paff | First Visit & Conversion Experience V1

**Geprüfter Stand:** 25.10.2026 · ausschließlich private Cloudflare-Preview · Scope: `preview.html`, vor allem Erstbesuch, Ferienprogramm-Teaser und Kontakttext.

## Änderungen
- Automatisches V12-Ferienprogramm-Popup vollständig entfernt: `<dialog>`, eigene CSS-Regeln, JavaScript `showModal()`, 380-ms-Timer, SessionStorage-Schranke sowie ausschließlich modalbezogene Event-Listener.
- Kompakter, barrierearmer Editorial-Teaser **nach `#ueber` und vor `#zielgruppen`**, damit die Lukas-Vorstellung weiterhin direkt nach `#start` erscheint.
- Teaser-Inhalte: „FERIENPROGRAMME“, „Stärker durch die Ferien.“, „Gemeinsam Selbstvertrauen, Grenzen und Zusammenhalt stärken.“, „Ferienprogramme entdecken ↗“ (Link `/ferienkurse/`), „Neue Termine auf Anfrage.“ Keine neuen Datums- oder Preisangaben.
- Kontakt-Introtext auf klar getrennte, **unverbindliche** Anfragewege zugespitzt. Bestehende zwei `mailto:`-Betreffzeilen für Eltern bzw. Schule, Telefon, WhatsApp unverändert.
- Mobile Hero-Vertikalabstände und Porträthöhe vorsichtig optimiert, ohne Headline, echtes Porträt, CTA oder Desktop-Hero umzubauen.
- Keine zusätzlichen Frameworks, kostenpflichtigen Dienste, Trackings oder Medien; keine Änderung an `ferienkurse.html` und anderen Projekten.

## Browser-QA (Chromium/Playwright, lokale Seitenkopie mit lokal eingebettetem, geschütztem Porträt)
| Breite | neuer Hero | Teaser | Ergebnis |
|---|---:|---:|---|
| 320 px | 702 px | 185 px | PASS |
| 375 px | 736 px | 186 px | PASS |
| 390 px | 743 px | 187 px | PASS |
| 430 px | 724 px | 151 px | PASS |
| 820 px | 835 px | 105 px | PASS |
| 1440 px | 865 px | 111 px | PASS |

- **Wichtiger Vorher/Nachher-Homepage-Test:** origin `https://qa.lukas.test/` per Playwright-Route simuliert: Vorher nach 900 ms `dialog.open=true` und `overflow:hidden`; nachher kein Dialog-Element, kein Scroll-Lock. Keine Browser-JS-Fehler.
- Kein horizontaler Overflow in allen sechs Viewports. Original-Porträt lädt, `#start`, `#ueber`, `#zielgruppen`, `#einzelcoaching`, `#schulangebote`, `#kontakt` und übrige Anker funktionieren.
- Zwei Audience-V2-Karten, 6 FAQ-Einträge, Originalvideo, Story-Video und Ferienkursarchiv verifiziert.
- Mobile Navigation geöffnet und nach Klick geschlossen.
- Unveränderte Zielgruppen-`mailto:`-Betreffzeilen im HTML bestätigt. Kontaktlinks, Telefon und WhatsApp bleiben vorhanden.
- Teaser-Link im HTML direkt auf `/ferienkurse/`; im lokalen `file://`-Browser ist diese Worker-Route nicht erreichbar (nicht als erfolgreicher E2E-Test zählen). Cloudflare-Worker-Routen und Cloudflare-Access-Schutz sind nach Deployment gesondert nachzuprüfen.
- Ohne JavaScript sind Teaser und Zielgruppenlinks nutzbar. `prefers-reduced-motion` berücksichtigt.
- `node --check` auf inline JavaScript sowie `git diff --check` bestanden.
- Mobile/Tablet/Desktop-Screenshots wurden im privaten VPS-Arbeitsverzeichnis `/home/jarvis/lukas-paff-first-visit-v1-20261025/.qa/` erzeugt. Keine geschützten Bilddateien in GitHub abgelegt.

## Bewertung und Grenzen
- **Nachgewiesen:** Popup-Unterbrechung und Scroll-Sperre entfallen; CTA- und Kontaktstruktur weiterhin vorhanden; mobile Hero-Vertikalfläche reduziert.
- **Nicht anhand Nutzerdaten nachgewiesen:** mehr qualifizierte Anfragen, höhere Conversion-Rate.
- **Offen:** physischer iPhone-Safari-Test und vollständiger autorisierter Browser-E2E hinter Cloudflare Access. Keine echte Kontaktanfrage mit personenbezogenen Daten versendet.
