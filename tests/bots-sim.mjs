// V7.1: komplette Matches KI gegen KI (Server-Simulation). Aufruf: node bots-sim.mjs [Seeds je Paarung] [sheepDiff] [defDiff]
import { Room } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';
const N = +(process.argv[2] || 3), onlyS = process.argv[3], onlyD = process.argv[4], DIFFS = ['easy', 'normal', 'hard'];
export function playMatch(sDiff, dDiff, seed, maxMin = 12) {
  const r = new Room({ code: 'BOTSM', mode: 'kuchenkrieg', size: '1v1', seed }, MODES);
  r.addBot(0, dDiff); r.addBot(1, sDiff); for (let i = 0; i < 100 && r.state !== 'match'; i++) r.tick(0.05);
  const m = r.match, D = [...m.players.values()].find(p => p.role === 'def'), S = [...m.players.values()].find(p => p.role === 'sheep');
  let ticks = 0, worst = 0, steals = 0, maxWave = 0, delivered = false; const t0 = performance.now();
  while (r.state === 'match' && ticks < 20 * 60 * maxMin) { const a = performance.now(); r.tick(0.05); worst = Math.max(worst, performance.now() - a); ticks++;
    for (const e of m.ev || []) if (e.k === 'cakesteal') steals++; maxWave = Math.max(maxWave, m.wave); }
  const res = r.results || { winner: null, reason: 'timeout' };
  return { sDiff, dDiff, seed, winner: res.winner, reason: res.reason, wave: maxWave, min: +(ticks / 1200).toFixed(1), steals: S.bot.stats.steals || steals,
    sheep: { deaths: S.deaths, entries: S.bot.stats.entries, flee: S.bot.stats.flee, items: S.bot.stats.items, rejects: { speed: S.speedRejects, wall: S.wallRejects, y: S.yRejects, other: S.rejects }, states: S.bot.stats.states },
    def: { shots: D.shots, landed: D.landed || 0, acc: D.shots ? +((D.landed || 0) / D.shots).toFixed(2) : 0, sheepKills: D.pkills, buys: D.bot.stats.buys, chases: D.bot.stats.chases, rejects: { speed: D.speedRejects, wall: D.wallRejects, other: D.rejects } },
    npcKills: m.ev ? 0 : 0, kills: m.fort.kills, msPerTick: +((performance.now() - t0) / ticks).toFixed(3), worstMs: +worst.toFixed(2), botMs: +(((S.botMs || 0) + (D.botMs || 0)) / ticks).toFixed(3) };
}
if (process.argv[1] && process.argv[1].endsWith('bots-sim.mjs')) {
  const rows = [];
  for (const s of DIFFS) for (const d of DIFFS) { if (onlyS && s !== onlyS) continue; if (onlyD && d !== onlyD) continue;
    for (let k = 0; k < N; k++) { const o = playMatch(s, d, 1000 + k * 7919 + DIFFS.indexOf(s) * 31 + DIFFS.indexOf(d) * 5); rows.push(o);
      console.log(`Schaf ${s.padEnd(6)} vs Wächter ${d.padEnd(6)} seed ${o.seed}: Sieger ${o.winner === 1 ? 'SCHAF' : o.winner === 0 ? 'WÄCHTER' : '-'} (${o.reason}) Welle ${o.wave} ${o.min} min · Diebstähle ${o.steals} · Schaf-Tode ${o.sheep.deaths} · Einbrüche ${o.sheep.entries} · Wächter-Trefferquote ${o.def.acc} (${o.def.shots}) · Takt ${o.msPerTick} ms (max ${o.worstMs}) · Bots ${o.botMs} ms · Verstöße Schaf ${JSON.stringify(o.sheep.rejects)}`); } }
  console.log(JSON.stringify(rows.map(o => [o.sDiff, o.dDiff, o.winner, o.reason, o.wave, o.min, o.steals, o.def.acc])));
}
