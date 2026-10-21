import test from "node:test";
import assert from "node:assert/strict";
import { encodeInputPacket } from "../src/network/input-codec.mjs";
import { inputQueueReplacementEvidence } from "../src/browser/input-queue-evidence.mjs";

function packet(tick, samples) {
  return encodeInputPacket({ sequence: tick & 0xffff, clientTick: tick,
    ackSnapshotSequence: 0xffff, ackServerTick: 0, samples });
}

test("actual encoded pending replacement reveals a chord aging out of three-copy history", () => {
  const before = packet(112, [{ tick: 112 }, { tick: 111 }, { tick: 110, attack: true, jump: true }]);
  const after = packet(113, [{ tick: 113 }, { tick: 112 }, { tick: 111 }]);
  const untouched = new Uint8Array(before).slice();
  assert.deepEqual(inputQueueReplacementEvidence(before, after), {
    source: "actual-pending-client-packet-replacement",
    previousClientTick: 112, replacementClientTick: 113, lostActionTicks: [110],
  });
  assert.deepEqual(new Uint8Array(before), untouched);
});

test("retained one-shot, neutral movement and held charge are never called missing actions", () => {
  const before = packet(110, [{ tick: 110, attack: true, jump: true }]);
  const retained = packet(111, [{ tick: 111 }, { tick: 110, attack: true, jump: true }]);
  assert.equal(inputQueueReplacementEvidence(before, retained), null);
  for (const sample of [{ tick: 110, moveX: 1 }, { tick: 110, attack: true, heavyAttack: true }]) {
    assert.equal(inputQueueReplacementEvidence(packet(110, [sample]), packet(113, [{ tick: 113 }])), null);
  }
  assert.equal(inputQueueReplacementEvidence(null, retained), null);
});
