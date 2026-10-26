import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const section = (startToken, endToken) => {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, "M41 sampler boundaries present");
  return source.slice(start, end);
};

test("M250 M41 samples authentic raster pixels once per browser animation frame, not a wall-timer", () => {
  const arm = section("async function armParryTellSampler(", "async function readParryTellSampler(");
  assert.ok(arm.includes("const pixels = context.getImageData(x, y, width, height).data"));
  assert.ok(arm.includes("state.frame = requestAnimationFrame(sample)"));
  assert.ok(arm.includes("cancelAnimationFrame(prior.frame)"));
  assert.ok(!arm.includes("setTimeout(sample"));
  assert.ok(arm.includes("state.maxPixels = Math.max(state.maxPixels, count)"));
  assert.ok(arm.includes("Math.abs(pixels[i] - 127) <= 2"));
  assert.ok(arm.includes("Math.abs(pixels[i + 1] - 207) <= 2"));
  assert.ok(arm.includes("Math.abs(pixels[i + 2] - 244) <= 2"));
  assert.ok(arm.includes("pixels[i + 3] >= 250"));
});

test("M250 retains strict remote-only M41 pixels and cleans sampler without changes to gameplay", () => {
  const stop = section("async function stopParryTellSampler(", "async function sampleParryTellPixels(");
  const flight = section("async function runOnlineUiParryTellFlight(", "async function runOnlineUiBlockFacingTellFlight(");
  assert.ok(stop.includes("state.active = false"));
  assert.ok(stop.includes("cancelAnimationFrame(state.frame)"));
  assert.ok(flight.includes("armParryTellSampler(observer)"));
  assert.ok(flight.includes("armParryTellSampler(parriedLocal)"));
  assert.ok(flight.includes("evidence = await runOnlineUiParryFlight(entries)"));
  assert.ok(flight.includes("if (observerMax < 24)"));
  assert.ok(flight.includes("if (localMax !== 0)"));
  assert.ok(flight.includes("await Promise.all(entries.map(stopParryTellSampler))"));
  assert.ok(flight.includes("await waitForParryTellClear(observer, 1200)"));
});

test("M41 records real remote draw calls only for diagnostics without weakening exact pixel gate", () => {
  const view = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const diagnostic = section("async function readParryTellSamplerDiagnostics(", "async function stopParryTellSampler(");
  const flight = section("async function runOnlineUiParryTellFlight(", "async function runOnlineUiBlockFacingTellFlight(");
  assert.match(view, /acceptanceScenario === "uiparrytell"/);
  assert.match(view, /__MYASO_M41_DRAW_TRACE__/);
  assert.match(diagnostic, /remoteRingDraw: window\.__MYASO_M41_DRAW_TRACE__/);
  assert.match(flight, /if \(observerMax < 24\)/);
  assert.match(flight, /if \(localMax !== 0\)/);
  assert.ok(!flight.includes("remoteRingDraw?.draws > 0)"));
});

test("M255 waits for real raster frames after authoritative parry, without faking proof", () => {
  const wait = section("async function awaitParryTellRaster(", "async function runOnlineUiParryTellFlight(");
  const flight = section("async function runOnlineUiParryTellFlight(", "async function runOnlineUiBlockFacingTellFlight(");
  assert.match(wait, /timeoutMs = 350/);
  assert.match(wait, /readParryTellSampler\(observer\)/);
  assert.match(wait, /readParryTellSampler\(parriedLocal\)/);
  assert.match(wait, /observerMax >= 24/);
  assert.match(wait, /await sleep\(20\)/);
  assert.doesNotMatch(wait, /dispatchEvent|onParry|remoteRingDraw|forceMax/);
  assert.match(flight, /await awaitParryTellRaster\(observer, parriedLocal\)/);
  assert.match(flight, /if \(observerMax < 24\)/);
  assert.match(flight, /if \(localMax !== 0\)/);
  assert.match(flight, /finally \{\s*await Promise\.all\(entries\.map\(stopParryTellSampler\)\)/);
});

test("M41 reuses M35's genuine 95ms wheel wait after World proved its 35ms wait outside 125ms parry", () => {
  const parry = section("async function runOnlineUiParryFlight(", "async function runOnlineUiParryPunishFfaFocusFlight(");
  const flight = section("async function runOnlineUiParryTellFlight(", "async function runOnlineUiBlockFacingTellFlight(");
  assert.ok(parry.includes('const releaseToStrikeParryDelayMs = 95'));
  assert.ok(parry.includes("await setArenaBlock(defender, defenderElementId, true)"));
  assert.ok(parry.includes("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 35)"));
  assert.ok(parry.includes('throw new Error("M33 genuine short-click parry resolved unexpectedly: "'));
  assert.ok(flight.includes("evidence = await runOnlineUiParryFlight(entries)"));
  assert.ok(flight.includes("if (observerMax < 24)"));
  assert.ok(flight.includes("if (localMax !== 0)"));
  assert.ok(!flight.includes("dispatchEvent("));
});
