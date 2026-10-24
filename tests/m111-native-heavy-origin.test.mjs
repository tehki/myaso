import test from "node:test";
import assert from "node:assert/strict";
import { legacyM111HeavyOrigin } from "../scripts/m111-native-heavy-origin.mjs";
const pair = (down, up) => [{code:"KeyE",type:"keydown",epochMs:down},{code:"KeyE",type:"keyup",epochMs:up}];
test("M111 legacy120ms KeyE hold must not shift the unchanged840+60 recovery floor",()=>{
 const origin=legacyM111HeavyOrigin([...pair(100,220),...pair(1000,1120)],900);
 assert.deepEqual(origin,{downEpochMs:1000,upEpochMs:1120});
 assert.equal(origin.downEpochMs+320+100+420+60,1900);
 assert.equal(origin.upEpochMs+320+100+420+60,2020); // Captured wrong origin adds120ms.
});
test("M111 rejects stale, missing, reversed and ambiguous native heavy pairs",()=>{
 for(const events of [pair(100,220),pair(1000,1120).slice(0,1),pair(1120,1000),[...pair(1000,1120),...pair(1200,1320)]])
  assert.throws(()=>legacyM111HeavyOrigin(events,900));
 assert.throws(()=>legacyM111HeavyOrigin(null,900));
});
