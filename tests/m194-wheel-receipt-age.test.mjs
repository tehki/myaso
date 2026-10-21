import test from "node:test";
import assert from "node:assert/strict";
import { planM194TrustedWheelDelay, dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";
import { createM221TrustedWheelRegistry } from "../scripts/m221-trusted-wheel-attestation.mjs";

test("M194 late native wheel receipt cannot add a second full 40ms delay", async () => {
  const waits = [];
  let ups = 0;
  const report = { trusted: true, deltaY: 120, eventEpochMs: 1000 };
  const result = await dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 40, compensateWheelReceipt: true,
    now: () => 0, nowEpoch: () => 1049,
    sleep: ms => { waits.push(ms); return new Promise(() => {}); },
    sendAttackDown: () => {}, sendWheel: () => {},
    awaitTrustedWheel: () => report, sendAttackUp: () => { ups++; },
  });
  assert.deepEqual(waits, [190], "49ms already elapsed after the genuine event");
  assert.equal(ups, 1);
  assert.deepEqual(result.wheelReceiptTiming, { receiptAgeMs: 49, remainingMs: 0 });
});

test("M194 fast receipts retain target age; stale/future/missing event epochs fail closed", () => {
  assert.deepEqual(planM194TrustedWheelDelay({ eventEpochMs: 1000, nowEpochMs: 1010, targetAgeMs: 40 }),
    { receiptAgeMs: 10, remainingMs: 30 });
  for (const eventEpochMs of [undefined, NaN, 1100, 900]) {
    assert.throws(() => planM194TrustedWheelDelay({ eventEpochMs, nowEpochMs: 1000, targetAgeMs: 40 }));
  }
});

test("M221 preserves the actual event epoch and never consumes an invalid report", async () => {
  const registry = createM221TrustedWheelRegistry();
  const challenge = registry.issue();
  const report = { token: challenge.token, trusted: true, deltaY: 120, eventEpochMs: 1000 };
  assert.equal(registry.receive({ ...report, eventEpochMs: NaN }), false);
  assert.equal(registry.receive(report), true);
  assert.deepEqual(await challenge.wait(), { trusted: true, deltaY: 120, eventEpochMs: 1000 });
  challenge.close();
});

test("M194 an overslept sampling delay cannot release a stale strike", async () => {
  let epoch = 1010, ups = 0;
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 40, compensateWheelReceipt: true,
    now: () => 0, nowEpoch: () => epoch,
    sleep: ms => { if (ms === 190) return new Promise(() => {}); epoch = 1080; },
    sendAttackDown: () => {}, sendWheel: () => {},
    awaitTrustedWheel: () => ({ trusted: true, deltaY: 120, eventEpochMs: 1000 }),
    sendAttackUp: () => { ups++; },
  }), /stale/);
  assert.equal(ups, 0);
});
