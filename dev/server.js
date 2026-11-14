// Lokaler Entwicklungsserver ohne Abhängigkeiten: dieselbe Raum-Engine wie im Cloudflare Durable Object,
// mit einer minimalen WebSocket-Implementierung (RFC 6455) auf Node-Bordmitteln.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Room, newCode, validCode } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 8787);
const STATIC = process.env.STATIC || path.join(dir, '..', 'public');
const DEBUG = process.env.DEBUG === '1';
const LAG = +(process.env.LAG_MS || 0), JITTER = +(process.env.JITTER_MS || 0); // nur für Tests: künstliche Netzverzögerung je Richtung
const lag = f => { if (!LAG && !JITTER) return f(); setTimeout(f, LAG + Math.random() * JITTER); };
const stats = { bytesOut: 0, msgsOut: 0, msgsIn: 0, bytesIn: 0 };
const IDLE_MS = +(process.env.IDLE_MS || 15 * 60 * 1000); // leere Räume nach dieser Zeit auflösen (wie im Worker) // Test-Schnittstellen nur mit DEBUG=1
const rooms = new Map();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const sendJson = (res, o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
function originOk(req) { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch (e) { return false; } }

function wsAccept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  socket.setNoDelay(true);
  let buf = Buffer.alloc(0), closed = false;
  const conn = {
    send(text) { if (closed) return; if (LAG || JITTER) { lag(() => conn._send(text)); return; } conn._send(text); },
    _send(text) { if (closed) return; const p = Buffer.from(text); let h; stats.bytesOut += p.length; stats.msgsOut++;
      if (p.length < 126) h = Buffer.from([0x81, p.length]); else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(p.length, 2); }
      else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
      socket.write(Buffer.concat([h, p])); },
    close() { if (closed) return; closed = true; try { socket.end(Buffer.from([0x88, 0])); } catch (e) { } },
    onmessage: null, onclose: null,
  };
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 65536) { conn.close(); socket.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const mk = buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3]; }
      buf = buf.subarray(need);
      if (op === 0x1) { const t = payload.toString('utf8'); stats.msgsIn++; stats.bytesIn += t.length; lag(() => conn.onmessage && conn.onmessage(t)); }
      else if (op === 0x8) { conn.close(); socket.destroy(); }
      else if (op === 0x9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
    }
  });
  const end = () => { if (conn._ended) return; conn._ended = true; closed = true; conn.onclose && conn.onclose(); };
  socket.on('close', end); socket.on('error', end);
  return conn;
}

const server = http.createServer((req, res) => { try { handle(req, res); } catch (e) { console.error(e); try { if (res.headersSent) res.end(); else sendJson(res, { error: 'server' }, 500); } catch (x) { } } });
function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/') && !originOk(req)) return sendJson(res, { error: 'origin' }, 403);
  const rm = /^\/api\/room\/([A-Za-z0-9]{1,8})$/.exec(u.pathname);
  if (rm) { const c = rm[1].toUpperCase(); if (!validCode(c)) return sendJson(res, { exists: false, error: 'code' }, 400);
    const r = rooms.get(c); return r ? sendJson(res, r.publicInfo()) : sendJson(res, { exists: false }, 404); }
  if (u.pathname === '/api/new') {
    const mode = u.searchParams.get('mode') || 'kuchenkrieg', size = u.searchParams.get('size') || '1v1';
    if (!MODES[mode] || !['1v1', '2v2', 'coop'].includes(size) || (size === 'coop' && !MODES[mode].coop)) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{"error":"bad"}'); }
    let code; do code = newCode(); while (rooms.has(code));
    rooms.set(code, new Room({ code, mode, size }, MODES));
    return sendJson(res, { code });
  }
  if (DEBUG && u.pathname === '/api/debug') { // nur lokal mit DEBUG=1: Zustand für Tests
    const r = rooms.get(u.searchParams.get('code'));
    if (!r) return sendJson(res, null);
    if (r.modeId === 'royale') return sendJson(res, { mode: 'royale', state: r.state, players: r.players.map(p => ({ id: p.id, name: p.name, team: p.team, connected: p.connected, lastSeq: p.lastSeq })), results: r.results,
      match: r.match && { time: r.match.time, phase: r.match.phase, players: [...r.match.players.values()].map(ps => ({ id: ps.id, team: ps.team, x: ps.x, z: ps.z, lives: ps.lives, wucht: ps.wucht, mount: ps.mount, rideT: ps.rideT, fallT: ps.fallT, out: ps.out, prot: ps.prot, kos: ps.kos, shots: ps.shots, hits: ps.hits, rejects: ps.rejects, kbT: ps.kbT })),
        goats: r.match.goats.map(g => ({ id: g.id, x: g.x, z: g.z, state: g.state, team: g.team, hp: g.hp, wind: g.wind })) } });
    return sendJson(res, ({ tickMs: r._tickMs || 0, tickMax: r._tickMax || 0, stats, state: r.state, players: r.players.map(p => ({ id: p.id, name: p.name, team: p.team, ready: p.ready, connected: p.connected, dupes: p.dupes, lastSeq: p.lastSeq })),
      match: r.match && r.match.worlds && { wave: r.match.wave, phase: r.match.phase, worlds: r.match.worlds.map(w => ({ cake: w.cake, coins: w.coins, kills: w.kills, points: w.points, goats: w.goats.length, goatList: w.goats.map(g => ({ id: g.id, type: g.type, x: g.x, z: g.z, hp: g.hp, state: g.state })), active: w.active, dead: w.deadAt, walls: w.walls, upg: w.upg })),
        players: [...r.match.players.values()].map(ps => ({ id: ps.id, team: ps.team, x: ps.x, z: ps.z, shots: ps.shots, rejects: ps.rejects, speedRejects: ps.speedRejects, kills: ps.kills, owned: [...ps.owned], nades: ps.nades, hp: ps.hp, dead: ps.dead, y: ps.y, prot: ps.prot, pkills: ps.pkills, boostReadyAt: ps.boostReadyAt, yRejects: ps.yRejects })),
        wolves: (r.match.wolves || []).map(f => ({ id: f.id, team: f.team, x: f.x, z: f.z, hp: f.hp, life: f.life, dead: f.dead, state: f.state })), time: r.match.time }, results: r.results }));
  }
  if (DEBUG && u.pathname === '/api/debug/set') { // nur lokal mit DEBUG=1: Testmanipulation
    const r = rooms.get(u.searchParams.get('code')); if (!r || !r.match) { res.writeHead(404); return res.end(); }
    if (r.modeId === 'royale') { const q = k => u.searchParams.get(k), m = r.match, ps = m.players.get(+q('id')), g = m.goats.find(x => x.id === +q('g'));
      const k = q('k');
      if (k === 'rpos' && ps) { ps.x = +q('x'); ps.z = +q('z'); ps.kbT = 0; ps.vx = ps.vz = 0; ps.correct = true; ps.cseq++; if (q('prot') != null) ps.prot = +q('prot'); }
      if (k === 'rset' && ps) { for (const f of ['lives', 'wucht', 'prot', 'rideT']) if (q(f) != null) ps[f] = +q(f); }
      if (k === 'rgoat' && g) { if (q('x') != null) { g.x = +q('x'); g.z = +q('z'); } if (q('hp') != null) g.hp = +q('hp'); if (q('life') != null) g.life = +q('life'); if (q('state')) g.state = q('state'); g.respawn = 0; g.wt = 99; g.wx = g.x; g.wz = g.z; }
      if (k === 'rtime') m.time = +q('v');
      res.writeHead(200); return res.end('ok'); }
    const w = r.match.worlds[+u.searchParams.get('team') || 0]; const k = u.searchParams.get('k'), v = +u.searchParams.get('v');
    if (k === 'cake') w.cake = v; if (k === 'cakeAll') for (const x of r.match.worlds) x.cake = v; if (k === 'coins') w.coins = v; if (k === 'phaseT') r.match.phaseT = v;
    if (k === 'goat') { w.goats.push({ id: w.gid++, type: 'normal', s: 1, r: 0.45, x: +u.searchParams.get('x'), z: +u.searchParams.get('z'), hp: v, maxHp: v, speed: 0, eat: 0, state: 'walk', stagger: 0, wp: null, wpTried: true, ry: 0, dead: false }); }
    if (k === 'clear') { w.goats = []; w.queue = []; }
    if (k === 'crash') r.match.worlds = null; // simuliert einen Fehler im Spielmodus
    if (k === 'wave') { r.match.wave = v; } // nächste Welle = v + 1
    const kp = r.match.players && r.match.players.get(+u.searchParams.get('id'));
    if (k === 'php' && kp) kp.hp = v;
    if (k === 'ppos' && kp) { kp.x = +u.searchParams.get('x'); kp.z = +u.searchParams.get('z'); kp.correct = true; kp.cseq = (kp.cseq || 0) + 1; if (u.searchParams.get('prot') != null) kp.prot = +u.searchParams.get('prot'); }
    if (k === 'gset') { const g = w.goats.find(x => x.id === +u.searchParams.get('g')); if (g) { if (u.searchParams.get('x') != null) { g.x = +u.searchParams.get('x'); g.z = +u.searchParams.get('z'); } if (u.searchParams.get('speed') != null) g.speed = +u.searchParams.get('speed'); if (u.searchParams.get('hp') != null) g.hp = +u.searchParams.get('hp'); } }
    res.writeHead(200); return res.end('ok');
  }
  if (u.pathname.startsWith('/api/')) return sendJson(res, { error: 'not found' }, 404);
  const file = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1));
  const fp = path.join(STATIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(fp, (err, data) => { if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(fp)] || 'application/octet-stream' }); res.end(data); });
}
server.on('upgrade', (req, socket) => {
  socket.on('error', () => { });
  if (!originOk(req)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy(); }
  const m = /^\/ws\/([A-Z0-9]{5})$/.exec(new URL(req.url, 'http://x').pathname);
  if (!m || !validCode(m[1]) || !rooms.has(m[1]) || !req.headers['sec-websocket-key']) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); return socket.destroy(); }
  const room = rooms.get(m[1]); const conn = wsAccept(req, socket);
  if (!room.open(conn)) return;
  conn.onmessage = t => room.message(conn, t); conn.onclose = () => room.close(conn);
});
setInterval(() => { for (const [code, r] of rooms) { const t0 = performance.now(); r.tick(0.05); const t = performance.now() - t0; r._tickMs = (r._tickMs || t) * 0.95 + t * 0.05; r._tickMax = Math.max(r._tickMax || 0, t); if (Date.now() - r.lastActive > IDLE_MS && !r.connectedCount()) { for (const c of [...r.conns.keys(), ...r.pending.keys()]) { try { c.close(); } catch (e) { } } rooms.delete(code); } } }, 50);
server.listen(PORT, () => console.log('Ziegenalarm Online (lokal) auf http://localhost:' + PORT));
