# Ziegenalarm Online (V7 „Der große Käsekuchen-Raub“, Entwicklungsstand)

Browser-Egoshooter mit zwei Online-Modi – **Kuchenkrieg** und **GOAT ROYALE** (je 1 gegen 1 und 2 gegen 2) – und dem kompletten Einzelspieler.

> **Branches:** `ziegenalarm-online` = Produktion (Push löst bei verbundenem Cloudflare-Build einen Live-Deploy aus).
> `ziegenalarm-v6-dev` = V6-Entwicklung, `ziegenalarm-v6-1-kuchenkrieg-revolution` = V6.1, `ziegenalarm-v7-cheesecake-heist` = V7. Erst nach geprüfter Freigabe in die Produktion übernehmen.

## Staging (gefahrlos testen, Produktion bleibt unberührt)

Cloudflare erzeugt für Worker mit Durable Objects **keine** Preview-URLs. Darum gibt es einen eigenen Staging-Worker
mit eigenem Namen, eigenen Räumen und eigener Adresse:

```
git checkout ziegenalarm-v7-cheesecake-heist
npm install
npx wrangler login
npm run deploy:staging     # → https://ziegenalarm-staging.<konto>.workers.dev
```

Löschen: `npx wrangler delete --name ziegenalarm-staging`. Kosten: gleiches Gratis-Kontingent wie die Produktion.

## Kuchenkrieg V7: Der große Käsekuchen-Raub (asymmetrisch)

**Team Verteidiger** schützt den Käsekuchen in der Festung acht Wellen lang gegen Zombie-Ziegen – und gegen einen versteckten Gegenspieler.
**Team Schafe** steckt in einem Schaf mitten in einer Herde computergesteuerter Schafe, stiehlt den Kuchen und bringt ihn zur Omi.
1 gegen 1 oder 2 gegen 2 (Team 1 = Verteidiger, Team 2 = Schafe; „Team wechseln“ in der Lobby).

- **Tarnung:** Der Schafspieler sieht aus wie jedes andere Schaf – einziger Unterschied ist ein kleiner **schwarzer Schwanz**.
  Der Server überträgt ihn dem Verteidiger nur aus der Nähe (17 m, mit Aussichtsturm 32 m) und nie bei aktivem Tarnpuder. Kein Namensschild, keine Markierung, keine Minimap.
  Alle Schafe stehen in einer gemischten, sortierten Liste mit zufälligen IDs; nach jedem Tod bekommt der Schafspieler eine neue.
- **Die Herde:** grast, wandert, flieht vor Zombies. Ein Schaf greift **nur** an, wenn ein Verteidiger 0,7 s direkt mit der Waffe darauf zielt
  (Winkel, Reichweite 24 m, Sichtlinie) oder darauf schießt – erst Warnung (Kopf senken, Scharren), dann Rammen (12 Schaden). Kein Angriff von hinten.
  Ein unschuldiges Schaf zu erschießen kostet 5 Münzen.
- **Schaf-Steuerung:** Third-Person. Laufen, Sprint (Shift), Sprung (Holzmauern), Halten an einer Mauer = langsam klettern (auch Stahl),
  Kopfstoß (Klick/F; trifft Verteidiger, Werwölfe, Bauwerke, Mauern – verrät dich 4 s), E halten = Kuchen schnappen (1 s), E = ablegen,
  1–6 = Gegenstände, V/X = grasen/stampfen (zum Nachahmen der Herde), T = Schaf-Markt.
- **Schafleben:** Welle n = n Leben (Welle 1: 1 … Welle 8: 8), nicht kaufbar. Tod = ein Leben weg, Respawn in der Herde (2 s Schutz).
  Bei 0 Leben warten bis zur nächsten Welle; in Welle 8 scheidet man aus.
- **Kuchenraub:** Aufnahme dauert 1 s (Server zählt). Ein aktiver Schild fällt beim Aufnehmen ab (keine Erstattung, nicht wieder aktivierbar).
  Mit Kuchen: langsamer (≈ 3,5 m/s), kein Sprint, kein Tempo-Item, nur kleine Sprünge, Klettern halb so schnell. Stirbt das Schaf, fällt der Kuchen
  ins Gras; Verteidiger bringen ihn durch Berühren zurück (sonst automatisch nach 25 s). Liegt er, kann er erneut gestohlen werden.
- **Sieg:** Kuchen bei der Omi → Schafe gewinnen sofort. Kuchen von Zombies aufgefressen → Schafe gewinnen. Alle 8 Wellen überstanden → Verteidiger gewinnen.
  Ist bei Ende von Welle 8 der Kuchen unterwegs: 20 s Nachspielzeit (abgeliefert → Schafe; fallen gelassen oder Zeit um → Verteidiger).
  Gleichzeitig: Ablieferung gewinnt (ein getragener Kuchen kann nicht gefressen werden). Verlässt ein Team das Spiel, gewinnt das andere.
- **8 Wellen:** Die ersten Ziegen · Die Herde erwacht · Werwolf-Alarm · Belagerung · Nacht der Zombies (dunkel) · Die Festung bebt ·
  Der Ziegenkönig (Sturm, Stampfer, Zicklein; Krone ×2,5, erschöpft ×2; +60 Münzen) · **Die Zombie-Apokalypse: exakt 100 Ziegen gleichzeitig von allen Seiten.**
  10 s Pause mit Markt zwischen den Wellen, eine Welle endet sofort mit der letzten Ziege.
- **Verteidiger-Markt (T oder Knopf „Markt“, jederzeit):** Holz-/Stein-/Stahlmauern, Reparatur, Tore (nur Verteidiger und Werwölfe kommen durch),
  Verteidigungstürme (Armbrust), automatische Geschütze, Stachelfallen, Explosivfallen, Aussichtsturm, Wachglocke, Munitionsstation,
  Werwolf, Reparaturhelfer, Waffen, Schaden, Feuerrate, Magazin, Nachladen, Granaten, Lauftempo, Boost-Feder, Reparatur-Profi, Kuchen flicken.
  Vieles wird erst in späteren Wellen freigeschaltet.
- **Werwölfe:** 60 Münzen, max. 2 gleichzeitig, max. 3 pro Welle, 30 s, 15 s Abklingzeit, 50 Leben. An den Kuchen gebunden (9 m),
  springen über Mauern, beißen Zombies und **aufgeflogene** Schafe (nach Kampf, mit Kuchen oder in der Festung) – nie durch hohe Mauern.
- **Schaf-Markt:** Schutzschild (40), Sprungfeder (dauerhaft, über Steinmauern), Tempo, Rauchbombe, Ablenkungs-Schaf (läuft mit schwarzem Schwanz davon),
  Tarnpuder (Schwanz wirkt 12 s hell), Heilkraut. Münzen: Start 40, +20 pro Welle, +1 alle 3 s, +6 pro Kopfstoß-Treffer.
- **Die Omi:** sitzt im Norden auf ihrem Sessel (Häkeldecke, Brille, Gehstock, Kaffeetisch), kommentiert Tod, Diebstahl, Verlust, Ankunft, Sieg, Niederlage.
  Stimme über die Sprachausgabe des Geräts (keine Audiodateien, keine Kosten), immer mit Sprechblase und Untertitel. Mindestens 6–10 s zwischen normalen
  Sprüchen, wichtige Ereignisse haben Vorrang, nichts überlappt. **Profil → Einstellungen:** Omi-Stimme an/aus, eigene Lautstärke.
- **Anvisieren (ADS) gibt es nicht mehr** – in keinem Modus: kein Visier-Knopf, keine rechte Maustaste, kein Zoom, kein Zielfernrohr.
- **Leistung im Finale:** volle Ziegenmodelle nur für die nächsten 26 Ziegen, alle übrigen als einfache, instanzierte Modelle (1 Draw Call).
  Server: Raster für die Kollision, Ziegen-Daten kompakt (Ganzzahlen) und bei mehr als 40 Ziegen nur jeden zweiten Takt.

## V7.1: Alleine spielen gegen KI

- **Menü Kuchenkrieg → Alleine spielen:** *Als Verteidiger* oder *Als Schaf*, Schwierigkeit *Leicht / Mittel (Standard) / Schwer*, **Solo starten**.
  Kein Code, kein Freund, kein Warten: der Server legt einen Solo-Raum mit KI-Gegner an und startet sofort. Gleiche Karte, Regeln, Märkte, 8 Wellen,
  Omi und Siegbedingungen wie im Mehrspieler. Ergebnis → **Revanche (sofort)** oder **Neu starten …** (andere Rolle/Schwierigkeit).
- **Mit Freunden spielen:** wie bisher (1 gegen 1, 2 gegen 2). Freie Plätze lassen sich in der Lobby mit **+ KI** füllen (mit × wieder entfernen);
  KI-Spieler heißen immer „KI · Schaf/Wächter (Stufe)“, Kapazität und Teamgrößen bleiben unverändert.
- **Die KI ist ein normaler Teilnehmer auf dem Server** (`shared/bots.js`): sie schickt dieselben Nachrichten wie ein Mensch (`in`, `fire`, `buy`, `grab`,
  `melee`, `use` …) und durchläuft dieselbe Prüfung (Tempo, Mauern, Klettern, Münzen, Abklingzeiten). Entscheidungen 10× pro Sekunde, Bewegung 20×, rund 0,04 ms je Takt.
- **Fair:** Der KI-Wächter sieht nur, was `perceive()` liefert – Sichtkegel, Sichtweite, Mauern und Rauch verdecken, schwarzer Schwanz nur aus der Nähe,
  keine Spieler-Identität. Verliert er ein Schaf aus den Augen, kann er es zwischen gleich aussehenden Schafen nicht wiedererkennen. Menschliche Reaktionszeit,
  begrenzte Drehgeschwindigkeit, Streuung (im Laufen größer). Das KI-Schaf hat dieselben Leben, Münzen, Gegenstände und Kletterregeln.
- **KI-Schaf** (Zustände GRAZE → OBSERVE → PLAN → APPROACH → INFILTRATE → STEAL → ESCAPE → DELIVER, dazu FLEE, SABOTAGE, WAIT): grast wie die Herde,
  beobachtet, wählt die Seite mit dem geringsten Risiko, wartet auf eine Lücke (Wächter abgelenkt, Türme mit Ziegen beschäftigt), springt/klettert regelkonform,
  springt über Stacheln, Rauch/Schild/Köder/Tempo je nach Stufe, wählt den Fluchtweg per Wettlauf-Schätzung, taucht nach Treffern in der Herde unter.
- **KI-Wächter** (GUARD / FIGHT / HUNT / CHASE / RETURN): schießt Ziegen von den Zinnen, baut und repariert, kauft Türme (Obergrenze je Stufe), Stacheln, Waffen,
  Werwölfe; Verdacht aus sichtbaren Hinweisen; verfolgt den Dieb (Leicht/Mittel nur, wenn er nah ist), holt den Kuchen zurück, steht vor der Zwickmühle Ziegen vs. Dieb.
- **Regeländerung für die Balance:** Klettern mit Kuchen 0,8× statt 0,5× (Server und Client) – sonst war ein Diebstahl gegen einen aufmerksamen Wächter praktisch chancenlos.

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

Seit V7 werden öffentliche Builds **nur mit dem neutralen, erfundenen Gesicht** gebaut. Es gibt kein Deploy-Skript für das Originalfoto mehr;
`tools/build.mjs --face=original` bricht ab (nur lokal mit `ZIEGENALARM_PRIVATE_FACE=1`), und `src/face-original.png` liegt nicht im Repo.

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
- **Käsekuchen-Raub (V7):** Rollen, Schaf-Identität (keine Position des Schafspielers in der Spielerliste der Verteidiger, Schwanzfarbe nur aus der Nähe),
  Herden-KI, Schafleben (keine Nachricht kann sie setzen), Mauerüberquerung nur oberhalb der Mauerkante (Sprung/Klettern mit begrenzter Steiggeschwindigkeit),
  Kuchenbesitz (genau ein Träger, Aufnahmezeit serverseitig, kein Schild mit Kuchen), Ablieferung, Bauwerke, Werwölfe, Kopfstoß (Reichweite, Richtung, Abklingzeit), Schaf-Items.
- **Verbindungen:** gleiche Herkunft, max. 12 Sockets pro Raum, Anmeldung binnen 10 s, Nachrichten bis 4 KB, max. 80/s.
- **Räume:** Token gilt nur im eigenen Raum, zweite Sitzung übernimmt die alte, Fehler im Spielmodus führen zurück in die Lobby statt zum Absturz.

## Netzwerk (gemessen lokal mit 150 ms + bis 60 ms Verzögerung je Richtung)

| Wert | Messung |
|---|---|
| Client → Server | 20/s bei Bewegung, ~4/s im Stillstand (+ Ping alle 2 s) |
| Server → Client | 20 Zustände/s; Käsekuchen-Raub Ø ~1,5 KB, Finale (100 Ziegen) Ø ~2,7 KB, Ziegen dann nur jeden 2. Takt |
| Rechenzeit pro Tick | Ø ~0,2 ms, Finale Ø ~0,5 ms, Spitze ~4,6 ms (Cloudflare-Limit: 30 s pro Ereignis) |
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

- V7 ist **nicht** auf Cloudflare (auch nicht Staging) und **nicht** mit echten Handys bzw. echtem iPhone-Safari getestet. Die Worker-Logik ist nur emuliert.
- Bildrate im Finale auf echten Smartphones ist **ungemessen** (nur Software-WebGL).
- Die Omi-Stimme hängt von der Sprachausgabe des Geräts ab (Stimme und Qualität je nach System); ohne deutsche Stimme bleiben Sprechblase und Untertitel.
- 3D mit echtem three.js nur in Software-WebGL (Chromium) geprüft, nicht auf Handy-GPUs.
- PWA: Manifest, Icons und Hinweis sind geprüft (Chromium mit iPhone-Kennung). Ob iOS die Web-App wirklich im Querformat ohne Leiste startet, ist offen.
- Keine Rückspul-Treffererkennung: bei hoher Latenz trifft man bewegte Gegner schwerer (Kuchenkrieg und GOAT ROYALE).
- Matchdauer und Balance (Schaf gegen Verteidiger) sind nur simuliert, nicht mit echten Spielern ausbalanciert.
- Kuchenkrieg V6.1 (zwei Festungen, PvP) wurde durch V7 ersetzt; der Stand liegt im Branch `ziegenalarm-v6-1-kuchenkrieg-revolution`.
- Fortschritt liegt nur im Browser (localStorage); keine Bestenliste.
- Ziegen-Duell, Käseklau, Ziegenchaos sind weiter als „Demnächst“ markiert.
- Kein IP-Rate-Limit für `/api/new`; bei Missbrauch eine Rate-Limiting-Regel im Dashboard anlegen.
