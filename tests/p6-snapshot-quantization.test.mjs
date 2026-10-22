import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshotDelta, encodeSnapshot, decodeSnapshot, applySnapshotRecords,
  dequantizeEntity } from "../src/network/snapshot-codec.mjs";

test("P6 authoritative fighter clearance cannot be inferred from a compressed snapshot distance", () => {
  // Two nonoverlapping radius18 server fighters. Production v7 codec
  // intentionally rounds x/y to compact cells, making the replica appear
  // closer than actual World authority. Never judge a 36u collider from it.
  const world=[{netId:1,x:100,y:100},{netId:2,x:132.4,y:116}];
  const trueDistance=Math.hypot(world[0].x-world[1].x,world[0].y-world[1].y);
  assert(trueDistance>36);
  const encoded=encodeSnapshot({sequence:1,serverTick:60,full:true,
    records:buildSnapshotDelta(world)});
  const decoded=decodeSnapshot(encoded);
  assert.equal(decoded.encoding,7);
  const replica=[...applySnapshotRecords(new Map(),decoded.records).values()]
    .map(dequantizeEntity);
  assert.deepEqual(replica.map(r=>[r.x,r.y]),[[100,100],[132,116]]);
  const replicaDistance=Math.hypot(replica[0].x-replica[1].x,
    replica[0].y-replica[1].y);
  assert(Math.abs(replicaDistance-35.77708763999664)<1e-9);
  assert(replicaDistance<36,
    "legitimate separated fighters can appear overlapping over QUIC snapshots");
});
