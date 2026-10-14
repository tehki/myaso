import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeM218JumpAttackLatency } from "../scripts/m218-successful-jump-attack-latency.mjs";

const sample = () => ({
  sameBrowserClock: true,
  jumpDown: {epochMs:1000,t:450},
  attackDown: {epochMs:1020,t:470},
  observedWindup: {epochMs:1060,serverTick:234},
  eventTransitions: [
    {text:"Jump attack committed - the narrow lane is readable.",t:505},
    {text:"Opponent hit - 42 HP.",t:644},
  ],
});
test("M218 genuine chord to locally observed authority, commit and exact 42HP cue", () => {
  const x=summarizeM218JumpAttackLatency(sample());
  assert.equal(x.chordToObservedWindupMs,40);
  assert.equal(x.chordToCommitCueMs,35);
  assert.equal(x.chordToHitCueMs,174);
  assert.equal(x.observedWindupServerTick,234);
  assert.deepEqual(x.missingReasons,[]);
});
test("M218 rejects staggered or untrusted cross-browser control provenance", () => {
  const a=sample();a.sameBrowserClock=false;
  assert.deepEqual(summarizeM218JumpAttackLatency(a).missingReasons,["unknown-or-cross-browser-clock"]);
  const b=sample();b.attackDown.epochMs=1100;
  assert.equal(summarizeM218JumpAttackLatency(b).chordToHitCueMs,null);
  assert.ok(summarizeM218JumpAttackLatency(b).missingReasons.includes("one-genuine-chord-missing"));
});
test("M218 stale cue or windup is missing, never converted to zero latency", () => {
  const x=sample();x.observedWindup.epochMs=999;
  x.eventTransitions[0].t=430;
  x.eventTransitions[1].t=440;
  const result=summarizeM218JumpAttackLatency(x);
  assert.equal(result.chordToObservedWindupMs,null);
  assert.equal(result.chordToCommitCueMs,null);
  assert.equal(result.chordToHitCueMs,null);
  assert.equal(result.missingReasons.length,3);
});
test("M218 observation executes only after strict M136 42HP genuine direct-air attack proof", () => {
  const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=src.slice(src.indexOf("async function runOnlineUiJumpAttackFlight("),
    src.indexOf("async function runM172AirborneDenialPhase("));
  const log=section.indexOf('console.log("M218_SUCCESSFUL_JUMP_ATTACK_LATENCY "');
  assert.ok(log>section.indexOf("jump attack did not resolve as one clean 42 HP hit"));
  assert.ok(log>section.indexOf("jump-attack flight accidentally resolved as parry"));
  assert.ok(section.includes("sameBrowserClock: true"));
  assert.ok(section.includes("summarizeM218JumpAttackLatency({"));
  assert.ok(section.includes("jumpDowns.length !== 1 || jumpUps.length !== 1"));
  assert.ok(section.includes("attackDowns.length !== 1 || attackUps.length !== 1"));
  assert.ok(section.includes("authoritativeWindup.epochMs - chordEpochMs > 220"));
});
