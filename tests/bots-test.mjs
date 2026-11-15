// V7.1 KI-Tests (Server-Simulation): Fairness, Solo-Räume, Verhalten, Schwierigkeiten, Leistung
import { Room } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';
import { playMatch } from './bots-sim.mjs';
import fs from 'fs';
const res = []; const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); res.push(l); console.log(l); };
const conn = () => { const c = { out: [], send: s => c.out.push(JSON.parse(s)), close() { c.closed = true; } }; return c; };
const startBots = (s, d, seed = 7) => { const r = new Room({ code: 'T', mode: 'kuchenkrieg', size: '1v1', seed }, MODES); r.addBot(0, d); r.addBot(1, s); for (let i = 0; i < 100 && r.state !== 'match'; i++) r.tick(0.05); return r; };
const P = (r, role) => [...r.match.players.values()].find(p => p.role === role);

/* ---------- Solo-Räume ---------- */
{ const r = new Room({ code: 'S1', mode: 'kuchenkrieg', size: 'solo', seed: 3, role: 'sheep', diff: 'hard' }, MODES);
  check('Solo-Raum: KI-Wächter (Schwer) sofort angelegt', r.players.length === 1 && r.players[0].bot && r.players[0].team === 0 && r.players[0].name === 'KI · Wächter (Schwer)');
  const c = conn(); r.open(c); r.message(c, JSON.stringify({ t: 'hello', name: 'Rio' })); r.tick(0.05);
  check('Solo: Mensch landet im gewählten Team (Schaf) und das Spiel startet ohne Bereit/Countdown', r.state === 'match' && r.players.find(p => !p.bot).team === 1);
  const c2 = conn(); r.open(c2); r.message(c2, JSON.stringify({ t: 'hello', name: 'Zweiter' }));
  check('Solo: kein zweiter Mensch kann beitreten', r.players.length === 2 && c2.out.some(m => m.t === 'error'));
  check('Solo-Raum gilt als voll', r.publicInfo().full === true);
  const before = r.players.length; r.message(c, JSON.stringify({ t: 'addbot', team: 1 })); check('Solo: keine zusätzlichen KIs', r.players.length === before);
  r.match.cake.hp = 0; for (let i = 0; i < 200 && r.state !== 'results'; i++) r.tick(0.05);
  check('Solo: Ergebnis nach Spielende', r.state === 'results');
  r.message(c, JSON.stringify({ t: 'rematch' })); r.tick(0.05); check('Solo: Revanche startet sofort (KI will immer)', r.state === 'match' && r.match.wave <= 1);
  const r2 = new Room({ code: 'S2', mode: 'kuchenkrieg', size: 'solo', seed: 3 }, MODES); check('Solo: Standard = Verteidiger gegen KI-Schaf Mittel', r2.soloTeam === 0 && r2.players[0].name === 'KI · Schaf (Mittel)');
  let threw = false; try { new Room({ code: 'S3', mode: 'royale', size: 'solo' }, MODES); } catch (e) { threw = true; } check('GOAT ROYALE: kein Solo (Modus ohne KI)', threw); }
/* ---------- Mehrspieler-Lobby: KI füllt freie Plätze ---------- */
{ const r = new Room({ code: 'M1', mode: 'kuchenkrieg', size: '2v2', seed: 4 }, MODES); const c = conn(); r.open(c); r.message(c, JSON.stringify({ t: 'hello', name: 'A' }));
  for (let i = 0; i < 5; i++) r.message(c, JSON.stringify({ t: 'addbot', team: 1, diff: 'easy' }));
  check('addbot: nie mehr KIs als freie Plätze im Team', r.players.filter(p => p.team === 1).length === 2);
  r.message(c, JSON.stringify({ t: 'addbot', team: 0 })); check('addbot: Kapazität 4 wird eingehalten', r.players.length === 4);
  const b = r.players.find(p => p.bot); r.message(c, JSON.stringify({ t: 'kickbot', id: b.id })); check('kickbot entfernt eine KI', r.players.length === 3);
  const h = r.players.find(p => !p.bot); r.message(c, JSON.stringify({ t: 'kickbot', id: h.id })); check('kickbot entfernt keine Menschen', r.players.includes(h));
  r.message(c, JSON.stringify({ t: 'addbot', team: b.team })); r.message(c, JSON.stringify({ t: 'ready', v: true })); for (let i = 0; i < 400 && r.state !== 'match'; i++) r.tick(0.05);
  check('Match mit KI-Mitspielern startet', r.state === 'match');
  check('KI-Namen klar gekennzeichnet', r.players.filter(p => p.bot).every(p => /^KI · /.test(p.name))); }
/* ---------- Fairness: Wahrnehmung ---------- */
{ const r = startBots('normal', 'hard'), m = r.match, D = P(r, 'def'), S = P(r, 'sheep'); const src = fs.readFileSync(new URL('../shared/bots.js', import.meta.url), 'utf8');
  const see = o => { let rows; D.bot.step(m, D, 0, { send() { }, perceive: (v, opt) => (rows = MODES.kuchenkrieg.perceiveForTest(m, v, opt)), WEAPONS: {} }); return rows; };
  const perceive = MODES.kuchenkrieg.perceiveForTest;
  check('Wahrnehmung exportiert (für Tests)', typeof perceive === 'function');
  const rows = perceive(m, D, { fov: 3.2, sight: 99, yaw: D.yaw });
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))].sort().join(',');
  check('Wahrnehmung liefert keine Identität (nur sid, Position, Animation, sichtbare Merkmale)', keys === 'anim,carry,d,shield,sid,tail,x,z', keys);
  check('Spieler-Schaf und Herden-Schafe haben dieselbe Zeilenform', rows.some(r => r.sid === S.sid) && rows.filter(r => r.sid !== S.sid).length >= 5);
  // hinter einer Mauer: Wächter in der Festung (Boden), Schaf direkt hinter einer hohen Mauer
  for (const k in m.fort.walls) { m.fort.walls[k].lvl = 3; m.fort.walls[k].hp = 999; }
  D.x = 0; D.z = 0; D.y = 0; S.x = 0; S.z = -6.2; S.y = 0; S.camoUntil = 0; m.npcs.length = 0; m.smokes.length = 0;
  let v = perceive(m, D, { fov: 3.2, sight: 40, yaw: 0 }); check('Kein Blick durch Mauern (Stahlmauer verdeckt Schaf dahinter)', !v.some(r => r.sid === S.sid));
  for (const k in m.fort.walls) m.fort.walls[k].lvl = 0;
  v = perceive(m, D, { fov: 3.2, sight: 40, yaw: 0 }); check('Ohne Mauer ist dasselbe Schaf sichtbar', v.some(r => r.sid === S.sid));
  S.z = -20; v = perceive(m, D, { fov: 3.2, sight: 12, yaw: 0 }); check('Sichtweite begrenzt', !v.some(r => r.sid === S.sid));
  S.z = 20; v = perceive(m, D, { fov: 0.9, sight: 40, yaw: 0 }); check('Sichtkegel begrenzt (hinter dem Rücken unsichtbar)', !v.some(r => r.sid === S.sid));
  S.z = -20; m.smokes.push({ x: 0, z: -10, t: 5, r: 5 }); v = perceive(m, D, { fov: 3.2, sight: 40, yaw: 0 }); check('Rauch verdeckt die Sicht', !v.some(r => r.sid === S.sid)); m.smokes.length = 0;
  S.z = -4; v = perceive(m, D, { fov: 3.2, sight: 40, yaw: 0 }); const row = v.find(r => r.sid === S.sid);
  check('Schwarzer Schwanz nur aus der Nähe erkennbar', row && row.tail === 1);
  S.z = -20; v = perceive(m, D, { fov: 3.2, sight: 40, yaw: 0 }); check('… und aus der Ferne nicht', v.find(r => r.sid === S.sid).tail === 0);
  S.camoUntil = m.time + 10; S.z = -4; v = perceive(m, D, { fov: 3.2, sight: 40, yaw: 0 }); check('Tarnung versteckt den Schwanz auch vor der KI', v.find(r => r.sid === S.sid).tail === 0);
  const defSrc = src.slice(src.indexOf('class DefBrain'), src.indexOf('export function makeBrain'));
  check('KI-Wächter liest keine Schafspieler-Identität (kein Zugriff auf Spieler-Schafe im Quelltext)', !/role === 'sheep'|\.role===.sheep|m\.players/.test(defSrc));
  check('KI-Wächter nutzt nur perceive() für Schafe', /api\.perceive\(/.test(defSrc)); }
/* ---------- Gleiche Regeln: KI-Nachrichten laufen durch die Validierung ---------- */
{ const r = startBots('normal', 'normal'), m = r.match, S = P(r, 'sheep'); const sr = S.speedRejects;
  MODES.kuchenkrieg.onMsg(m, { id: S.id }, { t: 'in', c: S.cseq, x: S.x + 30, z: S.z, y: 0, yaw: 0, pitch: 0 });
  check('Teleport einer KI wird wie beim Menschen abgelehnt', S.speedRejects > sr);
  const coins = S.coins; S.coins = 0; MODES.kuchenkrieg.onMsg(m, { id: S.id }, { t: 'buy', item: 'camo' }); check('KI kann ohne Münzen nichts kaufen', !(S.inv.camo > 0)); S.coins = coins;
  const lives = S.lives; for (let i = 0; i < 20; i++) r.tick(0.05); check('KI bekommt keine Extra-Leben', S.lives <= lives); }
/* ---------- Omi kommentiert auch KI-Ereignisse ---------- */
{ const seen = new Set(), fl = MODES.kuchenkrieg.flush; MODES.kuchenkrieg.flush = m => { for (const e of m.ev) if (e.k === 'omi') seen.add(e.q); fl(m); };
  for (const seed of [1000, 1036, 8955]) { const r = startBots('hard', 'easy', seed); for (let i = 0; i < 20 * 60 * 9 && r.state === 'match'; i++) r.tick(0.05); }
  MODES.kuchenkrieg.flush = fl;
  check('Omi kommentiert den Tod des KI-Schafs', seen.has('die'), [...seen].join(','));
  check('Omi kommentiert Diebstahl durch die KI', seen.has('steal')); }
/* ---------- Verhalten in ganzen Matches ---------- */
const DIFFS = ['easy', 'normal', 'hard'], rows = [];
for (const s of DIFFS) for (const d of DIFFS) for (let k = 0; k < 12; k++) rows.push(playMatch(s, d, 1000 + k * 7919 + DIFFS.indexOf(s) * 31 + DIFFS.indexOf(d) * 5));
const sum = f => rows.reduce((a, o) => a + f(o), 0);
check('KI-Schaf bricht ein (Einbrüche)', sum(o => o.sheep.entries) > 20, sum(o => o.sheep.entries));
check('KI-Schaf stiehlt den Kuchen', sum(o => o.steals) > 10, sum(o => o.steals));
check('KI-Schaf liefert bei der Omi ab (gewinnt)', rows.some(o => o.reason === 'delivered'), rows.filter(o => o.reason === 'delivered').length + ' Lieferungen');
check('KI-Schaf verliert auch (Wächter hält 8 Wellen)', rows.some(o => o.winner === 0 && o.wave === 8));
check('KI-Schaf nutzt Gegenstände (Rauch/Heilung/…)', sum(o => Object.keys(o.sheep.items).length) > 0, JSON.stringify(rows.find(o => o.sDiff === 'hard').sheep.items));
check('KI-Schaf stirbt und kommt zurück (Leben)', sum(o => o.sheep.deaths) > 0);
check('KI-Schaf überquert Mauern regelkonform (0 Mauer-/Höhen-/Tempo-Verstöße)', sum(o => o.sheep.rejects.wall + o.sheep.rejects.y + o.sheep.rejects.speed) === 0, JSON.stringify(rows.map(o => o.sheep.rejects.wall)));
check('KI-Wächter ohne Verstöße', sum(o => o.def.rejects.speed + o.def.rejects.wall) === 0);
check('KI-Wächter schießt Ziegen (Matches ab Welle 4)', rows.filter(o => o.wave >= 4).every(o => o.kills > 30), Math.min(...rows.filter(o => o.wave >= 4).map(o => o.kills)));
check('KI-Wächter baut/repariert Mauern (Matches ab Welle 3)', rows.filter(o => o.wave >= 3).every(o => (o.def.buys.stone || 0) + (o.def.buys.wood || 0) + (o.def.buys.repairall || 0) > 0));
check('KI-Wächter kauft Werwölfe', rows.some(o => o.def.buys.wolf > 0));
check('KI-Wächter verfolgt Diebe', sum(o => o.def.chases) > 5);
check('KI-Wächter-Siege nur nach allen 8 Wellen (inkl. 100-Ziegen-Finale)', rows.filter(o => o.winner === 0).every(o => o.wave === 8 && o.reason === 'survived'), rows.filter(o => o.winner === 0).length + ' Siege');
check('Finale vorbereitet: im Finale kauft der Wächter Werwölfe/Ausbau', rows.filter(o => o.wave === 8).filter(o => (o.def.buys.wolf || 0) + (o.def.buys.steel || 0) + (o.def.buys.stone || 0) > 0).length >= rows.filter(o => o.wave === 8).length * 0.9);
const rate = (s, d) => { const x = rows.filter(o => (!s || o.sDiff === s) && (!d || o.dDiff === d)); return x.filter(o => o.winner === 1).length / x.length; };
check('Beide Seiten gewinnen Matches', rows.some(o => o.winner === 1) && rows.some(o => o.winner === 0), rows.filter(o => o.winner === 1).length + ' Schaf / ' + rows.filter(o => o.winner === 0).length + ' Wächter');
check('Schwierigkeit messbar: Schaf gewinnt gegen Leicht öfter als gegen Schwer', rate(null, 'easy') > rate(null, 'hard'), rate(null, 'easy').toFixed(2) + ' vs ' + rate(null, 'hard').toFixed(2));
const st = d => rows.filter(o => o.dDiff === d).reduce((a, o) => a + o.steals, 0) / 36;
check('Schwierigkeit messbar: weniger Diebstähle gegen Schwer als gegen Leicht', st('hard') < st('easy'), st('easy').toFixed(2) + ' / ' + st('normal').toFixed(2) + ' / ' + st('hard').toFixed(2) + ' je Match');
for (const d of DIFFS) check('Wächter ' + d + ': beide Seiten gewinnen', rows.filter(o => o.dDiff === d).some(o => o.winner === 1) && rows.filter(o => o.dDiff === d).some(o => o.winner === 0), (rate(null, d) * 100).toFixed(0) + ' % Schaf-Siege');
for (const s of DIFFS) check('Schaf ' + s + ': beide Seiten gewinnen', rows.filter(o => o.sDiff === s).some(o => o.winner === 1) && rows.filter(o => o.sDiff === s).some(o => o.winner === 0), (rate(s, null) * 100).toFixed(0) + ' % Schaf-Siege');
const kpm = d => { const x = rows.filter(o => o.dDiff === d); return x.reduce((a, o) => a + o.def.sheepKills, 0) / x.reduce((a, o) => a + o.min, 0); };
console.log('INFO Schaf-Abschüsse je Minute (Leicht/Mittel/Schwer): ' + kpm('easy').toFixed(2) + ' / ' + kpm('normal').toFixed(2) + ' / ' + kpm('hard').toFixed(2));
console.log('MATRIX ' + JSON.stringify(Object.fromEntries(DIFFS.flatMap(s => DIFFS.map(d => [s + '-' + d, rate(s, d)])))));
/* ---------- Leistung ---------- */
const botMs = Math.max(...rows.map(o => o.botMs)), tick = Math.max(...rows.map(o => o.msPerTick)), worst = Math.max(...rows.map(o => o.worstMs));
check('KI-Rechenzeit klein (≤ 0,2 ms je Takt)', botMs <= 0.2, botMs + ' ms');
check('Servertakt mit KI im Rahmen (Mittel ≤ 2 ms, Spitze ≤ 50 ms)', tick <= 2 && worst <= 50, tick + ' ms / max ' + worst + ' ms');
const pass = res.filter(l => l.startsWith('PASS')).length; console.log(`\n${pass}/${res.length} bestanden (KI-Server-Simulation, kein Browser)`); process.exit(pass === res.length ? 0 : 1);
