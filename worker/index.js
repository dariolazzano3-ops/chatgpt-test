// Cloudflare Worker + Durable Object: ein Durable Object pro Raumcode hält die autoritative Spielsimulation.
// Die Spielseite (public/index.html) wird über die Assets-Bindung ausgeliefert.
import { Room, newCode, validCode } from '../shared/engine.js';
import { MODES } from '../shared/modes/index.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const IDLE_DISSOLVE_MS = 15 * 60 * 1000; // Raum ohne Verbindung wird nach 15 min aufgelöst
const NEVER_JOINED_MS = 30 * 60 * 1000;  // erstellter, nie betretener Raum nach 30 min

// Nur Seiten derselben Adresse (oder ausdrücklich erlaubte, z. B. eigene Domain) dürfen Räume öffnen.
// Ohne Origin-Header (kein Browser) wird nicht blockiert; der Server vertraut dem Client ohnehin nicht.
function originOk(req, env) {
  const o = req.headers.get('Origin'); if (!o) return true;
  let host; try { host = new URL(o).host; } catch (e) { return false; }
  if (host === new URL(req.url).host) return true;
  const extra = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return extra.includes(o);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
        if (!originOk(req, env)) return json({ error: 'origin' }, 403);
      }
      if (url.pathname === '/api/new') {
        if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method' }, 405);
        const mode = url.searchParams.get('mode') || 'kuchenkrieg', size = url.searchParams.get('size') || '1v1';
        if (!MODES[mode] || !['1v1', '2v2'].includes(size)) return json({ error: 'bad' }, 400);
        for (let i = 0; i < 5; i++) {
          const code = newCode(); const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
          const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, mode, size }) });
          if (r.ok) return json({ code });
        }
        return json({ error: 'busy' }, 503);
      }
      let m = /^\/api\/room\/([A-Za-z0-9]{1,8})$/.exec(url.pathname);
      if (m) {
        const code = m[1].toUpperCase(); if (!validCode(code)) return json({ exists: false, error: 'code' }, 400);
        return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/info');
      }
      m = /^\/ws\/([A-Za-z0-9]{1,8})$/.exec(url.pathname);
      if (m) {
        if (!validCode(m[1])) return new Response('bad code', { status: 400 });
        if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
        return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error('worker:', e && e.stack || e);
      return json({ error: 'server' }, 500);
    }
  },
};

export class RoomDO {
  constructor(state, env) {
    this.state = state; this.room = null; this.timer = null;
    this.loaded = this.state.storage.get('cfg').then(cfg => { if (cfg) this.room = new Room(cfg, MODES); });
  }
  async fetch(req) {
    await this.loaded;
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      if (this.room) return new Response('exists', { status: 409 });
      const cfg = await req.json(); this.room = new Room(cfg, MODES);
      await this.state.storage.put('cfg', cfg);
      await this.state.storage.setAlarm(Date.now() + NEVER_JOINED_MS);
      return new Response('ok');
    }
    if (url.pathname === '/info') return this.room ? json(this.room.publicInfo()) : json({ exists: false }, 404);
    if (!this.room) return new Response('no room', { status: 404 });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.accept();
    const conn = { send: t => server.send(t), close: () => { try { server.close(1000, 'bye'); } catch (e) { } } };
    if (!this.room.open(conn)) return new Response(null, { status: 101, webSocket: client });
    server.addEventListener('message', e => { if (this.room) this.room.message(conn, typeof e.data === 'string' ? e.data : ''); });
    const end = () => { if (this.room) this.room.close(conn); };
    server.addEventListener('close', end); server.addEventListener('error', end);
    this.ensureLoop();
    return new Response(null, { status: 101, webSocket: client });
  }
  ensureLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.room) { clearInterval(this.timer); this.timer = null; return; }
      this.room.tick(0.05);
      // Schleife anhalten, wenn niemand mehr verbunden ist, damit das Objekt schlafen kann (spart Kosten).
      if (!this.room.connectedCount() && Date.now() - this.room.lastActive > 60000) {
        clearInterval(this.timer); this.timer = null;
        this.state.storage.setAlarm(Date.now() + IDLE_DISSOLVE_MS).catch(() => { });
      }
    }, 50);
  }
  // Aufräumen: leere Räume werden gelöscht, der Code ist danach ungültig.
  async alarm() {
    await this.loaded;
    if (this.room && this.room.connectedCount() > 0) { await this.state.storage.setAlarm(Date.now() + IDLE_DISSOLVE_MS); return; }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.room) for (const c of [...this.room.conns.keys(), ...this.room.pending.keys()]) { try { c.close(); } catch (e) { } }
    this.room = null;
    await this.state.storage.deleteAll();
  }
}
