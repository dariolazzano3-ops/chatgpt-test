// V7.1 KI-Gegner für den Käsekuchen-Raub. Bots sind normale Teilnehmer: Sie schicken dieselben Nachrichten wie Menschen
// (in, shot, boost, buy, use, melee, grab, dropcake), der Server prüft alles wie bei Menschen.
// Der KI-Wächter bekommt nur, was ein Verteidiger sehen könnte (api.perceive: Sichtfeld, Sichtweite, Mauern, Schwanz nur aus der Nähe).
// Entscheidungen 10× pro Sekunde, Bewegung jeden Takt (20/s). Deterministisch über einen eigenen Zufallsgenerator.
import { rng } from './rules.js';

// Schwierigkeit: dieselben Regeln für alle, nur Wahrnehmung, Reaktion, Genauigkeit, Taktik und Kaufentscheidungen unterscheiden sich
export const BOT = {
  def: {
    easy: { react: 0.75, aimErr: 0.075, sheepErr: 0.16, turn: 2.6, fov: 0.8, sight: 24, tailW: 0.45, suspect: 1.15, shop: 0, chase: 0.6, burst: 2 },
    normal: { react: 0.42, aimErr: 0.042, sheepErr: 0.1, turn: 4.5, fov: 0.95, sight: 30, tailW: 0.8, suspect: 0.8, shop: 1, chase: 0.85, burst: 4 },
    hard: { react: 0.24, aimErr: 0.024, sheepErr: 0.055, turn: 7, fov: 1.1, sight: 36, tailW: 1, suspect: 0.62, shop: 2, chase: 1, burst: 6 },
  },
  sheep: {
    easy: { observe: [6, 10], walkV: [2.2, 3.0], grazeT: [1, 3], openAngle: 0.7, openDist: 9, react: 0.9, items: 0, wait: 8, sloppy: 0.35, commitHp: 50 },
    normal: { observe: [10, 16], walkV: [1.0, 1.6], grazeT: [2, 6], openAngle: 1.2, openDist: 13, react: 0.5, items: 1, wait: 12, sloppy: 0.08, commitHp: 28 },
    hard: { observe: [14, 22], walkV: [0.9, 1.6], grazeT: [2, 7], openAngle: 1.5, openDist: 16, react: 0.28, items: 2, wait: 16, sloppy: 0, commitHp: 18 },
  },
};
const F = 5, HALF = 5.3, OMI = { x: 0, z: -34 };
const SIDE_N = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const ang = (a, b) => { let d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz)); // Spieler-Blickwinkel: vorwärts = (−sin, −cos)
const inFortP = (x, z, pad = 0) => Math.max(Math.abs(x), Math.abs(z)) < F - pad;

class Mover { // gemeinsame Fortbewegung: weich beschleunigen, bremsen, drehen, springen, klettern, nicht festhängen
  constructor(ps, R) { this.R = R; this.vx = 0; this.vz = 0; this.y = 0; this.vy = 0; this.yaw = ps.yaw || 0; this.pitch = 0; this.stuckT = 0; this.lx = ps.x; this.lz = ps.z; this.side = 0; this.climb = false; this.jumpQ = false; }
  steer(ps, tx, tz, speed, dt, accel = 16) {
    let dx = tx - ps.x, dz = tz - ps.z; const d = Math.hypot(dx, dz);
    if (this.side > 0) { this.side -= dt; const t = dx; dx = -dz * this.sideDir + dx * 0.3; dz = t * this.sideDir + dz * 0.3; } // Ausweichen
    const want = d < 0.25 ? 0 : Math.min(speed, d * 3), l = Math.hypot(dx, dz) || 1, wvx = dx / l * want, wvz = dz / l * want;
    const ax = wvx - this.vx, az = wvz - this.vz, al = Math.hypot(ax, az), k = Math.min(1, accel * dt / (al || 1));
    this.vx += ax * k; this.vz += az * k;
    const sp = Math.hypot(this.vx, this.vz); if (sp > 0.3) { const ty = Math.atan2(-this.vx, -this.vz); this.yaw += ang(ty, this.yaw) * Math.min(1, dt * 8); }
    // festgefahren? kurz seitlich ausweichen statt endlos gegen eine Mauer zu laufen
    this.stuckT += dt; if (this.stuckT > 1.2) { if (Math.hypot(ps.x - this.lx, ps.z - this.lz) < 0.35 && want > 0.5) { this.side = 0.8; this.sideDir = this.R() < 0.5 ? -1 : 1; } this.lx = ps.x; this.lz = ps.z; this.stuckT = 0; }
    return d;
  }
  vertical(dt, jumpV, climbRate, climbTop) { // Schwerkraft wie im Client (20 m/s²)
    if (this.climb && climbTop > 0) { if (this.y < climbTop) { this.y = Math.min(climbTop, this.y + climbRate * dt); this.vy = 0; return; } }
    if (this.jumpQ && this.y <= 0.001) { this.vy = jumpV; this.jumpQ = false; }
    if (this.y > 0 || this.vy > 0) { this.vy -= 20 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y === 0) this.vy = 0; }
  }
  sendIn(api, ps, dt, extra = {}) { const nx = ps.x + this.vx * dt, nz = ps.z + this.vz * dt;
    api.send({ t: 'in', c: ps.cseq, x: +nx.toFixed(3), z: +nz.toFixed(3), y: +this.y.toFixed(3), yaw: +this.yaw.toFixed(3), pitch: +this.pitch.toFixed(3), w: extra.w || 'blaster', ...extra }); }
}
// Weg um die Festung: führt die Strecke durch den Festungsbereich, geht es über eine Ecke, deren beide Teilstrecken frei sind (kein Hin- und Herpendeln)
function clear(ax, az, bx, bz) { for (let i = 1; i < 16; i++) { const f = i / 16, px = ax + (bx - ax) * f, pz = az + (bz - az) * f; if (Math.max(Math.abs(px), Math.abs(pz)) < F + 1.3) return false; } return true; }
function viaCorner(x, z, tx, tz) {
  if (inFortP(x, z, -1.3) || inFortP(tx, tz, -1.3) || clear(x, z, tx, tz)) return [tx, tz];
  const C = F + 2.6; let best = null, bd = 1e9;
  for (const [cx, cz] of [[C, C], [-C, C], [C, -C], [-C, -C]]) { const d0 = Math.hypot(cx - x, cz - z); if (d0 < 0.6) continue; if (!clear(x, z, cx, cz)) continue;
    const s = d0 + Math.hypot(tx - cx, tz - cz) + (clear(cx, cz, tx, tz) ? 0 : 30); if (s < bd) { bd = s; best = [cx, cz]; } }
  return best || [tx, tz];
}

// =====================================================================================================
// KI-SCHAF: GRAZE → OBSERVE → PLAN → APPROACH → INFILTRATE → STEAL → ESCAPE → DELIVER (+ FLEE, HEAL, DISTRACT, WAIT)
// =====================================================================================================
class SheepBrain {
  constructor(diff, seed) { this.diff = diff; this.P = BOT.sheep[diff]; this.R = rng(seed); this.state = 'GRAZE'; this.t = 0; this.dec = 0; this.mv = null; this.goal = null; this.side = null; this.log = [];
    this.observeLeft = this.rnd(this.P.observe); this.hpSeen = 60; this.hurtT = -9; this.waitT = 0; this.boughtWave = -1; this.decoyUsed = 0; this.smokeAt = -99; this.stats = { states: {}, steals: 0, entries: 0, flee: 0, items: {} }; }
  rnd([a, b]) { return a + this.R() * (b - a); }
  set(s, why) { if (this.state === s) return; this.state = s; this.t = 0; if (s === 'FLEE') this.goal = null; this.stats.states[s] = (this.stats.states[s] || 0) + 1; if (this.log.length < 400) this.log.push([+this.now.toFixed(1), s, why || '']); }
  step(m, ps, dt, api) {
    this.now = m.time; if (!this.mv) this.mv = new Mover(ps, this.R);
    if (!ps.alive()) { if (this.state !== 'WAIT') this.set('WAIT', ps.waiting ? 'keine Leben' : 'tot'); this.mv.vx = this.mv.vz = 0; this.mv.y = 0; this.mv.climb = false; return; }
    if (this.state === 'WAIT') { this.set('GRAZE', 'respawn'); this.observeLeft = this.rnd(this.P.observe) * 0.6; this.goal = null; this.mv.lx = ps.x; this.mv.lz = ps.z; }
    if (ps.correct === false && Math.hypot(ps.x - (this.ex ?? ps.x), ps.z - (this.ez ?? ps.z)) > 0.5) { this.mv.vx *= 0.3; this.mv.vz *= 0.3; } // Server-Korrektur: abbremsen
    this.t += dt; this.dec -= dt;
    if (ps.hp < this.hpSeen - 0.5) this.hurtT = m.time; this.hpSeen = ps.hp;
    const carrying = m.cake.state === 'carried' && m.cake.by === ps.id;
    if (this.dec <= 0) { this.dec = 0.1; this.think(m, ps, api, carrying); }
    this.act(m, ps, dt, api, carrying);
  }
  // ---- Wahrnehmung (alles, was ein menschliches Schaf sieht: Verteidiger, Festung, Werwölfe, Kuchen) ----
  defenders(m) { return [...m.players.values()].filter(q => q.role === 'def' && !q.dead); }
  threat(m, ps) { // wie gefährlich ist es gerade? Nähe und Blickrichtung der Verteidiger
    let worst = 0, near = null;
    for (const q of this.defenders(m)) { const d = Math.hypot(q.x - ps.x, q.z - ps.z), a = Math.abs(ang(yawTo(q.x, q.z, ps.x, ps.z), q.yaw));
      const look = a < this.P.openAngle ? 1 - a / this.P.openAngle : 0, w = look * Math.max(0, 1 - d / 30) + Math.max(0, 1 - d / this.P.openDist) * 0.6;
      if (w > worst) { worst = w; near = { q, d, a }; } }
    return { worst, near };
  }
  aimedAtMe(m, ps) { for (const q of this.defenders(m)) { const d = Math.hypot(q.x - ps.x, q.z - ps.z); if (d < 26 && Math.abs(ang(yawTo(q.x, q.z, ps.x, ps.z), q.yaw)) < 0.12) return q; } return null; }
  sideRisk(m, k, ps) { // Mauerstärke, Fallen, Türme, Werwölfe, Verteidigerblick → Risiko je Seite
    const wl = m.fort.walls[k], jumpH = 1.6 + (ps.jumpUpg ? 1.1 : 0); let r = wl.lvl === 0 ? 0 : wallH(wl.lvl) <= jumpH - 0.2 ? 1 : 2.6 + wl.lvl * 0.5;
    if (wl.gate) r += 0.3; const [nx, nz] = SIDE_N[k], sx = nx * (F + 1.5), sz = nz * (F + 1.5);
    for (const b of m.fort.builds) { const d = Math.hypot(b.x - sx, b.z - sz); if (b.kind === 'spikes' && b.side === k) r += 3; if (b.kind === 'mine' && d < 5) r += 2; if (b.kind === 'tower' && d < 9) r += 1.2; }
    for (const f of m.wolves) if (!f.dead && Math.hypot(f.x - sx, f.z - sz) < 7) r += 2.5;
    for (const q of this.defenders(m)) { const d = Math.hypot(q.x - sx, q.z - sz), a = Math.abs(ang(yawTo(q.x, q.z, sx, sz), q.yaw)); r += Math.max(0, 1 - d / 14) * 2 + (a < 0.8 ? 1.5 : 0); }
    return r;
  }
  shop(m, ps, api) { // Einkaufen nach Münzen, Welle, Festung und Schwierigkeit
    const lvl = this.P.items, coins = ps.coins, inv = ps.inv, steelOrStone = Object.values(m.fort.walls).some(w => w.lvl >= 2);
    const buy = it => { api.send({ t: 'buy', item: it }); this.stats.items[it] = (this.stats.items[it] || 0) + 1; };
    if (lvl === 0) { if (coins >= 40 && !(inv.shield > 0)) buy('shield'); else if (coins >= 20 && !(inv.heal > 0)) buy('heal'); return; }
    if (steelOrStone && !ps.jumpUpg && coins >= 60) return buy('jump');
    if ((inv.smoke || 0) < lvl && coins >= 30) return buy('smoke');
    if (!(inv.heal > 0) && coins >= 20) return buy('heal');
    if (lvl >= 2 && !(inv.decoy > 0) && coins >= 35) return buy('decoy');
    if (lvl >= 2 && !(inv.camo > 0) && coins >= 45) return buy('camo');
    if (!(inv.shield > 0) && coins >= 40) return buy('shield');
    if (lvl >= 2 && !(inv.speed > 0) && coins >= 25) return buy('speed');
  }
  use(api, it) { api.send({ t: 'use', item: it }); this.stats.items['use_' + it] = (this.stats.items['use_' + it] || 0) + 1; }
  think(m, ps, api, carrying) {
    if (this.boughtWave !== m.wave || (m.phase === 'shop' && this.R() < 0.2)) { this.boughtWave = m.wave; this.shop(m, ps, api); }
    if (ps.hp < 30 && ps.inv.heal > 0) this.use(api, 'heal'); // HEAL
    const th = this.threat(m, ps), aimer = this.aimedAtMe(m, ps), exposed = ps.revealUntil > m.time || carrying || inFortP(ps.x, ps.z, -0.3);
    // FLEE: verletzt oder ins Visier genommen, während man auffällig ist (Reaktion je nach Schwierigkeit)
    // Am Kuchen und noch gesund: durchziehen (Schild zünden), statt beim ersten Treffer abzubrechen
    const commit = this.state === 'STEAL' && Math.hypot(ps.x - (m.cake.state === 'dropped' ? m.cake.x : 0), ps.z - (m.cake.state === 'dropped' ? m.cake.z : 0)) < 3.2 && ps.hp > this.P.commitHp;
    if (commit && (aimer || m.time - this.hurtT < 1.5) && ps.inv.shield > 0 && this.P.items >= 1 && !(ps.shield > 0)) this.use(api, "shield");
    if (!carrying && !commit && exposed && (m.time - this.hurtT < 1.5 || aimer) && this.state !== 'FLEE' && this.state !== 'GRAZE' && this.t > this.P.react) {
      this.set('FLEE', aimer ? 'im Visier' : 'getroffen'); this.stats.flee++;
      if (this.P.items >= 1 && ps.inv.smoke > (this.P.items >= 2 ? 1 : 0) && m.time - this.smokeAt > 6) { this.use(api, 'smoke'); this.smokeAt = m.time; } // Schwer: letzten Rauch für die Flucht aufheben
      if (this.P.items >= 2 && ps.inv.speed > 0) this.use(api, 'speed');
      const a = Math.atan2(ps.z, ps.x) + (this.R() - 0.5); this.goal = [Math.cos(a) * 22, Math.sin(a) * 22]; return; }
    if (carrying && this.state !== 'ESCAPE' && this.state !== 'DELIVER') { this.set('ESCAPE', 'Kuchen!'); this.stats.steals = (this.stats.steals || 0) + 1; }
    switch (this.state) {
      case 'GRAZE': case 'OBSERVE': {
        this.observeLeft -= 0.1;
        if (m.phase !== 'wave' && m.phase !== 'countdown' && m.phase !== 'overtime') { this.set('GRAZE', 'Pause'); break; }
        if (m.cake.state === 'dropped') { this.set('STEAL', 'Kuchen liegt'); break; }
        if (this.observeLeft <= 0) { this.set('PLAN', 'genug beobachtet'); break; }
        if (this.state === 'GRAZE' && this.observeLeft < this.rnd(this.P.observe) * 0.4) this.set('OBSERVE', 'Festung beobachten');
        break; }
      case 'PLAN': { // Zugang wählen: geringstes Risiko (leicht: grob, schwer: genau)
        const ks = Object.keys(SIDE_N).map(k => [k, this.sideRisk(m, k, ps) + (this.diff === 'easy' ? this.R() * 3 : this.diff === 'normal' ? this.R() * 1 : 0)]).sort((a, b) => a[1] - b[1]);
        this.side = ks[0][0]; const [nx, nz] = SIDE_N[this.side], lat = (this.R() - 0.5) * 5;
        this.stage = [nx * (F + 4) + (nz ? lat : 0), nz * (F + 4) + (nx ? lat : 0)]; this.waitT = 0;
        if (this.P.items >= 1 && ps.inv.camo > 0 && th.near && th.near.d < 22) this.use(api, 'camo');
        this.set('APPROACH', 'Seite ' + this.side + ' Risiko ' + ks[0][1].toFixed(1)); break; }
      case 'APPROACH': { // unauffällig zum Bereitstellungsplatz, dann auf eine Lücke warten
        const d = Math.hypot(this.stage[0] - ps.x, this.stage[1] - ps.z);
        if (d < 1.2) { this.waitT += 0.1;
          const open = th.worst < 0.35 && !m.wolves.some(f => !f.dead && Math.hypot(f.x - this.stage[0], f.z - this.stage[1]) < 6);
          if (open || this.waitT > this.P.wait) {
            if (this.P.items >= 2 && ps.inv.decoy > 0 && th.near && th.near.d < 18 && !this.decoyUsed) { this.use(api, 'decoy'); this.decoyUsed = 1; } // DISTRACT
            if (ps.inv.shield > 0 && this.P.items >= 1) this.use(api, 'shield');
            if (this.P.items >= 2 && ps.inv.speed > 0) this.use(api, 'speed');
            this.set('INFILTRATE', open ? 'Lücke' : 'Geduld am Ende'); this.stats.entries++; }
          else if (this.diff === 'hard' && this.waitT > this.P.wait * 0.6 && this.R() < 0.02) { this.observeLeft = 3; this.set('GRAZE', 'zu riskant, neu planen'); } }
        break; }
      case 'INFILTRATE': if (inFortP(ps.x, ps.z, 0.3)) this.set('STEAL', 'drin'); else if (this.t > 9) { this.observeLeft = 4; this.set('GRAZE', 'abgebrochen'); } break;
      case 'STEAL': if (this.P.items >= 1 && ps.inv.smoke > 0 && m.cake.state === 'home' && Math.hypot(ps.x, ps.z) < 2.2 && m.time - this.smokeAt > 6 && this.defenders(m).some(q => Math.hypot(q.x, q.z) < 14)) { this.use(api, 'smoke'); this.smokeAt = m.time; } // Rauch über dem Kuchen, dann greifen
        if (m.cake.state === 'carried' && m.cake.by !== ps.id) { this.observeLeft = 4; this.set('GRAZE', 'Mitspieler trägt'); } if (this.t > 14) { this.observeLeft = 3; this.set('GRAZE', 'zu lange'); } break;
      case 'ESCAPE': if (!carrying) { this.observeLeft = 3; this.set(m.cake.state === 'dropped' ? 'STEAL' : 'GRAZE', 'Kuchen verloren'); break; }
        if (this.P.items >= 1 && ps.inv.smoke > 0 && th.near && th.near.d < 12 && m.time - this.smokeAt > 6) { this.use(api, 'smoke'); this.smokeAt = m.time; }
        if (!inFortP(ps.x, ps.z, -1.5) && Math.hypot(ps.x - OMI.x, ps.z - OMI.z) < 12) this.set('DELIVER', 'fast da');
        break;
      case 'DELIVER': if (!carrying) this.set('GRAZE', 'weg'); break;
      case 'FLEE': if (this.t > 4 && !this.aimedAtMe(m, ps)) { this.observeLeft = this.rnd(this.P.observe) * 0.7; this.set('GRAZE', 'abgetaucht'); } break;
    }
  }
  act(m, ps, dt, api, carrying) {
    const mv = this.mv, P = this.P, jumpBase = carrying ? 0.7 : 1.6 + (ps.jumpUpg ? 1.1 : 0), jumpV = Math.sqrt(2 * 20 * Math.max(0.4, jumpBase - 0.05));
    let tx = ps.x, tz = ps.z, speed = 0, sprint = false, em = null, climbTop = 0; mv.climb = false;
    const herdV = this.herdV || (this.herdV = this.rnd(P.walkV));
    switch (this.state) {
      case 'GRAZE': case 'OBSERVE': case 'WAIT': { // wie die Herde: grasen, ein Stück gehen, wieder grasen
        if (!this.goal || this.goalT <= 0) { const sloppy = this.R() < P.sloppy;
          if (this.R() < 0.55 && !sloppy) { this.goal = null; this.goalT = this.rnd(P.grazeT); } else {
            const bias = this.stage && this.state === 'OBSERVE' ? 0.4 : 0; const a = Math.atan2(ps.z, ps.x) + (this.R() - 0.5) * 0.9, r = Math.min(30, Math.max(12, Math.hypot(ps.x, ps.z) + (this.R() - 0.5) * 6 - bias * 4));
            this.goal = [Math.cos(a) * r, Math.sin(a) * r]; this.goalT = 8; this.herdV = sloppy ? P.walkV[1] * 1.3 : this.rnd(P.walkV); } }
        this.goalT -= dt;
        if (this.goal) { [tx, tz] = viaCorner(ps.x, ps.z, this.goal[0], this.goal[1]); speed = this.herdV; if (Math.hypot(this.goal[0] - ps.x, this.goal[1] - ps.z) < 0.4) { this.goal = null; this.goalT = this.rnd(P.grazeT); } }
        else em = 'graze';
        if (inFortP(ps.x, ps.z, -0.4)) { const k = this.exitSide || (this.exitSide = this.pickExit(m, ps)); const [nx, nz] = SIDE_N[k]; tx = nx * (F + 3) + (nz ? ps.x * 0.3 : 0); tz = nz * (F + 3) + (nx ? ps.z * 0.3 : 0); speed = Math.max(speed, 2.2); em = null; } else this.exitSide = null;
        { const w = this.overWall(m, ps, tx, tz, jumpBase); tx = w.tx; tz = w.tz; climbTop = w.top; }
        break; }
      case 'PLAN': break;
      case 'APPROACH': [tx, tz] = viaCorner(ps.x, ps.z, this.stage[0], this.stage[1]); speed = this.diff === 'easy' ? 2.4 : 1.3; if (Math.hypot(this.stage[0] - ps.x, this.stage[1] - ps.z) < 1.2) { speed = 0; em = 'graze'; }
        { const w = this.overWall(m, ps, tx, tz, jumpBase); tx = w.tx; tz = w.tz; climbTop = w.top; } break;
      case 'INFILTRATE': case 'STEAL': {
        const cx = m.cake.state === 'dropped' ? m.cake.x : 0, cz = m.cake.state === 'dropped' ? m.cake.z : 0;
        [tx, tz] = inFortP(ps.x, ps.z, -0.4) || m.cake.state === 'dropped' && !inFortP(cx, cz, -0.5) ? [cx, cz] : this.wallApproach(m, ps);
        speed = 5; sprint = true;
        { const w = this.overWall(m, ps, tx, tz, jumpBase); tx = w.tx; tz = w.tz; climbTop = w.top; }
        if (this.state === 'STEAL' && Math.hypot(cx - ps.x, cz - ps.z) < 1.3) { speed = 0;
          const close = this.diff !== 'easy' && !m.smokes.some(s => Math.hypot(s.x - ps.x, s.z - ps.z) < s.r * 0.8) && this.defenders(m).some(q => Math.hypot(q.x - ps.x, q.z - ps.z) < 3.5);
          if (!close && !ps.grabbing) api.send({ t: 'grab', v: true }); else if (close && ps.grabbing) api.send({ t: 'grab', v: false }); }
        if (this.diff !== 'easy') for (const f of m.wolves) if (!f.dead && Math.hypot(f.x - ps.x, f.z - ps.z) < 1.8) { mv.yaw = yawTo(ps.x, ps.z, f.x, f.z); if (m.time - (ps.meleeAt ?? -9) >= 0.85) api.send({ t: 'melee' }); } // Werwolf wegstoßen (Abklingzeit wie beim Menschen)
        break; }
      case 'ESCAPE': case 'DELIVER': { // raus Richtung Omi (Nordmauer, wenn dort niemand steht), dann geradeaus
        const inside = inFortP(ps.x, ps.z, -0.4);
        if (inside) { const k = this.exitSide || (this.exitSide = this.pickExit(m, ps)); const [nx, nz] = SIDE_N[k]; tx = nx * (F + 3) + (nz ? ps.x * 0.3 : 0); tz = nz * (F + 3) + (nx ? ps.z * 0.3 : 0); }
        else { this.exitSide = null; [tx, tz] = viaCorner(ps.x, ps.z, OMI.x, OMI.z + 1);
          if (this.diff !== 'easy') for (const q of this.defenders(m)) { // steht ein Verteidiger auf dem Weg? Im Bogen ausweichen
            const dx = tx - ps.x, dz = tz - ps.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, along = (q.x - ps.x) * ux + (q.z - ps.z) * uz, lat = (q.x - ps.x) * uz - (q.z - ps.z) * ux;
            if (along > 0 && along < l && Math.abs(lat) < 9) { const sg = lat > 0 ? -1 : 1, off = this.diff === 'hard' ? 11 : 8; tx = ps.x + ux * Math.min(along, 6) + uz * sg * off; tz = ps.z + uz * Math.min(along, 6) - ux * sg * off; } } }
        speed = 3.3;
        { const w = this.overWall(m, ps, tx, tz, jumpBase); tx = w.tx; tz = w.tz; climbTop = w.top; }
        break; }
      case 'FLEE': { if (!this.goal) { if (inFortP(ps.x, ps.z, -0.4)) { const [nx, nz] = SIDE_N[this.pickExit(m, ps)]; this.goal = [nx * (F + 6) + (nz ? ps.x : 0), nz * (F + 6) + (nx ? ps.z : 0)]; } else this.goal = [ps.x * 1.5, ps.z * 1.5]; } const zig = Math.sin(m.time * 4) * 2.5; const gx = this.goal[0] + zig * Math.cos(m.time), gz = this.goal[1] + zig * Math.sin(m.time);
        [tx, tz] = viaCorner(ps.x, ps.z, gx, gz); speed = 7; sprint = true;
        { const w = this.overWall(m, ps, tx, tz, jumpBase); tx = w.tx; tz = w.tz; climbTop = w.top; }
        break; }
    }
    if (ps.y < mv.y - 0.05) { mv.y = ps.y; mv.vy = Math.min(mv.vy, 0); } // Server ist maßgeblich
    if (!mv.climb && mv.y > jumpBase - 0.2) for (const k in SIDE_N) { const lv = m.fort.walls[k].lvl; if (!lv) continue; const [nx, nz] = SIDE_N[k]; // oben auf der Mauer: festhalten statt abrutschen
      if (this.wallDist(ps, k) < 0.9 && Math.abs(nx ? ps.z : ps.x) <= HALF + 0.2) { mv.climb = true; climbTop = Math.max(climbTop, wallH(lv) + 0.35); } }
    if (carrying) { speed = Math.min(speed, 3.3); sprint = false; }
    if (ps.speedUntil > m.time && !carrying) speed *= 1.4;
    if (this.state !== 'STEAL' && ps.grabbing) api.send({ t: 'grab', v: false });
    mv.steer(ps, tx, tz, speed, dt, sprint ? 18 : 10);
    if (speed === 0) { mv.vx *= 0.8; mv.vz *= 0.8; }
    mv.vertical(dt, jumpV, carrying ? 0.6 : 1.25, mv.climb ? climbTop : 0);
    { const nx = ps.x + mv.vx * dt, nz = ps.z + mv.vz * dt, k = this.crossingWall(m, ps, nx, nz); // nie unterhalb der Kante durch die Mauer
      if (k && Math.min(mv.y, ps.y) < wallH(m.fort.walls[k].lvl) - 0.1) { if (SIDE_N[k][0]) mv.vx = 0; else mv.vz = 0; } }
    this.ex = ps.x + mv.vx * dt; this.ez = ps.z + mv.vz * dt;
    mv.sendIn(api, ps, dt, { sp: sprint ? 1 : 0, cl: mv.climb ? 1 : 0, em: em || undefined });
  }
  // Mauer zwischen hier und Ziel: anhalten (0,6 m), springen oder klettern, erst über der Kante weiter – nie gegen die Mauer drücken
  overWall(m, ps, tx, tz, jumpBase) { const mv = this.mv, k = this.crossingWall(m, ps, tx, tz); this.dbgW = k; if (!k) return { tx, tz, top: 0 };
    const h = wallH(m.fort.walls[k].lvl), d = this.wallDist(ps, k), [nx, nz] = SIDE_N[k], sgn = (nx ? tx * nx : tz * nz) > F ? -1 : 1; // Seite gegenüber dem Ziel halten (nie auf der Mauerebene pendeln)
    const hold = [nx ? nx * (F + sgn * 0.62) : ps.x, nz ? nz * (F + sgn * 0.62) : ps.z]; // Haltepunkt vor der Mauer
    if (ps.y < mv.y - 0.05) { mv.y = ps.y; mv.vy = Math.min(mv.vy, 0); } // Server ist maßgeblich (z. B. Kletterbegrenzung)
    if (ps.y >= h - 0.05) { if (d < 1.0 && h > jumpBase - 0.15) mv.climb = true; return { tx, tz, top: mv.climb ? h + 0.35 : 0 }; } // hoch genug: rüber (oben weiter festhalten)
    if (h <= jumpBase - 0.15) { if (d < 1.25 && mv.y < 0.02) mv.jumpQ = true; return d < 0.68 ? { tx: hold[0], tz: hold[1], top: 0 } : { tx, tz, top: 0 }; }
    if (d < 1.0) { mv.climb = true; return { tx: hold[0], tz: hold[1], top: h + 0.35 }; } // klettern (Haltepunkt 0,62 m liegt innerhalb der Reichweite)
    return { tx: hold[0], tz: hold[1], top: 0 }; }
  wallDist(ps, k) { const [nx, nz] = SIDE_N[k]; const a = nx ? ps.x * nx : ps.z * nz; return Math.abs(a - F); }
  crossingWall(m, ps, tx, tz) { // liegt eine stehende Mauer zwischen hier und dem Ziel?
    for (const k in SIDE_N) { const wl = m.fort.walls[k]; if (!wl.lvl) continue; const [nx, nz] = SIDE_N[k]; const pa = (nx ? ps.x * nx : ps.z * nz) - F, pb = (nx ? tx * nx : tz * nz) - F;
      if (Math.sign(pa) === Math.sign(pb)) continue; const f = pa / (pa - pb), c = nx ? ps.z + (tz - ps.z) * f : ps.x + (tx - ps.x) * f; if (Math.abs(c) <= HALF + 0.2) return k; }
    return null; }
  wallApproach(m, ps) { const k = this.side || 'S', [nx, nz] = SIDE_N[k], st = this.stage || [nx * (F + 4), nz * (F + 4)]; // senkrecht über die gewählte Mauer
    return [nx ? nx * (F - 2) : Math.max(-3, Math.min(3, st[0])), nz ? nz * (F - 2) : Math.max(-3, Math.min(3, st[1]))]; }
  pickExit(m, ps) { // geschätzte Zeit im Freien: Weg zur Omi + Kletterzeit (mit Kuchen halb so schnell) + Verteidiger in der Nähe
    const carrying = m.cake.state === 'carried' && m.cake.by === ps.id, jb = carrying ? 0.7 : 1.6 + (ps.jumpUpg ? 1.1 : 0), cr = carrying ? 0.65 : 1.3;
    let best = 'N', bs = 1e9; for (const k in SIDE_N) { const [nx, nz] = SIDE_N[k], ex = nx * (F + 3), ez = nz * (F + 3), h = wallH(m.fort.walls[k].lvl);
      let s = Math.hypot(ex - OMI.x, ez - OMI.z) / 3.3 + Math.max(0, h - jb + 0.15) / cr * (this.diff === 'easy' ? 0.2 : 1);
      for (const q of this.defenders(m)) s += Math.max(0, 1 - Math.hypot(q.x - ex, q.z - ez) / 10) * (this.diff === 'easy' ? 1 : 4);
      for (const b of m.fort.builds) if (b.kind === 'spikes' && b.side === k) s += 3; if (s < bs) { bs = s; best = k; } } return best; }
}
const wallH = l => [0, 1.3, 2.1, 2.8][l] || 0;

// =====================================================================================================
// KI-WÄCHTER: Zombies abwehren, Festung ausbauen, verdächtige Schafe beobachten, Dieb stoppen, Kuchen zurückholen
// =====================================================================================================
const DEF_PLAN = [ // [ab Welle, Artikel, Mindest-Schwierigkeit (0 leicht, 1 mittel, 2 schwer)]
  [1, 'watch', 2], [1, 'bell', 1], [2, 'smg', 1], [2, 'stone', 1], [2, 'tower', 1], [2, 'shotgun', 0], [3, 'stone', 0], [3, 'stone', 1], [3, 'spikes', 1], [3, 'tower', 2], [3, 'rate', 2],
  [4, 'rifle', 1], [4, 'stone', 1], [4, 'gun', 1], [4, 'mag', 2], [5, 'steel', 1], [5, 'gun', 2], [5, 'mine', 1], [5, 'dmg', 2], [6, 'steel', 1], [6, 'gun', 1], [6, 'tower', 1],
  [6, 'tower', 2], [7, 'steel', 1], [7, 'gun', 2], [7, 'mine', 2], [7, 'steel', 2], [7, 'spikes', 2], [7, 'dmg', 1], [8, 'gun', 2]];
class DefBrain {
  constructor(diff, seed) { this.diff = diff; this.P = BOT.def[diff]; this.R = rng(seed); this.state = 'GUARD'; this.t = 0; this.dec = 0; this.mv = null; this.mem = new Map(); this.target = null; this.reactT = 0; this.scanA = 0;
    this.plan = DEF_PLAN.filter(e => e[2] <= this.P.shop).map(e => ({ wave: e[0], item: e[1], done: false })); this.log = []; this.lastShot = {}; this.burst = 0; this.evBuf = [];
    this.stats = { shots: 0, goatShots: 0, sheepShots: 0, npcShots: 0, buys: {}, falseSuspects: 0, chases: 0, returns: 0, states: {} }; }
  set(s, why) { if (this.state === s) return; this.state = s; this.t = 0; this.stats.states[s] = (this.stats.states[s] || 0) + 1; if (this.log.length < 400) this.log.push([+this.now.toFixed(1), s, why || '']); }
  step(m, ps, dt, api) {
    this.now = m.time; if (!this.mv) this.mv = new Mover(ps, this.R);
    if (ps.dead) { this.mv.vx = this.mv.vz = 0; this.mv.y = 0; this.target = null; return; }
    this.t += dt; this.dec -= dt;
    for (const e of m.ev) if ((e.k === 'butt' || (e.k === 'sheephit' && e.by < 0)) && e.sid != null) this.evBuf.push(e.sid); // sichtbare Kampfspuren merken
    if (this.dec <= 0) { this.dec = 0.1; this.see = api.perceive(ps, { fov: this.P.fov, sight: this.P.sight, yaw: this.mv.yaw }); this.think(m, ps, api); }
    this.act(m, ps, dt, api);
  }
  // Verdacht je Schaf-ID aus wahrnehmbaren Hinweisen: Schwanz, Tempo, Festungsnähe, Kampf, Kuchen
  suspicion(m, ps) {
    const now = m.time;
    for (const r of this.see) { let e = this.mem.get(r.sid); if (!e) { e = { s: 0, x: r.x, z: r.z, t: now, v: 0 }; this.mem.set(r.sid, e); }
      const dt = Math.max(0.05, now - e.t), v = Math.hypot(r.x - e.x, r.z - e.z) / dt; e.v = e.v * 0.7 + v * 0.3; e.x = r.x; e.z = r.z; e.t = now; e.seen = now;
      if (r.tail) e.s += this.P.tailW * 0.35; // schwarzer Schwanz gesehen
      if (e.v > 2.6 && r.anim !== 3 && r.anim !== 4) e.s += 0.04; // rennt ohne Grund (Herde flieht nur vor Zombies)
      if (Math.max(Math.abs(r.x), Math.abs(r.z)) < F + 1.5) e.s += 0.25; // an oder in der Festung
      if (r.carry) e.s = 10; // trägt sichtbar den Kuchen
    }
    for (const sid of this.evBuf) { const x = this.mem.get(sid); if (x && this.see.some(r => r.sid === sid)) x.s += 1.5; } this.evBuf = [];
    for (const [sid, e] of this.mem) { e.s = Math.max(0, e.s - 0.012); if (now - (e.seen || 0) > 25) this.mem.delete(sid); }
  }
  shop(m, ps, api) {
    const fo = m.fort, coins = fo.coins, buy = it => { api.send({ t: 'buy', item: it }); this.stats.buys[it] = (this.stats.buys[it] || 0) + 1; };
    // Reparieren/Wiederaufbau zuerst
    for (const k in fo.walls) { const w = fo.walls[k]; if (!w.lvl && coins >= 40) return buy('wood'); if (w.lvl && w.hp / w.maxHp < (this.diff === 'easy' ? 0.35 : 0.6) && coins >= 20) return api.send({ t: 'buy', item: 'repair', side: k }); }
    if (m.cake.hp < 60 && coins >= 50 && this.P.shop >= 1) return buy('cake');
    // Werwolf: Zombies am Kuchen oder ein Dieb in der Nähe
    const nearGoats = m.goats.filter(g => Math.hypot(g.x, g.z) < 9).length;
    if (m.wave >= 3 && coins >= 60 && (nearGoats >= (this.diff === 'easy' ? 5 : 3) || m.cake.state !== 'home' || (m.final && this.P.shop >= 1)) && m.wolves.filter(f => !f.dead).length < 2 && m.time >= fo.wolfReadyAt) return buy('wolf');
    const reserve = m.wave >= 6 && this.P.shop >= 2 ? 0 : 20; // schwer: spart nicht mehr kurz vor dem Finale
    for (const e of this.plan) { if (e.done || e.wave > m.wave + (m.phase !== 'wave' ? 1 : 0)) continue; const price = { watch: 50, bell: 35, smg: 100, stone: 70, tower: 80, shotgun: 80, spikes: 25, rifle: 120, gun: 120, steel: 110, mine: 40, rate: 40, dmg: 45, mag: 60 }[e.item] || 50;
      if (coins >= price + reserve * (e.wave < m.wave ? 0 : 1)) { e.done = true; return buy(e.item); } break; }
  }
  think(m, ps, api) {
    this.suspicion(m, ps);
    if (m.phase === 'shop' || this.R() < 0.15) this.shop(m, ps, api);
    const cake = m.cake, carrier = this.see.find(r => r.carry);
    // 1) Dieb mit Kuchen gesehen → verfolgen und schießen
    if (cake.state === 'carried') { if (this.state !== 'CHASE') { this.set('CHASE', 'Kuchen gestohlen'); this.stats.chases++; }
      if (carrier) { this.target = { kind: 'sheep', sid: carrier.sid, x: carrier.x, z: carrier.z, y: 0.8 }; this.lastSeen = [carrier.x, carrier.z]; }
      else { this.target = null; // ungesehen: zur letzten Sichtung; mittel/schwer denken an die Omi (sie steht für alle sichtbar), leicht sucht planlos
        const omiGuess = [OMI.x * 0.6, OMI.z * 0.6];
        if (!this.lastSeen) this.lastSeen = this.P.shop >= 1 ? omiGuess : [ps.x, ps.z];
        else if (Math.hypot(this.lastSeen[0] - ps.x, this.lastSeen[1] - ps.z) < 2) this.lastSeen = this.P.shop >= 1 ? omiGuess : [ps.x + (this.R() - 0.5) * 12, ps.z + (this.R() - 0.5) * 12]; } return; }
    this.lastSeen = null;
    // 2) Kuchen liegt im Gras → zurückholen
    if (cake.state === 'dropped') { this.set('RETURN', 'Kuchen liegt'); this.target = this.bestGoat(m, ps); return; }
    if (this.state === 'CHASE' || this.state === 'RETURN') { if (this.state === 'RETURN') this.stats.returns++; this.set('GUARD', 'Kuchen sicher'); }
    // 3) Verdächtiges Schaf → anvisieren, bei genug Verdacht schießen
    let sus = null, best = this.P.suspect; for (const r of this.see) { const e = this.mem.get(r.sid); if (e && e.s >= best) { best = e.s; sus = r; } }
    if (sus) { if (this.state !== 'HUNT') this.set('HUNT', 'Verdacht ' + best.toFixed(2)); this.target = { kind: 'sheep', sid: sus.sid, x: sus.x, z: sus.z, y: 0.8 }; return; }
    if (this.state === 'HUNT') this.set('GUARD', 'Verdacht weg');
    // 4) Zombies: die dem Kuchen am nächsten zuerst
    this.target = this.bestGoat(m, ps); this.set(this.target ? 'FIGHT' : 'GUARD', this.target ? 'Ziegen' : 'ruhig');
  }
  bestGoat(m, ps) { let best = null, bs = 1e9; for (const g of m.goats) { const d = Math.hypot(g.x - ps.x, g.z - ps.z); if (d > 34) continue;
      const a = Math.abs(ang(yawTo(ps.x, ps.z, g.x, g.z), this.mv.yaw)); if (a > this.P.fov * 1.6 && d > 6) continue; // hinter dem Rücken sieht er sie (noch) nicht
      const s = Math.hypot(g.x, g.z) + d * 0.4 + (g.type === 'king' ? -6 : 0); if (s < bs) { bs = s; best = g; } }
    return best ? { kind: 'goat', g: best, x: best.x, z: best.z, y: (best.type === 'king' ? 1.6 : 1.2) * best.s } : null; }
  act(m, ps, dt, api) {
    const mv = this.mv, P = this.P; let tx = 0, tz = 1.2, speed = 3.5, wantBoost = false;
    const tgt = this.target; if (tgt && tgt.kind === 'goat') { tgt.x = tgt.g.x; tgt.z = tgt.g.z; }
    if (tgt && tgt.kind === 'sheep') { const r = this.see.find(q => q.sid === tgt.sid); if (r) { tgt.x = r.x; tgt.z = r.z; } }
    // Bewegung je Zustand
    if (this.state === 'CHASE') { const [lx, lz] = tgt ? [tgt.x, tgt.z] : this.lastSeen; tx = lx; tz = lz; speed = 8 * P.chase; }
    else if (this.state === 'RETURN') { tx = m.cake.x; tz = m.cake.z; speed = 8; }
    else if (tgt && tgt.kind === 'goat') { const a = Math.atan2(tgt.z, tgt.x), r = this.diff === 'hard' ? 3.0 : 3.9; tx = Math.cos(a) * r; tz = Math.sin(a) * r; speed = 4; } // an die bedrohte Mauer (Zinnen), im Fort bleiben – der Rücken ist dann frei
    else if (tgt && tgt.kind === 'sheep') { const a = Math.atan2(tgt.z, tgt.x); tx = Math.cos(a) * 2.8; tz = Math.sin(a) * 2.8; speed = 3; }
    else { this.scanA += dt * 0.25; tx = Math.cos(this.scanA) * 2; tz = Math.sin(this.scanA) * 2; speed = 1.8; }
    // raus aus der Festung? Tor nutzen, sonst Boost-Sprung über die Mauer
    const outside = !inFortP(tx, tz, -0.2), inside = inFortP(ps.x, ps.z, 0);
    if (outside && inside) { const wk = sideOf(tx, tz), wl = m.fort.walls[wk];
      if (wl.lvl && wl.gate) { const [nx, nz] = SIDE_N[wk]; if (Math.abs(nx ? ps.x * nx - F : ps.z * nz - F) > 0.8) { tx = nx * F; tz = nz * F; } }
      else if (wl.lvl) { const [nx, nz] = SIDE_N[wk], wd = Math.abs((nx ? ps.x * nx : ps.z * nz) - F); if (wd < 1.0 && mv.y < 0.1) wantBoost = true; if (mv.y < wallH(wl.lvl) - 0.05 && wd < 0.9) { tx = ps.x; tz = ps.z; } } }
    if (!outside && !inside && Math.max(Math.abs(ps.x), Math.abs(ps.z)) > F) { const wk = sideOf(ps.x, ps.z), wl = m.fort.walls[wk]; if (wl.lvl && !wl.gate) { const wd = Math.abs((SIDE_N[wk][0] ? ps.x * SIDE_N[wk][0] : ps.z * SIDE_N[wk][1]) - F); if (wd < 1.0 && mv.y < 0.1) wantBoost = true; if (mv.y < wallH(wl.lvl) - 0.05 && wd < 0.9) { tx = ps.x; tz = ps.z; } } }
    if (wantBoost && m.time >= ps.boostReadyAt) { api.send({ t: 'boost' }); mv.boostT = 0.8; mv.vy = 7; mv.y = Math.max(mv.y, 0.01); }
    if (mv.boostT > 0) { mv.boostT -= dt; mv.vy = Math.min(7.5, mv.vy + 30 * dt); if (mv.y > 4.4) mv.vy = Math.min(mv.vy, 0.5); }
    mv.steer(ps, tx, tz, speed, dt, 18);
    // Zielen: menschliche Reaktionszeit, begrenzte Drehgeschwindigkeit, Streuung
    let fire = false;
    if (tgt) { const eyeY = ps.y + 1.55, dx = tgt.x - ps.x, dz = tgt.z - ps.z, d = Math.hypot(dx, dz), wy = yawTo(ps.x, ps.z, tgt.x, tgt.z), wp = Math.atan2(tgt.y - eyeY, d);
      if (this.lastTgt !== (tgt.g || tgt.sid)) { this.lastTgt = tgt.g || tgt.sid; this.reactT = P.react * (0.7 + this.R() * 0.6); }
      this.aimYaw = (this.aimYaw ?? mv.yaw) + Math.max(-P.turn * dt, Math.min(P.turn * dt, ang(wy, this.aimYaw ?? mv.yaw))); this.aimPitch = (this.aimPitch ?? 0) + (wp - (this.aimPitch ?? 0)) * Math.min(1, dt * 8);
      mv.yaw = this.aimYaw; mv.pitch = this.aimPitch; this.reactT -= dt;
      const onTarget = Math.abs(ang(wy, this.aimYaw)) < Math.max(0.03, 0.6 / Math.max(1, d));
      const range = tgt.kind === 'sheep' ? 45 : 34; fire = this.reactT <= 0 && onTarget && d < range;
      if (fire && tgt.kind === 'goat') for (const r of this.see) { // kein unschuldiges Schaf in der Schusslinie
        const t = ((r.x - ps.x) * dx + (r.z - ps.z) * dz) / (d * d); if (t > 0 && t < 1) { const px = ps.x + dx * t - r.x, pz = ps.z + dz * t - r.z; if (Math.hypot(px, pz) < 0.9) { fire = false; break; } } }
    } else { this.aimYaw = mv.yaw; this.aimPitch = 0; mv.pitch *= 0.9; }
    const w = this.weapon(ps, tgt);
    if (fire) { const W = api.WEAPONS[w], cd = W.cd / (1 + 0.15 * m.fort.upg.rate);
      if (ps.ammo[w] <= 0 || ps.reloadUntil > m.time) { if (!ps.reloadUntil) api.send({ t: 'reload', w }); }
      else if (m.time - (this.lastShot[w] ?? -9) >= cd * 1.05) { this.lastShot[w] = m.time;
        const e = tgt && tgt.kind === 'sheep' ? P.sheepErr : P.aimErr, ny = (this.R() + this.R() + this.R() - 1.5) * e, np = (this.R() + this.R() + this.R() - 1.5) * e * 0.7, yw = this.aimYaw + ny, pt = this.aimPitch + np, cp = Math.cos(pt);
        api.send({ t: 'shot', w, o: [+ps.x.toFixed(3), +(ps.y + 1.55).toFixed(3), +ps.z.toFixed(3)], d: [-Math.sin(yw) * cp, Math.sin(pt), -Math.cos(yw) * cp] });
        this.stats.shots++; if (tgt.kind === 'goat') this.stats.goatShots++; else this.stats.sheepShots++; } }
    mv.vertical(dt, 7, 0, 0);
    mv.sendIn(api, ps, dt, { w });
  }
  weapon(ps, tgt) { const d = tgt ? Math.hypot(tgt.x - ps.x, tgt.z - ps.z) : 10; const has = k => ps.owned.has(k) && (ps.ammo[k] > 0 || ps.reloadW === k);
    if (d < 7 && has('shotgun')) return 'shotgun'; if (has('rifle')) return 'rifle'; if (has('smg')) return 'smg'; return 'blaster'; }
}
const sideOf = (x, z) => Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'E' : 'W') : (z > 0 ? 'S' : 'N');

export function makeBrain(role, diff, seed) { return role === 'sheep' ? new SheepBrain(diff, seed) : new DefBrain(diff, seed); }
