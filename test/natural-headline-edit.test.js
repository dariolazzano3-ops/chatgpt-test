import test from "node:test";
import assert from "node:assert/strict";
import { planNaturalEdit } from "../src/edit-planner.js";
import { executeNaturalEditPlan } from "../src/edit-executor.js";

const html = '<main><section class="hero"><h1>Old headline</h1></section></main>';
const css = '.hero{min-height:80vh}';

test("understands German natural headline instruction", () => {
  const plan = planNaturalEdit('Ändere die Hero-Headline auf "Alpha denkt voraus"');
  assert.equal(plan.requires_interpretation, false);
  assert.equal(plan.operations[0].action, "replace_text");
  const result = executeNaturalEditPlan({ html, css, plan });
  assert.equal(result.ok, true);
  assert.match(result.html, /<h1>Alpha denkt voraus<\/h1>/);
  assert.deepEqual(result.changed_files, ["index.html"]);
});

test("understands English natural headline instruction", () => {
  const plan = planNaturalEdit('Change the headline to "Built for tomorrow"');
  const result = executeNaturalEditPlan({ html, css, plan });
  assert.equal(result.ok, true);
  assert.match(result.html, /<h1>Built for tomorrow<\/h1>/);
});
