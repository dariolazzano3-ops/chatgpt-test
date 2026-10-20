# Lukas Paff – Premium Experience Master Loop | QA 2026-10-20

**Ergebnis:** V7 der Informationsarchitektur und visuellen Verdichtung ist auf der bestehenden privaten Cloudflare-Preview bereitgestellt. **Nicht** als öffentliche Produktionswebsite oder "90+ ready" freigegeben.

## Verified baseline
- Repository: `dariolazzano3-ops/chatgpt-test`
- Branch: `factory/lukas-paff-premium-v1`
- Ausgangs-Website-Commit (V6): `c6b4b6c71d1f5b92b6da4920a70819c447087786`
- Ausgangs-Cloudflare-Deployment: `f8739338-3530-4f22-bd62-0fe6678e09bd`
- Zuletzt geprüfte Ausgangsfassung auf Cloudflare: 10 HTML-Bilder, 6 AI-Assets, 3 private Original-Medienpfade, 1 Video; Owner-only Access und noindex.
- Projektstruktur: statischer Onepager in `projects/lukas-paff-premium-v1/preview.html`, geschützte Worker-Medienauslieferung. Keine neue Speicher- oder Formularfunktion.

## Umsetzung
1. Vier Angebote behalten, pro Angebot eine sichtbare Kernaussage und ein nativ bedienbares `details/summary` für die vollständigen bestätigten Eckdaten. Alle vier direkten "Anfragen"-CTAs sichtbar.
2. Alte Bestandswebsite auf Organisatorisches geprüft: Vorschulalter bis 6. Klasse; regionaler und laut Bestand überregionaler Einsatz nach Absprache; Kombiprogramm acht Stunden; früher erwähnter pädagogischer Förderpreis, explizit nur zur aktuellen Klärung und ohne erfundenen Preis. Keine belastenden Risiko-/Angststatistiken übernommen.
3. Zielgruppentexte, Abschnittseinleitungen und mobile Trainingsübersicht gestrafft. Sechs KI-Konzeptmotive bleiben sichtbar, bekommen kurze, zugehörige HTML-Kernaussagen mit nativ aufklappbarer ausführlicher Erklärung. Die uneinheitlichen Originalstile bleiben sichtbar und wurden nicht als echte Kursszenen ausgegeben.
4. Den vergangenen Ferienflyer kompakt und weiterhin sichtbar als Archivhinweis belassen; kein aktueller Buchungstermin suggeriert.
5. Kein Eingriff in die Personenfotos, Qualifikationsnachweise, Videoaussagen, Cloudflare Access, private noindex-Konfiguration oder Rechtsseiten.

## Git-Commits
- `8b04598e718c4c0798733034c7c8ef8327c00a81` – Angebotsdetails, redaktionelle Straffung, mobile 2-Spalten-Trainingsübersicht
- `f28b9470b91be4814eb559d90d972824fba6c3cd` – Archivflyer kompakt, alle vier Angebots-CTAs sichtbar
- `2a90b2e278dece7f0db01af3733e864ebe3c21fe` – Trainingsdetails und sichtbare Kurzaussagen
- `45a5fc55b2808f745de698ea52dc5d8e88da436c` – kürzere mobile Trainingsüberschriften
- Endgültiger Website-Quellblob: `b1c733a11b3a6900609842c65d562823220a2ece`

## Live-Deployment (API read-back)
- Private Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/
- Cloudflare-Deployment: `d035b083-77c3-4636-8d22-8107330413c0`
- Aktive Worker-Version: `1f8ebd40-cc7d-4ca7-9896-e8672d928b4c` (100%)
- Bei Worker-Auslesen bestätigt: 4 Angebots-Details, 4 Trainings-Details, 10 Bilder im HTML, 6 geschützte AI-Mediendateien, 3 geschützte Original-Mediendateien, Video vorhanden.
- Cloudflare-Access-Policy ausschließlich für berechtigten Owner aktiv, noindex bleibt gesetzt.
- Außen-HTTP-Aufrufe zu /, Bild, Logo, Video und /robots.txt leiten mit HTTP 302 zur Access-Anmeldung weiter. Die Live-Website und DNS wurden nicht verändert.

## Reproduzierbare Qualitätstests
- Cloudflare Browser Rendering: Responsive Layout mit Browser-DOM-Metriken für 320, 360, 390, 430, 768, 820, 1024, 1280, 1440 und 1920 px; auf keiner getesteten Breite horizontaler Überlauf, keine fehlenden Anker.
- Vier Angebots-Details und vier Trainings-Details vorhanden, das native Aufklappen wurde erfolgreich getestet.
- Auf 390 und 820 px anhand des **ausgelesenen live bereitgestellten Worker-HTML** alle 10 Bilder erfolgreich dekodiert, Menüs öffnen/schließen, keine fehlenden Anker, kein horizontaler Überlauf.
- 390 px, vor der V7-Verdichtung ca. 14.173 px Seitenhöhe (V6), nach V7 ca. 11.338 px. Der Wert stammt aus einem Browser-Labortest, nicht aus Felddaten. Die aktuelle Version entspricht einer Reduktion um rund 20 %. Seitenhöhe ist **keine** Qualitätsmetrik für sich.
- Angebotsbeginn von ca. 2.275 auf ca. 1.930 px reduziert (390 px), vorbehaltlich wirklicher Browser- und Schriftumgebung.
- Früherer Ferienflyer: visuelle Sektion ca. 777 px vorher, zuletzt ca. 230 px (390 px).
- Ergebnisse im Browser und Screenshots anhand der gerenderten Seite kritisch betrachtet, insbesondere Mobile Hero, Angebote, Training und Kontakt.
- Nicht behauptet: Lighthouse, echte Core Web Vitals, Full-WCAG-Zertifizierung, iPhone-Safari-Hardwaretest, authentifizierte Endnutzer-Video-Wiedergabe, echte Conversion-/Nutzerdaten.

## Weiter offene Qualitäts- und Freigabepunkte
1. Die sechs KI-Motive zeigen deutlich verschiedene Stile und teils eingebrannte Bildbeschriftungen. Nur eine Markengerechte Neufassung bzw. fachlich geprüfte Bildbearbeitung kann das auf Premium-Niveau beheben. Keine eigenmächtigen fiktiven Trainingsfotos.
2. Auflösung/Qualität des Profil-Videostills begrenzt; Videountertitel und inhaltlich sichere Transkription nicht nachgewiesen.
3. Vor Veröffentlichung bitte Rechte für identifizierbare Kinder in eventuellen weiteren Originalmedien sowie Qualifikationsnachweise und inhaltliche Aussagen durch Lukas freigeben.
4. Echte Safari-, Tastatur-/Screenreader-, Performance- und rechtliche Abnahme offen.
5. Preise, Förderbedingungen, Termine und genaue organisatorische Rahmenbedingungen aus altem Angebot vor öffentlicher Nutzung aktualisieren.
6. Kontakt-Links benötigen die Handlung des Besuchers; es werden keine E-Mails oder Kundendaten automatisch verschickt.

## Qualitätsurteil
Der Stand ist **private-preview-ready**, nicht 90+-premium-accepted. Das gilt unabhängig von der messbaren Scrollverkürzung. Ein eigenständiges, visuell kohärentes System mit vollständig überarbeiteten KI-Motiven, verifizierten Vertrauensnachweisen, Untertiteln und Endgerätetests bleibt nötig. Keine künstliche Aufwertung der Punktzahl.
