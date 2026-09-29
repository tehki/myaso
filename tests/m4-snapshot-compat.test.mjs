import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applySnapshotRecords, decodeSnapshot, dequantizeEntity } from "../src/network/snapshot-codec.mjs";

const fixtureHex = readFileSync(new URL("./fixtures/m4-snapshot-v1.hex", import.meta.url), "utf8").trim();
const fixture = Uint8Array.from(Buffer.from(fixtureHex, "hex"));

test("browser snapshot decoder accepts the Rust M4 wire fixture", () => {
  const snapshot = decodeSnapshot(fixture);
  assert.equal(snapshot.sequence, 7);
  assert.equal(snapshot.baselineSequence, 6);
  assert.equal(snapshot.serverTick, 1234);
  assert.equal(snapshot.full, false);
  assert.equal(snapshot.records.length, 1);

  const state = applySnapshotRecords(new Map(), snapshot.records);
  const fighter = dequantizeEntity(state.get(1));
  assert.equal(fighter.netId, 1);
  assert.equal(fighter.x, 100);
  assert.equal(fighter.y, 200);
  assert.ok(Math.abs(fighter.facing - Math.PI / 2) < 0.001);
  assert.equal(fighter.hp, 66);
  assert.equal(fighter.guard, 75);
  assert.equal(fighter.action, "attack_windup");
  assert.equal(fighter.flags, 2);
});
