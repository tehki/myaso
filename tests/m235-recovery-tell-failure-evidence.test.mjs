import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeM235RecoveryTellFailure } from "../scripts/m235-recovery-tell-failure-evidence.mjs";

test("M235 retains actual Firefox zero-pixel failure while distinguishing RAF and HUD recovery", () => {
  const summary = summarizeM235RecoveryTellFailure({
    observerBrowser: "firefox", localBrowser: "chrome",
    samples: [
      { browser: "firefox", sampler: {
        sampledFrames: 38, maxPixels: 0, lastPixels: 0,
        firstSampleEpochMs: 1200, lastSampleEpochMs: 1550,
        arena: { width: 960, height: 540, x: 320, y: 110, sampleWidth: 320, sampleHeight: 320 },
      }, ui: { focusLabel: "NEAREST #1", recoveryVisible: false,
        recoveryTransitions: [
          { visible: true, state: "attack-recovery", label: "PUNISH" },
          { visible: false, state: "", label: "PUNISH" },
        ],
        focusTransitions: [{ label: "PUNISH TARGET #1", t: 251 }],
        playerHp: 66, opponentHp: 100,
      }},
      { browser: "chrome", sampler: { sampledFrames: 42, maxPixels: 0 },
        ui: { playerHp: 100, opponentHp: 66 } },
    ],
    serverOutput: "unrelated\nM201_AUTH_ACTION tick=367 fighter=1 from=7 to=8\nM201_AUTH_ACTION tick=382 fighter=1 from=8 to=0",
  });
  assert.equal(summary.source, "actual-browser-native-M38-RAF-canvas-and-HUD-on-strict-red");
  assert.equal(summary.observerRafObserved, true);
  assert.equal(summary.observerHudRecoveryObserved, true);
  assert.equal(summary.observer.maxPixels, 0, "must retain real zero; no synthesized success");
  assert.equal(summary.observer.sampledFrames, 38);
  assert.equal(summary.observer.arena.sampleWidth, 320);
  assert.equal(summary.local.maxPixels, 0);
  assert.equal(summary.authoritativeEdges.length, 2);
});

test("M235 separates missing RAF samples from missing replicated HUD focus", () => {
  const summary = summarizeM235RecoveryTellFailure({
    observerBrowser: "firefox", localBrowser: "chrome",
    samples: [
      { browser: "firefox", sampler: { sampledFrames: 0, maxPixels: 0 },
        ui: { focusLabel: "NEAREST #1", recoveryTransitions: [] } },
      { browser: "chrome", sampler: { sampledFrames: 2, maxPixels: 0 } },
    ],
  });
  assert.equal(summary.observerRafObserved, false);
  assert.equal(summary.observerHudRecoveryObserved, false);
  assert.equal(summary.observer.sampledFrames, 0);
  assert.equal(summary.authoritativeEdges.length, 0);
});

test("M235 bounds browser transition and authoritative edge evidence", () => {
  const ui = { focusTransitions: Array.from({ length: 250 }, (_, i) => ({ label: "X" + i, t: i })),
    recoveryTransitions: Array.from({ length: 250 }, (_, i) => ({ visible: i % 2 === 0, state: "attack-recovery" })) };
  const lines = Array.from({ length: 50 }, (_, i) => "M201_AUTH_ACTION tick=" + i);
  const summary = summarizeM235RecoveryTellFailure({
    observerBrowser: "firefox", localBrowser: "chrome",
    samples: [{ browser: "firefox", ui }, { browser: "chrome", samplerError: "readback unavailable" }],
    serverOutput: lines.join("\n"),
  });
  assert.equal(summary.observer.focusTransitions.length, 8);
  assert.equal(summary.observer.focusTransitions[0].label, "X242");
  assert.equal(summary.observer.recoveryTransitions.length, 8);
  assert.equal(summary.authoritativeEdges.length, 16);
  assert.equal(summary.local.samplerError, "readback unavailable");
});

test("M235 attaches real evidence only on original strict M38 red, with no changed pixel threshold", () => {
  const s = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = s.indexOf("async function runOnlineUiRecoveryTellFlight(");
  const end = s.indexOf("async function runOnlineUiAttackIntentFlight(", start);
  const flight = s.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(flight.includes("const observerMax = pixels.find("));
  assert.ok(flight.includes("if (observerMax < 24 || localMax !== 0) {"));
  assert.ok(flight.includes("readRecoveryTellSamplerDiagnostics(entry), readUiEvidence(entry)"));
  assert.ok(flight.includes("summarizeM235RecoveryTellFailure({"));
  assert.ok(flight.includes("serverOutput: m201ServerOutput()"));
  assert.ok(flight.includes("m235FailureEvidence="));
  assert.ok(flight.includes("await runOnlineUiFeedbackFlight(entries)"));
  assert.ok(s.includes("state.sampledFrames += 1;"));
  assert.ok(s.includes("window.__MYASO_M38_RECOVERY_SAMPLER__"));
  assert.ok(!flight.includes("await sleep(520)"), "no extra input/attempt added to M38 path");
});
