# FollowClean V14 | Apify-Zugang & Budgetdatenbank | 13.11.2026

## Implementierter Zustand
- Apify-Adapter im Worker: dokumentierter Actor `lance_api~instagram-followers-following-scraper`, richtiger API-Endpunkt `POST /v2/acts/{actorId}/runs` sowie Input `profiles`, `dataToScrape: "both"` und `resultsLimit`.
- Apify-API-Abfrageparameter `maxTotalChargeUsd: 0.20`, `maxItems`, `restartOnError: false`, `memory: 128`, `timeout: 90` im inaktiven Entwurf. `maxItems` schützt nur bei Pay-per-result-Modellen vor Mehrberechnung; dieser Actor rechnet Pay-per-event ab. Für ihn ist der providerseitige `maxTotalChargeUsd`-Deckel der entscheidende per-run-Ausgabenschutz.
- Free-Tarif technisch berücksichtigt: maximal 100 Ergebnisse *je Richtung* und Profil. Bei mehr als 100 Followern oder Abonnierten wird keine Vollständigkeit behauptet.
- Test-Ergebnisprüfer verlangt sichere Kontoidentität, überprüfte unabhängige Zähler, mindestens ausreichende Coverage, eindeutige IDs und übereinstimmende Zeilenanzahlen. Es wird kein Nicht-Rückfolger bei fehlenden oder partiellen Listen behauptet.
- Öffentliche Website: Benutzername-Eingabe mit animierter, ehrlich als Vorschau gekennzeichneter Verbindungsprüfung; ZIP-Fallback bleibt vorhanden.
- Serverseitige API `/api/analysis/provider/status` kann ohne Preisgabe von Secrets melden, ob `FC_APIFY_TOKEN` vorhanden und die Budgetdatenbank angebunden ist. Es gibt keinen öffentlich erreichbaren kostenpflichtigen Start.

## Reale Cloudflare-Ressourcen
- Bestehende D1-Datenbank `chatgpt-test-db` wiederverwendet, keine neue Datenbank und kein neuer VPS.
- Isolierte Tabelle `fc_apify_budget_reservations_v1`, zwei Indizes, zwei atomare INSERT-Trigger in der D1-Datenbank angelegt.
- Limits für **Staging**: 0,20 US-Dollar pro Reservierung, 1,00 USD pro UTC-Tag, 5,00 USD pro UTC-Monat. Strenger als das Geschäftsmodell; vor Produktstart bewusst prüfen.
- UNIQUE(owner_fingerprint, profile_fingerprint, day_utc) verhindert gleiche Account-/Profil-Reservierung am selben Tag. Trigger verweigert eine überschreitende Reservierung atomar. Nur serverseitig errechnete Fingerabdrücke vorgesehen; keine Instagram-Namen in D1 abgelegt.
- Cloudflare Worker Binding `FC_APIFY_BUDGET_DB` zeigt auf die bestehende D1-Datenbank. Binding `FC_IG_SESSION_SECRET` ist erhalten.
- Schema als `apps/followclean/sql/fc_apify_budget_v1.sql` versioniert.
- Direkter D1-Test: 5 synthetische Testreservierungen zu jeweils 0,20 USD erreichten 1,00 USD; ein weiterer Eintrag wurde durch den Trigger `followclean_daily_budget_exceeded` abgewiesen (Cloudflare meldete SQLITE_CONSTRAINT_TRIGGER). Alle synthetischen Reservierungen anschließend gelöscht, Restzahl 0.

## Abnahme / Nicht erledigt
- 12/12 direkt ausgeführte synthetische Prüfungen für API-Plan, tatsächlichen `maxItems`-Parameter, 100er-Tariflimit, Tarifkosten, Keine-Ausführung und Code-Syntax bestanden. Zusätzlich V13: 16/16 synthetische Tests.
- Cloudflare Worker-Deployment 2026-11-13T18:32:19Z: Version `b09fefc4-77b4-482f-a1cc-4a6743d81298` zu 100% gemäß Deployments API.
- Cloudflare-API zeigte nur die Bindings `FC_APIFY_BUDGET_DB` (D1) und `FC_IG_SESSION_SECRET` (Secret). Kein `FC_APIFY_TOKEN` vorhanden.
- Keine echte Instagram-Profilanalyse, kein echtes Profilbild, kein Zugriff auf fremde Follower-Listen und **keine kostenpflichtige Apify-Ausführung**.
- Zahlungs-/API-Start-Endpoint ist absichtlich hart deaktiviert (`FC_PROVIDER_EXECUTION_ENABLED=false`; `POST /api/analysis/start` liefert 503).
- Die D1-Reservierung ist vorbereitet und technisch getestet, aber der künftige paid-start-Handler ist aus Sicherheitsgründen **nicht** an den Ledger angeschlossen. Vor irgendeiner Freigabe müssen unabhängige Besitzerbestätigung, verifizierte Profilgröße, bindendes Quota-Commit, globale Rate-Limits, Replayschutz, Berechtigung/Compliance sowie Erfolgs- und Abrechnungsabnahme implementiert werden.
- Token muss vom Kontoinhaber in Apify generiert und als Cloudflare Worker-Secret `FC_APIFY_TOKEN` hinterlegt werden. Keinen Token in GitHub, Chat-Nachrichten oder URLs verschicken. Das bloße Hinterlegen aktiviert keinen Scanner.
- Ein eigenes öffentliches Test-Instagram-Konto mit ausdrücklicher Berechtigung und ein aktueller freiwillig bereitgestellter Originalexport werden für einen echten Genauigkeitstest benötigt.
- Live-HTTP-E2E konnte aus der Toolumgebung bisher nicht unabhängig bestätigt werden. Cloudflare-Deployment ist kein Nachweis, dass ein realer Instagram-Scan funktioniert.

## Quellen
- Actor Input/Output & vollständige Coverage-Einschränkungen: https://apify.com/lance_api/instagram-followers-following-scraper
- Apify Run Actor API, Query-Parameter: https://docs.apify.com/api/v2/actors-runs-post
- Apify Pay-per-event-Limits sind per Run, nicht global: https://docs.apify.com/actors/monetize/pay-per-event
- Cloudflare D1 Batch & atomare Transaktionen: https://developers.cloudflare.com/d1/worker-api/d1-database/
