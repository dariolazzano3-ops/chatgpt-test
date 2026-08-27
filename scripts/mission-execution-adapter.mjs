import fs from "node:fs";
import path from "node:path";
import { prepareMissionTaskDispatch, reconcileMissionTaskFromWebJob } from "../src/mission-execution-bridge.js";

const args = process.argv.slice(2);
const command = args[0] || "help";
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const boolFlag = (name) => flag(name, "false") === "true";
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJsonAtomic = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, file);
};
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

try {
  if (command === "prepare") {
    const missionFile = flag("mission");
    const taskId = flag("task");
    const requestOut = flag("request-out");
    if (!missionFile || !taskId || !requestOut) throw new Error("PREPARE_ARGUMENTS_REQUIRED");
    const mission = readJson(missionFile);
    const result = prepareMissionTaskDispatch(
      mission,
      taskId,
      { authorized: boolFlag("authorize"), production_deploy: false },
      { project_slug: flag("project-slug"), project_name: flag("project-name"), source_url: flag("source-url"), external_job_id: flag("external-job-id") }
    );
    if (!result.ok) throw new Error(result.error);
    writeJsonAtomic(missionFile, result.mission);
    writeJsonAtomic(requestOut, result.factory_request);
    output({ ok: true, mission_file: missionFile, request_file: requestOut, task_id: taskId, adapter_id: result.envelope.adapter_id, production_deploy: false, automatic_dispatch: false });
  } else if (command === "reconcile") {
    const missionFile = flag("mission");
    const taskId = flag("task");
    const jobFile = flag("job");
    if (!missionFile || !taskId || !jobFile) throw new Error("RECONCILE_ARGUMENTS_REQUIRED");
    const result = reconcileMissionTaskFromWebJob(readJson(missionFile), taskId, readJson(jobFile));
    if (!result.ok) throw new Error(result.error);
    if (!result.pending) writeJsonAtomic(missionFile, result.mission);
    output({ ok: true, pending: result.pending === true, mission_file: missionFile, task_id: taskId, status: result.mission?.status || null, production_deploy: false });
  } else {
    output({ ok: true, commands: ["prepare", "reconcile"], automatic_dispatch: false, production_deploy: false, authorization_required: true });
  }
} catch (error) {
  output({ ok: false, error: String(error?.message || error), automatic_dispatch: false, production_deploy: false });
  process.exit(1);
}
