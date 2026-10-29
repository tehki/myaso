import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createM35CueRegistry,m35PrearmedCueScript} from "../scripts/m35-prearmed-windup-cue.mjs";

test("M41 prearmed Heavy cue can be accepted only under explicit allowHeavy and matching original actor", async() => {
  const registry=createM35CueRegistry();
  const earlier=registry.issue(3,2,{allowHeavy:true});
  const heavy={actorId:2,eventIndex:3,eventCount:4,t:100,
    text:"Heavy strike committed - the long windup is readable.",
    latestText:"Heavy strike committed - the long windup is readable."};
  assert.equal(registry.receive({token:earlier.token,cue:{...heavy,actorId:1}}),false);
  assert.equal(registry.receive({token:earlier.token,cue:{...heavy,eventIndex:2}}),false);
  assert.equal(registry.receive({token:earlier.token,cue:heavy}),true);
  assert.equal((await earlier.wait()).text,heavy.text);
  assert.equal(registry.receive({token:earlier.token,cue:heavy}),false,"single receipt only");
  earlier.close();
  const short=registry.issue(3,2);
  assert.equal(registry.receive({token:short.token,cue:heavy}),false,"M33/M35 cannot use Heavy");
  assert.equal(registry.receive({token:short.token,cue:{...heavy,
    text:"Attack committed - your windup is readable.",
    latestText:"Attack committed - your windup is readable."}}),true);
  short.close();
});

test("M41 actor-bound browser prearm dispatches one original viewport wheel; original PARRY remains mandatory", () => {
  const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const script=m35PrearmedCueScript();
  assert.match(runner,/const prearmed = \(scenario === "uiparrytell" \|\| scenario === "uistun" \|\| scenario === "uiparry"\)/);
  assert.match(runner,/allowHeavy: nativeReaction\.allowHeavy/);
  assert.match(runner,/attackerReady\.playerNetId, 180,\s*nativeReaction\.allowHeavy\]/);
  assert.match(runner,/planM35NativeReaction\(parryIngress\.wheelMs,nativeShortHoldMs\)/);
  assert.match(runner,/verifyM35OriginalLightParry\(worldOptions\)/,
    "earlier cue cannot replace original World Light then PARRY acceptance");
  assert.match(script,/const \[token, baseline, actorId, timeoutMs, allowHeavy\] = arguments/);
  assert.match(script,/observe\(window\.__MYASO_M30_UI__, attemptBaseline, actorId, allowHeavy\)/);
  assert.match(runner,/scrollM41ViewportWheel\(defender, defenderViewport\)/);
  assert.match(runner,/M33 genuine short-click parry resolved unexpectedly:/);
  assert.match(runner,/M41 remote parry-stun tell never appeared:/);
});
