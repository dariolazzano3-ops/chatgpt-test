# FollowClean | Export + optionaler Checker V1 | 15.11.2026

Status: **implementiert als kostenfreier Dry-Run, synthetisch getestet. Nicht deployt, keine Oberfläche, kein Apify-Aufruf.** Gehört zu V18, nicht zur V17-Freigabe.

## Prinzip
1. Die vollständige Exportanalyse ist die Datenquelle. Sie liefert die Nicht-Rückfolger **zum Zeitpunkt des Exports**.
2. Optional können diese Treffer in Gruppen zu zehn auf Aktualität geprüft werden. Das Ergebnis ist ein zusätzlicher Hinweis, kein Beweis für den aktuellen Stand.
3. Der Following-Actor mit seinem 20er-Limit wird in diesem Weg nicht gebraucht.

## Ergebnisstufen je Export-Treffer
| Label | Bedeutung |
|---|---|
| `EXPORT_ONLY` | Laut Export Nicht-Rückfolger, nicht live geprüft |
| `EXPORT_AND_LIVE_CHECK_AGREE` | Export und Checker stimmen überein. Zwei Quellen, trotzdem keine Garantie für jetzt |
| `UNCONFIRMED` | Checker meldet Gegenfolge (möglicherweise echte Änderung seit dem Export), liefert nichts Brauchbares oder einen Fehler |

Eine negative Checker-Antwort allein ergibt nie einen Treffer: ohne vollständigen, vom Inhaber gelieferten Export bleibt alles `UNCONFIRMED`.

## Code (Worker-Template, Block `FC_EXPORT_CHECKER_V1`)
- `fcEcDeriveCandidates`: Kandidaten aus Following minus Follower. Unvollständige oder nicht autorisierte Exporte ergeben keine Kandidaten.
- `fcEcNextStep`: nutzt `fcV2NextStep` (jetzt mit einstellbarer Obergrenze). Erste zehn, Stopp bei Übereinstimmung, Fortsetzen auf Wunsch, bereits geprüfte Accounts werden nie erneut gesendet.
- `fcEcReport`: eine Zeile je Export-Treffer mit obigen Labels.
- `fcEcDryRunBatch` und `POST /api/analysis/provider/export-check/plan`: prüft eine Gruppe von 1 bis 10 Namen, nur Pilotkonto, liefert Plan, Idempotenzschlüssel und Ledger-Status. Startet nichts.
- Abrechnungsschutz unverändert über das V2-Ledger: gleiche Gruppe, gleicher Schlüssel, nur eine Reservierung.

## Datenschutz-Zuschnitt
Die Follower-Liste verlässt das Gerät nicht. An den Server ginge je Lauf nur der eigene Kontoname und höchstens zehn Kandidatennamen. Die Zusammenführung mit dem Export gehört deshalb in den Browser; diese Oberfläche ist noch nicht gebaut.

## Offen vor echter Ausführung
Unverändert `LIVE_PREREQUISITES_20261115.md` und `APIFY_OPEN_QUESTIONS_20261115.md`: Preise, Mindestkosten, Token-Rechte, Schemas, D1-Migration, rechtliche Prüfung. Zusätzlich: Woran erkennt der Export-Parser zuverlässig, dass alle Follower-Teile gelesen wurden (`complete`)?

## Tests
`node apps/followclean/tests/export-checker-v1-smoke.mjs`: 19/19, davon drei gegen den gebauten Worker im Prozess.
