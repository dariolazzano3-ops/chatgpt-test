// V7.2 „Schafkommando“: Server-Simulation (ohne Browser) – 15 Schafe, anrückende Herde, Tarnung, Helfer, Befehle,
// Fehlabschüsse, Kuchen als Rückenschutz, Alarmanlagen, Fluchtroute, Omi, Sicherheit.
import { Room } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';
import { HEIST, makeWave8 } from '../shared/rules.js';
const results = []; const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); results.push(l); console.log(l); };
function conn() { return { out: [], send(t) { this.out.push(t); }, close() { } }; }
let seqN = 1;
const send = (r, c, msg) => { const pl = r.players.find(p => p.conn === c); if (pl) pl.rateT = 0; /* Testtempo: Nachrichten-Drossel (80/s Echtzeit) zurücksetzen */ r.message(c, JSON.stringify({ seq: seqN++, ...msg })); };
function setup(size = '1v1', seed = 7) {
  const r = new Room({ code: 'SK', mode: 'kuchenkrieg', size, seed }, MODES); const cs = []; const n = size === '1v1' ? 2 : 4;
  for (let i = 0; i < n; i++) { const c = conn(); r.open(c); r.message(c, JSON.stringify({ t: 'hello', name: 'P' + i })); cs.push(c); }
  for (const c of cs) r.message(c, JSON.stringify({ t: 'ready', v: true }));
  for (let i = 0; i < 80 && r.state !== 'match'; i++) r.tick(0.05);
  for (let i = 0; i < 3; i++) r.tick(0.05);
  const m = r.match, P = [...m.players.values()], D = P.filter(p => p.role === 'def'), S = P.filter(p => p.role === 'sheep');
  const csOf = ps => cs[r.players.findIndex(p => p.id === ps.id)];
  return { r, m, P, D, S, cs, csOf };
}
const tick = (r, s) => { for (let i = 0; i < Math.round(s / 0.05); i++) r.tick(0.05); };
const lastSnap = c => { for (let i = c.out.length - 1; i >= 0; i--) { const o = JSON.parse(c.out[i]); if (o.t === 'snap') return o; } return null; };
const allEv = c => c.out.map(t => JSON.parse(t)).filter(o => o.t === 'snap').flatMap(o => o.ev);
function startWave(r, m, w = 1) { m.wave = w - 1; m.phase = 'countdown'; m.phaseT = 0.01; tick(r, 0.1); }
const hold = m => { m.queue = []; m.goats = [{ id: 7777, type: 'bock', s: 1.3, r: 0.58, x: 38, z: -2, hp: 1e6, maxHp: 1e6, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1, wp: null, wpTried: true }]; };
function aim(r, c, ps, x, z, tx, tz, ty = 0.78) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(ty - 1.55, d);
  ps.x = x; ps.z = z; send(r, c, { t: 'in', c: ps.cseq, x, z, y: 0, yaw, pitch, w: 'blaster' }); return { o: [x, 1.6, z], d: [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)] }; }
const shoot = (r, c, d, a) => { d.lastShot = {}; send(r, c, { t: 'shot', w: 'blaster', o: a.o, d: a.d }); tick(r, 0.05); };
const park = (m, keep = []) => m.npcs.forEach((n, i) => { if (!keep.includes(n)) { n.x = Math.cos(i) * 34; n.z = 30 + Math.sin(i) * 3; } n.state = 'graze'; n.t = 999; });
// ein Herdenschaf mit Blaster erschießen (25 LP, 12 je Treffer → 3 Treffer)
function killNpc(r, c, d, n) { n.x = 12; n.z = 12; n.state = 'graze'; n.t = 999; n.cmd = null; for (let i = 0; i < 6 && !n.dead; i++) { const a = aim(r, c, d, 6, 6, n.x, n.z); shoot(r, c, d, a); } return n.dead; }

/* ---------- 1. Exakt 15 Schafe, anrückende Herde ---------- */
{ const { r, m, D, S, csOf } = setup(); const sd = lastSnap(csOf(D[0])), ss = lastSnap(csOf(S[0]));
  check('1v1: genau 15 Schafe zu Beginn (14 Herde + 1 Schafspieler)', m.npcs.length === 14 && sd.sh.length === 15, `${m.npcs.length} NPC, ${sd.sh.length} Zeilen`);
  check('Schaf-Team sieht dieselben 15 Schafe', ss.sh.length === 15);
  const r2 = setup('2v2'); check('2v2: genau 15 Schafe (13 Herde + 2 Schafspieler)', r2.m.npcs.length === 13 && lastSnap(r2.csOf(r2.D[0])).sh.length === 15);
  const rad = () => m.npcs.reduce((a, n) => a + Math.hypot(n.x, n.z), 0) / m.npcs.length;
  startWave(r, m, 1); hold(m); const r1 = rad(); let maxStep = 0, prev = new Map(m.npcs.map(n => [n.sid, [n.x, n.z]]));
  const samples = [r1];
  for (const w of [3, 5, 7, 8]) { m.wave = w; m.waveT = 0;
    for (let i = 0; i < 1600; i++) { r.tick(0.05); for (const n of m.npcs) { const p = prev.get(n.sid); if (p) maxStep = Math.max(maxStep, Math.hypot(n.x - p[0], n.z - p[1])); prev.set(n.sid, [n.x, n.z]); } }
    samples.push(rad()); }
  check('Herde rückt Welle für Welle näher (mittlerer Abstand zur Festung)', samples.every((v, i) => i === 0 || v < samples[i - 1] + 0.5) && samples[4] < samples[0] - 10, samples.map(v => v.toFixed(1)).join(' → ') + ' m');
  check('Welle 7–8: Herde an den äußeren Festungsbereichen (< 15 m), aber nicht in der Festung', samples[4] < 15 && m.npcs.every(n => Math.max(Math.abs(n.x), Math.abs(n.z)) > 5.3), samples[4].toFixed(1) + ' m');
  check('Annäherung ohne Teleport (größter Schritt je Takt ≤ 0,4 m)', maxStep <= 0.4, maxStep.toFixed(3) + ' m');
  const st = new Set(m.npcs.map(n => n.state)); check('Herde grast, steht, läuft (gemischte Zustände)', st.size >= 2, [...st].join(','));
  const ts = m.npcs.map(n => n.t.toFixed(1)); check('Keine synchronisierten Bewegungen (Zeitgeber verschieden)', new Set(ts).size >= m.npcs.length * 0.6);
  const grpD = m.herd.map(g => m.npcs.filter(n => n.grp === m.herd.indexOf(g)).map(n => Math.hypot(n.x - Math.cos(g.a) * g.r, n.z - Math.sin(g.a) * g.r)));
  check('Herde wirkt zusammengehörig (Schafe in der Nähe ihrer Gruppe)', grpD.flat().filter(d => d < 12).length >= m.npcs.length * 0.7);
  // Respawn des Schafspielers erhöht die Zahl nicht
  const s = S[0]; s.hp = 1; m.fort.wrong = 0; const n0 = m.npcs.length; s.dead = true; s.lives = 3; s.respawnAt = m.time; tick(r, 0.2);
  check('Respawn des Schafspielers erhöht die Schafzahl nicht', m.npcs.length === n0 && lastSnap(csOf(D[0])).sh.length === n0 + 1); }
/* ---------- 2. Tarnung: Verdacht intern, Anzeige nur fürs Schaf ---------- */
{ const { r, m, D, S, csOf } = setup(); const s = S[0], c = csOf(s); startWave(r, m, 1); hold(m);
  s.x = 25; s.z = 0; for (let i = 0; i < 60; i++) { send(r, c, { t: 'in', c: s.cseq, x: 25, z: 0, y: 0, yaw: 0, pitch: 0 }); tick(r, 0.05); }
  check('Grasen/Stehen: unauffällig', lastSnap(c).you.tarn === 0);
  let x = 25; for (let i = 0; i < 40; i++) { x -= 7.2 * 0.05; send(r, c, { t: 'in', c: s.cseq, x, z: 0, y: 0, yaw: 0, pitch: 0, sp: true }); tick(r, 0.05); }
  check('Längeres Sprinten: verdächtig oder enttarnt', lastSnap(c).you.tarn >= 1, 'Stufe ' + lastSnap(c).you.tarn);
  send(r, c, { t: 'melee' }); tick(r, 0.15); check('Kopfstoß: enttarnt', lastSnap(c).you.tarn === 2);
  const sd = lastSnap(csOf(D[0])); check('Verteidiger bekommt keinen Verdachtswert und keine Tarnstufe', !JSON.stringify(sd).includes('tarn') && !JSON.stringify(sd).includes('"sus"'));
  for (let i = 0; i < 200; i++) { send(r, c, { t: 'in', c: s.cseq, x, z: 0, y: 0, yaw: 0, pitch: 0 }); tick(r, 0.05); }
  check('Ruhig grasen: Tarnung erholt sich', lastSnap(c).you.tarn === 0, 'Stufe ' + lastSnap(c).you.tarn + ' sus ' + s.sus.toFixed(2) + ' rev ' + (s.revealUntil - m.time).toFixed(1) + ' sp ' + s.lastMoveSpeed + ' x ' + s.x + ' dead ' + s.dead + ' wait ' + s.waiting + ' hp ' + s.hp + ' rej ' + JSON.stringify(s.rejects) + s.speedRejects); }
/* ---------- 3. Helfer: Auswahl, Limit, Rechte, Ersatz ---------- */
{ const { r, m, D, S, csOf } = setup(); const s = S[0], c = csOf(s), d = D[0], cd = csOf(d); startWave(r, m, 1); hold(m);
  s.x = 25; s.z = 0; const near = m.npcs.slice(0, 5); near.forEach((n, i) => { n.x = 22 + i; n.z = 3; n.state = 'graze'; n.t = 999; });
  for (const n of near.slice(0, 3)) send(r, c, { t: 'helper', sid: n.sid, v: true }); tick(r, 0.05);
  check('Schafspieler wählt genau 3 Helfer', m.npcs.filter(n => n.helper).length === 3);
  send(r, c, { t: 'helper', sid: near[3].sid, v: true }); tick(r, 0.05);
  check('Vierter Helfer wird abgelehnt', m.npcs.filter(n => n.helper).length === 3 && allEv(c).some(e => e.k === 'helperfail' && e.why === 'max'));
  send(r, cd, { t: 'helper', sid: near[4].sid, v: true }); send(r, cd, { t: 'cmd', mode: 'storm', x: 0, z: 0 }); tick(r, 0.05);
  check('Verteidiger kann keine Schafe steuern', !near[4].helper && m.npcs.every(n => !n.cmd));
  const far = m.npcs[10]; far.x = -30; far.z = 0; send(r, c, { t: 'helper', sid: near[0].sid, v: false }); send(r, c, { t: 'helper', sid: far.sid, v: true }); tick(r, 0.05);
  check('Helfer nur in Reichweite (32 m)', !far.helper && allEv(c).some(e => e.k === 'helperfail' && e.why === 'far'));
  send(r, c, { t: 'helper', sid: 123, v: true }); tick(r, 0.05); check('Unbekannte Schaf-ID wird abgelehnt', allEv(c).some(e => e.k === 'helperfail' && e.why === 'gone'));
  send(r, c, { t: 'helper', sid: near[0].sid, v: true }); tick(r, 0.05);
  const sd = lastSnap(cd), ss = lastSnap(c);
  check('Verteidiger sieht keine Helfer-Markierung und keine Taktikdaten', sd.sh.every(e => !(e[6] & 32)) && sd.tac === undefined && !allEv(cd).some(e => e.k === 'helper'));
  check('Schaf-Team sieht genau seine 3 Helfer markiert', ss.sh.filter(e => e[6] & 32).length === 3 && ss.tac.helpers.length === 3);
  const hp0 = near.slice(0, 3).map(n => n.hp); check('Helfer haben normale Gesundheit', hp0.every(h => h === HEIST.npcSheep.hp));
  // Helfer stirbt → Ersatz nach Abklingzeit, Zahl wächst nicht
  const total = m.npcs.length; const h1 = near[1]; killNpc(r, cd, d, h1);
  check('Helfer kann sterben (verschwindet, Fehlabschuss gezählt)', h1.dead && !m.npcs.includes(h1) && m.fort.wrong === 1);
  send(r, c, { t: 'helper', sid: near[3].sid, v: true }); tick(r, 0.05); check('Ersatz erst nach Abklingzeit', !near[3].helper && allEv(c).some(e => e.k === 'helperfail' && e.why === 'cooldown'));
  tick(r, HEIST.helper.replaceCd + 0.2); near[3].x = 24; near[3].z = 2; send(r, c, { t: 'helper', sid: near[3].sid, v: true }); tick(r, 0.05);
  check('Getöteter Helfer wird durch lebendes Herdenschaf ersetzt', near[3].helper && m.npcs.filter(n => n.helper).length === 3);
  check('Gesamtzahl erhöht sich dabei nicht', m.npcs.length === total - 1, `${total} → ${m.npcs.length}`);
  send(r, c, { t: 'helper', sid: near[3].sid, v: true }); tick(r, 0.05); check('Kein Schaf doppelt auswählbar', allEv(c).some(e => e.k === 'helperfail' && e.why === 'dup')); }
/* ---------- 4. Befehle: Ablenken, Stürmen, Verteidigung angreifen ---------- */
{ const { r, m, D, S, csOf } = setup('1v1', 11); const s = S[0], c = csOf(s), d = D[0]; startWave(r, m, 2); hold(m); park(m);
  m.fort.walls.E.lvl = 1; const hs = m.npcs.slice(0, 3); hs.forEach((n, i) => { n.x = 14; n.z = -3 + i * 3; }); s.x = 16; s.z = 0;
  for (const n of hs) send(r, c, { t: 'helper', sid: n.sid, v: true });
  send(r, c, { t: 'cmd', mode: 'storm', x: 0, z: 0 }); tick(r, 0.05);
  check('Angriffsbefehl „Stürmen“ angenommen', hs.every(n => n.cmd && n.cmd.mode === 'storm') && allEv(c).some(e => e.k === 'cmd' && e.mode === 'storm'));
  check('Omi: „Wollgangster“-Spruch beim Sturm', allEv(c).some(e => e.k === 'omi' && e.q === 'storm'));
  send(r, c, { t: 'cmd', mode: 'distract' }); tick(r, 0.05); check('Befehls-Abklingzeit (kein Doppelbefehl)', hs.every(n => n.cmd.mode === 'storm') && allEv(c).some(e => e.k === 'cmdfail' && e.why === 'cooldown'));
  d.x = 0; d.z = 2; let jumped = false, inside = 0, butts = 0; const hp0 = d.hp;
  for (let i = 0; i < 160; i++) { send(r, csOf(d), { t: 'in', c: d.cseq, x: 0, z: 2, y: 0, yaw: 0, pitch: 0 }); r.tick(0.05); if (hs.some(n => n.y > 1.3)) jumped = true; inside = Math.max(inside, hs.filter(n => Math.max(Math.abs(n.x), Math.abs(n.z)) < 4.7).length); }
  butts = allEv(c).filter(e => e.k === 'butt' && hs.some(n => n.sid === e.sid)).length;
  check('Stürmende Helfer springen über die Holzmauer', jumped && inside >= 1, inside + ' in der Festung');
  check('Helfer bedrängen den Verteidiger (Kopfstöße)', butts > 0 && d.hp < hp0, `${butts} Stöße, LP ${d.hp}`);
  check('Helferschafe nehmen den Kuchen nie', m.cake.state === 'home');
  tick(r, 12); check('Nach dem Befehl: zurück zum Herdenverhalten', hs.every(n => !n.cmd));
  // Stein/Stahl: kein Überspringen, kaum Schaden
  const r2 = setup('1v1', 12); { const { m: m2, S: S2, csOf: cs2 } = r2; startWave(r2.r, m2, 2); hold(m2); park(m2); for (const k in m2.fort.walls) { m2.fort.walls[k].lvl = 3; m2.fort.walls[k].hp = m2.fort.walls[k].maxHp = 240; }
    const h = m2.npcs.slice(0, 3); h.forEach((n, i) => { n.x = 12; n.z = -2 + i * 2; }); S2[0].x = 15; S2[0].z = 0; for (const n of h) send(r2.r, cs2(S2[0]), { t: 'helper', sid: n.sid, v: true });
    send(r2.r, cs2(S2[0]), { t: 'cmd', mode: 'storm', x: 0, z: 0 }); let inF = 0; for (let i = 0; i < 220; i++) { r2.r.tick(0.05); inF = Math.max(inF, h.filter(n => Math.max(Math.abs(n.x), Math.abs(n.z)) < 4.7).length); }
    check('Stahlmauer: Helfer kommen nicht hinein', inF === 0);
    check('Keine unrealistische Zerstörung massiver Mauern (Stahl verliert < 5 %)', m2.fort.walls.E.hp > 228, 'LP ' + m2.fort.walls.E.hp.toFixed(1)); }
  // Ablenken: verteilen sich, schnell, lösen Bewegungsmelder aus
  const r3 = setup('1v1', 13); { const { m: m3, S: S3, D: D3, csOf: cs3 } = r3; startWave(r3.r, m3, 2); hold(m3); park(m3); m3.fort.coins = 999;
    send(r3.r, cs3(D3[0]), { t: 'buy', item: 'motion', side: 'E' }); r3.r.tick(0.05);
    const h = m3.npcs.slice(0, 3); h.forEach((n, i) => { n.x = 20; n.z = -2 + i * 2; }); S3[0].x = 22; S3[0].z = 0; for (const n of h) send(r3.r, cs3(S3[0]), { t: 'helper', sid: n.sid, v: true });
    send(r3.r, cs3(S3[0]), { t: 'cmd', mode: 'distract', x: 13, z: 0 }); let spread = 0; for (let i = 0; i < 160; i++) { r3.r.tick(0.05); const ps = h.map(n => [n.x, n.z]); spread = Math.max(spread, Math.max(...ps.flatMap(a => ps.map(b => Math.hypot(a[0] - b[0], a[1] - b[1]))))); }
    const evD = allEv(cs3(D3[0]));
    check('Ablenken: Helfer laufen in unterschiedliche Richtungen', spread > 6, spread.toFixed(1) + ' m');
    check('Ablenken löst Bewegungsmelder aus (Hinweis ohne Identität)', evD.some(e => e.k === 'alarm' && e.kind === 'motion' && e.sid === undefined && e.id === undefined)); }
  // Verteidigung angreifen: Werwolf und Turm
  const r4 = setup('1v1', 14); { const { m: m4, S: S4, D: D4, csOf: cs4 } = r4; startWave(r4.r, m4, 3); hold(m4); park(m4); m4.fort.coins = 999; for (const k in m4.fort.walls) m4.fort.walls[k].lvl = 0;
    send(r4.r, cs4(D4[0]), { t: 'buy', item: 'tower' }); send(r4.r, cs4(D4[0]), { t: 'buy', item: 'wolf' }); r4.r.tick(0.05); const tw = m4.fort.builds.find(b => b.kind === 'tower'), hp0 = tw.hp, wolf = m4.wolves[0], whp = wolf.hp;
    const h = m4.npcs.slice(0, 3); h.forEach((n, i) => { n.x = 12; n.z = 4 + i; }); S4[0].x = 14; S4[0].z = 4; for (const n of h) send(r4.r, cs4(S4[0]), { t: 'helper', sid: n.sid, v: true });
    send(r4.r, cs4(S4[0]), { t: 'cmd', mode: 'sabotage' }); for (let i = 0; i < 240; i++) r4.r.tick(0.05);
    check('Verteidigung angreifen: Werwolf oder Turm nimmt Schaden', (wolf.hp < whp) || !m4.fort.builds.includes(tw) || tw.hp < hp0, `Wolf ${whp}→${Math.round(wolf.hp)}, Turm ${hp0}→${Math.round(tw.hp)}`);
    check('Helfer überleben Werwölfe und Türme (die verscheuchen nur)', h.every(n => !n.dead)); } }
/* ---------- 5. Fehlabschüsse ---------- */
{ const { r, m, D, S, csOf } = setup(); const d = D[0], cd = csOf(d), s = S[0]; startWave(r, m, 1); hold(m); park(m); s.x = -30; s.z = 0; m.fort.coins = 100;
  const evs = () => allEv(cd).filter(e => e.k === 'wrong').map(e => e.n);
  killNpc(r, cd, d, m.npcs[0]); check('1. Fehlabschuss gezählt (Verwarnung)', m.fort.wrong === 1 && lastSnap(cd).wrong === 1 && allEv(cd).some(e => e.k === 'omi' && e.q === 'wrong1'));
  startWave(r, m, 2); hold(m); check('Fehlabschüsse bleiben über Wellen bestehen', m.fort.wrong === 1);
  killNpc(r, cd, d, m.npcs[0]); check('2. Fehlabschuss gezählt (deutliche Warnung)', m.fort.wrong === 2 && allEv(cd).some(e => e.k === 'omi' && e.q === 'wrong2'));
  const n3 = m.npcs[0]; n3.x = 12; n3.z = 12; const a = aim(r, cd, d, 6, 6, 12, 12); shoot(r, cd, d, a); check('Schwer verletztes Schaf zählt noch nicht', m.fort.wrong === 2 && n3.hp > 0 && n3.hp < 25);
  killNpc(r, cd, d, n3); check('3. Fehlabschuss: letzte Warnung', m.fort.wrong === 3 && allEv(cd).some(e => e.k === 'omi' && e.q === 'wrong3') && !m.over);
  check('Schaf-Team sieht den Zähler ebenfalls', lastSnap(csOf(s)).wrong === 3 && lastSnap(csOf(s)).wrongMax === 3);
  // Schafspieler korrekt erschießen zählt nicht
  s.x = 12; s.z = -12; s.prot = 0; s.hp = 1; s.camoUntil = 0; const a2 = aim(r, cd, d, 6, -6, 12, -12); shoot(r, cd, d, a2);
  check('Korrekt getöteter Schafspieler zählt nicht', s.dead && m.fort.wrong === 3);
  // Zombies töten kein Schaf, Explosionen und Geschütze treffen keine Herdenschafe
  { m.fort.coins = 999; m.wave = 3; send(r, cd, { t: 'buy', item: 'mine' }); send(r, cd, { t: 'buy', item: 'tower' }); tick(r, 0.05); const mi = m.fort.builds.find(b => b.kind === 'mine'), w0 = m.fort.wrong, nn = m.npcs[1];
    nn.x = mi.x + 0.5; nn.z = mi.z; nn.state = 'graze'; nn.t = 999; const tw = m.fort.builds.find(b => b.kind === 'tower'); const nt = m.npcs[2]; nt.x = tw.x + 3; nt.z = tw.z; nt.state = 'graze'; nt.t = 999;
    m.goats = [0, 1, 2].map(i => ({ id: 9000 + i, type: 'normal', s: 1, r: 0.45, x: mi.x + i * 0.3, z: mi.z + 0.3, hp: 5, maxHp: 5, speed: 0, eat: 0, state: 'walk', stagger: 0, ry: 0, slow: 1, wp: null, wpTried: true }));
    tick(r, 1.5); check('Minen, Türme und Ziegen töten keine Herdenschafe → kein Fehlabschuss', !nn.dead && !nt.dead && m.fort.wrong === w0 && !m.fort.builds.includes(mi), `Mine explodiert, NPC-LP ${nn.hp}/${nt.hp}`); hold(m); }
  killNpc(r, cd, d, m.npcs[0]); tick(r, 0.1);
  check('4. Fehlabschuss: Schafe gewinnen sofort', m.over && m.winner === 1 && m.reason === 'wrongkills' && r.results && r.results.reason === 'wrongkills');
  check('Omi: „VIER SCHAFE?!“', allEv(cd).some(e => e.k === 'omi' && e.q === 'wrong4')); }
{ const { r, m, D, csOf } = setup('2v2'); startWave(r, m, 1); hold(m); park(m); const [d1, d2] = D;
  killNpc(r, csOf(d1), d1, m.npcs[0]); killNpc(r, csOf(d2), d2, m.npcs[0]); check('2v2: Verteidiger teilen das Limit', m.fort.wrong === 2 && d1.wrong === 1 && d2.wrong === 1); }
/* ---------- 6. Kuchen als Rückenschutz ---------- */
{ const { r, m, D, S, csOf } = setup(); const d = D[0], cd = csOf(d), s = S[0], c = csOf(s); startWave(r, m, 1); hold(m); park(m);
  const carry = () => { Object.assign(m.cake, { state: 'carried', by: s.id }); s.revealUntil = m.time + 999; };
  const shotAt = (fromX, fromZ, yawS) => { s.dead = false; s.hp = 60; s.prot = 0; s.x = 15; s.z = 0; s.y = 0; s.yaw = yawS; carry();
    const a = aim(r, cd, d, fromX, fromZ, 15, 0, 0.85); shoot(r, cd, d, a); return 60 - s.hp; };
  // Schaf blickt nach +x (Vorwärts = (-sin yaw, -cos yaw) → yaw = -π/2). Schütze bei x=8 (hinter dem Schaf) bzw. x=22 (vorne)
  const back = shotAt(8, 0, -Math.PI / 2), front = shotAt(22, 0, -Math.PI / 2), side = shotAt(15, -7, -Math.PI / 2);
  check('Kuchen schützt den Rücken (65 % weniger Schaden)', Math.abs(back - 12 * HEIST.cakeBack) < 0.6, `hinten ${back.toFixed(1)} von 12`);
  check('Kuchen schützt die Vorderseite nicht (voller Schaden, Kopftreffer ×1,5)', front >= 12, `vorne ${front}`);
  check('Seitlicher Treffer: kein Rückenschutz', side === 12, `seitlich ${side}`);
  check('Treffer am Rücken sichtbar gemeldet (cakeblock)', allEv(c).some(e => e.k === 'cakeblock'));
  m.cake.state = 'home'; s.hp = 60; s.x = 15; s.yaw = -Math.PI / 2; shoot(r, cd, d, aim(r, cd, d, 8, 0, 15, 0, 1.0)); check('Ohne getragenen Kuchen kein Schutz', 60 - s.hp === 12);
  // Kuchen fällt beim Tod
  carry(); s.hp = 1; s.prot = 0; shoot(r, cd, d, aim(r, cd, d, 22, 0, 15, 0, 1.0)); check('Kuchen fällt beim Tod herunter', s.dead && m.cake.state === 'dropped');
  // Schild wird beim Aufnehmen abgelegt
  m.cake.state = 'home'; m.cake.x = 0; m.cake.z = 0; s.dead = false; s.hp = 60; s.waiting = false; s.x = 0.5; s.z = 0.5; s.y = 0; s.shield = 40; s.shieldUntil = m.time + 20; s.grabbing = true; tick(r, 1.2);
  check('Zusatzschild wird bei Kuchenaufnahme abgelegt', m.cake.state === 'carried' && s.shield === 0);
  check('Omi: „PASS AUF MEINEN KUCHEN AUF!“ bei Beschuss des Trägers', allEv(c).some(e => e.k === 'omi' && e.q === 'cakeshot'));
  // Nur der echte Schafspieler trägt
  check('Nur der echte Schafspieler trägt den Kuchen', m.cake.by === s.id && !m.npcs.some(n => n.sid === m.cake.by)); }
/* ---------- 7. Alarmanlagen ---------- */
{ const { r, m, D, S, csOf } = setup(); const d = D[0], cd = csOf(d), s = S[0], c = csOf(s); startWave(r, m, 2); hold(m); park(m); m.fort.coins = 999;
  for (const it of ['bell', 'motion', 'cakealarm']) send(r, cd, { t: 'buy', item: it });
  tick(r, 0.05); check('Glocke, Bewegungsmelder und Kuchenalarm kaufbar', ['bell', 'motion', 'cakealarm'].every(k => m.fort.builds.some(b => b.kind === k)));
  const mo = m.fort.builds.find(b => b.kind === 'motion'); s.x = mo.x + 3; s.z = mo.z; let x = s.x;
  for (let i = 0; i < 20; i++) { x += 7 * 0.05; send(r, c, { t: 'in', c: s.cseq, x, z: s.z, y: 0, yaw: 0, pitch: 0, sp: true }); tick(r, 0.05); }
  const al = allEv(cd).filter(e => e.k === 'alarm'); check('Bewegungsmelder meldet schnelle Bewegung', al.some(e => e.kind === 'motion'));
  check('Alarme verraten keine Identität (nur Gerät und Ort)', al.every(e => e.sid === undefined && e.id === undefined));
  check('Schaf-Team bekommt die Verteidiger-Alarme nicht', !allEv(c).some(e => e.k === 'alarm'));
  // Herdenschaf auf der Flucht löst ebenfalls aus → Fehlalarm möglich
  const n = m.npcs[0]; n.x = mo.x + 2; n.z = mo.z; n.state = 'flee'; n.tx = mo.x + 8; n.tz = mo.z; n.t = 2; s.x = -30; s.z = 20; send(r, c, { t: 'in', c: s.cseq, x: -30, z: 20, y: 0, yaw: 0, pitch: 0 });
  m.fort.builds.forEach(b => b.rang = -99); const before = allEv(cd).filter(e => e.k === 'alarm').length; tick(r, 0.3);
  check('Auch ein normales Schaf kann Alarm auslösen (Fehlalarm)', allEv(cd).filter(e => e.k === 'alarm').length > before);
  // Kuchenalarm
  Object.assign(m.cake, { state: 'home', x: 0, z: 0 }); s.x = 0.4; s.z = 0.4; s.y = 0; s.grabbing = true; tick(r, 1.2);
  check('Kuchenalarm meldet die Aufnahme zuverlässig', allEv(cd).some(e => e.k === 'cakealarm') && lastSnap(cd).thief && lastSnap(cd).thief.length === 2);
  check('Kuchenalarm-Ortung nur für Verteidiger', lastSnap(c).thief === undefined); }
/* ---------- 8. Fluchtroute und Angriffspunkt ---------- */
{ const { r, m, D, S, csOf } = setup(); const s = S[0], c = csOf(s), cd = csOf(D[0]);
  send(r, c, { t: 'route', pts: [[10, -10], [5, -22], [0, -32]] }); send(r, c, { t: 'mark', x: 5.5, z: 0 }); tick(r, 0.05);
  const ss = lastSnap(c); check('Fluchtroute und Angriffspunkt gespeichert (nur Schaf-Team)', ss.tac.route.length === 3 && ss.tac.atk[0] === 5.5 && lastSnap(cd).tac === undefined);
  send(r, c, { t: 'route', pts: [[999, 0]] }); send(r, c, { t: 'route', pts: 'x' }); tick(r, 0.05); check('Ungültige Route abgelehnt', m.route.length === 3);
  send(r, c, { t: 'route', pts: Array.from({ length: 20 }, (_, i) => [i, -i]) }); tick(r, 0.05); check('Route auf 6 Punkte begrenzt', m.route.length === 6);
  send(r, cd, { t: 'route', pts: [[1, 1]] }); tick(r, 0.05); check('Verteidiger kann keine Schaf-Route setzen', m.route.length === 6); }
/* ---------- 9. Keine Karten-Wallhacks: Verteidiger hinter Mauern nicht im Snapshot ---------- */
{ const { r, m, D, S, csOf } = setup(); const d = D[0], s = S[0], c = csOf(s); for (const k in m.fort.walls) m.fort.walls[k].lvl = 3;
  d.x = 0; d.z = 0; d.y = 0; s.x = 0; s.z = -14; s.y = 0; s.seenDef = null; tick(r, 1);
  check('Verteidiger hinter Stahlmauer: nicht im Schaf-Snapshot', !lastSnap(c).pl.some(p => p.id === d.id));
  for (const k in m.fort.walls) m.fort.walls[k].lvl = 0; tick(r, 0.2); check('Ohne Mauer: sichtbar', lastSnap(c).pl.some(p => p.id === d.id));
  check('Verteidiger sieht sich selbst immer', lastSnap(csOf(d)).pl.some(p => p.id === d.id)); }
/* ---------- 10. 2v2: gemeinsames Helferlimit, keine Doppelwahl, synchrone Befehle ---------- */
{ const { r, m, S, csOf } = setup('2v2', 21); const [s1, s2] = S, c1 = csOf(s1), c2 = csOf(s2); startWave(r, m, 1); hold(m);
  s1.x = s2.x = 25; s1.z = 0; s2.z = 2; m.npcs.slice(0, 5).forEach((n, i) => { n.x = 22 + i; n.z = 1; });
  send(r, c1, { t: 'helper', sid: m.npcs[0].sid, v: true }); send(r, c2, { t: 'helper', sid: m.npcs[0].sid, v: true }); send(r, c1, { t: 'helper', sid: m.npcs[1].sid, v: true }); send(r, c2, { t: 'helper', sid: m.npcs[2].sid, v: true }); send(r, c2, { t: 'helper', sid: m.npcs[3].sid, v: true }); tick(r, 0.05);
  check('2v2: höchstens 3 Helfer fürs ganze Schaf-Team, kein NPC doppelt', m.npcs.filter(n => n.helper).length === 3);
  send(r, c1, { t: 'cmd', mode: 'distract', x: 10, z: 10 }); send(r, c2, { t: 'cmd', mode: 'storm', x: 0, z: 0 }); tick(r, 0.05);
  check('2v2: nur ein Befehl gleichzeitig (gemeinsame Abklingzeit)', m.npcs.filter(n => n.cmd).every(n => n.cmd.mode === 'distract'));
  const a = lastSnap(c1), b = lastSnap(c2); check('2v2: beide Schafspieler sehen dieselben Helfer und Befehle (keine Desynchronisation)', JSON.stringify(a.tac) === JSON.stringify(b.tac) && a.tac.mode === 'distract'); }
/* ---------- 11. 8 Wellen, Finale 100 ---------- */
{ check('Acht Wellen, Welle 8 mit genau 100 Zombie-Ziegen', makeWave8(8, 7, 1).list.length === 100 && makeWave8(8, 7, 2).list.length === 100);
  const { r, m } = setup('1v1', 5); startWave(r, m, 8); let t0 = performance.now(), worst = 0; for (let i = 0; i < 600; i++) { const a = performance.now(); r.tick(0.05); worst = Math.max(worst, performance.now() - a); }
  check('Finale mit 15 Schafen: Servertakt im Rahmen', (performance.now() - t0) / 600 < 3 && worst < 50, ((performance.now() - t0) / 600).toFixed(2) + ' ms, max ' + worst.toFixed(1) + ' ms, Ziegen ' + m.goats.length); }
const pass = results.filter(l => l.startsWith('PASS')).length; console.log(`\n${pass}/${results.length} bestanden (V7.2 Server-Simulation, kein Browser)`); process.exit(pass === results.length ? 0 : 1);
