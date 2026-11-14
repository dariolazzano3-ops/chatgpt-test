// Reine Server-Simulation von GOAT ROYALE (ohne Browser): Regeln, Rückstoß, Absturz, Reiten, Verwandlung, Tritt, Sieg.
import { Room } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';
import { ROYALE } from '../shared/modes/royale.js';
const res = []; const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); res.push(l); console.log(l); };
const mk = () => ({ out: [], closed: false, send(t) { this.out.push(JSON.parse(t)); }, close() { this.closed = true; } });
function setup(size = '1v1') {
  const r = new Room({ code: 'RRRRR', mode: 'royale', size, seed: 42 }, MODES); const cs = [];
  const n = size === '1v1' ? 2 : 4; for (let i = 0; i < n; i++) { const c = mk(); r.open(c); r.message(c, JSON.stringify({ t: 'hello', name: 'P' + i })); cs.push(c); }
  for (const c of cs) r.message(c, '{"t":"ready","v":true}');
  for (let i = 0; i < 70; i++) r.tick(0.05); // Lobby-Countdown 3 s
  for (let i = 0; i < 70; i++) r.tick(0.05); // Spiel-Countdown 3 s
  return { r, cs, m: r.match };
}
const last = (c, t) => c.out.filter(m => m.t === t).pop();
let seq = 1000; const send = (r, c, o) => r.message(c, JSON.stringify({ seq: ++seq, ...o }));
{ const { r, cs, m } = setup();
  check('Raum im Modus royale, Spiel läuft', r.state === 'match' && m.phase === 'play', `${r.state}/${m.phase}`);
  const s = last(cs[0], 'snap'); check('Snapshot: Arena, Spieler mit 3 Leben, 3 Ziegen', s.mode === 'royale' && s.arenaR === ROYALE.R0 && s.players.every(p => p.lives === 3) && s.goats.length === 3);
  const [a, b] = [...m.players.values()];
  // Treffer: A schießt auf B
  a.prot = b.prot = 0; a.x = -3; a.z = 0; b.x = 3; b.z = 0;
  const shoot = (w) => send(r, cs[0], { t: 'shot', w, o: [a.x, 1.6, a.z], d: [1, 0, 0] });
  shoot('blaster'); r.tick(0.05);
  check('Treffer erhöht Wucht und stößt zurück', b.wucht > 0 && b.kbT > 0 && b.vx > 0, `Wucht ${b.wucht}, vx ${b.vx.toFixed(2)}`);
  for (let i = 0; i < 10; i++) r.tick(0.05);
  check('Rückstoß bewegt den Spieler serverseitig', b.x > 3.3, `x ${b.x.toFixed(2)}`);
  // Eingaben während Rückstoß werden ignoriert
  b.kbT = 0.3; const bx = b.x; send(r, cs[1], { t: 'in', x: 0, z: 0, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.01);
  check('Während Rückstoß zählt die Client-Position nicht', Math.abs(b.x - bx) < 0.2);
  b.kbT = 0; b.vx = b.vz = 0;
  // Wucht steigert Rückstoß
  b.wucht = 0; b.vx = 0; knockTest: { a.lastShot = {}; m.time += 2; shoot('sniper'); const v1 = Math.abs(b.vx); b.vx = 0; b.kbT = 0; b.wucht = 150; m.time += 2; shoot('sniper'); const v2 = Math.abs(b.vx);
    check('Mehr Wucht = mehr Rückstoß (Präzisionsgewehr)', v2 > v1 * 1.8, `${v1.toFixed(1)} → ${v2.toFixed(1)}`); }
  b.vx = 0; b.kbT = 0;
  // Absturz
  b.x = ROYALE.R0 + 1; r.tick(0.05);
  check('Über den Rand = Absturz, ein Leben weniger, KO für den Schützen', b.lives === 2 && b.fallT > 0 && a.kos === 1, `Leben ${b.lives}, KOs ${a.kos}`);
  for (let i = 0; i < 60; i++) r.tick(0.05);
  { const cs0 = b.cseq; const bx0 = b.x; send(r, cs[1], { t: 'in', c: cs0 - 1, x: 30, z: 0, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.01);
    check('Veraltete Position (vor der Server-Korrektur) wird ignoriert', Math.abs(b.x - bx0) < 1e-6 && b.lives === 2);
    send(r, cs[1], { t: 'in', c: cs0, x: bx0 + 0.3, z: b.z, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.01);
    check('Nach Bestätigung der Korrektur zählt die Position wieder', Math.abs(b.x - (bx0 + 0.3)) < 1e-6); }
  check('Wiederbelebung mit Schutz und Wucht 0', b.fallT === 0 && b.prot > 0 && b.wucht === 0 && Math.hypot(b.x, b.z) < ROYALE.R0);
  b.x = 3; b.z = 0; a.x = -3; a.z = 0; const w0 = b.wucht; a.lastShot = {}; m.time += 2; cs[0].out = []; shoot('blaster'); r.tick(0.01);
  check('Schutz nach Wiederbelebung blockt Treffer', b.wucht === w0 && cs[0].out.some(x => x.t === 'snap' && x.ev.some(e => e.k === 'shield')));
  // Kein Eigenbeschuss: Team-Check (1v1 trivial) – siehe 2v2 unten
  // Reiten
  const g = m.goats[0]; g.x = a.x + 1; g.z = a.z; g.state = 'free';
  send(r, cs[0], { t: 'mount' }); r.tick(0.05);
  check('Aufsteigen auf neutrale Ziege in Reichweite', a.mount === g.id && g.state === 'ridden');
  send(r, cs[0], { t: 'in', x: a.x + 0.5, z: a.z, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05);
  check('Ziege folgt dem Reiter', Math.abs(g.x - a.x) < 1e-6);
  const g2 = m.goats[1]; g2.x = 50; send(r, cs[1], { t: 'mount' }); r.tick(0.01);
  check('Aufsteigen ohne Ziege in Reichweite abgelehnt', !b.mount);
  // Abwurf durch Treffer als Gegenmittel
  b.prot = 0; a.prot = 0; b.lastShot = {}; m.time += 2; send(r, cs[1], { t: 'shot', w: 'blaster', o: [b.x, 1.6, b.z], d: [a.x - b.x, 0, a.z - b.z] }); r.tick(0.01);
  check('Treffer wirft den Reiter von der neutralen Ziege', !a.mount && g.state === 'free', `mount=${a.mount} state=${g.state}`);
  a.kbT = 0; a.vx = a.vz = 0; a.x = 0; a.z = 0; g.x = 1; g.z = 0; b.x = 6; b.z = 0; b.prot = 0;
  send(r, cs[0], { t: 'mount' }); for (let i = 0; i < Math.ceil(ROYALE.rideToTransform / 0.05) + 2; i++) { send(r, cs[0], { t: 'in', x: a.x, z: a.z, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05); }
  check('Nach 10 s Reiten: Verwandlung in Kampfziege der Teamfarbe', g.state === 'special' && g.team === a.team && g.hp === ROYALE.specialHp);
  // Kampfziege läuft rückwärts auf den Gegner zu
  b.prot = 0; b.x = 7; b.z = 0; const d0 = Math.hypot(g.x - b.x, g.z - b.z); for (let i = 0; i < 10; i++) r.tick(0.05);
  const d1 = Math.hypot(g.x - b.x, g.z - b.z); const bx2 = -Math.sin(g.ry), bz2 = -Math.cos(g.ry); const toB = [(b.x - g.x) / d1, (b.z - g.z) / d1];
  check('Kampfziege nähert sich dem Gegner rückwärts (Hinterteil voran)', d1 < d0 && bx2 * toB[0] + bz2 * toB[1] > 0.9, `Abstand ${d0.toFixed(1)}→${d1.toFixed(1)}`);
  check('Reiter sitzt auf der Kampfziege und wird mitgeführt', a.mount === g.id && Math.abs(a.x - g.x) < 1e-6);
  // Angekündigter Tritt
  let wind = false, kicked = false; const wb = b.wucht;
  for (let i = 0; i < 80 && !kicked; i++) { b.prot = 0; r.tick(0.05); const sn = last(cs[1], 'snap'); if (sn.ev.some(e => e.k === 'windup')) wind = true; if (sn.ev.some(e => e.k === 'kicked' && e.id === b.id)) kicked = true; }
  check('Tritt wird angekündigt (Ausholen) und trifft danach', wind && kicked && b.wucht >= wb + ROYALE.kickWucht - 0.01, `Wucht ${wb}→${b.wucht}`);
  // Ausweichen: Gegner geht während des Ausholens weg
  b.kbT = 0; b.vx = b.vz = 0; b.x = g.x + 2; b.z = g.z; b.prot = 0; g.cd = 0; g.wind = 0; r.tick(0.05);
  let wound = g.wind > 0; for (let i = 0; i < 5; i++) r.tick(0.05);
  b.x = g.x + 8; const wb2 = b.wucht; for (let i = 0; i < 20; i++) r.tick(0.05);
  check('Ausweichen möglich: wer beim Tritt außer Reichweite ist, wird nicht getroffen', wound && b.wucht === wb2);
  // Gegenmaßnahme: Kampfziege abschießen
  b.lastShot = {}; for (let k = 0; k < 6; k++) { m.time += 2; b.lastShot = {}; b.reloadUntil = 0; b.ammo.sniper = 5; b.x = g.x + 5; b.z = g.z; send(r, cs[1], { t: 'shot', w: 'sniper', o: [b.x, 1.6, b.z], d: [-1, 0, 0] }); r.tick(0.01); if (g.state !== 'special') break; }
  check('Kampfziege kann abgeschossen werden, Reiter fällt ab', g.state !== 'special' && !a.mount, `state=${g.state}`);
  // Arena schrumpft
  m.time = ROYALE.shrinkAt + ROYALE.shrinkDur / 2; r.tick(0.05); const sR = last(cs[0], 'snap').arenaR;
  check('Arena schrumpft nach Zeitplan', sR < ROYALE.R0 && sR > ROYALE.Rmin, sR);
  // Sieg durch Ring-out
  b.prot = 0; b.fallT = 0; b.lives = 1; b.x = 30; r.tick(0.05);
  for (let i = 0; i < 5; i++) r.tick(0.05);
  check('Letztes Leben verloren → Spielende, Sieger Team A', r.state === 'results' && r.results.winner === a.team && r.results.reason === 'last', JSON.stringify(r.results && { w: r.results.winner, r: r.results.reason }));
  check('Ergebnis enthält KOs/Abstürze/Verwandlungen je Spieler', r.results.players.every(p => 'kos' in p && 'falls' in p && 'transforms' in p));
  // Revanche
  for (const p of r.players) p.rateN = 0; // Testhelfer: das 80/s-Limit zählt Echtzeit, die Simulation läuft schneller
  for (const c of cs) r.message(c, '{"t":"rematch"}'); r.tick(0.05);
  check('Revanche startet neues Royale', r.state === 'match' && r.match.phase === 'countdown');
}
{ const { r, cs, m } = setup('2v2');
  const ps = [...m.players.values()]; const t0 = ps.filter(p => p.team === 0), t1 = ps.filter(p => p.team === 1);
  check('2v2: vier Spieler, zwei pro Team', t0.length === 2 && t1.length === 2);
  for (const p of ps) p.prot = 0;
  const [a, a2] = t0; a.x = -4; a.z = 0; a2.x = 2; a2.z = 0; const ci = [...r.players].findIndex(p => p.id === a.id);
  send(r, cs[ci], { t: 'shot', w: 'blaster', o: [a.x, 1.6, a.z], d: [1, 0, 0] }); r.tick(0.01);
  check('2v2: kein Eigenbeschuss im Team', a2.wucht === 0);
  // Gleichzeitige Treffer zweier Gegner
  const [b, b2] = t1; a.x = 0; a.z = 0; b.x = -4; b.z = 0; b2.x = 4; b2.z = 0; a.wucht = 0; a.vx = 0; a2.x = 0; a2.z = 9;
  const ib = [...r.players].findIndex(p => p.id === b.id), ib2 = [...r.players].findIndex(p => p.id === b2.id);
  send(r, cs[ib], { t: 'shot', w: 'blaster', o: [b.x, 1.0, b.z], d: [1, 0, 0] }); send(r, cs[ib2], { t: 'shot', w: 'blaster', o: [b2.x, 1.0, b2.z], d: [-1, 0, 0] }); r.tick(0.01);
  check('2v2: zwei gleichzeitige Treffer zählen beide, Rückstöße heben sich auf', Math.abs(a.wucht - 8) < 1e-6 && Math.abs(a.vx) < 0.5, `Wucht ${a.wucht}, vx ${a.vx}`);
  // Maximal eine Kampfziege pro Team
  const [g1, g2] = m.goats; a.kbT = 0; a.vx = a.vz = 0;
  g1.state = 'special'; g1.team = 0; g1.rider = 0; g1.life = 99; g1.x = 10; g1.z = 10;
  a2.x = 0; a2.z = 9; g2.x = 0.5; g2.z = 9; g2.state = 'free'; g2.respawn = 0; const ia2 = [...r.players].findIndex(p => p.id === a2.id);
  send(r, cs[ia2], { t: 'mount' }); for (let i = 0; i < 230; i++) { send(r, cs[ia2], { t: 'in', x: a2.x, z: a2.z, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); for (const p of ps) { if (p.team) { p.prot = 99; p.x = -12; p.z = -1; } } r.tick(0.05); }
  check('2v2: höchstens eine Kampfziege pro Team', g2.state === 'ridden' && m.goats.filter(g => g.state === 'special' && g.team === 0).length === 1, g2.state);
  // Verbindungsabbruch / Verlassen: Spieler scheidet aus, Match läuft weiter
  r.message(cs[ib2], '{"t":"leave"}'); r.tick(0.05);
  check('2v2: Verlassen → Spieler scheidet aus, Match läuft weiter', r.state === 'match' && !r.players.find(p => p.id === b2.id));
  // Zeitablauf: Wertung nach Leben
  for (const p of ps) { p.prot = 0; p.fallT = 0; } b.out = false; b.lives = 1; for (const p of ps) { p.x *= 0.3; p.z *= 0.3; } m.time = ROYALE.maxTime; r.tick(0.05);
  check('Zeit abgelaufen → Sieger nach verbleibenden Leben', r.state === 'results' && r.results.winner === 0 && r.results.reason === 'lives', JSON.stringify({ w: r.results?.winner, r: r.results?.reason }));
}
// Leistung: 2v2-Tick mit allen Systemen
{ const { r, m } = setup('2v2'); const t0 = performance.now(); for (let i = 0; i < 2000; i++) r.tick(0.05); const ms = (performance.now() - t0) / 2000;
  check('Rechenzeit pro Royale-Tick inkl. Snapshots für 4 Spieler', ms < 1, ms.toFixed(3) + ' ms'); }
console.log(`\n${res.filter(x => x.startsWith('PASS')).length}/${res.length} bestanden (Server-Simulation, kein Browser)`);
