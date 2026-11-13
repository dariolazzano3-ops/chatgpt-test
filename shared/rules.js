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
