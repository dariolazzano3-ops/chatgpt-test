# Track 05 | Premium-PDF, Originaldesign & Medien
**Mission:** Der von der originalen Factory erzeugte Text wird automatisch zum hochwertigen Lunara-Endprodukt.

## Verifizierter Stand
- Originales „Lunara – Mia.pdf“: neun Seiten, dunkelvioletter Sternenhimmel, Mondmotiv, sieben Geschichtenseiten und Schluss.
- ReportLab-Renderer und Offline-Make-Adapter getestet: 43 Originalabsätze, neun Seiten, suchbarer Text, acht lokale Tests bestanden; Test-PDF stimmt an ausgewählten gerenderten Seiten pixelgenau mit der Referenz überein.
- Das automatisierte Make-System verwendet gegenwärtig noch Google Docs für **einfaches Text-PDF**. Premium-Renderer nicht serverseitig eingebunden.
- Originalgrafiken noch nicht autorisiert in privaten R2-Medienspeicher übertragen.

## Aufgaben
- [ ] Sichere Asset-Verteilung der Original-JPEGs, Rechte/Lizenzen und keine öffentlichen Medien-URLs.
- [ ] Reuse-first: vorhandener Python-Renderer auf isoliertem vorhandenen VPS oder unterstützter Cloudflare-Rendering-Pfad. Keine neue Infrastruktur ohne Not.
- [ ] `lunara.story.qa.v1` als vertragliche Eingabe: nur bestandene QA, Titel, Text, Abschluss, Kindname.
- [ ] Layouttests: kurze/lange Namen, 2–7 Altersvarianten, Umbrüche, Umlautglyphen, 7–12+ Seiten als erwartbare variable Ausgabe; keine abgeschnittenen Absätze.
- [ ] Ergebnis via Einmal-Upload in privaten R2 speichern; PDF auf korrekte Bytes, Metadaten und Seiten prüfen.
- [ ] Keine unberechtigten Downloads, PDF-Ablauf/Retention mit 10 klären.

**Definition of Done:** Eine **neu generierte** synthetische QA-bestandene Make-Geschichte wird ohne manuelle Übergabe als durchsuchbares Premium-PDF im privaten R2 gespeichert; visuell und programmatisch abgenommen.
**Abhängigkeiten:** 04, 07, 10.
**Status:** OFFLINE DONE-VERIFIED / INTEGRATION BLOCKED.