# Lukas Paff | Story-Film V11 – automatisches HD-Loop (private Vorschau)

**Stand:** 23. Oktober 2026 (Uhrzeit der Deployment-API: 22.10.2026 22:26:53 UTC).  
**Status:** Worker-Deploy und mobile Browserprüfung verifiziert, keine öffentliche Veröffentlichung.

## Ursache der sichtbaren Unschärfe
Die vorherige Animation war 512 × 512 Pixel groß, etwa 322 KB schwer und bestand aus sehr niedrig aufgelösten, KI-generierten Bildvorlagen. Die geringe native Bildauflösung und Kompression führten auf Retina-Displays zu Unschärfe.

## Umsetzung
- Video neu gerendert: **1024 × 1024**, **24 fps**, **H.264**, **10,79 Sekunden**, **2.087.997 Bytes**, ~1,55 Mbit/s.
- Kompressionsziel CRF 18 statt vormals CRF 23; Poster als WebP in 1024 × 1024 (76.282 Bytes).
- Neue, versionierte Medien unter `/media/story/first-step-motion-v11.mp4` und `/media/story/first-step-poster-hd.webp`.
- Die Szene spielt stumm und inline automatisch ab, **loop** aktiv, bisheriger Pause/Play-Button und native Controls auf normaler Wiedergabe entfernt.
- Bei nicht sichtbarer Szene oder Hintergrundtab pausiert die Wiedergabe ressourcenschonend; bei Sichtbarkeit läuft sie automatisch weiter.
- `prefers-reduced-motion: reduce`: statisches Poster statt automatischer Bewegung.
- Browsersicherer Fallback: Wenn Autoplay blockiert wird, werden native Controls zur manuellen Wiedergabe aktiviert.
- Vorhandene Inhalte, Trainingsbereiche und Kontakte erhalten.

## GitHub
- Repository: `dariolazzano3-ops/chatgpt-test`
- Branch: `factory/lukas-paff-premium-v1`
- HTML/JS-Änderung: `a9a1f766c7d4b42e76d393a79c5a9fb511a8bce3`
- Neue HD-Dateien: `d4ee4e1dc92b12cd39f5ff8860cb4a5b48493757`

## Cloudflare
- Private Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/
- Deployment: `818368e7-5f7a-4ad5-a485-1a05e634e54d`
- Worker-Version: `5c534655-b1fa-4041-ad27-1116b10a598b` (100 %).

## Durchgeführte Tests
- Worker API Read-back: neues Video und Poster korrekt in Worker-Medien eingebettet, Medienroute vorhanden, alte Originalmedien weiterhin vorhanden, sechs KI-Trainingsmotive, vier Angebote und Lukas-Introvideo erhalten.
- Echtes Cloudflare Browser Rendering mit inline eingebetteten Videodaten und iPhone-Viewport **390 × 844**: nach 3,6 Sekunden `videoWidth=1024`, `videoHeight=1024`, `readyState=4`, `currentTime≈3s`, `paused=false`, `loop=true`, `autoplay=true`, `muted=true`, `controls=false`, `videoError=null`, kein horizontaler Überlauf.
- Browser Rendering **320 px**: `scrollWidth=320`, kein Overflow, 4 Angebote, 4 Trainings-Schwerpunkte, 2 Mailto-Links, keine fehlenden Anker, Menü und Ablaufdetails bedienbar.
- Desktop-Test bei 1440 px konnte wegen API-Rate-Limit 429 nicht abgeschlossen werden.
- Keine echte iPhone-Safari-Hardwareprüfung, keine Core-Web-Vitals-Feldmessung und keine WCAG-AA-Abnahme behauptet.

## Qualitätsgrenze
Das neue Video ist eine **hochwertiger codierte und hochskalierte Fassung der vorhandenen niedrig aufgelösten Illustrationen**. Die Quelle besitzt nicht genügend native Details für eine echte fotorealistische HD-Animation; keine neuen natürlich bewegten Gliedmaßen erzeugt. Sichtbare Artefakte des Ursprungs können bleiben. Für eine nochmals deutlich bessere Bildqualität wären neue, in nativer hoher Auflösung konsistente Szenen erforderlich.
