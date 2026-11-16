// Modus "Kuchenkrieg" V7 – Der große Käsekuchen-Raub (asymmetrisch).
// Team 0: Kuchen-Verteidiger in der Festung (Einzelspieler-Welt, Kuchen bei 0/0). Team 1: Schaf-Infiltratoren,
// getarnt in einer Herde computergesteuerter Schafe. Ziel der Schafe: Kuchen stehlen und zur Omi bringen.
// Ziel der Verteidiger: 8 Zombie-Wellen überstehen, ohne dass der Kuchen gefressen oder abgeliefert wird.
// Der Server entscheidet alles: Rollen, Tarnung, Wellen, Herde, Treffer, Leben, Kuchenbesitz, Käufe, Sieg.
import { WEAPONS, TYPES, UPG, NADE, WALL, rng, BOOST, HEIST, sheepLives, SHEEP_SHOP, DEF_SHOP, WALL7, WOLF7, KING7, WAVE_NAMES8, makeWave8 } from '../rules.js';
import { makeBrain } from '../bots.js';

const MAX_WAVES = 8;
const SIDES = { N: { ax: 'z', sg: -1 }, E: { ax: 'x', sg: 1 }, S: { ax: 'z', sg: 1 }, W: { ax: 'x', sg: -1 } };
const TYPE_IDX = { normal: 0, kid: 1, bock: 2, king: 3 }, STATE_IDX = { walk: 0, eat: 1, wall: 2, wind: 3, charge: 4, tired: 5, stomp: 6, idle: 7 };
const { F, HALF, TH } = WALL;
const LVL = [null, 'wood', 'stone', 'steel'], wallH = l => l ? WALL7[LVL[l]].h : 0, GATE_W = 1.1;
const SH_ANIM = { graze: 0, walk: 1, run: 2, warn: 3, charge: 4, idle: 5, flee: 2, calm: 1 };
const H = HEIST;
// Bauplätze (fest, damit beide Seiten dieselbe Festung sehen): Türme an den Ecken, Geschütze auf den Mauern, Fallen davor
const SLOTS = {
  tower: [[F + 0.9, F + 0.9], [-F - 0.9, F + 0.9], [F + 0.9, -F - 0.9], [-F - 0.9, -F - 0.9]],
  gun: [[0, -F, 'N'], [F, 0, 'E'], [0, F, 'S'], [-F, 0, 'W']],
  spikes: [[0, -F - 2.4, 'N'], [F + 2.4, 0, 'E'], [0, F + 2.4, 'S'], [-F - 2.4, 0, 'W']],
  mine: [[2.5, -F - 4.5], [F + 4.5, 2.5], [-2.5, F + 4.5], [-F - 4.5, -2.5]],
  watch: [[-3.4, 3.4]], ammo: [[3.4, 3.4]], bell: [[-3.4, -3.4]],
  motion: [[0, -F - 7, 'N'], [F + 7, 0, 'E'], [0, F + 7, 'S'], [-F - 7, 0, 'W']], cakealarm: [[0, 0]],
};

// ---------- Festung, Navigation, Mauern ----------
// wrong = unschuldige Schafe, die das Verteidigerteam erschossen hat (gilt fürs ganze Match)
function newFort() { const walls = {}; for (const k in SIDES) walls[k] = { lvl: 1, hp: WALL7.wood.hp, maxHp: WALL7.wood.hp, gate: false };
  return { walls, builds: [], bid: 1, coins: H.startCoins, upg: { dmg: 0, rate: 0, move: 0, mag: 0, reload: 0, boostcd: 0, fixer: 0 }, kills: 0, points: 0, wolfReadyAt: 0, wolvesThisWave: 0, kingDown: false, lostThisWave: 0, wrong: 0 }; }
const built = (m, k) => m.fort.walls[k].lvl > 0;
const sideOf = (x, z) => Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'E' : 'W') : (z > 0 ? 'S' : 'N');
const ADJ = { N: ['E', 'W'], S: ['E', 'W'], E: ['N', 'S'], W: ['N', 'S'] }, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
function cornerOf(a, b) { const C = F + 2.4, has = k => a === k || b === k; return { x: has('E') ? C : has('W') ? -C : 0, z: has('S') ? C : has('N') ? -C : 0 }; }
function outOf(a) { const C = F + 2.4; return { x: a === 'E' ? C : a === 'W' ? -C : 0, z: a === 'S' ? C : a === 'N' ? -C : 0 }; }
function planAround(m, side, g) {
  const byDist = (a, b) => { const ca = cornerOf(side, a), cb = cornerOf(side, b); return Math.hypot(ca.x - g.x, ca.z - g.z) - Math.hypot(cb.x - g.x, cb.z - g.z); };
  const open = ADJ[side].filter(a => !built(m, a)); if (open.length) { open.sort(byDist); return [cornerOf(side, open[0]), outOf(open[0])]; }
  const o = OPP[side]; if (!built(m, o)) { const a = ADJ[side].slice().sort(byDist)[0]; return [cornerOf(side, a), cornerOf(a, o), outOf(o)]; }
  return null;
}
function navTarget(m, g) {
  if (g.wp && g.wp.length) { if (Math.hypot(g.wp[0].x - g.x, g.wp[0].z - g.z) < 0.9) g.wp.shift(); if (g.wp.length) return { x: g.wp[0].x, z: g.wp[0].z, wall: null }; }
  if (Math.max(Math.abs(g.x), Math.abs(g.z)) <= F + 0.05) return { x: 0, z: 0, wall: null };
  const side = sideOf(g.x, g.z); if (!built(m, side)) return { x: 0, z: 0, wall: null };
  if (g.type === 'kid' && !g.wpTried) { g.wpTried = true; const r = planAround(m, side, g); if (r) { g.wp = r; return { x: r[0].x, z: r[0].z, wall: null }; } }
  const off = F + TH / 2 + g.r + 0.05, lim = HALF - 0.5, s = SIDES[side];
  if (s.ax === 'x') return { x: s.sg * off, z: Math.max(-lim, Math.min(lim, g.z)), wall: side };
  return { x: Math.max(-lim, Math.min(lim, g.x)), z: s.sg * off, wall: side };
}
// Wand-Kollision; mit gate=true bleibt die Toröffnung frei (nur Verteidiger und Werwölfe)
function pushOut(m, p, r, useGates = false) {
  for (const k in SIDES) { const wl = m.fort.walls[k]; if (!wl.lvl) continue; const s = SIDES[k];
    const a = s.ax === 'x' ? p.x : p.z, b = s.ax === 'x' ? p.z : p.x;
    if (useGates && wl.gate && Math.abs(b) < GATE_W) continue;
    if (Math.abs(b) <= HALF + r * 0.5 && Math.abs(a - s.sg * F) < TH / 2 + r) { const out = a * s.sg > F; const t = out ? s.sg * (F + TH / 2 + r) : s.sg * (F - TH / 2 - r); if (s.ax === 'x') p.x = t; else p.z = t; } }
}
function wallDamage(m, side, n) { const wl = m.fort.walls[side]; if (!wl.lvl || n <= 0) return; wl.hp -= n;
  if (wl.hp <= 0) { wl.lvl = 0; wl.hp = 0; wl.maxHp = 0; wl.gate = false; m.fort.lostThisWave++; m.ev.push({ k: 'wall', side, destroyed: true });
    for (const b of [...m.fort.builds]) if (b.kind === 'gun' && b.side === side) removeBuild(m, b); } }
// Kreuzt die Strecke a→b eine stehende Mauer unterhalb ihrer Oberkante? (Server-Prüfung gegen Durch-die-Wand-Laufen)
function crossesWall(m, ax, az, bx, bz, y) {
  for (const k in SIDES) { const wl = m.fort.walls[k]; if (!wl.lvl || y >= wallH(wl.lvl) - 0.1) continue; const s = SIDES[k];
    const pa = (s.ax === 'x' ? ax : az) - s.sg * F, pb = (s.ax === 'x' ? bx : bz) - s.sg * F;
    if (Math.sign(pa) === Math.sign(pb) || (Math.abs(pa) < 1e-6 && Math.abs(pb) < 1e-6)) continue;
    const f = pa / (pa - pb), c = (s.ax === 'x' ? az + (bz - az) * f : ax + (bx - ax) * f); if (Math.abs(c) <= HALF + 0.2) return k; }
  return null;
}
function nearWall(m, x, z, d = 1.1) { for (const k in SIDES) { const wl = m.fort.walls[k]; if (!wl.lvl) continue; const s = SIDES[k];
  const a = s.ax === 'x' ? x : z, b = s.ax === 'x' ? z : x; if (Math.abs(b) <= HALF + 0.3 && Math.abs(a - s.sg * F) < d) return k; } return null; }
const inFort = (x, z, pad = 0) => Math.max(Math.abs(x), Math.abs(z)) < F - pad;
function clampArena(p, R = H.arenaR) { const d = Math.hypot(p.x, p.z); if (d <= R) return false; p.x *= R / d * 0.999; p.z *= R / d * 0.999; return true; }

// ---------- Raycast ----------
function raySphere(o, d, c, r) { const ox = c[0] - o[0], oy = c[1] - o[1], oz = c[2] - o[2]; const t = ox * d[0] + oy * d[1] + oz * d[2]; if (t < 0) return -1;
  const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) return -1; return t - Math.sqrt(r * r - d2); }
function rayCyl(o, d, cx, cz, r, y0, y1) { const fx = o[0] - cx, fz = o[2] - cz; const a = d[0] * d[0] + d[2] * d[2]; if (a < 1e-9) return -1;
  const b = 2 * (fx * d[0] + fz * d[2]), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); if (t < 0) return -1; const y = o[1] + d[1] * t; return y >= y0 && y <= y1 ? t : -1; }
function rayBox(o, d, A) { let t0 = 0, t1 = 1e9; for (const [i, mn, mx] of [[0, A[0], A[1]], [1, A[2], A[3]], [2, A[4], A[5]]]) {
  if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn || o[i] > mx) return -1; continue; } let a = (mn - o[i]) / d[i], b = (mx - o[i]) / d[i]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1; } return t0; }
function wallBox(m, side) { const s = SIDES[side], h = wallH(m.fort.walls[side].lvl); return s.ax === 'x' ? [s.sg * F - TH / 2, s.sg * F + TH / 2, 0, h, -HALF, HALF] : [-HALF, HALF, 0, h, s.sg * F - TH / 2, s.sg * F + TH / 2]; }
const goatHead = g => g.type === 'king' ? 2.05 * g.s : 1.95 * g.s;
// Sichtlinie (nur Mauern blockieren)
function los(m, o, tx, ty, tz) { const dx = tx - o[0], dy = ty - o[1], dz = tz - o[2], l = Math.hypot(dx, dy, dz) || 1, d = [dx / l, dy / l, dz / l];
  for (const k in SIDES) if (built(m, k)) { const t = rayBox(o, d, wallBox(m, k)); if (t >= 0 && t < l - 0.3) return false; } return true; }
// Ein Strahl eines Verteidigers: Ziegen, Schafe (Herde, Spieler, Lockvögel), Werwölfe nicht (eigene). Eigene Mauern blockieren nicht (Zinnen).
function castDef(m, o, d) {
  let best = null; const take = (t, hit) => { if (t >= 0 && (!best || t < best.t)) best = { t, ...hit }; };
  for (const g of m.goats) { if (g.dead) continue; const s = g.s;
    take(raySphere(o, d, [g.x, goatHead(g), g.z], (g.type === 'king' ? 0.45 : 0.34) * s), { g, head: true });
    take(rayCyl(o, d, g.x, g.z, 0.45 * s, 0.1 * s, 1.75 * s), { g, head: false }); }
  for (const n of m.npcs) if (!n.dead) take(raySphere(o, d, [n.x, 0.78, n.z], 0.62), { n });
  for (const q of m.players.values()) if (q.role === 'sheep' && q.alive()) { take(raySphere(o, d, [q.x, q.y + 0.78, q.z], 0.62), { q }); take(raySphere(o, d, [q.x - Math.sin(q.yaw) * 0.7, q.y + 1.05, q.z - Math.cos(q.yaw) * 0.7], 0.3), { q, head: true }); }
  for (const c of m.decoys) take(raySphere(o, d, [c.x, 0.78, c.z], 0.62), { decoy: c });
  return best;
}

// ---------- Ziegen ----------
function spawn(m, e) {
  const T = e.type === 'king' ? { s: KING7.s, hp: KING7.hp * (1 + 0.5 * (m.room.perTeam - 1)), speed: KING7.speed, eat: KING7.eat } : TYPES[e.type];
  const hp = T.hp * (e.hpM || 1), R = H.spawnR;
  const g = { id: m.gid++, type: e.type, s: T.s, r: 0.45 * T.s, x: Math.cos(e.a) * R, z: Math.sin(e.a) * R, hp, maxHp: hp,
    speed: T.speed * e.sp * (e.type === 'king' ? 1 : 0.85), eat: T.eat, state: 'walk', stagger: 0, wp: null, wpTried: false, ry: 0, dead: false, slow: 1 };
  if (e.type === 'king') { Object.assign(g, { chargeCd: 4, stompCd: 3, actT: 0, tx: 0, tz: 0, summoned: false }); m.ev.push({ k: 'king', g: g.id }); m.ev.push({ k: 'omi', q: 'king' }); }
  m.goats.push(g); return g;
}
const defendersNear = (m, x, z, r) => [...m.players.values()].filter(q => q.role === 'def' && !q.dead && Math.hypot(q.x - x, q.z - z) <= r);
function stepKing(m, g, dt) {
  g.chargeCd -= dt; g.stompCd -= dt;
  if (!g.summoned && g.hp < g.maxHp * 0.5) { g.summoned = true; for (let i = 0; i < 4; i++) { const k = spawn(m, { type: 'kid', a: Math.atan2(g.z, g.x), sp: 1.1, hpM: 1 }); k.x = g.x + Math.cos(i * 1.6) * 1.6; k.z = g.z + Math.sin(i * 1.6) * 1.6; } m.ev.push({ k: 'kingsummon', g: g.id }); }
  if (g.state === 'wind' || g.state === 'stomp') { g.actT -= dt; if (g.actT > 0) return true;
    if (g.state === 'stomp') { for (const q of defendersNear(m, g.x, g.z, KING7.stompR)) hurtPlayer(m, q, KING7.stompDmg, 0, q.x - g.x, q.z - g.z, 2.2);
      for (const f of m.wolves) if (!f.dead && Math.hypot(f.x - g.x, f.z - g.z) <= KING7.stompR) hurtWolf(m, f, 15, 0);
      for (const b of [...m.fort.builds]) if (b.hp != null && Math.hypot(b.x - g.x, b.z - g.z) <= KING7.stompR + 0.6) hurtBuild(m, b, 30);
      m.ev.push({ k: 'kingstomp', g: g.id }); g.state = 'walk'; g.stompCd = KING7.stompCd; return true; }
    g.state = 'charge'; g.actT = KING7.chargeDur; g.hitIds = new Set(); m.ev.push({ k: 'kingcharge', g: g.id }); return true; }
  if (g.state === 'charge') { g.actT -= dt; const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz) || 1;
    g.x += dx / d * KING7.chargeSpeed * dt; g.z += dz / d * KING7.chargeSpeed * dt; g.ry = Math.atan2(dx, dz);
    for (const q of defendersNear(m, g.x, g.z, 1.8)) if (!g.hitIds.has(q.id)) { g.hitIds.add(q.id); hurtPlayer(m, q, KING7.chargeDmg, 0, q.x - g.x, q.z - g.z, 3); }
    for (const k in SIDES) if (built(m, k)) { const s = SIDES[k], a = s.ax === 'x' ? g.x : g.z, b = s.ax === 'x' ? g.z : g.x; if (Math.abs(b) <= HALF + 1 && Math.abs(a - s.sg * F) < 1.6) { wallDamage(m, k, 25); g.actT = 0; } }
    if (g.actT <= 0 || d < 0.6) { g.state = 'tired'; g.actT = KING7.tired; g.chargeCd = KING7.chargeCd; m.ev.push({ k: 'kingtired', g: g.id }); }
    return true; }
  if (g.state === 'tired') { g.actT -= dt; if (g.actT <= 0) g.state = 'walk'; return true; }
  if (defendersNear(m, g.x, g.z, KING7.stompR - 0.5).length && g.stompCd <= 0) { g.state = 'stomp'; g.actT = KING7.stompWind; m.ev.push({ k: 'kingwind', g: g.id, kind: 'stomp', t: KING7.stompWind }); return true; }
  if (g.chargeCd <= 0) { const cand = defendersNear(m, g.x, g.z, 16).filter(q => Math.hypot(q.x - g.x, q.z - g.z) >= 4);
    if (cand.length) { const q = cand[0], dx = q.x - g.x, dz = q.z - g.z, d = Math.hypot(dx, dz) || 1;
      g.tx = g.x + dx / d * Math.min(14, d + 3); g.tz = g.z + dz / d * Math.min(14, d + 3); g.state = 'wind'; g.actT = KING7.chargeWind; g.ry = Math.atan2(dx, dz);
      m.ev.push({ k: 'kingwind', g: g.id, kind: 'charge', t: KING7.chargeWind, x: +g.tx.toFixed(2), z: +g.tz.toFixed(2) }); return true; } }
  return false;
}
// Räumliches Raster für die Ziegen-Abstoßung (100 Ziegen im Finale: O(n) statt O(n²))
function separate(m) {
  const cell = 1.6, grid = new Map(), key = (i, j) => i * 4096 + j;
  for (const g of m.goats) { const k = key(Math.floor(g.x / cell), Math.floor(g.z / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(g); }
  for (const g of m.goats) { const ci = Math.floor(g.x / cell), cj = Math.floor(g.z / cell);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) { const a = grid.get(key(i, j)); if (!a) continue;
      for (const o of a) { if (o === g) continue; const ex = g.x - o.x, ez = g.z - o.z, ed = Math.hypot(ex, ez), mn = g.r + o.r; if (ed < mn && ed > 0.001) { g.x += ex / ed * (mn - ed) * 0.5; g.z += ez / ed * (mn - ed) * 0.5; } } }
    if (g.state !== 'charge') pushOut(m, g, g.r); }
}
function stepGoats(m, dt) {
  m.qt += dt; let alive = m.goats.length;
  while (m.queue.length && m.queue[0].t <= m.qt && alive < m.maxAlive) { spawn(m, m.queue.shift()); alive++; }
  const cakeHome = m.cake.state === 'home';
  for (const g of m.goats) {
    if (g.stagger > 0) { g.stagger -= dt; continue; }
    if (g.type === 'king' && stepKing(m, g, dt)) continue;
    const nav = navTarget(m, g), dx = nav.x - g.x, dz = nav.z - g.z, d = Math.hypot(dx, dz) || 0.001, dc = Math.hypot(g.x, g.z), sp = g.speed * g.slow; g.slow = 1;
    if (nav.wall && d < 0.35 + (g.type === 'king' ? 0.4 : 0)) { g.state = 'wall'; wallDamage(m, nav.wall, g.eat * (g.type === 'king' ? 5 : 2) * dt); }
    else if (nav.wall || (g.wp && g.wp.length) || dc > 1.45 + g.r * 0.5) { g.state = 'walk'; g.x += dx / d * sp * dt; g.z += dz / d * sp * dt; g.ry = Math.atan2(dx, dz); }
    else if (cakeHome) { g.state = 'eat'; m.cake.hp -= g.eat * dt; g.ry = Math.atan2(-g.x, -g.z); }
    else g.state = 'idle'; // Kuchen ist weg: die Ziegen suchen ratlos
  }
  separate(m);
  if (m.cake.hp <= 0 && !m.over) { m.cake.hp = 0; endMatch(m, 1, 'eaten'); }
}
function damageGoat(m, g, dmg, head, by, from) {
  if (g.dead || dmg <= 0) return false;
  if (g.type === 'king') { if (head) dmg *= KING7.headMult / 2; if (g.state === 'tired') dmg *= KING7.tiredMult; }
  g.hp -= dmg; if (by > 0) m.ev.push({ k: 'hit', g: g.id, by, head, d: +dmg.toFixed(3), weak: g.type === 'king' && (head || g.state === 'tired') });
  if (from && g.type !== 'king') { const ex = g.x - from[0], ez = g.z - from[2], l = Math.hypot(ex, ez) || 1, kb = g.type === 'bock' ? 0.15 : g.type === 'kid' ? 0.5 : 0.35; g.x += ex / l * kb; g.z += ez / l * kb; g.stagger = g.type === 'bock' ? 0.12 : 0.28; }
  if (g.hp <= 1e-6) {
    g.dead = true; const T = g.type === 'king' ? { coins: 80, pts: 200 } : TYPES[g.type], shooter = m.players.get(by);
    const c = T.coins + (head ? 5 : 0), pts = T.pts * (head ? 2 : 1); m.fort.coins += c; m.fort.points += pts; m.fort.kills++;
    if (shooter) { shooter.kills++; shooter.points += pts; }
    if (g.type === 'king') { m.fort.kingDown = true; const rew = 60; m.fort.coins += rew; m.ev.push({ k: 'bossreward', coins: rew }); }
    m.ev.push({ k: 'kill', g: g.id, by, head, coins: c, pts, king: g.type === 'king' });
    m.goats.splice(m.goats.indexOf(g), 1); return true;
  }
  return false;
}
function stepNades(m, dt) {
  for (let i = m.nades.length - 1; i >= 0; i--) { const n = m.nades[i];
    n.vy -= 18 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
    if (n.y < 0.12) { n.y = 0.12; if (n.vy < 0) { n.vy = -n.vy * 0.35; n.vx *= 0.6; n.vz *= 0.6; if (n.vy < 0.6) n.vy = 0; } }
    n.fuse -= dt; if (n.fuse > 0) continue; m.nades.splice(i, 1); explode(m, n.x, n.y, n.z, NADE.radius, NADE.dmg * (1 + 0.2 * m.fort.upg.dmg), 30, n.by);
  }
}
function explode(m, x, y, z, R, dmg, sheepDmg, by) {
  let n = 0; for (const g of [...m.goats]) { const d = Math.hypot(g.x - x, 0.9 * g.s - y, g.z - z); if (d <= R + g.r) { const k = Math.max(0, 1 - Math.max(0, d - g.r) / R); damageGoat(m, g, dmg * (0.15 + 0.85 * k), false, by, null); n++; } }
  for (const q of m.players.values()) if (q.role === 'sheep' && q.alive() && Math.hypot(q.x - x, q.z - z) <= R * 0.8) hurtSheep(m, q, sheepDmg, by);
  m.ev.push({ k: 'boom', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), n, by });
}

// ---------- Spieler: Treffer, Tod, Respawn ----------
function hurtPlayer(m, q, dmg, byId, kx, kz, kb) {
  if (q.dead || q.prot > 0 || dmg <= 0) return false;
  q.hp -= dmg; m.ev.push({ k: 'phit', id: q.id, by: byId, d: Math.round(dmg), hp: Math.max(0, Math.round(q.hp)) });
  if (kb) { const l = Math.hypot(kx, kz) || 1; q.x += kx / l * kb; q.z += kz / l * kb; clampArena(q); pushOut(m, q, 0.4, true); corr(q); }
  if (q.hp <= 0) { q.dead = true; q.hp = 0; q.diedAt = m.time; q.respawnAt = m.time + H.def.respawn; q.deaths++; const k = m.players.get(byId); if (k) k.pkills++; m.ev.push({ k: 'pkill', id: q.id, by: byId }); }
  return true;
}
let sidSeq = 0;
function newSid(m) { return (Math.floor(m.rand() * 9000) + 1000) * 100 + (++sidSeq % 100); } // zufällig, nicht fortlaufend (keine Rückschlüsse)
function hurtSheep(m, q, dmg, by) {
  if (!q.alive() || q.prot > 0 || dmg <= 0) return false;
  q.revealUntil = m.time + H.sheep.revealT;
  if (q.shield > 0) { const a = Math.min(q.shield, dmg); q.shield -= a; dmg -= a; m.ev.push({ k: 'shieldhit', sid: q.sid, left: Math.round(q.shield) }); if (q.shield <= 0) { q.shield = 0; m.ev.push({ k: 'shieldoff', sid: q.sid, why: 'broken' }); } if (dmg <= 0) return true; }
  q.hp -= dmg; m.ev.push({ k: 'shurt', sid: q.sid, id: q.id, by, d: Math.round(dmg), hp: Math.max(0, Math.round(q.hp)), only: 1 });
  if (m.cake.state === 'carried' && m.cake.by === q.id && m.time - (m.omiCakeShotAt ?? -99) > 8) { m.omiCakeShotAt = m.time; m.ev.push({ k: 'omi', q: 'cakeshot' }); }
  m.ev.push({ k: 'sheephit', sid: q.sid, by, x: +q.x.toFixed(2), z: +q.z.toFixed(2) });
  if (q.hp <= 0) killSheep(m, q, by);
  return true;
}
// V7.2: Der getragene Kuchen schützt den Rücken. Nur Treffer, die von hinten kommen UND die hintere Körperhälfte in Rückenhöhe treffen.
function cakeBack(m, q, hit, dir) {
  if (!(m.cake.state === 'carried' && m.cake.by === q.id)) return false;
  const fx = -Math.sin(q.yaw), fz = -Math.cos(q.yaw), rx = hit[0] - q.x, rz = hit[2] - q.z, ry = hit[1] - q.y;
  const behind = rx * fx + rz * fz < -0.08, fromBehind = dir[0] * fx + dir[2] * fz > 0.2, onBack = ry > 0.55 && ry < 1.55;
  if (!(behind && fromBehind && onBack)) return false;
  m.ev.push({ k: 'cakeblock', sid: q.sid, x: +hit[0].toFixed(2), y: +hit[1].toFixed(2), z: +hit[2].toFixed(2) }); return true;
}
function killSheep(m, q, by) {
  q.dead = true; q.hp = 0; q.deaths++; q.lives = Math.max(0, q.lives - 1); q.grabT = 0; q.grabbing = false; q.shield = 0;
  const shooter = m.players.get(by); if (shooter) { shooter.pkills++; shooter.points += 50; m.fort.points += 50; m.fort.coins += 25; }
  if (m.cake.state === 'carried' && m.cake.by === q.id) dropCake(m, q.x, q.z);
  m.ev.push({ k: 'sheepdie', sid: q.sid, id: q.id, by, x: +q.x.toFixed(2), z: +q.z.toFixed(2), lives: q.lives }); m.ev.push({ k: 'omi', q: 'die' });
  if (q.lives > 0) q.respawnAt = m.time + H.sheep.respawn;
  else if (m.wave >= MAX_WAVES && m.phase !== 'shop' && m.phase !== 'countdown') { q.out = true; q.respawnAt = Infinity; m.ev.push({ k: 'sheepout', id: q.id }); }
  else { q.waiting = true; q.respawnAt = Infinity; m.ev.push({ k: 'sheepwait', id: q.id, only: 1 }); }
}
function sheepSpawnPoint(m) { // in der Herde, weg von Verteidigern
  let best = null, bd = -1;
  for (let i = 0; i < 10; i++) { const n = m.npcs.length ? m.npcs[Math.floor(m.rand() * m.npcs.length)] : null; const a = m.rand() * 6.283;
    const x = n ? n.x + Math.cos(a) * 1.6 : Math.cos(a) * 22, z = n ? n.z + Math.sin(a) * 1.6 : Math.sin(a) * 22;
    if (Math.hypot(x, z) < H.herdIn || Math.hypot(x - H.omi.x, z - H.omi.z) < 5) continue;
    let dmin = 1e9; for (const q of m.players.values()) if (q.role === 'def' && !q.dead) dmin = Math.min(dmin, Math.hypot(q.x - x, q.z - z));
    if (dmin > bd) { bd = dmin; best = [x, z]; } }
  return best || [0, 24];
}
function respawnSheep(m, q) { const [x, z] = sheepSpawnPoint(m); Object.assign(q, { dead: false, waiting: false, hp: H.sheep.hp, x, z, y: 0, prot: H.sheep.protect, sid: newSid(m), grabT: 0, revealUntil: 0 }); corr(q); m.ev.push({ k: 'sheepspawn', id: q.id, only: 1 }); }
function defSpawnPoint(m, ps) { const opts = [[-1.8, 2.6], [1.8, 2.6], [0, -2.8]]; return opts[ps.idx % opts.length]; }

// ---------- Kuchen ----------
function dropCake(m, x, z) { const p = { x, z }; clampArena(p, H.arenaR - 1); Object.assign(m.cake, { state: 'dropped', by: 0, x: p.x, z: p.z, returnAt: m.time + H.cake.autoReturn, near: false }); m.ev.push({ k: 'cakedrop', x: +p.x.toFixed(2), z: +p.z.toFixed(2) }); m.ev.push({ k: 'omi', q: 'drop' }); }
function returnCake(m, by) { Object.assign(m.cake, { state: 'home', by: 0, x: 0, z: 0 }); m.ev.push({ k: 'cakereturn', by }); }
function stepCake(m, dt) {
  const c = m.cake;
  if (c.state === 'carried') { for (const o of m.players.values()) if (o.id !== c.by) o.grabT = 0; // niemand „lädt“ vor, während ein anderer trägt
    const q = m.players.get(c.by); if (!q || !q.alive()) { dropCake(m, c.x, c.z); return; }
    c.x = q.x; c.z = q.z; const dO = Math.hypot(q.x - H.omi.x, q.z - H.omi.z);
    if (!c.near && dO < 10) { c.near = true; m.ev.push({ k: 'omi', q: 'near' }); }
    if (dO <= H.omi.r) { m.ev.push({ k: 'delivered', id: q.id }); m.ev.push({ k: 'omi', q: 'win' }); endMatch(m, 1, 'delivered'); }
    return; }
  if (c.state === 'dropped') { if (m.time >= c.returnAt) { returnCake(m, 0); return; }
    for (const q of m.players.values()) if (q.role === 'def' && !q.dead && Math.hypot(q.x - c.x, q.z - c.z) <= H.cake.returnR) { returnCake(m, q.id); q.points += 40; return; } }
  // Aufnahme: Schaf hält die Interaktion im Radius, der Server zählt die Zeit
  for (const q of m.players.values()) { if (q.role !== 'sheep') continue;
    if (!q.alive() || !q.grabbing || c.state === 'carried' || Math.hypot(q.x - c.x, q.z - c.z) > H.cake.grabR || q.y > 1.2) { q.grabT = 0; continue; }
    q.grabT += dt; if (q.grabT >= H.cake.grabT) { q.grabT = 0; q.grabbing = false;
      Object.assign(c, { state: 'carried', by: q.id, near: false }); q.revealUntil = m.time + 999;
      if (q.shield > 0) { q.shield = 0; q.shieldUntil = 0; m.ev.push({ k: 'shieldoff', sid: q.sid, why: 'cake' }); } // Schildregel: Kuchen und Schild nie zusammen
      q.speedUntil = 0; m.ev.push({ k: 'cakesteal', id: q.id, sid: q.sid }); m.ev.push({ k: 'omi', q: 'steal' });
      if (m.fort.builds.some(b => b.kind === 'cakealarm')) m.ev.push({ k: 'cakealarm', only: 0 }); break; } }
}

// ---------- Herde (NPC-Schafe) ----------
function newNpc(m, x, z, grp = 0) { return { sid: newSid(m), x, z, y: 0, vy: 0, ry: m.rand() * 6.283, state: 'graze', t: 1 + m.rand() * 4, tx: x, tz: z, hp: H.npcSheep.hp, threat: new Map(), target: 0, dead: false, sp: 0.9 + m.rand() * 0.6, grp, helper: false, cmd: null }; }
// V7.2: Herdenband je Welle (innen/außen). Innerhalb einer Welle gleitet es langsam zur nächsten Stufe – Zeitdruck ohne Sprünge.
function herdBand(m) { const B = H.herdBands, w = Math.max(1, Math.min(8, m.wave || 1)), a = B[w - 1], b = B[Math.min(7, w)], f = m.phase === 'wave' ? Math.min(1, (m.waveT || 0) / 100) * 0.5 : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
// Drei lose Gruppen, die langsam um die Festung wandern und mit dem Band nach innen rücken
function initHerd(m) { const base = m.rand() * 6.283, [ri, ro] = herdBand(m); m.herd = [0, 1, 2].map(i => ({ a: base + i * 2.09 + (m.rand() - 0.5) * 0.6, r: (ri + ro) / 2 + (m.rand() - 0.5) * 4, va: 0 })); }
function stepHerd(m, dt) { const [ri, ro] = herdBand(m), mid = (ri + ro) / 2;
  for (const g of m.herd) { g.va = Math.max(-0.02, Math.min(0.02, g.va + (m.rand() - 0.5) * 0.01 * dt * 10)); g.a += g.va * dt;
    const want = Math.max(ri + 2, Math.min(ro - 2, mid)); g.r += Math.max(-0.22 * dt, Math.min(0.22 * dt, want - g.r));
    const cx = Math.cos(g.a) * g.r, cz = Math.sin(g.a) * g.r; if (Math.hypot(cx - H.omi.x, cz - H.omi.z) < 9) g.a += (cx >= 0 ? 1 : -1) * 0.3 * dt; } }
function herdPoint(m, n) { const [ri, ro] = herdBand(m), g = m.herd[n ? n.grp % m.herd.length : Math.floor(m.rand() * m.herd.length)];
  for (let i = 0; i < 14; i++) { const cx = Math.cos(g.a) * g.r, cz = Math.sin(g.a) * g.r, a = m.rand() * 6.283, rr = 1.5 + m.rand() * 6;
    let x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; const d = Math.hypot(x, z) || 1, dc = Math.max(ri, Math.min(ro, d)); x *= dc / d; z *= dc / d;
    if (Math.hypot(x - H.omi.x, z - H.omi.z) > 5 && !inFort(x, z, -1.6)) return [x, z]; }
  const a = g.a, r = Math.max(ri, Math.min(ro, g.r)); return [Math.cos(a) * r, Math.sin(a) * r]; }
function aimDir(q) { const cp = Math.cos(q.pitch); return [-Math.sin(q.yaw) * cp, Math.sin(q.pitch), -Math.cos(q.yaw) * cp]; }
// Wird das Schaf vom Verteidiger direkt anvisiert? (Waffenrichtung, Sichtlinie, begrenzter Winkel, Reichweite)
function aimedAt(m, q, x, z) {
  const o = [q.x, q.y + 1.55, q.z], dx = x - o[0], dy = 0.78 - o[1], dz = z - o[2], d = Math.hypot(dx, dy, dz);
  if (d > H.npcSheep.aimR || d < 0.5) return false; const f = aimDir(q), c = (f[0] * dx + f[1] * dy + f[2] * dz) / d;
  if (c < Math.cos(Math.atan(0.85 / d) + 0.03)) return false; return los(m, o, x, 0.78, z);
}
function stepNpcs(m, dt) {
  const N = H.npcSheep;
  stepHerd(m, dt);
  for (const n of m.npcs) {
    if (n.dead) continue;
    if (n.cmd) { stepHelper(m, n, dt); continue; } // kommandiertes Helferschaf
    if (n.y > 0 || n.vy) { n.vy -= 20 * dt; n.y = Math.max(0, n.y + n.vy * dt); if (n.y === 0) n.vy = 0; }
    // Bedrohung durch Anvisieren (nicht durch bloße Nähe): erst nach kurzer Zeit Warnung, dann Angriff
    if (n.state !== 'warn' && n.state !== 'charge' && n.state !== 'calm') {
      for (const q of m.players.values()) { if (q.role !== 'def' || q.dead) continue;
        let v = n.threat.get(q.id) || 0; v = aimedAt(m, q, n.x, n.z) ? v + dt : Math.max(0, v - dt * 2); n.threat.set(q.id, v);
        if (v >= N.aimT) { n.state = 'warn'; n.t = N.warnT; n.target = q.id; n.ry = Math.atan2(q.x - n.x, q.z - n.z); n.threat.clear(); m.ev.push({ k: 'sheepwarn', sid: n.sid }); break; } } }
    const tq = n.target ? m.players.get(n.target) : null;
    if (n.state === 'warn') { n.t -= dt; if (tq) n.ry = Math.atan2(tq.x - n.x, tq.z - n.z); if (n.t <= 0) { if (tq && !tq.dead) { n.state = 'charge'; n.t = N.chargeT; } else { n.state = 'calm'; n.t = N.calm; } } continue; }
    if (n.state === 'charge') { n.t -= dt;
      if (!tq || tq.dead || n.t <= 0 || Math.hypot(tq.x - n.x, tq.z - n.z) > 30) { n.state = 'calm'; n.t = N.calm; continue; }
      const dx = tq.x - n.x, dz = tq.z - n.z, d = Math.hypot(dx, dz) || 1; n.ry = Math.atan2(dx, dz);
      if (d < 1.3) { hurtPlayer(m, tq, N.hitDmg, 0, dx, dz, 1.6); m.ev.push({ k: 'sheepbutt', sid: n.sid, id: tq.id }); n.state = 'calm'; n.t = N.calm; continue; }
      n.x += dx / d * N.chargeSpeed * dt; n.z += dz / d * N.chargeSpeed * dt; pushOut(m, n, 0.5); continue; }
    // Flucht vor nahen Zombies
    let fx = 0, fz = 0; for (const g of m.goats) { const ex = n.x - g.x, ez = n.z - g.z, e = Math.hypot(ex, ez); if (e < N.flee && e > 0.01) { fx += ex / e; fz += ez / e; } }
    if (fx || fz) { const l = Math.hypot(fx, fz); n.state = 'flee'; n.t = 1; n.tx = n.x + fx / l * 4; n.tz = n.z + fz / l * 4; }
    n.t -= dt;
    if (n.state === 'graze' || n.state === 'calm' || n.state === 'idle') { if (n.t <= 0) { if (n.state === 'graze' && m.rand() < 0.35) { n.state = 'idle'; n.t = 1.5 + m.rand() * 3; } else { n.state = 'walk'; [n.tx, n.tz] = herdPoint(m, n); n.t = 12; } } } // grasen, umsehen, mit der Gruppe weiterziehen
    else { const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz), sp = n.state === 'flee' ? 3.8 : 1.1 * n.sp;
      if (d < 0.3 || n.t <= 0) { n.state = 'graze'; n.t = 2 + m.rand() * 5; }
      else { n.x += dx / d * Math.min(d, sp * dt); n.z += dz / d * Math.min(d, sp * dt); n.ry = Math.atan2(dx, dz); } }
    const p = { x: n.x, z: n.z }; pushOut(m, p, 0.5); clampArena(p, H.arenaR - 1); n.x = p.x; n.z = p.z;
    // zu nah an der Festung (nach Flucht oder Angriff)? Das nächste Ziel liegt wieder im Herdenband: zu Fuß zurück, nie teleportieren
  }
}
function hurtNpc(m, n, dmg, by) {
  n.hp -= dmg; m.ev.push({ k: 'sheephit', sid: n.sid, by, x: +n.x.toFixed(2), z: +n.z.toFixed(2) });
  if (n.hp <= 0) { n.dead = true; m.npcs.splice(m.npcs.indexOf(n), 1); m.fort.coins = Math.max(0, m.fort.coins - H.npcSheep.killPenalty);
    m.ev.push({ k: 'npcdie', sid: n.sid, by, x: +n.x.toFixed(2), z: +n.z.toFixed(2), penalty: H.npcSheep.killPenalty }); // tot bleibt tot: die Herde wird kleiner
    if (n.helper) { n.helper = false; m.helperReadyAt = m.time + H.helper.replaceCd; m.ev.push({ k: 'helperdie', sid: n.sid, only: 1 }); }
    // V7.2: unschuldiges Schaf vom Verteidigerteam getötet (Schüsse sind die einzige Todesursache für Herdenschafe; Geschütze, Fallen und Werwölfe verscheuchen nur)
    const shooter = m.players.get(by); if (shooter && shooter.role === 'def') { m.fort.wrong++; shooter.wrong = (shooter.wrong || 0) + 1;
      m.ev.push({ k: 'wrong', n: m.fort.wrong, max: H.wrongMax, by }); m.ev.push({ k: 'omi', q: 'wrong' + Math.min(4, m.fort.wrong), pri: 1 });
      if (m.fort.wrong > H.wrongMax) endMatch(m, 1, 'wrongkills'); }
    return; }
  if (n.state !== 'charge') { n.state = 'warn'; n.t = 0.45; n.target = by; m.ev.push({ k: 'sheepwarn', sid: n.sid }); } // getroffen: wehrt sich sofort
}
// ---------- V7.2: Helferschafe (bis zu 3 NPCs der Herde, nur für das Schaf-Team erkennbar) ----------
const HELP = H.helper;
function helperJump(m, n, tx, tz) { // an niedrigen Holzmauern hochspringen; Stein und Stahl sind zu hoch
  if (n.y > 0) return; const k = nearWall(m, n.x, n.z, 0.95); if (!k) return; const wl = m.fort.walls[k], s = SIDES[k];
  const a = s.ax === 'x' ? n.x : n.z, ta = s.ax === 'x' ? tx : tz; if ((a - s.sg * F) * (ta - s.sg * F) >= 0) return; // Ziel liegt nicht hinter dieser Mauer
  if (wl.lvl <= 1) { n.vy = HELP.jumpV; n.y = 0.01; m.ev.push({ k: 'hjump', sid: n.sid }); } }
function helperButt(m, n, tgt) {
  if (m.time - (n.buttAt ?? -9) < HELP.buttCd) return; n.buttAt = m.time; m.ev.push({ k: 'butt', sid: n.sid, x: +n.x.toFixed(2), z: +n.z.toFixed(2) });
  if (tgt.q) hurtPlayer(m, tgt.q, HELP.buttDmg, 0, tgt.q.x - n.x, tgt.q.z - n.z, 1.4);
  else if (tgt.f) hurtWolf(m, tgt.f, HELP.buttWolf, 0);
  else if (tgt.b) hurtBuild(m, tgt.b, HELP.buttBuild);
  else if (tgt.wall) { const wl = m.fort.walls[tgt.wall]; wallDamage(m, tgt.wall, wl.gate ? HELP.buttGate : wl.lvl <= 1 ? HELP.buttWall : 0.3); } }
function sabotageTarget(m, n) { // nächstes erreichbares Verteidigungsobjekt: Werwolf, Bauwerk mit Lebenspunkten, Tor
  let best = null, bd = 1e9; const take = (x, z, o) => { const d = Math.hypot(x - n.x, z - n.z); if (d < bd) { bd = d; best = { x, z, ...o }; } };
  for (const f of m.wolves) if (!f.dead) take(f.x, f.z, { f });
  for (const b of m.fort.builds) if (b.hp != null && b.kind !== 'bot') take(b.x, b.z, { b });
  for (const k in SIDES) { const wl = m.fort.walls[k]; if (wl.lvl && wl.gate) { const s = SIDES[k], x = s.ax === 'x' ? s.sg * (F + 0.7) : 0, z = s.ax === 'z' ? s.sg * (F + 0.7) : 0; take(x, z, { wall: k }); } }
  return best; }
function stepHelper(m, n, dt) {
  const C = n.cmd; C.t -= dt;
  if (n.y > 0 || n.vy) { n.vy -= 20 * dt; n.y = Math.max(0, n.y + n.vy * dt); if (n.y === 0) n.vy = 0; }
  if (C.t <= 0) { n.cmd = null; n.state = 'walk'; [n.tx, n.tz] = herdPoint(m, n); n.t = 14; return; } // zurück zur Herde (zu Fuß)
  let tx = C.x, tz = C.z, sp = HELP.speed[C.mode], tgt = null;
  if (C.mode === 'distract') { // auseinander, Haken schlagen, Lärm machen
    if ((C.zz -= dt) <= 0) { C.zz = 0.9 + m.rand() * 1.3; C.ang += (m.rand() - 0.5) * 1.8; }
    const r = Math.hypot(C.x - n.x, C.z - n.z) > 9 && !C.arrived ? 0 : 7; if (r) C.arrived = true; tx = C.x + Math.cos(C.ang) * r; tz = C.z + Math.sin(C.ang) * r;
    if (inFort(tx, tz, -1.2)) { const l = Math.hypot(tx, tz) || 1; tx *= (F + 2) / l; tz *= (F + 2) / l; } }
  else if (C.mode === 'sabotage') { if ((C.re -= dt) <= 0 || !C.tg || (C.tg.f && C.tg.f.dead) || (C.tg.b && !m.fort.builds.includes(C.tg.b)) || (C.tg.wall && !m.fort.walls[C.tg.wall].lvl)) { C.re = 1; C.tg = sabotageTarget(m, n); }
    if (C.tg) { tx = C.tg.f ? C.tg.f.x : C.tg.x; tz = C.tg.f ? C.tg.f.z : C.tg.z; if (Math.hypot(tx - n.x, tz - n.z) < (C.tg.wall ? 1.0 : 1.5)) tgt = C.tg; } }
  else { // gemeinsam stürmen: zum Angriffspunkt, über Holzmauern, Verteidiger anrempeln, den Weg zum Kuchen freimachen
    let bq = null, bd = 7; for (const q of m.players.values()) if (q.role === 'def' && !q.dead) { const d = Math.hypot(q.x - n.x, q.z - n.z); if (d < bd && (inFort(n.x, n.z, 0.2) === inFort(q.x, q.z, 0.2))) { bd = d; bq = q; } }
    if (bq) { tx = bq.x; tz = bq.z; if (bd < 1.4) tgt = { q: bq }; }
    else if (inFort(n.x, n.z, 0.3)) { C.ang += dt * 1.4; tx = Math.cos(C.ang) * 2.2; tz = Math.sin(C.ang) * 2.2; sp = 3; } // um den Kuchen kreisen – aufnehmen kann ihn nur der echte Schafspieler
    else { const k = nearWall(m, n.x, n.z, 1.0); if (k && m.fort.walls[k].lvl >= 2 && n.y === 0) tgt = { wall: k }; } }
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
  if (tgt) { helperButt(m, n, tgt); n.state = 'charge'; n.ry = Math.atan2(dx, dz); }
  else if (d > 0.3) { helperJump(m, n, tx, tz); const st = Math.min(d, sp * dt); n.x += dx / d * st; n.z += dz / d * st; n.ry = Math.atan2(dx, dz); n.state = sp > 3.5 ? 'run' : 'walk'; }
  const p = { x: n.x, z: n.z }; const k = nearWall(m, n.x, n.z, 0.9); if (!(k && n.y >= wallH(m.fort.walls[k].lvl) - 0.05)) pushOut(m, p, 0.5); clampArena(p, H.arenaR - 1); n.x = p.x; n.z = p.z;
}
function setHelper(m, ps, msg) {
  const fail = why => { reject(ps, 'helper'); m.ev.push({ k: 'helperfail', why, only: 1, by: ps.id }); };
  if (ps.role !== 'sheep' || ps.out) return fail('role');
  const n = m.npcs.find(x => x.sid === +msg.sid); if (!n || n.dead) return fail('gone');
  if (!msg.v) { if (!n.helper) return; n.helper = false; n.cmd = null; m.ev.push({ k: 'helper', sid: n.sid, v: 0, only: 1 }); return; }
  if (n.helper) return fail('dup'); // kein NPC doppelt (auch nicht im 2v2)
  if (m.npcs.filter(x => x.helper).length >= HELP.max) return fail('max');
  if (m.time < (m.helperReadyAt || 0)) return fail('cooldown');
  if (ps.alive() && Math.hypot(n.x - ps.x, n.z - ps.z) > HELP.pickR) return fail('far');
  n.helper = true; m.ev.push({ k: 'helper', sid: n.sid, v: 1, only: 1 });
}
function helperCmd(m, ps, msg) {
  const fail = why => { reject(ps, 'cmd'); m.ev.push({ k: 'cmdfail', why, only: 1, by: ps.id }); };
  if (ps.role !== 'sheep' || ps.out) return fail('role'); if (!HELP.dur[msg.mode]) return fail('bad');
  const hs = m.npcs.filter(x => x.helper && !x.dead); if (!hs.length) return fail('none');
  if (m.time < (m.cmdReadyAt || 0)) return fail('cooldown');
  let x = +msg.x, z = +msg.z; if (!Number.isFinite(x) || !Number.isFinite(z)) { [x, z] = m.attackPt || [0, 0]; }
  const p = { x, z }; clampArena(p, H.arenaR - 1); m.cmdReadyAt = m.time + HELP.cmdCd; const base = m.rand() * 6.283;
  hs.forEach((n, i) => { n.cmd = { mode: msg.mode, t: HELP.dur[msg.mode], x: p.x + (msg.mode === 'storm' ? (m.rand() - 0.5) * 2 : 0), z: p.z + (msg.mode === 'storm' ? (m.rand() - 0.5) * 2 : 0), ang: base + i * 2.09, zz: 0, re: 0, tg: null, arrived: false }; n.state = 'run'; n.threat.clear(); });
  m.cmdMode = msg.mode; m.cmdUntil = m.time + HELP.dur[msg.mode];
  m.ev.push({ k: 'cmd', mode: msg.mode, n: hs.length, x: +p.x.toFixed(1), z: +p.z.toFixed(1), only: 1 });
  if (msg.mode === 'storm' && hs.length >= 2) m.ev.push({ k: 'omi', q: 'storm' });
}
// ---------- V7.2: Verdacht (intern) → Tarnungsanzeige nur für den Schafspieler ----------
function stepSus(m, ps, dt) {
  const S = H.sus, sp = ps.lastMoveSpeed || 0, t = m.time; let s = ps.sus || 0;
  if (sp > 3.4) s += S.sprint * dt; else if (sp > 2.6) s += S.trot * dt; else if (sp < 0.4) s -= S.still * dt; else if (sp < 1.8) s -= S.slow * dt;
  if (ps.y > 0.35 && (ps.prevY || 0) <= 0.35) s += S.jump; if (ps.y > 1.0) s += S.climb * dt;
  if (inFort(ps.x, ps.z, -0.3)) s += S.fort * dt;
  ps.prevY = ps.y; ps.sus = Math.max(0, Math.min(1, s));
  const carrying = m.cake.state === 'carried' && m.cake.by === ps.id;
  ps.tarn = carrying || ps.revealUntil > t || ps.sus >= S.reveal ? 2 : ps.sus >= S.warn ? 1 : 0;
}
// ---------- V7.2: Alarmanlagen (Hinweise, keine Identität) ----------
function alarmSources(m) { const out = [];
  for (const q of m.players.values()) if (q.role === 'sheep' && q.alive()) out.push({ x: q.x, z: q.z, sp: q.lastMoveSpeed || 0, loud: (q.y > 0.4) || m.time - (q.meleeAt ?? -9) < 0.6 });
  for (const n of m.npcs) if (!n.dead) out.push({ x: n.x, z: n.z, sp: n.state === 'run' || n.state === 'flee' || n.state === 'charge' ? 4 : n.state === 'walk' ? 1.2 : 0, loud: n.y > 0.4 || m.time - (n.buttAt ?? -9) < 0.6 });
  for (const c of m.decoys) out.push({ x: c.x, z: c.z, sp: 4.6, loud: false }); return out; }
function stepAlarms(m) {
  const bells = m.fort.builds.filter(b => b.kind === 'bell' || b.kind === 'motion'); if (!bells.length) return; const src = alarmSources(m);
  for (const b of bells) { const S = DEF_SHOP[b.kind]; if (m.time - (b.rang ?? -99) < S.cd) continue;
    const hit = src.find(o => Math.hypot(o.x - b.x, o.z - b.z) < S.r && (b.kind === 'motion' ? o.sp > S.speed : o.sp > 3.4 || o.loud || inFort(o.x, o.z, -0.2)));
    if (hit) { b.rang = m.time; m.ev.push({ k: 'alarm', kind: b.kind, b: b.id, x: +b.x.toFixed(1), z: +b.z.toFixed(1), side: b.side || null, only: 0 }); } } }
// Was ein Schaf an seiner Stelle von den Verteidigern sehen kann (Mauern verdecken; kurz nachwirkend gegen Flackern)
function defVisible(m, viewer, q) { if (q.dead) return false; const d = Math.hypot(q.x - viewer.x, q.z - viewer.z); if (d < 7) return true; if (d > 60) return false;
  return los(m, [viewer.x, viewer.y + 0.95, viewer.z], q.x, q.y + 1.5, q.z) || los(m, [viewer.x, viewer.y + 0.95, viewer.z], q.x, q.y + 0.6, q.z); }
function stepDecoys(m, dt) { for (const c of m.decoys) { c.t -= dt; c.x += Math.sin(c.ry) * 4.6 * dt; c.z += Math.cos(c.ry) * 4.6 * dt; const p = { x: c.x, z: c.z }; if (clampArena(p, H.arenaR - 1)) c.ry += Math.PI * 0.7; pushOut(m, p, 0.5); c.x = p.x; c.z = p.z; }
  for (const c of m.decoys) if (c.t <= 0) m.ev.push({ k: 'poof', sid: c.sid, x: +c.x.toFixed(2), z: +c.z.toFixed(2) });
  m.decoys = m.decoys.filter(c => c.t > 0); m.smokes = m.smokes.filter(s => (s.t -= dt) > 0); }

// ---------- Werwölfe (an den Kuchen gebunden) ----------
let wolfSeq = 0;
function hurtWolf(m, f, dmg, by) { if (f.dead) return; f.hp -= dmg; m.ev.push({ k: 'wolfhit', f: f.id, by, hp: Math.max(0, Math.round(f.hp)) }); if (f.hp <= 0) { f.dead = true; m.ev.push({ k: 'wolfdie', f: f.id, by }); } }
// Schafspieler sind für Werwölfe nur sichtbar, wenn ihre Tarnung aufgeflogen ist (Kampf, Kuchen) oder sie in der Festung stehen
const sheepExposed = (m, q) => q.alive() && q.prot <= 0 && (q.revealUntil > m.time || (m.cake.state === 'carried' && m.cake.by === q.id) || inFort(q.x, q.z, -0.3));
function stepWolves(m, dt) {
  const W = WOLF7;
  for (const f of m.wolves) {
    if (f.dead) continue;
    f.life -= dt; f.cd -= dt; if (f.life <= 0) { f.dead = true; m.ev.push({ k: 'wolfdie', f: f.id, expired: true }); continue; }
    const home = m.cake.state === 'home' ? [0, 0] : [m.cake.x, m.cake.z];
    let best = null, bd = 1e9;
    for (const g of m.goats) { if (Math.hypot(g.x - home[0], g.z - home[1]) > W.guard) continue; const d = Math.hypot(g.x - f.x, g.z - f.z); if (d < bd) { bd = d; best = { g, x: g.x, z: g.z }; } }
    for (const q of m.players.values()) { if (q.role !== 'sheep' || !sheepExposed(m, q)) continue; if (Math.hypot(q.x - home[0], q.z - home[1]) > W.guard + 2) continue;
      if (!los(m, [f.x, 2.0, f.z], q.x, 1.3, q.z) && !inFort(q.x, q.z)) continue; const d = Math.hypot(q.x - f.x, q.z - f.z) - 2; if (d < bd) { bd = d; best = { q, x: q.x, z: q.z }; } }
    for (const n of m.npcs) { if (!n.cmd || n.dead || Math.hypot(n.x - home[0], n.z - home[1]) > W.guard + 2) continue; const d = Math.hypot(n.x - f.x, n.z - f.z) - 1; if (d < bd) { bd = d; best = { n, x: n.x, z: n.z }; } } // Helfer lenken ab
    let tx, tz; if (best) { tx = best.x; tz = best.z; } else { f.idleA += dt * 0.7; tx = home[0] + Math.cos(f.idleA) * W.patrol; tz = home[1] + Math.sin(f.idleA) * W.patrol; }
    const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz) || 0.001; f.state = best ? 'run' : 'patrol'; f.ry = Math.atan2(dx, dz);
    if (best && d <= W.range + (best.g ? best.g.r : 0.5)) { f.state = 'bite';
      if (f.cd <= 0) { f.cd = W.cd; m.ev.push({ k: 'wolfbite', f: f.id }); if (best.g) damageGoat(m, best.g, W.biteGoat, false, f.id, [f.x, 0, f.z]); else if (best.n) { const ex = best.n.x - f.x, ez = best.n.z - f.z, el = Math.hypot(ex, ez) || 1; best.n.x += ex / el * 1.6; best.n.z += ez / el * 1.6; } else hurtSheep(m, best.q, W.biteSheep, f.owner); } }
    else { const sp = best ? W.speed : W.speed * 0.45; f.x += dx / d * sp * dt; f.z += dz / d * sp * dt; } // Werwölfe springen über Mauern, bleiben aber an der Leine
    // Leine: nie weiter als der Schutzradius vom Kuchen
    const ex = f.x - home[0], ez = f.z - home[1], el = Math.hypot(ex, ez); if (el > W.guard) { f.x = home[0] + ex / el * W.guard; f.z = home[1] + ez / el * W.guard; f.leash = (f.leash || 0) + 1; }
  }
  for (let i = m.wolves.length - 1; i >= 0; i--) if (m.wolves[i].dead && (m.wolves[i].goneT = (m.wolves[i].goneT || 0) + dt) > 1.2) m.wolves.splice(i, 1);
}

// ---------- Bauwerke ----------
function removeBuild(m, b) { const i = m.fort.builds.indexOf(b); if (i >= 0) m.fort.builds.splice(i, 1); m.ev.push({ k: 'bdestroy', b: b.id, kind: b.kind }); }
function hurtBuild(m, b, dmg) { if (b.hp == null) return; b.hp -= dmg; m.ev.push({ k: 'bhit', b: b.id }); if (b.hp <= 0) removeBuild(m, b); }
function stepBuilds(m, dt) {
  for (const b of [...m.fort.builds]) {
    b.cd = (b.cd || 0) - dt; b.tgt = null;
    if (b.kind === 'tower' || b.kind === 'gun') { const S = DEF_SHOP[b.kind];
      let best = null, bd = S.range; for (const g of m.goats) { const d = Math.hypot(g.x - b.x, g.z - b.z); if (d < bd) { bd = d; best = g; } }
      let sheep = null; if (b.kind === 'tower' && !best) for (const q of m.players.values()) if (q.role === 'sheep' && sheepExposed(m, q) && Math.hypot(q.x - b.x, q.z - b.z) < S.range * 0.7) sheep = q;
      const t = best || sheep; if (t) b.tgt = [t.x, t.z];
      if (t && b.cd <= 0) { b.cd = S.cd; if (best) damageGoat(m, best, S.dmg * (1 + 0.2 * m.fort.upg.dmg), false, -900 - b.id, [b.x, 0, b.z]); else { const dx = sheep.x - b.x, dz = sheep.z - b.z, l = Math.hypot(dx, dz) || 1, dir = [dx / l, -0.1, dz / l];
        const back = cakeBack(m, sheep, [sheep.x - dir[0] * 0.5, sheep.y + 0.95, sheep.z - dir[2] * 0.5], dir); hurtSheep(m, sheep, S.sheepDmg * (back ? H.cakeBack : 1), -900 - b.id); } } }
    else if (b.kind === 'spikes') { const S = DEF_SHOP.spikes, horiz = b.side === 'N' || b.side === 'S';
      const inStrip = (x, z) => horiz ? Math.abs(x - b.x) < 3.2 && Math.abs(z - b.z) < 0.9 : Math.abs(z - b.z) < 3.2 && Math.abs(x - b.x) < 0.9;
      for (const g of [...m.goats]) if (inStrip(g.x, g.z)) { g.slow = S.slow; b.dur -= dt; damageGoat(m, g, S.dps * dt, false, -900 - b.id, null); }
      for (const q of m.players.values()) if (q.role === 'sheep' && q.alive() && q.y < 0.4 && inStrip(q.x, q.z)) { hurtSheep(m, q, S.sheepDps * dt, -900 - b.id); b.dur -= dt; }
      if (b.dur <= 0) removeBuild(m, b); }
    else if (b.kind === 'mine') { const S = DEF_SHOP.mine; let n = 0, trig = false;
      for (const g of m.goats) { const d = Math.hypot(g.x - b.x, g.z - b.z); if (d < 2.2) n++; if (g.type === 'king' && d < 2.6) trig = true; }
      for (const q of m.players.values()) if (q.role === 'sheep' && q.alive() && Math.hypot(q.x - b.x, q.z - b.z) < 1.5) trig = true;
      if (n >= 3 || trig) { removeBuild(m, b); explode(m, b.x, 0.3, b.z, S.r, S.dmg, S.sheepDmg, -900 - b.id); } }
    else if (b.kind === 'ammo') { for (const q of m.players.values()) if (q.role === 'def' && !q.dead && Math.hypot(q.x - b.x, q.z - b.z) < DEF_SHOP.ammo.r && m.time - (q.ammoAt || -9) > 1.5) {
      q.ammoAt = m.time; q.reloadUntil = 0; for (const k of q.owned) q.ammo[k] = magOf(m, k); if (q.nades < NADE.max && m.time - (q.nadeAt || -99) > 20) { q.nades++; q.nadeAt = m.time; } m.ev.push({ k: 'ammo', id: q.id }); } }
    else if (b.kind === 'bell' || b.kind === 'motion' || b.kind === 'cakealarm') { /* stepAlarms */ }
    else if (b.kind === 'bot') { b.life -= dt; if (b.life <= 0) { removeBuild(m, b); continue; }
      let side = null, low = 1; for (const k in SIDES) { const wl = m.fort.walls[k]; if (wl.lvl && wl.hp / wl.maxHp < low) { low = wl.hp / wl.maxHp; side = k; } }
      const tgt = side ? { x: SIDES[side].ax === 'x' ? SIDES[side].sg * (F - 0.9) : 0, z: SIDES[side].ax === 'z' ? SIDES[side].sg * (F - 0.9) : 0 } : { x: 0, z: 1.5 };
      const dx = tgt.x - b.x, dz = tgt.z - b.z, d = Math.hypot(dx, dz); b.ry = Math.atan2(dx, dz);
      if (d > 0.3) { b.x += dx / d * Math.min(d, 2.4 * dt); b.z += dz / d * Math.min(d, 2.4 * dt); b.tgt = null; }
      else if (side) { const wl = m.fort.walls[side]; wl.hp = Math.min(wl.maxHp, wl.hp + DEF_SHOP.bot.rate * dt); b.tgt = [tgt.x * 1.15, tgt.z * 1.15]; } }
  }
}
const magOf = (m, w) => Math.round(WEAPONS[w].mag * (m.fort.upg.mag ? 1.5 : 1));

// ---------- Nachrichten ----------
function corr(ps) { ps.correct = true; ps.cseq = (ps.cseq || 0) + 1; }
function reject(ps, why) { ps.rejects[why] = (ps.rejects[why] || 0) + 1; }
function shot(m, p, ps, msg) {
  if (ps.role !== 'def') return reject(ps, 'role');
  if (ps.dead && !(m.time - ps.diedAt <= 0.06)) return reject(ps, 'dead');
  const W = WEAPONS[msg.w]; if (!W || !ps.owned.has(msg.w)) return reject(ps, 'weapon');
  const t = m.time;
  if (ps.reloadUntil && t < ps.reloadUntil) return reject(ps, 'reload');
  if (ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = magOf(m, ps.reloadW); ps.reloadUntil = 0; }
  if (ps.ammo[msg.w] <= 0) return reject(ps, 'ammo');
  const cd = W.cd / (1 + 0.15 * m.fort.upg.rate); if (t - (ps.lastShot[msg.w] ?? -9) < cd * 0.7) return reject(ps, 'rate');
  const o = msg.o, d = msg.d; if (!Array.isArray(o) || !Array.isArray(d) || o.length !== 3 || d.length !== 3 || ![...o, ...d].every(Number.isFinite)) return reject(ps, 'bad');
  if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 1.8 || o[1] < 0.3 || o[1] > ps.y + 2.4) return reject(ps, 'origin');
  const dl = Math.hypot(d[0], d[1], d[2]); if (dl < 0.5) return reject(ps, 'bad'); const dn = [d[0] / dl, d[1] / dl, d[2] / dl];
  ps.ammo[msg.w]--; ps.lastShot[msg.w] = t; ps.shots++; if (ps.prot > 0) ps.prot = 0;
  const perG = new Map(), perN = new Map(), perQ = new Map(), dm = 1 + 0.2 * m.fort.upg.dmg, range = H.range[msg.w] || 60;
  for (let i = 0; i < W.pellets; i++) {
    let dd = dn; if (W.spread) { const r = m.rand; dd = [dn[0] + (r() - 0.5) * 2 * W.spread, dn[1] + (r() - 0.5) * 2 * W.spread, dn[2] + (r() - 0.5) * 2 * W.spread]; const l = Math.hypot(...dd); dd = dd.map(v => v / l); }
    const h = castDef(m, o, dd); if (!h || h.t > 90) continue;
    if (h.g) { let dmg = W.dmg * dm * (h.head ? (W.headMult || 2) : 1) * (W.kidBonus && h.g.type === 'kid' ? W.kidBonus : 1);
      if (W.far) { const f = Math.min(1, Math.max(0, (h.t - W.near) / (W.far - W.near))); dmg *= 1 - 0.75 * f; }
      const e = perG.get(h.g) || { dmg: 0, head: false }; e.dmg += dmg; e.head = e.head || h.head; perG.set(h.g, e); continue; }
    if (h.t > range) continue;
    let dmg = H.dmg[msg.w] || 10; if (W.far) { const f = Math.min(1, Math.max(0, (h.t - W.near) / (W.far - W.near))); dmg *= 1 - 0.7 * f; }
    if (h.n) perN.set(h.n, (perN.get(h.n) || 0) + dmg);
    else if (h.q) { const back = cakeBack(m, h.q, [o[0] + dd[0] * h.t, o[1] + dd[1] * h.t, o[2] + dd[2] * h.t], dd); if (back) h.q.cakeBlocks = (h.q.cakeBlocks || 0) + 1;
      perQ.set(h.q, (perQ.get(h.q) || 0) + dmg * (h.head ? H.head : 1) * (back ? H.cakeBack : 1)); }
    else if (h.decoy) { h.decoy.t = 0; }
  }
  if (perG.size || perN.size || perQ.size) ps.landed = (ps.landed || 0) + 1;
  for (const [g, e] of perG) damageGoat(m, g, e.dmg, e.head, p.id, o);
  for (const [n, dmg] of perN) if (!n.dead) hurtNpc(m, n, dmg, p.id);
  for (const [q, dmg] of perQ) { if (q.prot > 0) { m.ev.push({ k: 'shield', sid: q.sid }); continue; } hurtSheep(m, q, dmg, p.id); }
}
function melee(m, ps) { // Kopfstoß des Schafs
  const S = H.sheep; if (!ps.alive() || m.time - ps.meleeAt < S.meleeCd) return reject(ps, 'melee'); ps.meleeAt = m.time;
  const fx = -Math.sin(ps.yaw), fz = -Math.cos(ps.yaw), front = (x, z, r) => { const dx = x - ps.x, dz = z - ps.z, d = Math.hypot(dx, dz); return d <= r && (d < 0.6 || (dx * fx + dz * fz) / d > 0.45); };
  ps.revealUntil = m.time + S.revealT; ps.sus = Math.min(1, (ps.sus || 0) + H.sus.butt); m.ev.push({ k: 'butt', sid: ps.sid, x: +ps.x.toFixed(2), z: +ps.z.toFixed(2) });
  for (const q of m.players.values()) if (q.role === 'def' && !q.dead && front(q.x, q.z, S.meleeR)) { if (hurtPlayer(m, q, S.meleeDmg, ps.id, q.x - ps.x, q.z - ps.z, 1.4)) { ps.coins += S.coinPerHit; ps.hits++; } return; }
  for (const f of m.wolves) if (!f.dead && front(f.x, f.z, S.meleeR)) { hurtWolf(m, f, S.meleeWolf, ps.id); ps.coins += S.coinPerHit; return; }
  for (const b of m.fort.builds) if (b.hp != null && front(b.x, b.z, S.meleeR + 0.4)) { hurtBuild(m, b, S.meleeBuild); return; }
  const k = nearWall(m, ps.x, ps.z, 1.3); if (k) wallDamage(m, k, S.meleeWall);
}
function sheepBuy(m, ps, item) {
  const S = SHEEP_SHOP[item], fail = why => m.ev.push({ k: 'buyfail', by: ps.id, item, why, only: 1 });
  if (!S) return fail('bad'); if (ps.out) return fail('out');
  if (item === 'jump' && ps.jumpUpg) return fail('owned');
  if ((ps.inv[item] || 0) >= 3) return fail('max');
  if (ps.coins < S.price) return fail('coins');
  ps.coins -= S.price; if (item === 'jump') ps.jumpUpg = true; else ps.inv[item] = (ps.inv[item] || 0) + 1;
  m.ev.push({ k: 'sbuy', by: ps.id, item, price: S.price, only: 1 });
}
function sheepUse(m, ps, item) {
  const fail = why => { reject(ps, 'use'); m.ev.push({ k: 'usefail', by: ps.id, item, why, only: 1 }); };
  if (!ps.alive()) return fail('dead'); if (!(ps.inv[item] > 0)) return fail('none');
  const carrying = m.cake.state === 'carried' && m.cake.by === ps.id, S = SHEEP_SHOP[item];
  if (item === 'shield') { if (carrying) return fail('cake'); if (ps.shield > 0) return fail('active'); ps.shield = S.absorb; ps.shieldUntil = m.time + S.dur; }
  else if (item === 'speed') { if (carrying) return fail('cake'); if (m.time < ps.speedReadyAt) return fail('cooldown'); ps.speedUntil = m.time + S.dur; ps.speedReadyAt = m.time + S.cd; }
  else if (item === 'smoke') m.smokes.push({ x: ps.x, z: ps.z, t: S.dur, r: S.r });
  else if (item === 'decoy') m.decoys.push({ sid: newSid(m), x: ps.x, z: ps.z, ry: ps.yaw + Math.PI + (m.rand() - 0.5) * 1.4, t: S.dur });
  else if (item === 'camo') ps.camoUntil = m.time + S.dur;
  else if (item === 'heal') { if (ps.hp >= H.sheep.hp) return fail('full'); ps.hp = Math.min(H.sheep.hp, ps.hp + S.hp); }
  else return fail('bad');
  ps.inv[item]--; if (item !== 'heal' && item !== 'camo') ps.sus = Math.min(1, (ps.sus || 0) + H.sus.item); m.ev.push(item === 'smoke' ? { k: 'smoke', x: +ps.x.toFixed(2), z: +ps.z.toFixed(2) } : { k: 'use', item, by: ps.id, only: 1 });
}
function defBuy(m, p, ps, msg) {
  const it = msg.item, S = DEF_SHOP[it], fo = m.fort, fail = why => m.ev.push({ k: 'buyfail', by: p.id, item: it, why, only: 0 });
  if (!S) return fail('bad'); if (ps.dead) return fail('dead'); if (m.wave < S.wave && !(m.wave === S.wave - 1 && m.phase !== 'wave')) return fail('wave');
  const count = k => fo.builds.filter(b => b.kind === k).length; let price = S.price, apply;
  const side = msg.side && SIDES[msg.side] ? msg.side : null;
  const pickSide = pred => side && pred(side) ? side : Object.keys(SIDES).find(pred) || null;
  if (it === 'wood' || it === 'stone' || it === 'steel') { const lvl = LVL.indexOf(it), k = pickSide(s => fo.walls[s].lvl < lvl); if (!k) return fail('max');
    apply = () => { const wl = fo.walls[k], hp = WALL7[it].hp; wl.hp = wl.lvl ? Math.min(hp, wl.hp + (hp - wl.maxHp) + hp * 0.25) : hp; wl.maxHp = hp; wl.lvl = lvl; m.ev.push({ k: 'wallup', side: k, lvl }); }; }
  else if (it === 'repair') { const k = pickSide(s => fo.walls[s].lvl && fo.walls[s].hp < fo.walls[s].maxHp); if (!k) return fail('full'); if (fo.upg.fixer) price = 12;
    apply = () => { const wl = fo.walls[k]; wl.hp = Math.min(wl.maxHp, wl.hp + wl.maxHp * (fo.upg.fixer ? 1 : 0.5)); }; }
  else if (it === 'repairall') { if (!Object.values(fo.walls).some(w => w.lvl && w.hp < w.maxHp)) return fail('full'); apply = () => { for (const w of Object.values(fo.walls)) if (w.lvl) w.hp = Math.min(w.maxHp, w.hp + w.maxHp * (fo.upg.fixer ? 1 : 0.5)); }; }
  else if (it === 'gate') { const k = pickSide(s => fo.walls[s].lvl && !fo.walls[s].gate); if (!k) return fail('max'); apply = () => { fo.walls[k].gate = true; }; }
  else if (SLOTS[it]) { if (count(it) >= S.max) return fail('max');
    const used = new Set(fo.builds.filter(b => b.kind === it).map(b => b.slot)); let slot = -1;
    for (let i = 0; i < SLOTS[it].length; i++) { if (used.has(i)) continue; const s = SLOTS[it][i]; if (it === 'gun' && !fo.walls[s[2]].lvl) continue; if (side && s[2] && s[2] !== side) continue; slot = i; break; }
    if (slot < 0) return fail(it === 'gun' ? 'wall' : 'max');
    apply = () => { const s = SLOTS[it][slot]; fo.builds.push({ id: fo.bid++, kind: it, slot, x: s[0], z: s[1], side: s[2], hp: S.hp ?? null, maxHp: S.hp ?? null, dur: S.dur, cd: 0, ry: 0 }); m.ev.push({ k: 'build', kind: it, slot }); }; }
  else if (it === 'cakealarm') { if (count('cakealarm')) return fail('owned'); apply = () => { fo.builds.push({ id: fo.bid++, kind: 'cakealarm', slot: 0, x: 0, z: 0, hp: null, maxHp: null, ry: 0 }); m.ev.push({ k: 'build', kind: 'cakealarm' }); }; }
  else if (it === 'bot') { if (count('bot') >= S.max) return fail('max'); apply = () => { fo.builds.push({ id: fo.bid++, kind: 'bot', slot: 0, x: 0, z: 1.5, hp: S.hp, maxHp: S.hp, life: S.life, ry: 0 }); m.ev.push({ k: 'build', kind: 'bot' }); }; }
  else if (it === 'wolf') { const W = WOLF7; if (m.wolves.filter(f => !f.dead).length >= W.max) return fail('max'); if (m.time < fo.wolfReadyAt) return fail('cooldown'); if (fo.wolvesThisWave >= W.perWave) return fail('limit');
    apply = () => { fo.wolfReadyAt = m.time + W.cooldown; fo.wolvesThisWave++; const f = { id: -(++wolfSeq), owner: p.id, x: wolfSeq % 2 ? 1.8 : -1.8, z: 2.2, ry: 0, hp: W.hp, maxHp: W.hp, life: W.life, cd: 0.5, state: 'patrol', dead: false, idleA: m.rand() * 6.3 };
      m.wolves.push(f); m.ev.push({ k: 'wolf', f: f.id }); }; }
  else if (WEAPONS[it] && it !== 'blaster') { if (ps.owned.has(it)) return fail('owned'); apply = () => { ps.owned.add(it); ps.ammo[it] = magOf(m, it); }; }
  else if (it === 'dmg' || it === 'rate') { if (fo.upg[it] >= S.max) return fail('max'); price = Math.round(S.price * Math.pow(S.grow, fo.upg[it]) / 5) * 5; apply = () => fo.upg[it]++; }
  else if (['move', 'mag', 'reload', 'boostcd', 'fixer'].includes(it)) { if (fo.upg[it] >= S.max) return fail('max'); apply = () => { fo.upg[it]++; if (it === 'mag') for (const q of m.players.values()) if (q.role === 'def') for (const k of q.owned) q.ammo[k] = magOf(m, k); }; }
  else if (it === 'nades') { if (ps.nades >= NADE.max + 2) return fail('full'); apply = () => { ps.nades = Math.min(NADE.max + 2, ps.nades + 2); }; }
  else if (it === 'cake') { if (m.cake.hp >= H.cake.hp) return fail('full'); apply = () => { m.cake.hp = Math.min(H.cake.hp, m.cake.hp + 25); }; }
  else return fail('bad');
  if (fo.coins < price) return fail('coins');
  fo.coins -= price; apply(); m.ev.push({ k: 'buy', by: p.id, item: it, price, only: 0 });
}
function endMatch(m, winner, reason) { if (m.over) return; m.over = true; m.winner = winner; m.reason = reason; if (winner === 0) m.ev.push({ k: 'omi', q: 'lose' }); }
const SNAP_EV_PRIVATE = new Set(['shurt', 'sheepwait', 'sheepspawn', 'sbuy', 'usefail', 'helperfail', 'cmdfail']);
// Was ein Verteidiger an seiner Stelle sehen könnte: Schafe im Sichtfeld, in Sichtweite, nicht hinter Mauern.
// Gleiche Zeilen wie im Snapshot (zufällige ID, Position, Animation, Schwanz nur aus der Nähe, Kuchen/Schild sichtbar) – keine Identität.
function perceive(m, viewer, { fov = 1, sight = 30, yaw = viewer.yaw } = {}) {
  const eye = [viewer.x, viewer.y + 1.6, viewer.z], fx = -Math.sin(yaw), fz = -Math.cos(yaw), tailR = m.fort.builds.some(b => b.kind === 'watch') ? H.tail.watch : H.tail.near, out = [], t = m.time;
  const add = (sid, x, z, anim, black, carry, shield) => { const dx = x - viewer.x, dz = z - viewer.z, d = Math.hypot(dx, dz); if (d > sight) return;
    if (d > 2.5 && (dx * fx + dz * fz) / d < Math.cos(fov)) return; if (!los(m, eye, x, 1.1, z)) return;
    if (d > 2.5) for (const s of m.smokes) { const ux = s.x - viewer.x, uz = s.z - viewer.z, f = Math.max(0, Math.min(1, (ux * dx + uz * dz) / (d * d))); // Rauch verdeckt die Sicht wie im Client
      if (Math.hypot(viewer.x + dx * f - s.x, viewer.z + dz * f - s.z) < s.r * 0.75) return; }
    out.push({ sid, x, z, d, anim, tail: black && d <= tailR ? 1 : 0, carry, shield }); };
  for (const n of m.npcs) add(n.sid, n.x, n.z, SH_ANIM[n.state] ?? 0, false, false, false);
  for (const c of m.decoys) add(c.sid, c.x, c.z, 2, true, false, false);
  for (const q of m.players.values()) { if (q.role !== 'sheep' || !q.alive()) continue; const sp = q.lastMoveSpeed || 0;
    add(q.sid, q.x, q.z, t < q.emoteT ? SH_ANIM[q.emote] : sp < 0.4 ? (q.stillAt && t - q.stillAt > 2 ? 0 : 5) : sp < 3.2 ? 1 : 2, !(t < q.camoUntil), m.cake.state === 'carried' && m.cake.by === q.id, q.shield > 0); }
  return out.sort((a, b) => a.sid - b.sid);
}
function runBots(m, dt) {
  for (const ps of m.players.values()) { if (!ps.bot) continue; const t0 = Date.now();
    const api = { send: msg => heist.onMsg(m, { id: ps.id }, msg), perceive: (v, o) => perceive(m, v, o), WEAPONS };
    try { ps.bot.step(m, ps, dt, api); } catch (e) { ps.botErr = (ps.botErr || 0) + 1; if (ps.botErr < 3) console.error('bot', e && e.stack || e); }
    ps.botMs = (ps.botMs || 0) + (Date.now() - t0); }
}

export const heist = {
  perceiveForTest: (m, v, o) => perceive(m, v, o), // nur für Tests: dieselbe Wahrnehmung wie die KI
  id: 'kuchenkrieg', name: 'Kuchenkrieg', coop: false, bots: true, teamNames: ['Verteidiger', 'Schafe'],
  create(room) {
    const m = { room, seed: room.seed, rand: rng(room.seed ^ 0x5bd1e995), time: 0, tickN: 0, wave: 0, phase: 'countdown', phaseT: H.countdown + 1, fort: newFort(),
      cake: { state: 'home', x: 0, z: 0, by: 0, hp: H.cake.hp, returnAt: 0, near: false }, goats: [], gid: 1, queue: [], qt: 0, maxAlive: 18, nades: [],
      npcs: [], decoys: [], smokes: [], wolves: [], players: new Map(), ev: [], over: false, winner: null, reason: '', cleared: 0, night: false, final: false,
      herd: [], waveT: 0, helperReadyAt: 0, cmdReadyAt: 0, cmdMode: null, cmdUntil: 0, attackPt: null, route: [] };
    initHerd(m); const nSheep = room.players.filter(p => p.team === 1).length || room.perTeam; // exakt 15 Schafe: Schafspieler zählen mit
    for (let i = 0; i < H.herdTotal - nSheep; i++) { const n = newNpc(m, 0, 0, i % 3); [n.x, n.z] = herdPoint(m, n); m.npcs.push(n); }
    for (const p of room.players) { const ps = makePS(m, p, room.players.filter(x => x.team === p.team).indexOf(p)); if (p.bot) { ps.bot = makeBrain(ps.role, p.diff || 'normal', (m.seed ^ (p.id * 2654435761)) >>> 0); ps.diff = p.diff; } m.players.set(p.id, ps); }
    return m;
  },
  onRejoin(m, p) { const ps = m.players.get(p.id); if (ps) corr(ps); },
  onLeave(m, p) { const ps = m.players.get(p.id); if (ps && m.cake.state === 'carried' && m.cake.by === p.id) dropCake(m, ps.x, ps.z); m.players.delete(p.id); },
  onMsg(m, p, msg) {
    const ps = m.players.get(p.id); if (!ps) return; const t = m.time;
    if (msg.t === 'in') {
      const dt = Math.min(0.5, Math.max(0.05, t - ps.lastInT)); ps.lastInT = t;
      const fin = v => Number.isFinite(+v) ? +v : 0; ps.yaw = fin(msg.yaw); ps.pitch = Math.max(-1.6, Math.min(1.6, fin(msg.pitch))); ps.cr = !!msg.cr;
      if (ps.role === 'def' && WEAPONS[msg.w] && ps.owned.has(msg.w)) ps.w = msg.w;
      if (ps.role === 'sheep') { ps.sprint = !!msg.sp; ps.climb = !!msg.cl; if (msg.em === 'graze' || msg.em === 'warn') { ps.emote = msg.em; ps.emoteT = t + 1.6; } }
      if (ps.dead || ps.waiting || ps.out || (+msg.c || 0) < ps.cseq) return;
      const x = +msg.x, z = +msg.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const carrying = m.cake.state === 'carried' && m.cake.by === ps.id;
      let vmax; if (ps.role === 'def') vmax = 11 * (1 + 0.12 * m.fort.upg.move) * (t < ps.boostUntil + 0.4 ? 1.25 : 1);
      else { const S = H.sheep; vmax = carrying ? S.walk * S.carry : S.sprint * (t < ps.speedUntil ? SHEEP_SHOP.speed.mult : 1); }
      const maxD = vmax * 1.3 * dt + 0.5; let nx = x, nz = z; const d = Math.hypot(x - ps.x, z - ps.z);
      if (d > maxD) { nx = ps.x + (x - ps.x) / d * maxD; nz = ps.z + (z - ps.z) / d * maxD; corr(ps); ps.speedRejects++; }
      // Höhe: Verteidiger normal 1,7 m (Boost bis 5,2 m). Schaf: Sprung, Sprungfeder, Klettern an Mauern; mit Kuchen kaum
      let yMax, fast; if (ps.role === 'def') fast = yMax = t < ps.boostUntil + 1.4 ? BOOST.maxY : BOOST.jumpY;
      else { const S = H.sheep; fast = yMax = carrying ? S.carryJumpY : S.jumpY + (ps.jumpUpg ? S.jumpUpg : 0); const wk = ps.climb && nearWall(m, nx, nz, 1.05);
        if (wk) yMax = Math.max(yMax, wallH(m.fort.walls[wk].lvl) + 0.45); }
      // Springen: schnell steigend bis zur Sprunghöhe. Darüber nur Klettern: langsam (1,3 m/s, mit Kuchen halb so schnell)
      let y = Math.max(0, Math.min(yMax, +msg.y || 0)); const vdt = Math.min(dt, 0.2);
      if (y > ps.y + 14 * vdt + 0.3) { y = ps.y + 14 * vdt + 0.3; ps.yRejects++; }
      if (y > fast) { const lim = Math.max(ps.y, fast) + H.sheep.climbRate * (carrying ? H.sheep.carryClimb : 1) * vdt + 0.01; if (y > lim) { y = lim; ps.yRejects++; } }
      // Durch eine Mauer? Nur über die Oberkante (Sprung/Klettern), Tore nur für Verteidiger
      const wk = crossesWall(m, ps.x, ps.z, nx, nz, y);
      if (wk && !(ps.role === 'def' && m.fort.walls[wk].gate && Math.abs(SIDES[wk].ax === 'x' ? nz : nx) < GATE_W)) { nx = ps.x; nz = ps.z; corr(ps); ps.wallRejects++; }
      const q = { x: nx, z: nz }; if (clampArena(q)) corr(ps); ps.x = q.x; ps.z = q.z; ps.y = y;
      ps.vis = { boost: t < ps.boostUntil }; ps.mv = Math.min(1, d / dt / 8); ps.lastMoveSpeed = d / dt; if (d / dt < 0.4) { if (!ps.stillAt) ps.stillAt = t; } else ps.stillAt = 0;
    }
    else if (msg.t === 'boost') { if (ps.role !== 'def' || ps.dead || t < ps.boostReadyAt) return reject(ps, 'boost');
      ps.boostUntil = t + BOOST.dur + 0.2; ps.boostReadyAt = t + H.boostCd[m.fort.upg.boostcd ? 1 : 0]; ps.boosts++; m.ev.push({ k: 'boost', id: ps.id, only: 0 }); }
    else if (msg.t === 'shot') shot(m, p, ps, msg);
    else if (msg.t === 'reload') { const W = WEAPONS[msg.w]; if (ps.role === 'def' && W && ps.owned.has(msg.w) && !ps.reloadUntil && ps.ammo[msg.w] < magOf(m, msg.w)) { ps.reloadUntil = t + W.reload * 0.9 * (m.fort.upg.reload ? 0.65 : 1); ps.reloadW = msg.w; } }
    else if (msg.t === 'nade') {
      if (ps.role !== 'def' || ps.dead || ps.nades <= 0 || m.phase === 'shop') return reject(ps, 'nade');
      const o = msg.o, v = msg.v; if (!Array.isArray(o) || !Array.isArray(v) || ![...o, ...v].every(Number.isFinite)) return;
      if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 1.8 || Math.hypot(...v) > NADE.maxSpeed) return reject(ps, 'nade');
      ps.nades--; m.nades.push({ x: o[0], y: o[1], z: o[2], vx: v[0], vy: v[1], vz: v[2], fuse: NADE.fuse, by: p.id });
    }
    else if (msg.t === 'buy') { if (ps.role === 'def') defBuy(m, p, ps, msg); else sheepBuy(m, ps, msg.item); }
    else if (msg.t === 'use') { if (ps.role === 'sheep') sheepUse(m, ps, msg.item); }
    else if (msg.t === 'melee') { if (ps.role === 'sheep') melee(m, ps); }
    else if (msg.t === 'grab') { if (ps.role === 'sheep') { ps.grabbing = !!msg.v; if (!ps.grabbing) ps.grabT = 0; } }
    else if (msg.t === 'dropcake') { if (ps.role === 'sheep' && m.cake.state === 'carried' && m.cake.by === ps.id) dropCake(m, ps.x, ps.z); }
    else if (msg.t === 'shopready') { if (m.phase === 'shop') ps.shopReady = !!msg.v; }
    else if (msg.t === 'helper') setHelper(m, ps, msg);
    else if (msg.t === 'cmd') helperCmd(m, ps, msg);
    else if (msg.t === 'mark') { if (ps.role !== 'sheep') return reject(ps, 'mark'); const x = +msg.x, z = +msg.z; if (msg.clear) { m.attackPt = null; return; } if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) > H.arenaR) return reject(ps, 'mark'); m.attackPt = [+x.toFixed(1), +z.toFixed(1)]; }
    else if (msg.t === 'route') { if (ps.role !== 'sheep') return reject(ps, 'route'); const pts = Array.isArray(msg.pts) ? msg.pts.slice(0, 6) : [];
      if (!pts.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite) && Math.hypot(q[0], q[1]) <= H.arenaR + 1)) return reject(ps, 'route'); m.route = pts.map(q => [+q[0].toFixed(1), +q[1].toFixed(1)]); }
  },
  tick(m, dt) {
    if (m.over) return;
    m.time += dt; m.tickN++;
    runBots(m, dt); // KI-Teilnehmer handeln über dieselben Nachrichten wie Menschen
    for (const ps of m.players.values()) { if (ps.prot > 0) ps.prot = Math.max(0, ps.prot - dt);
      if (ps.shield > 0 && m.time > ps.shieldUntil) { ps.shield = 0; m.ev.push({ k: 'shieldoff', sid: ps.sid, why: 'time' }); }
      if (ps.role === 'def' && ps.dead && m.time >= ps.respawnAt) { const [x, z] = defSpawnPoint(m, ps); Object.assign(ps, { dead: false, hp: H.def.hp, x, z, y: 0, prot: H.def.protect }); corr(ps); m.ev.push({ k: 'respawn', id: ps.id }); }
      if (ps.role === 'sheep' && ps.dead && !ps.waiting && !ps.out && m.time >= ps.respawnAt) respawnSheep(m, ps);
      if (ps.role === 'sheep' && ps.alive() && m.phase === 'wave') { ps.aliveT += dt; if (ps.aliveT >= H.aliveCoinEvery) { ps.aliveT = 0; ps.coins++; } }
      if (ps.role === 'sheep' && ps.alive()) stepSus(m, ps, dt); }
    if (m.phase === 'wave') m.waveT = (m.waveT || 0) + dt;
    if (![...m.players.values()].some(q => q.role === 'sheep')) return endMatch(m, 0, 'forfeit');
    if (![...m.players.values()].some(q => q.role === 'def')) return endMatch(m, 1, 'forfeit');
    stepNpcs(m, dt); stepDecoys(m, dt); stepWolves(m, dt); stepAlarms(m); stepCake(m, dt); if (m.over) return;
    if (m.phase === 'overtime') { m.phaseT -= dt; stepGoats(m, dt); stepBuilds(m, dt); stepNades(m, dt);
      if (m.cake.state !== 'carried') return endMatch(m, 0, 'overtime'); if (m.phaseT <= 0) return endMatch(m, 0, 'overtime'); return; }
    if (m.phase === 'countdown') { m.phaseT -= dt; if (m.phaseT <= 0) { m.wave++; const wv = makeWave8(m.wave, m.seed, m.room.perTeam);
      m.queue = wv.list.map(e => ({ ...e })); m.qt = 0; m.waveT = 0; m.maxAlive = wv.maxAlive; m.fort.lostThisWave = 0; m.fort.wolvesThisWave = 0; m.night = wv.night || m.wave > 5; m.final = wv.final;
      for (const ps of m.players.values()) if (ps.role === 'sheep' && !ps.out) { ps.lives = sheepLives(m.wave); ps.coins += m.wave > 1 ? H.sheepWaveCoins : 0; if (ps.dead || ps.waiting) respawnSheep(m, ps); }
      m.ev.push({ k: 'wave', wave: m.wave, name: wv.name, king: wv.king, final: wv.final, night: wv.night, count: wv.list.length });
      if (wv.final) m.ev.push({ k: 'omi', q: 'final' });
      m.phase = 'wave'; } return; }
    if (m.phase === 'wave') {
      stepGoats(m, dt); if (m.over) return; stepBuilds(m, dt); stepNades(m, dt);
      if (!m.queue.length && !m.goats.length) { m.cleared = m.wave; m.fort.coins += H.waveCoins; m.fort.points += 25 * m.wave;
        m.ev.push({ k: 'cleared', wave: m.wave, held: !m.fort.lostThisWave });
        if (m.wave >= MAX_WAVES) { if (m.cake.state === 'carried') { m.phase = 'overtime'; m.phaseT = H.cake.overtime; m.ev.push({ k: 'overtime', t: H.cake.overtime }); return; } return endMatch(m, 0, 'survived'); }
        m.phase = 'shop'; m.phaseT = H.shopTime; for (const ps of m.players.values()) ps.shopReady = false; }
      return; }
    if (m.phase === 'shop') { m.phaseT -= dt; stepNades(m, dt); const pl = m.room.players.filter(p => p.connected).map(p => m.players.get(p.id)).filter(Boolean);
      if (m.phaseT <= 0 || (pl.length && pl.every(ps => ps.shopReady))) { m.phase = 'countdown'; m.phaseT = H.countdown; } }
  },
  snapshot(m, p) {
    const ps = m.players.get(p.id), team = ps ? ps.team : p.team, isDef = team === 0, t = m.time;
    if (ps && ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = magOf(m, ps.reloadW); ps.reloadUntil = 0; }
    const r1 = v => Math.round(v * 10), viewer = ps && !ps.dead ? ps : null;
    const watch = m.fort.builds.some(b => b.kind === 'watch'), tailR = watch ? H.tail.watch : H.tail.near;
    // Schafe: Herde, Lockvögel und Schafspieler in EINER Liste, gleich aufgebaut, zufällige IDs.
    // Den schwarzen Schwanz bekommt der Verteidiger nur aus der Nähe (und nicht bei Tarnpuder) – sonst steht hier "hell".
    const tailFor = (x, z) => isDef ? (viewer && Math.hypot(viewer.x - x, viewer.z - z) <= tailR ? 1 : 0) : 1;
    const sh = [];
    for (const n of m.npcs) sh.push([n.sid, r1(n.x), r1(n.z), Math.round(n.ry * 100), SH_ANIM[n.state] ?? 0, 0, isDef ? 0 : (n.helper ? 32 : 0) | (n.cmd ? 64 : 0), r1(n.y)]); // Helfer-Markierung nur fürs Schaf-Team
    for (const c of m.decoys) sh.push([c.sid, r1(c.x), r1(c.z), Math.round(c.ry * 100), 2, tailFor(c.x, c.z), 0, 0]);
    for (const q of m.players.values()) { if (q.role !== 'sheep' || !q.alive()) continue;
      const carrying = m.cake.state === 'carried' && m.cake.by === q.id, sp = q.lastMoveSpeed || 0;
      const anim = t < q.emoteT ? SH_ANIM[q.emote] : sp < 0.4 ? (q.stillAt && t - q.stillAt > 2 ? 0 : 5) : sp < 3.2 ? 1 : 2, camo = t < q.camoUntil && isDef; // stillstehen = nach 2 s grasen wie die Herde
      let fl = (carrying ? 1 : 0) | (q.shield > 0 ? 2 : 0) | (q.prot > 0 ? 4 : 0);
      if (!isDef) fl |= q === ps ? 16 : 8;
      sh.push([q.sid, r1(q.x), r1(q.z), Math.round((q.yaw + Math.PI) * 100), anim, camo ? 0 : tailFor(q.x, q.z), fl, r1(q.y)]); }
    sh.sort((a, b) => a[0] - b[0]); // Reihenfolge verrät nichts
    const sendGoats = m.goats.length <= 40 || m.tickN % 2 === 0;
    const players = []; const sheepTeam = [];
    for (const o of m.players.values()) {
      if (o.role === 'def' && !isDef && viewer) { const seen = viewer.seenDef || (viewer.seenDef = new Map()); if (defVisible(m, viewer, o)) seen.set(o.id, t); if (t - (seen.get(o.id) ?? -9) > 0.6) continue; } // keine Verteidiger durch Mauern
      if (o.role === 'def') players.push({ id: o.id, team: 0, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), yaw: +o.yaw.toFixed(3), pitch: +o.pitch.toFixed(3), w: o.w, cr: o.cr, hp: Math.round(o.hp), dead: o.dead ? 1 : 0, prot: o.prot > 0 ? 1 : 0, boost: o.vis && o.vis.boost ? 1 : 0 });
      else sheepTeam.push(isDef ? { id: o.id, lives: o.lives, waiting: o.waiting ? 1 : 0, out: o.out ? 1 : 0 } : { id: o.id, sid: o.alive() ? o.sid : 0, lives: o.lives, waiting: o.waiting ? 1 : 0, out: o.out ? 1 : 0, hp: Math.round(o.hp) }); }
    const ev = m.ev.filter(e => (e.only == null || e.only === team) && (!SNAP_EV_PRIVATE.has(e.k) || (e.id ?? e.by) === p.id));
    const fo = m.fort, c = m.cake;
    const snap = { t: 'snap', mode: 'heist', time: +t.toFixed(2), phase: m.phase, phaseT: +m.phaseT.toFixed(2), wave: m.wave, maxWaves: MAX_WAVES, waveName: WAVE_NAMES8[m.wave - 1] || '', team, role: isDef ? 'def' : 'sheep', night: m.night, final: m.final,
      left: m.queue.length + m.goats.length,
      wrong: fo.wrong, wrongMax: H.wrongMax,
      thief: isDef && c.state === 'carried' && fo.builds.some(b => b.kind === 'cakealarm') ? [+c.x.toFixed(1), +c.z.toFixed(1)] : undefined,
      tac: isDef ? undefined : { helpers: m.npcs.filter(n => n.helper).map(n => n.sid), hIn: +Math.max(0, (m.helperReadyAt || 0) - t).toFixed(1), cIn: +Math.max(0, (m.cmdReadyAt || 0) - t).toFixed(1),
        mode: t < m.cmdUntil ? m.cmdMode : null, mLeft: +Math.max(0, m.cmdUntil - t).toFixed(1), atk: m.attackPt, route: m.route, max: H.helper.max, pickR: H.helper.pickR },
      fort: { coins: isDef ? fo.coins : undefined, upg: isDef ? fo.upg : undefined, kills: fo.kills, points: fo.points, wolfIn: isDef ? Math.max(0, +(fo.wolfReadyAt - t).toFixed(1)) : undefined,
        walls: Object.fromEntries(Object.entries(fo.walls).map(([k, v]) => [k, [v.lvl, Math.round(v.hp), v.maxHp, v.gate ? 1 : 0]])),
        builds: fo.builds.map(b => [b.id, b.kind, +b.x.toFixed(2), +b.z.toFixed(2), b.maxHp ? Math.round(100 * b.hp / b.maxHp) : 100, b.tgt ? +b.tgt[0].toFixed(1) : null, b.tgt ? +b.tgt[1].toFixed(1) : null, +(b.ry || 0).toFixed(2)]) },
      cake: { s: c.state === 'home' ? 0 : c.state === 'carried' ? 1 : 2, x: +c.x.toFixed(2), z: +c.z.toFixed(2), hp: +c.hp.toFixed(1), back: c.state === 'dropped' ? +Math.max(0, c.returnAt - t).toFixed(1) : 0, mine: !isDef && c.by === p.id ? 1 : 0 },
      g: sendGoats ? m.goats.map(g => [g.id, TYPE_IDX[g.type], r1(g.x), r1(g.z), Math.max(1, Math.round(100 * g.hp / g.maxHp)), STATE_IDX[g.state] ?? 0, Math.round(g.ry * 100)]) : undefined,
      sh, pl: players, sheepTeam, sheepLives: sheepTeam.reduce((a, s) => a + (s.out ? 0 : s.lives), 0),
      wolves: m.wolves.map(f => [f.id, +f.x.toFixed(2), +f.z.toFixed(2), +f.ry.toFixed(2), Math.max(0, Math.round(f.hp)), f.maxHp, f.dead ? 2 : f.state === 'bite' ? 1 : 0, +f.life.toFixed(1)]),
      smokes: m.smokes.map(s => [+s.x.toFixed(1), +s.z.toFixed(1), +s.t.toFixed(1), s.r]),
      ev };
    if (ps) snap.you = ps.role === 'def' ? { role: 'def', owned: [...ps.owned], ammo: ps.ammo, nades: ps.nades, reloading: !!ps.reloadUntil, shopReady: ps.shopReady, kills: ps.kills, points: ps.points, pkills: ps.pkills,
        hp: Math.round(ps.hp), dead: ps.dead, respawnIn: ps.dead ? +Math.max(0, ps.respawnAt - t).toFixed(1) : 0, prot: ps.prot > 0, boostIn: +Math.max(0, ps.boostReadyAt - t).toFixed(2), boostCd: H.boostCd[fo.upg.boostcd ? 1 : 0] }
      : { role: 'sheep', sid: ps.alive() ? ps.sid : 0, hp: Math.round(ps.hp), maxHp: H.sheep.hp, lives: ps.lives, waiting: ps.waiting, out: ps.out, dead: ps.dead, respawnIn: ps.dead && Number.isFinite(ps.respawnAt) ? +Math.max(0, ps.respawnAt - t).toFixed(1) : 0,
        coins: ps.coins, inv: ps.inv, jumpUpg: ps.jumpUpg, shield: Math.round(ps.shield), shieldIn: ps.shield > 0 ? +Math.max(0, ps.shieldUntil - t).toFixed(1) : 0, speedIn: +Math.max(0, ps.speedReadyAt - t).toFixed(1), speedOn: t < ps.speedUntil,
        tarn: ps.tarn || 0, camoIn: +Math.max(0, ps.camoUntil - t).toFixed(1), carrying: c.state === 'carried' && c.by === ps.id, grab: +(ps.grabT / H.cake.grabT).toFixed(2), revealed: ps.revealUntil > t && !(c.state === 'carried' && c.by === ps.id) ? 1 : 0, prot: ps.prot > 0, kills: ps.pkills, hits: ps.hits };
    if (ps && ps.correct) { snap.correct = { x: +ps.x.toFixed(2), z: +ps.z.toFixed(2), y: +ps.y.toFixed(2), c: ps.cseq }; ps.correct = false; }
    return snap;
  },
  flush(m) { m.ev = []; },
  over(m) { return m.over; },
  results(m, room) {
    const players = room.players.map(p => { const ps = m.players.get(p.id); return { id: p.id, name: p.name, team: p.team, role: p.team === 0 ? 'def' : 'sheep', kills: ps?.kills ?? 0, points: ps?.points ?? 0, pkills: ps?.pkills ?? 0, deaths: ps?.deaths ?? 0, hits: ps?.hits ?? 0 }; });
    return { winner: m.winner, reason: m.reason, waves: m.wave, maxWaves: MAX_WAVES, heist: true, cake: +m.cake.hp.toFixed(1), kills: m.fort.kills, king: m.fort.kingDown,
      teams: [{ team: 0, points: m.fort.points, kills: m.fort.kills, survived: m.winner === 0 }, { team: 1, survived: m.winner === 1 }], players };
  },
};
function makePS(m, p, idx) {
  const ammo = {}; for (const k in WEAPONS) ammo[k] = WEAPONS[k].mag;
  const base = { id: p.id, team: p.team, idx, role: p.team === 0 ? 'def' : 'sheep', y: 0, yaw: 0, pitch: 0, cr: false, lastInT: 0, shopReady: false, correct: true, cseq: 1, kills: 0, points: 0, pkills: 0, deaths: 0, shots: 0, hits: 0,
    rejects: {}, speedRejects: 0, yRejects: 0, wallRejects: 0, dead: false, prot: 0, respawnAt: 0, alive() { return !this.dead && !this.waiting && !this.out; } };
  if (base.role === 'def') { const [x, z] = defSpawnPoint(m, base);
    return Object.assign(base, { x, z, w: 'blaster', owned: new Set(['blaster']), ammo, reloadUntil: 0, reloadW: 'blaster', lastShot: {}, nades: NADE.start, hp: H.def.hp, diedAt: -9, boostUntil: -9, boostReadyAt: 0, boosts: 0, vis: null, ammoAt: -9 }); }
  const [x, z] = sheepSpawnPoint(m);
  return Object.assign(base, { x, z, hp: H.sheep.hp, sid: newSid(m), lives: sheepLives(1), waiting: false, out: false, coins: H.sheepStartCoins, inv: {}, jumpUpg: false, shield: 0, shieldUntil: 0,
    speedUntil: 0, speedReadyAt: 0, camoUntil: 0, revealUntil: 0, grabbing: false, grabT: 0, meleeAt: -9, sprint: false, climb: false, emote: '', emoteT: 0, aliveT: 0, lastMoveSpeed: 0 });
}
export const MODES = { kuchenkrieg: heist };
