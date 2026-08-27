import fs from "node:fs";

const required = [
  "src/execution-adapters.js",
  "src/mission-execution-bridge.js",
  "scripts/execution-adapter-smoke.mjs"
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`V39_REQUIRED_FILE_MISSING:${file}`);
}

const adapters = fs.readFileSync("src/execution-adapters.js", "utf8");
const bridge = fs.readFileSync("src/mission-execution-bridge.js", "utf8");

for (const token of ["web-factory-v1", "automatic_execution: false", "production_deploy: false", "EXECUTION_ADAPTER_UNAVAILABLE", "PRODUCTION_SIDE_EFFECT_REJECTED"]) {
  if (!adapters.includes(token)) throw new Error(`V39_ADAPTER_GUARD_MISSING:${token}`);
}
for (const token of ["factory-control.yml", "automatic_dispatch: false", "webFactoryJobToAdapterResult", "reconcileMissionTaskResult", "production_deploy: false"]) {
  if (!bridge.includes(token)) throw new Error(`V39_BRIDGE_GUARD_MISSING:${token}`);
}

console.log("LEAN V3.9 readiness passed");
