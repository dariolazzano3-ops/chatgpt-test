import fs from "node:fs";
import path from "node:path";
import { buildOrchestrationPlan } from "../src/orchestration-planner.js";
import { createMission, transitionMissionTask, buildTaskExecutionContract, resumeMission } from "../src/orchestration-state.js";

const ROOT = process.env.FACTORY_MISSION_DIR || "factory-state/missions";
const args = process.argv.slice(2);
const command = args[0] || "help";
function ensureRoot() { fs.mkdirSync(ROOT, { recursive: true }); }
function safeId(value) { const id = String(value || "").trim(); if (!/^mission-[a-f0-9]{24}$/.test(id)) throw new Error("INVALID_MISSION_ID"); return id; }
function missionPath(id) { return path.join(ROOT, `${safeId(id)}.json`); }
function load(id) { return JSON.parse(fs.readFileSync(missionPath(id), "utf8")); }
function save(mission) { ensureRoot(); const target = missionPath(mission.mission_id); const temp = `${target}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(mission, null, 2)}\n`); fs.renameSync(temp, target); return target; }
function flag(name, fallback = null) { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : fallback; }
function jsonFlag(name, fallback = {}) { const value = flag(name); if (!value) return fallback; return JSON.parse(value); }
function output(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

try {
  if (command === "create") { const plan = buildOrchestrationPlan({ prompt: flag("prompt"), project: flag("project") }); const result = createMission({ plan }); if (!result.ok) throw new Error(result.error); output({ ok: true, file: save(result), mission: result }); }
  else if (command === "show") output({ ok: true, mission: load(flag("mission")) });
  else if (command === "transition") { const result = transitionMissionTask(load(flag("mission")), flag("task"), flag("action"), jsonFlag("payload")); if (!result.ok) throw new Error(result.error); output({ ok: true, file: save(result.mission), mission: result.mission }); }
  else if (command === "resume") { const result = resumeMission(load(flag("mission"))); if (!result.ok) throw new Error(result.error); output({ ok: true, file: save(result.mission), mission: result.mission }); }
  else if (command === "contract") { const result = buildTaskExecutionContract(load(flag("mission")), flag("task")); if (!result.ok) throw new Error(result.error); output(result); }
  else output({ ok: true, commands: ["create", "show", "transition", "resume", "contract"], mission_root: ROOT, production_deploy: false });
} catch (error) { output({ ok: false, error: String(error?.message || error), production_deploy: false }); process.exit(1); }
