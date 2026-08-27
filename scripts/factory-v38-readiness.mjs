import fs from "node:fs";

const failures=[]; const passes=[];
const read=(p)=>fs.existsSync(p)?fs.readFileSync(p,"utf8"):(failures.push(`missing ${p}`),"");
const need=(label,text,value)=>text.includes(value)?passes.push(label):failures.push(`${label}: expected ${JSON.stringify(value)}`);

const state=read("src/orchestration-state.js");
const store=read("scripts/orchestration-mission-state.mjs");
const pkg=read("package.json");

need("Mission schema is versioned",state,'orchestration_version: "3.8"');
need("Mission IDs are deterministic",state,'mission-${digest(missionCore).slice(0, 24)}');
need("Mission tasks track dependencies",state,"depends_on:");
need("Mission tasks have bounded attempts",state,"max_attempts: 3");
need("Mission transitions require ready state",state,'error: "TASK_NOT_READY"');
need("Mission completion carries outputs",state,"task.outputs");
need("Execution contracts carry dependency outputs",state,"dependency_outputs");
need("Interrupted missions are resumable",state,"INTERRUPTED_EXECUTION");
need("Mission core disables production",state,"production_deploy: false");
need("Mission store uses durable factory-state path",store,'factory-state/missions');
need("Mission store writes atomically",store,"fs.renameSync(temp, target)");
need("Mission CLI supports contracts",store,'command === "contract"');
need("Package includes orchestration state syntax check",pkg,"node --check src/orchestration-state.js");
need("Package includes durable mission store syntax check",pkg,"node --check scripts/orchestration-mission-state.mjs");
need("Package executes V3.8 smoke",pkg,"node scripts/orchestration-state-smoke.mjs");

const result={version:"LEAN V3.8",ready:failures.length===0,checks_passed:passes.length,checks_failed:failures.length,passes,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
