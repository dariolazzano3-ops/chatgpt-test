# FollowClean · MVP 0.1

Isolierte, passwortfreie und lokal arbeitende Web-App für die Analyse von Instagram-Exporten.

## Funktionen

- Lokaler ZIP-/JSON-Import, auch auf iPhone und Android
- Erkennung von Nicht-Rückfolgern aus `followers_1.json` / `followers_2.json` / `following.json`
- Statistiken über Gefolgte, Follower-Beziehungen und Nicht-Rückfolger
- Gefilterte Liste, Accounts behalten, Fortschritt markieren und als CSV exportieren
- Geführter Modus: Instagram-Profil öffnen → dort selbst entfolgen → als erledigt markieren
- Fortschritt im lokalen Browser-Speicher, pro Export getrennt
- Demo mit synthetischen Beispieldaten, ohne Anmeldung oder Datenübertragung

**Kein** Passwortfeld, keine Instagram-API, kein automatisches Entfolgen, keine echten Zahlungen, keine externen Assets oder Tracking-Skripte.

## Lokal starten

```bash
python3 -m http.server 4173
# http://localhost:4173
```

## Tests

```bash
npm test
```

## Sicherheit und Grenzen

- Die ZIP-Datei wird ausschließlich im Browser verarbeitet. Ein lokaler Datei-Upload erfolgt nicht.
- ZIP-Lesebibliothek JSZip wird als lokale Datei eingebunden, ohne CDN-Verbindung. Lizenz unter `vendor/JSZIP-LICENSE.md`.
- Die App verwendet keine Server-Endpoints, keine Authentifizierung und kein Tracking. `noindex` bis zur Produktabnahme.
- Fortschrittsdaten (Nutzernamen mit Status) werden **lokal** im Browser gespeichert. Mit „Lokalen Fortschritt löschen“ entfernbar.
- Die App kann nicht feststellen, ob der Kunde in Instagram wirklich entfolgt ist. „Erledigt“ ist nur eine Checklisten-Markierung.
- Instagram-Exporte sind Momentaufnahmen; Ergebnisse sind nicht live.
- Vor kommerziellem Start: Datenschutzerklärung, Impressum, rechtliche Prüfung, Stripe Checkout in Sandbox, Zahlungsfreischaltung und End-to-End-Tests, Missbrauchsschutz und Accessibility-Abnahme.

## Deployment

Der Prototyp wurde bewusst isoliert entwickelt. Öffentliches Deployment und Stripe-Livezahlungen sind **nicht** Bestandteil von MVP 0.1.