import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const here=path.resolve(import.meta.dirname,"..");
test("HTML contains accessible tap target, upgrades, saves and flavor choices",()=>{
  const html=fs.readFileSync(path.join(here,"index.html"),"utf8");
  for(const required of ['id="scoopButton"','id="upgradeList"','id="resetButton"','id="score"','data-flavor="vanille"','name="viewport"']){
    assert.ok(html.includes(required),required);
  }
});
test("all four referenced flavor image files are present",()=>{
  for(const flavor of ["vanille","erdbeere","schokolade","pistazie"]){
    assert.ok(fs.statSync(path.join(here,"assets","flavors",flavor+".webp")).size>1000);
  }
});
test("standalone game does not depend on network APIs or remote scripts",()=>{
  const html=fs.readFileSync(path.join(here,"index.html"),"utf8");
  assert.ok(!/<script[^>]*https?:/i.test(html));
  assert.ok(!/https?:\/\//i.test(fs.readFileSync(path.join(here,"game.js"),"utf8")));
});
