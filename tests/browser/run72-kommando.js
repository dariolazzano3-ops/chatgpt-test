// V7.2 Schafkommando im Browser (lokaler Server mit DEBUG, THREE-Attrappe): taktische Karte, Helfer, Befehle, Route,
// Fehlabschuss-Anzeige, Tarnanzeige, Kuchenalarm, Handy-Bedienung. Echte 3D-Bilder: run72-kommando3d.js
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = __dirname, root = path.join(dir, '..');
const PORT = 8921, BASE = 'http://localhost:' + PORT;
const sdir = path.join(dir, 'static72'); fs.mkdirSync(sdir, { recursive: true });
fs.writeFileSync(path.join(sdir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(root, 'ziegenalarm.html'), 'utf8').replace('/*@test-hooks*/', fs.readFileSync(path.join(dir, 'hooks.js'), 'utf8')) + '</body></html>');
const stub = fs.readFileSync(path.join(dir, 'three-stub.js'), 'utf8');
const results = [], errors = [];
const check = (n, ok, info) => { const l = (ok ? 'PASS ' : 'FAIL ') + n + (info !== undefined ? '  ' + info : ''); results.push(l); console.log(l); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000, step = 150) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const dbg = async code => (await fetch(`${BASE}/api/debug?code=${code}`)).json();
const dset = (code, q) => fetch(`${BASE}/api/debug/set?code=${code}&${q}`);
const K = c => c.page.evaluate(() => window.__ziegenalarm.kk72());
const KK = c => c.page.evaluate(() => window.__ziegenalarm.kk());
const mapPt = (c, x, z) => c.page.evaluate(([x, z]) => window.__ziegenalarm.mapPt(x, z), [x, z]);
(async () => {
  const srv = cp.spawn('node', [path.join(root, 'online/dev/server.js')], { env: { ...process.env, PORT: String(PORT), STATIC: sdir, DEBUG: '1' }, stdio: 'ignore' });
  await sleep(800);
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  async function client(name, dev) { const ctx = await browser.newContext(dev ? { ...devices[dev] } : { viewport: { width: 1200, height: 700 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) errors.push(name + ': ' + m.text()); });
    await page.route('**/three.min.js', r => r.fulfill({ contentType: 'application/javascript', body: stub }));
    await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs/, r => r.abort());
    await page.goto(BASE + '/'); await page.waitForTimeout(300); return { name, page, ctx }; }
  async function match(defName, sheepName, devS) {
    const A = await client(defName), B = await client(sheepName, devS);
    await A.page.click('#modeKK'); await A.page.fill('#lbName', defName); await A.page.click('#lbCreate');
    const code = await until(async () => { const t = await A.page.textContent('#lbRoomCode'); return t && t.length === 5 ? t : null; });
    await B.page.click('#modeKK'); await B.page.fill('#lbName', sheepName); await B.page.fill('#lbCode', code); await B.page.click('#lbJoin');
    await until(async () => (await dbg(code)).players.length === 2);
    const d0 = await dbg(code); const defP = d0.players.find(p => p.team === 0);
    if (defP.name !== defName) { await A.page.click('#lbSwitch'); await sleep(300); }
    await A.page.click('#lbReady'); await B.page.click('#lbReady');
    await until(async () => (await KK(A)).on && (await KK(B)).on, 15000);
    return { A, B, code };
  }
  try {
    const { A, B, code } = await match('Wächterin', 'Wolle');
    let d = await dbg(code); const sp = d.match.players.find(p => p.role === 'sheep'), dp = d.match.players.find(p => p.role === 'def');
    check('Rollen verteilt (A Verteidiger, B Schaf)', (await KK(A)).role === 'def' && (await KK(B)).role === 'sheep');
    check('Herde: 15 Schafe im Client des Verteidigers', (await KK(A)).sheep.length === 15, (await KK(A)).sheep.length);
    let kb = await K(B), ka = await K(A);
    check('Schaf: Kartenknopf und Tarnanzeige sichtbar', kb.mapBtn && kb.tarn === 'Unauffällig', kb.tarn);
    check('Verteidiger: kein Kartenknopf, keine Tarnanzeige, Fehlabschüsse 0/3 sichtbar', !ka.mapBtn && ka.tarn === null && ka.wrong === 'Unschuldige Schafe getötet: 0/3', ka.wrong);
    // drei NPCs neben das Schaf stellen
    await dset(code, `k=ppos&id=${sp.id}&x=20&z=8`); for (let i = 0; i < 5; i++) await dset(code, `k=npcpos&i=${i}&x=${(22 + i * 2.5).toFixed(1)}&z=${(4 + (i % 2) * 2).toFixed(1)}`);
    await sleep(700);
    await B.page.dispatchEvent('#mapBtn', 'pointerdown'); check('Karte öffnet per Knopf', !!await until(async () => (await K(B)).mapOpen, 3000));
    kb = await K(B); check('Karte wird gezeichnet', kb.mapPx > 500, kb.mapPx + ' Pixel');
    d = await dbg(code); const npcs = d.match.npcs.slice(0, 5);
    for (const n of npcs.slice(0, 3)) { const [x, y] = await mapPt(B, n.x, n.z); await B.page.mouse.click(x, y); await sleep(250); }
    d = await until(async () => { const x = await dbg(code); return x.match.npcs.filter(n => n.helper).length === 3 ? x : null; }, 4000);
    check('3 Helfer per Antippen auf der Karte gewählt', !!d);
    kb = await until(async () => { const x = await K(B); return x.rings === 3 ? x : null; }, 3000);
    check('Schaf sieht 3 Helfer-Ringe', !!kb, kb && kb.rings);
    ka = await K(A); check('Verteidiger sieht keine Helfer-Ringe', ka.rings === 0);
    { const n = npcs[3]; const [x, y] = await mapPt(B, n.x, n.z); await B.page.mouse.click(x, y); await sleep(500); }
    d = await dbg(code); check('Vierter Helfer abgelehnt (Popup)', d.match.npcs.filter(n => n.helper).length === 3 && /Schon 3 Helfer/.test(await B.page.textContent('#pop')), await B.page.textContent('#pop'));
    await B.page.click('#tmapModes [data-m="atk"]'); { const [x, y] = await mapPt(B, 5.6, 0); await B.page.mouse.click(x, y); }
    await B.page.click('#tmapModes [data-m="route"]'); for (const [rx, rz] of [[14, -6], [8, -20]]) { const [x, y] = await mapPt(B, rx, rz); await B.page.mouse.click(x, y); await sleep(200); }
    d = await until(async () => { const x = await dbg(code); return x.match.attackPt && x.match.route && x.match.route.length === 3 ? x : null; }, 3000);
    check('Angriffspunkt und Fluchtweg (2 Wegpunkte + Omi) gesetzt', !!d, d && JSON.stringify([d.match.attackPt, d.match.route]));
    kb = await until(async () => { const x = await K(B); return x.route3d >= 3 ? x : null; }, 3000); check('Route und Ziel als Markierungen in der Welt (nur Schaf)', !!kb && (await K(A)).route3d === 0, kb && kb.route3d);
    await B.page.click('#tmapCmds [data-c="storm"]');
    d = await until(async () => { const x = await dbg(code); return x.match.npcs.filter(n => n.cmd === 'storm').length === 3 ? x : null; }, 3000);
    check('Befehl „Stürmen“ über die Karte', !!d);
    check('Karte schließt nach dem Befehl', !(await K(B)).mapOpen);
    kb = await until(async () => { const x = await K(B); return x.ringsActive === 3 ? x : null; }, 3000); check('Aktive Helfer leuchten orange (nur Schaf)', !!kb);
    const om = await until(async () => { const t = (await K(A)).omi; return /Wollgangster|Drei gegen einen/.test(t) ? t : null; }, 5000);
    check('Omi kommentiert den Angriffstrupp', !!om, om);
    await sleep(3000); d = await dbg(code); const moved = d.match.npcs.filter(n => n.helper).map(n => Math.hypot(n.x, n.z));
    check('Helfer stürmen Richtung Festung (synchron im Server)', moved.every(r => r < 20), moved.map(v => v.toFixed(1)).join(' '));
    check('Befehl im Cooldown: Kommando-Knöpfe gesperrt', await B.page.evaluate(() => { window.__ziegenalarm; return true; }) && (await (async () => { await B.page.keyboard.press('KeyM'); await sleep(400); return B.page.evaluate(() => [...document.querySelectorAll('#tmapCmds button')].every(b => b.disabled)); })()));
    await B.page.keyboard.press('KeyM'); await sleep(300); check('Karte per M schließen', !(await K(B)).mapOpen);
    // Fehlabschuss-Anzeige
    await dset(code, 'k=wrong&v=2'); ka = await until(async () => { const x = await K(A); return /2\/3/.test(x.wrong || '') ? x : null; }, 3000); check('Fehlabschüsse 2/3: deutliche Warnfarbe', ka && ka.wrongCls === 'w2');
    await dset(code, 'k=wrong&v=3'); ka = await until(async () => { const x = await K(A); return /3\/3/.test(x.wrong || '') ? x : null; }, 3000); check('3/3: blinkt rot', ka && ka.wrongCls === 'w3');
    kb = await K(B); check('Schaf sieht den Zähler ebenfalls', /3\/3/.test(kb.wrong || ''));
    // Kuchenalarm kaufen (Markt-UI) und Ortung
    await dset(code, 'k=coins&v=500'); await A.page.keyboard.press('KeyT'); await sleep(400);
    const btn = await A.page.$('#hshopList button.hitem:has-text("Kuchenalarm")'); if (btn) await btn.click(); await sleep(500); await A.page.keyboard.press('KeyT');
    d = await dbg(code); check('Kuchenalarm im Markt gekauft', d.match.builds ? d.match.builds.some(b => b.kind === 'cakealarm') : JSON.stringify(d.match).includes('cakealarm'));
    await dset(code, `k=ppos&id=${sp.id}&x=0.6&z=0.6`); await sleep(400); await B.page.keyboard.down('KeyE'); await sleep(1500); await B.page.keyboard.up('KeyE');
    d = await dbg(code); check('Schaf stiehlt den Kuchen', d.match.cake.state === 'carried');
    ka = await until(async () => { const x = await K(A); return x.thief ? x : null; }, 3000); check('Verteidiger: Kuchenalarm-Ortung sichtbar', !!ka);
    kb = await K(B); check('Schaf: Tarnung „Enttarnt“ mit Kuchen', kb.tarn === 'Enttarnt');
    await A.ctx.close(); await B.ctx.close();
    /* ---- Handy (iPhone quer): Karte bedienen ---- */
    const M2 = await match('Bert', 'Mia', 'iPhone 13 landscape'); const P = M2.B;
    d = await dbg(M2.code); const sp2 = d.match.players.find(p => p.role === 'sheep');
    await dset(M2.code, `k=ppos&id=${sp2.id}&x=20&z=8`); for (let i = 0; i < 3; i++) await dset(M2.code, `k=npcpos&i=${i}&x=${22 + i * 3}&z=5`); await sleep(700);
    const cdp = await P.ctx.newCDPSession(P.page); const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250); };
    const mb = await P.page.evaluate(() => { const r = document.getElementById('mapBtn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
    check('Handy: Kartenknopf groß genug (≥ 44 px)', mb.w >= 44 && mb.h >= 44, `${Math.round(mb.w)}×${Math.round(mb.h)}`);
    await tap(mb.x, mb.y); check('Handy: Karte per Antippen geöffnet', !!await until(async () => (await K(P)).mapOpen, 3000));
    const kp = await K(P); check('Handy: alle Kartenknöpfe ≥ 44 px hoch', kp.buttons.every(b => b.h >= 44), kp.buttons.map(b => b.h).join(','));
    const vp = P.page.viewportSize(); check('Handy: Karte liegt im Bild und ist groß genug', kp.canvas.w >= 220 && kp.canvas.r <= vp.width && kp.canvas.b <= vp.height && kp.canvas.t >= 0, JSON.stringify(kp.canvas));
    d = await dbg(M2.code); for (const n of d.match.npcs.slice(0, 3)) { const [x, y] = await mapPt(P, n.x, n.z); await tap(x, y); }
    check('Handy: Helfer per Antippen gewählt', !!await until(async () => (await dbg(M2.code)).match.npcs.filter(n => n.helper).length === 3, 4000));
    const cb = await P.page.evaluate(() => { const r = document.querySelector('#tmapCmds [data-c="distract"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await tap(cb.x, cb.y);
    check('Handy: Befehl „Ablenken“ per Antippen', !!await until(async () => (await dbg(M2.code)).match.npcs.filter(n => n.cmd === 'distract').length === 3, 4000));
    await P.page.screenshot({ path: path.join(dir, 'shots72-phone-map.png') });
    const ov = await M2.A.page.evaluate(() => { const r = document.getElementById('kkHud').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; }); check('Verteidiger-HUD mit Fehlabschusszähler passt ins Bild', ov);
    await M2.A.ctx.close(); await P.ctx.close();
  } catch (e) { check('Ablauf ohne Ausnahme', false, e.stack); }
  check('Keine Fehler in der Konsole', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close(); srv.kill();
  const pass = results.filter(l => l.startsWith('PASS')).length; console.log(`\n${pass}/${results.length} bestanden (Browser, THREE-Attrappe)`);
  process.exit(pass === results.length ? 0 : 1);
})();
