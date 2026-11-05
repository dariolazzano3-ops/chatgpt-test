import test from "node:test";
import assert from "node:assert/strict";
import {newGame,sanitizeState,getStats,getCost,clickScoop,buyUpgrade,produce,getMilestone,UPGRADES,formatNumber} from "../economy.mjs";
test("new game has one scoop per click and zero passive production",()=>{
  assert.deepEqual(getStats(newGame(1000)),{perClick:1,perSecond:0,totalOwned:0});
});
test("a tap earns one scoop and increments lifetime clicks",()=>{
  const s=clickScoop(newGame());
  assert.equal(s.balance,1);assert.equal(s.totalMade,1);assert.equal(s.totalClicks,1);
});
test("upgrades cost more each time",()=>{
  const u=UPGRADES[0];
  assert.equal(getCost(u,0),15);
  assert.ok(getCost(u,1)>getCost(u,0));
});
test("cannot buy an upgrade without balance",()=>{
  const s=newGame();
  const result=buyUpgrade(s,"streusel");
  assert.equal(result.ok,false);assert.equal(result.state.balance,0);
});
test("buying an upgrade subtracts cost and adds click power",()=>{
  const start={...newGame(),balance:100};
  const result=buyUpgrade(start,"streusel");
  assert.equal(result.ok,true);assert.equal(result.state.balance,85);
  assert.equal(getStats(result.state).perClick,2);assert.equal(start.balance,100);
});
test("automatic production earns idle scoops",()=>{
  const s={...newGame(),owned:{helfer:2,maschine:1}};
  assert.equal(getStats(s).perSecond,10);
  assert.equal(produce(s,10).balance,100);
  assert.equal(produce(s,10).totalMade,100);
});
test("offline production is capped at eight hours",()=>{
  const s={...newGame(),owned:{helfer:1}};
  assert.equal(produce(s,48*3600).balance,8*3600);
});
test("milestone progress advances after completing a milestone",()=>{
  assert.equal(getMilestone(50).progress,.5);
  assert.equal(getMilestone(100).at,500);
  assert.equal(getMilestone(300).progress,.5);
});
test("damaged saves never inject invalid balance or unknown flavor",()=>{
  const s=sanitizeState({version:1,balance:Infinity,totalMade:-9,owned:{helfer:-5,streusel:2.9},flavor:"javascript:evil",lastSaved:0},100);
  assert.equal(s.balance,0);assert.equal(s.totalMade,0);assert.equal(s.flavor,"vanille");
  assert.equal(s.owned.helfer,0);assert.equal(s.owned.streusel,2);
});
test("unknown upgrades are ignored",()=>{
  assert.equal(buyUpgrade({...newGame(),balance:100},"unknown").ok,false);
});
test("large scores remain readable in German formatting",()=>{
  assert.match(formatNumber(1200000),/Mio/);
});
