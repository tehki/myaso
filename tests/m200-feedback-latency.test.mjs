import test from "node:test";
import assert from "node:assert/strict";
import { measureM200WheelFeedbackLatency } from "../scripts/m200-feedback-latency.mjs";

const measure = (wheel, transitions, remainingGuard = 62) =>
  measureM200WheelFeedbackLatency({ wheel, transitions, remainingGuard });

test("M200 measures a real same-browser block feedback after the wheel", () => {
  assert.deepEqual(measure({ t: 553 }, [
    { text: "Blocking - keep the threat in front of you.", t: 570 },
    { text: "Block held - guard -38.", t: 772.4 },
  ]), { wheelToFeedbackMs: 219.4, feedbackKind: "blocked-guard" });
});

test("M200 never reports a negative value from previous exchange feedback", () => {
  assert.equal(measure({ t: 1200 }, [
    { text: "Block held - guard -38.", t: 807 },
  ], 24), null);
});

test("M200 accepts only the new guard-break cue for zero guard", () => {
  assert.deepEqual(measure({ t: 200 }, [
    { text: "Block held - guard -38.", t: 300 },
    { text: "Guard broken - you are vulnerable.", t: 448 },
  ], 0), { wheelToFeedbackMs: 248, feedbackKind: "guard-break" });
});

test("M200 rejects unrelated, malformed and cross-exchange timestamps", () => {
  assert.equal(measure({ t: 400 }, [{ text: "Guard broken - you are vulnerable.", t: 401 }]), null);
  assert.equal(measure({ t: NaN }, [{ text: "Block held - guard -38.", t: 500 }]), null);
  assert.equal(measure({ t: 400 }, [{ text: "Block held - guard -38.", t: Infinity }]), null);
  assert.equal(measure({ t: 400 }, null), null);
  assert.equal(measure({ t: 400 }, [{ text: "Block held - guard -38.", t: 402 }], -1), null);
});

test("M200 pairs with the earliest matching post-wheel feedback", () => {
  assert.deepEqual(measure({ t: 500 }, [
    { text: "Block held - guard -38.", t: 780 },
    { text: "Block held - guard -38.", t: 721.23 },
    { text: "Block held - guard -38.", t: 400 },
  ]), { wheelToFeedbackMs: 221.2, feedbackKind: "blocked-guard" });
});
