# FollowClean – Release-Prozess V6 (V17 / V17.1 / V18-Kandidat)

Stand 2026-11-15. Cloudflare-Release liegt bei ChatGPT (Release-Owner). Claude: GitHub, Code, Tests, Artefakte.
Nichts hiervon wurde von Claude deployt. Keine Traffic-Umschaltung. Keine Apify-Aufrufe. Kein Token erzeugt.

## 1. Artefakte und Beziehung
V18-Kandidat ⊃ V17.1 ⊃ V17.

| Release | Quelle | worker.mjs sha256 | index.html sha256 | Status |
|---|---|---|---|---|
| V17 | 8eda8894dee0e79172fa0ec0dee53e1c50c8a739 | 2a5a4b383d0fca5298219eb0f71afe91eb3ce23ede07b40568e9eb56759400b1 | e7602b00…434df1 | reproduziert, Artefakt + Manifest |
| V17.1 | aefb0aaed8c8edd469303ae987b53b3a3731213d (Hotfix-Branch) | e22c5ee0f3602f87f9ee4f1368a629f257651913b7762c2fda2118a1473f68b8 | 8980157ab62f72c901e3e7b2312b76f4210711aa9bb773a0010d3c7d1c2cdcec | reproduziert, Hashes = ChatGPT |
| V18-Kandidat | 5500edb13dd6306bf32f8e670b43ca3ef228f9f8 (+ Test-Commit) | 73a0fcbc742b799e8eafc232ffefd637ef970568600e74b92e5c23d85d306709 | 462f99a38d256ccbc88a404b0c87cb3b6246d54e742bdfa895eda02d658bc93a | Kandidat, nicht freigegeben |

V17 enthält keine V18-Änderungen (Export+Checker-Endpunkt fehlt dort). Manifeste: `release/<name>/manifest.json`.
Cloudflare-Stand laut Release-Owner: V17.1 = Version 67 `5c754246-0a46-4615-85e9-21ef04153be6`, Rollback V16 `315389f2-6138-4ca2-84a3-14a43b442f5e`.

## 2. Testergebnisse (Branch-Head, synthetisch/lokal)
analysis-budget 9, apify-adapter 14, two-actor-smartscan 17, instagram-live-worker 8, smart-scan-v1 11, ledger-orchestration 18, ledger-hardening 18, export-checker 23, chrome-ux 19 (Chromium 390×844), release-verify 10 – alle bestanden. V17.1 aus Hotfix-Branch: 9 Suiten bestanden.
Nicht getestet: Safari/WebKit/echtes iPhone (hier nicht ausführbar), Last über Worker-Binding auf echter D1, jeder Live-Apify-Lauf.

## 3. Unveränderte Sicherheitsgrenzen
- `FC_PROVIDER_EXECUTION_ENABLED=false`, `/api/analysis/start` → 503 `paid_provider_not_enabled`; kein Apify-`fetch` im Bundle.
- Testbudget: 0,05 USD verbucht, 0,15 USD übrig (max. 3 Läufe à 0,05). Keine bezahlten Läufe ohne Freigabe.
- Keine Echtgeldzahlung (Stripe nur Testmodus). Secrets nur serverseitig, unverändert. Andere Worker/Projekte unberührt.

## 4. Deploy-Schritte für den Release-Owner
**V17.1 (kein DB-Wechsel):**
1. `sha256sum release/v17.1/worker.mjs` = e22c5ee0…f68b8 prüfen.
2. Version hochladen ohne Traffic; Bindings (`FC_APIFY_BUDGET_DB`→chatgpt-test-db, 2 Secrets) unverändert.
3. Versions-URL-Gates: release-verify-Punkte, `/api/analysis/start`=503, besuchtes Profil wird grün ohne Popup.
4. iPhone-Safari-Abnahme durch Rio vor 100 %. Rollback: V16-Version.

**V18 (zwei getrennte Schritte):**
- Schritt A – Code: V18-Worker mit unverändertem Binding hochladen (0 %). Gate: `POST provider/export-check/plan` liefert Dry-Run, `/api/analysis/start` bleibt 503. Dann erst schrittweise Traffic (Freigabe nötig).
- Schritt B – Binding-Wechsel (eigener Release, eigene Freigabe): `FC_APIFY_BUDGET_DB` → `followclean-db` `28194058-2779-4b6d-ab81-b38459d5f6a8`. Abnahme: `ledger.ok=true`, committedUsd 0.05, remainingUsd 0.15, startableRuns 3, Start bleibt 503. Rollback: vorherige Version (alte DB `chatgpt-test-db` bleibt unberührt, nichts gelöscht). Details: `D1_ISOLATION_20261115.md`.

## 5. Dauerhafter Deployment-Prozess (Entwurf, NICHT aktiviert)
Es existiert kein aktiver FollowClean-Deploy-Workflow; vorhandene Repo-Workflows nutzen `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` für andere Projekte. Vorschlag:
1. **Neuer Workflow** `followclean-release.yml`, nur `workflow_dispatch`, Eingaben: `release` (v17.1|v18), `mode` (default `verify-only`).
2. **Job verify** (ohne Secrets): Checkout des Quell-Commits laut Manifest, Build, alle Suiten, Hash-Vergleich mit `release/<x>/manifest.json`. Schlägt bei Abweichung fehl.
3. **Job upload** (`environment: followclean-staging`, Reviewer = Rio): `wrangler versions upload` mit `--tag`/`--message`, **0 % Traffic**; nur wenn `mode=upload`.
4. **Job deploy** (`environment: followclean-production`, erforderlicher Reviewer): `wrangler versions deploy` mit Prozentangabe als Eingabe; nur nach ausdrücklicher Freigabe, niemals automatisch durch Push.
5. **Token (von Rio zu erzeugen, nicht von Claude):** Account-scoped, Berechtigung Workers Scripts: Edit (Version-Upload/Deploy/Rollback reicht Editor für diesen Worker), auf diesen Account beschränkt, kein D1-Edit, kein Secrets-Zugriff, kein Zonen-/DNS-Recht; als Environment-Secret `FOLLOWCLEAN_CF_TOKEN` (nicht Repo-weit), mit Ablaufdatum. Binding-Wechsel (D1) nur über Wrangler-Config im reviewten Commit, nie per Eingabefeld.
6. Guards: Worker-Name fest `followclean-mvp-preview`; Workflow bricht ab, wenn Bundle ein `fetch` zu Apify enthält oder `FC_PROVIDER_EXECUTION_ENABLED` nicht `false` ist.
Der Workflow wird erst angelegt, wenn Rio/ChatGPT den Entwurf freigeben.

## 6. Offene Freigaben/Blocker
iPhone-Safari-Abnahme; 100-%-Entscheidung V17.1; V18 Schritt A/B; Apify-Konsolenfakten (neun Punkte); Rechts-/ToS-Prüfung vor produktivem Scraping; Parser-Kriterium „Export vollständig“; später Aufräumen alter FollowClean-Tabellen in `chatgpt-test-db` (separate Freigabe).
