# FollowClean | Release-Kandidat V17 für die bestehende Preview | 15.11.2026

Status: **vorbereitet, nicht deployt.** Deployment nur nach ausdrücklicher Freigabe.

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
