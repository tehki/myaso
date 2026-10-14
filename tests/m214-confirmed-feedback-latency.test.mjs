import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeM214ConfirmedFeedback } from "../scripts/m214-confirmed-feedback-latency.mjs";

const row = (input, show) => ({
  sameBrowserClock: true,
  inputEpochMs: input,
  queuedEpochMs: input + 5,
  submittedEpochMs: input + 10,
  confirmedEpochMs: input + 30,
  shownEpochMs: show,
});

test("M214 nearest-rank percentiles use real per-browser input to confirmed feedback", () => {
  const report = summarizeM214ConfirmedFeedback([
    row(100, 150), row(200, 260), row(300, 370), row(400, 480),
  ]);
  assert.equal(report.attempts, 4);
  assert.equal(report.provenance, "single-actor-browser-epoch");
  assert.deepEqual(report.metrics.inputToShownMs, {
    samples: 4, missingOrUnordered: 0, minMs: 50, p50Ms: 60, p95Ms: 80, maxMs: 80,
  });
  assert.equal(report.metrics.submittedToConfirmedMs.p95Ms, 20);
  assert.equal(report.metrics.confirmedToShownMs.p50Ms, 30);
});

test("M214 never manufactures a negative, cross-clock, or absent feedback latency", () => {
  const report = summarizeM214ConfirmedFeedback([
    { ...row(100, 140), sameBrowserClock: false },
    { ...row(100, 140), shownEpochMs: 99 },
    { ...row(100, 140), shownEpochMs: NaN },
    null,
  ]);
  assert.equal(report.metrics.inputToShownMs.samples, 0);
  assert.equal(report.metrics.inputToShownMs.missingOrUnordered, 4);
  assert.equal(report.metrics.inputToShownMs.p95Ms, null);
  assert.equal(report.metrics.inputToConfirmedMs.samples, 2);
  assert.equal(report.metrics.confirmedToShownMs.samples, 0);
});

test("M214 empty data remains unknown rather than zero latency", () => {
  const report = summarizeM214ConfirmedFeedback([]);
  assert.equal(report.attempts, 0);
  assert.equal(report.metrics.inputToShownMs.p50Ms, null);
  assert.equal(report.metrics.inputToShownMs.missingOrUnordered, 0);
});

test("M214 is read-only on the existing strict M175 genuine action proof", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiConfirmedStaminaActionsFlight(");
  const end = source.indexOf("async function runOnlineUiRollBufferFlight(", start);
  const part = source.slice(start, end);
  assert.ok(part.includes("inputEpochMs: input.epochMs"));
  assert.ok(part.includes("sameBrowserClock: true"));
  assert.ok(part.includes("queuedEpochMs: queued.epochMs"));
  assert.ok(part.includes("confirmedEpochMs: confirmed.epochMs"));
  assert.ok(part.includes("shownEpochMs: shown.epochMs"));
  assert.ok(part.includes("summarizeM214ConfirmedFeedback(proofs)"));
  assert.ok(part.indexOf("denial proof changed health/guard") < part.indexOf("M214_CONFIRMED_DENIAL_FEEDBACK_LATENCY"));
  assert.ok(part.includes("ackIncludesInput"));
  assert.ok(part.includes("processedClientTick"));
});
