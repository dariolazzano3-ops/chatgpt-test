// Modus "GOAT ROYALE": runde Schwebeinsel, jeder hat 3 Leben. Treffer erhöhen die "Wucht" (%) und stoßen zurück;
// wer von der Insel fällt, verliert ein Leben. Neutrale Ziegen kann man reiten; nach 10 s am Stück verwandelt sich
// die Ziege in eine dreiköpfige Kampfziege der eigenen Teamfarbe, die rückwärts auf Gegner zuläuft und austritt.
// Der Server ist für Treffer, Rückstoß, Absturz, Leben, Reiten, Verwandlung und Sieg allein zuständig.
import { rng } from '../rules.js';

export const ROYALE = {
  R0: 16, Rmin: 9, shrinkAt: 75, shrinkDur: 60, lives: 3, maxTime: 240, countdown: 3,
  respawn: 2.4, protect: 2.5, kbTime: 0.45, mountDist: 2.4, rideToTransform: 10, specialLife: 20, specialHp: 24,
  windup: 0.9, kickRange: 2.7, kickCone: 1.25, kickCd: 2.4, kickKb: 15, kickWucht: 18, goats: 3, playerR: 0.55,
};
// Waffen im Royale: alle drei ab Start, unterschiedliche Wirkung (Rückstoß statt Schaden)
export const RWEAPONS = {
  blaster: { cd: 0.16, mag: 24, reload: 1.1, pellets: 1, spread: 0, wucht: 4, kb: 2.2, range: 60, goatDmg: 1 },
  shotgun: { cd: 0.9, mag: 6, reload: 1.9, pellets: 8, spread: 0.055, wucht: 2.6, kb: 1.6, range: 14, goatDmg: 0.55 },
  sniper: { cd: 1.1, mag: 5, reload: 2.3, pellets: 1, spread: 0, wucht: 16, kb: 7.5, range: 120, goatDmg: 6 },
};
const SPAWNS = [[-1, 0], [1, 0]]; // Team 0 links, Team 1 rechts

function raySphere(o, d, c, r) { const ox = c[0] - o[0], oy = c[1] - o[1], oz = c[2] - o[2]; const t = ox * d[0] + oy * d[1] + oz * d[2]; if (t < 0) return -1;
  const d2 = ox * ox + oy * oy + oz * oz - t * t; if (d2 > r * r) return -1; return t - Math.sqrt(r * r - d2); }
function rayCyl(o, d, cx, cz, r, y0, y1) { const fx = o[0] - cx, fz = o[2] - cz; const a = d[0] * d[0] + d[2] * d[2]; if (a < 1e-9) return -1;
  const b = 2 * (fx * d[0] + fz * d[2]), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); if (t < 0) return -1; const y = o[1] + d[1] * t; return y >= y0 && y <= y1 ? t : -1; }
const ang = a => Math.atan2(Math.sin(a), Math.cos(a));

function arenaR(m) { const t = m.time - ROYALE.shrinkAt; if (t <= 0) return ROYALE.R0; return Math.max(ROYALE.Rmin, ROYALE.R0 - (ROYALE.R0 - ROYALE.Rmin) * Math.min(1, t / ROYALE.shrinkDur)); }
function spawnPos(team, idx) { const [sx] = SPAWNS[team]; return { x: sx * 9, z: (idx ? 2.5 : -2.5) }; }
function newGoat(m, id) { const a = m.rand() * Math.PI * 2, r = 3 + m.rand() * 4; return { id, x: Math.cos(a) * r, z: Math.sin(a) * r, ry: m.rand() * 6.28, state: 'free', team: -1, rider: 0, hp: 0, life: 0, wind: 0, cd: 0, wx: 0, wz: 0, wt: 0, respawn: 0 }; }

function makePS(p, idx) {
  const ammo = {}; for (const k in RWEAPONS) ammo[k] = RWEAPONS[k].mag; const s = spawnPos(p.team, idx);
  return { id: p.id, team: p.team, idx, x: s.x, z: s.z, y: 0, yaw: p.team ? Math.PI / 2 : -Math.PI / 2, pitch: 0, w: 'blaster', cr: false,
    ammo, reloadUntil: 0, reloadW: 'blaster', lastShot: {}, lastInT: 0, correct: true,
    lives: ROYALE.lives, wucht: 0, kbT: 0, vx: 0, vz: 0, prot: ROYALE.protect, fallT: 0, out: false, mount: 0, rideT: 0,
    kos: 0, falls: 0, hits: 0, shots: 0, rejects: {}, speedRejects: 0, lastHitBy: 0, transforms: 0 };
}
function reject(ps, why) { ps.rejects[why] = (ps.rejects[why] || 0) + 1; }
const alivePS = m => [...m.players.values()].filter(ps => !ps.out);

function dismount(m, ps) { if (!ps.mount) return; const g = m.goats.find(x => x.id === ps.mount); if (g && g.state === 'ridden') { g.state = 'free'; g.rider = 0; } else if (g && g.state === 'special') g.rider = 0; ps.mount = 0; ps.rideT = 0; }
function knock(m, ps, dx, dz, power, wucht, by) {
  if (ps.out || ps.fallT > 0 || ps.prot > 0) return false;
  ps.wucht += wucht; const l = Math.hypot(dx, dz) || 1, k = power * (1 + ps.wucht / 100);
  ps.vx += dx / l * k; ps.vz += dz / l * k; ps.kbT = ROYALE.kbTime; ps.lastHitBy = by;
  // Rückstoß wirft vom Reittier (Gegenmittel), außer man sitzt auf der eigenen Kampfziege
  const g = ps.mount && m.goats.find(x => x.id === ps.mount); if (g && g.state === 'ridden') dismount(m, ps);
  return true;
}
function fall(m, ps) {
  if (ps.fallT > 0 || ps.out) return;
  const g = ps.mount && m.goats.find(x => x.id === ps.mount); if (g && g.state === 'special') { g.state = 'free'; g.team = -1; g.rider = 0; g.respawn = 3; } dismount(m, ps);
  ps.lives--; ps.falls++; ps.fallT = ROYALE.respawn; ps.kbT = 0; ps.vx = ps.vz = 0;
  const killer = ps.lastHitBy && m.players.get(ps.lastHitBy); if (killer && killer.team !== ps.team) killer.kos++;
  m.ev.push({ k: 'fall', id: ps.id, lives: ps.lives, by: killer && killer.team !== ps.team ? killer.id : 0 });
  if (ps.lives <= 0) { ps.out = true; m.ev.push({ k: 'out', id: ps.id }); }
}
function respawn(m, ps) { const s = spawnPos(ps.team, ps.idx), R = arenaR(m) * 0.6, l = Math.hypot(s.x, s.z) || 1, f = Math.min(1, R / l);
  ps.x = s.x * f; ps.z = s.z * f; ps.wucht = 0; ps.prot = ROYALE.protect; ps.correct = true; ps.lastHitBy = 0; m.ev.push({ k: 'respawn', id: ps.id }); }

function shot(m, p, ps, msg) {
  if (m.phase !== 'play') return reject(ps, 'phase');
  if (ps.out || ps.fallT > 0) return reject(ps, 'dead');
  const W = RWEAPONS[msg.w]; if (!W) return reject(ps, 'weapon');
  const t = m.time;
  if (ps.reloadUntil && t < ps.reloadUntil) return reject(ps, 'reload');
  if (ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = RWEAPONS[ps.reloadW].mag; ps.reloadUntil = 0; }
  if (ps.ammo[msg.w] <= 0) return reject(ps, 'ammo');
  if (t - (ps.lastShot[msg.w] ?? -9) < W.cd * 0.7) return reject(ps, 'rate');
  const o = msg.o, d = msg.d; if (!Array.isArray(o) || !Array.isArray(d) || o.length !== 3 || d.length !== 3 || ![...o, ...d].every(Number.isFinite)) return reject(ps, 'bad');
  if (Math.hypot(o[0] - ps.x, o[2] - ps.z) > 2.2 || o[1] < 0.3 || o[1] > 4.5) return reject(ps, 'origin');
  const dl = Math.hypot(d[0], d[1], d[2]); if (dl < 0.5) return reject(ps, 'bad'); const dn = [d[0] / dl, d[1] / dl, d[2] / dl];
  ps.ammo[msg.w]--; ps.lastShot[msg.w] = t; ps.shots++;
  const hitsP = new Map(), hitsG = new Map();
  for (let i = 0; i < W.pellets; i++) {
    let dir = dn; if (W.spread) { dir = [dn[0] + (m.rand() - 0.5) * 2 * W.spread, dn[1] + (m.rand() - 0.5) * 2 * W.spread, dn[2] + (m.rand() - 0.5) * 2 * W.spread]; const l = Math.hypot(...dir); dir = dir.map(v => v / l); }
    let best = null;
    for (const q of m.players.values()) { if (q === ps || q.out || q.fallT > 0) continue; const yb = q.mount ? 0.7 : 0;
      const th = raySphere(o, dir, [q.x, yb + q.y + 1.65, q.z], 0.32); const tb = rayCyl(o, dir, q.x, q.z, ROYALE.playerR, yb + q.y, yb + q.y + 1.5);
      const tt = th >= 0 && (tb < 0 || th < tb) ? th : tb; if (tt >= 0 && tt <= W.range && (!best || tt < best.t)) best = { t: tt, q, head: th >= 0 && tt === th }; }
    for (const g of m.goats) { if (g.state === 'gone' || g.state === 'ridden') continue; /* gerittene Ziege: Treffer gehen an den Reiter */ const tg = rayCyl(o, dir, g.x, g.z, 0.6, 0, 1.6); if (tg >= 0 && tg <= W.range && (!best || tg < best.t)) best = { t: tg, g }; }
    if (!best) continue;
    if (best.q) hitsP.set(best.q, (hitsP.get(best.q) || 0) + (best.head ? 1.5 : 1)); else hitsG.set(best.g, (hitsG.get(best.g) || 0) + 1);
  }
  for (const [q, n] of hitsP) {
    if (q.team === ps.team) continue; // kein Eigenbeschuss
    if (q.prot > 0) { m.ev.push({ k: 'shield', id: q.id, by: p.id }); continue; }
    const falloff = msg.w === 'shotgun' ? Math.max(0.35, 1 - Math.hypot(q.x - ps.x, q.z - ps.z) / W.range) : 1;
    if (knock(m, q, q.x - ps.x, q.z - ps.z, W.kb * n * falloff, W.wucht * n * falloff, p.id)) { ps.hits++; m.ev.push({ k: 'phit', id: q.id, by: p.id, w: +q.wucht.toFixed(1), head: n > 1 && W.pellets === 1 }); }
  }
  for (const [g, n] of hitsG) {
    if (g.state === 'special') { if (g.team === ps.team) continue; g.hp -= W.goatDmg * n; m.ev.push({ k: 'ghit', g: g.id, by: p.id, hp: +Math.max(0, g.hp).toFixed(1) });
      if (g.hp <= 0) { const r = m.players.get(g.rider); if (r) { r.mount = 0; r.rideT = 0; r.correct = true; } g.state = 'free'; g.team = -1; g.rider = 0; g.respawn = 4; ps.kos++; m.ev.push({ k: 'gdown', g: g.id, by: p.id }); } }
    else if (g.state === 'free') { const l = Math.hypot(g.x - ps.x, g.z - ps.z) || 1; g.x += (g.x - ps.x) / l * 0.4 * n; g.z += (g.z - ps.z) / l * 0.4 * n; m.ev.push({ k: 'ghit', g: g.id, by: p.id }); }
  }
}

function stepGoats(m, dt) {
  const R = arenaR(m);
  for (const g of m.goats) {
    if (g.respawn > 0) { g.respawn -= dt; if (g.respawn <= 0) { Object.assign(g, newGoat(m, g.id)); m.ev.push({ k: 'gspawn', g: g.id }); } else { g.state = 'gone'; } continue; }
    if (g.state === 'free') {
      g.wt -= dt; if (g.wt <= 0) { const a = m.rand() * Math.PI * 2, r = m.rand() * (R - 3); g.wx = Math.cos(a) * r; g.wz = Math.sin(a) * r; g.wt = 3 + m.rand() * 4; }
      const dx = g.wx - g.x, dz = g.wz - g.z, d = Math.hypot(dx, dz); if (d > 0.3) { g.x += dx / d * 1.1 * dt; g.z += dz / d * 1.1 * dt; g.ry = Math.atan2(dx, dz); }
      const r = Math.hypot(g.x, g.z); if (r > R - 1.5) { g.x *= (R - 1.5) / r; g.z *= (R - 1.5) / r; g.wt = 0; }
    } else if (g.state === 'ridden') {
      const ps = m.players.get(g.rider); if (!ps || ps.mount !== g.id) { g.state = 'free'; g.rider = 0; continue; }
      g.x = ps.x; g.z = ps.z; g.ry = ps.yaw + Math.PI;
      ps.rideT += dt;
      if (ps.rideT >= ROYALE.rideToTransform && !m.goats.some(o => o.state === 'special' && o.team === ps.team)) {
        g.state = 'special'; g.team = ps.team; g.hp = ROYALE.specialHp; g.life = ROYALE.specialLife; g.cd = 1; g.wind = 0; ps.transforms++;
        m.ev.push({ k: 'transform', g: g.id, id: ps.id, team: ps.team });
      }
    } else if (g.state === 'special') {
      g.life -= dt; g.cd -= dt;
      const rider = m.players.get(g.rider);
      if (g.life <= 0) { if (rider) { rider.mount = 0; rider.rideT = 0; rider.correct = true; } g.state = 'free'; g.team = -1; g.rider = 0; g.respawn = 3; m.ev.push({ k: 'gexpire', g: g.id }); continue; }
      // Ziel: nächster verwundbarer Gegner
      let tgt = null, td = 1e9; for (const q of m.players.values()) { if (q.team === g.team || q.out || q.fallT > 0) continue; const d = Math.hypot(q.x - g.x, q.z - g.z); if (d < td) { td = d; tgt = q; } }
      if (g.wind > 0) { g.wind -= dt; if (g.wind <= 0) { // Tritt mit den Hinterbeinen: Kegel hinter der Ziege
          const bx = -Math.sin(g.ry), bz = -Math.cos(g.ry); let hit = 0;
          for (const q of m.players.values()) { if (q.team === g.team || q.out || q.fallT > 0) continue; const dx = q.x - g.x, dz = q.z - g.z, d = Math.hypot(dx, dz);
            if (d <= ROYALE.kickRange && Math.acos(Math.max(-1, Math.min(1, (dx * bx + dz * bz) / (d || 1)))) <= ROYALE.kickCone / 2 + (d < 1 ? 1 : 0)) { if (knock(m, q, dx || bx, dz || bz, ROYALE.kickKb, ROYALE.kickWucht, g.rider)) { hit++; m.ev.push({ k: 'kicked', id: q.id, g: g.id }); } } }
          m.ev.push({ k: 'kick', g: g.id, hit }); g.cd = ROYALE.kickCd; } }
      else if (tgt) {
        const dx = tgt.x - g.x, dz = tgt.z - g.z, d = Math.hypot(dx, dz) || 1;
        // rückwärts laufen: das Hinterteil zeigt zum Ziel, der Kopf weg davon
        g.ry = Math.atan2(-dx, -dz);
        if (d > ROYALE.kickRange * 0.75) { g.x += dx / d * 3.4 * dt; g.z += dz / d * 3.4 * dt; }
        else if (g.cd <= 0) { g.wind = ROYALE.windup; m.ev.push({ k: 'windup', g: g.id, t: ROYALE.windup }); }
      }
      const r = Math.hypot(g.x, g.z); if (r > R - 1) { g.x *= (R - 1) / r; g.z *= (R - 1) / r; }
      if (rider && rider.mount === g.id) { rider.x = g.x; rider.z = g.z; }
    }
  }
}

export const royale = {
  id: 'royale', name: 'GOAT ROYALE',
  create(room) {
    const m = { room, seed: room.seed, rand: rng(room.seed ^ 0x2b7e1516), time: 0, phase: 'countdown', phaseT: ROYALE.countdown, players: new Map(), goats: [], ev: [], over: false, endReason: '' };
    for (const p of room.players) m.players.set(p.id, makePS(p, room.players.filter(x => x.team === p.team).indexOf(p)));
    for (let i = 1; i <= ROYALE.goats; i++) m.goats.push(newGoat(m, i));
    return m;
  },
  onRejoin(m, p) { const ps = m.players.get(p.id); if (ps) ps.correct = true; },
  onLeave(m, p) { const ps = m.players.get(p.id); if (ps) { dismount(m, ps); ps.out = true; ps.lives = 0; m.ev.push({ k: 'out', id: ps.id }); } },
  onMsg(m, p, msg) {
    const ps = m.players.get(p.id); if (!ps) return;
    if (msg.t === 'in') {
      const t = m.time, dt = Math.min(0.5, Math.max(0.05, t - ps.lastInT)); ps.lastInT = t;
      const fin = v => Number.isFinite(+v) ? +v : 0; ps.yaw = fin(msg.yaw); ps.pitch = Math.max(-1.6, Math.min(1.6, fin(msg.pitch))); ps.cr = !!msg.cr;
      if (RWEAPONS[msg.w]) ps.w = msg.w;
      // Während Rückstoß, Absturz oder auf der Kampfziege bestimmt der Server die Position
      if (ps.out || ps.fallT > 0 || ps.kbT > 0 || (ps.mount && m.goats.find(g => g.id === ps.mount)?.state === 'special')) return;
      const x = +msg.x, z = +msg.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const maxD = 11 * (ps.mount ? 1.4 : 1) * 1.3 * dt + 0.6;
      let nx = x, nz = z; const d = Math.hypot(x - ps.x, z - ps.z);
      if (d > maxD) { nx = ps.x + (x - ps.x) / d * maxD; nz = ps.z + (z - ps.z) / d * maxD; ps.correct = true; ps.speedRejects++; }
      ps.x = nx; ps.z = nz; ps.y = Math.max(0, Math.min(2, +msg.y || 0));
    }
    else if (msg.t === 'shot') shot(m, p, ps, msg);
    else if (msg.t === 'reload') { const W = RWEAPONS[msg.w]; if (W && !ps.reloadUntil && ps.ammo[msg.w] < W.mag) { ps.reloadUntil = m.time + W.reload * 0.9; ps.reloadW = msg.w; } }
    else if (msg.t === 'mount') {
      if (m.phase !== 'play' || ps.out || ps.fallT > 0 || ps.kbT > 0) return reject(ps, 'mount');
      if (ps.mount) { const g = m.goats.find(x => x.id === ps.mount); if (g && g.state === 'special') return reject(ps, 'mount'); dismount(m, ps); ps.correct = true; m.ev.push({ k: 'dismount', id: ps.id }); return; }
      let best = null, bd = ROYALE.mountDist; for (const g of m.goats) { if (g.state !== 'free') continue; const d = Math.hypot(g.x - ps.x, g.z - ps.z); if (d < bd) { bd = d; best = g; } }
      if (!best) return reject(ps, 'mount');
      best.state = 'ridden'; best.rider = ps.id; ps.mount = best.id; ps.rideT = 0; ps.x = best.x; ps.z = best.z; ps.correct = true; m.ev.push({ k: 'mount', id: ps.id, g: best.id });
    }
  },
  tick(m, dt) {
    if (m.over) return;
    if (m.phase === 'countdown') { m.phaseT -= dt; if (m.phaseT <= 0) { m.phase = 'play'; m.time = 0; m.ev.push({ k: 'go' }); } return; }
    m.time += dt; const R = arenaR(m);
    if (m.time >= ROYALE.shrinkAt && m.time - dt < ROYALE.shrinkAt) m.ev.push({ k: 'shrink' });
    for (const ps of m.players.values()) {
      if (ps.out) continue;
      if (ps.prot > 0) ps.prot = Math.max(0, ps.prot - dt);
      if (ps.fallT > 0) { ps.fallT -= dt; if (ps.fallT <= 0) { ps.fallT = 0; respawn(m, ps); } continue; }
      if (ps.kbT > 0) { ps.kbT -= dt; ps.x += ps.vx * dt; ps.z += ps.vz * dt; const f = Math.exp(-3.2 * dt); ps.vx *= f; ps.vz *= f; if (ps.kbT <= 0) { ps.vx = ps.vz = 0; ps.correct = true; } }
      if (Math.hypot(ps.x, ps.z) > R + 0.35) fall(m, ps);
    }
    stepGoats(m, dt);
    // Sieg: nur noch ein Team mit Spielern im Rennen, oder Zeit abgelaufen
    const teamsIn = new Set(alivePS(m).map(ps => ps.team));
    if (m.players.size && teamsIn.size <= 1 && [...m.players.values()].some(ps => ps.out)) { m.over = true; m.endReason = teamsIn.size ? 'last' : 'draw'; }
    else if (m.time >= ROYALE.maxTime) { m.over = true; m.endReason = 'time'; }
  },
  snapshot(m, p) {
    const ps = m.players.get(p.id); const t = m.time;
    if (ps && ps.reloadUntil && t >= ps.reloadUntil) { ps.ammo[ps.reloadW] = RWEAPONS[ps.reloadW].mag; ps.reloadUntil = 0; }
    const forced = ps && (ps.kbT > 0 || ps.fallT > 0 || (ps.mount && m.goats.find(g => g.id === ps.mount)?.state === 'special'));
    const snap = { t: 'snap', mode: 'royale', time: +t.toFixed(2), phase: m.phase, phaseT: +m.phaseT.toFixed(2), team: ps ? ps.team : p.team, arenaR: +arenaR(m).toFixed(2), maxTime: ROYALE.maxTime,
      players: [...m.players.values()].map(o => ({ id: o.id, team: o.team, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), yaw: +o.yaw.toFixed(3), pitch: +o.pitch.toFixed(3), w: o.w, cr: o.cr,
        lives: o.lives, wucht: Math.round(o.wucht), prot: o.prot > 0 ? 1 : 0, fall: o.fallT > 0 ? 1 : 0, out: o.out ? 1 : 0, mount: o.mount, kos: o.kos })),
      goats: m.goats.map(g => [g.id, +g.x.toFixed(2), +g.z.toFixed(2), +g.ry.toFixed(2), { free: 0, ridden: 1, special: 2, gone: 3 }[g.state] + (g.wind > 0 ? 2 : 0), g.team, +Math.max(0, g.hp).toFixed(1), ROYALE.specialHp]),
      ev: m.ev,
      you: ps ? { ammo: ps.ammo, reloading: !!ps.reloadUntil, ride: +ps.rideT.toFixed(2), mount: ps.mount, forced: forced ? { x: +ps.x.toFixed(2), z: +ps.z.toFixed(2) } : null, lives: ps.lives, wucht: Math.round(ps.wucht), out: ps.out, fall: ps.fallT > 0, kos: ps.kos } : null };
    if (ps && ps.correct) { snap.correct = { x: +ps.x.toFixed(2), z: +ps.z.toFixed(2) }; ps.correct = false; }
    return snap;
  },
  flush(m) { m.ev = []; },
  over(m) { return m.over; },
  results(m, room) {
    const T = [0, 1].map(team => { const ps = [...m.players.values()].filter(x => x.team === team);
      return { team, lives: ps.reduce((a, x) => a + Math.max(0, x.lives), 0), kos: ps.reduce((a, x) => a + x.kos, 0), falls: ps.reduce((a, x) => a + x.falls, 0), wucht: ps.reduce((a, x) => a + (x.out ? 0 : x.wucht), 0), survived: ps.some(x => !x.out) }; });
    let winner = null, reason = 'draw'; const [a, b] = T;
    if (a.survived !== b.survived) { winner = a.survived ? 0 : 1; reason = 'last'; }
    else if (a.lives !== b.lives) { winner = a.lives > b.lives ? 0 : 1; reason = 'lives'; }
    else if (a.kos !== b.kos) { winner = a.kos > b.kos ? 0 : 1; reason = 'kos'; }
    else if (Math.round(a.wucht) !== Math.round(b.wucht)) { winner = a.wucht < b.wucht ? 0 : 1; reason = 'wucht'; }
    const players = room.players.map(p => { const ps = m.players.get(p.id); return { id: p.id, name: p.name, team: p.team, kos: ps?.kos ?? 0, falls: ps?.falls ?? 0, hits: ps?.hits ?? 0, transforms: ps?.transforms ?? 0, lives: ps?.lives ?? 0 }; });
    return { mode: 'royale', winner, reason, time: +m.time.toFixed(1), teams: T, players };
  },
};
