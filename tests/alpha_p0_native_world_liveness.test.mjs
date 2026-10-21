import test from "node:test";
import assert from "node:assert/strict";
import {parseNativeWorldLiveness,nativeWorldLivenessAdvanced} from "../scripts/alpha_p0_native_world_liveness.mjs";
const ui=(acks,rx)=>"Input→ACK p50 12ms · p95 35ms | Snapshots p50 50ms · p95 58ms | Samples 96 | ACKs "+acks+" | Rx snapshots "+rx;
test("parse real opt-in HUD monotonic received counters, not bounded sample buffer",()=>{
 const r=parseNativeWorldLiveness(ui(170,185));
 assert.deepEqual(r,{valid:true,ackCount:170,snapshotCount:185});
 assert(Object.isFrozen(r));
});
test("reject legacy bounded Samples 96 with no monotonic counters",()=>{
 assert.equal(parseNativeWorldLiveness("Samples 96 | Snapshots p50 53ms").valid,false);
});
test("reject untrusted, malformed, missing or overflowing counters",()=>{
 for(const x of ["","ACKs 0 | Rx snapshots 4","ACKs 4 | Rx snapshots 0",
  "ACKs -1 | Rx snapshots 3","ACKs x | Rx snapshots 4",
  "ACKs 9007199254740992 | Rx snapshots 42",null,{}])
  assert.equal(parseNativeWorldLiveness(x).valid,false,String(x));
});
test("stale combat HUD tick is NOT a false network stall when both true counters advance",()=>{
 const before=parseNativeWorldLiveness(ui(110,215));
 const after=parseNativeWorldLiveness(ui(116,222));
 assert.equal(nativeWorldLivenessAdvanced(before,after),true);
});
test("a real snapshot stall fails even if input ACKs continue arriving",()=>{
 const before=parseNativeWorldLiveness(ui(110,215));
 const after=parseNativeWorldLiveness(ui(125,215));
 assert.equal(nativeWorldLivenessAdvanced(before,after),false);
});
test("a real input ACK stall fails even if snapshots continue arriving",()=>{
 const before=parseNativeWorldLiveness(ui(110,215));
 const after=parseNativeWorldLiveness(ui(110,245));
 assert.equal(nativeWorldLivenessAdvanced(before,after),false);
});
test("one received ACK and snapshot is not enough; require >=2 of BOTH",()=>{
 const before=parseNativeWorldLiveness(ui(110,215));
 assert.equal(nativeWorldLivenessAdvanced(before,parseNativeWorldLiveness(ui(111,216))),false);
 assert.equal(nativeWorldLivenessAdvanced(before,parseNativeWorldLiveness(ui(112,217))),true);
});
test("cached or decreased counters cannot satisfy native liveness",()=>{
 const before=parseNativeWorldLiveness(ui(110,215));
 assert.equal(nativeWorldLivenessAdvanced(before,before),false);
 assert.equal(nativeWorldLivenessAdvanced(before,parseNativeWorldLiveness(ui(109,200))),false);
 assert.equal(nativeWorldLivenessAdvanced(before,parseNativeWorldLiveness(ui(999999,219)),1),false);
});
