import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeM220KnockdownFocusTimeline } from "../scripts/m220-knockdown-focus-timeline.mjs";
const inputs = () => ({
  firstId:2,secondId:3,knockdownAction:19,idleAction:0,strictHandoffPassed:false,
  firstVictim:{acceptance:{ownActionTransitions:[{action:0,serverTick:1},{action:19,serverTick:357},{action:0,serverTick:372}]}},
  secondVictim:{acceptance:{ownActionTransitions:[{action:0,serverTick:1},{action:19,serverTick:360},{action:0,serverTick:375}]}},
  roller:{focusTransitions:[{label:"NEAREST #2"},{label:"KNOCKDOWN #2"},{label:"NEAREST #2"}]},
});
test("M220 reproduces failed 3-tick gap with real missing #3 focus",()=>{
  const x=summarizeM220KnockdownFocusTimeline(inputs());
  assert.equal(x.recoveryGapServerTicks,3);
  assert.equal(x.firstKnockdownTick,357);
  assert.equal(x.secondKnockdownTick,360);
  assert.equal(x.focusFirstObserved,true);
  assert.equal(x.orderedSecondFocusObserved,false);
  assert.equal(x.strictHandoffPassed,false);
});
test("M220 reports actually observed successful ordered target handoff",()=>{
  const v=inputs();v.roller.focusTransitions.splice(2,0,{label:"KNOCKDOWN #3"});v.strictHandoffPassed=true;
  const x=summarizeM220KnockdownFocusTimeline(v);
  assert.equal(x.orderedSecondFocusObserved,true);
  assert.equal(x.strictHandoffPassed,true);
});
test("M220 missing replicated authority remains unknown not fabricated tick zero",()=>{
  const v=inputs();v.secondVictim.acceptance.ownActionTransitions=[];
  const x=summarizeM220KnockdownFocusTimeline(v);
  assert.equal(x.secondRecoveryTick,null);
  assert.equal(x.recoveryGapServerTicks,null);
  assert.equal(x.orderedSecondFocusObserved,false);
});
test("M220 records real fail before unchanged strict M158 failure assertion",()=>{
  const s=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=s.indexOf("async function runOnlineUiMultiKnockdownFfaFlight(");
  const end=s.indexOf("async function runOnlineUiKickKnockdown",start);
  const part=s.slice(start,end);
  assert.ok(start>0 && end>start);
  const log=part.indexOf('console.log("M220_KNOCKDOWN_FOCUS_TIMELINE "');
  const strict=part.indexOf('did not hand KNOCKDOWN focus from #');
  assert.ok(log>0 && strict>log);
  assert.ok(part.includes("strictHandoffPassed: false"));
  assert.ok(part.includes("firstVictim: diagnostics.find((entry) => entry.browser === firstVictim.name)"));
  assert.ok(part.includes("secondVictim: diagnostics.find((entry) => entry.browser === secondVictim.name)"));
  assert.ok(part.includes("await Promise.all(entries.map(readUiEvidence))"));
});
