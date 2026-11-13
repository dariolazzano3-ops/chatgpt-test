# Ziegenalarm Online (V5.2)

Browser-Egoshooter mit Online-Minigame **Kuchenkrieg** (1 gegen 1 und 2 gegen 2) und dem kompletten Einzelspieler.
Ein Cloudflare Worker liefert Seite, API und WebSockets unter **einer** HTTPS-Adresse; jeder Raum ist ein Durable Object.

> **Stand:** noch **nicht** auf Cloudflare veröffentlicht. Lokal und mit echtem three.js im Browser getestet,
> der Worker in einer Cloudflare-Emulation. Echte Cloudflare- und Gerätetests: siehe `TESTPLAN.md`.

## Veröffentlichen – ein Klick

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dariolazzano3-ops/chatgpt-test/tree/ziegenalarm-online)

1. Auf den Knopf klicken, bei Cloudflare anmelden (kostenloses Konto reicht).
2. GitHub verbinden lassen, Namen `ziegenalarm-online` übernehmen, **Deploy** drücken.
3. Cloudflare zeigt danach die Adresse, z. B. `https://ziegenalarm-online.<dein-name>.workers.dev`.

Cloudflare legt dabei eine Kopie dieses Codes in deinem GitHub an und baut bei jedem Push neu.
Es wird kein Bezahltarif aktiviert.

### Alternativ per Kommandozeile

```
npm install
npx wrangler login
npm run deploy            # neutrales Gesicht (Standard)
```

`npm run deploy:original` veröffentlicht das Gesicht aus dem Foto. Das braucht `src/face-original.png`
(liegt absichtlich **nicht** in diesem Repo) und die Einwilligung der abgebildeten Person für eine öffentliche Website.

### Nach dem Deploy prüfen

1. `https://…workers.dev/` – Menü erscheint, Einzelspieler zeigt die 3D-Welt.
2. `https://…workers.dev/api/room/AAAAA` – Antwort `{"exists":false}`: Worker und Durable Object laufen.
3. `https://…workers.dev/vendor/three.min.js` – lädt (three.js r128 kommt vom eigenen Server, nicht vom CDN).
4. Zwei Handys: Kuchenkrieg → Raum erstellen → Code auf dem zweiten Gerät. Weiter mit `TESTPLAN.md`.
5. Live-Logs: `npx wrangler tail` oder Dashboard → Workers & Pages → ziegenalarm-online → Logs.

## Aufbau

```
src/game.html                Spielquelle (Einzelspieler + Online-Client), neutrales Gesicht
src/face-neutral.png         erfundenes Zombie-Ziegengesicht
tools/build.mjs              baut public/index.html (--face=neutral|original)
public/vendor/three.min.js   three.js r128, MIT-Lizenz (offizielles Release aus github.com/mrdoob/three.js, Tag r128)
shared/engine.js             Raum-Engine: Codes, Lobby, Teams, Bereit, Start, Ergebnis, Revanche, Wiederbeitritt, Schutz
shared/modes/kuchenkrieg.js  autoritative Simulation (Ziegen, Kuchen, Mauern, Treffer, Granaten, Markt, Sieger)
shared/rules.js              Spielwerte, deterministische Wellen
worker/index.js              Cloudflare Worker + Durable Object RoomDO
dev/server.js                lokaler Server ohne Abhängigkeiten (gleiche Engine)
tools/render-check.mjs       Render-Prüfung gegen eine laufende Seite (lokal oder veröffentlicht)
```

### Cloudflare-Konfiguration (`wrangler.toml`)

| Punkt | Einstellung |
|---|---|
| Worker | eigener Name `ziegenalarm-online`, berührt keine anderen Projekte |
| Einstieg | `worker/index.js`: `default` (Worker) und `RoomDO` (Durable Object) |
| Durable Object | Bindung `ROOMS` → `RoomDO`, Migration `v1` mit `new_sqlite_classes` (Gratis-Tarif) |
| Statische Dateien | `public/`, nur `/api/*` und `/ws/*` laufen durch den Worker (statische Abrufe kostenlos) |
| WebSockets | `wss://…/ws/CODE`, ein Durable Object pro Raumcode |
| API | `GET /api/new?size=1v1|2v2`, `GET /api/room/CODE` |
| Aufräumen | Alarm: leerer Raum nach 15 min gelöscht, nie betretener nach 30 min |
| Sicherheit | nur gleiche Herkunft (Origin), keine Geheimnisse im Code, keine Debug-Endpunkte |
| Logs | `[observability] enabled = true` |

## Lokal starten

```
npm run dev               # baut die Seite und startet http://localhost:8787
```

Test-Schnittstellen gibt es nur mit `DEBUG=1 node dev/server.js`. Für Netztests: `LAG_MS=150 JITTER_MS=60`.

## Server-Autorität und Schutz

- **Treffer** rechnet der Server gegen seine eigenen Ziegenpositionen (Körper-Zylinder, Kopf-Kugel, Mauern). Waffe, Munition, Feuerrate, Nachladen und Schussursprung werden geprüft.
- **Bewegung:** Höchsttempo inklusive Upgrades, Strecke pro Nachricht auf 0,5 s gedeckelt, Arenagrenze, bereinigte Blickwerte.
- **Münzen, Käufe, Punkte, Kills, Sieger:** nur serverseitig. Doppelte Nachrichten über steigende Sequenznummern verworfen.
- **Verbindungen:** gleiche Herkunft, max. 12 Sockets pro Raum, Anmeldung binnen 10 s, Nachrichten bis 4 KB, max. 80/s.
- **Räume:** Token gilt nur im eigenen Raum, zweite Sitzung übernimmt die alte, Fehler im Spielmodus führen zurück in die Lobby statt zum Absturz.

## Netzwerk (gemessen lokal mit 150 ms + bis 60 ms Verzögerung je Richtung)

| Wert | Messung |
|---|---|
| Client → Server | 20/s bei Bewegung, ~4/s im Stillstand (+ Ping alle 2 s) |
| Server → Client | 20 Zustände/s, Ø ~0,7 KB |
| Rechenzeit pro Tick | Ø ~0,2 ms, Spitze ~4 ms (Cloudflare-Limit: 30 s pro Ereignis) |
| Ziegen-Glättung | Interpolation + höchstens 150 ms Vorausberechnung, Ø Abweichung 0,04 m zum Server-Stand |

Keine Rückspul-Treffererkennung: Bei hoher Latenz zielt man auf den Stand von vor ~RTT/2. Ping steht oben in der Statusleiste.

## Kosten und Kontingente (Cloudflare-Doku, November 2026)

Gratis (Workers Free): 100.000 Worker-Anfragen/Tag, 100.000 Durable-Object-Anfragen/Tag (eingehende WebSocket-Nachrichten zählen 20:1),
13.000 GB-s/Tag Laufzeit, statische Dateien unbegrenzt.

- 1 Spieler ≈ 15 Nachrichten/s im Schnitt → ≈ 2.700 Anfragen/Stunde
- 1 gegen 1 ≈ 5.400 Anfragen + 461 GB-s pro Raum-Stunde → **≈ 18 Raum-Stunden/Tag gratis** (≈ 50–100 Partien)
- 2 gegen 2 ≈ 10.800 Anfragen pro Raum-Stunde → **≈ 9 Raum-Stunden/Tag gratis**
- Kontingent erschöpft → neue Verbindungen scheitern bis 00:00 UTC, es entstehen **keine** Kosten.
- Bezahltarif (5 $/Monat, nur nach ausdrücklicher Entscheidung): ≈ 0,007 $ je weitere Raum-Stunde 1 gegen 1.

Verbrauch beobachten: Dashboard → Workers & Pages → ziegenalarm-online → Metrics (Anfragen, CPU) und
Durable Objects → RoomDO (Anfragen, Laufzeit, aktive Objekte = aktive Räume).

## Bekannte Grenzen

- Nicht auf echtem Cloudflare und nicht mit echten Handys über das Internet getestet.
- 3D wurde mit echtem three.js, aber nur in Software-WebGL (Chromium) geprüft, nicht auf Handy-GPUs und nicht in Safari.
- Ziegenkönig nur im Einzelspieler. Gegnerteam nur als Anzeige, nicht in 3D.
- Kein IP-Rate-Limit für `/api/new`; bei Missbrauch eine Rate-Limiting-Regel im Dashboard anlegen.
