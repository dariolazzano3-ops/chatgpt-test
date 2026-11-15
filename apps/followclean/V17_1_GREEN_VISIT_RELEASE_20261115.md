# FollowClean V17.1 | Grüner Profilbesuch | 15.11.2026

## Architekturentscheidung
Ein Instagram-Profil wird nach dem Aufruf in FollowClean **automatisch grün als besucht** dargestellt. Für diese visuelle Markierung ist keine Rückfrage und keine Entfolgen-Bestätigung erforderlich.

**Wichtig:** Intern bleibt `opened` von `done` getrennt. Der Fortschrittszähler für bearbeitete Accounts erhöht sich nur nach einer ausdrücklichen `done`- oder `keep`-Auswahl. Ein Profilbesuch beweist kein Entfolgen.

## Umsetzung
- Statuszeile: `✓ Profil besucht · Entfolgen nicht bestätigt`.
- `fc-row-opened`: deutlich grüne Karte mit grünem Rand und Glow, auch im Dark Mode.
- Kein automatisches Rückfrage-Popup nach Instagram-Rückkehr.
- Manuelle `Erledigt`- und `Behalten`-Aktionen unverändert verfügbar.
- Lokale Speicherung des Besuchsstatus weiterhin aktiv.
- Chrome-Smoke-Test (19 Prüfungen) auf das gewünschte Verhalten aktualisiert; zusätzliches statisches Release-Gate ergänzt.

## GitHub
- Isolierter Hotfix-Branch: `factory/followclean-v17-green-visited-hotfix-20261115`.
- Laufender Entwicklungsbranch: `factory/followclean-mvp-v1-20261109`.
- Die V17.1-Codebasis stammt ausschließlich aus V17 `8eda8894dee0e79172fa0ec0dee53e1c50c8a739` plus dem beschriebenen UI-Hotfix. V18-Funktionen wurden nicht in dieses Bundle gemischt.

## Cloudflare
- Worker: `followclean-mvp-preview`.
- Upload erfolgreich: Version **67**, ID `5c754246-0a46-4615-85e9-21ef04153be6`.
- Upload ohne Traffic-Umschaltung; Version 64 (V16) behält 100 % Traffic.
- Binding `FC_APIFY_BUDGET_DB` weiterhin auf die alte D1 `24bce336-3a04-4517-bd12-c9e713068d58`.
- Beide vorhandenen Secrets vererbt und verifiziert.
- Kein D1-Schemawechsel, keine Apify-Läufe, keine Zahlungen.

## Reproduzierbare Bundle-Hashes
- `index.html`: `8980157ab62f72c901e3e7b2312b76f4210711aa9bb773a0010d3c7d1c2cdcec`
- `dist/worker.mjs`: `e22c5ee0f3602f87f9ee4f1368a629f257651913b7762c2fda2118a1473f68b8`

Die beiden Hashes wurden aus den GitHub-Quellen errechnet und mit dem hochgeladenen Payload abgeglichen.

## Tests und offene Freigaben
- Statische Prüfungen (grüne CSS-Klasse, keine automatische Entfolgen-Markierung, kein Popup, Apify-Ausführung gesperrt) bestanden.
- Änderungen an den Chromium-Smoke-Tests und Release-Gates sind auf GitHub gespeichert, aber **in dieser Sitzung nicht ausgeführt**.
- Echte iPhone-/Safari-Abnahme und externe Erreichbarkeit der Versions-URL nicht bestätigt.
- Keine 100-%-Traffic-Freigabe erteilt. Erst nach der iPhone-Prüfung kontrolliert auf Version 67 umschalten.
- Rollback bleibt aktive V16, Version `315389f2-6138-4ca2-84a3-14a43b442f5e`.
