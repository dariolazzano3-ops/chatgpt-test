// V7.1 Solo gegen KI im Browser: lokaler Server (DEBUG), THREE-Attrappe (Logik/HUD/Netz). Echte 3D-Bilder: run71-solo3d.js
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = __dirname, root = path.join(dir, '..');
const PORT = 8911, BASE = 'http://localhost:' + PORT;
const sdir = path.join(dir, 'static71'); fs.mkdirSync(sdir, { recursive: true });
fs.writeFileSync(path.join(sdir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(root, 'ziegenalarm.html'), 'utf8').replace('/*@test-hooks*/', fs.readFileSync(path.join(dir, 'hooks.js'), 'utf8')) + '</body></html>');
const stub = fs.readFileSync(path.join(dir, 'three-stub.js'), 'utf8');
const results = [], errors = [];
const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); results.push(l); console.log(l); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 12000, step = 150) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const dbg = async code => (await fetch(`${BASE}/api/debug?code=${code}`)).json();
const dset = (code, q) => fetch(`${BASE}/api/debug/set?code=${code}&${q}`);
const K = c => c.page.evaluate(() => window.__ziegenalarm.kk());
const vis = (c, id) => c.page.evaluate(id => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, id);
(async () => {
  const srv = cp.spawn('node', [path.join(root, 'online/dev/server.js')], { env: { ...process.env, PORT: String(PORT), STATIC: sdir, DEBUG: '1' }, stdio: 'ignore' });
  await sleep(800);
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  async function client(name, dev) { const ctx = await browser.newContext(dev ? { ...devices[dev] } : { viewport: { width: 1100, height: 650 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errors.push(name + ': ' + m.text()); });
    await page.route('**/three.min.js', r => r.fulfill({ contentType: 'application/javascript', body: stub }));
    await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs/, r => r.abort());
    await page.goto(BASE + '/'); await page.waitForTimeout(300); return { name, page, ctx }; }
  async function solo(c, role, diff) { if (!(await vis(c, 'lbSoloGo'))) await c.page.click('#modeKK'); await c.page.fill('#lbName', c.name);
    await c.page.click(`#lbRole [data-r="${role}"]`); await c.page.click(`#lbDiff [data-d="${diff}"]`);
    const t0 = Date.now(); await c.page.click('#lbSoloGo');
    const ok = await until(async () => (await K(c)).on, 8000); return { ok: !!ok, ms: Date.now() - t0, code: (await K(c)).code }; }
  try {
    /* ===== 1) Solo als Verteidiger, Mittel (Standard) ===== */
    const A = await client('Dora');
    await A.page.click('#modeKK');
    check('Kuchenkrieg-Menü zeigt „Alleine spielen“ und „Mit Freunden spielen“', await vis(A, 'lbSolo') && await vis(A, 'lbFriendsH') && await vis(A, 'lbCreate'));
    check('Standard-Schwierigkeit ist Mittel', await A.page.evaluate(() => document.querySelector('#lbDiff .on').dataset.d) === 'normal');
    await A.page.click('#lbBack'); await A.page.click('#modeGR');
    check('GOAT ROYALE zeigt kein Solo (nur Kuchenkrieg hat KI)', !(await vis(A, 'lbSolo')));
    await A.page.click('#lbBack');
    const s1 = await solo(A, 'def', 'normal');
    check('Solo-Verteidiger startet sofort ohne Code und Mitspieler', s1.ok && s1.ms < 5000, s1.ms + ' ms');
    let k = await K(A); check('Rolle Verteidiger', k.role === 'def');
    let d = await dbg(s1.code); const botS = d.players.find(p => p.bot);
    check('Raum ist Solo mit KI-Schaf, klar als KI benannt', d.solo && botS && botS.team === 1 && /^KI · Schaf \(Mittel\)$/.test(botS.name), botS && botS.name);
    const sp0 = d.match.players.find(p => p.role === 'sheep');
    await sleep(9000); d = await dbg(s1.code); const sp1 = d.match.players.find(p => p.role === 'sheep');
    check('KI-Schaf bewegt sich und hat einen Zustand', Math.hypot(sp1.x - sp0.x, sp1.z - sp0.z) > 1 && !!sp1.botState, sp1.botState + ' ' + Math.hypot(sp1.x - sp0.x, sp1.z - sp0.z).toFixed(1) + ' m');
    check('KI-Schaf ohne Regelverstöße', !sp1.wallRejects && !sp1.speedRejects && !sp1.yRejects, JSON.stringify(sp1.rejects));
    k = await K(A); check('Client zeigt die Herde inkl. KI-Schaf (nicht markiert)', k.sheep.length >= 10 && !k.sheep.some(s => s.label), k.sheep.length + ' Schafe');
    // Ende erzwingen → Ergebnis → Revanche → Neu starten
    await dset(s1.code, 'k=cakehp&v=0');
    check('Ergebnis-Bildschirm im Solo', !!await until(() => vis(A, 'results'), 6000));
    check('Solo-Knöpfe: Revanche (sofort) / Neu starten …', (await A.page.textContent('#rsAgain')).includes('sofort') && (await A.page.textContent('#rsLobby')).includes('Neu starten'));
    await A.page.click('#rsAgain');
    check('Revanche startet sofort eine neue Runde gegen die KI', !!await until(async () => (await K(A)).on, 8000));
    d = await dbg(s1.code); check('Revanche: frische Welle 1', d.match && d.match.wave <= 1 && d.state === 'match', 'Welle ' + (d.match && d.match.wave));
    await dset(s1.code, 'k=cakehp&v=0'); await until(() => vis(A, 'results'), 6000);
    await A.page.click('#rsLobby');
    check('„Neu starten …“ führt zur Auswahl zurück', !!await until(async () => await vis(A, 'lbSolo') && await vis(A, 'lbSoloGo'), 5000));
    /* ===== 2) Solo als Schaf, Schwer ===== */
    const s2 = await solo(A, 'sheep', 'hard');
    check('Solo-Schaf (Schwer) startet sofort', s2.ok && s2.ms < 5000, s2.ms + ' ms');
    k = await K(A); check('Rolle Schaf', k.role === 'sheep');
    d = await dbg(s2.code); const botD = d.players.find(p => p.bot);
    check('KI-Wächter (Schwer) im Raum', botD && botD.team === 0 && botD.name === 'KI · Wächter (Schwer)', botD && botD.name);
    const mate = await until(async () => { const kk = await K(A); return kk.mateNames.find(m => /KI/.test(m.name) && m.vis); }, 6000);
    check('KI-Wächter als 3D-Figur mit KI-Namen sichtbar', !!mate, mate ? mate.name : JSON.stringify((await K(A)).mateNames));
    await dset(s2.code, 'k=phaseT&v=0'); await sleep(12000); d = await dbg(s2.code); const dp = d.match.players.find(p => p.role === 'def');
    check('KI-Wächter schießt auf Ziegen', dp.shots > 0 && d.match.kills > 0, dp.shots + ' Schüsse, ' + d.match.kills + ' Kills, Zustand ' + dp.botState);
    check('KI-Wächter ohne Regelverstöße', !dp.wallRejects && !dp.speedRejects, JSON.stringify(dp.rejects));
    await A.page.click('#rsMenu').catch(() => {}); await A.ctx.close();
    /* ===== 3) Mehrspieler-Lobby: freien Platz mit KI füllen ===== */
    const B = await client('Bert'); await B.page.click('#modeKK'); await B.page.fill('#lbName', 'Bert'); await B.page.click('#lbCreate');
    await until(async () => (await B.page.textContent('#lbRoomCode')).length === 5); const code3 = await B.page.textContent('#lbRoomCode');
    check('Freier Platz bietet „+ KI“', await B.page.$$eval('[data-add]', x => x.length) === 1);
    await B.page.click('[data-add]'); await until(async () => (await dbg(code3)).players.some(p => p.bot), 4000);
    d = await dbg(code3); check('KI füllt nur den freien Platz (Kapazität 2)', d.players.length === 2 && d.players.filter(p => p.bot).length === 1);
    check('KI in der Lobby als KI beschriftet', !!await until(async () => /KI · Schaf/.test(await B.page.textContent('#lbTeams')), 4000));
    await B.page.click('[data-kick]'); await until(async () => !(await dbg(code3)).players.some(p => p.bot), 4000);
    check('KI lässt sich wieder entfernen', !(await dbg(code3)).players.some(p => p.bot));
    await B.page.click('[data-add]'); await until(async () => (await dbg(code3)).players.some(p => p.bot), 4000);
    const extra = await fetch(`${BASE}/api/room/${code3}`).then(r => r.json()); check('Raum gilt mit KI als voll', extra.full === true);
    await B.page.click('#lbReady'); check('Match mit KI-Mitspieler startet nach „Bereit“', !!await until(async () => (await K(B)).on, 12000));
    await B.ctx.close();
    /* ===== 4) Handy: Solo als Schaf mit Touch ===== */
    const C = await client('Handy', 'iPhone 13 landscape'); const s4 = await solo(C, 'sheep', 'easy');
    check('iPhone: Solo-Schaf startet', s4.ok);
    check('iPhone: Touch-Steuerung sichtbar', !!await until(() => C.page.evaluate(() => document.querySelectorAll('.tbtn:not([hidden])').length >= 2), 4000));
    const sw = await C.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); check('iPhone: kein seitliches Scrollen', sw);
    await C.ctx.close();
  } catch (e) { check('Ablauf ohne Ausnahme', false, e.stack); }
  check('Keine Fehler in der Konsole', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close(); srv.kill();
  const pass = results.filter(l => l.startsWith('PASS')).length; console.log(`\n${pass}/${results.length} bestanden (Browser, THREE-Attrappe)`);
  process.exit(pass === results.length ? 0 : 1);
})();
