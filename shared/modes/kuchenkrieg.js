// Modus "Kuchenkrieg": jedes Team verteidigt seinen eigenen Kuchen gegen identische Wellen.
// Der Server simuliert Ziegen, Kuchen, Mauern, Münzen, Treffer und Granaten autoritativ.
import { WEAPONS, TYPES, UPG, NADE, WALL, ARENA, upgPrice, rng, makeWave } from '../rules.js';

const MAX_WAVES = 10, SHOP_TIME = 25, COUNTDOWN = 3;
const SIDES = { N: { ax: 'z', sg: -1 }, E: { ax: 'x', sg: 1 }, S: { ax: 'z', sg: 1 }, W: { ax: 'x', sg: -1 } };
const TYPE_IDX = { normal: 0, kid: 1, bock: 2 }, STATE_IDX = { walk: 0, eat: 1, wall: 2 };
const { F, HALF, TH, H: WH } = WALL;

function newWorld(team) {
  const walls = {}; for (const k in SIDES) walls[k] = { built: false, hp: 0, maxHp: 0, lvl: 0 };
  return { team, goats: [], gid: 1, cake: 100, walls, coins: 0, upg: { dmg: 0, rate: 0, speed: 0, repair: 0 }, kills: 0, points: 0,
    deadAt: null, queue: [], qt: 0, cleared: 0, nades: [], ev: [], lostThisWave: 0, wave: 0 };
}
// ---------- Navigation (gleiche Logik wie im Einzelspieler) ----------
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
function wallDamage(w, side, n) { const wl = w.walls[side]; if (!wl.built || n <= 0) return; wl.hp -= n;
  if (wl.hp <= 0) { wl.built = false; wl.hp = 0; w.lostThisWave++; w.ev.push({ k: 'wall', side, destroyed: true }); } }

// ---------- Raycast gegen vereinfachte Trefferzonen ----------
function raySphere(o, d, c, r) { const ox = c[0] - o[0], oy = c[1] - o[1], oz = c[2] - o[2]; const t = ox * d[0] + oy * d[1] + oz * d[2]; if (t < 0) return -1;
  const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) return -1; return t - Math.sqrt(r * r - d2); }
function rayCyl(o, d, cx, cz, r, y0, y1) { const fx = o[0] - cx, fz = o[2] - cz; const a = d[0] * d[0] + d[2] * d[2]; if (a < 1e-9) return -1;
  const b = 2 * (fx * d[0] + fz * d[2]), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); if (t < 0) return -1; const y = o[1] + d[1] * t; return y >= y0 && y <= y1 ? t : -1; }
function rayBox(o, d, A) { let t0 = 0, t1 = 1e9; for (const [i, mn, mx] of [[0, A[0], A[1]], [1, A[2], A[3]], [2, A[4], A[5]]]) {
  if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn || o[i] > mx) return -1; continue; } let a = (mn - o[i]) / d[i], b = (mx - o[i]) / d[i]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1; } return t0; }
function wallBox(side) { const s = SIDES[side]; return s.ax === 'x' ? [s.sg * F - TH / 2, s.sg * F + TH / 2, 0, WH, -HALF, HALF] : [-HALF, HALF, 0, WH, s.sg * F - TH / 2, s.sg * F + TH / 2]; }
export function castRay(w, o, d) {
  let best = null;
  for (const g of w.goats) { if (g.dead) continue; const s = g.s;
    const th = raySphere(o, d, [g.x, 1.95 * s, g.z], 0.34 * s); if (th >= 0 && (!best || th < best.t)) best = { t: th, g, head: true };
    const tb = rayCyl(o, d, g.x, g.z, 0.45 * s, 0.1 * s, 1.75 * s); if (tb >= 0 && (!best || tb < best.t)) best = { t: tb, g, head: false }; }
  for (const k in w.walls) if (w.walls[k].built) { const t = rayBox(o, d, wallBox(k)); if (t >= 0 && (!best || t < best.t)) best = { t, wall: k }; }
  return best;
}

// ---------- Ziegen ----------
function spawn(w, e, wave) {
  const T = TYPES[e.type], hpM = 1 + Math.max(0, wave - 4) * 0.12;
  w.goats.push({ id: w.gid++, type: e.type, s: T.s, r: 0.45 * T.s, x: Math.cos(e.a) * ARENA.spawnR, z: Math.sin(e.a) * ARENA.spawnR, hp: T.hp * hpM, maxHp: T.hp * hpM,
    speed: (T.speed * e.sp + wave * 0.05) * 0.78, eat: T.eat, state: 'walk', stagger: 0, wp: null, wpTried: false, ry: 0, dead: false });
}
function stepWorld(m, w, dt) {
  if (w.deadAt) return;
  w.qt += dt;
  let alive = w.goats.length;
  while (w.queue.length && w.queue[0].t <= w.qt && alive < ARENA.maxAlive) { spawn(w, w.queue.shift(), m.wave); alive++; }
  for (const g of w.goats) {
    if (g.stagger > 0) { g.stagger -= dt; continue; }
    const nav = navTarget(w, g), dx = nav.x - g.x, dz = nav.z - g.z, d = Math.hypot(dx, dz) || 0.001, dc = Math.hypot(g.x, g.z);
    if (nav.wall && d < 0.35) { g.state = 'wall'; wallDamage(w, nav.wall, g.eat * 2 * dt); }
    else if (nav.wall || (g.wp && g.wp.length) || dc > 1.45 + g.r * 0.5) { g.state = 'walk'; g.x += dx / d * g.speed * dt; g.z += dz / d * g.speed * dt; g.ry = Math.atan2(dx, dz); }
    else { g.state = 'eat'; w.cake -= g.eat * dt; g.ry = Math.atan2(-g.x, -g.z); }
  }
  for (const g of w.goats) { for (const o of w.goats) { if (o === g) continue; const ex = g.x - o.x, ez = g.z - o.z, ed = Math.hypot(ex, ez), mn = g.r + o.r; if (ed < mn && ed > 0.001) { g.x += ex / ed * (mn - ed) * 0.5; g.z += ez / ed * (mn - ed) * 0.5; } } pushOut(w, g, g.r); }
  stepNades(m, w, dt);
  if (w.cake <= 0) { w.cake = 0; w.deadAt = { wave: m.wave, time: +m.time.toFixed(2) }; w.ev.push({ k: 'dead' }); }
}
function damageGoat(m, w, g, dmg, head, by, from) {
  if (g.dead || dmg <= 0) return false;
  g.hp -= dmg; w.ev.push({ k: 'hit', g: g.id, by, head, d: +dmg.toFixed(3) });
  if (from) { const ex = g.x - from[0], ez = g.z - from[2], l = Math.hypot(ex, ez) || 1, kb = g.type === 'bock' ? 0.15 : g.type === 'kid' ? 0.5 : 0.35; g.x += ex / l * kb; g.z += ez / l * kb; g.stagger = g.type === 'bock' ? 0.12 : 0.28; }
  if (g.hp <= 1e-6) {
    g.dead = true; const T = TYPES[g.type], c = T.coins + (head ? 5 : 0), pts = T.pts * (head ? 2 : 1);
    w.coins += c; w.points += pts; w.kills++; const p = m.players.get(by); if (p) { p.kills++; p.points += pts; }
    w.ev.push({ k: 'kill', g: g.id, by, head, coins: c, pts });
    w.goats.splice(w.goats.indexOf(g), 1); return true;
  }
  return false;
}
function stepNades(m, w, dt) {
  for (let i = w.nades.length - 1; i >= 0; i--) { const n = w.nades[i];
    n.vy -= 18 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
    if (n.y < 0.12) { n.y = 0.12; if (n.vy < 0) { n.vy = -n.vy * 0.35; n.vx *= 0.6; n.vz *= 0.6; if (n.vy < 0.6) n.vy = 0; } }
    if (n.y <= WH) for (const k in SIDES) { if (!w.walls[k].built) continue; const s = SIDES[k]; const a = s.ax === 'x' ? n.x : n.z, b = s.ax === 'x' ? n.z : n.x;
      if (Math.abs(b) <= HALF && Math.abs(a - s.sg * F) < TH / 2 + 0.1) { const out = a * s.sg > F, t = out ? s.sg * (F + TH / 2 + 0.11) : s.sg * (F - TH / 2 - 0.11); if (s.ax === 'x') { n.x = t; n.vx = -n.vx * 0.4; } else { n.z = t; n.vz = -n.vz * 0.4; } } }
    n.fuse -= dt;
    if (n.fuse <= 0) { w.nades.splice(i, 1);
      const hits = []; for (const g of w.goats) { const d = Math.hypot(g.x - n.x, 0.9 * g.s - n.y, g.z - n.z); if (d <= NADE.radius + g.r) { const k = Math.max(0, 1 - Math.max(0, d - g.r) / NADE.radius); hits.push([g, NADE.dmg * (0.15 + 0.85 * k) * (1 + 0.2 * w.upg.dmg)]); } }
      for (const [g, dmg] of hits) damageGoat(m, w, g, dmg, false, n.by, null);
      w.ev.push({ k: 'boom', x: +n.x.toFixed(2), y: +n.y.toFixed(2), z: +n.z.toFixed(2), n: hits.length, by: n.by }); }
  }
}

// ---------- Spieler-Nachrichten (alles wird geprüft) ----------
function nowS(m) { return m.time; }
function rateMult(w) { return 1 + 0.15 * w.upg.rate; }
function shot(m, p, ps, msg) {
  if (m.phase !== 'wave') return reject(ps, 'phase');
  const w = m.worlds[ps.team]; if (w.deadAt) return reject(ps, 'dead');
  const W = WEAPONS[msg.w]; if (!W || !ps.owned.has(msg.w)) return reject(ps, 'weapon');
  const t = nowS(m);
  if (ps.reloadUntil && t < ps.reloadUntil) return reject(ps, 'reload');
  if (ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = WEAPONS[ps.reloadW].mag; ps.reloadUntil = 0; }
  if (ps.ammo[msg.w] <= 0) return reject(ps, 'ammo');
  const cd = W.cd / rateMult(w); if (t - (ps.lastShot[msg.w] ?? -9) < cd * 0.7) return reject(ps, 'rate');
  const o = msg.o, d = msg.d; if (!Array.isArray(o) || !Array.isArray(d) || o.length !== 3 || d.length !== 3 || ![...o, ...d].every(Number.isFinite)) return reject(ps, 'bad');
  if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 1.8 || o[1] < 0.3 || o[1] > 3.6) return reject(ps, 'origin');
  const dl = Math.hypot(d[0], d[1], d[2]); if (dl < 0.5) return reject(ps, 'bad'); const dn = [d[0] / dl, d[1] / dl, d[2] / dl];
  ps.ammo[msg.w]--; ps.lastShot[msg.w] = t; ps.shots++;
  const per = new Map(), dm = 1 + 0.2 * w.upg.dmg;
  for (let i = 0; i < W.pellets; i++) {
    let dd = dn; if (W.spread) { const r = m.rand; dd = [dn[0] + (r() - 0.5) * 2 * W.spread, dn[1] + (r() - 0.5) * 2 * W.spread, dn[2] + (r() - 0.5) * 2 * W.spread]; const l = Math.hypot(...dd); dd = dd.map(v => v / l); }
    const h = castRay(w, o, dd); if (!h || h.wall || h.t > 90) continue;
    let dmg = W.dmg * dm * (h.head ? (W.headMult || 2) : 1) * (W.kidBonus && h.g.type === 'kid' ? W.kidBonus : 1);
    if (W.far) { const f = Math.min(1, Math.max(0, (h.t - W.near) / (W.far - W.near))); dmg *= 1 - 0.75 * f; }
    const e = per.get(h.g) || { dmg: 0, head: false }; e.dmg += dmg; e.head = e.head || h.head; per.set(h.g, e);
  }
  for (const [g, e] of per) damageGoat(m, w, g, e.dmg, e.head, p.id, o);
}
function reject(ps, why) { ps.rejects[why] = (ps.rejects[why] || 0) + 1; }
function buy(m, p, ps, msg) {
  const w = m.worlds[ps.team]; const fail = why => { w.ev.push({ k: 'buyfail', by: p.id, item: msg.item, why }); };
  if (m.phase !== 'shop') return fail('phase');
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
  w.coins -= price; apply(); w.ev.push({ k: 'buy', by: p.id, item: it, side: msg.side, act: msg.act, price });
}

export const kuchenkrieg = {
  id: 'kuchenkrieg', name: 'Kuchenkrieg',
  create(room) {
    const m = { room, seed: room.seed, rand: rng(room.seed ^ 0x5bd1e995), time: 0, wave: 0, phase: 'countdown', phaseT: COUNTDOWN, worlds: [newWorld(0), newWorld(1)], players: new Map(), over: false };
    for (const p of room.players) m.players.set(p.id, makePS(p, room.players.filter(x => x.team === p.team).indexOf(p)));
    return m;
  },
  onRejoin(m, p) { const ps = m.players.get(p.id); if (ps) ps.correct = true; },
  onLeave(m, p) { m.players.delete(p.id); },
  onMsg(m, p, msg) {
    const ps = m.players.get(p.id); if (!ps) return;
    if (msg.t === 'in') {
      // dt gedeckelt: wer lange nichts sendet, darf danach nicht weit springen
      const t = m.time, dt = Math.min(0.5, Math.max(0.05, t - ps.lastInT)); ps.lastInT = t;
      const x = +msg.x, z = +msg.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const w = m.worlds[ps.team], maxD = 11 * (1 + 0.1 * w.upg.speed) * 1.3 * dt + 0.6;
      let nx = x, nz = z; const d = Math.hypot(x - ps.x, z - ps.z);
      if (d > maxD) { nx = ps.x + (x - ps.x) / d * maxD; nz = ps.z + (z - ps.z) / d * maxD; ps.correct = true; ps.speedRejects++; }
      const r = Math.hypot(nx, nz); if (r > ARENA.playerR) { nx *= ARENA.playerR / r; nz *= ARENA.playerR / r; ps.correct = true; }
      ps.x = nx; ps.z = nz; ps.y = Math.max(0, Math.min(1.6, +msg.y || 0)); const fin = v => Number.isFinite(+v) ? +v : 0; ps.yaw = fin(msg.yaw); ps.pitch = Math.max(-1.6, Math.min(1.6, fin(msg.pitch))); ps.cr = !!msg.cr;
      if (WEAPONS[msg.w] && ps.owned.has(msg.w)) ps.w = msg.w;
    }
    else if (msg.t === 'shot') shot(m, p, ps, msg);
    else if (msg.t === 'reload') { const W = WEAPONS[msg.w]; if (W && ps.owned.has(msg.w) && !ps.reloadUntil && ps.ammo[msg.w] < W.mag) { ps.reloadUntil = m.time + W.reload * 0.9; ps.reloadW = msg.w; } }
    else if (msg.t === 'nade') {
      const w = m.worlds[ps.team]; if (m.phase !== 'wave' || w.deadAt || ps.nades <= 0) return reject(ps, 'nade');
      const o = msg.o, v = msg.v; if (!Array.isArray(o) || !Array.isArray(v) || ![...o, ...v].every(Number.isFinite)) return;
      if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 1.8 || Math.hypot(...v) > NADE.maxSpeed) return reject(ps, 'nade');
      ps.nades--; w.nades.push({ x: o[0], y: o[1], z: o[2], vx: v[0], vy: v[1], vz: v[2], fuse: NADE.fuse, by: p.id });
    }
    else if (msg.t === 'buy') buy(m, p, ps, msg);
    else if (msg.t === 'shopready') { if (m.phase === 'shop') ps.shopReady = !!msg.v; }
  },
  tick(m, dt) {
    if (m.over) return;
    m.time += dt;
    if (m.phase === 'countdown') { m.phaseT -= dt; if (m.phaseT <= 0) { m.wave++; const wv = makeWave(m.wave, m.seed);
      for (const w of m.worlds) if (!w.deadAt) { w.queue = wv.list.map(e => ({ ...e })); w.qt = 0; w.lostThisWave = 0; w.wave = m.wave; w.ev.push({ k: 'wave', wave: m.wave, big: wv.big, fronts: wv.fronts.map(a => +a.toFixed(3)) }); }
      m.phase = 'wave'; } return; }
    if (m.phase === 'wave') {
      for (const w of m.worlds) {
        stepWorld(m, w, dt);
        if (!w.deadAt && w.cleared < m.wave && !w.queue.length && !w.goats.length) { w.cleared = m.wave; w.coins += 25; const slices = Math.ceil(w.cake / 12.5 - 1e-6);
          w.points += slices * 5 * m.wave; const held = Object.values(w.walls).some(x => x.built) && !w.lostThisWave; if (held) w.points += 25; w.ev.push({ k: 'cleared', wave: m.wave, held }); }
      }
      const alive = m.worlds.filter(w => !w.deadAt);
      if (alive.length <= 1 && alive.length < m.worlds.length) { m.over = true; return; }
      if (alive.every(w => w.cleared >= m.wave)) { if (m.wave >= MAX_WAVES) { m.over = true; return; } m.phase = 'shop'; m.phaseT = SHOP_TIME; for (const ps of m.players.values()) ps.shopReady = false; }
      return;
    }
    if (m.phase === 'shop') { m.phaseT -= dt; const pl = m.room.players.filter(p => p.connected).map(p => m.players.get(p.id)).filter(Boolean);
      if (m.phaseT <= 0 || (pl.length && pl.every(ps => ps.shopReady))) { m.phase = 'countdown'; m.phaseT = COUNTDOWN; } }
  },
  snapshot(m, p) {
    const ps = m.players.get(p.id); const team = ps ? ps.team : p.team; const w = m.worlds[team];
    const t = m.time; if (ps && ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = WEAPONS[ps.reloadW].mag; ps.reloadUntil = 0; }
    const snap = { t: 'snap', time: +t.toFixed(2), phase: m.phase, phaseT: +m.phaseT.toFixed(2), wave: m.wave, team,
      mine: { cake: +w.cake.toFixed(2), coins: w.coins, upg: w.upg, kills: w.kills, points: w.points, dead: w.deadAt, cleared: w.cleared,
        walls: Object.fromEntries(Object.entries(w.walls).map(([k, v]) => [k, [v.built ? 1 : 0, +v.hp.toFixed(1), v.maxHp, v.lvl]])),
        goats: w.goats.map(g => [g.id, TYPE_IDX[g.type], +g.x.toFixed(2), +g.z.toFixed(2), +g.hp.toFixed(2), +g.maxHp.toFixed(2), STATE_IDX[g.state] ?? 0, +g.ry.toFixed(2)]),
        nades: w.nades.map(n => [+n.x.toFixed(2), +n.y.toFixed(2), +n.z.toFixed(2)]), ev: w.ev },
      others: m.worlds.filter(o => o !== w).map(o => ({ team: o.team, cake: +o.cake.toFixed(1), kills: o.kills, points: o.points, dead: o.deadAt, cleared: o.cleared, goats: o.goats.length, walls: Object.values(o.walls).filter(x => x.built).length })),
      players: [...m.players.values()].filter(o => o.team === team).map(o => ({ id: o.id, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), yaw: +o.yaw.toFixed(3), pitch: +o.pitch.toFixed(3), w: o.w, cr: o.cr })),
      you: ps ? { owned: [...ps.owned], ammo: ps.ammo, nades: ps.nades, reloading: !!ps.reloadUntil, shopReady: ps.shopReady, kills: ps.kills, points: ps.points } : null };
    if (ps && ps.correct) { snap.correct = { x: +ps.x.toFixed(2), z: +ps.z.toFixed(2) }; ps.correct = false; }
    return snap;
  },
  flush(m) { for (const w of m.worlds) w.ev = []; },
  over(m) { return m.over; },
  results(m, room) {
    const T = m.worlds.map(w => ({ team: w.team, survived: !w.deadAt, deadWave: w.deadAt?.wave ?? null, deadTime: w.deadAt?.time ?? null, cleared: w.cleared, kills: w.kills, points: w.points, cake: +w.cake.toFixed(1) }));
    // Sieger: wer länger überlebt. Gleichstand (beide überleben alle Wellen oder fallen im selben Moment): Punkte, dann Kuchenrest.
    const life = x => x.survived ? Infinity : x.deadTime;
    let winner = null, reason = 'draw';
    const [a, b] = T;
    if (life(a) !== life(b) && Math.abs((life(a) === Infinity ? 1e9 : life(a)) - (life(b) === Infinity ? 1e9 : life(b))) > 0.05) { winner = life(a) > life(b) ? 0 : 1; reason = 'survival'; }
    else if (a.points !== b.points) { winner = a.points > b.points ? 0 : 1; reason = 'points'; }
    else if (a.cake !== b.cake) { winner = a.cake > b.cake ? 0 : 1; reason = 'cake'; }
    const players = room.players.map(p => { const ps = m.players.get(p.id); return { id: p.id, name: p.name, team: p.team, kills: ps?.kills ?? 0, points: ps?.points ?? 0 }; });
    return { winner, reason, waves: m.wave, maxWaves: MAX_WAVES, teams: T, players };
  },
};
function makePS(p, idx) {
  const ammo = {}; for (const k in WEAPONS) ammo[k] = WEAPONS[k].mag;
  return { id: p.id, team: p.team, x: idx ? 2 : -2, y: 0, z: 8, yaw: 0, pitch: 0, w: 'blaster', cr: false, owned: new Set(['blaster']), ammo, reloadUntil: 0, reloadW: 'blaster',
    lastShot: {}, nades: NADE.start, lastInT: 0, shopReady: false, correct: true, kills: 0, points: 0, shots: 0, rejects: {}, speedRejects: 0 };
}
export const MODES = { kuchenkrieg };
