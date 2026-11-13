# FollowClean | Einmaliger Live-Test für eigenes Instagram-Konto | 2026-11-13

## Testauftrag
Vom Kontoinhaber im Chat autorisiert: öffentlicher/zugänglicher Instagram-Account `@ysrrioo`. Ein einziger Apify-Actor-Lauf, keine öffentliche Kundenfreigabe.

- Actor-ID: `cwcr3CoSbucMVwFsF` (LanceAPI Instagram Followers & Following)
- Input: `{"profiles":["ysrrioo"],"dataToScrape":"both","resultsLimit":10}`
- Beschränkungen: `maxTotalChargeUsd=0.05`, `maxItems=20`, `restartOnError=false`, `memory=256`, `timeout=120`.
- Einmalige serverseitige D1-Reservierung: `fc-single-actor-20261113`, $0.05, danach Status `settled`. Kein zweiter Actor-Lauf zugelassen oder ausgelöst.
- Run-ID: `3qcGw5hkmwWfO1Ua5`
- Dataset-ID: `hhUTcRv7UafYnz4vH`
- RUN_SUMMARY-Key-Value-Store: `s39OALEJhWbVw7Gcs`

## Tatsächlich beobachtete Apify-Antworten
- POST-Start: HTTP 201, Actor-Lauf `SUCCEEDED`.
- Anfangs 10, später nach finaler Abrechnung **20 kostenpflichtige Result-Ereignisse**.
- `chargedEventCounts`: `apify-actor-start: 1`, `profile: 1`, `result: 20`.
- Finales `GET /v2/actor-runs/{runId}`: `usageTotalUsd: 0.032`, `eventUsage`:
  - Start $0.001
  - Profil $0.001
  - 20 Ergebnisse $0.030
  - Summe $0.032 (unter $0.05)
- Achtung: Weitere Plattformgebühren können abhängig von Tarif/Account anfallen; `usageTotalUsd` ist der in diesem Lauf von Apify ausgewiesene Betrag.

## Noch nicht bewiesen
- Dataset `GET /v2/datasets/{datasetId}/items` → **403**, ebenfalls `GET /v2/key-value-stores/{storeId}/records/RUN_SUMMARY` → **403**: Dem eingeschränkten Apify-Token fehlt der Zugriff auf *default run storages*.
- Deshalb sind Anzahl und Richtung der tatsächlichen gelieferten Follower-/Following-Zeilen sowie echte Profilbilder **noch nicht verifiziert**. Das Ergebnis darf nicht als verifizierter Nicht-Rückfolger verkauft werden.
- 10 pro Richtung ist für größere Profile ohnehin nur eine kleine Stichprobe. Vollständige Listen und aktuelle Gesamtzahlen wären für einen Beweis erforderlich.
- Aktueller Worker bleibt im read-only/ZIP-Modus. Automatische Bezahl-API `/api/analysis/start` ist hart deaktiviert und wird nicht mit dem Ledger-Laufpfad verbunden.

## Sicherheit und Cleanup
- Test-Endpoint ausschließlich kurzlebig und durch 256-Bit-Zufallswert geschützt; danach ursprünglicher Worker wiederhergestellt.
- Finales Cloudflare-Deployment `4efdc35e-dba7-4019-a4ec-436b38e3e536`, 100%.
- Nur die vorherigen Bindings bestehen: `FC_APIFY_TOKEN`, `FC_IG_SESSION_SECRET`, `FC_APIFY_BUDGET_DB`; keine temporären Secrets, keine Cron-Triggers.
- Keine fremden Profilnamen, Bilder oder Listen in FollowClean-D1 gespeichert. Keine Token-Werte protokolliert.

## Minimaler nächster Schritt
Im persönlichen Apify-Token `Followclean`: Unter *Running Actors* mit *Permission mode Restricted access* die Option `Allow this token to access default run storages` aktivieren und speichern. Das gestattet dem Token den Zugriff auf Ergebnisse seiner eigenen Actor-Läufe, ohne globale Actor-Rechte freizuschalten. Alternativ sehr eng nur den konkreten Dataset- und Key-Value-Store-Lesezugriff gestatten, sofern die Ressourcenauswahl dies unterstützt. Anschließend **nur lesen**, keinen neuen Run starten, vorhandenes Dataset und RUN_SUMMARY analysieren.

Referenzen:
- https://apify.com/lance_api/instagram-followers-following-scraper
- https://docs.apify.com/integrations/api
- https://docs.apify.com/actors/monetize/pay-per-event
