// Modus "Kuchenkrieg" (V6.1): gemeinsame Arena mit zwei Kuchenfestungen. Beide Teams werden gleichzeitig von
// gespiegelten, identischen Wellen angegriffen, sehen und bekämpfen sich (PvP), kaufen Werwölfe, boosten und
// treffen in Welle 5 auf den Ziegenkönig. Der Server ist für alles Spielentscheidende allein zuständig.
// Koordinaten: Spieler, Werwölfe, Deckungen global; jede Teamwelt (Ziegen, Mauern, Kuchen) lokal um ihren Kuchen.
import { WEAPONS, TYPES, UPG, NADE, WALL, upgPrice, rng, ARENA2, toGlobal, toLocal, COVERS, PVP, WOLF, BOOST, KING, WAVE_NAMES, makeWave5 } from '../rules.js';

const MAX_WAVES = 5, SHOP_TIME = 8, COUNTDOWN = 2;
const SIDES = { N: { ax: 'z', sg: -1 }, E: { ax: 'x', sg: 1 }, S: { ax: 'z', sg: 1 }, W: { ax: 'x', sg: -1 } };
const TYPE_IDX = { normal: 0, kid: 1, bock: 2, king: 3 }, STATE_IDX = { walk: 0, eat: 1, wall: 2, wind: 3, charge: 4, tired: 5, stomp: 6 };
const { F, HALF, TH, H: WH } = WALL;
const GID = 100000; // Ziegen-IDs global eindeutig: team * GID + id

function newWorld(team, active = true) {
  const walls = {}; for (const k in SIDES) walls[k] = { built: false, hp: 0, maxHp: 0, lvl: 0 };
  return { team, active, goats: [], gid: 1, cake: 100, walls, coins: 0, upg: { dmg: 0, rate: 0, speed: 0, repair: 0 }, kills: 0, points: 0, pvpKills: 0,
    deadAt: null, queue: [], qt: 0, cleared: 0, nades: [], lostThisWave: 0, wave: 0, wolfReadyAt: 0, kingDown: false };
}
// ---------- Navigation um die eigene Festung (lokal) ----------
const sideOf = (x, z) => Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'E' : 'W') : (z > 0 ? 'S' : 'N');
const ADJ = { N: ['E', 'W'], S: ['E', 'W'], E: ['N', 'S'], W: ['N', 'S'] }, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
function cornerOf(a, b) { const C = F + 2.4, has = k => a === k || b === k; return { x: has('E') ? C : has('W') ? -C : 0, z: has('S') ? C : has('N') ? -C : 0 }; }
function outOf(a) { const C = F + 2.4; return { x: a === 'E' ? C : a === 'W' ? -C : 0, z: a === 'S' ? C : a === 'N' ? -C : 0 }; }
function planAround(w, side, g) {
  const byDist = (a, b) => { const ca = cornerOf(side, a), cb = cornerOf(side, b); return Math.hypot(ca.x - g.x, ca.z - g.z) - Math.hypot(cb.x - g.x, cb.z - g.z); };
  const open = ADJ[side].filter(a => !w.walls[a].built);
  if (open.length) { open.sort(byDist); return [cornerOf(side, open[0]), outOf(open[0])]; }
  const o = OPP[side]; if (!w.walls[o].built) { const a = ADJ[side].slice().sort(byDist)[0]; return [cornerOf(side, a), cornerOf(a, o), outOf(o)]; }
  return null;
}
function navTarget(w, g) {
  if (g.wp && g.wp.length) { if (Math.hypot(g.wp[0].x - g.x, g.wp[0].z - g.z) < 0.9) g.wp.shift(); if (g.wp.length) return { x: g.wp[0].x, z: g.wp[0].z, wall: null }; }
  if (Math.max(Math.abs(g.x), Math.abs(g.z)) <= F + 0.05) return { x: 0, z: 0, wall: null };
  const side = sideOf(g.x, g.z), wall = w.walls[side];
  if (!wall.built) return { x: 0, z: 0, wall: null };
  if (g.type === 'kid' && !g.wpTried) { g.wpTried = true; const r = planAround(w, side, g); if (r) { g.wp = r; return { x: r[0].x, z: r[0].z, wall: null }; } }
  const off = F + TH / 2 + g.r + 0.05, lim = HALF - 0.5, s = SIDES[side];
  if (s.ax === 'x') return { x: s.sg * off, z: Math.max(-lim, Math.min(lim, g.z)), wall: side };
  return { x: Math.max(-lim, Math.min(lim, g.x)), z: s.sg * off, wall: side };
}
function pushOut(w, p, r) {
  for (const k in SIDES) { if (!w.walls[k].built) continue; const s = SIDES[k];
    const a = s.ax === 'x' ? p.x : p.z, b = s.ax === 'x' ? p.z : p.x;
    if (Math.abs(b) <= HALF + r * 0.5 && Math.abs(a - s.sg * F) < TH / 2 + r) { const out = a * s.sg > F; const t = out ? s.sg * (F + TH / 2 + r) : s.sg * (F - TH / 2 - r); if (s.ax === 'x') p.x = t; else p.z = t; } }
}
function wallDamage(m, w, side, n) { const wl = w.walls[side]; if (!wl.built || n <= 0) return; wl.hp -= n;
  if (wl.hp <= 0) { wl.built = false; wl.hp = 0; w.lostThisWave++; m.ev.push({ k: 'wall', team: w.team, side, destroyed: true }); } }
// Globale Hindernisse (Deckungen, Mauern beider Festungen) für Werwölfe und Spieler-Prüfung
function pushOutGlobal(m, p, r) {
  for (const c of COVERS) { const hx = c.w / 2 + r, hz = c.d / 2 + r, dx = p.x - c.x, dz = p.z - c.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) { if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = c.x + Math.sign(dx || 1) * hx; else p.z = c.z + Math.sign(dz || 1) * hz; } }
  for (const w of m.worlds) { const [lx, lz] = toLocal(w.team, p.x, p.z); const q = { x: lx, z: lz }; pushOut(w, q, r); if (q.x !== lx || q.z !== lz) { const [gx, gz] = toGlobal(w.team, q.x, q.z); p.x = gx; p.z = gz; } }
}
const inArena = (x, z, pad = 0) => (x * x) / ((ARENA2.rx - pad) ** 2) + (z * z) / ((ARENA2.rz - pad) ** 2) <= 1;
function clampArena(p, pad = 0.4) { if (inArena(p.x, p.z, pad)) return false; const a = Math.atan2(p.z / (ARENA2.rz - pad), p.x / (ARENA2.rx - pad));
  p.x = Math.cos(a) * (ARENA2.rx - pad) * 0.999; p.z = Math.sin(a) * (ARENA2.rz - pad) * 0.999; return true; }

// ---------- Raycast ----------
function raySphere(o, d, c, r) { const ox = c[0] - o[0], oy = c[1] - o[1], oz = c[2] - o[2]; const t = ox * d[0] + oy * d[1] + oz * d[2]; if (t < 0) return -1;
  const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) return -1; return t - Math.sqrt(r * r - d2); }
function rayCyl(o, d, cx, cz, r, y0, y1) { const fx = o[0] - cx, fz = o[2] - cz; const a = d[0] * d[0] + d[2] * d[2]; if (a < 1e-9) return -1;
  const b = 2 * (fx * d[0] + fz * d[2]), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); if (t < 0) return -1; const y = o[1] + d[1] * t; return y >= y0 && y <= y1 ? t : -1; }
function rayBox(o, d, A) { let t0 = 0, t1 = 1e9; for (const [i, mn, mx] of [[0, A[0], A[1]], [1, A[2], A[3]], [2, A[4], A[5]]]) {
  if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn || o[i] > mx) return -1; continue; } let a = (mn - o[i]) / d[i], b = (mx - o[i]) / d[i]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1; } return t0; }
function wallBox(side) { const s = SIDES[side]; return s.ax === 'x' ? [s.sg * F - TH / 2, s.sg * F + TH / 2, 0, WH, -HALF, HALF] : [-HALF, HALF, 0, WH, s.sg * F - TH / 2, s.sg * F + TH / 2]; }
const goatHead = g => g.type === 'king' ? 2.05 * g.s : 1.95 * g.s;
// Ein Strahl gegen alles: Ziegen und Mauern beider Welten, Deckungen, gegnerische Spieler und Werwölfe
export function castAll(m, ps, o, d) {
  let best = null; const take = (t, hit) => { if (t >= 0 && (!best || t < best.t)) best = { t, ...hit }; };
  for (const w of m.worlds) { if (!w.active) continue;
    const [lx, lz] = toLocal(w.team, o[0], o[2]), lo = [lx, o[1], lz], ld = w.team ? [-d[0], d[1], -d[2]] : d;
    for (const g of w.goats) { if (g.dead) continue; const s = g.s;
      take(raySphere(lo, ld, [g.x, goatHead(g), g.z], (g.type === 'king' ? 0.45 : 0.34) * s), { g, w, head: true });
      take(rayCyl(lo, ld, g.x, g.z, 0.45 * s, 0.1 * s, 1.75 * s), { g, w, head: false }); }
    for (const k in w.walls) if (w.walls[k].built) take(rayBox(lo, ld, wallBox(k)), { wall: k, w }); }
  for (const c of COVERS) take(rayBox(o, d, [c.x - c.w / 2, c.x + c.w / 2, 0, c.h, c.z - c.d / 2, c.z + c.d / 2]), { cover: c });
  for (const q of m.players.values()) { if (q === ps || q.team === ps.team || q.dead) continue;
    take(raySphere(o, d, [q.x, q.y + (q.cr ? 1.25 : 1.62), q.z], 0.3), { q, head: true });
    take(rayCyl(o, d, q.x, q.z, 0.42, q.y, q.y + (q.cr ? 1.2 : 1.5)), { q, head: false }); }
  for (const f of m.wolves) { if (f.team === ps.team || f.dead) continue; take(rayCyl(o, d, f.x, f.z, 0.55, 0, 1.9), { f }); }
  return best;
}

// ---------- Ziegen & Ziegenkönig ----------
function spawn(m, w, e) {
  const T = e.type === 'king' ? { s: KING.s, hp: KING.hp * (1 + 0.5 * (m.room.perTeam - 1)), speed: KING.speed, eat: KING.eat } : TYPES[e.type];
  const hp = T.hp * (e.hpM || 1), R = ARENA2.spawnR;
  const g = { id: w.gid++, type: e.type, s: T.s, r: 0.45 * T.s, x: Math.cos(e.a) * R, z: Math.sin(e.a) * R, hp, maxHp: hp,
    speed: T.speed * e.sp * (e.type === 'king' ? 1 : 0.78), eat: T.eat, state: 'walk', stagger: 0, wp: null, wpTried: false, ry: 0, dead: false };
  if (e.type === 'king') { Object.assign(g, { chargeCd: 4, stompCd: 3, act: 0, actT: 0, tx: 0, tz: 0, summoned: false }); m.ev.push({ k: 'king', team: w.team, g: w.team * GID + g.id }); }
  w.goats.push(g);
}
function teamPlayersNear(m, team, gx, gz, r) { return [...m.players.values()].filter(q => q.team === team && !q.dead && Math.hypot(q.x - gx, q.z - gz) <= r); }
function hurtPlayer(m, q, dmg, byId, kx, kz, kb) {
  if (q.dead || q.prot > 0 || dmg <= 0) return false;
  q.hp -= dmg; q.lastHitBy = byId; m.ev.push({ k: 'phit', id: q.id, by: byId, d: Math.round(dmg), hp: Math.max(0, Math.round(q.hp)) });
  if (kb) { const l = Math.hypot(kx, kz) || 1; q.x += kx / l * kb; q.z += kz / l * kb; clampArena(q); pushOutGlobal(m, q, 0.4); corr(q); }
  if (q.hp <= 0) killPlayer(m, q, byId); return true;
}
function killPlayer(m, q, byId) {
  q.dead = true; q.hp = 0; q.diedAt = m.time; q.respawnAt = m.time + PVP.respawn; q.deaths++; const killer = m.players.get(byId);
  if (killer && killer.team !== q.team) { killer.pkills++; killer.points += PVP.killPts; const kw = m.worlds[killer.team]; kw.coins += PVP.killCoins; kw.points += PVP.killPts; kw.pvpKills++; }
  m.ev.push({ k: 'pkill', id: q.id, by: killer ? killer.id : 0 });
}
function stepKing(m, w, g, dt) {
  const [gx, gz] = toGlobal(w.team, g.x, g.z);
  g.chargeCd -= dt; g.stompCd -= dt;
  if (!g.summoned && g.hp < g.maxHp * 0.5) { g.summoned = true; for (let i = 0; i < 4; i++) spawn(m, w, { type: 'kid', a: Math.atan2(g.z, g.x) + (i - 1.5) * 0.4, sp: 1.1, hpM: 1 });
    const kids = w.goats.slice(-4); kids.forEach((k, i) => { k.x = g.x + Math.cos(i * 1.6) * 1.6; k.z = g.z + Math.sin(i * 1.6) * 1.6; }); m.ev.push({ k: 'kingsummon', team: w.team, g: w.team * GID + g.id }); }
  if (g.state === 'wind' || g.state === 'stomp') { g.actT -= dt; if (g.actT > 0) return true;
    if (g.state === 'stomp') { // Stampfer: Schaden und Rückstoß im Umkreis, auch für eigene Werwölfe des Teams
      for (const q of teamPlayersNear(m, w.team, gx, gz, KING.stompR)) hurtPlayer(m, q, KING.stompDmg, 0, q.x - gx, q.z - gz, 2.2);
      for (const f of m.wolves) if (f.team === w.team && !f.dead && Math.hypot(f.x - gx, f.z - gz) <= KING.stompR) hurtWolf(m, f, 15, 0);
      m.ev.push({ k: 'kingstomp', team: w.team, g: w.team * GID + g.id }); g.state = 'walk'; g.stompCd = KING.stompCd; return true; }
    g.state = 'charge'; g.actT = KING.chargeDur; g.hitIds = new Set(); m.ev.push({ k: 'kingcharge', team: w.team, g: w.team * GID + g.id }); return true; }
  if (g.state === 'charge') { g.actT -= dt; const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz) || 1;
    g.x += dx / d * KING.chargeSpeed * dt; g.z += dz / d * KING.chargeSpeed * dt; g.ry = Math.atan2(dx, dz);
    const [cx, cz] = toGlobal(w.team, g.x, g.z);
    for (const q of teamPlayersNear(m, w.team, cx, cz, 1.8)) if (!g.hitIds.has(q.id)) { g.hitIds.add(q.id); hurtPlayer(m, q, KING.chargeDmg, 0, q.x - cx, q.z - cz, 3); }
    for (const k in w.walls) if (w.walls[k].built) { const s = SIDES[k], a = s.ax === 'x' ? g.x : g.z, b = s.ax === 'x' ? g.z : g.x; if (Math.abs(b) <= HALF + 1 && Math.abs(a - s.sg * F) < 1.6) { wallDamage(m, w, k, 25); g.actT = 0; } }
    if (g.actT <= 0 || d < 0.6) { g.state = 'tired'; g.actT = KING.tired; g.chargeCd = KING.chargeCd; m.ev.push({ k: 'kingtired', team: w.team, g: w.team * GID + g.id }); }
    return true; }
  if (g.state === 'tired') { g.actT -= dt; if (g.actT <= 0) g.state = 'walk'; return true; }
  // Angriffe auswählen: Stampfer bei nahen Spielern, sonst Sturmangriff auf einen Spieler in 4–16 m
  const near = teamPlayersNear(m, w.team, gx, gz, KING.stompR - 0.5);
  if (near.length && g.stompCd <= 0) { g.state = 'stomp'; g.actT = KING.stompWind; m.ev.push({ k: 'kingwind', team: w.team, g: w.team * GID + g.id, kind: 'stomp', t: KING.stompWind }); return true; }
  if (g.chargeCd <= 0) { const cand = teamPlayersNear(m, w.team, gx, gz, 16).filter(q => Math.hypot(q.x - gx, q.z - gz) >= 4);
    if (cand.length) { const q = cand[0]; const [tx, tz] = toLocal(w.team, q.x, q.z); const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz) || 1;
      g.tx = g.x + dx / d * Math.min(14, d + 3); g.tz = g.z + dz / d * Math.min(14, d + 3); g.state = 'wind'; g.actT = KING.chargeWind; g.ry = Math.atan2(dx, dz);
      const [ex, ez] = toGlobal(w.team, g.tx, g.tz); m.ev.push({ k: 'kingwind', team: w.team, g: w.team * GID + g.id, kind: 'charge', t: KING.chargeWind, x: +ex.toFixed(2), z: +ez.toFixed(2) }); return true; } }
  return false;
}
function stepWorld(m, w, dt) {
  if (w.deadAt || !w.active) return;
  w.qt += dt;
  let alive = w.goats.length;
  while (w.queue.length && w.queue[0].t <= w.qt && alive < ARENA2.maxAlive) { spawn(m, w, w.queue.shift()); alive++; }
  for (const g of w.goats) {
    if (g.stagger > 0) { g.stagger -= dt; continue; }
    if (g.type === 'king' && stepKing(m, w, g, dt)) continue;
    const nav = navTarget(w, g), dx = nav.x - g.x, dz = nav.z - g.z, d = Math.hypot(dx, dz) || 0.001, dc = Math.hypot(g.x, g.z);
    if (nav.wall && d < 0.35 + (g.type === 'king' ? 0.4 : 0)) { g.state = 'wall'; wallDamage(m, w, nav.wall, g.eat * (g.type === 'king' ? 5 : 2) * dt); }
    else if (nav.wall || (g.wp && g.wp.length) || dc > 1.45 + g.r * 0.5) { g.state = 'walk'; g.x += dx / d * g.speed * dt; g.z += dz / d * g.speed * dt; g.ry = Math.atan2(dx, dz); }
    else { g.state = 'eat'; w.cake -= g.eat * dt; g.ry = Math.atan2(-g.x, -g.z); }
  }
  for (const g of w.goats) { for (const o of w.goats) { if (o === g) continue; const ex = g.x - o.x, ez = g.z - o.z, ed = Math.hypot(ex, ez), mn = g.r + o.r; if (ed < mn && ed > 0.001) { g.x += ex / ed * (mn - ed) * 0.5; g.z += ez / ed * (mn - ed) * 0.5; } } if (g.state !== 'charge') pushOut(w, g, g.r); }
  stepNades(m, w, dt);
  if (w.cake <= 0) { w.cake = 0; w.deadAt = { wave: m.wave, time: +m.time.toFixed(2) }; m.ev.push({ k: 'dead', team: w.team }); }
}
function damageGoat(m, w, g, dmg, head, by, from) {
  if (g.dead || dmg <= 0) return false;
  if (g.type === 'king') { if (head) dmg *= KING.headMult / 2; if (g.state === 'tired') dmg *= KING.tiredMult; } // Schwachstellen: Krone und Erschöpfung
  g.hp -= dmg; m.ev.push({ k: 'hit', team: w.team, g: w.team * GID + g.id, by, head, d: +dmg.toFixed(3), weak: g.type === 'king' && (head || g.state === 'tired') });
  if (from && g.type !== 'king') { const [fx, fz] = toLocal(w.team, from[0], from[2]); const ex = g.x - fx, ez = g.z - fz, l = Math.hypot(ex, ez) || 1, kb = g.type === 'bock' ? 0.15 : g.type === 'kid' ? 0.5 : 0.35; g.x += ex / l * kb; g.z += ez / l * kb; g.stagger = g.type === 'bock' ? 0.12 : 0.28; }
  if (g.hp <= 1e-6) {
    g.dead = true; const T = g.type === 'king' ? { coins: 80, pts: 200 } : TYPES[g.type];
    const shooter = m.players.get(by), wolf = m.wolves.find(f => f.id === by && by < 0), ownTeam = (shooter && shooter.team === w.team) || (wolf && wolf.team === w.team);
    const c = ownTeam ? T.coins + (head ? 5 : 0) : 0, pts = ownTeam ? T.pts * (head ? 2 : 1) : 0;
    w.coins += c; w.points += pts; w.kills++; if (shooter && shooter.team === w.team) { shooter.kills++; shooter.points += pts; }
    if (g.type === 'king') w.kingDown = true;
    m.ev.push({ k: 'kill', team: w.team, g: w.team * GID + g.id, by, head, coins: c, pts, king: g.type === 'king' });
    w.goats.splice(w.goats.indexOf(g), 1); return true;
  }
  return false;
}
function stepNades(m, w, dt) {
  for (let i = w.nades.length - 1; i >= 0; i--) { const n = w.nades[i];
    n.vy -= 18 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
    if (n.y < 0.12) { n.y = 0.12; if (n.vy < 0) { n.vy = -n.vy * 0.35; n.vx *= 0.6; n.vz *= 0.6; if (n.vy < 0.6) n.vy = 0; } }
    n.fuse -= dt;
    if (n.fuse <= 0) { w.nades.splice(i, 1);
      const hits = []; for (const g of w.goats) { const d = Math.hypot(g.x - n.x, 0.9 * g.s - n.y, g.z - n.z); if (d <= NADE.radius + g.r) { const k = Math.max(0, 1 - Math.max(0, d - g.r) / NADE.radius); hits.push([g, NADE.dmg * (0.15 + 0.85 * k) * (1 + 0.2 * w.upg.dmg)]); } }
      for (const [g, dmg] of hits) damageGoat(m, w, g, dmg, false, n.by, null);
      const [gx, gz] = toGlobal(w.team, n.x, n.z);
      m.ev.push({ k: 'boom', x: +gx.toFixed(2), y: +n.y.toFixed(2), z: +gz.toFixed(2), n: hits.length, by: n.by }); }
  }
}

// ---------- Werwölfe (Server-KI) ----------
let wolfSeq = 0;
function hurtWolf(m, f, dmg, by) { if (f.dead) return; f.hp -= dmg; m.ev.push({ k: 'wolfhit', f: f.id, by, hp: Math.max(0, Math.round(f.hp)) }); if (f.hp <= 0) { f.dead = true; m.ev.push({ k: 'wolfdie', f: f.id, by }); } }
function stepWolves(m, dt) {
  for (const f of m.wolves) {
    if (f.dead) continue;
    f.life -= dt; f.cd -= dt; if (f.life <= 0) { f.dead = true; m.ev.push({ k: 'wolfdie', f: f.id, expired: true }); continue; }
    const w = m.worlds[f.team], [cx, cz] = toGlobal(f.team, 0, 0);
    // Ziel: Zombie-Ziegen nahe am eigenen Kuchen zuerst, dann Gegner nahe der eigenen Festung
    let best = null, bd = 1e9;
    for (const g of w.goats) { if (g.dead) continue; const [gx, gz] = toGlobal(f.team, g.x, g.z); if (Math.hypot(gx - cx, gz - cz) > WOLF.guard) continue; const d = Math.hypot(gx - f.x, gz - f.z); if (d < bd) { bd = d; best = { g, x: gx, z: gz }; } }
    if (!best) for (const q of m.players.values()) { if (q.team === f.team || q.dead || q.prot > 0) continue; if (Math.hypot(q.x - cx, q.z - cz) > WOLF.guard - 3) continue; const d = Math.hypot(q.x - f.x, q.z - f.z); if (d < bd) { bd = d; best = { q, x: q.x, z: q.z }; } }
    let tx, tz; if (best) { tx = best.x; tz = best.z; } else { f.idleA += dt * 0.6; tx = cx + Math.cos(f.idleA) * 6.5; tz = cz + Math.sin(f.idleA) * 6.5; }
    const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz) || 0.001; f.state = 'run'; f.ry = Math.atan2(dx, dz);
    if (best && d <= WOLF.range + (best.g ? best.g.r : 0.4)) { f.state = 'bite';
      if (f.cd <= 0) { f.cd = WOLF.cd; m.ev.push({ k: 'wolfbite', f: f.id });
        if (best.g) damageGoat(m, w, best.g, WOLF.biteGoat, false, f.id, [f.x, 0, f.z]); else hurtPlayer(m, best.q, WOLF.bitePlayer, f.owner, dx, dz, 1.2); } }
    else { const sp = best ? WOLF.speed : WOLF.speed * 0.45; const ox = f.x, oz = f.z;
      if (f.side > 0) { f.side -= dt; f.x += -dz / d * sp * dt * f.sideDir; f.z += dx / d * sp * dt * f.sideDir; } else { f.x += dx / d * sp * dt; f.z += dz / d * sp * dt; }
      pushOutGlobal(m, f, 0.5); clampArena(f, 0.6);
      // Festgefahren? Kurz seitlich ausweichen
      f.stuckT += dt; if (f.stuckT > 0.6) { if (Math.hypot(f.x - f.sx, f.z - f.sz) < 0.5 && best && f.side <= 0) { f.side = 0.7; f.sideDir = Math.random() < 0.5 ? -1 : 1; } f.sx = f.x; f.sz = f.z; f.stuckT = 0; } }
  }
  for (let i = m.wolves.length - 1; i >= 0; i--) if (m.wolves[i].dead && (m.wolves[i].goneT = (m.wolves[i].goneT || 0) + dt) > 1.2) m.wolves.splice(i, 1);
}
function buyWolf(m, p, ps) {
  const w = m.worlds[ps.team]; const fail = why => { m.ev.push({ k: 'buyfail', by: p.id, item: 'wolf', why }); };
  if (m.wave < WOLF.fromWave && !(m.phase !== 'wave' && m.wave === WOLF.fromWave - 1)) return fail('wave');
  if (w.deadAt) return fail('dead');
  if (m.wolves.filter(f => f.team === ps.team && !f.dead).length >= WOLF.max) return fail('max');
  if (m.time < w.wolfReadyAt) return fail('cooldown');
  if (w.coins < WOLF.price) return fail('coins');
  w.coins -= WOLF.price; w.wolfReadyAt = m.time + WOLF.cooldown;
  const [cx, cz] = toGlobal(ps.team, (wolfSeq % 2 ? 1.8 : -1.8), 2.2);
  const f = { id: -(++wolfSeq), team: ps.team, owner: p.id, x: cx, z: cz, ry: 0, hp: WOLF.hp, maxHp: WOLF.hp, life: WOLF.life, cd: 0.5, state: 'run', dead: false, idleA: Math.random() * 6.3, stuckT: 0, sx: cx, sz: cz, side: 0, sideDir: 1 };
  m.wolves.push(f); m.ev.push({ k: 'buy', team: ps.team, by: p.id, item: 'wolf', price: WOLF.price }); m.ev.push({ k: 'wolf', f: f.id, team: ps.team });
}

// ---------- Spieler-Nachrichten ----------
function rateMult(w) { return 1 + 0.15 * w.upg.rate; }
function corr(ps) { ps.correct = true; ps.cseq = (ps.cseq || 0) + 1; }
function reject(ps, why) { ps.rejects[why] = (ps.rejects[why] || 0) + 1; }
function shot(m, p, ps, msg) {
  if (m.phase !== 'wave' && m.phase !== 'shop' && m.phase !== 'countdown') return reject(ps, 'phase');
  // Gleichzeitige Abschüsse: Schüsse aus demselben Server-Takt wie der eigene Tod zählen noch (Trade-Kill)
  if (ps.dead && !(m.time - ps.diedAt <= 0.06)) return reject(ps, 'dead');
  const w = m.worlds[ps.team];
  const W = WEAPONS[msg.w]; if (!W || !ps.owned.has(msg.w)) return reject(ps, 'weapon');
  const t = m.time;
  if (ps.reloadUntil && t < ps.reloadUntil) return reject(ps, 'reload');
  if (ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = WEAPONS[ps.reloadW].mag; ps.reloadUntil = 0; }
  if (ps.ammo[msg.w] <= 0) return reject(ps, 'ammo');
  const cd = W.cd / rateMult(w); if (t - (ps.lastShot[msg.w] ?? -9) < cd * 0.7) return reject(ps, 'rate');
  const o = msg.o, d = msg.d; if (!Array.isArray(o) || !Array.isArray(d) || o.length !== 3 || d.length !== 3 || ![...o, ...d].every(Number.isFinite)) return reject(ps, 'bad');
  if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 1.8 || o[1] < 0.3 || o[1] > ps.y + 2.4) return reject(ps, 'origin');
  const dl = Math.hypot(d[0], d[1], d[2]); if (dl < 0.5) return reject(ps, 'bad'); const dn = [d[0] / dl, d[1] / dl, d[2] / dl];
  ps.ammo[msg.w]--; ps.lastShot[msg.w] = t; ps.shots++; if (ps.prot > 0) ps.prot = 0; // wer schießt, verliert den Spawn-Schutz
  const perG = new Map(), perP = new Map(), perF = new Map(), perW = new Map(), dm = 1 + 0.2 * w.upg.dmg, range = PVP.range[msg.w] || 60;
  for (let i = 0; i < W.pellets; i++) {
    let dd = dn; if (W.spread) { const r = m.rand; dd = [dn[0] + (r() - 0.5) * 2 * W.spread, dn[1] + (r() - 0.5) * 2 * W.spread, dn[2] + (r() - 0.5) * 2 * W.spread]; const l = Math.hypot(...dd); dd = dd.map(v => v / l); }
    const h = castAll(m, ps, o, dd); if (!h || h.cover || h.t > Math.max(90, range)) continue;
    if (h.wall) { if (h.w.team !== ps.team && h.t <= range) perW.set(h.w.team + h.wall, { w: h.w, side: h.wall, n: (perW.get(h.w.team + h.wall)?.n || 0) + 1 }); continue; }
    if (h.g) { let dmg = W.dmg * dm * (h.head ? (W.headMult || 2) : 1) * (W.kidBonus && h.g.type === 'kid' ? W.kidBonus : 1);
      if (W.far) { const f = Math.min(1, Math.max(0, (h.t - W.near) / (W.far - W.near))); dmg *= 1 - 0.75 * f; }
      const e = perG.get(h.g) || { dmg: 0, head: false, w: h.w }; e.dmg += dmg; e.head = e.head || h.head; perG.set(h.g, e); continue; }
    if (h.t > range) continue;
    let dmg = PVP.dmg[msg.w] || 8; if (W.far) { const f = Math.min(1, Math.max(0, (h.t - W.near) / (W.far - W.near))); dmg *= 1 - 0.7 * f; }
    if (h.q) { const e = perP.get(h.q) || { dmg: 0, head: false }; e.dmg += dmg * (h.head ? PVP.head : 1); e.head = e.head || h.head; perP.set(h.q, e); }
    else if (h.f) perF.set(h.f, (perF.get(h.f) || 0) + dmg);
  }
  for (const [g, e] of perG) damageGoat(m, e.w, g, e.dmg, e.head, p.id, o);
  for (const [q, e] of perP) { if (q.prot > 0) { m.ev.push({ k: 'shield', id: q.id, by: p.id }); continue; } hurtPlayer(m, q, e.dmg, p.id, 0, 0, 0); }
  for (const [f, dmg] of perF) hurtWolf(m, f, dmg, p.id);
  for (const { w: ww, side, n } of perW.values()) { wallDamage(m, ww, side, PVP.wallDmg * n); m.ev.push({ k: 'wallhit', team: ww.team, side, by: p.id }); }
}
function buy(m, p, ps, msg) {
  if (msg.item === 'wolf') return buyWolf(m, p, ps);
  const w = m.worlds[ps.team]; const fail = why => { m.ev.push({ k: 'buyfail', by: p.id, item: msg.item, why }); };
  if (m.phase !== 'shop' && m.phase !== 'countdown') return fail('phase');
  const it = msg.item; let price = 0, apply;
  if (it === 'dmg' || it === 'rate' || it === 'speed') { if (w.upg[it] >= UPG[it].max) return fail('max'); price = upgPrice(it, w.upg[it]); apply = () => w.upg[it]++; }
  else if (it === 'repair') { if (w.cake >= 100) return fail('full'); price = upgPrice('repair', w.upg.repair); apply = () => { w.upg.repair++; w.cake = Math.min(100, (Math.ceil(w.cake / 12.5 - 1e-6) + 2) * 12.5); }; }
  else if (it === 'nade') { if (ps.nades >= NADE.max) return fail('full'); price = NADE.price; apply = () => ps.nades++; }
  else if (WEAPONS[it] && it !== 'blaster') { if (ps.owned.has(it)) return fail('owned'); price = WEAPONS[it].price; apply = () => { ps.owned.add(it); ps.ammo[it] = WEAPONS[it].mag; }; }
  else if (it === 'wall') { const wl = w.walls[msg.side]; if (!wl) return fail('bad');
    if (msg.act === 'build') { if (wl.built) return fail('built'); price = WALL.build; apply = () => Object.assign(wl, { built: true, hp: WALL.baseHp, maxHp: WALL.baseHp, lvl: 0 }); }
    else if (msg.act === 'repair') { if (!wl.built || wl.hp >= wl.maxHp) return fail('full'); price = WALL.repair; apply = () => { wl.hp = Math.min(wl.maxHp, wl.hp + WALL.repairHp); }; }
    else if (msg.act === 'reinf') { if (!wl.built || wl.lvl >= 2) return fail('max'); price = WALL.reinf; apply = () => { wl.lvl++; wl.maxHp += WALL.reinfHp; wl.hp += WALL.reinfHp; }; }
    else return fail('bad'); }
  else return fail('bad');
  if (w.coins < price) return fail('coins');
  w.coins -= price; apply(); m.ev.push({ k: 'buy', team: ps.team, by: p.id, item: it, side: msg.side, act: msg.act, price });
}
function spawnPoint(m, ps) { // im eigenen Fort, möglichst weit weg von Gegnern
  const opts = [[-1.6, 2.6], [1.6, 2.6], [0, 3.4]].map(([lx, lz]) => toGlobal(ps.team, lx, lz));
  let best = opts[0], bd = -1; for (const [x, z] of opts) { let dmin = 1e9; for (const q of m.players.values()) if (q.team !== ps.team && !q.dead) dmin = Math.min(dmin, Math.hypot(q.x - x, q.z - z)); if (dmin > bd) { bd = dmin; best = [x, z]; } }
  return best;
}

export const kuchenkrieg = {
  id: 'kuchenkrieg', name: 'Kuchenkrieg', coop: true,
  create(room) {
    const m = { room, seed: room.seed, rand: rng(room.seed ^ 0x5bd1e995), time: 0, wave: 0, phase: 'countdown', phaseT: COUNTDOWN + 1, worlds: [newWorld(0), newWorld(1, !room.coop)], players: new Map(), wolves: [], ev: [], over: false, coop: !!room.coop };
    for (const p of room.players) m.players.set(p.id, makePS(m, p, room.players.filter(x => x.team === p.team).indexOf(p)));
    return m;
  },
  onRejoin(m, p) { const ps = m.players.get(p.id); if (ps) corr(ps); },
  onLeave(m, p) { m.players.delete(p.id); },
  onMsg(m, p, msg) {
    const ps = m.players.get(p.id); if (!ps) return;
    if (msg.t === 'in') {
      const t = m.time, dt = Math.min(0.5, Math.max(0.05, t - ps.lastInT)); ps.lastInT = t;
      const fin = v => Number.isFinite(+v) ? +v : 0; ps.yaw = fin(msg.yaw); ps.pitch = Math.max(-1.6, Math.min(1.6, fin(msg.pitch))); ps.cr = !!msg.cr;
      if (WEAPONS[msg.w] && ps.owned.has(msg.w)) ps.w = msg.w;
      if (ps.dead || (+msg.c || 0) < ps.cseq) return; // tot oder veraltete Position vor der letzten Server-Korrektur
      const x = +msg.x, z = +msg.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const w = m.worlds[ps.team], boosting = t < ps.boostUntil + 0.4, maxD = 11 * (1 + 0.1 * w.upg.speed) * (boosting ? 1.25 : 1) * 1.3 * dt + 0.6;
      let nx = x, nz = z; const d = Math.hypot(x - ps.x, z - ps.z);
      if (d > maxD) { nx = ps.x + (x - ps.x) / d * maxD; nz = ps.z + (z - ps.z) / d * maxD; corr(ps); ps.speedRejects++; }
      const q = { x: nx, z: nz }; if (clampArena(q)) corr(ps); ps.x = q.x; ps.z = q.z;
      // Höhe: normaler Sprung bis 1,7 m; nur mit freigeschaltetem Boost höher, und nur begrenzt schnell steigend
      const yMax = t < ps.boostUntil + 1.4 ? BOOST.maxY : BOOST.jumpY; let y = Math.max(0, Math.min(yMax, +msg.y || 0));
      const vdt = Math.min(dt, 0.2); if (y > ps.y + 14 * vdt + 0.3) { y = ps.y + 14 * vdt + 0.3; ps.yRejects++; }
      ps.y = y; ps.vis = { boost: t < ps.boostUntil };
    }
    else if (msg.t === 'boost') { if (ps.dead || m.time < ps.boostReadyAt) return reject(ps, 'boost');
      ps.boostUntil = m.time + BOOST.dur + 0.2; ps.boostReadyAt = m.time + BOOST.cooldown; ps.boosts++; m.ev.push({ k: 'boost', id: ps.id }); }
    else if (msg.t === 'shot') shot(m, p, ps, msg);
    else if (msg.t === 'reload') { const W = WEAPONS[msg.w]; if (W && ps.owned.has(msg.w) && !ps.reloadUntil && ps.ammo[msg.w] < W.mag) { ps.reloadUntil = m.time + W.reload * 0.9; ps.reloadW = msg.w; } }
    else if (msg.t === 'nade') {
      const w = m.worlds[ps.team]; if (m.phase !== 'wave' || w.deadAt || ps.dead || ps.nades <= 0) return reject(ps, 'nade');
      const o = msg.o, v = msg.v; if (!Array.isArray(o) || !Array.isArray(v) || ![...o, ...v].every(Number.isFinite)) return;
      if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 1.8 || Math.hypot(...v) > NADE.maxSpeed) return reject(ps, 'nade');
      // Granaten wirken auf die Ziegen der Welt, in deren Hälfte sie geworfen werden
      const tw = m.worlds.find(ww => ww.active && Math.hypot(...toLocal(ww.team, o[0], o[2])) < 22) || w;
      const [lx, lz] = toLocal(tw.team, o[0], o[2]), lv = tw.team ? [-v[0], v[1], -v[2]] : v;
      ps.nades--; tw.nades.push({ x: lx, y: o[1], z: lz, vx: lv[0], vy: lv[1], vz: lv[2], fuse: NADE.fuse, by: p.id });
    }
    else if (msg.t === 'buy') buy(m, p, ps, msg);
    else if (msg.t === 'shopready') { if (m.phase === 'shop') ps.shopReady = !!msg.v; }
  },
  tick(m, dt) {
    if (m.over) return;
    m.time += dt;
    for (const ps of m.players.values()) { if (ps.prot > 0) ps.prot = Math.max(0, ps.prot - dt);
      if (ps.dead && m.time >= ps.respawnAt) { const [x, z] = spawnPoint(m, ps); ps.dead = false; ps.hp = PVP.hp; ps.x = x; ps.z = z; ps.y = 0; ps.prot = PVP.protect; corr(ps); m.ev.push({ k: 'respawn', id: ps.id }); } }
    stepWolves(m, dt);
    if (m.phase === 'countdown') { m.phaseT -= dt; if (m.phaseT <= 0) { m.wave++; const wv = makeWave5(m.wave, m.seed, m.room.perTeam);
      for (const w of m.worlds) if (!w.deadAt && w.active) { w.queue = wv.list.map(e => ({ ...e })); w.qt = 0; w.lostThisWave = 0; w.wave = m.wave; }
      m.ev.push({ k: 'wave', wave: m.wave, name: wv.name, king: wv.king });
      m.phase = 'wave'; } return; }
    if (m.phase === 'wave') {
      for (const w of m.worlds) {
        stepWorld(m, w, dt);
        if (w.active && !w.deadAt && w.cleared < m.wave && !w.queue.length && !w.goats.length) { w.cleared = m.wave; w.coins += 25; const slices = Math.ceil(w.cake / 12.5 - 1e-6);
          w.points += slices * 5 * m.wave; const held = Object.values(w.walls).some(x => x.built) && !w.lostThisWave; if (held) w.points += 25; m.ev.push({ k: 'cleared', team: w.team, wave: m.wave, held }); }
      }
      const act = m.worlds.filter(w => w.active), alive = act.filter(w => !w.deadAt);
      if (alive.length < act.length) { m.over = true; return; } // ein Kuchen ist gefallen: Match endet sofort
      if (alive.every(w => w.cleared >= m.wave)) { if (m.wave >= MAX_WAVES) { m.over = true; return; } m.phase = 'shop'; m.phaseT = SHOP_TIME; for (const ps of m.players.values()) ps.shopReady = false; }
      return;
    }
    if (m.phase === 'shop') { m.phaseT -= dt; const pl = m.room.players.filter(p => p.connected).map(p => m.players.get(p.id)).filter(Boolean);
      if (m.phaseT <= 0 || (pl.length && pl.every(ps => ps.shopReady))) { m.phase = 'countdown'; m.phaseT = COUNTDOWN; } }
  },
  snapshot(m, p) {
    const ps = m.players.get(p.id); const team = ps ? ps.team : p.team; const w = m.worlds[team];
    const t = m.time; if (ps && ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = WEAPONS[ps.reloadW].mag; ps.reloadUntil = 0; }
    const goatsOf = ww => ww.goats.map(g => { const [gx, gz] = toGlobal(ww.team, g.x, g.z); return [ww.team * GID + g.id, TYPE_IDX[g.type], +gx.toFixed(2), +gz.toFixed(2), +g.hp.toFixed(2), +g.maxHp.toFixed(2), STATE_IDX[g.state] ?? 0, +(g.ry + (ww.team ? Math.PI : 0)).toFixed(2)]; });
    const wallsOf = ww => Object.fromEntries(Object.entries(ww.walls).map(([k, v]) => [k, [v.built ? 1 : 0, +v.hp.toFixed(1), v.maxHp, v.lvl]]));
    const snap = { t: 'snap', mode: 'kk', time: +t.toFixed(2), phase: m.phase, phaseT: +m.phaseT.toFixed(2), wave: m.wave, maxWaves: MAX_WAVES, waveName: WAVE_NAMES[m.wave - 1] || '', team, coop: m.coop,
      mine: { cake: +w.cake.toFixed(2), coins: w.coins, upg: w.upg, kills: w.kills, points: w.points, dead: w.deadAt, cleared: w.cleared, walls: wallsOf(w), wolfIn: Math.max(0, +(w.wolfReadyAt - t).toFixed(1)) },
      worlds: m.worlds.map(ww => ({ team: ww.team, active: ww.active, cake: +ww.cake.toFixed(1), dead: ww.deadAt, cleared: ww.cleared, kills: ww.kills, points: ww.points, walls: wallsOf(ww), goats: goatsOf(ww) })),
      players: [...m.players.values()].map(o => ({ id: o.id, team: o.team, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), yaw: +o.yaw.toFixed(3), pitch: +o.pitch.toFixed(3), w: o.w, cr: o.cr,
        hp: Math.round(o.hp), dead: o.dead ? 1 : 0, prot: o.prot > 0 ? 1 : 0, boost: o.vis && o.vis.boost ? 1 : 0, pk: o.pkills })),
      wolves: m.wolves.map(f => [f.id, f.team, +f.x.toFixed(2), +f.z.toFixed(2), +f.ry.toFixed(2), Math.max(0, Math.round(f.hp)), f.maxHp, f.dead ? 2 : f.state === 'bite' ? 1 : 0, +f.life.toFixed(1)]),
      ev: m.ev,
      you: ps ? { owned: [...ps.owned], ammo: ps.ammo, nades: ps.nades, reloading: !!ps.reloadUntil, shopReady: ps.shopReady, kills: ps.kills, points: ps.points, pkills: ps.pkills,
        hp: Math.round(ps.hp), dead: ps.dead, respawnIn: ps.dead ? +Math.max(0, ps.respawnAt - t).toFixed(1) : 0, prot: ps.prot > 0, boostIn: +Math.max(0, ps.boostReadyAt - t).toFixed(2) } : null };
    if (ps && ps.correct) { snap.correct = { x: +ps.x.toFixed(2), z: +ps.z.toFixed(2), c: ps.cseq }; ps.correct = false; }
    return snap;
  },
  flush(m) { m.ev = []; },
  over(m) { return m.over; },
  results(m, room) {
    const T = m.worlds.filter(w => w.active).map(w => ({ team: w.team, survived: !w.deadAt, deadWave: w.deadAt?.wave ?? null, deadTime: w.deadAt?.time ?? null, cleared: w.cleared, kills: w.kills, points: w.points, pvpKills: w.pvpKills, cake: +w.cake.toFixed(1), king: w.kingDown }));
    let winner = null, reason = 'draw';
    if (m.coop) { const a = T[0]; winner = a.survived ? 0 : null; reason = a.survived ? 'coopwin' : 'cooplose'; }
    else { const [a, b] = T;
      // Regeln: 1) Ein Kuchen fällt → das andere Team gewinnt. 2) Fallen beide im selben Moment oder überleben beide alle
      // 5 Wellen → mehr Kuchen übrig gewinnt (Differenz > 0,5). 3) Danach mehr Punkte. 4) Sonst unentschieden.
      if (a.survived !== b.survived) { winner = a.survived ? 0 : 1; reason = 'survival'; }
      else if (Math.abs(a.cake - b.cake) > 0.5) { winner = a.cake > b.cake ? 0 : 1; reason = 'cake'; }
      else if (a.points !== b.points) { winner = a.points > b.points ? 0 : 1; reason = 'points'; } }
    const players = room.players.map(p => { const ps = m.players.get(p.id); return { id: p.id, name: p.name, team: p.team, kills: ps?.kills ?? 0, points: ps?.points ?? 0, pkills: ps?.pkills ?? 0, deaths: ps?.deaths ?? 0 }; });
    return { winner, reason, waves: m.wave, maxWaves: MAX_WAVES, teams: T, players, coop: m.coop };
  },
};
function makePS(m, p, idx) {
  const ammo = {}; for (const k in WEAPONS) ammo[k] = WEAPONS[k].mag; const [x, z] = toGlobal(p.team, idx ? 1.6 : -1.6, 2.6);
  return { id: p.id, team: p.team, x, y: 0, z, yaw: p.team ? 0 : Math.PI, pitch: 0, w: 'blaster', cr: false, owned: new Set(['blaster']), ammo, reloadUntil: 0, reloadW: 'blaster',
    lastShot: {}, nades: NADE.start, lastInT: 0, shopReady: false, correct: true, cseq: 1, kills: 0, points: 0, shots: 0, rejects: {}, speedRejects: 0, yRejects: 0,
    hp: PVP.hp, dead: false, respawnAt: 0, prot: PVP.protect, pkills: 0, deaths: 0, lastHitBy: 0, boostUntil: -9, boostReadyAt: 0, boosts: 0, vis: null };
}
export const MODES = { kuchenkrieg };
