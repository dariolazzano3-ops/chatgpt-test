// V6.1 Kuchenkrieg – reine Server-Simulation (ohne Browser): Arena, PvP, Werwölfe, Boost, 5 Wellen, Ziegenkönig, Sieg, Koop.
import { Room } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';
import { makeWave5, toGlobal, toLocal, PVP, WOLF, BOOST, KING, WAVE_NAMES, COVERS } from '../shared/rules.js';
const res = []; const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); res.push(l); console.log(l); };
const mk = () => ({ out: [], send(t) { this.out.push(JSON.parse(t)); }, close() { } });
function setup(size = '1v1', seed = 7) {
  const r = new Room({ code: 'KKKKK', mode: 'kuchenkrieg', size, seed }, MODES); const cs = [];
  const n = size === '1v1' ? 2 : size === 'coop' ? 2 : 4;
  for (let i = 0; i < n; i++) { const c = mk(); r.open(c); r.message(c, JSON.stringify({ hello: 1, t: 'hello', name: 'P' + i })); cs.push(c); }
  for (const c of cs) r.message(c, '{"t":"ready","v":true}');
  for (let i = 0; i < 70; i++) r.tick(0.05);
  const m = r.match; const P = [...m.players.values()];
  return { r, cs, m, P, csOf: ps => cs[r.players.findIndex(p => p.id === ps.id)] };
}
let seq = 1; const send = (r, c, o) => { for (const p of r.players) p.rateN = 0; r.message(c, JSON.stringify({ seq: ++seq, ...o })); };
const evs = (c, k) => c.out.filter(x => x.t === 'snap').flatMap(x => x.ev).filter(e => e.k === k);
const tickN = (r, n, dt = 0.05) => { for (let i = 0; i < n; i++) r.tick(dt); };
const startWave = (r, m) => { while (m.phase !== 'wave') r.tick(0.05); };
const killAll = (m) => { for (const w of m.worlds) { w.queue = []; w.goats = []; } };

{ const w1 = makeWave5(1, 7), w5 = makeWave5(5, 7), names = [1, 2, 3, 4, 5].map(i => makeWave5(i, 7).name);
  check('Genau 5 Wellen mit eigenen Namen', names.join('|') === WAVE_NAMES.join('|') && names.length === 5, names.join(', '));
  const counts = [1, 2, 3, 4, 5].map(i => makeWave5(i, 7).list.length);
  check('Wellen werden stärker: 12 → 18 → 20 → 28, Welle 5 Boss + 16', counts.join() === '12,18,20,28,17', counts.join());
  check('Welle 2: Zicklein; Welle 3+: Böcke; Welle 5: Ziegenkönig zuerst', makeWave5(2, 7).list.some(e => e.type === 'kid') && makeWave5(3, 7).list.some(e => e.type === 'bock') && w5.list[0].type === 'king' && w5.king);
  check('Angriffe nur von der Außenseite der eigenen Festung', [1, 2, 3, 4, 5].every(i => makeWave5(i, 7).list.every(e => Math.sin(e.a) >= -0.36)));
  check('2v2: mehr Ziegen pro Welle (Faktor 1,4)', makeWave5(4, 7, 2).list.length === Math.round(28 * 1.4));
  const [gx, gz] = toGlobal(1, 3, 4), [lx, lz] = toLocal(1, gx, gz); check('Koordinaten-Spiegelung ist umkehrbar und punktsymmetrisch', lx === 3 && lz === 4 && gx === -3 && gz === -20 && toGlobal(0, 3, 4).join() === '3,20');
  check('Deckungen punktsymmetrisch (faire Arena)', COVERS.every(c => COVERS.some(o => o.x === -c.x && o.z === -c.z && o.w === c.w)));
}
{ const { r, cs, m, P, csOf } = setup();
  const [a, b] = [P.find(p => p.team === 0), P.find(p => p.team === 1)];
  check('Gemeinsame Arena: Käse bei z>0, Beere bei z<0 (Spawn im eigenen Fort)', a.z > 15 && b.z < -15, `${a.z.toFixed(1)} / ${b.z.toFixed(1)}`);
  const s0 = cs[0].out.filter(x => x.t === 'snap').pop(); check('Snapshot: alle Spieler beider Teams, beide Welten', s0.mode === 'kk' && s0.players.length === 2 && s0.worlds.length === 2 && s0.maxWaves === 5);
  startWave(r, m); tickN(r, 30);
  const s1 = cs[0].out.filter(x => x.t === 'snap').pop();
  check('Welle 1 „Der Angriff“ startet, Ziegen in beiden Welten', m.wave === 1 && s1.waveName === 'Der Angriff' && s1.worlds.every(w => w.goats.length > 0));
  const g0 = m.worlds[0].goats[0], g1 = m.worlds[1].goats[0];
  check('Gespiegelt: gleiche lokale Ziegenposition in beiden Welten', Math.abs(g0.x - g1.x) < 1e-9 && Math.abs(g0.z - g1.z) < 1e-9);
  check('Käse-Ziegen kommen von Norden (global z>16), Beere von Süden', s1.worlds[0].goats.every(g => g[3] > 10) && s1.worlds[1].goats.every(g => g[3] < -10));
  // PvP
  a.prot = b.prot = 0; a.x = 3; a.z = 8; b.x = 3; b.z = 2; a.y = b.y = 0; tickN(r, 1); // x=3: freie Schusslinie neben den Deckungen
  send(r, csOf(a), { t: 'shot', w: 'blaster', o: [3, 1.0, 8], d: [0, 0, -1] }); tickN(r, 1);
  check('PvP: Körpertreffer 9 Schaden (Server)', b.hp === 91, b.hp);
  a.lastShot = {}; m.time += 1; b.x = 3; b.z = 2; send(r, csOf(a), { t: 'shot', w: 'blaster', o: [3, 1.62, 8], d: [0, 0, -1] }); tickN(r, 1);
  check('PvP: Kopftreffer ×1,5', Math.abs(b.hp - (91 - 13.5)) < 1e-6, b.hp);
  b.prot = 2; const hp0 = b.hp; a.lastShot = {}; m.time += 1; b.x = 3; b.z = 2; send(r, csOf(a), { t: 'shot', w: 'blaster', o: [3, 1.0, 8], d: [0, 0, -1] }); tickN(r, 1);
  check('Spawn-Schutz blockt Schaden', b.hp === hp0 && evs(cs[0], 'shield').length > 0); b.prot = 0;
  // Reichweite: Schrotflinte über 20 m wirkungslos
  a.owned.add('shotgun'); a.ammo.shotgun = 6; a.z = 2 + 24; a.x = 3; b.x = 3; b.z = 2; a.lastShot = {}; m.time += 1; const hp1 = b.hp;
  send(r, csOf(a), { t: 'shot', w: 'shotgun', o: [3, 1.0, a.z], d: [0, 0, -1] }); tickN(r, 1);
  check('Begrenzte Reichweite: Schrotflinte auf 24 m macht keinen Spielerschaden', b.hp === hp1);
  // Deckung blockt
  a.x = 7; a.z = 3; b.x = 7; b.z = -3; a.lastShot = {}; m.time += 1; const hp2 = b.hp;
  send(r, csOf(a), { t: 'shot', w: 'blaster', o: [7, 1.0, 3], d: [0, 0, -1] }); tickN(r, 1);
  check('Deckung in der Mitte blockt Schüsse', b.hp === hp2);
  // Abschuss → Respawn, Münzen für das Team des Schützen
  a.x = 3; a.z = 8; b.x = 3; b.z = 2; b.hp = 5; const coins0 = m.worlds[0].coins; a.lastShot = {}; m.time += 1;
  send(r, csOf(a), { t: 'shot', w: 'blaster', o: [3, 1.0, 8], d: [0, 0, -1] }); tickN(r, 1);
  check('PvP-Abschuss: Gegner tot, +20 Münzen und Punkte fürs Team', b.dead && m.worlds[0].coins === coins0 + PVP.killCoins && a.pkills === 1 && evs(cs[0], 'pkill').length === 1);
  m.time += 0.1; send(r, csOf(b), { t: 'shot', w: 'blaster', o: [b.x, 1, b.z], d: [0, 0, 1] }); check('Tote können nicht schießen (außer im selben Server-Takt: Trade-Kill)', (b.rejects.dead || 0) === 1);
  tickN(r, Math.ceil(PVP.respawn / 0.05) + 2);
  check('Respawn nach 4 s im eigenen Fort mit vollem Leben und Schutz', !b.dead && b.hp === 100 && b.prot > 0 && b.z < -14, `z ${b.z.toFixed(1)}`);
  // Mauern des Gegners beschießbar, eigene nicht
  m.worlds[1].walls.S = { built: true, hp: 60, maxHp: 60, lvl: 0 }; // Beere-Südmauer = Richtung Mitte? lokal S = +z = außen; Norden zeigt zur Mitte
  m.worlds[1].walls.N = { built: true, hp: 60, maxHp: 60, lvl: 0 }; const [wx, wz] = toGlobal(1, 3, -5);
  a.x = wx; a.z = wz + 8; a.lastShot = {}; m.time += 1; b.x = 10; b.z = -20;
  send(r, csOf(a), { t: 'shot', w: 'blaster', o: [a.x, 1.0, a.z], d: [0, 0, -1] }); tickN(r, 1);
  check('Gegnerische Mauer nimmt Schaden durch Schüsse', m.worlds[1].walls.N.hp < 60, m.worlds[1].walls.N.hp);
  // Werwölfe
  const w0 = m.worlds[0]; w0.coins = 500;
  send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1);
  check('Werwolf vor Welle 3 nicht kaufbar', m.wolves.length === 0 && evs(cs[0], 'buyfail').some(e => e.item === 'wolf' && e.why === 'wave'));
  killAll(m); while (!(m.phase === 'wave' && m.wave === 3)) { if (m.phase === 'wave') killAll(m); r.tick(0.05); }
  w0.coins = 130; send(r, csOf(a), { t: 'buy', item: 'wolf' }); send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1);
  check('Welle 3: Kauf klappt, 60 Münzen genau einmal, Doppelkauf durch Abklingzeit verhindert', m.wolves.length === 1 && w0.coins === 70 && evs(cs[0], 'buyfail').some(e => e.why === 'cooldown'), `${m.wolves.length} Wölfe, ${w0.coins} Münzen`);
  w0.wolfReadyAt = 0; send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1); w0.wolfReadyAt = 0; w0.coins = 500; send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1);
  check('Höchstens 2 Werwölfe pro Team', m.wolves.filter(f => f.team === 0 && !f.dead).length === 2 && evs(cs[0], 'buyfail').some(e => e.why === 'max'));
  w0.coins = 10; m.wolves.forEach(f => f.dead = true); tickN(r, 30); w0.wolfReadyAt = 0; send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1);
  check('Kauf ohne genug Münzen abgelehnt', m.wolves.filter(f => !f.dead).length === 0 && evs(cs[0], 'buyfail').some(e => e.why === 'coins'));
  // Wolf jagt Ziege nahe am eigenen Kuchen
  w0.coins = 60; w0.wolfReadyAt = 0; w0.goats = []; w0.queue = []; send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1);
  const f = m.wolves.find(x => !x.dead); w0.goats.push({ id: 900, type: 'normal', s: 1, r: 0.45, x: 7, z: 3, hp: 6, maxHp: 6, speed: 0, eat: 3, state: 'walk', stagger: 0, wp: null, wpTried: true, ry: 0, dead: false });
  const k0 = w0.kills; tickN(r, 120);
  check('Werwolf erkennt Zombie-Ziege, verfolgt und tötet sie (Bisse)', w0.kills === k0 + 1 && evs(cs[0], 'wolfbite').length >= 2, `Kills +${w0.kills - k0}`);
  // Wolf beißt Gegner in der eigenen Festung
  b.dead = false; b.prot = 0; b.hp = 100; const [bx, bz] = toGlobal(0, 3, 2); b.x = bx; b.z = bz; tickN(r, 60);
  check('Werwolf greift Gegner in der eigenen Festung an', b.hp < 100 || b.dead, `HP ${b.hp}`);
  // Gegner tötet Wolf
  const fw = m.wolves.find(x => !x.dead && x.team === 0); b.dead = false; b.hp = 100; b.prot = 0; b.owned.add('sniper'); b.ammo.sniper = 5;
  for (let i = 0; i < 3 && fw && !fw.dead; i++) { b.x = fw.x; b.z = fw.z - 6; b.lastShot = {}; b.reloadUntil = 0; m.time += 2; send(r, csOf(b), { t: 'shot', w: 'sniper', o: [b.x, 1.2, b.z], d: [fw.x - b.x, 0, fw.z - b.z] }); r.tick(0.01); }
  check('Werwolf nimmt Schaden und stirbt bei 0 Leben', fw && fw.dead && evs(cs[0], 'wolfdie').length > 0);
  // Einsatzdauer
  w0.coins = 60; w0.wolfReadyAt = 0; send(r, csOf(a), { t: 'buy', item: 'wolf' }); tickN(r, 1); const fl = m.wolves.find(x => !x.dead && x.team === 0);
  fl.life = 0.2; tickN(r, 6); check('Einsatzdauer endet (30 s, hier verkürzt)', fl.dead);
  // Boost
  a.dead = false; a.x = 0; a.z = 10; a.y = 0; a.cseq = a.cseq || 1; const c0 = a.cseq;
  let t0 = m.time; send(r, csOf(a), { t: 'in', c: a.cseq, x: 0, z: 10, y: 4, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05);
  check('Ohne Boost: Höhe auf normalen Sprung begrenzt', a.y <= BOOST.jumpY + 1e-9, a.y);
  send(r, csOf(a), { t: 'boost' }); for (let i = 0; i < 10; i++) { send(r, csOf(a), { t: 'in', c: a.cseq, x: 0, z: 10, y: Math.min(5, 0.6 * i), yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05); }
  check('Mit Boost: höher als normaler Sprung, aber begrenzt', a.y > 2 && a.y <= BOOST.maxY, a.y.toFixed(2));
  send(r, csOf(a), { t: 'in', c: a.cseq, x: 0, z: 10, y: 50, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05);
  check('Boost: kein Flug über 5,2 m', a.y <= BOOST.maxY);
  const rb = a.rejects.boost || 0; send(r, csOf(a), { t: 'boost' }); r.tick(0.05);
  check('Boost-Abklingzeit 6 s erzwungen', (a.rejects.boost || 0) === rb + 1);
  m.time += BOOST.cooldown; send(r, csOf(a), { t: 'boost' }); r.tick(0.05); check('Nach Abklingzeit wieder verfügbar', (a.rejects.boost || 0) === rb + 1 && a.boosts === 2);
  a.y = 0; send(r, csOf(a), { t: 'in', c: a.cseq, x: 0, z: 10, y: 5, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05);
  check('Steigrate begrenzt (kein Teleport nach oben)', a.y <= 3.1 + 1e-9, a.y.toFixed(2));
  // Teleport-Schutz horizontal
  const zx = a.z; send(r, csOf(a), { t: 'in', c: a.cseq, x: 0, z: -20, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05);
  check('Horizontale Teleports gekappt', Math.abs(a.z - zx) < 2.2, `${zx.toFixed(1)} → ${a.z.toFixed(1)}`);
  send(r, csOf(a), { t: 'in', c: a.cseq, x: 60, z: 0, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); for (let i = 0; i < 40; i++) { send(r, csOf(a), { t: 'in', c: a.cseq, x: 60, z: 0, y: 0, yaw: 0, pitch: 0, w: 'blaster', cr: false }); r.tick(0.05); }
  check('Arena-Grenze serverseitig', Math.abs(a.x) <= 24, a.x.toFixed(1));
}
// Welle 5: Ziegenkönig
{ const { r, cs, m, P, csOf } = setup('1v1', 11); const [a, b] = [P.find(p => p.team === 0), P.find(p => p.team === 1)];
  m.wave = 4; m.phase = 'countdown'; m.phaseT = 0.01; r.tick(0.05);
  check('Welle 5 „Ziegenkönig“', m.wave === 5 && cs[0].out.filter(x => x.t === 'snap').pop().waveName === 'Ziegenkönig');
  tickN(r, 15); const w = m.worlds[0], king = w.goats.find(g => g.type === 'king');
  check('Boss serverseitig in beiden Welten (gleiche Bedingungen)', !!king && m.worlds[1].goats.some(g => g.type === 'king') && evs(cs[0], 'king').length === 2);
  check('Boss-Leben skaliert, groß und eigener Typ (Index 3)', king.maxHp === KING.hp && cs[0].out.filter(x => x.t === 'snap').pop().worlds[0].goats.some(g => g[1] === 3));
  // Sturmangriff: Spieler 8 m entfernt
  const [kx, kz] = toGlobal(0, king.x, king.z); a.x = kx; a.z = kz - 8; if (!(a.z > 0)) a.z = kz + 8; a.prot = 0; a.dead = false; a.hp = 100; king.chargeCd = 0; king.stompCd = 99;
  const ax = a.x, az = a.z; let wind = false, charge = false; for (let i = 0; i < 60; i++) { a.x = ax; a.z = az; r.tick(0.05); const e = cs[0].out.filter(x => x.t === 'snap').pop().ev; if (e.some(x => x.k === 'kingwind' && x.kind === 'charge')) wind = true; if (e.some(x => x.k === 'kingcharge')) charge = true; if (a.hp < 100) break; }
  check('Bossattacke 1: angekündigter Sturmangriff trifft', wind && charge && a.hp <= 100 - KING.chargeDmg, `HP ${a.hp}`);
  // Erschöpft = Schwachstelle
  while (king.state === 'charge') r.tick(0.05);
  check('Nach dem Sturm erschöpft (Schwachstelle)', king.state === 'tired');
  const hpT = king.hp; const [kx2, kz2] = toGlobal(0, king.x, king.z); a.x = kx2; a.z = kz2 + 6; a.lastShot = {}; a.reloadUntil = 0; m.time += 1;
  send(r, csOf(a), { t: 'shot', w: 'blaster', o: [a.x, 1.0, a.z], d: [kx2 - a.x, 0, kz2 - a.z] }); r.tick(0.01);
  check('Erschöpfter Boss nimmt doppelten Schaden', Math.abs(hpT - king.hp - 2) < 1e-6, (hpT - king.hp).toFixed(2));
  // Stampfer
  while (king.state === 'tired') r.tick(0.05);
  const [kx3, kz3] = toGlobal(0, king.x, king.z); a.x = kx3 + 2; a.z = kz3; a.hp = 100; a.prot = 0; a.dead = false; king.stompCd = 0; king.chargeCd = 99; let stomp = false;
  for (let i = 0; i < 30; i++) { a.x = kx3 + 2; a.z = kz3; r.tick(0.05); if (cs[0].out.filter(x => x.t === 'snap').pop().ev.some(x => x.k === 'kingstomp')) { stomp = true; break; } }
  check('Bossattacke 2: angekündigter Stampfer im Umkreis', stomp && a.hp <= 100 - KING.stompDmg, `HP ${a.hp}`);
  // Beschwörung bei 50 %
  const before = w.goats.filter(g => g.type === 'kid').length; king.hp = king.maxHp * 0.45; r.tick(0.05);
  check('Bossattacke 3: Zicklein-Beschwörung bei halber Energie', w.goats.filter(g => g.type === 'kid').length >= before + 4 && evs(cs[0], 'kingsummon').length === 1);
  // Kopf = Schwachstelle; Boss besiegen
  king.state = 'walk'; king.hp = 0.5; w.goats = w.goats.filter(g => g === king); /* Zicklein aus der Schusslinie */ const [kx4, kz4] = toGlobal(0, king.x, king.z); a.x = kx4; a.z = kz4 + 6; a.dead = false; a.lastShot = {}; m.time += 1;
  send(r, csOf(a), { t: 'shot', w: 'blaster', o: [a.x, 1.0, a.z], d: [kx4 - a.x, 0, kz4 - a.z] }); r.tick(0.01);
  check('Boss besiegt: Belohnung fürs Team', w.kingDown && evs(cs[0], 'kill').some(e => e.king && e.coins === 80));
  // Spielende nach 5 Wellen: beide überleben → mehr Kuchen gewinnt
  for (const ww of m.worlds) { ww.goats = []; ww.queue = []; } m.worlds[0].cake = 80; m.worlds[1].cake = 50; tickN(r, 3);
  check('Nach Welle 5 Spielende; beide überleben → mehr Kuchen gewinnt', r.state === 'results' && r.results.winner === 0 && r.results.reason === 'cake', JSON.stringify({ w: r.results?.winner, r: r.results?.reason }));
  check('Ergebnis enthält PvP-Kills und Tode je Spieler', r.results.players.every(p => 'pkills' in p && 'deaths' in p));
  for (const p of r.players) p.rateN = 0; for (const c of cs) r.message(c, '{"t":"rematch"}'); r.tick(0.05);
  check('Revanche: sauberer Neustart (Welle 0, volle Kuchen, keine Wölfe)', r.state === 'match' && r.match.wave === 0 && r.match.worlds.every(w => w.cake === 100) && r.match.wolves.length === 0);
}
// Kuchen fällt / gleichzeitig / Gleichstand
{ const { r, m } = setup('1v1', 3); startWave(r, m); m.worlds[1].cake = 0.001; m.worlds[1].goats[0] && (m.worlds[1].goats[0].state = 'eat'); m.worlds[1].cake = -1; tickN(r, 2);
  check('Kuchen zerstört → Match endet sofort, anderes Team gewinnt', r.state === 'results' && r.results.winner === 0 && r.results.reason === 'survival'); }
{ const { r, m } = setup('1v1', 4); startWave(r, m); m.worlds[0].cake = -1; m.worlds[1].cake = -1; m.worlds[0].points = 50; m.worlds[1].points = 50; tickN(r, 2);
  check('Beide Kuchen im selben Moment zerstört, gleiche Punkte → Unentschieden', r.state === 'results' && r.results.winner === null && r.results.reason === 'draw'); }
{ const { r, m } = setup('1v1', 5); startWave(r, m); m.worlds[0].cake = -1; m.worlds[1].cake = -1; m.worlds[0].points = 10; m.worlds[1].points = 60; tickN(r, 2);
  check('Beide gleichzeitig zerstört → mehr Punkte gewinnt', r.results.winner === 1 && r.results.reason === 'points'); }
// 2v2: kein Eigenbeschuss, gleichzeitige Abschüsse
{ const { r, cs, m, P, csOf } = setup('2v2', 9); const t0 = P.filter(p => p.team === 0), t1 = P.filter(p => p.team === 1);
  check('2v2: vier Spieler, zwei pro Team, alle im Snapshot sichtbar', t0.length === 2 && t1.length === 2 && cs[0].out.filter(x => x.t === 'snap').pop().players.length === 4);
  for (const p of P) p.prot = 0; t0[0].x = 3; t0[0].z = 10; t0[1].x = 3; t0[1].z = 5;
  send(r, csOf(t0[0]), { t: 'shot', w: 'blaster', o: [3, 1, 10], d: [0, 0, -1] }); r.tick(0.01);
  check('2v2: kein Teamschaden', t0[1].hp === 100);
  t0[1].x = 9; t1[0].x = 3; t1[0].z = 3; t1[1].x = -3; t1[1].z = 12; t0[0].hp = 5; t1[0].hp = 5; t0[0].lastShot = {}; t1[0].lastShot = {}; m.time += 1;
  send(r, csOf(t0[0]), { t: 'shot', w: 'blaster', o: [3, 1, 10], d: [0, 0, -1] }); send(r, csOf(t1[0]), { t: 'shot', w: 'blaster', o: [3, 1, 3], d: [0, 0, 1] }); r.tick(0.01);
  check('Gleichzeitige Abschüsse: beide sterben, beide Kills zählen', t0[0].dead && t1[0].dead && t0[0].pkills === 1 && t1[0].pkills === 1);
  r.message(csOf(t1[1]), '{"t":"leave"}'); r.tick(0.05); check('Verlassen: Match läuft weiter', r.state === 'match');
}
// Koop
{ const { r, cs, m, P } = setup('coop', 21);
  check('Koop: zwei Freunde im selben Team, gegnerische Welt inaktiv', P.every(p => p.team === 0) && !m.worlds[1].active && r.capacity === 2);
  startWave(r, m); tickN(r, 20); check('Koop: nur das eigene Fort wird angegriffen', m.worlds[0].goats.length > 0 && m.worlds[1].goats.length === 0);
  for (let wv = 0; wv < 5; wv++) { while (m.phase !== 'wave' && !m.over) r.tick(0.05); killAll(m); tickN(r, 2); for (const p of r.players) p.rateN = 0; for (const c of cs) r.message(c, '{"t":"shopready","v":true}'); }
  tickN(r, 5);
  check('Koop: 5 Wellen überstanden = gemeinsamer Sieg', r.state === 'results' && r.results.coop && r.results.winner === 0 && r.results.reason === 'coopwin', JSON.stringify(r.results && { w: r.results.winner, r: r.results.reason, waves: r.results.waves }));
  let threw = false; try { new Room({ code: 'X', mode: 'royale', size: 'coop' }, MODES); } catch (e) { threw = true; } check('Koop für GOAT ROYALE nicht erlaubt', threw);
}
// Matchdauer-Abschätzung und Rechenzeit
{ const { r, m, P } = setup('2v2', 13); const t0 = performance.now(); let ticks = 0;
  for (const p of P) { p.x = 0; p.z = 0; }
  let minCake = 100;
  while (r.state === 'match' && m.time < 600) { r.tick(0.05); ticks++;
    if (m.phase === 'wave') for (const w of m.worlds) { const near = w.goats.filter(g => Math.hypot(g.x, g.z) < 15).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
      if (near) { near.hp -= 1.2 * m.room.perTeam * 0.05; if (near.hp <= 0) { near.dead = true; w.goats.splice(w.goats.indexOf(near), 1); } } minCake = Math.min(minCake, w.cake); } }
  const ms = (performance.now() - t0) / ticks;
  check('Rechenzeit pro Tick inkl. Snapshots (2v2, volle Wellen, Boss)', ms < 2, ms.toFixed(3) + ' ms');
  check('Matchdauer mit idealisiertem Verteidigungsmodell 3–7 min (echte Matches länger: Laufen, PvP, Kaufen)', r.state === 'results' && m.time > 180 && m.time < 420, (m.time / 60).toFixed(1) + ' min, Ergebnis ' + r.results?.reason + ', min. Kuchen ' + minCake.toFixed(0));
}
{ const { r, m, P, csOf } = setup(); startWave(r, m); const a = P.find(p => p.team === 0); a.x = 3; a.z = 24; a.prot = 0;
  for (let i = 0; i < 4; i++) send(r, csOf(a), { t: 'shot', w: 'blaster', o: [3, 1.6, 24], d: [0, 0, 1] });
  check('Anti-Cheat: Schnellfeuer im selben Moment abgelehnt', (a.rejects.rate || 0) >= 3, JSON.stringify(a.rejects));
  m.time += 1; send(r, csOf(a), { t: 'shot', w: 'blaster', o: [9, 1.6, 24], d: [0, 0, 1] });
  m.time += 1; send(r, csOf(a), { t: 'shot', w: 'blaster', o: [3, 6, 24], d: [0, 0, 1] });
  check('Anti-Cheat: falscher Schussursprung (seitlich / zu hoch) abgelehnt', (a.rejects.origin || 0) === 2, JSON.stringify(a.rejects));
  m.time += 1; send(r, csOf(a), { t: 'shot', w: 'sniper', o: [3, 1.6, 24], d: [0, 0, 1] });
  check('Anti-Cheat: nicht gekaufte Waffe abgelehnt', (a.rejects.weapon || 0) === 1, JSON.stringify(a.rejects));
}
console.log(`\n${res.filter(x => x.startsWith('PASS')).length}/${res.length} bestanden (Server-Simulation, kein Browser)`);
