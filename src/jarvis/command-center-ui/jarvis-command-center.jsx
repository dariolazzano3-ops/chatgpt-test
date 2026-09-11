import React, { useState, useEffect, useRef, useReducer, useMemo, useCallback } from "react";
import {
  Home, MessageSquare, ListChecks, FolderKanban, Brain, ShieldCheck, Cpu, ScrollText,
  Mic, ArrowUp, Search, Play, Pause, Check, X, Clock, GitBranch, AlertTriangle,
  ChevronRight, ChevronDown, Zap, Lock, Radio, FileText,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════
   JARVIS COMMAND CENTER — V1 (private preview)
   Single-file build. Sections map 1:1 to the intended repo split:
     01 tokens + state system   → design/tokens.ts, design/states.ts
     02 data contracts + mocks  → data/contracts.ts, data/mock.ts
     03 mock runtime (reducer)  → lib/runtime.ts   ← swap for Hermes adapter
     04 primitives              → components/ui/*
     05 signature visuals       → components/jarvis/* (Orb, Beam, Starfield)
     06 shell                   → components/shell/*
     07 views                   → app/(views)/*
   No live runtime is touched. Every value below is MOCK until adapters exist.
   ════════════════════════════════════════════════════════════════════════ */

/* ── 01 TOKENS & STATE SYSTEM ─────────────────────────────────────────── */

/** @typedef {'idle'|'scheduled'|'running'|'waiting'|'success'|'warning'|'blocked'|'failed'|'resumed'|'interrupted'} RunState */
const STATE = {
  idle:        { label: "Bereit",              short: "Bereit",      c: "#8d8277" },
  scheduled:   { label: "Geplant",             short: "Geplant",     c: "#c9b28e" },
  running:     { label: "Läuft",               short: "Läuft",       c: "#ffab40", pulse: true },
  waiting:     { label: "Wartet auf Freigabe", short: "Freigabe",    c: "#ffd35c", ring: true },
  success:     { label: "Erfolgreich",         short: "Erledigt",    c: "#a8d8a0" },
  warning:     { label: "Warnung",             short: "Warnung",     c: "#ffc24a" },
  blocked:     { label: "Blockiert",           short: "Blockiert",   c: "#ff7a4d" },
  failed:      { label: "Fehlgeschlagen",      short: "Fehler",      c: "#ff4f4f" },
  resumed:     { label: "Fortgesetzt",         short: "Fortgesetzt", c: "#6cd3ff", pulse: true },
  interrupted: { label: "Unterbrochen",        short: "Pausiert",    c: "#b7a1e0" },
};

/** @typedef {'idle'|'listening'|'thinking'|'analyzing'|'speaking'} VoiceState */
const VOICE_WORD = { idle: "BEREIT", listening: "HÖRT", thinking: "DENKT", analyzing: "ANALYSIERT", speaking: "SPRICHT" };
const VOICE_CAPTION = {
  idle: "JARVIS wartet auf deinen Befehl",
  listening: "JARVIS hört zu …",
  thinking: "JARVIS denkt …",
  analyzing: "JARVIS analysiert …",
  speaking: "JARVIS spricht …",
};

const PIPE = [
  { k: "user",   n: "Du",          d: "Auftrag" },
  { k: "hermes", n: "Hermes",      d: "Orchestrierung" },
  { k: "astra",  n: "Astra",       d: "Reasoning & Kontrolle" },
  { k: "claude", n: "Claude Code", d: "Umsetzung" },
  { k: "bridge", n: "Bridge",      d: "Sicherheit & Evidence" },
  { k: "git",    n: "Git",         d: "Truth Layer" },
  { k: "review", n: "Review",      d: "Deine Freigabe" },
];
const STAGE_NOTE = {
  1: "Hermes routet den Auftrag", 2: "Astra plant und prüft Risiken", 3: "Claude Code setzt um",
  4: "Bridge prüft Policy und Evidence", 5: "Git committet und synchronisiert", 6: "Bereit für deine Review",
};

const SRC = { jarvis: "JARVIS", hermes: "Hermes", astra: "Astra", claude: "Claude Code", bridge: "Bridge", git: "Git" };
const LVL = {
  info: { n: "Info", c: "#a3968a" }, ok: { n: "OK", c: "#a8d8a0" }, warn: { n: "Warnung", c: "#ffc24a" },
  error: { n: "Fehler", c: "#ff5d4f" }, evidence: { n: "Evidence", c: "#6cd3ff" },
};
const RISK = { niedrig: { c: "#a8d8a0", n: 1 }, mittel: { c: "#ffc24a", n: 2 }, hoch: { c: "#ff5d4f", n: 3 } };

/* helpers */
let _seq = 0;
const uid = () => `k${Date.now().toString(36)}${(_seq++).toString(36)}`;
const p2 = (n) => String(n).padStart(2, "0");
const hms = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const nowHMS = () => hms(new Date());
const nowHM = () => nowHMS().slice(0, 5);
const ago = (min, sec = 0) => hms(new Date(Date.now() - (min * 60 + sec) * 1000));
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const isActive = (r) => r.state === "running" || r.state === "resumed";
const isPending = (a) => a.status === "pending" || a.status === "later";
const WD = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const MO = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
const fmtDate = (d) => `${WD[d.getDay()]}, ${p2(d.getDate())}. ${MO[d.getMonth()]} ${d.getFullYear()}`;
const greeting = () => { const h = new Date().getHours(); return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend"; };

/* ── 02 DATA CONTRACTS + MOCKS ────────────────────────────────────────── */
/**
 * @typedef {{id:string,title:string,project:string,worker:string,state:RunState,progress:number,
 *            stage:number,note:string,started:string,live?:boolean,speed?:number}} Run
 * @typedef {{id:string,t:string,src:keyof SRC,lvl:keyof LVL,msg:string,run?:string,
 *            ev?:{hash?:string,checks?:string[],trace?:string}}} LogEvent
 * @typedef {{id:string,title:string,run:string|null,risk:'niedrig'|'mittel'|'hoch',reason:string,scope:string,
 *            systems:string[],action:string,requested:string,status:'pending'|'later'|'approved'|'rejected',decided?:string}} Approval
 */

const PROJECTS = [
  { id: "jarvis", name: "JARVIS", tag: "Intern", desc: "Command Center, Memory, Runtime-Adapter. Das Zuhause von JARVIS.", branch: "feature/command-center-v1", last: "vor 1 Min." },
  { id: "aurentara", name: "AURENTARA", tag: "Marke", desc: "Website und Content. Launch-Copy wartet auf Freigabe.", branch: "copy/landing-v2", last: "vor 14 Min." },
  { id: "hamyren", name: "HAMYREN", tag: "Plattform", desc: "Staging-Umgebung. Deploy blockiert, bis der Scope freigegeben ist.", branch: "release/staging", last: "vor 9 Min." },
  { id: "riosystems", name: "RIOSYSTEMS", tag: "Automation", desc: "Lead- und Automations-Systeme. Pipeline-Refactor ist gemerged.", branch: "main", last: "vor 35 Min." },
  { id: "lunara", name: "Lunara", tag: "Stories", desc: "Personalisierte Gute-Nacht-Geschichten. Landingpage und Automations-Pipeline.", branch: "fix/webhook-retry", last: "vor 22 Min." },
  { id: "bts", name: "Bio Techno Society", tag: "Community", desc: "Marke, Events, Community. Landingpage steht, weitere Seiten offen.", branch: "draft/event-page", last: "gestern" },
];
const projName = (id) => PROJECTS.find((p) => p.id === id)?.name || id;

/* Service rows for the System Status section. Status, colour and pulse now come
   from Runtime Truth (see rtServiceStatus); no static latency / heartbeat /
   uptime / usage / "last event" values are kept here. `seed` only feeds the
   decorative flat sparkline baseline. */
const SERVICES = [
  { k: "hermes", n: "Hermes", role: "Orchestrierung", seed: 3 },
  { k: "astra", n: "Astra", role: "Reasoning & Kontrolle", seed: 7 },
  { k: "claude", n: "Claude Worker", role: "Umsetzung", seed: 11 },
  { k: "bridge", n: "Bridge", role: "Sicherheit & Evidence", seed: 5 },
  { k: "git", n: "Git", role: "Truth Layer", seed: 9 },
];
const USAGE = [
  { n: "Claude Worker, Tageslimit", v: 62, warn: 80 },
  { n: "Astra Reasoning", v: 38, warn: 80 },
  { n: "Bridge Evidence-Speicher", v: 21, warn: 90 },
];
const NOTICES = [
  { lvl: "warn", t: "Bridge hat einen Schreibzugriff außerhalb des Scopes blockiert", d: "R-0140 wollte /srv/hamyren/.env schreiben. Freigabe A-030 ist angelegt." },
  { lvl: "info", t: "Claude Worker bei 62 % des Tageslimits", d: "Warnschwelle liegt bei 80 %. Hochrechnung für heute: 74 %." },
  { lvl: "ok", t: "Keine Secrets in Diffs der letzten 24 Stunden", d: "214 Prüfungen, alle bestanden." },
];


const MEM_CATS = [["all", "Alle"], ["profil", "Über dich"], ["setup", "Setup"], ["projekte", "Projekte"], ["ziele", "Ziele"], ["regeln", "Regeln"], ["routinen", "Routinen"]];
const MEMORY = [
  { c: "profil", k: "Operator", v: "Rio baut Web- und Automationsprojekte eigenständig, von Frontend bis No-/Low-Code.", src: "Gespräch", upd: "vor 3 Tagen" },
  { c: "profil", k: "Arbeitsweise", v: "Pragmatisch und strukturiert. Umsetzen statt endlos erklären.", src: "Masterprompt", upd: "heute" },
  { c: "setup", k: "Pipeline", v: "Du, Hermes, Astra, Claude Code, Bridge, Git, Review. Jeder Schritt hinterlässt Evidence.", src: "System", upd: "heute" },
  { c: "setup", k: "Runtime", v: "Die V5-Runtime läuft separat. Das Command Center liest nur und greift nicht ein.", src: "Policy", upd: "heute", lock: true },
  { c: "setup", k: "Worker", v: "Zwei parallele Claude-Code-Slots. Kein Commit ohne Evidence-Paket.", src: "Bridge", upd: "vor 2 Tagen" },
  { c: "projekte", k: "JARVIS", v: "Command Center V1: ein festes Zuhause, raus aus der Werkstatt.", src: "R-0142", upd: "vor 1 Min." },
  { c: "projekte", k: "Lunara", v: "Personalisierte Gute-Nacht-Geschichten. Landingpage und Automations-Pipeline.", src: "Gespräch", upd: "vor 1 Woche" },
  { c: "projekte", k: "Bio Techno Society", v: "Marke, Events, Community. Landingpage steht, weitere Seiten offen.", src: "Gespräch", upd: "vor 2 Wochen" },
  { c: "ziele", k: "Nordstern", v: "JARVIS erledigt echte Arbeit: nachvollziehbar, belegt, von dir freigegeben.", src: "Masterprompt", upd: "heute" },
  { c: "ziele", k: "Qualität", v: "Premium, ruhig, klar. Nichts Generisches, nichts Verspieltes.", src: "Masterprompt", upd: "heute" },
  { c: "regeln", k: "Freigabe", v: "Kein Deploy, keine DNS-Änderung, keine Produktion ohne deine ausdrückliche Freigabe.", src: "Policy", upd: "heute", lock: true },
  { c: "regeln", k: "Kosten", v: "Keine neuen kostenpflichtigen Dienste ohne Freigabe.", src: "Policy", upd: "heute", lock: true },
  { c: "regeln", k: "Wahrheit", v: "Git ist der Truth Layer. Was nicht committet und belegt ist, gilt nicht als erledigt.", src: "Policy", upd: "vor 5 Tagen", lock: true },
  { c: "routinen", k: "Nightly", v: "Dependency-Audit über alle Repos, täglich um 02:00.", src: "Scheduler", upd: "gestern" },
  { c: "routinen", k: "Evidence-Rotation", v: "Evidence-Pakete 30 Tage aufbewahren, danach archivieren.", src: "Bridge", upd: "vor 1 Monat" },
];

const SUGG = ["Systemstatus", "Was steht heute an?", "Freigaben prüfen", "Repo-Diff zusammenfassen"];

function init() {
  // No seeded operational data. Runs / Activity / Approvals / Evidence are
  // populated from GET <apiBase>/runtime-truth (real persisted JARVIS audit
  // projection). Locally-added optimistic runs from this session's own commands
  // are marked { local: true } and merged on top by syncRuntimeTruth().
  return {
    view: "home", voice: "idle", utterance: "", utterId: 0,
    messages: [], runs: [], approvals: [], logs: [], evidence: [],
    taskFilter: "all", projectFilter: null, selRun: null,
    logFilter: { src: "all", lvl: "all", run: null, q: "" }, memCat: "all",
    rtMeta: { loaded: false, systemsReal: false, runsReal: false, activityReal: false, approvalsReal: false, evidenceReal: false, sourceState: null },
  };
}

/* ── 03 MOCK RUNTIME ──────────────────────────────────────────────────── */
function reducer(s, a) {
  switch (a.type) {
    case "NAV": return { ...s, view: a.view, ...(a.patch || {}) };
    case "PATCH": return { ...s, ...a.patch };
    case "VOICE": return { ...s, voice: a.voice };
    case "IDLE_IF": return s.utterId === a.id && s.voice === "speaking" ? { ...s, voice: "idle" } : s;
    case "SAY": return { ...s, utterance: a.text, utterId: a.id };
    case "MSG": return { ...s, messages: [...s.messages, a.msg] };
    case "LOG": return { ...s, logs: [{ id: uid(), t: nowHMS(), ...a.log }, ...s.logs].slice(0, 200) };
    case "ADD_RUN": return { ...s, runs: [a.run, ...s.runs] };
    case "RUN": return { ...s, runs: s.runs.map((r) => (r.id === a.id ? { ...r, ...a.patch } : r)) };
    case "ADD_APPROVAL": return { ...s, approvals: [a.ap, ...s.approvals] };
    case "DECIDE": {
      // Only session-local approvals can be decided in the UI; a projected
      // approval's decision must go through the runtime (Wave 6+). No run state
      // or worker is fabricated here.
      const ap = s.approvals.find((x) => x.id === a.id);
      if (!ap || ap.local !== true) return s;
      let approvals = s.approvals.map((x) => (x.id === a.id ? { ...x, status: a.decision, decided: nowHM() } : x));
      if (a.decision === "later") approvals = [...approvals.filter((x) => x.id !== a.id), approvals.find((x) => x.id === a.id)];
      return { ...s, approvals };
    }
    case "APPROVAL_PENDING":
      return { ...s, approvals: s.approvals.map((x) => (x.id === a.id ? { ...x, deciding: a.decision } : x)) };
    case "APPROVAL_DECIDED":
      return { ...s, approvals: s.approvals.map((x) => (x.id === a.id
        ? { ...x, deciding: null, status: a.decision === "approve" ? "approved" : a.decision === "reject" ? "rejected" : "later", decided: nowHM(), gate_status: a.gate_status || null }
        : x)) };
    case "APPROVAL_DECISION_FAILED":
      return { ...s, approvals: s.approvals.map((x) => (x.id === a.id ? { ...x, deciding: null, decide_error: a.error } : x)) };
    case "SYNC_RT": return { ...s, ...a.patch };
    default: return s;
  }
}

/* ── 04 PRIMITIVES ────────────────────────────────────────────────────── */
function Dot({ state, color, pulse }) {
  const m = STATE[state] || {};
  const c = color || m.c || "#ffab40";
  return <span className={`dot${(pulse ?? m.pulse) ? " pulse" : ""}${m.ring ? " ring" : ""}`} style={{ "--c": c }} />;
}
function Chip({ state, small, label }) {
  const m = STATE[state] || STATE.idle;
  return (
    <span className={`chip${small ? " sm" : ""}`} style={{ color: m.c, borderColor: hexA(m.c, 0.36), background: hexA(m.c, 0.07) }}>
      <Dot state={state} />{label || (small ? m.short : m.label)}
    </span>
  );
}
function Panel({ title, right, children, className = "", area, style }) {
  return (
    <section className={`pnl ${className}`} style={{ gridArea: area, ...style }}>
      {title && <header className="pnl-h"><h3 className="pnl-t">{title}</h3>{right}</header>}
      {children}
    </section>
  );
}
function LiveTag({ label = "Live", color = "#ffab40", pulse = true }) {
  return <span className="tag" style={{ color }}><Dot color={color} pulse={pulse} />{label}</span>;
}
function PageHead({ title, sub, right }) {
  return (
    <div className="ph">
      <div><h1 className="ph-t">{title}</h1>{sub && <p className="ph-s">{sub}</p>}</div>
      {right}
    </div>
  );
}
function useNow(ms = 1000) {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setN(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return n;
}
function useWidth(ref) {
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ── RUNTIME TRUTH — System Status only ───────────────────────────────────
   The System Status section is the ONLY part wired to a real backend.
   Source: GET <apiBase>/runtime-truth (canonical fail-closed snapshot).
   Rules: render a live state only when systems.source.classification is
   REAL or DERIVED; every UNKNOWN / non-canonical case renders
   "Nicht verbunden". No fake latency / usage / uptime / heartbeat /
   timestamps are shown for a service. Runs / Activity / Approvals / Limits
   / Notices stay mock until their own waves. */
const RT_API_BASE = () =>
  (typeof window !== "undefined" && window.__JARVIS_CC__ && window.__JARVIS_CC__.apiBase) || "/api";
const RT_SYS_KEY = { hermes: "HERMES", astra: "ASTRA", claude: "CLAUDE", bridge: "BRIDGE", git: "GIT" };
const RT_STATE_LABEL = {
  ONLINE: "Online", AVAILABLE: "Verfügbar", HEALTHY: "Gesund", SYNCED: "Synchron",
  STANDBY: "Bereit", ACTIVE: "Aktiv", BUSY: "Ausgelastet",
  DEGRADED: "Eingeschränkt", CHANGED: "Abweichung", OFFLINE: "Offline", UNAVAILABLE: "Nicht verfügbar",
};
const RT_STATE_COLOR = {
  ONLINE: "#a8d8a0", AVAILABLE: "#a8d8a0", HEALTHY: "#a8d8a0", SYNCED: "#a8d8a0", STANDBY: "#a8d8a0", ACTIVE: "#a8d8a0",
  BUSY: "#ffc24a", DEGRADED: "#ffc24a", CHANGED: "#ffc24a", OFFLINE: "#ff5d4f", UNAVAILABLE: "#ff5d4f",
};
const _RT_EMPTY = {
  loaded: false, ok: false, canonical: false, data: {}, source: null,
  runs: { real: false, items: [] }, activity: { real: false, items: [] },
  approvals: { real: false, items: [], pending: 0 }, evidence: { real: false, items: [] },
  commandChain: null,
};
const _RT = { state: _RT_EMPTY, subs: new Set(), started: false, iv: null };
function _rtPublish(next) { _RT.state = next; _RT.subs.forEach((fn) => { try { fn(next); } catch {} }); }
function _domainReal(d) {
  const c = d && d.source && d.source.classification;
  return c === "REAL" || c === "DERIVED";
}
async function _rtLoad() {
  try {
    const r = await fetch(`${RT_API_BASE()}/runtime-truth`, { headers: { accept: "application/json" }, credentials: "same-origin" });
    const b = await r.json().catch(() => ({}));
    const source = (b && b.systems && b.systems.source) || null;
    const canonical = !!source && (source.classification === "REAL" || source.classification === "DERIVED");
    const dom = (name) => (b && b[name]) || {};
    _rtPublish({
      loaded: true,
      ok: r.ok === true && b && b.ok === true,
      canonical,
      data: canonical && b.systems.data && typeof b.systems.data === "object" ? b.systems.data : {},
      source,
      runs: { real: _domainReal(dom("runs")), items: (dom("runs").data && dom("runs").data.items) || [] },
      activity: { real: _domainReal(dom("activity")), items: (dom("activity").data && dom("activity").data.items) || [] },
      approvals: {
        real: _domainReal(dom("approvals")),
        items: (dom("approvals").data && dom("approvals").data.items) || [],
        pending: (dom("approvals").data && dom("approvals").data.pending_count) || 0,
      },
      evidence: { real: _domainReal(dom("evidence")), items: (dom("evidence").data && dom("evidence").data.items) || [] },
      commandChain: (b && b.command_chain) || null,
    });
  } catch {
    _rtPublish({ ..._RT_EMPTY, loaded: true });
  }
}
function useRuntimeTruth() {
  const [st, setSt] = useState(_RT.state);
  useEffect(() => {
    _RT.subs.add(setSt);
    if (!_RT.started) {
      _RT.started = true;
      _rtLoad();
      _RT.iv = setInterval(_rtLoad, 20000);
    }
    return () => { _RT.subs.delete(setSt); };
  }, []);
  return st;
}
/** Map one service row to a runtime-truth status. Fail-closed to "Nicht verbunden". */
function rtServiceStatus(rt, serviceKey) {
  const sys = RT_SYS_KEY[serviceKey];
  const raw = rt.canonical && sys ? String(rt.data[sys] || "UNKNOWN").toUpperCase() : "UNKNOWN";
  if (!raw || raw === "UNKNOWN") {
    return { known: false, raw: "UNKNOWN", label: "Nicht verbunden", color: "#a3968a", pulse: false };
  }
  return {
    known: true,
    raw,
    label: RT_STATE_LABEL[raw] || raw,
    color: RT_STATE_COLOR[raw] || "#ffc24a",
    pulse: raw === "BUSY" || raw === "ACTIVE",
  };
}
function RuntimeBadge() {
  const rt = useRuntimeTruth();
  const live = rt.loaded && (rt.canonical || rt.runs.real || rt.activity.real);
  const txt = !rt.loaded
    ? "Runtime wird geprüft …"
    : live
      ? "Live-Daten aus Runtime Truth · restliche Bereiche Mock"
      : "Runtime nicht verbunden · fail-closed";
  return <span className="mock">{txt}</span>;
}

/* ── Runtime-truth → view-model mappers (System Status stays in rtServiceStatus) ── */
const RT_RUN_STATE = {
  QUEUED: "scheduled", RUNNING: "running", WAITING_APPROVAL: "waiting", COMPLETE: "success",
  FAILED: "failed", BLOCKED: "blocked", INTERRUPTED: "interrupted", RESUMED: "resumed",
};
const RT_LOG_LEVEL = { COMPLETED: "ok", COMPLETE: "ok", FAILED: "error", ERROR: "error", BLOCKED: "warn", SECURITY_VIOLATION: "warn", PENDING: "info" };
const RT_APPROVAL_STATUS = { GRANTED: "approved", REVOKED: "rejected", EXPIRED: "rejected", PENDING: "pending", UNKNOWN: "pending" };
const hm = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "–" : `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const hmsIso = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? nowHMS() : hms(d); };

function rtRunToLocal(r) {
  const state = RT_RUN_STATE[String(r.status || "").toUpperCase()] || "scheduled";
  return {
    id: r.id, title: r.title || r.id, project: "jarvis",
    worker: r.worker || "JARVIS Runtime", state,
    progress: 0, stage: 0, note: r.approval_state ? `Freigabe: ${r.approval_state}` : (r.status || ""),
    started: r.started_at ? hm(r.started_at) : "–",
    updated_at: r.updated_at || null, live: false, real: true,
    evidence_ref: r.evidence_ref || null, approval_state: r.approval_state || null,
  };
}
function rtEvidenceToUi(e) {
  const checks = [];
  if (e.worker_verified) checks.push("Worker meldet: verifiziert (keine unabhängige Abnahme)");
  if (e.independent_acceptance && e.acceptance_ref) checks.push(`Unabhängige Abnahme: ${e.acceptance_ref}`);
  if (e.status) checks.push(`Status: ${e.status}`);
  return {
    hash: e.evidence_id,
    checks: checks.length ? checks : undefined,
    kind: e.kind || null,
    independent_acceptance: e.independent_acceptance === true,
  };
}
function rtActivityToLog(a, evByRef) {
  const ev = a.evidence_ref && evByRef && evByRef[a.evidence_ref] ? rtEvidenceToUi(evByRef[a.evidence_ref]) : undefined;
  return {
    id: `rt-${a.at}-${a.event}`, t: hmsIso(a.at),
    src: "jarvis", lvl: ev ? "evidence" : (RT_LOG_LEVEL[String(a.status || "").toUpperCase()] || "info"),
    msg: a.summary || a.event || "Runtime-Ereignis", run: a.run_id || null, ev, real: true,
  };
}
function rtApprovalToLocal(a) {
  const risk = ["niedrig", "mittel", "hoch"].includes(a.risk) ? a.risk : null;
  return {
    id: a.approval_id, title: a.approval_type || "Freigabe", run: a.run_id || null,
    risk, reason: a.reason || "", scope: a.scope_key || "", systems: a.capability ? [a.capability] : [],
    action: "", requested: a.requested_at ? hm(a.requested_at) : "–",
    status: RT_APPROVAL_STATUS[String(a.state || "").toUpperCase()] || "pending",
    decided: a.state === "GRANTED" || a.state === "REVOKED" ? (a.requested_at ? hm(a.requested_at) : "") : undefined,
    real: true,
  };
}
function syncRuntimeTruthPatch(rt, prev) {
  const rtRuns = rt.runs.real ? rt.runs.items.map(rtRunToLocal) : [];
  const localRuns = (prev.runs || []).filter((r) => r.local === true && !rtRuns.some((x) => x.id === r.id));
  const runs = [...localRuns, ...rtRuns];
  const evByRef = {};
  if (rt.evidence.real) for (const e of rt.evidence.items) if (e && e.evidence_id) evByRef[e.evidence_id] = e;
  const logs = rt.activity.real ? rt.activity.items.map((a) => rtActivityToLog(a, evByRef)) : [];
  const approvals = rt.approvals.real ? rt.approvals.items.map(rtApprovalToLocal) : [];
  const evidence = rt.evidence.real ? rt.evidence.items.slice() : [];
  return {
    runs, logs, approvals, evidence,
    selRun: prev.selRun && runs.some((r) => r.id === prev.selRun) ? prev.selRun : (runs[0] ? runs[0].id : null),
    rtMeta: {
      loaded: rt.loaded,
      systemsReal: rt.canonical,
      runsReal: rt.runs.real,
      activityReal: rt.activity.real,
      approvalsReal: rt.approvals.real,
      evidenceReal: rt.evidence.real,
      sourceState: rt.source && rt.source.source_state ? rt.source.source_state : null,
    },
  };
}
/** One honest line for a domain that is not connected / empty / loading. */
function RtNote({ meta, real, count, loadingText = "Runtime wird geladen …", emptyText = "Noch keine Daten", offText = "Nicht verbunden" }) {
  if (!meta || !meta.loaded) return <div className="empty">{loadingText}</div>;
  if (!real) return <div className="empty">{offText}</div>;
  if (!count) return <div className="empty">{emptyText}</div>;
  return null;
}

/* ── 05 SIGNATURE VISUALS ─────────────────────────────────────────────── */
function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w, h, stars = [], raf, last = 0;
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((w * h) / 8500) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.1 + 0.25,
        p: Math.random() * 6.28, s: 0.4 + Math.random() * 1.4, a: Math.random() < 0.14,
      }));
    };
    resize(); window.addEventListener("resize", resize);
    const still = reducedMotion();
    const draw = (t) => {
      if (!still) raf = requestAnimationFrame(draw);
      if (t - last < 60 && !still) return; last = t;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const al = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.s + s.p));
        ctx.fillStyle = s.a ? `rgba(255,170,80,${al})` : `rgba(255,238,220,${al * 0.55})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="stars" aria-hidden="true" />;
}

const ENERGY = { idle: 0.25, listening: 0.55, thinking: 0.7, analyzing: 0.85, speaking: 1 };

function OrbCanvas({ size, voice }) {
  const ref = useRef(null);
  const vr = useRef(voice); vr.current = voice;
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr; cv.height = size * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const N = 1100, pts = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()]);
    }
    const R = size * 0.3, cx = size / 2, cy = size / 2;
    let raf, rot = 0, e = 0.4;
    const still = reducedMotion();
    const draw = (t) => {
      e += ((ENERGY[vr.current] ?? 0.3) - e) * 0.04;
      rot += still ? 0 : 0.0014 + e * 0.0035;
      ctx.clearRect(0, 0, size, size);
      const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.55);
      g.addColorStop(0, `rgba(255,150,50,${0.22 + e * 0.18})`);
      g.addColorStop(0.45, `rgba(255,110,20,${0.07 + e * 0.07})`);
      g.addColorStop(1, "rgba(255,100,20,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2); ctx.fill();
      const b = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R);
      b.addColorStop(0, "rgba(90,44,12,0.96)"); b.addColorStop(0.65, "rgba(34,15,4,0.97)"); b.addColorStop(1, `rgba(150,70,18,${0.9})`);
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.shadowColor = "rgba(255,170,70,0.9)"; ctx.shadowBlur = 18 + e * 14;
      ctx.strokeStyle = `rgba(255,196,120,${0.55 + e * 0.35})`; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
      const c = Math.cos(rot), s = Math.sin(rot), ct = Math.cos(0.38), st = Math.sin(0.38);
      for (const p of pts) {
        const x = p[0] * c - p[2] * s, z = p[0] * s + p[2] * c;
        const y2 = p[1] * ct - z * st, z2 = p[1] * st + z * ct;
        const depth = (z2 + 1) / 2;
        const tw = 0.65 + 0.35 * Math.sin(t * 0.002 + p[3] * 30);
        const hot = p[3] > 0.975;
        const a = Math.min(1, (0.05 + depth * 0.8) * tw * (0.55 + e * 0.55) + (hot ? 0.25 : 0));
        const sz = 0.5 + depth * 1.15 + (hot ? 1.1 : 0);
        ctx.fillStyle = hot ? `rgba(255,236,196,${a})` : `rgba(255,${140 + Math.round(depth * 70)},${60 + Math.round(depth * 30)},${a})`;
        ctx.fillRect(cx + x * R - sz / 2, cy + y2 * R - sz / 2, sz, sz);
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} aria-hidden="true" />;
}

const BEAM_AMP = { idle: 0.12, listening: 0.6, thinking: 0.3, analyzing: 0.45, speaking: 1 };
function Beam({ w, h, r, voice }) {
  const ref = useRef(null);
  const vr = useRef(voice); vr.current = voice;
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cy = h / 2, cx = w / 2, nodes = [cx - r * 1.3, cx + r * 1.3], sig = r * 0.3;
    let raf, e = 0.3;
    const still = reducedMotion();
    const draw = (t) => {
      e += ((BEAM_AMP[vr.current] ?? 0.2) - e) * 0.05;
      ctx.clearRect(0, 0, w, h);
      const lg = ctx.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(255,150,50,0)"); lg.addColorStop(0.5, "rgba(255,200,130,0.95)"); lg.addColorStop(1, "rgba(255,150,50,0)");
      ctx.fillStyle = lg; ctx.fillRect(0, cy - 0.6, w, 1.2);
      ctx.globalAlpha = 0.25; ctx.fillRect(0, cy - 3, w, 6); ctx.globalAlpha = 1;
      for (let L = 0; L < 4; L++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          let env = 0;
          for (const nx of nodes) env += Math.exp(-((x - nx) ** 2) / (2 * sig * sig));
          env += Math.exp(-((x - cx) ** 2) / (2 * (w * 0.3) ** 2)) * 0.18;
          const amp = env * h * 0.17 * e * (1 - L * 0.18);
          const y = cy + Math.sin(x * 0.085 * (1 + L * 0.33) + t * 0.006 * (1 + L * 0.25) + L * 1.7) * amp * (0.55 + 0.45 * Math.sin(t * 0.0019 + L * 2));
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255,${165 + L * 18},${70 + L * 25},${0.75 - L * 0.15})`;
        ctx.lineWidth = L === 0 ? 1.4 : 0.8;
        ctx.shadowColor = "rgba(255,150,50,0.9)"; ctx.shadowBlur = L === 0 ? 10 : 0;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [w, h, r]);
  return <canvas ref={ref} className="beam" style={{ width: w, height: h }} aria-hidden="true" />;
}

function OrbStage({ voice }) {
  const wrap = useRef(null);
  const w = useWidth(wrap);
  const roomy = w > 560;
  const size = Math.round(Math.max(250, Math.min(480, w - (roomy ? 160 : 20))));
  const cx = w / 2, cy = size / 2, R1 = size * 0.47, R2 = size * 0.405, R3 = size * 0.355;
  const C2 = 2 * Math.PI * R2;
  const nodes = [
    { k: "thinking", lab: "Denkt", x: cx, y: cy - R1, tx: cx, ty: cy - R1 - 14, a: "middle" },
    { k: "analyzing", lab: "Analysiert", x: cx + R1, y: cy, tx: roomy ? cx + R1 + 14 : cx + R1 - 8, ty: roomy ? cy - 10 : cy - 14, a: roomy ? "start" : "end" },
    { k: "speaking", lab: "Antwortet", x: cx, y: cy + R1, tx: cx, ty: cy + R1 + 24, a: "middle" },
    { k: "listening", lab: "Hört", x: cx - R1, y: cy, tx: roomy ? cx - R1 - 14 : cx - R1 + 8, ty: roomy ? cy - 10 : cy - 14, a: roomy ? "end" : "start" },
  ];
  const word = VOICE_WORD[voice];
  const fs = size * 0.064 * (word.length > 7 ? 0.74 : 1);
  const busy = voice !== "idle";
  return (
    <div ref={wrap} className="stage" style={{ height: size + 30 }} role="img" aria-label={`JARVIS Zustand: ${word}`}>
      <div className="stage-in" style={{ height: size }}>
        <Beam w={w} h={size} r={size * 0.3} voice={voice} />
        <div className="orb-wrap" style={{ left: cx - size / 2, width: size, height: size }}>
          <OrbCanvas size={size} voice={voice} />
        </div>
        <svg className="rings" width={w} height={size} aria-hidden="true">
          <circle cx={cx} cy={cy} r={R1} className="r-base" />
          <circle cx={cx} cy={cy} r={R1 + 9} className="r-tick" />
          <circle cx={cx} cy={cy} r={R3} className="r-faint" />
          <g className={`ring-rot${busy ? " fast" : ""}`} style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <circle cx={cx} cy={cy} r={R2} className="r-arc" strokeDasharray={`${C2 * 0.2} ${C2 * 0.3}`} />
          </g>
          <g className="ring-rot rev" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <circle cx={cx} cy={cy} r={R2 - 8} className="r-arc2" strokeDasharray={`${C2 * 0.04} ${C2 * 0.21}`} />
          </g>
          {nodes.map((n) => {
            const on = voice === n.k;
            return (
              <g key={n.k} className={on ? "node on" : "node"}>
                {on && <circle cx={n.x} cy={n.y} r={13} className="node-halo" />}
                <circle cx={n.x} cy={n.y} r={on ? 5.5 : 4} className="node-dot" />
                <text x={n.tx} y={n.ty} textAnchor={n.a} className="node-t">{n.lab.toUpperCase()}</text>
              </g>
            );
          })}
        </svg>
        <div className="orb-center">
          <div className="orb-word" style={{ fontSize: fs }}>{word}</div>
          <div className="orb-sub">{voice === "idle" ? "Wartet auf Befehl" : "JARVIS aktiv"}</div>
        </div>
      </div>
    </div>
  );
}

function Spoken({ text, id }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reducedMotion()) { setN(text.length); return; }
    setN(0);
    const iv = setInterval(() => setN((x) => { if (x >= text.length) { clearInterval(iv); return x; } return x + 1; }), 30);
    return () => clearInterval(iv);
  }, [id, text]);
  const done = n >= text.length;
  return (
    <p className="spoken" aria-live="polite">
      „{text.slice(0, n)}{!done && <span className="caret" />}{done && "“"}
    </p>
  );
}

function VoiceBars({ voice }) {
  const bars = useMemo(() => Array.from({ length: 61 }, (_, i) => {
    const d = Math.abs(i - 30) / 30, env = Math.pow(1 - d, 1.7);
    return { h: 3 + env * 32, d: (0.3 + Math.random() * 0.55).toFixed(2), dl: (-Math.random()).toFixed(2) };
  }), []);
  const on = voice === "speaking" || voice === "listening";
  return (
    <div className={`vbars${on ? " on" : ""}`} aria-hidden="true">
      {bars.map((b, i) => <i key={i} style={{ "--h": `${b.h}px`, "--d": `${b.d}s`, "--dl": `${b.dl}s` }} />)}
    </div>
  );
}

function CommandBar({ onSend, voice, onMic, inputRef, suggestions, compact }) {
  const [v, setV] = useState("");
  const busy = voice === "thinking" || voice === "analyzing";
  const send = () => { if (!v.trim() || busy) return; onSend(v); setV(""); };
  return (
    <div className={`cmdwrap${compact ? " compact" : ""}`}>
      <div className="cmd">
        <span className="cmd-k" aria-hidden="true">›</span>
        <input ref={inputRef} value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Sag JARVIS, was zu tun ist …" aria-label="Befehl an JARVIS" />
        <button className={`ibtn${voice === "listening" ? " on" : ""}`} onClick={onMic} title="Spracheingabe (Vorschau, noch nicht verbunden)" aria-label="Spracheingabe"><Mic size={16} /></button>
        <button className="ibtn send" disabled={!v.trim() || busy} onClick={send} title="Senden" aria-label="Senden"><ArrowUp size={17} /></button>
      </div>
      {suggestions && (
        <div className="sugg">
          {suggestions.map((x) => <button key={x} onClick={() => onSend(x)} disabled={busy}>{x}</button>)}
        </div>
      )}
    </div>
  );
}

/* ── 06 SHELL ─────────────────────────────────────────────────────────── */
const NAV = [
  ["home", "Home", Home], ["chat", "Chat", MessageSquare], ["tasks", "Tasks", ListChecks],
  ["projects", "Projekte", FolderKanban], ["memory", "Memory", Brain], ["approvals", "Freigaben", ShieldCheck],
  ["system", "System", Cpu], ["logs", "Logs", ScrollText],
];
const TITLES = { home: "Command Center", chat: "Chat", tasks: "Tasks", projects: "Projekte", memory: "Memory", approvals: "Freigaben", system: "System", logs: "Logs" };

function Sidebar({ s, go }) {
  const badges = { tasks: s.runs.filter(isActive).length, approvals: s.approvals.filter(isPending).length };
  return (
    <aside className="side">
      <button className="logo-b" onClick={() => go("home")} aria-label="JARVIS Home">
        <div className="logo">JARVIS</div>
        <div className="logo-sub">Command Center</div>
      </button>
      <div className="side-orb">
        <span className={`mini-orb${s.voice !== "idle" ? " live" : ""}`} />
        <div>
          <div className="so-w">{VOICE_WORD[s.voice]}</div>
          <div className="so-s">{s.voice === "idle" ? "Bereit" : "Aktiv"}</div>
        </div>
      </div>
      <nav className="nav" aria-label="Hauptnavigation">
        {NAV.map(([id, label, Icon]) => (
          <button key={id} className={`nav-i${s.view === id ? " on" : ""}`} onClick={() => go(id)} aria-current={s.view === id ? "page" : undefined}>
            <Icon size={16} strokeWidth={1.6} />
            <span>{label}</span>
            {badges[id] ? <span className="badge">{badges[id]}</span> : null}
          </button>
        ))}
      </nav>
      <div className="side-f">
        <LiveTag
          label={!s.rtMeta?.loaded ? "Prüft …" : (s.rtMeta?.runsReal || s.rtMeta?.activityReal) ? "Runtime Truth" : "Nicht verbunden"}
          color={(s.rtMeta?.runsReal || s.rtMeta?.activityReal) ? "#ffab40" : "#a3968a"}
          pulse={false}
        />
        <div className="side-v">V1 · System Status,<br />Runs, Aktivität live</div>
      </div>
    </aside>
  );
}

function TopClock() {
  const n = useNow();
  return <div className="tclock"><span className="tc-l">Intelligence in real time</span><span className="tc-t">{hms(n)}</span></div>;
}

function MobileTop({ s }) {
  const n = useNow(10000);
  return (
    <div className="mtop">
      <div><div className="logo sm">JARVIS</div></div>
      <div className="mtop-r"><span className={`mini-orb sm${s.voice !== "idle" ? " live" : ""}`} /><span className="mono">{p2(n.getHours())}:{p2(n.getMinutes())}</span></div>
    </div>
  );
}

function MobileNav({ s, go }) {
  const pend = s.approvals.filter(isPending).length;
  return (
    <nav className="mnav" aria-label="Navigation">
      {NAV.map(([id, label, Icon]) => (
        <button key={id} className={s.view === id ? "on" : ""} onClick={() => go(id)} aria-current={s.view === id ? "page" : undefined}>
          <Icon size={18} strokeWidth={1.6} /><span>{label}</span>
          {id === "approvals" && pend > 0 && <em className="b" />}
        </button>
      ))}
    </nav>
  );
}

/* ── 07 VIEWS ─────────────────────────────────────────────────────────── */

/* HOME */
function Hero({ active, pending, meta }) {
  const n = useNow();
  const runsReal = meta && meta.runsReal;
  const apprReal = meta && meta.approvalsReal;
  const lights = useMemo(() => {
    const out = [];
    while (out.length < 110) {
      const x = Math.random() * 100, y = Math.random() * 34;
      const bias = x > 45 ? 1 : 0.35;
      if ((x - 50) ** 2 + (y - 50) ** 2 < 47 ** 2 && Math.random() < bias) out.push({ x, y, s: Math.random() < 0.1 ? 3 : Math.random() * 1.6 + 0.6, o: 0.35 + Math.random() * 0.65 });
    }
    return out;
  }, []);
  return (
    <section className="pnl hero" style={{ gridArea: "hero" }}>
      <div className="planet" aria-hidden="true">{lights.map((l, i) => <i key={i} style={{ left: `${l.x}%`, top: `${l.y}%`, width: l.s, height: l.s, opacity: l.o }} />)}</div>
      <div className="hero-l">
        <h1 className="greet">{greeting()}, Rio.</h1>
        <p className="motto">Denken. Bauen.<br />Beweisen.</p>
        <div className="focus"><span className="focus-k">Fokus heute</span>Command Center V1 präsentierbar machen</div>
      </div>
      <div className="hero-m">
        <p className="lage">
          {runsReal ? `${active} Runs laufen` : "Runs nicht verbunden"}<br />
          {apprReal ? `${pending} Freigaben offen` : "Freigaben nicht verbunden"}<br />
          Runtime Truth aktiv
        </p>
      </div>
      <div className="hero-r">
        <div className="clock">{p2(n.getHours())}:{p2(n.getMinutes())}<span className="sec">{p2(n.getSeconds())}</span></div>
        <div className="date">{fmtDate(n)}</div>
        <div className="rule" />
        <p className="triad">Ruhe<br />Klarheit<br />Kontrolle</p>
      </div>
    </section>
  );
}

function RunsPanel({ s, go }) {
  const meta = s.rtMeta || {};
  const active = s.runs.filter(isActive), waiting = s.runs.filter((r) => r.state === "waiting");
  const done = s.runs.filter((r) => r.state === "success").length;
  const failed = s.runs.filter((r) => r.state === "failed" || r.state === "blocked").length;
  const list = [...active, ...waiting, ...s.runs.filter((r) => !isActive(r) && r.state !== "waiting")].slice(0, 3);
  return (
    <Panel area="runs" title="Runs" right={<LiveTag label={meta.runsReal ? "Live" : "Nicht verbunden"} color={meta.runsReal ? "#ffab40" : "#a3968a"} pulse={false} />}>
      <div className="runs-top">
        <div className="big">{meta.runsReal ? active.length + waiting.length : "–"}</div>
        <p className="big-l">In Arbeit<br /><span>{meta.runsReal ? `${active.length} laufen, ${waiting.length} warten` : "Runtime-Quelle nicht verbunden"}</span></p>
      </div>
      <div className="runs-mid">
        <dl className="stats">
          <div><dt>{meta.runsReal ? s.runs.length : "–"}</dt><dd>bekannt</dd></div>
          <div><dt>{meta.runsReal ? done : "–"}</dt><dd>abgeschlossen</dd></div>
          <div><dt>{meta.runsReal ? failed : "–"}</dt><dd>fehlgeschlagen</dd></div>
        </dl>
      </div>
      <div className="mini-runs">
        <RtNote meta={meta} real={meta.runsReal} count={list.length}
          emptyText="Noch keine Runs" offText="Runs nicht verbunden" loadingText="Runs werden geladen …" />
        {list.map((r) => (
          <button key={r.id} className="mini-run" onClick={() => go("tasks", { selRun: r.id, taskFilter: "all", projectFilter: null })}>
            <div className="mr-h"><span className="rid">{r.id}</span><Chip state={r.state} small /></div>
            <div className="mr-t">{r.title}</div>
            <div className="mr-b"><span>{r.note || STATE[r.state]?.label}</span><ChevronRight size={14} /></div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function SystemPanel({ go }) {
  const rt = useRuntimeTruth();
  const tag = !rt.loaded ? "Prüft …" : rt.canonical ? "Live" : "Nicht verbunden";
  return (
    <Panel area="sys" title="Systemstatus" right={<LiveTag label={tag} color={rt.canonical ? "#ffab40" : "#a3968a"} pulse={false} />}>
      <div className="svc-list">
        {SERVICES.map((x) => {
          const st = rtServiceStatus(rt, x.k);
          return (
            <button key={x.k} className="svc-r" onClick={() => go("system")}>
              <span className="svc-n">{x.n}</span>
              <span className="svc-s" style={{ color: st.color }}><Dot color={st.color} pulse={st.pulse} />{st.label}</span>
            </button>
          );
        })}
      </div>
      <div className="usage">
        <div className="usage-h"><span>Worker-Limit heute</span><b>Unbekannt</b></div>
        <div className="qbar"><i style={{ width: "0%" }} /><em style={{ left: "80%" }} title="Warnschwelle 80 %" /></div>
      </div>
    </Panel>
  );
}

function QuickPanel({ go, command, inputRef, pending }) {
  const items = [
    [Zap, "Neuer Auftrag", () => { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }],
    [Radio, "Status abfragen", () => command("Systemstatus")],
    [ShieldCheck, "Freigaben", () => go("approvals"), pending],
    [ListChecks, "Runs", () => go("tasks")],
    [FolderKanban, "Projekte", () => go("projects")],
    [Brain, "Memory", () => go("memory")],
    [FileText, "Evidence", () => go("logs", { logFilter: { src: "all", lvl: "evidence", run: null, q: "" } })],
    [Clock, "Nightly-Audit starten", () => command("Starte den Nightly Dependency-Audit jetzt")],
  ];
  return (
    <Panel area="quick" title="Schnellzugriff">
      <div className="quick">
        {items.map(([Icon, label, fn, badge]) => (
          <button key={label} className="q-i" onClick={fn}>
            <Icon size={17} strokeWidth={1.5} />
            <span>{label}</span>
            {badge ? <span className="badge">{badge}</span> : <ChevronRight size={14} className="q-ch" />}
          </button>
        ))}
      </div>
    </Panel>
  );
}

const ARC_D = "M 60 290 Q 500 100 940 290";
const ARC_PTS = (() => {
  const P0 = [60, 290], P1 = [500, 100], P2 = [940, 290], S = 400, pts = [], L = [0];
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const x = (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0];
    const y = (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1];
    if (i) L.push(L[i - 1] + Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]));
    pts.push([x, y]);
  }
  const total = L[S];
  return PIPE.map((_, k) => { const tg = (total * k) / (PIPE.length - 1); let j = L.findIndex((v) => v >= tg - 0.001); if (j < 0) j = S; return pts[j]; });
})();

function PipePanel({ s, go }) {
  const run = s.runs.find(isActive) || s.runs.find((r) => r.state === "waiting");
  const stage = run ? run.stage : 0;
  const frac = stage / (PIPE.length - 1);
  const last = s.runs.find((r) => r.state === "success");
  const lights = useMemo(() => Array.from({ length: 140 }, () => ({ x: Math.random() * 100, y: 0.3 + Math.random() * Math.random() * 9, s: Math.random() < 0.08 ? 3 : 0.6 + Math.random() * 1.4, o: 0.3 + Math.random() * 0.7 })), []);
  return (
    <section className="pnl pipe" style={{ gridArea: "pipe" }}>
      <div className="hz" aria-hidden="true"><div className="hz-l">{lights.map((l, i) => <i key={i} style={{ left: `${l.x}%`, top: `${l.y}%`, width: l.s, height: l.s, opacity: l.o }} />)}</div></div>
      <svg className="arc only-wide" viewBox="0 0 1000 320" preserveAspectRatio="none" aria-hidden="true">
        <path d={ARC_D} className="arc-base" />
        <path d={ARC_D} className="arc-hot" pathLength="1" strokeDasharray={`${frac} 1`} />
        {frac > 0 && !reducedMotion() && (
          <circle r="3.2" className="arc-p">
            <animateMotion dur="2.6s" repeatCount="indefinite" keyPoints={`0;${frac}`} keyTimes="0;1" calcMode="linear" path={ARC_D} />
          </circle>
        )}
      </svg>
      <div className="only-wide">
        {PIPE.map((p, i) => (
          <div key={p.k} className={`pn ${i < stage ? "done" : i === stage ? "cur" : "todo"}`} style={{ left: `${ARC_PTS[i][0] / 10}%`, top: ARC_PTS[i][1] }}>
            <div className="pn-l"><div className="pn-n">{p.n}</div><div className="pn-d">{p.d}</div></div>
            <span className="pn-dot" />
          </div>
        ))}
      </div>
      <div className="pipe-over">
        {last && (
          <div className="pnl res">
            <div className="res-h"><span className="pnl-t">Letztes Ergebnis</span><Chip state="success" small /></div>
            <div className="res-t">{last.title}</div>
            <p className="res-d">{last.note || "Abgeschlossen."}{last.evidence_ref ? ` · Evidence ${last.evidence_ref}` : " · keine Evidence verknüpft"}</p>
            <button className="lnk" onClick={() => go("logs", { logFilter: { src: "all", lvl: "all", run: last.id, q: "" } })}>Aktivität öffnen</button>
          </div>
        )}
        <div className="pipe-tag only-wide">
          <div className="pt-k">Pipeline {run?.id || ""}</div>
          <p>Jeder Schritt belegt.<br />Git ist die Wahrheit.</p>
        </div>
      </div>
      <ol className="pipe-list only-narrow">
        {PIPE.map((p, i) => (
          <li key={p.k} className={i < stage ? "done" : i === stage ? "cur" : "todo"}>
            <span className="pl-dot" /><span className="pl-n">{p.n}</span><span className="pl-d">{p.d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HomeView({ s, go, command, inputRef, onMic }) {
  const active = s.runs.filter(isActive).length;
  const pending = s.approvals.filter(isPending).length;
  return (
    <div className="home-grid">
      <Hero active={active} pending={pending} meta={s.rtMeta} />
      <Panel area="act" title="Aktivität" right={<LiveTag label={s.rtMeta?.activityReal ? "Live" : "Nicht verbunden"} color={s.rtMeta?.activityReal ? "#ffab40" : "#a3968a"} pulse={false} />}>
        <RtNote meta={s.rtMeta} real={s.rtMeta?.activityReal} count={s.logs.length}
          emptyText="Noch keine Aktivität" offText="Aktivitäts-Quelle nicht verbunden" loadingText="Aktivität wird geladen …" />
        <div className="feed">
          {s.logs.slice(0, 9).map((l) => (
            <button key={l.id} className="feed-r" onClick={() => go("logs", { logFilter: { src: "all", lvl: "all", run: l.run || null, q: "" } })}>
              <span className="t">{l.t.slice(0, 5)}</span><span className="sep" /><span className="m">{l.msg}</span>
            </button>
          ))}
        </div>
      </Panel>
      <div className="core">
        <OrbStage voice={s.voice} />
        {s.utterance ? <Spoken text={s.utterance} id={s.utterId} /> : null}
        <VoiceBars voice={s.voice} />
        <div className="caption">{VOICE_CAPTION[s.voice]}</div>
        <CommandBar onSend={command} voice={s.voice} onMic={onMic} inputRef={inputRef} suggestions={SUGG} />
      </div>
      <RunsPanel s={s} go={go} />
      <SystemPanel go={go} />
      <QuickPanel go={go} command={command} inputRef={inputRef} pending={pending} />
      <PipePanel s={s} go={go} />
    </div>
  );
}

/* CHAT */
function RunCard({ run, onOpen }) {
  return (
    <button className="runcard" onClick={onOpen}>
      <div className="mr-h"><span className="rid">{run.id}</span><Chip state={run.state} small /></div>
      <div className="mr-t">{run.title}</div>
      <div className="rc-b"><span>{run.note || STATE[run.state]?.label}</span><ChevronRight size={14} /></div>
    </button>
  );
}

function MiniStepper({ run }) {
  return (
    <ol className="stepper">
      {PIPE.slice(1).map((p, i) => {
        const idx = i + 1;
        const st = run.state === "success" || run.stage > idx ? "done" : run.stage === idx ? "cur" : "todo";
        const bad = st === "cur" && ["failed", "blocked", "interrupted"].includes(run.state);
        return (
          <li key={p.k} className={`st ${st}${bad ? " bad" : ""}`}>
            <span className="st-dot">{st === "done" ? <Check size={11} strokeWidth={2.5} /> : null}</span>
            <div><div className="st-n">{p.n}</div><div className="st-d">{p.d}</div></div>
          </li>
        );
      })}
    </ol>
  );
}

function ChatView({ s, go, command, inputRef, onMic }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [s.messages.length, s.voice]);
  const busy = s.voice === "thinking" || s.voice === "analyzing";
  const byId = Object.fromEntries(s.runs.map((r) => [r.id, r]));
  const ctxRun = s.runs.find(isActive) || s.runs[0];
  return (
    <>
      <PageHead title="Chat" sub="Sprich mit JARVIS. Jeder Auftrag wird ein nachvollziehbarer Run." />
      <div className="chat-grid">
        <section className="pnl chat-pnl">
          <div className="thread">
            {s.messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="msg u"><div className="bubble">{m.text}</div><span className="mt">{m.t}</span></div>
            ) : (
              <div key={m.id} className="msg j">
                <span className="mini-orb av" />
                <div className="jbody">
                  <div className="jh"><span className="jn">JARVIS</span><span className="mt">{m.t}</span></div>
                  <p>{m.text}</p>
                  {m.runId && byId[m.runId] && <RunCard run={byId[m.runId]} onOpen={() => go("tasks", { selRun: m.runId, taskFilter: "all", projectFilter: null })} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="msg j">
                <span className="mini-orb av live" />
                <div className="jbody"><div className="jh"><span className="jn">{VOICE_CAPTION[s.voice]}</span></div><div className="typing"><i /><i /><i /></div></div>
              </div>
            )}
            <div ref={end} />
          </div>
          <CommandBar compact onSend={command} voice={s.voice} onMic={onMic} inputRef={inputRef} suggestions={["Systemstatus", "Freigaben prüfen", "Lunara-Webhook reparieren"]} />
        </section>
        <aside className="ctx">
          <Panel title="Kontext">
            {ctxRun ? (
              <dl className="kv">
                <div><dt>Run</dt><dd className="mono">{ctxRun.id}</dd></div>
                <div><dt>Worker</dt><dd>{ctxRun.worker}</dd></div>
                <div><dt>Status</dt><dd>{STATE[ctxRun.state]?.label || ctxRun.state}</dd></div>
                <div><dt>Aktive Regeln</dt><dd>{MEMORY.filter((m) => m.lock).length} Policies</dd></div>
              </dl>
            ) : (
              <div className="empty">{s.rtMeta?.runsReal ? "Noch kein aktiver Run" : "Runs nicht verbunden"}</div>
            )}
          </Panel>
          {ctxRun && <Panel title={`Pipeline ${ctxRun.id}`} right={<Chip state={ctxRun.state} small />}><MiniStepper run={ctxRun} /></Panel>}
          <Panel title="Aus dem Memory">
            <div className="mem-mini">
              {MEMORY.filter((m) => m.c === "regeln").slice(0, 3).map((m) => (
                <div key={m.k}><span className="mi-k"><Lock size={10} /> {m.k}</span><p>{m.v}</p></div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

/* TASKS */
const TASK_FILTERS = [
  ["all", "Alle", () => true],
  ["active", "Läuft", isActive],
  ["scheduled", "Geplant", (r) => r.state === "scheduled"],
  ["waiting", "Freigabe", (r) => r.state === "waiting"],
  ["success", "Erledigt", (r) => r.state === "success"],
  ["failed", "Fehler", (r) => r.state === "failed"],
  ["blocked", "Blockiert", (r) => r.state === "blocked" || r.state === "interrupted"],
];

function TasksView({ s, d, go }) {
  const base = s.projectFilter ? s.runs.filter((r) => r.project === s.projectFilter) : s.runs;
  const fn = TASK_FILTERS.find((f) => f[0] === s.taskFilter)?.[2] || (() => true);
  const list = base.filter(fn);
  const sel = s.runs.find((r) => r.id === s.selRun) || list[0];
  const ap = sel && s.approvals.find((a) => a.run === sel.id && isPending(a));
  const act = (patch, msg) => { d({ type: "RUN", id: sel.id, patch }); d({ type: "LOG", log: { src: "hermes", lvl: "info", run: sel.id, msg } }); };
  return (
    <>
      <PageHead title="Tasks" sub="Runs aus der JARVIS-Runtime-Truth-Projektion. Kein Fortschritt ohne belegte Grundlage."
        right={<LiveTag label={s.rtMeta?.runsReal ? "Live" : "Nicht verbunden"} color={s.rtMeta?.runsReal ? "#ffab40" : "#a3968a"} pulse={false} />} />
      <div className="tabs" role="tablist">
        {TASK_FILTERS.map(([id, label, f]) => (
          <button key={id} role="tab" aria-selected={s.taskFilter === id} className={`tab${s.taskFilter === id ? " on" : ""}`} onClick={() => d({ type: "PATCH", patch: { taskFilter: id } })}>
            {label}<span className="cnt">{base.filter(f).length}</span>
          </button>
        ))}
        {s.projectFilter && (
          <button className="tab pf" onClick={() => d({ type: "PATCH", patch: { projectFilter: null } })}>{projName(s.projectFilter)} <X size={12} /></button>
        )}
      </div>
      <div className="split">
        <div className="rows">
          <RtNote meta={s.rtMeta} real={s.rtMeta?.runsReal} count={list.length}
            emptyText="Keine Runs in diesem Filter." offText="Runs nicht verbunden." loadingText="Runs werden geladen …" />
          {list.map((r) => (
            <button key={r.id} className={`row${sel?.id === r.id ? " sel" : ""}`} onClick={() => d({ type: "PATCH", patch: { selRun: r.id } })}>
              <span className="row-bar" style={{ background: STATE[r.state].c, boxShadow: `0 0 12px ${hexA(STATE[r.state].c, 0.6)}` }} />
              <div className="row-main">
                <div className="row-t">{r.title}</div>
                <div className="row-m"><span>{r.id}</span><span>{r.worker}</span><span>{r.note}</span></div>
              </div>
              <div className="row-r"><Chip state={r.state} small /></div>
            </button>
          ))}
        </div>
        {sel && (
          <Panel className="detail" title={sel.id} right={<Chip state={sel.state} />}>
            <h2 className="d-t">{sel.title}</h2>
            <dl className="kv two">
              <div><dt>Worker</dt><dd>{sel.worker}</dd></div>
              <div><dt>Status</dt><dd>{STATE[sel.state]?.label || sel.state}</dd></div>
              <div><dt>Gestartet</dt><dd className="mono">{sel.started || "–"}</dd></div>
              <div><dt>Fortschritt</dt><dd className="mono">Unbekannt</dd></div>
            </dl>
            {sel.approval_state && <div className="note">Freigabe: {sel.approval_state}</div>}
            {sel.note && <div className="note">{sel.note}</div>}
            {(() => {
              const evi = sel.evidence_ref ? (s.evidence || []).find((e) => e.evidence_id === sel.evidence_ref) : null;
              if (!sel.evidence_ref) return <div className="note dim">Keine Evidence verknüpft</div>;
              return (
                <div className="note">
                  <div className="k">Evidence</div>
                  <div className="mono">{sel.evidence_ref}</div>
                  {evi && <div>{evi.kind || "AUDIT"} · Status {evi.status || "Unbekannt"} · {evi.independent_acceptance ? "unabhängig abgenommen" : "keine unabhängige Abnahme"}</div>}
                </div>
              );
            })()}
            <MiniStepper run={sel} />
            <div className="acts">
              {sel.local === true && isActive(sel) && <button className="btn" onClick={() => act({ state: "interrupted", live: false, note: "Pausiert durch dich" }, `${sel.id} pausiert`)}><Pause size={14} />Pausieren</button>}
              {(sel.state === "waiting" || (sel.state === "blocked" && ap)) && <button className="btn pri" onClick={() => go("approvals")}><ShieldCheck size={14} />Freigabe prüfen</button>}
              <button className="btn ghost" onClick={() => go("logs", { logFilter: { src: "all", lvl: "all", run: sel.id, q: "" } })}><FileText size={14} />Aktivität</button>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

/* PROJECTS */
function ProjectsView({ s, go }) {
  return (
    <>
      <PageHead title="Projekte" sub="Workspace-Register des Operators. Branch und letzte Aktivität sind noch Mock."
        right={<span className="rid">Mock (Register real)</span>} />
      <div className="cards">
        {PROJECTS.map((p) => {
          const runs = s.runs.filter((r) => r.project === p.id);
          const lead = runs.find(isActive) || runs.find((r) => r.state === "waiting") || runs[0];
          const open = runs.filter((r) => r.state !== "success").length;
          return (
            <Panel key={p.id} className="proj">
              <div className="proj-h"><span className="proj-tag">{p.tag}</span>{lead && <Chip state={lead.state} small />}</div>
              <h2 className="proj-n">{p.name}</h2>
              <p className="proj-d">{p.desc}</p>
              {lead && <div className="proj-run"><span className="rid">{lead.id}</span>{lead.title}</div>}
              <div className="proj-f">
                <span><GitBranch size={12} />{p.branch}</span>
                <span>{s.rtMeta?.runsReal ? `${open} offen` : "Runs n/v"}</span>
                <span>{p.last}</span>
              </div>
              <button className="btn ghost full" onClick={() => go("tasks", { projectFilter: p.id, taskFilter: "all", selRun: lead?.id })}>Runs ansehen</button>
            </Panel>
          );
        })}
      </div>
    </>
  );
}

/* MEMORY */
function MemoryView({ s, d }) {
  const [q, setQ] = useState("");
  const items = MEMORY.filter((m) => (s.memCat === "all" || m.c === s.memCat) && (!q || `${m.k} ${m.v}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHead title="Memory" sub="Was JARVIS über dich, dein Setup und deine Projekte weiß — Inhalte noch Mock."
        right={<label className="search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Memory durchsuchen" aria-label="Memory durchsuchen" /></label>} />
      <div className="empty" style={{ marginBottom: 12 }}>Mock: der echte private Memory-Store (src/jarvis/memory-store-*) wird in einer späteren Welle angebunden.</div>
      <div className="mem">
        <div className="cats" role="tablist">
          {MEM_CATS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={s.memCat === id} className={`cat${s.memCat === id ? " on" : ""}`} onClick={() => d({ type: "PATCH", patch: { memCat: id } })}>
              <span>{label}</span><span className="cnt">{id === "all" ? MEMORY.length : MEMORY.filter((m) => m.c === id).length}</span>
            </button>
          ))}
        </div>
        <div className="mem-grid">
          {items.length === 0 && <div className="empty">Nichts gefunden für „{q}“. Versuch einen anderen Begriff.</div>}
          {items.map((m) => (
            <Panel key={m.k} className="mi">
              <div className="mi-k">{m.lock && <Lock size={11} />}{m.k}</div>
              <p className="mi-v">{m.v}</p>
              <div className="mi-f"><span>{MEM_CATS.find((c) => c[0] === m.c)[1]}</span><span>Quelle: {m.src}</span><span>{m.upd}</span></div>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}

/* APPROVALS */
function RiskMeter({ risk }) {
  const r = RISK[risk] || { c: "#a3968a", n: 0 };
  return (
    <span className="risk" style={{ color: r.c }}>
      <span className="risk-b">{[1, 2, 3].map((i) => <i key={i} style={{ background: i <= r.n ? r.c : undefined, boxShadow: i <= r.n ? `0 0 8px ${hexA(r.c, 0.6)}` : undefined }} />)}</span>
      {risk ? `Risiko ${risk}` : "Risiko unklassifiziert"}
    </span>
  );
}

function ApprovalsView({ s, d, go, decideApproval }) {
  const pending = s.approvals.filter(isPending);
  const done = s.approvals.filter((a) => !isPending(a));
  return (
    <>
      <PageHead title="Freigaben" sub="Aus der Runtime-Truth-Projektion. Nichts, was Live-Systeme, Kosten oder Sicherheitsregeln berührt, passiert ohne dich."
        right={<LiveTag label={s.rtMeta?.approvalsReal ? "Live" : "Nicht verbunden"} color={s.rtMeta?.approvalsReal ? "#ffab40" : "#a3968a"} pulse={false} />} />
      {!s.rtMeta?.loaded && <div className="empty big-empty">Freigaben werden geladen …</div>}
      {s.rtMeta?.loaded && !s.rtMeta?.approvalsReal && <div className="empty big-empty">Freigaben-Quelle nicht verbunden. Fail-closed: keine Freigabe wird angezeigt.</div>}
      {s.rtMeta?.approvalsReal && pending.length === 0 && <div className="empty big-empty"><Check size={18} /> Keine offenen Freigaben. Neue erscheinen hier, sobald ein Run sie braucht.</div>}
      <div className="ap-list">
        {pending.map((a) => (
          <Panel key={a.id} className="ap">
            <div className="ap-h">
              <div><span className="rid">{a.id}</span>{a.status === "later" && <span className="later">Auf später gelegt</span>}<h2 className="ap-t">{a.title}</h2></div>
              <RiskMeter risk={a.risk} />
            </div>
            <div className="ap-grid">
              <div><div className="k">Warum</div><p className="v">{a.reason || "Keine Angabe in der Runtime-Truth-Quelle"}</p></div>
              <div><div className="k">Scope</div><p className="v mono">{a.scope || "—"}</p></div>
              <div><div className="k">Betroffene Systeme</div><div className="sys-chips">{a.systems.length ? a.systems.map((x) => <span key={x}>{x}</span>) : <span>—</span>}</div></div>
              <div><div className="k">Angefordert</div><p className="v mono">{a.requested}{a.run ? `, von ${a.run}` : ""}</p></div>
              {a.action && <div className="span2"><div className="k">Vorgeschlagene Aktion</div><pre className="code">{a.action}</pre></div>}
            </div>
            <div className="acts">
              {a.local === true ? (
                <>
                  <button className="btn pri" onClick={() => d({ type: "DECIDE", id: a.id, decision: "approved" })}><Check size={14} />Freigeben</button>
                  <button className="btn danger" onClick={() => d({ type: "DECIDE", id: a.id, decision: "rejected" })}><X size={14} />Ablehnen</button>
                  <button className="btn ghost" onClick={() => d({ type: "DECIDE", id: a.id, decision: "later" })}><Clock size={14} />Später</button>
                </>
              ) : (
                <>
                  <button className="btn pri" disabled={!!a.deciding} onClick={() => decideApproval && decideApproval(a, "approve")}><Check size={14} />Freigeben</button>
                  <button className="btn danger" disabled={!!a.deciding} onClick={() => decideApproval && decideApproval(a, "reject")}><X size={14} />Ablehnen</button>
                  <button className="btn ghost" disabled={!!a.deciding} onClick={() => decideApproval && decideApproval(a, "defer")}><Clock size={14} />Später</button>
                  <span className="dim" style={{ fontSize: 11 }}>{a.deciding ? "Entscheidung wird an die Runtime übergeben …" : a.decide_error ? `Fehler: ${a.decide_error}` : "Entscheidung wird protokolliert — keine Ausführung, kein externer Effekt."}</span>
                </>
              )}
              {a.run && <button className="btn ghost" onClick={() => go("tasks", { selRun: a.run, taskFilter: "all", projectFilter: null })}>Run {a.run} ansehen</button>}
            </div>
          </Panel>
        ))}
      </div>
      {done.length > 0 && (
        <Panel title="Entschieden" className="ap-done">
          {done.map((a) => (
            <div key={a.id} className="apd">
              <span className="rid">{a.id}</span><span className="apd-t">{a.title}</span>
              <Chip state={a.status === "approved" ? "success" : "blocked"} small label={a.status === "approved" ? "Freigegeben" : "Abgelehnt"} />
              <span className="mono dim">{a.decided}</span>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

/* SYSTEM */
function spark(seed, n = 30) {
  let x = seed * 997;
  return Array.from({ length: n }, (_, i) => { x = (x * 9301 + 49297) % 233280; return 0.3 + 0.4 * (x / 233280) + 0.18 * Math.sin(i / 3 + seed); });
}
function Sparkline({ seed, c, flat }) {
  const v = useMemo(() => (flat ? Array.from({ length: 30 }, () => 0.03) : spark(seed)), [seed, flat]);
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * 160},${36 - y * 32}`).join(" ");
  return (
    <svg viewBox="0 0 160 38" className="spark" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,38 ${pts} 160,38`} fill={hexA(c, 0.08)} stroke="none" />
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SystemView({ s }) {
  const run = s.runs.find(isActive);
  const rt = useRuntimeTruth();
  return (
    <>
      <PageHead title="System" sub="Der technische Zustand von JARVIS: Dienste, Heartbeats, Limits, Sicherheit."
        right={<LiveTag label={!rt.loaded ? "Prüft …" : rt.canonical ? "System Status live" : "Runtime nicht verbunden"} color={rt.canonical ? "#ffab40" : "#a3968a"} pulse={false} />} />
      <Panel title="Pipeline" right={run && <span className="rid">{run.id}: {STAGE_NOTE[run.stage]}</span>}>
        <div className="chain">
          {PIPE.map((p, i) => {
            const st = run ? (i < run.stage ? "done" : i === run.stage ? "cur" : "todo") : "todo";
            return (
              <React.Fragment key={p.k}>
                <div className={`cn ${st}`}><span className="cn-dot" /><div className="cn-n">{p.n}</div><div className="cn-d">{p.d}</div></div>
                {i < PIPE.length - 1 && <span className={`ca ${i < (run?.stage ?? 0) ? "on" : ""}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </Panel>
      <Panel title="Ausführungskette — echte Bindung" right={<span className="rid">Runtime Truth</span>}>
        {!rt.commandChain && <div className="empty">Bindungsstatus nicht verbunden</div>}
        {rt.commandChain && (
          <div className="svc-list">
            {rt.commandChain.nodes.map((n) => {
              const bound = n.bound === true;
              const color = bound ? "#a8d8a0" : n.bound === "LOCAL_ONLY" || n.bound === "ADAPTER_REQUIRED" ? "#ffc24a" : "#a3968a";
              const label = bound ? "gebunden" : n.bound === "LOCAL_ONLY" ? "nur lokal" : n.bound === "ADAPTER_REQUIRED" ? "Adapter nötig" : "nicht gebunden";
              return (
                <div key={n.node} className="svc-r" style={{ cursor: "default" }}>
                  <span className="svc-n">{n.node.replace(/_/g, " ")}<span className="dim" style={{ fontSize: 10, marginLeft: 8 }}>{n.role}</span></span>
                  <span className="svc-s" style={{ color }}><Dot color={color} />{label}</span>
                </div>
              );
            })}
            <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
              Claude-Code-Ausführungsbrücke: {rt.commandChain.claude_execution_bridge_bound ? "gebunden" : "nicht gebunden"} ·
              Codex-Fallback: {rt.commandChain.fallback_active ? "aktiv" : "inaktiv"} ·
              Worker-Selbstabnahme: {rt.commandChain.worker_output_self_accepts ? "JA" : "nein"}
            </div>
          </div>
        )}
      </Panel>
      <div className="svc-grid">
        {SERVICES.map((x) => {
          const st = rtServiceStatus(rt, x.k);
          return (
            <Panel key={x.k} className="svc">
              <div className="svc-h"><div><div className="svc-t">{x.n}</div><div className="svc-role">{x.role}</div></div><span className="svc-s" style={{ color: st.color }}><Dot color={st.color} pulse={st.pulse} />{st.label}</span></div>
              <Sparkline seed={x.seed} c={st.color} flat />
              <dl className="kv three">
                <div><dt>Heartbeat</dt><dd className="mono">Unbekannt</dd></div>
                <div><dt>Latenz</dt><dd className="mono">Unbekannt</dd></div>
                <div><dt>Uptime</dt><dd className="mono">Unbekannt</dd></div>
              </dl>
              <div className="svc-last">{st.known ? `Quelle: ${rt.source && rt.source.classification ? rt.source.classification : "Runtime Truth"}` : "Keine Live-Daten"}</div>
            </Panel>
          );
        })}
      </div>
      <div className="sys-2">
        <Panel title="Limits und Nutzung" right={<span className="rid">Mock</span>}>
          {USAGE.map((u) => (
            <div key={u.n} className="usage">
              <div className="usage-h"><span>{u.n}</span><b>{u.v} %</b></div>
              <div className="qbar"><i style={{ width: `${u.v}%` }} /><em style={{ left: `${u.warn}%` }} title={`Warnschwelle ${u.warn} %`} /></div>
            </div>
          ))}
        </Panel>
        <Panel title="Sicherheit" right={<span className="rid">Mock</span>}>
          <div className="notices">
            {NOTICES.map((n) => (
              <div key={n.t} className="notice" style={{ borderColor: hexA(LVL[n.lvl].c, 0.35) }}>
                {n.lvl === "warn" ? <AlertTriangle size={16} color={LVL.warn.c} /> : n.lvl === "ok" ? <Check size={16} color={LVL.ok.c} /> : <Radio size={16} color={LVL.info.c} />}
                <div><div className="n-t">{n.t}</div><div className="n-d">{n.d}</div></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* LOGS */
function LogsView({ s, d }) {
  const [open, setOpen] = useState(null);
  const f = s.logFilter;
  const setF = (patch) => d({ type: "PATCH", patch: { logFilter: { ...f, ...patch } } });
  const list = s.logs.filter((l) => (f.src === "all" || l.src === f.src) && (f.lvl === "all" || l.lvl === f.lvl) && (!f.run || l.run === f.run) && (!f.q || l.msg.toLowerCase().includes(f.q.toLowerCase())));
  return (
    <>
      <PageHead title="Logs" sub="Aktivität aus der JARVIS-Runtime-Truth-Projektion. Nur real persistierte Ereignisse."
        right={<label className="search"><Search size={15} /><input value={f.q} onChange={(e) => setF({ q: e.target.value })} placeholder="Logs durchsuchen" aria-label="Logs durchsuchen" /></label>} />
      <RtNote meta={s.rtMeta} real={s.rtMeta?.activityReal} count={list.length}
        emptyText="Keine Einträge für diese Filter." offText="Aktivitäts-Quelle nicht verbunden." loadingText="Aktivität wird geladen …" />
      <div className="tabs">
        {["all", ...Object.keys(SRC)].map((k) => (
          <button key={k} className={`tab${f.src === k ? " on" : ""}`} onClick={() => setF({ src: k })}>{k === "all" ? "Alle Quellen" : SRC[k]}</button>
        ))}
      </div>
      <div className="tabs">
        {["all", ...Object.keys(LVL)].map((k) => (
          <button key={k} className={`tab lv${f.lvl === k ? " on" : ""}`} onClick={() => setF({ lvl: k })} style={k !== "all" && f.lvl !== k ? { color: LVL[k].c } : undefined}>{k === "all" ? "Alle Stufen" : LVL[k].n}</button>
        ))}
        {f.run && <button className="tab pf" onClick={() => setF({ run: null })}>{f.run} <X size={12} /></button>}
      </div>
      <section className="pnl logs">
        {list.length === 0 && s.rtMeta?.activityReal && <div className="empty">Setz einen Filter zurück, um mehr zu sehen.</div>}
        {list.map((l) => {
          const has = !!l.ev, isOpen = open === l.id;
          return (
            <div key={l.id} className={`log-w${isOpen ? " open" : ""}`}>
              <button className="log" onClick={() => has && setOpen(isOpen ? null : l.id)} aria-expanded={has ? isOpen : undefined} style={{ cursor: has ? "pointer" : "default" }}>
                <span className="lt">{l.t}</span>
                <span className="ll hide-sm" style={{ color: LVL[l.lvl].c }}>{LVL[l.lvl].n}</span>
                <span className="ls hide-sm">{SRC[l.src]}</span>
                <span className="lm"><span className="show-sm" style={{ color: LVL[l.lvl].c }}>{SRC[l.src]}</span>{l.msg}{l.run && <span className="lr">{l.run}</span>}</span>
                <span className="lc">{has && <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}</span>
              </button>
              {isOpen && (
                <div className="ev">
                  {l.ev.hash && <div className="ev-h">{l.ev.hash}</div>}
                  {l.ev.checks && <ul>{l.ev.checks.map((c) => <li key={c}><Check size={12} />{c}</li>)}</ul>}
                  {l.ev.trace && <pre className="code">{l.ev.trace}</pre>}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

/* ── APP ──────────────────────────────────────────────────────────────── */
export default function JarvisCommandCenter() {
  const [s, d] = useReducer(reducer, null, init);
  const sRef = useRef(s); sRef.current = s;
  const timers = useRef([]);
  const runSeq = useRef(143), apSeq = useRef(32), utterSeq = useRef(1);
  const inputRef = useRef(null);
  const later = (ms, fn) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const timerList = timers.current;
    return () => { timerList.forEach(clearTimeout); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [s.view]);

  // Real Runs / Activity / Approvals from GET <apiBase>/runtime-truth.
  const rt = useRuntimeTruth();
  useEffect(() => {
    d({ type: "SYNC_RT", patch: syncRuntimeTruthPatch(rt, sRef.current) });
  }, [rt]);

  const go = useCallback((view, patch) => d({ type: "NAV", view, patch }), []);
  const onMic = () => {
    const v = sRef.current.voice;
    if (v === "thinking" || v === "analyzing") return;
    d({ type: "VOICE", voice: v === "listening" ? "idle" : "listening" });
    if (v !== "listening") inputRef.current?.focus();
  };

  // Wave 6: real submission to the existing safe JARVIS runtime (POST <base>/api/chat
  // -> intent -> action gate -> connector execution / prepare-only). No second
  // brain, no fabricated worker output. A client correlation id ties the
  // optimistic run to the persisted audit projection. Dangerous actions come
  // back approval-gated and are never executed here.
  const inFlight = useRef(false);
  const lastSubmit = useRef({ text: "", at: 0 });
  const command = useCallback(async (raw) => {
    const text = String(raw || "").trim();
    if (!text) return;
    const nowMs = Date.now();
    if (inFlight.current) return;
    if (text === lastSubmit.current.text && nowMs - lastSubmit.current.at < 3000) return;
    lastSubmit.current = { text, at: nowMs };
    inFlight.current = true;

    const corr = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    d({ type: "MSG", msg: { id: uid(), role: "user", text, t: nowHM() } });
    d({ type: "VOICE", voice: "thinking" });
    d({ type: "ADD_RUN", run: {
      id: corr, local: true, real: false, title: text.slice(0, 80), project: "jarvis",
      worker: "JARVIS Runtime", state: "running", progress: 0, stage: 0,
      note: "An JARVIS-Runtime übergeben …", started: nowHM(), live: false,
    } });

    let body = null, httpOk = false, status = 0;
    try {
      const r = await fetch(`${RT_API_BASE()}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: text, correlation_id: corr }),
      });
      status = r.status;
      httpOk = r.ok;
      body = await r.json().catch(() => null);
    } catch (e) {
      body = null;
    }

    d({ type: "VOICE", voice: "idle" });

    if (!body) {
      d({ type: "RUN", id: corr, patch: { state: "failed", note: "Runtime nicht erreichbar" } });
      d({ type: "MSG", msg: { id: uid(), role: "jarvis", text: "Die JARVIS-Runtime ist nicht erreichbar. Es wurde nichts ausgeführt.", t: nowHM(), runId: corr } });
      inFlight.current = false;
      return;
    }

    if (status === 503) {
      d({ type: "RUN", id: corr, patch: { state: "blocked", note: "Runtime-Speicher nicht gebunden" } });
      d({ type: "MSG", msg: { id: uid(), role: "jarvis", text: body.message || "JARVIS Memory ist in dieser Umgebung noch nicht gebunden. Es wurde nichts ausgeführt.", t: nowHM(), runId: corr } });
      inFlight.current = false;
      return;
    }

    const runState = body.run_state === "COMPLETE" ? "success"
      : body.run_state === "WAITING_APPROVAL" ? "waiting"
      : body.run_state === "BLOCKED" ? "blocked"
      : httpOk ? "running" : "failed";
    d({ type: "RUN", id: corr, patch: {
      state: runState,
      note: body.blocked ? `Blockiert: ${body.gate_status || body.error || "Policy"}`
        : body.approval_required ? "Wartet auf Freigabe"
        : body.action ? `Aktion: ${body.action}` : (body.gate_status || "Übergeben"),
      approval_state: body.approval_required ? "PENDING" : null,
    } });
    d({ type: "MSG", msg: { id: uid(), role: "jarvis", text: body.answer || (httpOk ? "Verarbeitet." : "Konnte nicht ausgeführt werden."), t: nowHM(), runId: corr } });

    // Pull the persisted projection so the optimistic run/activity/approval get
    // replaced by real runtime truth.
    _rtLoad();
    inFlight.current = false;
  }, []);

  // Operator decision on a projected approval -> POST <base>/api/approvals/decide.
  // Records a decision; never executes, never sets external_effect.
  const decidingRef = useRef(new Set());
  const decideApproval = useCallback(async (approval, decision) => {
    const id = approval && approval.id;
    if (!id || decidingRef.current.has(id)) return;
    decidingRef.current.add(id);
    d({ type: "APPROVAL_PENDING", id, decision });
    let body = null, httpOk = false;
    try {
      const r = await fetch(`${RT_API_BASE()}/approvals/decide`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ approval_id: id, run_id: approval.run || null, decision }),
      });
      httpOk = r.ok;
      body = await r.json().catch(() => null);
    } catch { body = null; }
    if (httpOk && body && body.ok) {
      d({ type: "APPROVAL_DECIDED", id, decision, gate_status: body.gate_status });
    } else {
      d({ type: "APPROVAL_DECISION_FAILED", id, error: (body && body.error) || "Runtime nicht erreichbar" });
    }
    decidingRef.current.delete(id);
    _rtLoad();
  }, []);

  const props = { s, d, go, command, inputRef, onMic, decideApproval };
  const V = { home: HomeView, chat: ChatView, tasks: TasksView, projects: ProjectsView, memory: MemoryView, approvals: ApprovalsView, system: SystemView, logs: LogsView }[s.view];

  return (
    <div className="jcc">
      <style>{CSS}</style>
      <div className="bg-glow" aria-hidden="true" />
      <Starfield />
      <div className="shell">
        <Sidebar s={s} go={go} />
        <main className="main">
          <MobileTop s={s} />
          <div className="topbar">
            <div className="tb-l"><span className="tb-t">{TITLES[s.view]}</span></div>
            <div className="tb-r">
              <RuntimeBadge />
              {s.view !== "home" && <TopClock />}
            </div>
          </div>
          <V {...props} />
          <footer className="foot">
            <span className="logo xs">JARVIS</span>
            <span className="foot-m">Immer einen Schritt voraus</span>
            <LiveTag
              label={!s.rtMeta?.loaded ? "Prüft …" : (s.rtMeta?.runsReal || s.rtMeta?.activityReal || s.rtMeta?.systemsReal) ? "Runtime Truth" : "Fail-closed"}
              color={(s.rtMeta?.runsReal || s.rtMeta?.activityReal || s.rtMeta?.systemsReal) ? "#ffab40" : "#a3968a"}
              pulse={false}
            />
          </footer>
        </main>
      </div>
      <MobileNav s={s} go={go} />
    </div>
  );
}

/* ── STYLES ───────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Michroma&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@300;400;500;600&display=swap');
.jcc{--bg:#040405;--ink:#f3e9db;--muted:#a3968a;--dim:#6d6359;--faint:#3a322b;--amber:#ffab40;--hi:#ffd08a;--deep:#ff7a1a;
  --line:rgba(255,168,72,.17);--line2:rgba(255,168,72,.42);--panel:rgba(15,11,8,.64);
  --fd:'Michroma','Eurostile','Segoe UI',sans-serif;--fm:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--fb:'Manrope',system-ui,sans-serif;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--fb);font-size:14px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.jcc *{box-sizing:border-box}
.jcc ::selection{background:rgba(255,171,64,.35)}
.jcc :where(button){font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0;text-align:inherit}
.jcc button:focus-visible,.jcc input:focus-visible{outline:1.5px solid var(--hi);outline-offset:2px}
.jcc :where(input){font:inherit;color:inherit}
.jcc :where(h1,h2,h3,p,dl,dd,ol,ul){margin:0}
.mono{font-family:var(--fm)}.dim{color:var(--dim)}
.bg-glow{position:fixed;inset:0;pointer-events:none;z-index:0;background:
  radial-gradient(760px 520px at 60% 44%,rgba(255,120,24,.10),transparent 70%),
  radial-gradient(900px 420px at 50% 115%,rgba(255,110,20,.10),transparent 70%),
  radial-gradient(1400px 900px at 50% 40%,#0a0806 0%,#040405 72%)}
.stars{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.shell{position:relative;z-index:2;display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh}

/* sidebar */
.side{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:28px 18px 22px;border-right:1px solid var(--line);background:linear-gradient(180deg,rgba(12,9,7,.86),rgba(6,5,5,.55));backdrop-filter:blur(12px)}
.logo-b{display:block;padding:0 6px}
.logo{font-family:var(--fd);font-size:19px;letter-spacing:.62em;color:var(--ink);text-shadow:0 0 18px rgba(255,180,100,.25)}
.logo.sm{font-size:15px}.logo.xs{font-size:12px;letter-spacing:.55em}
.logo-sub{font-family:var(--fm);font-size:9.5px;letter-spacing:.36em;color:var(--amber);margin-top:9px;text-transform:uppercase}
.side-orb{display:flex;align-items:center;gap:12px;margin:26px 0 22px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,150,50,.03)}
.so-w{font-family:var(--fd);font-size:10.5px;letter-spacing:.3em;color:var(--hi)}
.so-s{font-size:11.5px;color:var(--dim);margin-top:3px}
.mini-orb{flex:none;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#ffe0ad 0%,#ff9a33 34%,#6b2b06 72%,#2a1003 100%);box-shadow:0 0 14px rgba(255,150,50,.55),inset 0 0 6px rgba(255,220,160,.35)}
.mini-orb.sm{width:14px;height:14px}
.mini-orb.live{animation:breathe 1.3s ease-in-out infinite}
@keyframes breathe{0%,100%{box-shadow:0 0 10px rgba(255,150,50,.45)}50%{box-shadow:0 0 26px rgba(255,160,60,.95)}}
.nav{display:flex;flex-direction:column;gap:2px}
.nav-i{position:relative;display:flex;align-items:center;gap:13px;padding:11px 12px;border-radius:10px;color:var(--muted);font-size:13.5px;font-weight:500;transition:color .2s,background .2s}
.nav-i:hover{color:var(--ink);background:rgba(255,170,70,.04)}
.nav-i.on{color:var(--hi);background:linear-gradient(90deg,rgba(255,160,60,.13),rgba(255,160,60,0))}
.nav-i.on::before{content:'';position:absolute;left:-18px;top:9px;bottom:9px;width:2px;background:var(--amber);box-shadow:0 0 12px var(--amber)}
.badge{margin-left:auto;font-family:var(--fm);font-size:10px;min-width:20px;height:18px;padding:0 6px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line2);color:var(--hi)}
.side-f{margin-top:auto;padding:14px 6px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-end}
.side-v{font-family:var(--fm);font-size:9.5px;color:var(--dim);text-align:right;line-height:1.6}

/* main */
.main{min-width:0;padding:22px 30px 34px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;min-height:28px}
.tb-t{font-family:var(--fd);font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--muted)}
.tb-r{display:flex;align-items:center;gap:18px}
.mock{font-family:var(--fm);font-size:10px;color:var(--amber);border:1px dashed var(--line2);border-radius:999px;padding:5px 11px}
.tclock{display:flex;align-items:baseline;gap:12px}
.tc-l{font-family:var(--fm);font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--dim)}
.tc-t{font-family:var(--fm);font-size:13px;color:var(--hi);font-variant-numeric:tabular-nums}
.foot{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:26px;padding:18px 4px 0;border-top:1px solid var(--line)}
.foot-m{font-family:var(--fm);font-size:9.5px;letter-spacing:.5em;text-transform:uppercase;color:var(--dim);text-align:center}

/* primitives */
.pnl{position:relative;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(255,150,50,.045),rgba(255,150,50,0) 38%),var(--panel);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 30px 80px -40px rgba(0,0,0,.95),inset 0 1px 0 rgba(255,220,170,.035);padding:18px 20px}
.pnl::before,.pnl::after{content:'';position:absolute;width:24px;height:24px;pointer-events:none}
.pnl::before{top:-1px;left:-1px;border-top:1px solid var(--amber);border-left:1px solid var(--amber);border-top-left-radius:18px}
.pnl::after{bottom:-1px;right:-1px;border-bottom:1px solid var(--amber);border-right:1px solid var(--amber);border-bottom-right-radius:18px}
.pnl-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--line)}
.pnl-t{font-family:var(--fd);font-size:10.5px;font-weight:400;letter-spacing:.3em;text-transform:uppercase;color:var(--ink)}
.tag{display:inline-flex;align-items:center;gap:8px;font-family:var(--fm);font-size:10px;letter-spacing:.22em;text-transform:uppercase}
.dot{width:7px;height:7px;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c);flex:none;display:inline-block}
.dot.pulse{animation:pulse 1.6s ease-in-out infinite}
.dot.ring{background:transparent;border:1.5px solid var(--c)}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.72)}}
.chip{display:inline-flex;align-items:center;gap:7px;height:24px;padding:0 10px;border-radius:12px;border:1px solid;font-family:var(--fm);font-size:10.5px;white-space:nowrap}
.chip.sm{height:20px;padding:0 8px;font-size:9.5px;gap:6px}.chip.sm .dot{width:6px;height:6px}
.prog{height:3px;border-radius:2px;background:rgba(255,170,70,.1);overflow:hidden}
.prog i{display:block;height:100%;border-radius:2px;transition:width .9s ease}
.rid{font-family:var(--fm);font-size:10.5px;color:var(--dim);margin-right:8px}
.qbar{position:relative;height:3px;border-radius:2px;background:rgba(255,170,70,.1)}
.qbar i{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:linear-gradient(90deg,var(--deep),var(--hi));box-shadow:0 0 8px var(--amber)}
.qbar em{position:absolute;top:-4px;width:1px;height:11px;background:#ffd35c;opacity:.7}
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:11px;border:1px solid var(--line2) !important;font-size:13px;font-weight:500;color:var(--hi);transition:background .2s,border-color .2s}
.btn:hover{background:rgba(255,160,60,.08)}
.btn.pri{background:linear-gradient(180deg,var(--hi),var(--deep));color:#1b0f04;border-color:transparent !important;box-shadow:0 0 24px -6px rgba(255,150,50,.7)}
.btn.pri:hover{filter:brightness(1.08)}
.btn.ghost{border-color:var(--line) !important;color:var(--muted)}.btn.ghost:hover{color:var(--ink)}
.btn.danger{border-color:rgba(255,93,79,.45) !important;color:#ff9186}
.btn.full{width:100%;justify-content:center;margin-top:16px}
.lnk{font-size:12.5px;color:var(--hi);border-bottom:1px solid var(--line2) !important;padding-bottom:1px}
.empty{padding:26px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:13.5px;display:flex;gap:10px;align-items:center}
.kv{display:grid;gap:12px}.kv.two{grid-template-columns:1fr 1fr;margin:14px 0 16px}.kv.three{grid-template-columns:repeat(3,1fr);margin-top:12px}
.kv dt{font-size:11px;color:var(--dim)}.kv dd{font-size:13px;color:var(--ink);margin-top:3px;overflow-wrap:anywhere}
.ph{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:4px 0 22px;flex-wrap:wrap}
.ph-t{font-family:var(--fd);font-size:24px;font-weight:400;letter-spacing:.34em;text-transform:uppercase;text-shadow:0 0 24px rgba(255,170,80,.18)}
.ph-s{color:var(--muted);font-size:14px;margin-top:10px;max-width:60ch}
.search{display:flex;align-items:center;gap:10px;height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:rgba(14,10,7,.7);color:var(--dim);min-width:250px}
.search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:var(--ink);font-size:13.5px}
.search:focus-within{border-color:var(--line2)}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.tab{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;padding:7px 13px;border-radius:999px;border:1px solid var(--line) !important;color:var(--muted);transition:.2s}
.tab:hover{color:var(--ink);border-color:var(--line2) !important}
.tab.on{color:#1b0f04;background:var(--amber);border-color:var(--amber) !important;box-shadow:0 0 18px -4px rgba(255,160,60,.7)}
.tab .cnt{font-family:var(--fm);font-size:10.5px;opacity:.6}
.tab.pf{color:var(--hi);border-style:dashed !important}

/* home grid */
.home-grid{display:grid;gap:18px;grid-template-columns:minmax(0,1fr) minmax(0,1.42fr) minmax(0,1fr);
  grid-template-areas:"hero hero hero" "act core runs" "sys core quick" "pipe pipe pipe"}
.hero{display:grid;grid-template-columns:1.15fr 1fr .9fr;align-items:end;min-height:214px;overflow:hidden;padding:28px 32px}
.planet{position:absolute;left:50%;top:48px;width:600px;height:600px;margin-left:-300px;border-radius:50%;overflow:hidden;pointer-events:none;
  background:radial-gradient(circle at 60% 12%,#2a1e14 0%,#120d09 30%,#060505 62%);
  box-shadow:0 -1px 0 rgba(255,196,130,.55),0 -18px 60px -8px rgba(255,140,40,.28),inset 0 18px 50px rgba(255,150,60,.14)}
.planet i,.hz-l i{position:absolute;border-radius:50%;background:#ffbb66;box-shadow:0 0 6px #ff9a30}
.hero-l,.hero-m,.hero-r{position:relative;z-index:1}
.greet{font-weight:300;font-size:32px;letter-spacing:-.01em;line-height:1.1}
.motto{font-family:var(--fm);font-size:11.5px;letter-spacing:.42em;text-transform:uppercase;line-height:2.1;color:#e8dac6;margin-top:16px}
.focus{margin-top:18px;font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:4px;padding-left:12px;border-left:1px solid var(--amber)}
.focus-k{font-size:11px;color:var(--amber)}
.hero-m{align-self:end;text-align:right;padding-right:6%}
.lage{font-family:var(--fm);font-size:9.5px;letter-spacing:.3em;text-transform:uppercase;line-height:2;color:#d9c8b2}
.hero-r{text-align:right}
.clock{font-weight:300;font-size:64px;letter-spacing:.02em;font-variant-numeric:tabular-nums;line-height:1;color:#fff4e4;text-shadow:0 0 30px rgba(255,160,60,.35)}
.clock .sec{font-size:18px;color:var(--amber);margin-left:6px;vertical-align:top;position:relative;top:6px}
.date{font-family:var(--fm);font-size:11px;letter-spacing:.14em;color:var(--amber);margin-top:10px}
.rule{width:30px;height:1px;background:var(--amber);margin:14px 0 14px auto;box-shadow:0 0 8px var(--amber)}
.hero-l .rule{margin-left:0}
.triad{font-family:var(--fm);font-size:9.5px;letter-spacing:.34em;text-transform:uppercase;line-height:1.9;color:var(--dim)}

.feed{display:flex;flex-direction:column}
.feed-r{display:grid;grid-template-columns:42px 1px minmax(0,1fr);gap:12px;align-items:center;padding:7px 4px;border-radius:6px;width:100%;transition:background .2s}
.feed-r:hover{background:rgba(255,160,60,.05)}
.feed-r .t{font-family:var(--fm);font-size:11px;color:var(--amber)}
.feed-r .sep{height:13px;background:var(--line2)}
.feed-r .m{font-family:var(--fm);font-size:11.5px;color:#e6d8c5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.core{grid-area:core;display:flex;flex-direction:column;align-items:center;min-width:0;padding-top:4px}
.stage{position:relative;width:100%}
.stage-in{position:relative;width:100%;margin-top:14px}
.beam{position:absolute;left:0;top:0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}
.orb-wrap{position:absolute;top:0}
.rings{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.r-base{fill:none;stroke:rgba(255,170,70,.22);stroke-width:1}
.r-tick{fill:none;stroke:rgba(255,170,70,.18);stroke-width:4;stroke-dasharray:1 7}
.r-faint{fill:none;stroke:rgba(255,170,70,.1);stroke-width:1}
.r-arc{fill:none;stroke:#ffb85a;stroke-width:2.2;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(255,160,60,.9))}
.r-arc2{fill:none;stroke:rgba(255,190,110,.5);stroke-width:1}
.ring-rot{animation:spin 70s linear infinite}.ring-rot.fast{animation-duration:16s}.ring-rot.rev{animation-direction:reverse;animation-duration:110s}
@keyframes spin{to{transform:rotate(360deg)}}
.node-dot{fill:#c69a66;filter:drop-shadow(0 0 4px rgba(255,160,60,.6))}
.node.on .node-dot{fill:#fff1d6;filter:drop-shadow(0 0 8px rgba(255,170,70,1))}
.node-halo{fill:rgba(255,170,70,.18);stroke:rgba(255,190,110,.6);transform-box:fill-box;transform-origin:center;animation:halo 1.6s ease-out infinite}
@keyframes halo{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.6);opacity:0}}
.node-t{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.24em;fill:#8f8173}
.node.on .node-t{fill:#ffd08a}
.orb-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.orb-word{font-family:var(--fd);letter-spacing:.46em;padding-left:.46em;color:#fff7ea;text-shadow:0 0 18px rgba(255,190,110,.85),0 0 40px rgba(255,140,40,.5);transition:font-size .3s}
.orb-sub{font-family:var(--fm);font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--amber);margin-top:14px}
.spoken{font-weight:300;font-size:clamp(18px,1.65vw,23px);line-height:1.45;text-align:center;color:#f6ebdb;max-width:30ch;min-height:4.4em;margin-top:2px;text-wrap:balance}
.caret{display:inline-block;width:1px;height:1em;background:var(--amber);margin-left:2px;vertical-align:-2px;animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
.vbars{display:flex;align-items:center;gap:3px;height:38px;margin-top:10px}
.vbars i{display:block;width:2px;border-radius:2px;height:var(--h);background:linear-gradient(180deg,var(--hi),var(--deep));transform:scaleY(.16);transition:transform .5s;box-shadow:0 0 6px rgba(255,150,50,.5)}
.vbars.on i{animation:vb var(--d) ease-in-out infinite alternate;animation-delay:var(--dl)}
@keyframes vb{from{transform:scaleY(.12)}to{transform:scaleY(1)}}
.caption{font-family:var(--fm);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber);margin-top:12px}
.cmdwrap{width:100%;max-width:640px;margin-top:20px}
.cmdwrap.compact{max-width:none;margin-top:14px}
.cmd{display:flex;align-items:center;gap:10px;padding:7px 7px 7px 18px;border-radius:999px;border:1px solid var(--line2);background:rgba(13,9,6,.86);box-shadow:0 0 0 4px rgba(255,160,60,.035),0 22px 50px -24px rgba(255,120,20,.35);transition:border-color .2s,box-shadow .2s}
.cmd:focus-within{border-color:rgba(255,186,100,.8);box-shadow:0 0 0 4px rgba(255,160,60,.09),0 0 44px -10px rgba(255,140,40,.55)}
.cmd-k{font-family:var(--fm);font-size:18px;color:var(--amber);line-height:1}
.cmd input{flex:1;min-width:0;background:transparent;border:0;outline:0;font-size:15px;color:var(--ink);height:36px}
.cmd input::placeholder{color:var(--dim)}
.ibtn{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line) !important;color:var(--muted);transition:.2s}
.ibtn:hover{color:var(--hi);border-color:var(--line2) !important}
.ibtn.on{color:#1a0e03;background:var(--amber);border-color:var(--amber) !important;box-shadow:0 0 18px rgba(255,160,60,.6)}
.ibtn.send{background:linear-gradient(180deg,var(--hi),var(--deep));color:#1a0e03;border-color:transparent !important;box-shadow:0 0 20px rgba(255,150,50,.5)}
.ibtn.send:disabled{opacity:.3;box-shadow:none;cursor:default}
.sugg{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.compact .sugg{justify-content:flex-start}
.sugg button{font-size:12px;color:var(--muted);padding:6px 12px;border:1px solid var(--line) !important;border-radius:999px;transition:.2s}
.sugg button:hover:not(:disabled){color:var(--hi);border-color:var(--line2) !important}
.sugg button:disabled{opacity:.4;cursor:default}

.runs-top{display:flex;align-items:center;gap:18px}
.big{font-weight:300;font-size:60px;line-height:1;color:#fff3e2;font-variant-numeric:tabular-nums;text-shadow:0 0 26px rgba(255,170,80,.35)}
.big-l{font-family:var(--fm);font-size:10px;letter-spacing:.24em;text-transform:uppercase;line-height:1.9;color:var(--ink)}
.big-l span{color:var(--amber);letter-spacing:.1em;text-transform:none;font-size:11px}
.runs-mid{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:end;margin:18px 0 16px}
.bars{display:flex;align-items:flex-end;gap:4px;height:78px}
.bars i{flex:1;border-radius:1px;background:linear-gradient(180deg,var(--hi),var(--deep) 70%,rgba(255,110,20,.35));box-shadow:0 0 10px rgba(255,140,40,.25)}
.stats{display:flex;flex-direction:column;gap:8px}
.stats div{display:flex;gap:10px;align-items:baseline;font-size:12px;color:var(--muted)}
.stats dt{font-family:var(--fm);color:var(--amber);min-width:40px}
.mini-runs{display:flex;flex-direction:column;gap:8px}
.mini-run,.runcard{display:block;width:100%;padding:11px 12px;border-radius:12px;border:1px solid var(--line) !important;background:rgba(255,150,50,.025);transition:border-color .2s,background .2s}
.mini-run:hover,.runcard:hover{border-color:var(--line2) !important;background:rgba(255,150,50,.05)}
.mr-h{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mr-t{font-size:13px;color:var(--ink);margin:6px 0 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.svc-list{display:flex;flex-direction:column}
.svc-r{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 4px;border-bottom:1px solid rgba(255,170,70,.07);width:100%;border-radius:4px}
.svc-r:hover{background:rgba(255,160,60,.04)}
.svc-n{font-family:var(--fm);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#e2d4c1}
.svc-s{display:inline-flex;align-items:center;gap:9px;font-family:var(--fm);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase}
.usage{margin-top:16px}
.usage-h{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:9px}
.usage-h b{font-family:var(--fm);font-weight:500;color:var(--hi)}

.quick{display:flex;flex-direction:column}
.q-i{display:flex;align-items:center;gap:14px;padding:9px 6px;border-radius:8px;color:var(--amber);width:100%;transition:background .2s}
.q-i span:not(.badge){font-family:var(--fm);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#e6d8c5}
.q-i:hover{background:rgba(255,160,60,.06)}
.q-i .q-ch{margin-left:auto;color:var(--dim);opacity:0;transition:opacity .2s}
.q-i:hover .q-ch{opacity:1}

.pipe{height:330px;overflow:hidden;padding:0}
.hz{position:absolute;left:-18%;right:-18%;top:218px;height:1100px;border-radius:50%;overflow:hidden;
  background:radial-gradient(ellipse at 50% 0%,#241a11 0%,#0d0a07 26%,#050404 52%);
  box-shadow:0 -1px 0 rgba(255,196,130,.55),0 -30px 80px -20px rgba(255,140,40,.35)}
.hz-l{position:absolute;inset:0}
.arc{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.arc-base{fill:none;stroke:rgba(255,170,70,.18);stroke-width:1;stroke-dasharray:2 5;vector-effect:non-scaling-stroke}
.arc-hot{fill:none;stroke:#ffb85a;stroke-width:1.6;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 4px rgba(255,160,60,.9));transition:stroke-dasharray .8s}
.arc-p{fill:#fff1d6;filter:drop-shadow(0 0 6px #ffab40)}
.pn{position:absolute;width:0;height:0;z-index:2}
.pn-dot{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#3a2b1d;border:1px solid rgba(255,170,70,.4)}
.pn.done .pn-dot{background:var(--amber);border-color:var(--amber);box-shadow:0 0 12px var(--amber)}
.pn.cur .pn-dot{left:-8px;top:-8px;width:16px;height:16px;background:#fff1d6;border:3px solid var(--amber);box-shadow:0 0 0 6px rgba(255,170,64,.15),0 0 24px var(--amber);animation:breathe 1.4s infinite}
.pn-l{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);text-align:center;white-space:nowrap}
.pn-n{font-family:var(--fm);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:#e9dbc7}
.pn.todo .pn-n{color:var(--dim)}.pn.cur .pn-n{color:var(--hi)}
.pn-d{font-size:10.5px;color:var(--dim);margin-top:3px}
.pipe-over{position:absolute;left:22px;right:22px;top:22px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;z-index:3;pointer-events:none}
.pipe-over>*{pointer-events:auto}
.res{width:330px;padding:16px 18px}
.res-h{display:flex;justify-content:space-between;align-items:center;gap:10px}
.res-t{font-size:15px;font-weight:500;margin:12px 0 6px}
.res-d{font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:12px}
.pipe-tag{text-align:right}
.pt-k{font-family:var(--fm);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--amber)}
.pipe-tag p{font-family:var(--fm);font-size:10px;letter-spacing:.28em;text-transform:uppercase;line-height:2;color:#d8c8b3;margin-top:8px}
.only-narrow{display:none}

/* chat */
.chat-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start}
.chat-pnl{display:flex;flex-direction:column;padding:18px}
.thread{display:flex;flex-direction:column;gap:18px;overflow-y:auto;height:calc(100vh - 330px);min-height:360px;padding:6px 6px 10px}
.msg{display:flex;gap:12px;max-width:78ch}
.msg.u{align-self:flex-end;flex-direction:column;align-items:flex-end;gap:5px}
.bubble{padding:11px 16px;border-radius:16px 16px 4px 16px;border:1px solid var(--line2);background:rgba(255,160,60,.08);font-size:14.5px;line-height:1.5}
.mt{font-family:var(--fm);font-size:10px;color:var(--dim)}
.av{width:28px;height:28px;margin-top:2px}
.jbody{min-width:0;flex:1}
.jh{display:flex;gap:10px;align-items:baseline;margin-bottom:5px}
.jn{font-family:var(--fd);font-size:9.5px;letter-spacing:.34em;color:var(--amber)}
.jbody p{font-size:15px;line-height:1.6;color:#efe3d2;font-weight:400}
.runcard{margin-top:12px;max-width:420px}
.rc-b{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;color:var(--muted);margin-top:9px}
.typing{display:flex;gap:5px;padding:8px 0}
.typing i{width:6px;height:6px;border-radius:50%;background:var(--amber);animation:pulse 1s infinite}
.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
.ctx{display:flex;flex-direction:column;gap:16px}
.mem-mini{display:flex;flex-direction:column;gap:14px}
.mem-mini p{font-size:13px;color:var(--muted);line-height:1.5;margin-top:5px}

/* stepper */
.stepper{list-style:none;padding:0;margin:4px 0 0}
.st{display:grid;grid-template-columns:22px 1fr;gap:12px;padding:7px 0;position:relative}
.st::before{content:'';position:absolute;left:10.5px;top:30px;bottom:-7px;width:1px;background:var(--line)}
.st:last-child::before{display:none}
.st-dot{width:22px;height:22px;border-radius:50%;border:1px solid var(--faint);display:grid;place-items:center;color:#1a0e03}
.st.done .st-dot{background:var(--amber);border-color:var(--amber)}
.st.done::before{background:var(--line2)}
.st.cur .st-dot{border-color:var(--amber);box-shadow:0 0 0 4px rgba(255,170,64,.12),0 0 16px rgba(255,170,64,.5)}
.st.cur .st-dot::after{content:'';width:7px;height:7px;border-radius:50%;background:var(--amber);animation:pulse 1.4s infinite}
.st.bad .st-dot{border-color:#ff5d4f;box-shadow:0 0 14px rgba(255,93,79,.45)}.st.bad .st-dot::after{background:#ff5d4f;animation:none}
.st-n{font-size:13.5px;color:var(--ink)}.st.todo .st-n{color:var(--dim)}
.st-d{font-size:11.5px;color:var(--dim);margin-top:2px}

/* tasks */
.split{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;align-items:start;margin-top:6px}
.rows{display:flex;flex-direction:column;gap:8px}
.row{display:grid;grid-template-columns:3px minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 18px 14px 0;border:1px solid var(--line) !important;border-radius:14px;background:rgba(14,11,8,.6);transition:border-color .2s,background .2s;width:100%;overflow:hidden}
.row:hover{border-color:var(--line2) !important}
.row.sel{border-color:rgba(255,186,100,.7) !important;background:rgba(255,160,60,.06);box-shadow:0 0 34px -14px rgba(255,150,50,.6)}
.row-bar{align-self:stretch;margin:-14px 0}
.row-t{font-size:14.5px;font-weight:500}
.row-m{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dim);margin-top:5px}
.row-m span:first-child{font-family:var(--fm)}
.row-r{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.detail{position:sticky;top:20px}
.d-t{font-size:19px;font-weight:500;line-height:1.3}
.note{font-size:13px;color:var(--muted);margin:12px 0 16px;padding:10px 12px;border-radius:10px;background:rgba(255,150,50,.04);border:1px solid var(--line)}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}

/* projects */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.proj{display:flex;flex-direction:column}
.proj-h{display:flex;justify-content:space-between;align-items:center}
.proj-tag{font-size:11.5px;color:var(--amber)}
.proj-n{font-family:var(--fd);font-size:16px;font-weight:400;letter-spacing:.26em;text-transform:uppercase;margin:14px 0 8px}
.proj-d{font-size:13.5px;color:var(--muted);line-height:1.55;flex:1;margin-bottom:14px}
.proj-run{font-size:12.5px;color:#e6d8c5;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.proj-f{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--dim);margin-top:14px}
.proj-f span{display:inline-flex;align-items:center;gap:5px}
.proj-f span:first-child{font-family:var(--fm)}

/* memory */
.mem{display:grid;grid-template-columns:210px minmax(0,1fr);gap:18px;align-items:start}
.cats{display:flex;flex-direction:column;gap:2px;position:sticky;top:20px}
.cat{display:flex;justify-content:space-between;width:100%;padding:10px 12px;border-radius:10px;font-size:13.5px;font-weight:500;color:var(--muted);transition:.2s}
.cat:hover{color:var(--ink)}
.cat.on{color:var(--hi);background:rgba(255,160,60,.09)}
.cat .cnt{font-family:var(--fm);font-size:11px;color:var(--dim)}
.mem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.mi{padding:16px 18px}
.mi-k{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--amber)}
.mi-v{font-size:14.5px;line-height:1.55;margin:9px 0 12px;color:var(--ink)}
.mi-f{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--dim)}

/* approvals */
.ap-list{display:flex;flex-direction:column;gap:16px}
.ap{padding:22px 24px}
.ap-h{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.ap-t{font-size:19px;font-weight:500;margin-top:6px}
.later{font-size:11px;color:var(--amber);border:1px dashed var(--line2);border-radius:999px;padding:2px 8px}
.risk{display:inline-flex;align-items:center;gap:10px;font-size:12.5px;font-weight:500}
.risk-b{display:flex;gap:3px}.risk-b i{width:18px;height:4px;border-radius:2px;background:var(--faint)}
.ap-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 26px;margin:18px 0 4px}
.ap-grid .span2{grid-column:1/-1}
.ap-grid .k{font-size:11.5px;color:var(--dim);margin-bottom:5px}
.ap-grid .v{font-size:13.5px;line-height:1.55}
.ap-grid .v.mono{font-size:12.5px;color:#f1d8b4}
.sys-chips{display:flex;flex-wrap:wrap;gap:6px}
.sys-chips span{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line2);color:var(--hi)}
.code{font-family:var(--fm);font-size:12px;line-height:1.75;white-space:pre-wrap;margin:0;background:rgba(0,0,0,.38);border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:#f1d8b4}
.ap-done{margin-top:18px}
.apd{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,170,70,.07);font-size:13.5px}
.apd:last-child{border-bottom:0}
.apd-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.big-empty{margin-bottom:16px}

/* system */
.chain{display:flex;align-items:center;overflow-x:auto;padding:8px 2px 4px}
.cn{flex:1 0 110px;text-align:center;display:flex;flex-direction:column;align-items:center}
.cn-dot{width:12px;height:12px;border-radius:50%;background:#3a2b1d;border:1px solid rgba(255,170,70,.4);margin-bottom:10px}
.cn.done .cn-dot{background:var(--amber);border-color:var(--amber);box-shadow:0 0 12px var(--amber)}
.cn.cur .cn-dot{background:#fff1d6;border:3px solid var(--amber);box-shadow:0 0 0 5px rgba(255,170,64,.15),0 0 20px var(--amber);animation:breathe 1.4s infinite}
.cn-n{font-family:var(--fm);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase}
.cn.todo .cn-n{color:var(--dim)}
.cn-d{font-size:11px;color:var(--dim);margin-top:3px}
.ca{flex:1 1 30px;min-width:18px;height:1px;background:var(--line);margin-bottom:34px}
.ca.on{background:var(--amber);box-shadow:0 0 8px var(--amber)}
.svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin:18px 0}
.svc-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.svc-t{font-family:var(--fd);font-size:12px;letter-spacing:.22em;text-transform:uppercase}
.svc-role{font-size:12px;color:var(--dim);margin-top:5px}
.spark{width:100%;height:40px;margin-top:14px;display:block}
.svc-last{font-size:12px;color:var(--muted);margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.sys-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.sys-2 .usage:first-child{margin-top:0}
.notices{display:flex;flex-direction:column;gap:10px}
.notice{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:12px;border:1px solid;background:rgba(0,0,0,.2)}
.n-t{font-size:13.5px;font-weight:500}.n-d{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.5}

/* logs */
.logs{padding:6px 0}
.log-w{border-bottom:1px solid rgba(255,170,70,.07)}
.log-w:last-child{border-bottom:0}
.log-w.open{background:rgba(255,150,50,.035)}
.log{display:grid;grid-template-columns:70px 72px 96px minmax(0,1fr) 18px;gap:14px;align-items:center;padding:11px 18px;width:100%;font-size:13px}
.log:hover{background:rgba(255,150,50,.03)}
.lt{font-family:var(--fm);font-size:11px;color:var(--amber)}
.ll{font-size:11.5px;font-weight:600}
.ls{font-size:12px;color:var(--muted)}
.lm{color:#e8dac8;min-width:0}
.lr{font-family:var(--fm);font-size:10.5px;color:var(--dim);margin-left:10px}
.lc{color:var(--dim)}
.show-sm{display:none}
.ev{padding:2px 18px 16px 190px}
.ev-h{font-family:var(--fm);font-size:11px;color:#6cd3ff;margin-bottom:8px}
.ev ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:6px;margin-bottom:6px}
.ev li{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#d9ccb9}
.ev li svg{color:#a8d8a0}

/* responsive */
@media (max-width:1320px){
  .home-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"hero hero" "core core" "act runs" "sys quick" "pipe pipe"}
}
@media (max-width:1100px){
  .split,.chat-grid{grid-template-columns:1fr}
  .detail{position:static}
  .ctx{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .sys-2{grid-template-columns:1fr}
}
.mtop{display:none;align-items:center;justify-content:space-between;padding:6px 4px 14px;margin-bottom:14px;border-bottom:1px solid var(--line)}
.mtop-r{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--hi)}
.mnav{display:none;position:fixed;left:10px;right:10px;bottom:10px;z-index:20;height:64px;border-radius:20px;border:1px solid var(--line2);background:rgba(10,8,6,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);overflow-x:auto;padding:0 4px;align-items:center;scrollbar-width:none;box-shadow:0 20px 50px -10px rgba(0,0,0,.9)}
.mnav::-webkit-scrollbar,.cats::-webkit-scrollbar{display:none}
.mnav button{flex:1 0 62px;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:10px;font-weight:500;color:var(--dim);padding:8px 0;position:relative}
.mnav button.on{color:var(--hi)}
.mnav button.on svg{filter:drop-shadow(0 0 6px var(--amber))}
.mnav .b{position:absolute;top:6px;right:calc(50% - 16px);width:6px;height:6px;border-radius:50%;background:var(--amber);box-shadow:0 0 6px var(--amber)}
/* Wave 7: this block must follow the .mtop/.mnav base rules above so the
   mobile top bar and bottom nav actually show on small viewports (equal
   specificity -> later source wins). Visual styling itself is unchanged. */
@media (max-width:980px){
  .shell{grid-template-columns:1fr}
  .side,.topbar{display:none}
  .mtop{display:flex}.mnav{display:flex}
  .main{padding:14px 14px 100px}
  .mem{grid-template-columns:1fr}
  .cats{position:static;flex-direction:row;overflow-x:auto;scrollbar-width:none}
  .cat{flex:none;gap:10px;width:auto}
}
@media (max-width:720px){
  .home-grid{grid-template-columns:1fr;grid-template-areas:"hero" "core" "runs" "act" "quick" "sys" "pipe";gap:14px}
  .hero{grid-template-columns:1fr auto;min-height:0;padding:22px 20px;align-items:start}
  .hero-m,.triad,.hero-r .rule{display:none}
  .planet{left:auto;right:-360px;top:60px;margin:0;opacity:.8}
  .greet{font-size:24px}.motto{font-size:10px;letter-spacing:.34em;margin-top:12px}
  .focus{display:none}
  .clock{font-size:40px}.clock .sec{display:none}.date{font-size:9.5px;letter-spacing:.08em}
  .pnl{padding:16px}
  .ph-t{font-size:19px;letter-spacing:.28em}
  .search{min-width:0;width:100%}
  .pipe{height:auto;padding:0 0 60px}
  .hz{top:auto;bottom:-1040px}
  .only-wide{display:none !important}
  .only-narrow{display:block}
  .pipe-over{position:relative;left:auto;right:auto;top:auto;padding:16px 16px 0}
  .res{width:100%}
  .pipe-list{list-style:none;margin:16px 16px 0;padding:0;position:relative;z-index:3}
  .pipe-list li{display:grid;grid-template-columns:14px 100px 1fr;gap:10px;align-items:center;padding:7px 0;font-size:12.5px}
  .pl-dot{width:9px;height:9px;border-radius:50%;background:#3a2b1d;border:1px solid rgba(255,170,70,.4)}
  .pipe-list .done .pl-dot{background:var(--amber);box-shadow:0 0 10px var(--amber)}
  .pipe-list .cur .pl-dot{background:#fff1d6;box-shadow:0 0 0 4px rgba(255,170,64,.2),0 0 14px var(--amber)}
  .pl-n{font-family:var(--fm);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
  .pipe-list .todo .pl-n{color:var(--dim)}.pipe-list .cur .pl-n{color:var(--hi)}
  .pl-d{color:var(--dim)}
  .thread{height:calc(100vh - 360px)}
  .row{grid-template-columns:3px minmax(0,1fr);padding-right:14px}
  .row-r{grid-column:2;flex-direction:row;align-items:center;justify-content:space-between}
  .kv.two,.kv.three{grid-template-columns:1fr 1fr}
  .ap{padding:18px}.ap-grid{grid-template-columns:1fr}
  .apd{grid-template-columns:minmax(0,1fr) auto}.apd .rid,.apd .mono{display:none}
  .log{grid-template-columns:58px minmax(0,1fr) 16px;padding:11px 14px;gap:10px}
  .hide-sm{display:none}
  .show-sm{display:block;font-size:10.5px;font-weight:600;margin-bottom:2px}
  .ev{padding:2px 14px 14px 14px}
  .foot{flex-wrap:wrap;justify-content:center}
  .foot-m{letter-spacing:.3em;order:3;width:100%}
}
@media (prefers-reduced-motion:reduce){
  .jcc *,.jcc *::before,.jcc *::after{animation-duration:.001s !important;animation-iteration-count:1 !important;transition:none !important}
}
`;
