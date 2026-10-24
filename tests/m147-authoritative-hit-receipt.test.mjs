import test from "node:test";
import assert from "node:assert/strict";
import {
  HIT_RECEIPT_BYTES, HIT_RECEIPT_TYPE_PROPOSAL, encodeHitReceipt,
  decodeHitReceipt, validateHitReceipt,
} from "../src/network/m147-hit-receipt-codec.mjs";
import {
  createHitReceiptPresenter, presentHitReceipt,
} from "../src/browser/m147-hit-receipt-feedback.mjs";

const fixture = Object.freeze({
  sequence: 0x01020304,
  serverTick: 0x0a0b0c0d,
  attacker: 2,
  target: 1,
  damage: 34,
  targetHp: 66,
});
const rustGolden = [
  1, 5, 0, 0, 4, 3, 2, 1, 13, 12, 11, 10,
  2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 8, 66, 0, 0, 132, 66,
];

test("M147 Rust/JS exact 28-byte proposed HIT wire fixture", () => {
  assert.equal(HIT_RECEIPT_TYPE_PROPOSAL, 5);
  assert.equal(HIT_RECEIPT_BYTES, 28);
  const wire = encodeHitReceipt(fixture);
  assert.deepEqual([...new Uint8Array(wire)], rustGolden);
  assert.deepEqual(decodeHitReceipt(wire), fixture);
  assert.deepEqual(decodeHitReceipt(new Uint8Array(rustGolden)), fixture);
});

test("M147 wire rejects forged actors, malformed length, reserved flags and invalid damage", () => {
  for (const wrong of [
    { attacker: 0 }, { target: 0 }, { attacker: 1 },
    { damage: 0 }, { damage: -1 }, { damage: Number.POSITIVE_INFINITY },
    { targetHp: -1 }, { targetHp: Number.NaN },
    { sequence: -1 }, { serverTick: 2 ** 32 },
  ]) {
    assert.throws(() => encodeHitReceipt({ ...fixture, ...wrong }));
  }
  const bytes = new Uint8Array(encodeHitReceipt(fixture));
  assert.throws(() => decodeHitReceipt(bytes.subarray(0, 27)));
  const bad = (at, value) => {
    const packet = bytes.slice();
    packet[at] = value;
    return packet;
  };
  assert.throws(() => decodeHitReceipt(bad(0, 2)), /protocol/);
  assert.throws(() => decodeHitReceipt(bad(1, 4)), /not a hit receipt/);
  assert.throws(() => decodeHitReceipt(bad(2, 1)), /reserved/);
  assert.throws(() => decodeHitReceipt(bad(3, 1)), /reserved/);
  const missingActor = bytes.slice();
  missingActor.fill(0, 12, 16);
  assert.throws(() => decodeHitReceipt(missingActor), /attacker/);
  const nanDamage = bytes.slice();
  new DataView(nanDamage.buffer).setFloat32(20, Number.NaN, true);
  assert.throws(() => decodeHitReceipt(nanDamage), /damage/);
  assert.throws(() => validateHitReceipt({ ...fixture, damage: 1e-99 }), /damage/);
});

test("M147 genuine 3-fighter HIT receipt credits only server-named attacker", () => {
  const victim = presentHitReceipt(fixture, 1);
  const attacker = presentHitReceipt(fixture, 2);
  const unrelated = presentHitReceipt(fixture, 3);
  assert.deepEqual(victim, {
    kind: "hit", text: "Hit taken - 34 HP.", feedback: "damage-taken", durationMs: 700,
  });
  assert.deepEqual(attacker, {
    kind: "hit", text: "Opponent hit - 34 HP.", feedback: "hit-confirm", durationMs: 700,
  });
  assert.equal(unrelated, null, "third player cannot receive an attack confirmation");
  assert.throws(() => presentHitReceipt(fixture, 0), /ownId/);
});

test("M147 presenter refuses actor swaps and implicit sequence wrap on one unreset lease", () => {
  const presenter = createHitReceiptPresenter();
  const nearWrap = { ...fixture, sequence: 0xffffffff };
  assert.equal(presenter.observe(nearWrap, 2)?.feedback, "hit-confirm");
  assert.equal(presenter.observe(nearWrap, 2), null);
  assert.throws(() => presenter.observe({ ...fixture, sequence: 0 }, 2), /wrap requires retirement/);
  assert.throws(() => presenter.observe({ ...fixture, sequence: 1 }, 1), /actor swap/);
  assert.equal(presenter.observe(nearWrap, 2), null,
    "rejected actor/replay input cannot move the cursor or change credit");

  // An external authenticated transport must authorize the new incarnation.
  // The pure reset operation is not itself authentication.
  presenter.reset();
  assert.equal(presenter.observe({ ...fixture, sequence: 0 }, 1)?.feedback, "damage-taken");
  assert.equal(presenter.observe({ ...fixture, sequence: 1 }, 1)?.feedback, "damage-taken");
  assert.equal(presenter.observe({ ...fixture, sequence: 0 }, 1), null);
  assert.throws(() => presenter.observe({ ...fixture, sequence: 2 }, 2), /actor swap/);
  presenter.reset();
  assert.equal(presenter.observe(nearWrap, 2)?.feedback, "hit-confirm");
});

test("M147 spectator-presenter cannot claim an attacker role through later actor-ID substitution", () => {
  const presenter = createHitReceiptPresenter();
  assert.equal(presenter.observe({ ...fixture, sequence: 0 }, 3), null);
  assert.throws(() => presenter.observe({ ...fixture, sequence: 1 }, 2), /actor swap/);
  assert.equal(presenter.observe({ ...fixture, sequence: 0 }, 3), null);
  assert.equal(presenter.observe({ ...fixture, sequence: 1 }, 3), null);
  assert.throws(() => presenter.observe({ ...fixture, sequence: 2 }, 0), /ownId/);
  presenter.reset();
  assert.equal(presenter.observe({ ...fixture, sequence: 0 }, 2)?.feedback, "hit-confirm");
});

test("M147 spectator HP loss alone is insufficient to synthesize a hit-confirm", () => {
  const snapshotWithoutAttacker = {
    ownId: 3,
    previousHp: 100,
    currentHp: 66,
    attackerId: null,
  };
  assert.notEqual(snapshotWithoutAttacker.currentHp, snapshotWithoutAttacker.previousHp);
  assert.equal(presentHitReceipt(fixture, snapshotWithoutAttacker.ownId), null);
});
