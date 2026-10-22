# Lukas Paff | Single Animated Scene V10 · Private QA

Stand: 22.10.2026 (Worker-API-Zeit UTC). Nur geschützte Cloudflare-Preview.

## Umsetzung
- Vorherige zweigeteilte V8-Szene (großes Standbild + vier sichtbare Karten) im bestehenden Abschnitt `#ablauf` vollständig durch **eine** Filmfläche ersetzt.
- Neu: 11,05 Sekunden H.264 MP4, 512×512, ca. 266 KiB, 20 fps; vier symbolische KI-Illustrationen durch sanfte Überblendungen und subtile Kamerabewegung zu einem durchgehenden Clip kombiniert.
- Video startet beim Sichtbarwerden (IntersectionObserver), ist stumm, spielt nicht in Dauerschleife und kann pausiert/erneut abgespielt werden.
- Bei `prefers-reduced-motion: reduce`: kein automatischer Start, statisches Vorschaubild, manuelle native Steuerung.
- Begleitendes dynamisches Phasenlabel und Fortschrittsbalken, kompakter CTA, originale organisatorische Drei-Schritte-Informationen weiterhin im `details`.
- Originalbilder und -video, sechs pädagogische Illustrationen, vier Angebote, Kontaktwege und Hero blieben unverändert.
- Kein Produktionsdeployment, kein DNS, keine öffentlichen SEO-/Access-Freigaben.

## GitHub-Quellstand
- Projekt `dariolazzano3-ops/chatgpt-test` / `factory/lukas-paff-premium-v1`
- HTML, Video und Poster: Commit `801a94bab4362dc1c6781e2fa688f85ed107aa70`
- Video mit präziser Kamerabewegung und Cache-Busting: Commit `addf49f02ec2fb5380959cd277092342a0c9ba2a`
- Dateien: `projects/lukas-paff-premium-v1/preview.html`; `assets/story/first-step-motion-v10.mp4`, `assets/story/first-step-poster-v9.webp`.

## Cloudflare Read-back
- Deployment: `90f9aed9-0d0c-4336-8f16-aa1544477d3d`
- Worker-Version: `51b9ae01-68dd-421b-8dab-e3e7e2c5726d` / 100 %
- Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/#ablauf
- Read-back: genau ein Filmbereich, null vorherige Story-Karten, Videodaten und Poster im Worker; originale Medien und `noindex` erhalten; Owner-only Cloudflare Access weiterhin aktiv.
- Anonyme GET-Checks für /, /media/story/first-step-motion-v10.mp4, Poster, Original-AI-Motiv und bestehendes Video -> HTTP 302 zur Cloudflare-Access-Anmeldung.

## Browser-QA
Cloudflare Browser Rendering auf 390 px mit authentisch aus Worker-Code erzeugtem HTML und eingebettetem (datenidentischem) Film:
- Bildschirm-/Dokumentbreite: 390 / 390 px, keine horizontale Überlauffläche.
- Ein Video, null Story-Karten, kein zweites großes Story-Standbild.
- H.264 dekodiert: `readyState=4`, `duration=11.05`, Film läuft nach Scroll-Trigger (aktueller Zeitpunkt 1.11 s, `paused=false`).
- Interne Anker vorhanden, organisatorische Details öffnen, mobiles Menü öffnet/schließt.
- Keine vollständige authentifizierte iPhone-Safari-Hardwareabnahme.
- 320 px und 1440 px in dieser Browser-QA wegen Cloudflare Browser Rendering HTTP 429 **nicht geprüft**. Auch Core Web Vitals und vollständige Barrierefreiheitsprüfung ausstehend.

## Wahrheitsgemäße visuelle Einordnung
Dies ist **eine einzige filmisch animierte Bildsequenz**, keine durchgehende realistisch generierte Bewegung einer menschlichen Figur. Die Bewegung besteht aus Kamerafahrten und Überblendungen vorhandener symbolischer Illustrationen. Das ist deutlich näher am gewünschten filmischen Seitenauftritt als vier nebeneinander gezeigte Karten, aber noch keine vollwertige KI-Videogeneration mit natürlicher Tür- und Körperbewegung.
