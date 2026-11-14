# Ziegenalarm Online (V6.1 „Kuchenkrieg Revolution“, Entwicklungsstand)

Browser-Egoshooter mit zwei Online-Modi – **Kuchenkrieg** und **GOAT ROYALE** (je 1 gegen 1 und 2 gegen 2) – und dem kompletten Einzelspieler.

> **Branches:** `ziegenalarm-online` = Produktion (Push löst bei verbundenem Cloudflare-Build einen Live-Deploy aus).
> `ziegenalarm-v6-dev` = V6-Entwicklung, `ziegenalarm-v6-1-kuchenkrieg-revolution` = V6.1. Erst nach geprüfter Freigabe in die Produktion übernehmen.

## Staging (gefahrlos testen, Produktion bleibt unberührt)

Cloudflare erzeugt für Worker mit Durable Objects **keine** Preview-URLs. Darum gibt es einen eigenen Staging-Worker
mit eigenem Namen, eigenen Räumen und eigener Adresse:

```
git checkout ziegenalarm-v6-1-kuchenkrieg-revolution
npm install
npx wrangler login
npm run deploy:staging     # → https://ziegenalarm-staging.<konto>.workers.dev
```

Löschen: `npx wrangler delete --name ziegenalarm-staging`. Kosten: gleiches Gratis-Kontingent wie die Produktion.

## Kuchenkrieg (V6.1): gemeinsame Arena

- **Eine Arena** (Ellipse 48 × 64 m), zwei Kuchenfestungen gegenüber: Käse im Süden, Beere im Norden. Jeder sieht alle Spieler, die gegnerische Festung, deren Kuchen und Mauern in 3D.
- **Zwei Fronten:** Jede Festung wird von ihren eigenen Zombie-Ziegen-Wellen von außen angegriffen. Wer den eigenen Kuchen verliert, verliert – PvP ist Beiwerk, die Kuchenverteidigung entscheidet.
- **PvP:** 100 Leben, Kopftreffer ×1,5, begrenzte Reichweiten je Waffe (Schrot 20 m … Präzisionsgewehr 120 m), Deckungen blocken. Kein Teamschaden. Abschuss = +20 Münzen und 30 Punkte fürs Team.
  Tod → 4 s Wartezeit, Respawn im **eigenen** Fort an der vom Gegner am weitesten entfernten Stelle, dazu 3 s Schutz (endet beim eigenen Schuss) – gegen Spawn-Camping.
  Treffer prüft ausschließlich der Server (Strahl gegen Kopf-Kugel und Körper-Zylinder, Deckungen, Mauern, Ziegen). Gleichzeitige Abschüsse im selben Server-Takt zählen beide.
- **5 Wellen:** 1 Der Angriff · 2 Die Herde · 3 Werwolf-Chaos · 4 Großangriff (roter Nebel) · 5 Ziegenkönig. 8 s Kaufphase, Welle endet sofort mit der letzten Ziege.
- **Ziegenkönig** (Welle 5, je Festung): Sturmangriff (rote Bahn 1 s vorher), Stampfer (roter Ring 0,8 s vorher, 4,5 m), ruft bei 50 % vier Zicklein. Schwachstellen: Krone/Kopf ×2,5, nach dem Sturm 2,2 s erschöpft (×2).
- **Sieg:** nur ein Kuchen steht → dieses Team. Beide fallen im selben Takt → mehr Restkuchen, sonst Punkte. Beide überleben Welle 5 → mehr Kuchen (Abstand > 0,5 %), dann Punkte, dann Unentschieden.
- **Koop:** Größe „Koop“ – zwei Freunde in einem Team gegen die Wellen, ohne PvP. Sieg = Kuchen überlebt Welle 5.
- **Werwolf** (Markt oder Taste `B`, ab Welle 3): 60 Münzen, höchstens 2 pro Team gleichzeitig, 30 s im Einsatz, 15 s Abklingzeit, 50 Leben (Gegner können ihn erschießen).
  Server-KI: jagt zuerst die Ziegen am nächsten zum eigenen Kuchen, sonst eindringende Gegner (Biss 18), läuft sonst Patrouille.
- **Boost-Sprung:** Tippen = normaler Sprung. Halten (Leertaste oder Sprungknopf) = Raketenschub bis ca. 5 m, danach Gleitlandung, 6 s Abklingzeit, Ladebalken unten. Der Server begrenzt Höhe, Steigrate und Abklingzeit.
- Matchdauer: rechnerisch 3,5–4 min (1v1) bzw. ≈ 4,2 min (2v2) bei durchschnittlicher Trefferleistung; echte Runden mit PvP-Ablenkung länger. **Nicht mit echten Spielern gemessen.**

## Auf den Home-Bildschirm (PWA)

`public/manifest.webmanifest` + Icons (`python3 tools/icons.py`), iOS-Angaben im Kopf von `public/index.html` (Build).
iPhone: Safari → **Teilen → Zum Home-Bildschirm** → Start ohne Safari-Leiste im Querformat. In Safari zeigt das Menü einmalig einen wegklickbaren Hinweis.
Absichtlich **kein Service Worker**: Updates kommen immer sofort an, nichts Veraltetes im Cache. (Offline spielen geht ohnehin nicht – es ist ein Online-Spiel.)

## GOAT ROYALE

- Runde Schwebeinsel (Radius 16 m, schrumpft ab 1:15 innerhalb einer Minute auf 9 m). Jeder hat **3 Leben**, 4 Minuten Zeit.
- Treffer erhöhen die **Wucht** (%). Je höher die Wucht, desto weiter fliegt man. Wer von der Insel fällt, verliert ein Leben und kommt mit 2,5 s Schutz und 0 % zurück.
- Waffen: Blaster (schnell, wenig Rückstoß), Schrotflinte (stark aus der Nähe), Präzisionsgewehr (langsam, sehr starker Stoß).
- **Reiten:** `E` bzw. Reiten-Knopf neben einer neutralen Ziege. Treffer werfen Reiter ab.
- **Dreikopf-Verwandlung:** 10 s am Stück reiten → Kampfziege in Teamfarbe mit drei Köpfen. Sie läuft **rückwärts** auf den nächsten Gegner zu, holt sichtbar aus (rote Zone, 0,9 s) und tritt mit den Hinterbeinen. Ausweichen ist möglich. Höchstens eine pro Team; abschießbar (24 Treffer-Punkte), erschöpft nach 20 s.
- **Sieg:** letztes Team auf der Insel; bei Zeitablauf mehr Leben, dann mehr Ring-outs, dann weniger Wucht.

## Fortschritt (nur im Browser gespeichert, kein Konto)

- XP für Matches, Siege, Wellen, Abschüsse, Ring-outs und Verwandlungen. Ränge: Anfänger, Ziegenjäger (500), Herdenmeister (2000), Ziegenlegende (6000).
- 7 Herausforderungen ohne Zeitdruck, Belohnung jeweils ein Waffen-Skin; Rang-Skins für Ziegenjäger, Herdenmeister, Ziegenlegende.
- Statistiken: Matches, Siege, Niederlagen, Abschüsse, Ring-outs, Kampfziegen, beste Welle, Spielzeit, Lieblingsmodus.
- Einstellungen: Grafik (Auto/Hoch/Mittel/Niedrig, Auto senkt bei unter 28 Bildern/s), Lautstärke, Musik.
- Keine Echtgeldkäufe, keine spielerischen Vorteile durch Skins.
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
shared/modes/royale.js       GOAT ROYALE: Wucht, Rückstoß, Absturz, Reiten, Kampfziege, schrumpfende Insel, Sieger
shared/modes/index.js        Liste aller Online-Modi
tests/royale-sim.mjs         Regeltests für GOAT ROYALE ohne Browser (npm test)
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

- V6.1 ist **nicht** auf Cloudflare (auch nicht Staging) und **nicht** mit echten Handys bzw. echtem iPhone-Safari getestet. Die Worker-Logik ist nur emuliert.
- 3D mit echtem three.js nur in Software-WebGL (Chromium) geprüft, nicht auf Handy-GPUs.
- PWA: Manifest, Icons und Hinweis sind geprüft (Chromium mit iPhone-Kennung). Ob iOS die Web-App wirklich im Querformat ohne Leiste startet, ist offen.
- Keine Rückspul-Treffererkennung: bei hoher Latenz trifft man bewegte Gegner schwerer (Kuchenkrieg und GOAT ROYALE).
- Matchdauer und Balance sind nur simuliert, nicht mit echten Spielern ausbalanciert.
- Fortschritt liegt nur im Browser (localStorage); keine Bestenliste.
- Ziegen-Duell, Käseklau, Ziegenchaos sind weiter als „Demnächst“ markiert.
- Kein IP-Rate-Limit für `/api/new`; bei Missbrauch eine Rate-Limiting-Regel im Dashboard anlegen.
