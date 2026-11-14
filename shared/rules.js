// Gemeinsame Spielwerte: dieselben Zahlen wie im Einzelspieler (Server ist die Autorität).
export const WEAPONS = {
  blaster: { cd: 0.16, dmg: 1, pellets: 1, spread: 0, mag: 24, reload: 1.1, price: 0 },
  shotgun: { cd: 0.9, dmg: 0.55, pellets: 8, spread: 0.055, near: 7, far: 24, mag: 6, reload: 1.9, price: 80 },
  smg: { cd: 0.065, dmg: 0.7, pellets: 1, spread: 0, mag: 40, reload: 1.4, kidBonus: 1.5, price: 100 },
  rifle: { cd: 0.11, dmg: 1.3, pellets: 1, spread: 0, mag: 30, reload: 1.6, price: 120 },
  sniper: { cd: 1.1, dmg: 6, pellets: 1, spread: 0, headMult: 3, mag: 5, reload: 2.3, price: 150 },
};
export const TYPES = {
  normal: { s: 1, hp: 2, speed: 1.7, eat: 3, coins: 10, pts: 10 },
  kid: { s: 0.72, hp: 1, speed: 2.8, eat: 2, coins: 15, pts: 15 },
  bock: { s: 1.3, hp: 6, speed: 1.2, eat: 6, coins: 25, pts: 40 },
};
export const UPG = { dmg: { base: 40, grow: 1.5, max: 5 }, rate: { base: 35, grow: 1.5, max: 5 }, speed: { base: 30, grow: 1.5, max: 5 }, repair: { base: 30, step: 15, max: 99 } };
export const NADE = { price: 30, max: 4, start: 2, radius: 5.5, dmg: 7, fuse: 1.6, maxSpeed: 17 };
export const WALL = { build: 50, repair: 20, repairHp: 30, reinf: 75, reinfHp: 40, baseHp: 60, F: 5, HALF: 5.3, TH: 0.6, H: 1.25 };
export const ARENA = { playerR: 40, spawnR: 44, maxAlive: 14 };
export function upgPrice(id, n) { const u = UPG[id]; if (u.step != null) return u.base + u.step * n; return Math.round(u.base * Math.pow(u.grow, n) / 5) * 5; }

// Deterministischer Zufall: beide Teams bekommen exakt dieselben Wellen.
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function makeWave(wave, seed) {
  const r = rng(seed * 1000 + wave * 7919);
  let count = Math.min(24, 3 + wave * 2);
  const big = wave >= 3 && wave % 4 === 3; if (big) count = Math.min(32, Math.round(count * 1.6));
  const nf = wave < 3 ? 1 : 1 + Math.floor(r() * 3), base = r() * Math.PI * 2, fronts = [];
  for (let i = 0; i < nf; i++) fronts.push(base + i * (Math.PI * 2 / nf) + (r() - 0.5) * 0.6);
  const list = []; let t = 0.6;
  for (let i = 0; i < count; i++) {
    let type = 'normal'; const x = r();
    if (wave >= 3 && x < Math.min(0.35, 0.12 + wave * 0.02)) type = 'bock'; else if (wave >= 2 && x < 0.5) type = 'kid';
    const a = fronts[Math.floor(r() * fronts.length)] + (r() - 0.5) * 0.7;
    list.push({ t, type, a, sp: 0.85 + r() * 0.3 });
    t += Math.max(0.4, 1.5 - wave * 0.1) * (0.6 + r() * 0.8);
  }
  return { wave, big, fronts, list };
}

// ---------- V6.1 Kuchenkrieg-Arena: gemeinsame Welt, PvP, Werwölfe, Boost, 5 Wellen, Ziegenkönig ----------
// Globale Karte: Kuchen Käse bei z=+CZ, Kuchen Beere bei z=-CZ. Jede Teamwelt wird lokal um ihren Kuchen simuliert;
// lokal +z zeigt nach außen (vom Gegner weg). Team 1 ist um 180° gedreht – beide Teams sind exakt gespiegelt.
export const ARENA2 = { cz: 16, rx: 24, rz: 32, spawnR: 16, maxAlive: 14 };
export function toGlobal(team, lx, lz) { return team ? [-lx, -lz - ARENA2.cz] : [lx, lz + ARENA2.cz]; }
export function toLocal(team, gx, gz) { return team ? [-gx, -gz - ARENA2.cz] : [gx, gz - ARENA2.cz]; }
// Deckungen in der Mitte (global, punktsymmetrisch = fair): x, z, Breite (x), Tiefe (z), Höhe
export const COVERS = [
  { x: -7, z: 0, w: 3.2, d: 1.1, h: 1.5 }, { x: 7, z: 0, w: 3.2, d: 1.1, h: 1.5 },
  { x: 0, z: -4.5, w: 1.1, d: 2.4, h: 1.2 }, { x: 0, z: 4.5, w: 1.1, d: 2.4, h: 1.2 },
  { x: -15, z: -6, w: 2.2, d: 2.2, h: 1.8 }, { x: 15, z: 6, w: 2.2, d: 2.2, h: 1.8 },
  { x: -15, z: 6, w: 2.2, d: 2.2, h: 1.8 }, { x: 15, z: -6, w: 2.2, d: 2.2, h: 1.8 },
];
// Schaden gegen Spieler (100 Leben) und Werwölfe; Reichweiten begrenzt
export const PVP = { hp: 100, respawn: 4, protect: 3, killCoins: 20, killPts: 30, head: 1.5,
  dmg: { blaster: 9, shotgun: 6, smg: 6, rifle: 11, sniper: 55 }, range: { blaster: 60, shotgun: 20, smg: 45, rifle: 70, sniper: 120 }, wallDmg: 1.5 };
export const WOLF = { price: 60, max: 2, life: 30, cooldown: 15, hp: 50, speed: 5.2, range: 1.6, biteGoat: 2.5, bitePlayer: 18, cd: 0.9, guard: 13, fromWave: 3 };
export const BOOST = { cooldown: 6, dur: 0.8, maxY: 5.2, jumpY: 1.7 };
export const KING = { s: 2.2, hp: 40, speed: 0.95, eat: 4, chargeCd: 8, chargeWind: 1.0, chargeSpeed: 9, chargeDur: 1.3, chargeDmg: 30, tired: 2.2,
  stompCd: 6, stompWind: 0.8, stompR: 4.5, stompDmg: 20, headMult: 2.5, tiredMult: 2 };
export const WAVE_NAMES = ['Der Angriff', 'Die Herde', 'Werwolf-Chaos', 'Großangriff', 'Ziegenkönig'];
const WAVE5 = [ // Anzahl, Anteil Zicklein, Anteil Böcke, Angriffsfronten, Abstand (s), Tempo, Lebensfaktor – gemessen auf ca. 5–7 min pro Match
  { n: 12, kid: 0, bock: 0, fronts: 1, gap: 2.2, sp: 1, hp: 1 },
  { n: 18, kid: 0.4, bock: 0, fronts: 2, gap: 1.9, sp: 1.15, hp: 1 },
  { n: 20, kid: 0.3, bock: 0.2, fronts: 2, gap: 1.8, sp: 1.15, hp: 1.1 },
  { n: 28, kid: 0.3, bock: 0.3, fronts: 3, gap: 1.4, sp: 1.2, hp: 1.15 },
  { n: 16, kid: 0.5, bock: 0.15, fronts: 2, gap: 2.4, sp: 1.1, hp: 1.1, king: true },
];
// Deterministische Welle (lokal, nur Außenseite): beide Teams bekommen exakt dieselbe Liste
export function makeWave5(wave, seed, perTeam = 1) {
  const W = WAVE5[wave - 1], r = rng(seed * 1000 + wave * 7919), scale = 1 + 0.4 * (perTeam - 1);
  const lo = -0.35, hi = Math.PI + 0.35, fronts = [];
  for (let i = 0; i < W.fronts; i++) fronts.push(lo + (hi - lo) * ((i + 0.5) / W.fronts) + (r() - 0.5) * 0.4);
  const list = []; let t = 0.4; const n = Math.round(W.n * scale);
  if (W.king) { list.push({ t: 0.5, type: 'king', a: Math.PI / 2, sp: 1 }); t = 3; }
  for (let i = 0; i < n; i++) { const x = r(); const type = x < W.bock ? 'bock' : x < W.bock + W.kid ? 'kid' : 'normal';
    const a = Math.max(lo, Math.min(hi, fronts[Math.floor(r() * fronts.length)] + (r() - 0.5) * 0.6));
    list.push({ t, type, a, sp: (0.9 + r() * 0.2) * W.sp, hpM: W.hp }); t += W.gap / (1 + 0.2 * (perTeam - 1)) * (0.6 + r() * 0.8); }
  return { wave, name: WAVE_NAMES[wave - 1], fronts, list, king: !!W.king };
}
