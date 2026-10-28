# Track 10 | Recht, Datenschutz, Sicherheit & Betrieb
**Mission:** Ein personalisiertes Kinderbuch-Produkt rechtssicher und vertraulich betreiben, bevor es öffentlich bestellt werden kann. Rechtsfragen fachlich prüfen lassen.

## Aufgaben vor jeder Livefreigabe
- [ ] Eindeutige Betreiberidentität und Impressum, Datenschutzerklärung, Preis-/Steuertransparenz, Bestellbedingungen, korrekte Informationen zu digitalen Inhalten, Widerruf und Support.
- [ ] Datenminimierung: Eltern sind Käufer; sorgfältig dokumentieren, welche Angaben über Kinder erforderlich sind und wie diese verarbeitet werden.
- [ ] Rechtsgrundlagen, Verarbeitungsverzeichnisse und Dienstleister-/AV-Verträge für Stripe, Make, OpenAI, Cloudflare, Hosting, E-Mail, Analytics prüfen.
- [ ] Alters-/Personalisierungsdaten ausschließlich in benötigten Systemen halten. Keine Namen, Geschichten oder E-Mail-Adressen an Marketing-Analytics senden.
- [ ] Sichere Schlüssel und Trennung: private Cloudflare Access Preview, R2 privat, D1 EU-Staging, Test/Live-Stripe strikt getrennt, begrenzte Tokens und signierte Webhooks.
- [ ] Speicherung und echte Löschung: R2-Sandbox-Lifecycle 30 Tage, D1-Order/Story/Token/Log-Retention technisch implementieren. `expires_at` ist keine Löschung.
- [ ] Geheimnisse, Backups und Rollback, Überwachung, Rate Limits und Zugriffskontrollen prüfen; Vorfall- und Restore-Prozess dokumentieren.
- [ ] Kundenanfragen zu Daten, Korrekturen und Löschung als geregelten Prozess definieren; keine unkontrollierte Kundendatenverarbeitung.
- [ ] Explizite Freigabegates für reale Zahlungsdaten, echte Kunden-E-Mails, Live-API-Aufrufe und öffentliches Deployment festhalten.

**Definition of Done:** Juristische Checkliste mit verantwortlicher Person abgenommen, Zugriffskontrollen, Datenschutz, Löschung und Incident-/Rollback-Tests nachweislich bestanden. Keine unbestätigte Aussage „DSGVO-konform“.
**Abhängigkeiten:** alle Tracks, besonders 06/07/09.
**Status:** BLOCKED für Launch.
