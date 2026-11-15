// V7.1 Solo gegen KI mit ECHTEM three.js (Software-WebGL): KI-Schaf klaut sichtbar, KI-Wächter als Figur, Bildschirmfotos.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = __dirname, root = path.join(dir, '..');
const PORT = 8912, BASE = 'http://localhost:' + PORT;
const sdir = path.join(dir, 'static71r'), shots = path.join(dir, 'shots71'); fs.mkdirSync(path.join(sdir, 'vendor'), { recursive: true }); fs.mkdirSync(shots, { recursive: true });
fs.copyFileSync(path.join(root, 'online', 'public', 'vendor', 'three.min.js'), path.join(sdir, 'vendor', 'three.min.js'));
const game = fs.readFileSync(path.join(root, 'online', 'src', 'game.html'), 'utf8').replace('/*@test-hooks*/', fs.readFileSync(path.join(dir, 'hooks.js'), 'utf8')); // neutrales Gesicht
fs.writeFileSync(path.join(sdir, 'index.html'), '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + game + '</body></html>');
const results = [], errors = [];
const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); results.push(l); console.log(l); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 30000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const dbg = async code => (await fetch(`${BASE}/api/debug?code=${code}`)).json();
const dset = (code, q) => fetch(`${BASE}/api/debug/set?code=${code}&${q}`);
const K = c => c.page.evaluate(() => window.__ziegenalarm.kk());
const H = (c, n, a = []) => c.page.evaluate(([n, a]) => window.__ziegenalarm[n](...a), [n, a]);
(async () => {
  const srv = cp.spawn('node', [path.join(root, 'online/dev/server.js')], { env: { ...process.env, PORT: String(PORT), STATIC: sdir, DEBUG: '1' }, stdio: 'ignore' });
  await sleep(800);
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--ignore-gpu-blocklist'] });
  async function client(name, vp) { const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errors.push(name + ': ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs/, r => r.abort()); await page.goto(BASE + '/'); await page.waitForTimeout(800); return { name, page, ctx }; }
  async function solo(c, role, diff) { await c.page.click('#modeKK'); await c.page.fill('#lbName', c.name); await c.page.click(`#lbRole [data-r="${role}"]`); await c.page.click(`#lbDiff [data-d="${diff}"]`);
    await c.page.click('#lbSoloGo'); await until(async () => (await K(c)).on, 20000); return (await K(c)).code; }
  try {
    /* 1) Als Verteidiger gegen KI-Schaf: der Wächter (du) steht weit weg, das KI-Schaf soll von selbst klauen */
    const A = await client('Dora', { width: 1280, height: 720 });
    await A.page.screenshot({ path: path.join(shots, 'menue.png'), timeout: 240000 });
    await A.page.click('#modeKK'); await sleep(500); await A.page.screenshot({ path: path.join(shots, 'solo-auswahl.png'), timeout: 240000 }); await A.page.click('#lbBack');
    const code = await solo(A, 'def', 'easy');
    let d = await dbg(code); const me = d.players.find(p => !p.bot);
    check('Solo-Verteidiger läuft (echtes three.js)', (await K(A)).on && d.solo);
    await dset(code, `k=ppos&id=${me.id}&x=24&z=24`);
    const t0 = Date.now(); let carried = null;
    carried = await until(async () => { d = await dbg(code); await dset(code, `k=ppos&id=${me.id}&x=24&z=24`); return d.match && d.match.cake.state === 'carried' ? d : null; }, 240000, 1000);
    check('KI-Schaf stiehlt den Kuchen von selbst', !!carried, carried ? ((Date.now() - t0) / 1000).toFixed(0) + ' s nach Start' : 'kein Diebstahl in 4 min');
    if (carried) { const sp = carried.match.players.find(p => p.role === 'sheep');
      await dset(code, `k=ppos&id=${me.id}&x=${(sp.x + 6).toFixed(1)}&z=${(sp.z + 6).toFixed(1)}`); await sleep(1200);
      const s2 = (await dbg(code)).match.players.find(p => p.role === 'sheep'); await H(A, 'aim', [s2.x, 0.8, s2.z]); await sleep(1500);
      { const kc = (await K(A)).sheep.find(s => s.carry); if (kc) { await dset(code, `k=ppos&id=${me.id}&x=${(kc.x + 4.5).toFixed(1)}&z=${(kc.z + 4.5).toFixed(1)}`); await sleep(900); const kc2 = (await K(A)).sheep.find(s => s.carry) || kc; await H(A, 'aim', [kc2.x, 0.7, kc2.z]); await sleep(1200); } }
      const k = await K(A); check('Client zeigt den Kuchen auf dem KI-Schaf', k.sheep.some(s => s.carry) && !k.tableCake, 'Tisch-Kuchen sichtbar: ' + k.tableCake);
      await A.page.screenshot({ path: path.join(shots, 'ki-schaf-klaut.png'), timeout: 240000 });
      check('Omi reagiert (Untertitel)', !!await until(async () => (await K(A)).omiSub.length > 0, 8000), (await K(A)).omiSub); }
    const g = await H(A, 'gfx'); check('Szene wird gezeichnet', g.calls > 40 && g.tris > 3000, `calls=${g.calls} tris=${g.tris}`);
    await A.ctx.close();
    /* 2) Als Schaf gegen KI-Wächter (Schwer): Figur, Name, kämpft gegen Ziegen */
    const B = await client('Shaun', { width: 1280, height: 720 }); const code2 = await solo(B, 'sheep', 'hard');
    await dset(code2, 'k=phaseT&v=0'); await sleep(9000);
    d = await dbg(code2); const df = d.match.players.find(p => p.role === 'def'), sm = d.players.find(p => !p.bot);
    await dset(code2, `k=ppos&id=${sm.id}&x=13&z=13`); await sleep(1500);
    await B.page.evaluate(([x, z]) => window.__ziegenalarm.aim(x, 1.4, z), [df.x, df.z]); await sleep(3000);
    const kb = await K(B); const mt = kb.mateNames.find(m => /KI/.test(m.name));
    check('KI-Wächter als 3D-Figur mit KI-Namen', !!(mt && mt.vis), mt && mt.name);
    await B.page.screenshot({ path: path.join(shots, 'ki-waechter.png'), timeout: 240000 });
    d = await dbg(code2); const df2 = d.match.players.find(p => p.role === 'def');
    check('KI-Wächter kämpft (Schüsse, Kills)', df2.shots > 0 && d.match.kills > 0, df2.shots + ' Schüsse, ' + d.match.kills + ' Kills');
    await B.ctx.close();
  } catch (e) { check('Ablauf ohne Ausnahme', false, e.stack); }
  check('Keine Fehler in der Konsole', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close(); srv.kill();
  const pass = results.filter(l => l.startsWith('PASS')).length; console.log(`\n${pass}/${results.length} bestanden (echtes three.js, Software-WebGL)`);
  process.exit(pass === results.length ? 0 : 1);
})();
