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
export function upgPrice(id, n) { const u = UPG[id]; if (u.step != null) return u.base + u.step * n; return Math.round(u.base * Math.pow(u.grow, n) / 5) * 5; }

// Deterministischer Zufall (Wellen, Herde)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Ziegenkönig (Bosswerte, seit V6.1)
export const KING = { s: 2.2, hp: 40, speed: 0.95, eat: 4, chargeCd: 8, chargeWind: 1.0, chargeSpeed: 9, chargeDur: 1.3, chargeDmg: 30, tired: 2.2,
  stompCd: 6, stompWind: 0.8, stompR: 4.5, stompDmg: 20, headMult: 2.5, tiredMult: 2 };
export const BOOST = { cooldown: 6, dur: 0.8, maxY: 5.2, jumpY: 1.7 };

// ---------- V7 „Der große Käsekuchen-Raub“: asymmetrischer Kuchenkrieg ----------
// Team 0 = Kuchen-Verteidiger (Festung um den Kuchen bei 0/0), Team 1 = Schaf-Infiltratoren (getarnt in der Herde).
// Welt = Einzelspieler-Welt: Festung F=5, Zaun Radius 40. Die Omi sitzt außerhalb im Norden.
export const HEIST = {
  arenaR: 39, spawnR: 43, omi: { x: 0, z: -34, r: 2.6 }, herdIn: 11, herdOut: 33, npc: { '1': 16, '2': 22 },
  // V7.2: exakt 15 Schafe insgesamt (Schafspieler eingerechnet), keine Nachgeburten. Die Herde rückt Welle für Welle an die Festung (innen/außen, m).
  herdTotal: 15, herdBands: [[21, 34], [19, 32], [15, 28], [13, 25], [9.5, 20], [8.5, 18], [6.8, 15], [6.6, 13]],
  helper: { max: 3, pickR: 32, replaceCd: 8, cmdCd: 18, dur: { distract: 10, storm: 11, sabotage: 13 }, speed: { distract: 4.4, storm: 5.4, sabotage: 4.6 },
    buttCd: 1.4, buttDmg: 8, buttWolf: 10, buttBuild: 7, buttGate: 3, buttWall: 1.5, jumpV: 8.2 },
  wrongMax: 3, cakeBack: 0.35, // 4. unschuldiges Schaf → Sieg der Schafe · Kuchen auf dem Rücken: 65 % weniger Schussschaden von hinten
  sus: { sprint: 0.35, trot: 0.08, jump: 0.12, climb: 0.5, butt: 0.35, item: 0.25, fort: 0.6, still: 0.12, slow: 0.05, warn: 0.35, reveal: 0.75 },
  shopTime: 10, countdown: 3, startCoins: 40, sheepStartCoins: 40, waveCoins: 30, sheepWaveCoins: 20, aliveCoinEvery: 3,
  def: { hp: 100, respawn: 4, protect: 2 },
  sheep: { hp: 60, respawn: 3, protect: 2, walk: 5.2, sprint: 7.6, carry: 0.68, jumpY: 1.6, jumpUpg: 1.1, carryJumpY: 0.7, climbRate: 1.3, carryClimb: 0.8,
    meleeR: 2.1, meleeCd: 0.8, meleeDmg: 15, meleeWolf: 12, meleeWall: 5, meleeBuild: 8, revealT: 4, coinPerHit: 6 },
  npcSheep: { hp: 25, aimR: 24, aimT: 0.7, warnT: 1.0, chargeSpeed: 7.2, chargeT: 2.6, hitDmg: 12, calm: 5, killPenalty: 5, respawn: 10, flee: 3.2 },
  tail: { near: 17, watch: 32 }, // ab dieser Entfernung sieht der Verteidiger nur einen hellen Schwanz
  cake: { grabR: 1.7, grabT: 1.0, returnR: 1.7, autoReturn: 25, hp: 100, overtime: 20 },
  dmg: { blaster: 12, shotgun: 7, smg: 7, rifle: 14, sniper: 60 }, range: { blaster: 60, shotgun: 20, smg: 45, rifle: 70, sniper: 120 }, head: 1.5,
  boostCd: [6, 4],
};
// Leben des Schafspielers je Welle: Welle n → n Leben (nicht kaufbar)
export const sheepLives = wave => Math.max(1, Math.min(8, wave | 0));
// Schaf-Shop
export const SHEEP_SHOP = {
  shield: { price: 40, absorb: 40, dur: 20 }, jump: { price: 60, perm: true }, speed: { price: 25, dur: 3, mult: 1.55, cd: 8 },
  smoke: { price: 30, dur: 8, r: 5 }, decoy: { price: 35, dur: 8 }, camo: { price: 45, dur: 12 }, heal: { price: 20, hp: 35 },
};
// Verteidiger-Markt: Preis, ab Welle, Grenze
export const DEF_SHOP = {
  wood: { price: 40, wave: 1 }, stone: { price: 70, wave: 2 }, steel: { price: 110, wave: 4 }, repair: { price: 20, wave: 1 }, repairall: { price: 55, wave: 2 },
  gate: { price: 30, wave: 2 }, tower: { price: 80, wave: 2, max: 4, hp: 150, range: 20, dmg: 1.6, cd: 0.9, sheepDmg: 10 },
  watch: { price: 50, wave: 1, max: 1, hp: 120 }, spikes: { price: 25, wave: 1, max: 4, dps: 1.2, sheepDps: 10, slow: 0.5, dur: 60 },
  mine: { price: 40, wave: 3, max: 4, r: 4.5, dmg: 8, sheepDmg: 45 }, gun: { price: 120, wave: 4, max: 4, hp: 120, range: 16, dmg: 0.8, cd: 0.18 },
  ammo: { price: 30, wave: 1, max: 1, r: 2.6 }, bell: { price: 35, wave: 1, max: 1, r: 11, cd: 6 },
  motion: { price: 30, wave: 2, max: 4, r: 8, speed: 3.4, cd: 4 }, cakealarm: { price: 40, wave: 1, max: 1 },
  wolf: { price: 60, wave: 3 }, bot: { price: 50, wave: 2, max: 1, hp: 40, life: 45, rate: 3 },
  shotgun: { price: 80, wave: 1 }, smg: { price: 100, wave: 2 }, rifle: { price: 120, wave: 3 }, sniper: { price: 150, wave: 4 },
  dmg: { price: 45, wave: 1, max: 4, grow: 1.5 }, rate: { price: 40, wave: 1, max: 4, grow: 1.5 }, move: { price: 40, wave: 1, max: 1 },
  mag: { price: 60, wave: 2, max: 1 }, reload: { price: 50, wave: 2, max: 1 }, nades: { price: 30, wave: 1 }, boostcd: { price: 45, wave: 2, max: 1 }, fixer: { price: 40, wave: 2, max: 1 },
  cake: { price: 50, wave: 2 },
};
export const WALL7 = { wood: { hp: 60, h: 1.3 }, stone: { hp: 140, h: 2.1 }, steel: { hp: 240, h: 2.8 } }; // Stufe 1–3
export const WOLF7 = { max: 2, perWave: 3, life: 30, cooldown: 15, hp: 50, speed: 5.4, range: 1.6, biteGoat: 1.2, biteSheep: 16, cd: 0.9, guard: 9, patrol: 4.5 };
export const KING7 = { ...KING, hp: 55 };
export const WAVE_NAMES8 = ['Die ersten Ziegen', 'Die Herde erwacht', 'Werwolf-Alarm', 'Belagerung', 'Nacht der Zombies', 'Die Festung bebt', 'Der Ziegenkönig', 'Die Zombie-Apokalypse'];
const WAVE8 = [ // Anzahl, Zicklein, Böcke, Fronten (8 = alle Seiten), Abstand, Tempo, Lebensfaktor
  { n: 10, kid: 0, bock: 0, fronts: 1, gap: 1.7, sp: 1, hp: 1 },
  { n: 16, kid: 0.35, bock: 0, fronts: 2, gap: 1.4, sp: 1.1, hp: 1 },
  { n: 20, kid: 0.25, bock: 0.15, fronts: 2, gap: 1.2, sp: 1.1, hp: 1.15 },
  { n: 26, kid: 0.2, bock: 0.3, fronts: 3, gap: 1.0, sp: 1.1, hp: 1.25 },
  { n: 30, kid: 0.35, bock: 0.25, fronts: 4, gap: 0.85, sp: 1.2, hp: 1.35 },
  { n: 36, kid: 0.3, bock: 0.3, fronts: 4, gap: 0.6, sp: 1.2, hp: 1.45, burst: true },
  { n: 24, kid: 0.4, bock: 0.2, fronts: 4, gap: 1.1, sp: 1.15, hp: 1.4, king: true },
  { n: 100, kid: 0.3, bock: 0.2, fronts: 8, gap: 0.06, sp: 1.15, hp: 1.3, exact: true },
];
export function makeWave8(wave, seed, perTeam = 1) {
  const W = WAVE8[wave - 1], r = rng(seed * 1000 + wave * 7919), fronts = [], base = r() * Math.PI * 2;
  for (let i = 0; i < W.fronts; i++) fronts.push(base + i * (Math.PI * 2 / W.fronts) + (r() - 0.5) * (W.fronts >= 8 ? 0.2 : 0.5));
  const n = W.exact ? W.n : Math.round(W.n * (1 + 0.4 * (perTeam - 1))), list = []; let t = 0.4;
  if (W.king) { list.push({ t: 0.5, type: 'king', a: base, sp: 1 }); t = 3; }
  for (let i = 0; i < n; i++) { const x = r(); const type = x < W.bock ? 'bock' : x < W.bock + W.kid ? 'kid' : 'normal';
    // Finale: gleichmäßig reihum von allen Seiten; sonst zufällige Front
    const a = W.fronts >= 8 ? fronts[i % W.fronts] + (r() - 0.5) * 0.7 : fronts[Math.floor(r() * fronts.length)] + (r() - 0.5) * 0.6;
    list.push({ t, type, a, sp: (0.9 + r() * 0.2) * W.sp, hpM: W.hp });
    t += W.burst && i % 4 !== 3 ? 0.05 : W.gap / (1 + 0.25 * (perTeam - 1)) * (0.6 + r() * 0.8); }
  return { wave, name: WAVE_NAMES8[wave - 1], fronts, list, king: !!W.king, final: !!W.exact, night: wave === 5, maxAlive: W.exact ? 110 : 18 + 6 * (perTeam - 1) };
}
