import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeM216ParryPunishLatency } from "../scripts/m216-successful-parry-punish-latency.mjs";

const sample = () => ({
  sameBrowserClock: true, stunnedAction: 7,
  wheels: [{ deltaY: 120, t: 769.6, epochMs: 4897 }],
  focusActionTransitions: [{action:7, epochMs:4963, serverTick:261}],
  pointers: [{ type:"pointerdown",button:0,t:1240.1,epochMs:5368 }],
  eventTransitions: [
    { text:"Parry! Opponent stunned - punish now.",t:836.4 },
    { text:"Opponent hit - 34 HP.",t:1436.5 },
  ],
});

test("M216 derives genuine wheel-to-parry/stun and late LMB-to-confirmed-HP cue", () => {
  const m = summarizeM216ParryPunishLatency(sample());
  assert.equal(m.wheelToParryCueMs, 66.8);
  assert.equal(m.wheelToObservedStunMs, 66);
  assert.equal(m.punishPointerDownToHitCueMs, 196.4);
  assert.equal(m.parryServerTick, 261);
  assert.deepEqual(m.missingReasons, []);
});

test("M216 never subtracts untrusted cross-browser or inverted timestamps", () => {
  const a = summarizeM216ParryPunishLatency({...sample(),sameBrowserClock:false});
  assert.equal(a.wheelToParryCueMs, null);
  assert.deepEqual(a.missingReasons, ["cross-browser-or-unknown-clock"]);
  const b = sample();
  b.wheels[0].t = 900;
  assert.equal(summarizeM216ParryPunishLatency(b).wheelToParryCueMs, null);
  const c = sample();
  c.focusActionTransitions[0].epochMs = 4800;
  assert.equal(summarizeM216ParryPunishLatency(c).wheelToObservedStunMs, null);
});

test("M216 stale cues and remote cues stay explicitly missing", () => {
  const s = sample();
  s.eventTransitions[0].t = 700;
  s.eventTransitions[1].t = 1190;
  const result = summarizeM216ParryPunishLatency(s);
  assert.equal(result.wheelToParryCueMs, null);
  assert.equal(result.punishPointerDownToHitCueMs, null);
  assert.ok(result.missingReasons.includes("genuine-parry-wheel-or-cue-not-paired"));
  assert.ok(result.missingReasons.includes("genuine-punish-down-hit-cue-not-paired"));
});

test("M216 hooks after unchanged strict M146 no-phantom-hit, 34HP and late stun proof", () => {
  const s = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const part = s.slice(s.indexOf("async function runOnlineUiParryPunishWindowFlight("),
    s.indexOf("async function runOnlineUiParryTellFlight("));
  const log = part.indexOf('console.log("M216_PARRY_PUNISH_FEEDBACK_LATENCY "');
  assert.ok(log > part.indexOf("lost the authoritative parry proof before the punish"));
  assert.ok(log > part.indexOf("did not resolve exactly one additional 34-damage punish"));
  assert.ok(log > part.indexOf("punish was not one genuine late-window LMB"));
  assert.ok(part.includes("sameBrowserClock: true"));
  assert.ok(part.includes("focusActionTransitions: defenderState.acceptance?.focusActionTransitions"));
  assert.ok(part.includes("stunnedAction: COMBAT_ACTION.stunned"));
});
