import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeM217SuccessfulKickLatency } from "../scripts/m217-successful-kick-latency.mjs";

const sample = () => ({
  sameBrowserClock: true,
  pointers: [
    {type:"pointerdown",button:2,epochMs:1500,t:800},
    {type:"pointerup",button:2,epochMs:1545,t:845},
  ],
  successfulPointerOffset: 0,
  actionTransitions: [{action:8,epochMs:1551,serverTick:308}],
  focusTransitions: [{label:"KNOCKDOWN #2",t:952}],
  kickWindupAction: 8,victimId:2,
});
test("M217 correlates one genuine short RMB with observed kick and focus cue", () => {
  const a = summarizeM217SuccessfulKickLatency(sample());
  assert.equal(a.rightDownToObservedWindupMs, 51);
  assert.equal(a.rightDownToKnockdownFocusMs, 152);
  assert.equal(a.observedWindupServerTick, 308);
  assert.deepEqual(a.missingReasons, []);
});
test("M217 rejects prior attempt and stale focus or windup, never manufactures zero", () => {
  const a=sample();
  a.successfulPointerOffset=2;
  assert.equal(summarizeM217SuccessfulKickLatency(a).rightDownToObservedWindupMs,null);
  const b=sample();
  b.actionTransitions[0].epochMs=1400;
  b.focusTransitions[0].t=700;
  const result=summarizeM217SuccessfulKickLatency(b);
  assert.equal(result.rightDownToObservedWindupMs,null);
  assert.equal(result.rightDownToKnockdownFocusMs,null);
  assert.equal(result.missingReasons.length,2);
});
test("M217 rejects cross-browser source, repeat RMB, and long run gestures", () => {
  const a = sample();a.sameBrowserClock=false;
  assert.deepEqual(summarizeM217SuccessfulKickLatency(a).missingReasons,["clock-provenance-unknown"]);
  const b = sample();b.pointers.push({...b.pointers[0]});
  assert.equal(summarizeM217SuccessfulKickLatency(b).rightDownToKnockdownFocusMs,null);
  const c=sample();c.pointers[1].epochMs=1750;
  assert.equal(summarizeM217SuccessfulKickLatency(c).rightDownToObservedWindupMs,null);
});
test("M217 is logged only after strict M153 true 3-browser kick, HP and focus-clear checks", () => {
  const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=src.slice(src.indexOf("async function runOnlineUiKickKnockdownFfaFocusFlight("),
    src.indexOf("async function runOnlineUiKickBufferFlight("));
  const pos=section.indexOf('console.log("M217_SUCCESSFUL_KICK_FEEDBACK_LATENCY "');
  assert.ok(pos > section.indexOf("knockdown focus did not clear after control returned"));
  assert.ok(section.includes("successfulPointerOffset = pointerOffset"));
  assert.ok(section.includes("one genuine short RMB kick"));
  assert.ok(section.includes("kick exchange changed health/guard instead of pure knockdown"));
  assert.ok(section.includes("sameBrowserClock: true"));
  assert.ok(section.includes("kickWindupAction: COMBAT_ACTION.kickWindup"));
});
