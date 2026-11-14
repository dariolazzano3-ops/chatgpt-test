// V7 Käsekuchen-Raub: Server-Simulation (ohne Browser). Prüft Regeln, KI, Anti-Cheat und Leistung.
import { Room } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';
import { HEIST, WALL7, makeWave8, sheepLives } from '../shared/rules.js';
const results = []; const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); results.push(l); console.log(l); };
function conn() { return { out: [], send(t) { this.out.push(t); }, close() { } }; }
let seqN = 1;
const send = (r, c, msg) => r.message(c, JSON.stringify({ seq: seqN++, ...msg }));
function setup(size = '1v1', seed = 7) {
  const r = new Room({ code: 'HEIST', mode: 'kuchenkrieg', size, seed }, MODES); const cs = []; const n = size === '1v1' ? 2 : 4;
  for (let i = 0; i < n; i++) { const c = conn(); r.open(c); r.message(c, JSON.stringify({ t: 'hello', name: 'P' + i })); cs.push(c); }
  for (const c of cs) r.message(c, JSON.stringify({ t: 'ready', v: true }));
  for (let i = 0; i < 80 && r.state !== 'match'; i++) r.tick(0.05);
  const m = r.match, P = [...m.players.values()], D = P.filter(p => p.role === 'def'), S = P.filter(p => p.role === 'sheep');
  const csOf = ps => cs[r.players.findIndex(p => p.id === ps.id)];
  return { r, m, P, D, S, cs, csOf };
}
const tick = (r, s) => { for (let i = 0; i < Math.round(s / 0.05); i++) r.tick(0.05); };
const lastSnap = c => { for (let i = c.out.length - 1; i >= 0; i--) { const o = JSON.parse(c.out[i]); if (o.t === 'snap') return o; } return null; };
const allEv = c => c.out.map(t => JSON.parse(t)).filter(o => o.t === 'snap').flatMap(o => o.ev);
function startWave(r, m, w = 1) { m.wave = w - 1; m.phase = 'countdown'; m.phaseT = 0.01; tick(r, 0.1); }
const freezeHerd = m => { for (const n of m.npcs) { n.state = 'graze'; n.t = 999; } };
// Herde weit weg parken (nur die genannten NPCs bleiben), damit kein anderes Schaf im Schussfeld steht
const isolate = (m, keep = []) => m.npcs.forEach((n, i) => { if (!keep.includes(n)) { n.x = Math.cos(i) * 34; n.z = 30 + Math.sin(i) * 3; n.tx = n.x; n.tz = n.z; } n.state = 'graze'; n.t = 999; });
// eine ferne, ruhende Ziege hält die Welle offen (sonst beginnt sofort die Kaufphase)
const hold = m => { m.queue = []; m.goats = [{ id: 7777, type: 'bock', s: 1.3, r: 0.58, x: 38, z: -2, hp: 1e6, maxHp: 1e6, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1, wp: null, wpTried: true }]; };
// Verteidiger blickt von (x,z) auf Ziel (tx,tz)
function aim(r, c, ps, x, z, tx, tz, ty = 0.78) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(ty - 1.55, d);
  ps.x = x; ps.z = z; send(r, c, { t: 'in', c: ps.cseq, x, z, y: 0, yaw, pitch, w: 'blaster' }); return { yaw, pitch, o: [x, 1.6, z], d: [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)] }; }

// ---------- 1. Rollen, Tarnung, Schwanz ----------
{ const { r, m, D, S, cs, csOf } = setup(); const d = D[0], s = S[0];
  check('Asymmetrische Rollen: Team 0 = Verteidiger, Team 1 = Schaf', d.role === 'def' && s.role === 'sheep' && r.info().teams[1] === 'Schafe');
  check('Herde: 16 NPC-Schafe im 1v1', m.npcs.length === 16);
  tick(r, 0.2); const sd = lastSnap(csOf(d)), ss = lastSnap(csOf(s));
  check('Verteidiger sieht 17 gleich aufgebaute Schafe (Herde + Spieler)', sd.sh.length === 17 && sd.sh.every(e => e.length === 8));
  check('Kein Positions-Eintrag des Schafspielers in der Spielerliste des Verteidigers', !sd.pl.some(p => p.team === 1) && sd.sheepTeam.every(e => e.x === undefined && e.sid === undefined));
  check('Schaf-IDs nicht fortlaufend, Liste sortiert (Reihenfolge verrät nichts)', sd.sh.every((e, i, a) => !i || a[i - 1][0] < e[0]) && new Set(sd.sh.map(e => e[0] % 100)).size > 3);
  freezeHerd(m); d.x = 0; d.z = 0; s.x = 25; s.z = 0; tick(r, 0.1); let row = lastSnap(csOf(d)).sh.find(e => e[0] === s.sid);
  check('Schwarzer Schwanz aus 25 m nicht erkennbar (hell übertragen)', row && row[5] === 0);
  s.x = 12; tick(r, 0.1); row = lastSnap(csOf(d)).sh.find(e => e[0] === s.sid);
  check('Schwarzer Schwanz aus 12 m sichtbar (Nähe)', row && row[5] === 1);
  check('NPC-Schafe haben immer helle Schwänze', lastSnap(csOf(d)).sh.filter(e => e[0] !== s.sid).every(e => e[5] === 0));
  check('Schafspieler bekommt sich selbst markiert (nur in seiner Sicht)', lastSnap(csOf(s)).sh.find(e => e[0] === s.sid)[6] & 16 && !(row[6] & 16));
  s.camoUntil = m.time + 5; tick(r, 0.1); row = lastSnap(csOf(d)).sh.find(e => e[0] === s.sid);
  check('Tarnpuder: Schwanz auch aus der Nähe hell', row[5] === 0);
  m.fort.builds.push({ id: 99, kind: 'watch', slot: 0, x: -3.4, z: 3.4, hp: 120, maxHp: 120 }); s.camoUntil = 0; s.x = 28; tick(r, 0.1); row = lastSnap(csOf(d)).sh.find(e => e[0] === s.sid);
  check('Aussichtsturm: Schwanz bis 32 m erkennbar', row[5] === 1);
  check('Keine Ereignisse verraten den Schafspieler ohne Kampf', !allEv(csOf(d)).some(e => e.sid === s.sid || e.id === s.id));
}
// ---------- 2. NPC-Schafe: nur nach Anvisieren ----------
{ const { r, m, D, csOf } = setup(); const d = D[0], c = csOf(d); startWave(r, m, 1); hold(m); isolate(m, m.npcs.slice(0, 4));
  const n = m.npcs[0]; n.x = 14; n.z = 0; n.state = 'graze'; n.t = 999;
  // Verteidiger steht direkt hinter/neben dem Schaf, zielt aber weg
  aim(r, c, d, 12.5, 0, 12.5, -20); tick(r, 3);
  check('NPC-Schaf greift nicht grundlos an (Spieler daneben, Waffe weg)', n.state === 'graze' && d.hp === 100);
  n.ry = Math.PI; aim(r, c, d, 15.5, 0, 15.5, -20); tick(r, 3);
  check('NPC-Schaf greift nicht von hinten an', n.state === 'graze' && d.hp === 100);
  aim(r, c, d, 5, 0, 14, 0); for (let i = 0; i < 8; i++) { send(r, c, { t: 'in', c: d.cseq, x: 5, z: 0, y: 0, yaw: d.yaw, pitch: d.pitch }); tick(r, 0.1); }
  check('Anvisieren ≥ 0,7 s: Warnung (Kopf senken)', n.state === 'warn', n.state);
  tick(r, 1.0); check('Nach der Warnung: Angriff auf den Verteidiger', n.state === 'charge');
  tick(r, 2); check('Gezielt bedrohtes Schaf schlägt zu (12 Schaden)', d.hp === 88 && n.state === 'calm', `hp ${d.hp}`);
  const n2 = m.npcs[1]; n2.x = -14; n2.z = 0; n2.state = 'graze'; n2.t = 999; d.x = 0; d.z = 0;
  aim(r, c, d, -2, 0, -14, 0); send(r, c, { t: 'in', c: d.cseq, x: -2, z: 0, y: 0, yaw: d.yaw, pitch: d.pitch }); tick(r, 0.3); aim(r, c, d, -2, 0, -14, 20); tick(r, 1.5);
  check('Kurz anvisiert (0,3 s) und weggeschaut: keine Reaktion', n2.state === 'graze');
  // Mauer dazwischen blockiert die Sicht
  const n3 = m.npcs[2]; n3.x = 0; n3.z = -12; n3.state = 'graze'; n3.t = 999; m.fort.walls.N.lvl = 3;
  aim(r, c, d, 0, -2, 0, -12, 0.5); for (let i = 0; i < 15; i++) { send(r, c, { t: 'in', c: d.cseq, x: 0, z: -2, y: 0, yaw: d.yaw, pitch: d.pitch }); tick(r, 0.1); }
  check('Hinter einer hohen Mauer: keine Bedrohung (Sichtlinie)', n3.state === 'graze');
  const n4 = m.npcs[3]; n4.x = 10; n4.z = 10; n4.state = 'graze'; n4.t = 999; const coins = m.fort.coins = 50;
  const a = aim(r, c, d, 4, 4, 10, 10); d.lastShot = {}; send(r, c, { t: 'shot', w: 'blaster', o: a.o, d: a.d }); tick(r, 0.05);
  check('Angeschossenes NPC-Schaf wehrt sich sofort', n4.state === 'warn' && n4.hp < 25);
  for (let i = 0; i < 3; i++) { d.lastShot = {}; send(r, c, { t: 'shot', w: 'blaster', o: a.o, d: a.d }); tick(r, 0.05); }
  check('Unschuldiges Schaf erschossen: 5 Münzen Strafe, Herde wächst nach', !m.npcs.includes(n4) && m.fort.coins === coins - 5 && m.npcRespawn.length === 1, `coins ${m.fort.coins}`);
  d.yaw = 0; d.pitch = 1.5; tick(r, 11); check('Neues Herdenschaf nach 10 s', m.npcs.length === 16);
}
// ---------- 3. Mauern überwinden (Server-Prüfung) ----------
{ const { r, m, S, csOf } = setup(); const s = S[0], c = csOf(s); startWave(r, m, 1); m.queue = []; m.goats = [];
  const mv = (x, z, y = 0, extra = {}) => { send(r, c, { t: 'in', c: s.cseq, x, z, y, yaw: 0, pitch: 0, ...extra }); tick(r, 0.05); };
  s.x = 0; s.z = -7; s.y = 0; s.prot = 0; tick(r, 0.05);
  mv(0, -6.2); mv(0, -5.4); mv(0, -4.6);
  check('Durch eine Holzmauer laufen: abgelehnt', s.z < -5 && s.wallRejects > 0, `z ${s.z.toFixed(2)}`);
  mv(0, -5.8, 0.6); mv(0, -5.2, 1.45); mv(0, -4.6, 1.5); mv(0, -4.0, 0.6);
  check('Holzmauer (1,3 m) per Sprung überwinden', s.z > -5 && s.z < -3.5, `z ${s.z.toFixed(2)}`);
  m.fort.walls.E.lvl = 2; m.fort.walls.E.hp = m.fort.walls.E.maxHp = WALL7.stone.hp; s.x = 3; s.z = 0; s.y = 0; tick(r, 0.1); const r0 = s.wallRejects;
  mv(3.8, 0, 0.6); mv(4.5, 0, 1.6); mv(5.3, 0, 1.6); mv(6, 0, 0.5);
  check('Steinmauer (2,1 m) ohne Sprungfeder: abgelehnt', s.x < 5 && s.wallRejects > r0);
  s.jumpUpg = true; s.x = 3; s.y = 0; tick(r, 0.1); mv(3.8, 0, 0.9); mv(4.5, 0, 1.8); mv(5.3, 0, 2.4); mv(6, 0, 1.0);
  check('Mit Sprungfeder über die Steinmauer', s.x > 5.5, `x ${s.x.toFixed(2)}`);
  m.fort.walls.S.lvl = 3; m.fort.walls.S.hp = m.fort.walls.S.maxHp = WALL7.steel.hp; s.jumpUpg = false; s.x = 0; s.z = 6.2; s.y = 0; tick(r, 0.1);
  mv(0, 6.0, 3.2); check('Stahlmauer: Hochteleport auf 3,2 m abgelehnt', s.y < 2, `y ${s.y}`);
  let y = 0, tUp = null; const t0 = m.time; for (let i = 0; i < 80 && s.y < 3.2; i++) { y = Math.min(3.2, s.y + 0.4); mv(0, 6.0, y, { cl: 1 }); if (s.y >= 3.15 && tUp == null) tUp = m.time - t0; } const zc = s.z;
  for (const z of [5.4, 4.8, 4.2]) mv(0, z, 3.2, { cl: 1 });
  check('Klettern dauert (≥ 1 s für 1,6 m über Sprunghöhe)', tUp != null && tUp >= 1.0, tUp && tUp.toFixed(2) + ' s');
  check('Kontrolliertes Klettern über die Stahlmauer (langsam)', s.z < 5 && zc > 5, `z ${s.z.toFixed(2)}`);
}
// ---------- 4. Verteidiger trifft Schaf, Leben pro Welle ----------
{ const { r, m, D, S, csOf } = setup(); const d = D[0], s = S[0], cd = csOf(d); freezeHerd(m); startWave(r, m, 1); hold(m); m.goats.push({ id: 999, type: 'normal', s: 1, r: 0.45, x: 30, z: 30, hp: 99, maxHp: 99, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  check('Welle 1: Schaf hat 1 Leben', s.lives === 1);
  s.x = 15; s.z = 0; s.prot = 0; s.y = 0; const a = aim(r, cd, d, 3, 0, 15, 0);
  for (let i = 0; i < 5; i++) { d.lastShot = {}; send(r, cd, { t: 'shot', w: 'blaster', o: a.o, d: a.d }); tick(r, 0.05); }
  check('Verteidiger kann den Schafspieler treffen und erledigen', s.dead && s.deaths === 1, `hp ${s.hp}`);
  check('Ein Tod verbraucht genau ein Leben → 0 Leben: Warten bis zur nächsten Welle', s.lives === 0 && s.waiting);
  check('Omi reagiert auf Schaftod (Ereignis)', allEv(cd).some(e => e.k === 'omi' && e.q === 'die'));
  tick(r, 5); check('Wartend: kein Respawn in derselben Welle', s.waiting && s.dead);
  send(r, csOf(s), { t: 'in', c: s.cseq, x: 0, z: 0, y: 0, yaw: 0, pitch: 0 }); tick(r, 0.1); check('Bewegung im Wartezustand wird ignoriert (kein ungültiger Respawn)', s.x === 15);
  m.goats = []; tick(r, 0.2); m.phaseT = 0.01; tick(r, 0.2); tick(r, 3.5);
  check('Welle 2: Leben auf 2 gesetzt, Schaf zurück in der Herde', m.wave === 2 && s.lives === 2 && !s.dead && !s.waiting && Math.hypot(s.x, s.z) > 9);
  for (const w of [3, 4, 5, 6, 7, 8]) { m.goats = []; m.queue = []; tick(r, 0.1); m.phaseT = 0.01; tick(r, 0.2); tick(r, 3.5); if (m.wave !== w) break; }
  check('Leben steigen pro Welle bis 8', m.wave === 8 && s.lives === 8, `Welle ${m.wave}, Leben ${s.lives}`);
  check('Leben-Tabelle 1…8', [1, 2, 3, 4, 5, 6, 7, 8].every(w => sheepLives(w) === w));
  s.lives = 1; s.prot = 0; s.x = 15; s.z = 0; m.goats.push({ id: 998, type: 'normal', s: 1, r: 0.45, x: 30, z: -30, hp: 99, maxHp: 99, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  const a2 = aim(r, cd, d, 3, 0, 15, 0); for (let i = 0; i < 6; i++) { d.lastShot = {}; send(r, cd, { t: 'shot', w: 'blaster', o: a2.o, d: a2.d }); tick(r, 0.05); }
  check('Welle 8: letztes Leben weg → endgültig ausgeschieden', s.out && s.dead, JSON.stringify({ out: s.out, lives: s.lives }));
}
// ---------- 5. Kuchenraub, Schild, Fallenlassen, Zurückholen, Omi ----------
{ const { r, m, D, S, csOf } = setup(); const d = D[0], s = S[0], cs = csOf(s); freezeHerd(m); startWave(r, m, 2); m.queue = []; m.goats = []; m.goats.push({ id: 997, type: 'normal', s: 1, r: 0.45, x: 35, z: 0, hp: 99, maxHp: 99, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  s.coins = 200; send(r, cs, { t: 'buy', item: 'shield' }); send(r, cs, { t: 'use', item: 'shield' }); tick(r, 0.05);
  check('Schaf-Shop: Schild gekauft und aktiv', s.shield === 40 && s.coins === 160);
  s.x = 0.8; s.z = 0.8; s.y = 0; d.x = 0; d.z = -3; d.dead = false; send(r, cs, { t: 'grab', v: true }); tick(r, 0.5);
  check('Aufnahme dauert (nach 0,5 s noch nicht)', m.cake.state === 'home' && s.grabT > 0.3);
  s.x = 4; tick(r, 0.1); check('Aufnahme bricht ab, wenn das Schaf den Radius verlässt', s.grabT === 0); s.x = 0.8; send(r, cs, { t: 'grab', v: true }); tick(r, 1.1);
  check('Kuchen gestohlen (serverseitig bestätigt)', m.cake.state === 'carried' && m.cake.by === s.id);
  check('Schild bei Kuchenaufnahme automatisch abgelegt, ohne Erstattung', s.shield === 0 && s.coins === 160);
  send(r, cs, { t: 'buy', item: 'shield' }); send(r, cs, { t: 'use', item: 'shield' }); tick(r, 0.05);
  check('Schild mit Kuchen nicht aktivierbar (Umschalten verhindert)', s.shield === 0 && s.inv.shield === 1);
  check('Omi reagiert auf den Diebstahl', allEv(csOf(d)).some(e => e.k === 'omi' && e.q === 'steal'));
  const sd = lastSnap(csOf(d)).sh.find(e => e[0] === s.sid); check('Kuchen am Schaf für alle sichtbar', sd && (sd[6] & 1));
  // Flucht langsamer
  send(r, cs, { t: 'in', c: s.cseq, x: s.x, z: s.z, y: 0, yaw: 0, pitch: 0 }); tick(r, 0.05); const x0 = s.x; send(r, cs, { t: 'in', c: s.cseq, x: s.x + 5, z: s.z, y: 0, yaw: 0, pitch: 0, sp: 1 }); tick(r, 0.05);
  check('Mit Kuchen: Tempo begrenzt (kein Sprint)', s.x - x0 < 0.5 + 5.2 * 0.68 * 1.3 * 0.05 + 0.01, (s.x - x0).toFixed(2));
  send(r, cs, { t: 'in', c: s.cseq, x: s.x, z: s.z, y: 1.5, yaw: 0, pitch: 0 }); tick(r, 0.05); check('Mit Kuchen: nur kleiner Sprung (0,7 m)', s.y <= 0.71);
  s.y = 0; s.x = 10; s.z = 0; s.prot = 0; tick(r, 0.1); const a = aim(r, csOf(d), d, 3, 0, 10, 0);
  for (let i = 0; i < 6 && !s.dead; i++) { d.lastShot = {}; send(r, csOf(d), { t: 'shot', w: 'blaster', o: a.o, d: a.d }); tick(r, 0.05); }
  check('Schaf stirbt → Kuchen fällt zu Boden, ein Leben weg', s.dead && m.cake.state === 'dropped' && Math.abs(m.cake.x - 10) < 0.5 && s.lives === 1);
  check('Omi reagiert auf den verlorenen Kuchen', allEv(csOf(d)).some(e => e.k === 'omi' && e.q === 'drop'));
  d.x = 10; d.z = 0.5; tick(r, 0.1); check('Verteidiger bringt den Kuchen zurück', m.cake.state === 'home');
  // erneut stehlen und abliefern
  tick(r, 3.2); check('Respawn mit verbleibendem Leben', !s.dead && s.lives === 1);
  s.x = 0.5; s.z = 0.5; send(r, csOf(s), { t: 'grab', v: true }); tick(r, 1.2); check('Kuchen erneut stehlbar', m.cake.state === 'carried');
  d.dead = true; d.respawnAt = 1e9; s.x = HEIST.omi.x; s.z = HEIST.omi.z + 9; tick(r, 0.1); check('Omi: „fast da“ unter 10 m', allEv(csOf(s)).some(e => e.k === 'omi' && e.q === 'near'));
  s.z = HEIST.omi.z + 2; tick(r, 0.1);
  check('Ablieferung bei der Omi → sofortiger Schaf-Sieg', r.state === 'results' && r.results.winner === 1 && r.results.reason === 'delivered');
}
// ---------- 6. Doppelte Kuchen, Selbst-Abwurf, Auto-Rückgabe (2v2) ----------
{ const { r, m, D, S, csOf } = setup('2v2'); freezeHerd(m); startWave(r, m, 1); hold(m); m.goats.push({ id: 996, type: 'normal', s: 1, r: 0.45, x: 35, z: 0, hp: 99, maxHp: 99, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  check('2v2: zwei Verteidiger, zwei Schafe, 22 NPC-Schafe', D.length === 2 && S.length === 2 && m.npcs.length === 22);
  for (const d of D) { d.x = -20; d.z = -20; }
  S[0].x = 0.6; S[0].z = 0; S[1].x = -0.6; S[1].z = 0; send(r, csOf(S[0]), { t: 'grab', v: true }); send(r, csOf(S[1]), { t: 'grab', v: true }); tick(r, 1.2);
  check('Gleichzeitiges Greifen: genau ein Träger (keine Kuchen-Duplikation)', m.cake.state === 'carried' && [S[0], S[1]].filter(s => m.cake.by === s.id).length === 1);
  const sd = lastSnap(csOf(S[0])); check('Schaf-Team sieht den Mitspieler markiert, Verteidiger nicht', sd.sh.filter(e => e[6] & 8).length === 1 && !lastSnap(csOf(D[0])).sh.some(e => e[6] & 8));
  const carrier = m.players.get(m.cake.by); send(r, csOf(carrier), { t: 'dropcake' }); tick(r, 0.1); check('Kuchen bewusst ablegen', m.cake.state === 'dropped', JSON.stringify(m.cake));
  carrier.x = 20; carrier.z = 20; const other = S.find(s => s !== carrier); other.x = 20; other.z = 20; tick(r, 26); check('Liegengebliebener Kuchen kehrt nach 25 s automatisch zurück', m.cake.state === 'home');
  // Verteidiger + Mitspieler: kein Teamschaden
  const [d1, d2] = D; d1.x = 0; d1.z = 3; d2.x = 0; d2.z = -3; d2.prot = 0; const a = aim(r, csOf(d1), d1, 0, 3, 0, -3, 1.2);
  d1.lastShot = {}; send(r, csOf(d1), { t: 'shot', w: 'blaster', o: a.o, d: a.d }); tick(r, 0.05); check('Kein Teamschaden unter Verteidigern', d2.hp === 100);
}
// ---------- 7. Werwölfe am Kuchen ----------
{ const { r, m, D, S, csOf } = setup(); const d = D[0], s = S[0], c = csOf(d); freezeHerd(m); startWave(r, m, 3); hold(m);
  m.fort.coins = 500; send(r, c, { t: 'buy', item: 'wolf' }); tick(r, 0.05); check('Werwolf ab Welle 3 kaufbar (60 Münzen)', m.wolves.length === 1 && m.fort.coins === 440, m.wolves.length + ' ' + m.fort.coins + ' ' + m.wave + m.phase);
  send(r, c, { t: 'buy', item: 'wolf' }); tick(r, 0.05); check('Abklingzeit verhindert sofortigen Zweitkauf', m.wolves.length === 1);
  m.goats.push({ id: 900, type: 'normal', s: 1, r: 0.45, x: 3, z: 3, hp: 2, maxHp: 2, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  tick(r, 4); check('Werwolf verteidigt den Kuchen (tötet nahe Zombie-Ziege)', !m.goats.some(g => g.id === 900));
  m.goats.push({ id: 901, type: 'normal', s: 1, r: 0.45, x: 30, z: 0, hp: 2, maxHp: 2, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  let maxD = 0; for (let i = 0; i < 100; i++) { tick(r, 0.05); for (const f of m.wolves) maxD = Math.max(maxD, Math.hypot(f.x, f.z)); }
  check('Werwolf bleibt im Schutzradius (≤ 9 m), ignoriert ferne Ziege', maxD <= 9.01 && m.goats.some(g => g.id === 901), maxD.toFixed(2));
  s.x = 7; s.z = 0; s.prot = 0; s.revealUntil = 0; tick(r, 2); check('Getarntes Schaf außerhalb der Festung wird nicht erkannt', s.hp === 60);
  s.revealUntil = m.time + 4; const hp0 = s.hp; tick(r, 3); check('Aufgeflogenes Schaf (Kampf) wird gebissen', s.hp < hp0, `hp ${s.hp}`);
  const f = m.wolves[0]; s.hp = 60; s.x = f.x; s.z = f.z + 1; s.yaw = 0; const hpw = f.hp; send(r, csOf(s), { t: 'melee' }); tick(r, 0.05);
  check('Schaf kann den Werwolf angreifen', f.hp < hpw);
  for (let i = 0; i < 6; i++) { s.meleeAt = -9; s.x = f.x; s.z = f.z + 1; s.yaw = 0; s.prot = 0; send(r, csOf(s), { t: 'melee' }); tick(r, 0.05); }
  check('Werwölfe können sterben', f.dead || !m.wolves.includes(f));
  m.fort.wolfReadyAt = 0; send(r, c, { t: 'buy', item: 'wolf' }); tick(r, 0.05); m.fort.wolfReadyAt = 0; send(r, c, { t: 'buy', item: 'wolf' }); tick(r, 0.05); m.fort.wolfReadyAt = 0; send(r, c, { t: 'buy', item: 'wolf' }); tick(r, 0.05);
  check('Höchstens 2 gleichzeitig / 3 pro Welle', m.wolves.filter(x => !x.dead).length <= 2 && m.fort.wolvesThisWave <= 3);
  tick(r, 33); check('Begrenzte Einsatzdauer (30 s)', m.wolves.length === 0, JSON.stringify(m.wolves.map(f=>[f.life.toFixed(1),f.dead])));
}
// ---------- 8. Verteidiger-Markt ----------
{ const { r, m, D, S, csOf } = setup(); const d = D[0], c = csOf(d), b = it => send(r, c, { t: 'buy', item: it });
  check('Start: Holzmauern auf allen vier Seiten', Object.values(m.fort.walls).every(w => w.lvl === 1));
  startWave(r, m, 1); m.fort.coins = 2000; b('steel'); tick(r, 0.05); check('Stahlmauer vor Welle 4 gesperrt', Object.values(m.fort.walls).every(w => w.lvl === 1));
  m.wave = 4; b('stone'); tick(r, 0.05); const st = Object.values(m.fort.walls).filter(w => w.lvl === 2).length; b('steel'); tick(r, 0.05);
  check('Mauer-Ausbau Holz → Stein → Stahl (mehr Leben)', st === 1 && Object.values(m.fort.walls).some(w => w.lvl === 3 && w.maxHp === 240));
  m.fort.walls.W.hp = 10; b('repair'); tick(r, 0.05); check('Reparatur (+50 %)', m.fort.walls.W.hp === 40);
  b('gate'); tick(r, 0.05); check('Tor eingebaut', Object.values(m.fort.walls).some(w => w.gate));
  for (const it of ['tower', 'tower', 'gun', 'spikes', 'mine', 'ammo', 'bell', 'watch', 'bot']) { b(it); tick(r, 0.05); }
  const kinds = m.fort.builds.map(x => x.kind); check('Türme, Geschütz, Falle, Mine, Munition, Glocke, Aussichtsturm, Reparaturhelfer gebaut', ['tower', 'gun', 'spikes', 'mine', 'ammo', 'bell', 'watch', 'bot'].every(k => kinds.includes(k)) && kinds.filter(k => k === 'tower').length === 2, kinds.join(','));
  b('ammo'); tick(r, 0.05); check('Doppelter Kauf mit Grenze 1 abgelehnt', kinds.filter(k => k === 'ammo').length === 1 && m.fort.builds.filter(x => x.kind === 'ammo').length === 1);
  const coins = m.fort.coins; send(r, c, { t: 'buy', item: 'laser' }); send(r, c, { t: 'buy', item: '__proto__' }); tick(r, 0.05); check('Unzulässige Items abgelehnt', m.fort.coins === coins);
  hold(m); m.goats.push({ id: 800, type: 'normal', s: 1, r: 0.45, x: 12, z: 12, hp: 3, maxHp: 3, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  tick(r, 4); check('Verteidigungsturm erledigt Zombie-Ziege in Reichweite', !m.goats.some(g => g.id === 800));
  const sp = m.fort.builds.find(x => x.kind === 'spikes'); m.goats.push({ id: 801, type: 'normal', s: 1, r: 0.45, x: sp.x + 1, z: sp.z, hp: 50, maxHp: 50, speed: 1, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  tick(r, 0.1); const g801 = m.goats.find(g => g.id === 801); check('Stachelfalle verlangsamt und verletzt', g801 && g801.hp < 50);
  const mine = m.fort.builds.find(x => x.kind === 'mine'); for (let i = 0; i < 3; i++) m.goats.push({ id: 810 + i, type: 'normal', s: 1, r: 0.45, x: mine.x + 0.3 * i, z: mine.z, hp: 5, maxHp: 5, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  tick(r, 0.1); check('Explosivfalle zündet bei 3 Ziegen', !m.fort.builds.includes(mine) && !m.goats.some(g => g.id === 810));
  const w0 = m.fort.walls.N; w0.hp = 5; tick(r, 8); check('Reparaturhelfer repariert die schwächste Mauer', w0.hp > 10, w0.hp.toFixed(1));
  d.ammo.blaster = 0; const am = m.fort.builds.find(x => x.kind === 'ammo'); d.x = am.x; d.z = am.z; tick(r, 0.1); check('Munitionsstation füllt auf', d.ammo.blaster === 24);
  b('mag'); tick(r, 0.05); check('Größeres Magazin (+50 %)', d.ammo.blaster === 36);
  b('boostcd'); tick(r, 0.05); send(r, c, { t: 'boost' }); tick(r, 0.05); check('Boost-Abklingzeit auf 4 s verkürzt', Math.abs(d.boostReadyAt - m.time - 3.95) < 0.15, (d.boostReadyAt - m.time).toFixed(2));
  m.cake.hp = 50; b('cake'); tick(r, 0.05); check('Kuchen reparieren (+25)', m.cake.hp === 75);
  const S0 = S[0]; S0.x = 6; S0.z = 0; S0.prot = 0; m.fort.walls.E.lvl = 1; const hpw = m.fort.walls.E.hp; S0.yaw = -Math.PI / 2; send(r, csOf(S0), { t: 'melee' }); tick(r, 0.05);
  check('Schaf beschädigt Mauer per Kopfstoß', m.fort.walls.E.hp < hpw);
  S0.x = 2; S0.z = 0; tick(r, 0.1); check('Wachglocke schlägt Alarm, wenn das Schaf in die Festung kommt', allEv(c).some(e => e.k === 'alarm') && !allEv(csOf(S0)).some(e => e.k === 'alarm'));
}
// ---------- 9. Schaf-Shop & Items ----------
{ const { r, m, D, S, csOf } = setup(); const s = S[0], c = csOf(s), d = D[0]; freezeHerd(m); startWave(r, m, 2); hold(m); m.goats.push({ id: 5, type: 'normal', s: 1, r: 0.45, x: 35, z: 0, hp: 9, maxHp: 9, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 });
  s.coins = 500; for (const it of ['speed', 'smoke', 'decoy', 'camo', 'heal', 'jump']) send(r, c, { t: 'buy', item: it }); tick(r, 0.05);
  check('Schaf-Shop: alle Items kaufbar', ['speed', 'smoke', 'decoy', 'camo', 'heal'].every(k => s.inv[k] === 1) && s.jumpUpg);
  send(r, c, { t: 'buy', item: 'jump' }); tick(r, 0.05); check('Sprungfeder nur einmal', s.coins === 500 - 25 - 30 - 35 - 45 - 20 - 60);
  s.x = 20; s.z = 0; send(r, c, { t: 'use', item: 'smoke' }); send(r, c, { t: 'use', item: 'decoy' }); send(r, c, { t: 'use', item: 'speed' }); send(r, c, { t: 'use', item: 'camo' }); tick(r, 0.1);
  check('Rauchbombe, Ablenkungs-Schaf, Tempo, Tarnpuder wirken', m.smokes.length === 1 && m.decoys.length === 1 && s.speedUntil > m.time && s.camoUntil > m.time);
  const de = m.decoys[0]; d.x = de.x + 5; d.z = de.z; tick(r, 0.05); check('Ablenkungs-Schaf hat einen schwarzen Schwanz (für den Verteidiger)', lastSnap(csOf(d)).sh.find(e => e[0] === de.sid)[5] === 1);
  s.hp = 20; send(r, c, { t: 'use', item: 'heal' }); tick(r, 0.05); check('Heilung (+35)', s.hp === 55);
  send(r, c, { t: 'use', item: 'heal' }); tick(r, 0.05); check('Nicht vorhandenes Item: abgelehnt', s.rejects.use >= 1);
  send(r, c, { t: 'in', c: s.cseq, x: s.x, z: 0, y: 0, yaw: 0, pitch: 0 }); tick(r, 0.05); const x0 = s.x; send(r, c, { t: 'in', c: s.cseq, x: s.x + 40, z: 0, y: 0, yaw: 0, pitch: 0 }); tick(r, 0.05); check('Teleport abgelehnt (Tempo-Grenze)', s.x - x0 < 2 && s.speedRejects >= 1);
  send(r, c, { t: 'shot', w: 'blaster', o: [s.x, 1, s.z], d: [1, 0, 0] }); send(r, c, { t: 'boost' }); tick(r, 0.05); check('Schaf kann nicht schießen oder boosten', s.rejects.role >= 1 && s.rejects.boost >= 1);
  send(r, c, { t: 'lives', v: 99 }); send(r, c, { t: 'set', hp: 999 }); tick(r, 0.05); check('Manipulierte Leben/Lebenspunkte: keine Wirkung', s.lives === 2 && s.hp <= 60);
  const dd = D[0], cd = csOf(dd); dd.boostReadyAt = 0; send(r, cd, { t: 'boost' }); send(r, cd, { t: 'boost' }); tick(r, 0.05); check('Kein Dauer-Boost', dd.boosts === 1 && dd.rejects.boost === 1);
  send(r, cd, { t: 'in', c: dd.cseq, x: dd.x, z: dd.z, y: 9, yaw: 0, pitch: 0 }); tick(r, 0.05); check('Höhe begrenzt (kein Fliegen)', dd.y <= 5.2);
}
// ---------- 10. Acht Wellen, Finale mit 100 ----------
{ const W = [1, 2, 3, 4, 5, 6, 7, 8].map(w => makeWave8(w, 11, 1));
  check('Genau 8 Wellen mit Namen', W.length === 8 && W.every(w => w.name) && (() => { try { makeWave8(9, 1, 1); return false; } catch (e) { return true; } })());
  check('Steigende Stärke (Anzahl/Leben)', W.slice(0, 6).every((w, i) => !i || w.list.length >= W[i - 1].list.length));
  check('Welle 7: Ziegenkönig', W[6].king && W[6].list[0].type === 'king');
  check('Welle 8: exakt 100 Zombie-Ziegen (1v1 und 2v2)', W[7].list.length === 100 && makeWave8(8, 11, 2).list.length === 100);
  const sec = new Array(8).fill(0); for (const e of W[7].list) sec[Math.floor((((e.a % 6.283) + 6.283) % 6.283) / (6.283 / 8))]++;
  check('Welle 8: aus allen Himmelsrichtungen (jeder 45°-Sektor)', sec.every(n => n >= 5), sec.join('/'));
  const { r, m, csOf, D } = setup(); freezeHerd(m); m.cake.hp = 1e6; startWave(r, m, 8); let maxAlive = 0, worst = 0, sum = 0;
  for (let i = 0; i < 200; i++) { const t0 = performance.now(); r.tick(0.05); const dt = performance.now() - t0; if (i > 20) { worst = Math.max(worst, dt); sum += dt; } maxAlive = Math.max(maxAlive, m.goats.length); }
  check('Welle 8: 100 Gegner gleichzeitig aktiv (ein Angriff)', maxAlive === 100, maxAlive);
  check('Welle 8: Server-Takt Ø < 2 ms, max < 15 ms (inkl. Snapshots)', sum / 179 < 2 && worst < 15, (sum / 179).toFixed(2) + ' ms Ø, ' + worst.toFixed(2) + ' ms max');
  const sz = csOf(D[0]).out.slice(-20).map(x => x.length); check('Welle 8: Paketgröße Ø < 4,5 KB', sz.reduce((a, b) => a + b, 0) / sz.length < 4500, Math.round(sz.reduce((a, b) => a + b, 0) / sz.length) + ' B');
  const ang = new Set(m.goats.map(g => Math.floor((Math.atan2(g.z, g.x) + Math.PI) / (Math.PI / 4)))); check('Welle 8: Ziegen rund um die Festung', ang.size === 8);
}
// ---------- 11. Siegregeln und Sonderfälle ----------
{ const { r, m } = setup(); startWave(r, m, 1); m.cake.hp = 0.01; m.goats.push({ id: 1, type: 'normal', s: 1, r: 0.45, x: 0.5, z: 0.5, hp: 9, maxHp: 9, speed: 0, eat: 3, state: 'eat', stagger: 0, ry: 0, slow: 1 }); tick(r, 0.2);
  check('Kuchen von Zombies zerstört → Verteidiger verliert', r.results && r.results.winner === 1 && r.results.reason === 'eaten'); }
{ const { r, m } = setup(); freezeHerd(m); startWave(r, m, 8); m.queue = []; m.goats = []; tick(r, 0.2);
  check('Alle 8 Wellen überstanden, Kuchen da → Verteidiger gewinnt', r.results && r.results.winner === 0 && r.results.reason === 'survived'); }
{ const { r, m, S } = setup(); const s = S[0]; freezeHerd(m); startWave(r, m, 8); m.queue = []; m.goats = [{ id: 1, type: 'normal', s: 1, r: 0.45, x: 35, z: 0, hp: 9, maxHp: 9, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 }];
  s.x = 0.5; s.z = 0; send(r, r.players.find(p => p.id === s.id).conn, { t: 'grab', v: true }); tick(r, 1.2); m.goats = []; tick(r, 0.1);
  check('Letzte Ziege tot, Kuchen unterwegs → Nachspielzeit 20 s', m.phase === 'overtime' && !m.over);
  s.x = HEIST.omi.x; s.z = HEIST.omi.z + 1; tick(r, 0.1); check('Ablieferung in der Nachspielzeit → Schaf-Sieg', r.results && r.results.winner === 1 && r.results.reason === 'delivered'); }
{ const { r, m, S } = setup(); const s = S[0]; freezeHerd(m); startWave(r, m, 8); m.queue = []; m.goats = [{ id: 1, type: 'normal', s: 1, r: 0.45, x: 35, z: 0, hp: 9, maxHp: 9, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1 }];
  s.x = 0.5; s.z = 0; send(r, r.players.find(p => p.id === s.id).conn, { t: 'grab', v: true }); tick(r, 1.2); m.goats = []; tick(r, 21);
  check('Nachspielzeit abgelaufen → Verteidiger gewinnt', r.results && r.results.winner === 0 && r.results.reason === 'overtime'); }
{ const { r, m, S } = setup(); const s = S[0]; freezeHerd(m); startWave(r, m, 3); m.queue = []; m.goats = [{ id: 1, type: 'normal', s: 1, r: 0.45, x: 0.8, z: 0.8, hp: 9, maxHp: 9, speed: 0, eat: 3, state: 'eat', stagger: 0, ry: 0, slow: 1 }];
  s.x = HEIST.omi.x; s.z = HEIST.omi.z + 0.5; m.cake.state = 'carried'; m.cake.by = s.id; m.cake.hp = 0.01; tick(r, 0.05);
  check('Gleichzeitig: Ablieferung schlägt Kuchenverlust (getragener Kuchen wird nicht gefressen)', r.results && r.results.reason === 'delivered'); }
{ const { r, m, S } = setup(); r.remove(r.players.find(p => p.id === S[0].id)); tick(r, 0.1); check('Schaf verlässt das Spiel → Verteidiger gewinnt kampflos', r.results && r.results.winner === 0 && r.results.reason === 'forfeit'); }
// ---------- 12. Laufzeit über ein ganzes Match (KI ohne Endlosschleifen) ----------
{ const { r, m, D } = setup('2v2', 3); let ticks = 0, worst = 0; const t0 = performance.now();
  while (r.state === 'match' && ticks < 20 * 60 * 15) { if (m.phase === 'wave') { for (const g of m.goats.slice(0, 4)) g.hp -= g.type === 'king' ? 0.3 : 0.12; m.goats = m.goats.filter(g => g.hp > 0); } const a = performance.now(); r.tick(0.05); worst = Math.max(worst, performance.now() - a); ticks++; m.cake.hp = 100; }
  check('Ganzes 2v2-Match bis zum Ende simuliert (8 Wellen)', r.state === 'results' && r.results.waves === 8, `Welle ${m.wave} ${m.phase} Ziegen ${m.goats.length}+${m.queue.length} ${m.goats.slice(0,3).map(g=>g.type+':'+g.hp.toFixed(1)+':'+g.x.toFixed(0)+','+g.z.toFixed(0)).join(' ')} ${(ticks / 20 / 60).toFixed(1)} min Spielzeit, ${((performance.now() - t0) / 1000).toFixed(1)} s Rechenzeit, Takt max ${worst.toFixed(2)} ms`);
}
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} bestanden (Server-Simulation, kein Browser)`);
