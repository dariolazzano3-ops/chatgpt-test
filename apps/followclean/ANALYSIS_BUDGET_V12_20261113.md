# FollowClean V12 | API-Kostenbremse | 2026-11-13

## Ziel
Die angekündigte Instagram-Namen-Analyse darf nicht durch große Instagram-Profile teurer werden als das Geschäftsmodell. Die 1€-Beta mit lokalem ZIP-Import und Stripe-Testcheckout bleibt unverändert. Es werden keine Apify-/Instagram-Calls und keine echten Zahlungen ausgelöst.

## Fail-closed, direkt im Cloudflare Worker
- GET /api/analysis/policy: öffentliche, unverbindliche technische Kostenrichtlinie; kein Profil-/Nutzerdatentransfer.
- POST /api/analysis/quote: nimmt hypothetische, nicht verifizierte Zahlen entgegen und gibt nur eine Schätzung zurück. Same-Origin und Body-Begrenzung; keine Kosten, kein Scan, kein Authorization Token.
- POST /api/analysis/start: gibt immer 503 paid_provider_not_enabled zurück. Weder Clientangaben noch ein später zufällig gesetzter Schlüssel können heute einen kostenpflichtigen Job starten.
- Ein Anbieter-API-Key ist NICHT vorhanden und NICHT im Browser gespeichert.

## Konfiguration
Geschäftsziel: maximal 0,25 € pro Analyse.
Vorläufige, bewusst konservative technische Grenze: 0,20 USD pro Anbieteraufruf-Analysepaket. Das ist kein garantiertes Euro-Limit. Vor Freigabe müssen Wechselkurs, Anbieterpreis, tatsächliche Gebühren und ein providerseitiger Maximalbetrag verbindlich geprüft werden.
Referenz: instagram-data-api/instagram-followers-scraper, Free-Tarif laut Anbieter 0,178 USD/1000 gelieferte Einträge, plus ca. 0,0005 USD je Lauf. Da Follower/Following separat angefragt werden, kalkulieren wir 2 Läufe.
Prognose: (Follower + Abonniert)*0,178/1000 + 2*0,0005 USD; danach 20 % Puffer und 0,01 USD Sicherheitsreserve, aufgerundet.
Grenzen:
- Follower 0 bis 1.000: nur kostenmäßig geeignete Kandidaten, falls zusätzlich unter 0,20 USD. Keine Kunden-API-Freigabe ohne zugelassenen, verifizierten Provider.
- Follower 1.001 bis 5.000: manuelle Vorprüfung, aber oberhalb des Ausgabenlimits ebenfalls gesperrt.
- Über 5.000 Follower ODER über 5.000 Abonnierte: kein kostenpflichtiger Schnellscan; kostenloser ZIP-Pfad.
- Fehlende, ungültige oder unbestätigte Zähler: Fail-closed für kostenpflichtige Jobs.
- Die Anzeige im Results-Dashboard ist nur eine hypothetische Rechnung anhand der **lokalen ZIP-Zähler**; ZIP-Inhalte und Accountnamen werden dadurch nicht an den Worker gesendet.

Beispiel: 636 Follower und 476 Abonnierte führen inklusive Reserve zu etwa 0,2488 USD > 0,20 USD und werden als API-Kostenüberschreitung gesperrt, trotz weniger als 1.000 Followern.

## Noch zu lösen, bevor bezahlte API-Analyse legal und technisch freigeschaltet werden darf
1. Zulässige Datenquelle und tatsächliche Berechtigung, einschließlich Meta-Bedingungen und Datenschutz; Anbieterclaims sind keine Genehmigung.
2. Zweifelsfrei authentische Profilgesamtzahlen unabhängig vom kostenpflichtigen Listenabruf. Öffentliches Formularfeld darf nicht als Vertrauensquelle dienen.
3. Vertraglich/technisch durchgesetzter Maximalbetrag pro Run beim Provider und Gesamtkontingent, serverseitige Quoten und Spam-/Doppelabrechnungsschutz. Kein bloßes Stoppen nach bereits eingetretenem Overrun.
4. Provider-Preis, FX-Spanne und zusätzliche Gebühren aus dem verbundenen Account prüfen und laufend beobachten.
5. Echte Nicht-Rückfolger nur bei ausreichend vollständigem, rechtmäßig erhobenem Vergleich; bei partiellen Listen nie als bestätigt ausgeben.
6. Ein bewusster Betreiber-GO zur Aktivierung. Ein Apify-Key allein reicht nicht.

## Prüfnachweise
- 24/24 programmatisch durchgeführte V12-Policy- und Schutzgattertests im aktuellen Chat, mit synthetischen Zahlen. Keinerlei bezahlte Provideranfrage.
- Wiederholbare Testdatei: tests/analysis-budget-smoke.mjs; Node-Lauf in der Chat-Toolumgebung noch nicht durchgeführt. Bisherige ZIP-Beta und RIO-Sandbox bleiben erhalten.
- Abruf der Live-Domain von dieser Toolumgebung kann von der Tool-Netzrichtlinie blockiert werden; Cloudflare-Deployment-Nachweis ist nicht automatisch ein echter Browser-E2E-Test.

## Referenzen
- https://apify.com/instagram-data-api/instagram-followers-scraper
- https://apify.com/lance_api/instagram-followers-following-scraper
- https://developers.cloudflare.com/workers/observability/errors/

## Release-Abnahme 13.11.2026
- GitHub-Branch: factory/followclean-mvp-v1-20261109.
- Worker: followclean-mvp-preview.
- Cloudflare-Deployment f0b864f4-b17e-40a0-ab24-00da7a5f759f; Worker-Version d0dcd543-027e-4139-b5f8-0e0de0138130; 100% laut Deployments API am 13.11.2026.
- Secret FC_IG_SESSION_SECRET wurde strikt geerbt und bleibt in Settings als secret_text sichtbar. Kein Apify-Secret angelegt.
- 24/24 direkt ausgeführte synchrone Schutz-/Berechnungstests bestanden; Datei tests/analysis-budget-smoke.mjs im Repo als nachholbarer Node-HTTP-Regressionscheck.
- Live-GET /api/analysis/policy ließ sich aus den Web-/Tool-Umgebungen nicht verifizieren (Zugriff auf workers.dev eingeschränkt); daher kein behaupteter Live-HTTP-End-to-End-PASS.
- Die bestehende ZIP-Analyse, Stripe-Sandbox und Promo-Code RIO wurden nicht verändert.
