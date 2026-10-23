import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROPOSED_GESTURE_VERSION, PROPOSED_GESTURE_BYTES, GESTURE_ACTION, GESTURE_ACK_STATUS,
  encodeProposedGestureEvent, decodeProposedGestureEvent, decodeProposedGestureAck,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";

const event = Object.freeze({
  action: GESTURE_ACTION.PRESS, sequence: 0x01020304,
  gestureId: 0x11223344, clientTick: 0x55667788,
});
const golden = [2, 0x11, 1, 0, 4, 3, 2, 1, 0x44, 0x33, 0x22, 0x11, 0x88, 0x77, 0x66, 0x55];

test("proposed v2 gesture envelope has exact Rust-matching 16-byte golden encoding", () => {
  assert.equal(PROPOSED_GESTURE_VERSION, 2);
  assert.equal(PROPOSED_GESTURE_BYTES, 16);
  const encoded = encodeProposedGestureEvent(event);
  assert.deepEqual(Array.from(new Uint8Array(encoded)), golden);
  assert.deepEqual(decodeProposedGestureEvent(encoded), event);
  assert.deepEqual(decodeProposedGestureEvent(new Uint8Array(encoded)), event);
  assert.deepEqual(decodeProposedGestureEvent(new Uint8Array([99, ...golden, 99]).subarray(1, 17)), event);
});
test("PRESS UPGRADE RELEASE CANCEL each retain one lease-scoped gesture ID and sequence", () => {
  for (const action of Object.values(GESTURE_ACTION)) {
    const candidate = { ...event, action };
    assert.deepEqual(decodeProposedGestureEvent(encodeProposedGestureEvent(candidate)), candidate);
  }
  assert.notDeepEqual(
    [...new Uint8Array(encodeProposedGestureEvent({ ...event, action: GESTURE_ACTION.RELEASE }))],
    [...new Uint8Array(encodeProposedGestureEvent({ ...event, action: GESTURE_ACTION.CANCEL }))],
  );
});
test("ack round-trips server-origin tick without trusting client clock or actor IDs", () => {
  const ack = Uint8Array.from([2, 0x12, GESTURE_ACK_STATUS.ACCEPTED, 0,
    4, 3, 2, 1, 0x44, 0x33, 0x22, 0x11, 0x0d, 0x0c, 0x0b, 0x0a]);
  assert.deepEqual(decodeProposedGestureAck(ack), {
    status: GESTURE_ACK_STATUS.ACCEPTED, sequence: event.sequence,
    gestureId: event.gestureId, serverTick: 0x0a0b0c0d,
  });
});
test("fail closed on incompatible v1, wrong type, corrupted identity, unknown action, trailing bytes", () => {
  const base = new Uint8Array(encodeProposedGestureEvent(event));
  const mutated = (offset, value) => { const b = Uint8Array.from(base); b[offset] = value; return b; };
  assert.throws(() => decodeProposedGestureEvent(base.subarray(0, 15)), /length/);
  assert.throws(() => decodeProposedGestureEvent(Uint8Array.from([...base, 0])), /length/);
  assert.throws(() => decodeProposedGestureEvent(mutated(0, 1)), /not negotiated/);
  assert.throws(() => decodeProposedGestureEvent(mutated(1, 0x12)), /type/);
  assert.throws(() => decodeProposedGestureEvent(mutated(2, 99)), /action/);
  assert.throws(() => decodeProposedGestureEvent(mutated(3, 1)), /reserved/);
  const missingSeq = Uint8Array.from(base); missingSeq.fill(0, 4, 8);
  assert.throws(() => decodeProposedGestureEvent(missingSeq), /sequence/);
  const missingId = Uint8Array.from(base); missingId.fill(0, 8, 12);
  assert.throws(() => decodeProposedGestureEvent(missingId), /gestureId/);
  for (const bad of [0, -1, 4294967296, 1.5, NaN]) {
    assert.throws(() => encodeProposedGestureEvent({ ...event, sequence: bad }), /sequence/);
    assert.throws(() => encodeProposedGestureEvent({ ...event, gestureId: bad }), /gestureId/);
  }
  assert.throws(() => decodeProposedGestureAck(mutated(1, 0x11)), /type/);
  const invalidAck = mutated(1, 0x12); invalidAck[2] = 99;
  assert.throws(() => decodeProposedGestureAck(invalidAck), /acknowledgement/);
});
test("original v1 INPUT stays byte-for-byte identical, with provably ambiguous orphan heavy", () => {
  const packet = sample => new Uint8Array(encodeInputPacket({
    sequence: 4, clientTick: 50, samples: [sample],
  }));
  const identical = { tick: 50, attack: false, heavyAttack: true };
  const keyE = packet(identical);
  const orphanedLmbRelease = packet(identical);
  assert.deepEqual(keyE, orphanedLmbRelease,
    "v1 has NO origin/gesture identity; do not infer heavy release from KeyE bits");
  assert.equal(inputPacketBytes(3), 34);
  assert.equal(keyE.length, 22);
  assert.equal(decodeInputPacket(keyE).samples[0].heavyAttack, true);
  const originalCodec = readFileSync(new URL("../src/network/input-codec.mjs", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/src/lib.rs", import.meta.url), "utf8");
  assert.match(originalCodec, /const SAMPLE_BYTES = 6/);
  assert.match(server, /PROTOCOL_VERSION: u8 = 1/);
  assert.match(server, /INPUT_SAMPLE_BYTES: usize = 6/);
  const client = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(client, /prealpha-lmb-gesture-proposal/);
  const main = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  // The explicitly operator-enabled Rust lab is real but must never expose
  // v2 gestures by default or on a nonloopback bind.
  assert.match(main, /prealpha_lmb_gesture_proposal::encode_ack/);
  assert.match(main, /let v2_lab = match env::var\("MYASO_EXPERIMENTAL_GESTURE_V2"\)\.as_deref\(\)/);
  assert.match(main, /Ok\("0"\) \| Err\(_\) => false/);
  assert.match(main, /if v2_lab && !bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(main, /bail!\("experimental v2 gesture ingress is loopback-only"\)/);
});
