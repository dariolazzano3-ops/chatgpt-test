# FollowClean V12: Nutzername ohne ZIP – recherchierte Datenquellen und sichere Go/No-Go-Gates

Stand: 2026-11-13. Dieser Bericht bewertet technische Möglichkeiten; keine Datenabfrage, kein Kunden-Scraping, keine Käufe und kein Deployment ausgelöst.

## Ziel und Definition von "echt"
Nutzer gibt einen Instagram-Namen ein → persönliche Analyseanimation → echte Profildaten und, sofern nachweisbar, genau einen Account mit fehlender Gegenfolge. Ein Nicht-Rückfolger darf nur als bestätigt bezeichnet werden, wenn die überprüfte, ausreichend vollständige aktuelle Follower-Liste und die Following-Liste zum exakt gleichen Zielkonto gehören. Die bloße Abwesenheit aus einer begrenzten Teilliste ist kein Beleg.

## Datenquellen

1. Offizielle Meta Instagram API / Instagram Login: für autorisierte Business-/Creator-Accounts. Liefert je nach Berechtigung Username, Profilbild und globale Zähler (followers_count, follows_count). Keine allgemeine API zum vollständigen Aufzählen beliebiger Follower- und Following-Usernamen. Nur Username eines beliebigen privaten Kontos genügt nicht. Geeignet für Profilkarte und Live-Gesamtzahlen, NICHT für gesicherte Nicht-Rückfolger.
   Quelle: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
   Quelle: https://developers.facebook.com/docs/graph-api/reference/shadow-ig-user

2. Apify Community-Actor lance_api/instagram-followers-following-scraper: behauptet public-profile Followers + Following ohne Login, inklusive Pagination, Profildaten, Profilfoto-URLs und Coverage-Status (COMPLETE, LIMIT_REACHED, INSTAGRAM_LIMITED, PARTIAL). Aktuell gelisteter Einstieg ab 0,80 USD / 1000 Ergebniszeilen zuzüglich separater Gebühren. Keine Bewertungen bei Abruf. Auf privatem Zielprofil keine Listen. Nicht unabhängig geprüft.
   https://apify.com/lance_api/instagram-followers-following-scraper

3. Apify Community-Actor coregent/instagram-followers-following-scraper: behauptet denselben öffentlichen Username-only-Weg, Profilbilder und detaillierten Coverage-Status. Öffentlich gelistete Kosten ab 1,00 USD / 1000 Ergebniszeilen; private Profilquellen werden abgewiesen. Nicht unabhängig geprüft.
   https://apify.com/coregent/instagram-followers-following-scraper

4. Apify Community-Actor instagram-data-api/instagram-followers-scraper: laut Anbieter kein Instagram-Login, ab ca. 0,17 USD / 1000 Zeilen auf bestimmten Plänen, zusätzliche Run-Gebühr möglich; berichtete Teilabdeckungen auf sehr großen/verified Profilen, limitierter Free-Test. Nicht unabhängig geprüft.
   https://apify.com/instagram-data-api/instagram-followers-scraper

5. Anderer Scraper arisma_tech/instagram-followers: beschreibt Login-freien Modus ausschließlich für Profilmetadaten; echte Listen erst mit Instagram-Session-Cookie. Diese Angaben widersprechen pauschalen "ohne Login"-Behauptungen anderer Anbieter und zeigen die Prüfnotwendigkeit. Wir verlangen niemals Cookies/Passwörter von Kunden.
   https://apify.com/arisma_tech/instagram-followers
   https://apify.com/arisma_tech/instagram-followers-scraper

6. Browser-Bot/Desktop Commander mit eigenem FollowClean-Account: potenziell technisch steuerbar, aber kein Recht, auf private Listen fremder Personen zuzugreifen. Meta untersagt unerlaubte automatisierte Datensammlung auch im eingeloggten Browser. Kein zuverlässiger Endkunden-Service; keine produktive Implementierung ohne ausdrückliche Berechtigung.
   https://ag.ny.gov/sites/default/files/social-media-policy-report/2025-q3-meta-platforms-inc-policy.pdf (Appendix B, Instagram-Nutzungsbedingungen Seite 19 des Berichts/PDF-Seite 18)

7. Lokaler Meta-Export (ZIP): belastbarste bestehende Quelle für die Listen des freiwillig analysierenden Nutzers und privat/public; bereits in FollowClean implementiert. Kein Instagram-Passwort oder Bot nötig. Nachteil: Einmaliger manueller Export bleibt erforderlich.

## Qualitäts- und Compliance-Gates vor einem Provider-Pilot
- Eigene Testkonten mit ausdrücklich erlaubtem Zugriff, darunter öffentlich, privat, großer Account, wenig Follower, gleiche Namen und fehlende Daten.
- Prüfen, ob Anbieter eine ausdrückliche Meta-Erlaubnis für seine Methode hat; Nutzungsbedingungen und DSGVO-Zwecke/Übermittlungen klären. Ein bezahlbarer Community-Actor ist nicht automatisch legitim für einen kommerziellen Dienst.
- Keine Kundendaten oder realen Instagram-Zugangs-/Sitzungsdaten in einen fremden Scraper laden. Test nur mit eigenen/proprietär autorisierten Konten, ohne Sicherheitsmaßnahmen zu umgehen.
- Je Lauf dokumentieren: Quelle, legitimer Accountinhaber, Laufzeit, Zählerstände, erreichte Coverage pro Liste, vollständige Ergebniszahlen, Profilbild-URL, API-Fehler, Token-Nutzung, Laufzeit und Abrechnung.
- Cross-check gegen den autorisierten Originalexport: Mengenvergleich, falsche positive Nicht-Rückfolger, unvollständige Abdeckung, leere/gelöschte/gesperrte Accounts. Kandidat nur bei verifizierbaren vollständigen Vergleichsdaten.
- Keine Behauptung "XY folgt dir nicht zurück" bei PARTIAL/LIMIT_REACHED/PROVIDER_LIMITED, unbekannter Abdeckung, ungültiger Avatar-URL oder nicht identisch zugeordnetem Account.
- Automatisierung ausschließlich wenn Meta die konkrete Erhebung erlaubt und ein angemessener Datenschutzrahmen besteht.
- Pilot ohne Zahlungen/Planabschluss; vor jedem kostenpflichtigen Test getrennte Freigabe und Kostenobergrenze einholen.

## UX-Strategie für FollowClean V12
A) Sofort verfügbares Frontend: Instagram-Namen eingeben (freiwillig) → hochqualitativer, als Schritt gekennzeichneter Lade-/Prüfablauf → genuine verifizierte öffentliche Profilkarte nur wenn ein autorisierter Provider tatsächlich Daten liefert; sonst Platzhalter mit Hinweis.
B) Erste Nicht-Rückfolger-Enthüllung nur mit verifiziertem vollständigem Vergleich und datenschutzrechtlich erlaubter Quelle, sonst transparenter Übergang zur lokalen ZIP-Analyse.
C) Kein Fake-Fortschrittsbalken, der imaginäre API-Aufrufe behauptet. Animationen dürfen visuell sein, der konkrete Status muss ehrlich bleiben.
D) Existierender Cloudflare Worker, GitHub, Sandbox-Checkout bleiben unangetastet; keine neuen kostenpflichtigen Dienste.

## Entscheidung
Keine belegbare sichere, universelle "nur Username -> 1 verifizierter Nicht-Rückfolger"-Lösung für beliebige private und öffentliche Konten.
Beste Wiederverwendungsoption für eine **isolierte, einwilligungsbasierte Forschung**: Anbieter mit Coverage-Status (zunächst lance_api oder coregent), jedoch erst nach Rechts-/Berechtigungsprüfung; Anbieterangaben sind noch keine Validierung.
Beste kurzfristige Produktmaßnahme: Username-first Profilkarte/Animation mit transparentem ZIP-Fallback. Keine falschen Nicht-Rückfolger, keine geteilten Passwörter und kein heimlicher Bot.
