# Lukas Paff | Portrait Quality Upgrade V1

Datum: 23. Oktober 2026. Ziel: Originalporträt in der ausschließlich privaten Cloudflare-Preview ersetzen, ohne Personenmerkmale, Bildausschnitt oder Website-Struktur zu verändern.

## Nachprüfbare Bildquelle
- Bisheriges Worker-Porträt: WebP VP8, 690 × 612 Pixel, 28.488 Bytes, zweimal inline verwendet (Hero und Ferienkurs-Hinweis).
- Bessere Quelle: bereits öffentlich auf der **bestehenden offiziellen Website von Lukas Paff** veröffentlichte Originalaufnahme, PNG, 828 × 539 Pixel, 243.814 Bytes. Der angeschlossene Drive-Ordner Lukas-Paff-V8-Site-Assets enthielt keine bessere Porträtdatei.
- Identischer fotografischer Inhalt: 602 von 634 SIFT-Merkmalszuordnungen per affiner RANSAC-Kalibrierung bestätigt; 100 % des bisherigen Bildausschnitts durch das Original abgedeckt; mittlerer absoluter Pixelunterschied der unoptimierten geometrischen Vergleichsfassung ca. 1,39/255.
- Neue WebP-Fassung: 2070 × 1836 Pixel, 159.246 Bytes, Qualitätsstufe 94. **Die größere Datei enthält interpolierte Retina-Pixel, keine erfundenen oder neu fotografierten Details.**
- Verarbeitung: Exakte affine Ausschnittsrekonstruktion, bikubische Interpolation, +2,2 % Kontrast und Sättigung, dezente klassische Unsharp Mask (Radius 1,18, 72 %, Schwelle 3). Kein generatives Upscaling, Face Retouching oder Skin-Smoothing.
- Private Bilddateien **nicht** im öffentlichen Repository gespeichert. Die Quelltext-Platzhalter `__LUKAS_PORTRAIT__` werden ausschließlich im privaten Worker mit dem Bild ersetzt.

## Seitenintegration
- `projects/lukas-paff-premium-v1/preview.html`: native Pixelmaße und QA-Metadaten an **beiden** Bildvorkommen angepasst. Keine Veränderung der Komposition, CSS-Objektposition, Navigation oder Inhalte.
- Keine neuen externen Bildlade-Endpunkte und kein neues Tracking.

## Automatisierte lokale Chromium-Prüfung
- 320 px / DPR 2: PASS
- 390 px / DPR 2: PASS
- 1440 px Desktop: PASS
- Bild tatsächlich dekodiert, 2070 × 1836 Pixel, zwei Marker im Quelltext.
- Bildrahmen vor/nach der Änderung **pixelgenau identisch**; `object-fit: cover` und `object-position` erhalten.
- Kein horizontaler Overflow, keine Browser-JavaScript-Fehler, alle bisherigen Anker erhalten.
- Ferienkurs-Link `/ferienkurse/`, FAQ, Kontakt und Originalvideo unverändert vorhanden; kein automatisches Abspielen des Originalvideos.
- Vorher/Nachher-Ansichten für 320, 390 und 1440 px sowie Desktop-Porträtausschnitte wurden in der **privaten VPS-QA-Umgebung** `/home/jarvis/lukas-paff-portrait-quality-v1/.qa/` erzeugt und visuell geprüft. Fotos/Screenshots nicht ins öffentliche GitHub geladen.

## Sicherheitsgrenzen und offene Punkte
- Cloudflare Access sowie `noindex` müssen vor und nach dem privaten Worker-Deploy geprüft werden.
- Kein Produktionsdeployment, keine DNS-Änderung, kein Public Launch.
- Kein echter iPhone-Safari-Hardwaretest und keine authentifizierte Browser-End-to-End-Prüfung der privaten Preview. Lokale Chromium-Tests ersetzen diese nicht.
- Die native Detailauflösung ist durch die ursprüngliche Aufnahme begrenzt. Drei Mal größere Exportmaße bedeuten nicht drei Mal mehr fotografische Details.
