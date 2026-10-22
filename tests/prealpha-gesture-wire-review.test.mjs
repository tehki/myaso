import {decodeInputPacket as decodeLegacyInput} from "../src/network/input-codec.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {encodeReview,decodeReview,PreviewGate,KIND} from "./fixtures/core8c-lmb-gesture-wire-review.mjs";
const epoch=0x0102030405060708n;
const e=(seq,gesture,kind,tick=100)=>({seq,gesture,kind,tick});
const wire=(events,sequence=9,x=epoch)=>encodeReview({epoch:x,sequence,events});
const pair=wire([e(1,7,KIND.PRESS),e(2,7,KIND.RELEASE)]);
test("shared Rust/JS golden vector: same 30Hz tick keeps two ordered gesture events",()=>{
  assert.equal(Buffer.from(pair).toString("hex"),
    "025202000807060504030201090000000100000007000000640000000101000002000000070000006400000003010000");
  assert.deepEqual(decodeReview(pair).events.map(x=>x.kind),[1,3]);
  const gate=new PreviewGate(epoch);
  assert.deepEqual(gate.accept(pair),["press","release"]);
  assert.deepEqual(gate.accept(pair),[],"repeat packet must not double-hit");
});
test("lost press may arrive on redundancy retry; orphan release cannot be executed",()=>{
  const gate=new PreviewGate(epoch);
  assert.throws(()=>gate.accept(wire([e(2,7,KIND.RELEASE)],10)),/missing event/);
  assert.deepEqual(gate.accept(wire([e(1,7,KIND.PRESS),e(2,7,KIND.RELEASE)],11)),["press","release"]);
  assert.deepEqual(gate.accept(pair),[]);
});
test("wrong gesture ID cannot release a new gesture; old gesture cannot restart",()=>{
  const gate=new PreviewGate(epoch);
  assert.deepEqual(gate.accept(wire([e(1,7,KIND.PRESS)])),["press"]);
  assert.deepEqual(gate.accept(wire([e(2,8,KIND.RELEASE)])),[]);
  assert.deepEqual(gate.accept(wire([e(3,7,KIND.CANCEL)])),["cancel"]);
  assert.deepEqual(gate.accept(wire([e(4,7,KIND.PRESS)])),[]);
  assert.deepEqual(gate.accept(wire([e(5,8,KIND.PRESS)])),["press"]);
  assert.deepEqual(gate.accept(wire([e(6,7,KIND.RELEASE)])),[]);
});
test("old actor epoch cannot be replayed after reconnect even with later packet sequence",()=>{
  const gate=new PreviewGate(epoch);
  assert.throws(()=>gate.accept(wire([e(1,9,KIND.PRESS)],999,epoch+1n)),/epoch mismatch/);
  assert.deepEqual(gate.accept(wire([e(1,9,KIND.PRESS)])),["press"]);
});
test("standalone KeyE source does not alias charged left mouse RELEASE",()=>{
  const events=[e(1,10,KIND.KEYE_PRESS),e(2,10,KIND.KEYE_RELEASE)];
  assert.deepEqual(decodeReview(wire(events)).events.map(x=>x.kind),[5,6]);
  assert.deepEqual(new PreviewGate(epoch).accept(wire(events)),["keye-press","keye-release"]);
});
test("repeated upgrade and unmatched KeyE release do not create multiple actions",()=>{
  const gate=new PreviewGate(epoch);
  assert.deepEqual(gate.accept(wire([
    e(1,30,KIND.PRESS),e(2,30,KIND.UPGRADE),
    e(3,30,KIND.UPGRADE),e(4,30,KIND.RELEASE)])),
    ["press","upgrade-intent","release"]);
  assert.deepEqual(gate.accept(wire([e(5,30,KIND.KEYE_RELEASE)])),[]);
  assert.deepEqual(gate.accept(wire([e(6,31,KIND.KEYE_PRESS)])),["keye-press"]);
  assert.deepEqual(gate.accept(wire([e(7,32,KIND.KEYE_PRESS)])),[]);
  assert.deepEqual(gate.accept(wire([e(8,32,KIND.KEYE_RELEASE)])),[]);
  assert.deepEqual(gate.accept(wire([e(9,31,KIND.KEYE_RELEASE)])),["keye-release"]);
});
test("unchanged live v1 browser decoder rejects review-only v2 gesture packets",()=>{
  assert.throws(()=>decodeLegacyInput(pair),/unsupported protocol version/);
});
test("version, length, source, reserved fields and zero IDs fail closed",()=>{
  assert.throws(()=>wire([]),/count/);
  assert.throws(()=>wire([e(0,1,KIND.PRESS)]),/seq/);
  assert.throws(()=>wire([e(1,0,KIND.PRESS)]),/gesture/);
  assert.throws(()=>wire([e(1,1,255)]),/kind/);
  assert.throws(()=>decodeReview(new Uint8Array([2,0x52])),/truncated/);
  for(const [offset,value] of [[0,1],[1,1],[2,3],[3,1],[29,2],[30,1]]){
    const bad=new Uint8Array(pair.slice(0));bad[offset]=value;
    assert.throws(()=>decodeReview(bad),/version|count|kind|reserved|source/);
  }
  assert.throws(()=>decodeReview(new Uint8Array(pair).subarray(0,47)),/length/);
});
