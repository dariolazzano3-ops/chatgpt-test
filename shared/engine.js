// Ziegenalarm Online – generische Raum-Engine (Lobby, Teams, Bereit-Status, Start, Ergebnis, Revanche).
// Transportunabhängig: eine "Verbindung" ist ein Objekt mit send(text) und close(). Spielregeln stecken in Modus-Objekten.
export const TEAM_NAMES = ['Käse', 'Beere'];
const SIZES = { '1v1': 1, '2v2': 2 };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(rand = Math.random) { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]; return s; }
export function validCode(c) { return typeof c === 'string' && /^[A-HJ-NP-Z2-9]{5}$/.test(c); }
function cleanName(n) { n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16); return n || 'Ziegenjäger'; }
function tok() { let s = ''; for (let i = 0; i < 24; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]; return s; }

export class Room {
  constructor({ code, mode, size, seed }, modes) {
    if (!modes[mode]) throw new Error('unknown mode');
    if (!SIZES[size]) throw new Error('unknown size');
    this.code = code; this.modeId = mode; this.mode = modes[mode]; this.size = size; this.perTeam = SIZES[size];
    this.seed = seed ?? Math.floor(Math.random() * 1e9);
    this.players = []; this.state = 'lobby'; this.countdown = 0; this.match = null; this.results = null; this.nextId = 1;
    this.conns = new Map(); // conn -> player
    this.pending = new Map(); // Verbindungen ohne "hello" -> Zeitpunkt
    this.lastActive = Date.now(); this.errors = 0;
  }
  get capacity() { return this.perTeam * 2; }
  info() {
    return { t: 'room', code: this.code, mode: this.modeId, size: this.size, state: this.state, countdown: +this.countdown.toFixed(2),
      teams: TEAM_NAMES, players: this.players.map(p => ({ id: p.id, name: p.name, team: p.team, ready: p.ready, connected: p.connected, rematch: !!p.rematch })) };
  }
  send(p, msg) { if (p.conn && p.connected) { try { p.conn.send(JSON.stringify(msg)); } catch (e) { } } }
  broadcast(msg) { const s = JSON.stringify(msg); for (const p of this.players) if (p.conn && p.connected) { try { p.conn.send(s); } catch (e) { } } }
  sync() { this.broadcast(this.info()); }

  // Höchstens 12 Sockets pro Raum; wer sich nicht innerhalb von 10 s anmeldet, wird getrennt.
  open(conn) { this.lastActive = Date.now(); if (this.conns.size + this.pending.size >= 12) { try { conn.send(JSON.stringify({ t: 'error', code: 'busy', msg: 'Zu viele Verbindungen in diesem Raum.' })); conn.close(); } catch (e) { } return false; }
    this.pending.set(conn, Date.now()); return true; }
  publicInfo() { return { exists: true, mode: this.modeId, size: this.size, state: this.state, players: this.players.length, capacity: this.capacity, full: this.players.length >= this.capacity }; }
  message(conn, raw) {
    this.lastActive = Date.now();
    if (typeof raw === 'string' && raw.length > 4096) return; // übergroße Nachrichten verwerfen
    let msg; try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const p = this.conns.get(conn);
    if (!p) { if (msg.t === 'hello' && this.pending.has(conn)) { this.pending.delete(conn); this.hello(conn, msg); } return; }
    // Schutz vor Überflutung: höchstens 80 Nachrichten pro Sekunde
    const now = Date.now(); if (now - p.rateT > 1000) { p.rateT = now; p.rateN = 0; } if (++p.rateN > 80) return;
    // Doppelte oder veraltete Eingaben verwerfen (streng steigende Sequenznummer)
    if (msg.seq != null) { if (typeof msg.seq !== 'number' || msg.seq <= p.lastSeq) { p.dupes++; return; } p.lastSeq = msg.seq; }
    switch (msg.t) {
      case 'ready': if (this.state === 'lobby') { p.ready = !!msg.v; this.sync(); } break;
      case 'team': if (this.state === 'lobby') { const t = msg.v === 1 ? 1 : 0; if (t !== p.team && this.players.filter(x => x.team === t).length < this.perTeam) { p.team = t; p.ready = false; this.sync(); } } break;
      case 'leave': this.remove(p); break;
      case 'rematch': if (this.state === 'results') { p.rematch = true; this.sync(); } break;
      case 'lobby': if (this.state === 'results') { this.toLobby(); } break;
      case 'ping': this.send(p, { t: 'pong', c: msg.c }); break;
      default: if (this.state === 'match' && this.match) { try { this.mode.onMsg(this.match, p, msg); } catch (e) { this.fault(e); } }
    }
  }
  hello(conn, msg) {
    // Wiederbeitritt mit Token
    if (msg.token) { const p = this.players.find(x => x.token === msg.token); if (p) {
      if (p.conn && p.conn !== conn) { this.conns.delete(p.conn); try { p.conn.close(); } catch (e) { } }
      p.conn = conn; p.connected = true; p.goneAt = 0; this.conns.set(conn, p);
      this.send(p, { t: 'welcome', you: p.id, token: p.token, code: this.code, lastSeq: p.lastSeq, rejoined: true });
      if (this.match) this.mode.onRejoin?.(this.match, p);
      this.sync(); return; } }
    if (this.state !== 'lobby') { try { conn.send(JSON.stringify({ t: 'error', code: 'started', msg: 'Das Spiel in diesem Raum läuft schon.' })); conn.close(); } catch (e) { } return; }
    if (this.players.length >= this.capacity) { try { conn.send(JSON.stringify({ t: 'error', code: 'full', msg: 'Der Raum ist voll.' })); conn.close(); } catch (e) { } return; }
    const c0 = this.players.filter(x => x.team === 0).length, c1 = this.players.filter(x => x.team === 1).length;
    const p = { id: this.nextId++, name: cleanName(msg.name), team: c0 <= c1 ? 0 : 1, ready: false, conn, connected: true, token: tok(), lastSeq: 0, dupes: 0, rateT: 0, rateN: 0, goneAt: 0 };
    this.players.push(p); this.conns.set(conn, p);
    this.send(p, { t: 'welcome', you: p.id, token: p.token, code: this.code, lastSeq: 0 });
    this.sync();
  }
  close(conn) {
    this.pending.delete(conn);
    const p = this.conns.get(conn); this.conns.delete(conn); if (!p || p.conn !== conn) return;
    p.connected = false; p.goneAt = Date.now(); if (this.state === 'lobby') p.ready = false; this.sync();
  }
  remove(p) { const i = this.players.indexOf(p); if (i < 0) return; this.players.splice(i, 1); if (p.conn) { this.conns.delete(p.conn); try { p.conn.close(); } catch (e) { } }
    if (this.match) this.mode.onLeave?.(this.match, p); this.sync(); }
  toLobby() { this.state = 'lobby'; this.match = null; this.results = null; for (const p of this.players) { p.ready = false; p.rematch = false; } this.sync(); }
  startMatch() { this.seed = (this.seed * 1103515245 + 12345) >>> 0; this.match = this.mode.create(this); this.state = 'match'; this.results = null;
    for (const p of this.players) { p.ready = false; p.rematch = false; } this.sync(); }
  connectedCount() { return this.players.filter(p => p.connected).length; }
  // Fehler im Spielmodus dürfen den Server nicht abstürzen lassen: protokollieren, bei Häufung zurück in die Lobby.
  fault(e) { this.errors++; try { console.error('room ' + this.code + ':', e && e.stack || e); } catch (x) { }
    if (this.errors >= 5 && this.state === 'match') { this.errors = 0; this.broadcast({ t: 'error', code: 'server', msg: 'Serverfehler, das Spiel wurde abgebrochen.' }); this.toLobby(); } }
  tick(dt) { try { this.tickInner(dt); } catch (e) { this.fault(e); } }
  tickInner(dt) {
    const now = Date.now();
    for (const [c, t] of this.pending) if (now - t > 10000) { this.pending.delete(c); try { c.close(); } catch (e) { } }
    // Lobby: verlassene Plätze nach 30 s freigeben
    if (this.state === 'lobby') for (const p of [...this.players]) if (!p.connected && now - p.goneAt > 30000) this.remove(p);
    if (this.state === 'lobby') {
      const full = this.players.length === this.capacity && [0, 1].every(t => this.players.filter(p => p.team === t).length === this.perTeam);
      const go = full && this.players.every(p => p.ready && p.connected);
      if (go) { if (this.countdown <= 0) { this.countdown = 3; this.sync(); } else { this.countdown -= dt; if (this.countdown <= 0) { this.countdown = 0; this.startMatch(); } } }
      else if (this.countdown > 0) { this.countdown = 0; this.sync(); }
      return;
    }
    if (this.state === 'match') {
      this.mode.tick(this.match, dt);
      for (const p of this.players) if (p.connected) this.send(p, this.mode.snapshot(this.match, p));
      this.mode.flush(this.match);
      if (this.mode.over(this.match)) { this.results = this.mode.results(this.match, this); this.state = 'results'; this.broadcast({ t: 'results', ...this.results }); this.sync(); }
      return;
    }
    if (this.state === 'results') {
      const con = this.players.filter(p => p.connected);
      if (this.players.length === this.capacity && con.length === this.capacity && con.every(p => p.rematch)) this.startMatch();
    }
  }
}
