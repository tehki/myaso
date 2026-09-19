import test from "node:test";
import assert from "node:assert/strict";
import { createPredictionHistory, reconcilePrediction } from "../src/browser/reconciliation.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";
import { decodeInputAck, encodeInputAck, INPUT_ACK_BYTES } from "../src/network/input-ack-codec.mjs";
import { decodeKillEvent, encodeKillEvent, KILL_EVENT_BYTES } from "../src/network/kill-event-codec.mjs";
import { PACKET_TYPE } from "../src/network/constants.mjs";
import { parseSha256Hex } from "../web/authoritative-client.mjs";

test("M6 input ACK is a separate 16-byte packet carrying reconciliation and identity anchors", () => {
  const packet = encodeInputAck({ processedClientTick: 0xfffffff0, serverTick: 123456, playerNetId: 77 });
  const bytes = new Uint8Array(packet);
  assert.equal(bytes.length, INPUT_ACK_BYTES);
  assert.equal(bytes[1], PACKET_TYPE.INPUT_ACK);
  assert.deepEqual(decodeInputAck(packet), {
    processedClientTick: 0xfffffff0,
    serverTick: 123456,
    playerNetId: 77,
  });
});

test("M52 kill event is a separate reliable 16-byte attribution packet", () => {
  const packet = encodeKillEvent({ sequence: 0x01020304, killer: 17, victim: 23 });
  const bytes = new Uint8Array(packet);
  assert.equal(bytes.length, KILL_EVENT_BYTES);
  assert.equal(bytes[1], PACKET_TYPE.KILL_EVENT);
  assert.deepEqual([...bytes], [1, 4, 0, 0, 4, 3, 2, 1, 17, 0, 0, 0, 23, 0, 0, 0]);
  assert.deepEqual(decodeKillEvent(packet), {
    sequence: 0x01020304,
    killer: 17,
    victim: 23,
  });
  assert.throws(() => encodeKillEvent({ sequence: 1, killer: 9, victim: 9 }), /must differ/);
  const malformed = new Uint8Array(packet.slice(0));
  new DataView(malformed.buffer).setUint32(12, 17, true);
  assert.throws(() => decodeKillEvent(malformed), /must differ/);
});

test("prediction history discards acknowledged ticks across uint32 wrap", () => {
  const history = createPredictionHistory({ maxEntries: 8 });
  history.push(0xfffffffe, { moveX: 1 });
  history.push(0xffffffff, { moveX: 1 });
  history.push(0, { moveX: 1 });
  history.push(1, { moveX: 1 });
  assert.equal(history.discardThrough(0), 3);
  assert.deepEqual(history.snapshot().map((entry) => entry.tick), [1]);
});

test("reconciliation restores authority then replays only still-unacknowledged inputs", () => {
  const history = createPredictionHistory({ maxEntries: 8 });
  history.push(10, { moveX: 1 });
  history.push(11, { moveX: 1 });
  history.push(12, { moveX: -1 });
  const state = { x: 999 };
  const result = reconcilePrediction({
    history,
    processedClientTick: 11,
    authoritativeState: { x: 50 },
    restoreAuthoritative(authoritative) { state.x = authoritative.x; },
    replayInput(entry) { state.x += entry.moveX * 2; },
  });
  assert.deepEqual(result, { discarded: 2, replayed: 1 });
  assert.equal(state.x, 48);
  assert.deepEqual(history.snapshot().map((entry) => entry.tick), [12]);
});

test("remote interpolation stays bounded and carries newest non-position state", () => {
  const interpolation = createRemoteInterpolator();
  interpolation.push({ netId: 5, x: 0, y: 10, facing: 0, hp: 100, guard: 100, action: 0, flags: 0 }, 100);
  interpolation.push({ netId: 5, x: 60, y: 10, facing: Math.PI, hp: 66, guard: 80, action: 3, flags: 1 }, 106);
  const halfway = interpolation.sample(5, 103, {});
  assert.ok(Math.abs(halfway.x - 30) < 1e-9);
  assert.equal(halfway.hp, 66);
  assert.equal(halfway.action, 3);
  const extrapolated = interpolation.sample(5, 200, {});
  assert.ok(extrapolated.x <= 120 + 1e-9, "extrapolation must be capped by the configured horizon");
});

test("browser certificate pin parser accepts exactly one SHA-256 digest", () => {
  const digest = parseSha256Hex("ab".repeat(32));
  assert.equal(digest.length, 32);
  assert.equal(digest[0], 0xab);
  assert.throws(() => parseSha256Hex("ab"), /64 hexadecimal/);
});
