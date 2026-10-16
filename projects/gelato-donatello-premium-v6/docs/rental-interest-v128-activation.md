# Gelato Donatello | Eisvitrinen Premium V128 | PRIVATE TEST ONLY

## Umsetzung
- Bestehende Originalmotive gelato-vitrine-produkt-hd.avif und gelato-vitrine-produkt.webp byte-identisch erhalten.
- Foto-fokussierter Hero, drei Veranstaltungsanlässe, minimalistischer Übergang zur bestehenden Anfrageposition. Keine fremden Eventbilder, keine erfundenen Daten, Preise, Verfügbarkeiten, Liefer- oder Zubehörzusagen.
- Anfrage: Anlass, Wunschdatum, Eventort, geschätzte Gästezahl, bis zu vier Eissorten aus den bereits vorhandenen 41 Sorten, Name, E-Mail, optionale Telefonnummer.
- Klick auf Anlass-Chip füllt die Auswahl automatisch aus.
- Auf der privaten Preview sind ausschließlich synthetische Eingaben erlaubt: Test Gast, test@example.test, leere Telefonnummer oder 000000 und die exakt auswählbaren TEST-Orte.
- Die Formularfelder bleiben blockiert, bis die API /api/rental-interest/status explizit das sichere Testmodus-Profil bestätigt.
- Servervalidierung: strikte Feld-Allowlist, Cross-Origin-/Content-Type-/Body-Limit-Prüfung, Honeypot, synthetische Identitäten und Ortsangaben, Eissorten- und Gästeprüfung; keine unkontrollierten Freitexte.
- Erfolg: serverseitig geprüfte, flüchtige DEMO-RENT-Referenz; keine Datenbank, keine E-Mail, keine Buchung, keine Zahlung, keine aktive Kundenannahme.
- Die bestehenden Event- und Eistorten-Anfrage-APIs werden unverändert durchgereicht.

## Freigabe vor Echtdaten
1. Verantwortliche Stelle, Datenschutzinformation einschließlich Zwecke/Rechtsgrundlage, Empfänger/AVV, Aufbewahrung, Löschung und Betroffenenrechte final prüfen und freigeben.
2. Ausschließlich nach GO eine getrennte zugriffsbeschränkte Datenspeicherung mit Lösch-/Retention-Mechanismus und Audit ermöglichen.
3. E-Mail-Benachrichtigung, Sender, scoped Secrets, Idempotenz/Retry, Missbrauchsschutz und Rate Limits/Turnstile prüfen. Kein Versand bisher.
4. Produktversprechen, Mietbedingungen, Liefer-/Abholfrage, Zubehör, Umfang, Preise und Eventkapazität ausdrücklich durch Betreiber bestätigen lassen.
5. E2E-Abnahme mit synthetischen Daten, Datenschutz-/Sicherheitsprüfung, dann gesonderte Freigabe für Echtdaten und weitere Freigabe für Produktionsdeployment.

Die öffentlich erreichbare Produktionswebsite, DNS, Zahlungen und externe E-Mail-Systeme werden nicht verändert.
