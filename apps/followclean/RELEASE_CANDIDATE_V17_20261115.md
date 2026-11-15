# FollowClean | Release-Kandidat V17 für die bestehende Preview | 15.11.2026

Status: **GO von der Architekturinstanz erteilt (15.11.), nicht deployt.** Aus der Entwicklungsumgebung besteht kein Cloudflare-Zugang; siehe „Release-Protokoll“ am Ende.

**V17 ist fest an Commit `8eda8894dee0e79172fa0ec0dee53e1c50c8a739` gebunden.** Spätere Commits (Export + Checker V1, Positionierungstext) gehören zu V18 und sind nicht Teil dieser Freigabe. Zum Bauen von V17:

```bash
git worktree add --detach /tmp/v17 8eda8894dee0e79172fa0ec0dee53e1c50c8a739
cd /tmp/v17 && node apps/followclean/tests/release-verify.mjs
```

## Inhalt gegenüber V16 (live)
- Profilbesuch markiert nie mehr automatisch als erledigt; Rückfrage nach der Rückkehr.
- Besuchte Zeilen optisch getrennt von erledigten; lokale Initialen-Avatare mit fester Farbe.
- Aufklappbare Erklärung, warum es kein Live-Ergebnis nur mit Benutzername gibt.
- Die zwei eingebetteten Beispielfotos sind durch selbst gezeichnete SVG-Figuren ersetzt. Die Seite enthält kein Foto und kein `<img>` mehr.
- Worker: Ledger- und Orchestrierungscode für Smart Scan V2 ist enthalten, aber an keinen Endpunkt angebunden. Kein neuer Endpunkt, kein Apify-Aufruf, bezahlter Start weiter HTTP 503.

## Reproduzierbare Prüfung
```bash
node apps/followclean/tests/release-verify.mjs
```
Baut `dist/worker.mjs` und muss mit `GATES_PASSED` enden. Erwartete Hashes für diesen Stand:

| Datei | SHA-256 |
|---|---|
| `index.html` | `e7602b00ab05c96e7717d696ecd20aecfc2c5e0b348fd72959f36176df434df1` |
| `dist/worker.mjs` | `2a5a4b383d0fca5298219eb0f71afe91eb3ce23ede07b40568e9eb56759400b1` |

Weicht ein Hash ab, wurde nach diesem Dokument etwas geändert: nicht deployen, neu prüfen.

## Testergebnisse dieses Stands
| Suite | Ergebnis |
|---|---|
| analysis-budget, apify-adapter, two-actor-v2, instagram-live-worker, smart-scan-v1 | 59/59 |
| apify-v2-ledger-orchestration | 18/18 |
| apify-v2-ledger-hardening | 18/18 |
| chrome-ux-smoke (Chromium, 390×844, Touch) | 19/19 |
| release-verify | 8/8 |
| webkit-smoke (Safari-Engine) | **nicht ausgeführt**: Playwright/WebKit fehlt in der Entwicklungsumgebung |

## Deployment (erst nach Freigabe)
1. Ziel ist ausschließlich der Worker `followclean-mvp-preview`. Die `wrangler.jsonc` im Repository-Stamm gehört zu einem **anderen** Worker (`chatgpt-test`) und darf nicht verwendet werden.
2. Denselben Upload-Weg wie bei V16 nutzen und `dist/worker.mjs` als neue Version hochladen. Bindings und Secrets unverändert übernehmen: D1 `FC_APIFY_BUDGET_DB`, `FC_APIFY_TOKEN`, `FC_IG_SESSION_SECRET`.
3. Neue Version zunächst mit 0 % Traffic anlegen, per Versions-URL prüfen, dann auf 100 % stellen.
4. Keine D1-Migration in diesem Release. `fc_apify_budget_v2_pilot.sql` bleibt unangewendet.

## Abnahme nach dem Deployment
- `GET /` liefert 200 und der SHA-256 des Inhalts ist der `index.html`-Hash oben.
- `POST /api/analysis/start` liefert 503 `paid_provider_not_enabled`.
- `GET /api/analysis/provider/status` meldet Ausführung deaktiviert.
- Auf einem echten iPhone in Safari: ZIP importieren, Profil öffnen, zurückkehren. Erwartet: blaue Rückfrage, Zeile bleibt „Besucht“, Fortschritt unverändert, erst „Ja, erledigt“ färbt grün.
- Seite neu laden und denselben Export mit demselben Kontonamen importieren: Status bleibt erhalten.

## Rollback
V16, Worker-Version `315389f2-6138-4ca2-84a3-14a43b442f5e`, wieder auf 100 % Traffic stellen. Es gibt keine Datenmigration, die zurückgenommen werden müsste. Der lokale Fortschritt der Nutzer bleibt kompatibel, weil die gespeicherten Statuswerte unverändert sind.

## Bekannte Grenzen
- Safari/WebKit ungetestet (siehe oben).
- Versions-ID von V16 stammt aus der Projektdoku vom 14.11. und wurde hier nicht gegen Cloudflare geprüft.

## Release-Protokoll 15.11.2026 (Master Loop V4)

| Schritt | Ergebnis |
|---|---|
| 1. Build, Hashes, Tests aus sauberem Checkout von `8eda8894` reproduziert | **Erfüllt.** Beide Hashes identisch, 59 + 18 + 18 + 19 + 8 Prüfungen bestanden |
| 2. Cloudflare-Ziel, Bindings und V16-Rollback-Version verifiziert | **Nicht nachweisbar.** Kein API-Token, kein Wrangler-Login, `api.cloudflare.com` nicht erreichbar |
| 3. V17 mit 0 % Traffic bereitgestellt | **Nicht ausgeführt** (folgt aus 2) |
| 4. API- und UX-Gates über die Versions-URL | **Nicht ausgeführt** (folgt aus 3) |
| 5. Safari/WebKit-Abnahme | **Nicht ausgeführt.** Playwright/WebKit nicht vorhanden und nicht installierbar |
| 6. Traffic-Umschaltung | **Keine Umschaltung.** Gates 2 bis 5 sind nicht nachgewiesen |

Tatsächliche Preview-Version: unverändert V16 laut Projektdoku vom 14.11. (hier nicht prüfbar).

### Was für die Schritte 2 bis 5 nötig ist
- Entweder ein Cloudflare-Zugang für die Entwicklungssitzung (Connector „Cloudflare Developer Platform“ oder ein auf den Worker `followclean-mvp-preview` beschränktes API-Token mit Workers-Skript-Rechten),
- oder die Ausführung durch eine Instanz mit Zugang. Reihenfolge: Bindings und aktive Version lesen und notieren, `dist/worker.mjs` aus `8eda8894` als neue Version mit 0 % hochladen, Abnahmeliste oben über die Versions-URL prüfen, Safari-Abnahme auf einem echten iPhone, erst dann 100 %.
- Für die Safari-Abnahme genügt ein iPhone mit der Versions-URL und einem echten oder synthetischen Export.

## Nachtrag 15.11.2026, 09:05: Lesezugriff über den Cloudflare-Connector

Der Connector „Cloudflare Developer Platform“ ist jetzt verbunden. Er bietet nur Lesen von Workern sowie D1-, KV-, R2- und Hyperdrive-Verwaltung. **Er hat keine Funktion zum Hochladen einer Worker-Version, zum Anlegen einer 0-%-Version oder zum Umschalten von Traffic.** Die Schritte 3, 4 und 6 bleiben damit unausgeführt.

Nur lesend verifiziert:

| Punkt | Befund |
|---|---|
| Worker `followclean-mvp-preview` | existiert, Skript-ID `0adeba082a9e4aaba5a839cbcdda45ea` |
| D1 mit den FollowClean-Budgettabellen | `chatgpt-test-db`, ID `24bce336-3a04-4517-bd12-c9e713068d58`. **Dieselbe Datenbank ist in der `wrangler.jsonc` des anderen Workers `chatgpt-test` als `DB` gebunden**, wird also von zwei Projekten geteilt |
| Vorhandene FollowClean-Objekte | `fc_apify_budget_reservations_v1` mit zwei Triggern, `fc_apify_token_diagnostics_v1` (bisher undokumentiert) |
| V2-Pilot-Ledger `fc_apify_v2_runs` | nicht vorhanden. Die Migration ist nachweislich nicht angewendet |
| Budgetzeilen | genau eine: `fc-single-actor-20261113`, 0,05 USD reserviert, Zustand `settled`. Deckt sich mit der Vorbelegung im Pilot-Ledger |
| Token-Diagnose vom 13.11. | Apify-Benutzerendpunkt HTTP 403, Actor-Runs HTTP 404. Passt zu einem eingeschränkten Token ohne Rechte auf die beiden Actors |

Nicht verifizierbar mit diesem Connector: die Bindings des Workers, die aktive Versions-ID und damit die tatsächliche V16-Rollback-Version, sowie die Versionsliste. Den Live-Code habe ich nicht abgerufen (rund 400 KB).

Es wurden ausschließlich SELECT-Abfragen ausgeführt. Keine Schreibvorgänge, keine Migration.

### Folgen
- Die spätere Migration `fc_apify_budget_v2_pilot.sql` träfe eine mit einem anderen Projekt geteilte Datenbank. Sie legt nur Objekte mit Präfix `fc_apify_v2`/`tr_fc_apify_v2` an, sollte aber bewusst freigegeben werden.
- Der Connector ist laut eigener Angabe abgekündigt; der Nachfolger ist der Cloudflare-API-MCP-Server unter `https://mcp.cloudflare.com/mcp`. Für das Deployment braucht es diesen, ein Worker-beschränktes API-Token oder eine Instanz mit Wrangler-Zugang.

## Nachtrag 15.11.2026, 09:45: Phase A (Architecture Upgrade V5)
Erneut geprüft: kein Cloudflare-Token, kein Wrangler-Login, `api.cloudflare.com` aus der Sitzung nicht erreichbar, Connector ohne Deploy-Funktion. **V17 bleibt undeployt, keine Traffic-Umschaltung.** Phase B ist getrennt dokumentiert in `D1_ISOLATION_20261115.md`.
