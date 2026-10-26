import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requiresM338GuardBreakWheelSocket } from "../scripts/m338-guard-break-wheel-scenarios.mjs";

test("M339 M194, M151, M152 and M40 open genuine Firefox M325 wheel socket", () => {
  for (const scenario of [
    "uiguardbreak", "uiguardbreaktell", "uiguardbreakpunishffa", "uiguardbreakpunishffahit",
  ]) {
    assert.equal(requiresM338GuardBreakWheelSocket(scenario, "firefox"), true, scenario);
    for (const browser of ["chrome", "chrome2", "chrome3"]) {
      assert.equal(requiresM338GuardBreakWheelSocket(scenario, browser), false);
    }
  }
});
test("M338 other browser flights cannot access the M325 socket", () => {
  for (const scenario of [
    "uiparrypunishffa", "uiparrypunishffahit",
    "uimultirecoveryspatial", "uikickknockdownffahit", "uifeint",
    "", null, undefined,
  ]) {
    assert.equal(requiresM338GuardBreakWheelSocket(scenario, "firefox"), false);
  }
});
test("M338 connects before guard-break W3C input and preserves genuine wheel proof gates", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const first = source.indexOf("async function installUiObserver(");
  const end = source.indexOf("\nasync function ", first + 30);
  const observer = source.slice(first, end);
  assert.ok(observer.includes("requiresM338GuardBreakWheelSocket(scenario, session.name)"));
  assert.ok(observer.includes("prior.readyState === WebSocket.CLOSING"));
  assert.ok(observer.includes("prior.readyState === WebSocket.CLOSED"));
  assert.ok(observer.includes('new WebSocket('));
  assert.ok(observer.includes('"ws://" + location.host + "/__myaso_m325_trusted_wheel"'));
  assert.ok(observer.includes("event.isTrusted === true && event.deltaY > 0"));
  assert.ok(observer.includes("channel.readyState === WebSocket.OPEN) channel.send(receipt)"));
  const begin = source.indexOf("async function runOnlineUiGuardBreakFlight(");
  const finish = source.indexOf("\nasync function ", begin + 30);
  const flight = source.slice(begin, finish);
  assert.ok(flight.includes("await Promise.all(entries.map(installUiObserver))"));
  assert.ok(flight.includes("M325 trusted Firefox wheel socket did not open"));
  assert.ok(flight.includes("awaitTrustedWheel: () => challenge.wait()"));
  const r2 = readFileSync(new URL("../scripts/r2-release-led-short-block.mjs", import.meta.url), "utf8");
  assert.ok(flight.includes("dispatchR2ReleaseLedShortBlock({"));
  assert.match(r2, /receiptGraceMs = 100/);
  assert.match(r2, /postTrustedWheelMs = 0/, "all established W3C scenarios retain zero extra post-wheel wait by default");
  assert.match(flight, /const wheelFirstGuardOnly = scenario === "uiguardbreakpunishffahit";/);
  assert.match(flight, /const m151ReleaseAnchoredGuardOnly = scenario === "uiguardbreakpunishffa";/);
  assert.match(flight, /const m194ReleaseAnchoredGuardOnly = scenario === "uiguardbreak";/);
  assert.ok(flight.includes("trustedWheelWaitMs: (wheelFirstGuardOnly || m151ReleaseAnchoredGuardOnly || m194ReleaseAnchoredGuardOnly) ? 190 : 0"),
    "only authentic M152, M151 and M194 staging awaits genuine trusted wheel proof");
  assert.ok(flight.includes("postTrustedWheelMs: (m151ReleaseAnchoredGuardOnly || m194ReleaseAnchoredGuardOnly) ? 25 : 0"),
    "only authentic M151 and M194 staging opts into the bounded release window");
  assert.equal((flight.match(/postTrustedWheelMs:/g) ?? []).length, 1,
    "exactly one scenario-scoped bounded post-wheel delay is permitted");
  assert.ok(flight.includes("b.playerGuard < expectedGuards[index]") || flight.includes("defenderResult.playerGuard !== 0"));
  assert.ok(!observer.includes("dispatchEvent("));
});

test("M339 explicitly covers every scenario delegating to M34 guard-break flight", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const direct = runner.indexOf('} else if (scenario === "uiguardbreak") {');
  const tell = runner.indexOf('} else if (scenario === "uiguardbreaktell") {');
  const ffa = runner.indexOf('} else if (scenario === "uiguardbreakpunishffa") {');
  const hit = runner.indexOf('} else if (scenario === "uiguardbreakpunishffahit") {');
  assert.ok([direct, tell, ffa, hit].every((index) => index >= 0));
  assert.ok(runner.slice(direct, direct + 150).includes("runOnlineUiGuardBreakFlight(sessions)"));
  assert.ok(runner.slice(tell, tell + 160).includes("runOnlineUiGuardBreakTellFlight(sessions)"));
  assert.match(runner, /async function runOnlineUiGuardBreakTellFlight\(entries\) \{\r?\n  const evidence = await runOnlineUiGuardBreakFlight\(entries\);/);
  assert.ok(runner.slice(ffa, ffa + 160).includes("runOnlineUiGuardBreakPunishFfaFocusFlight(sessions)"));
  assert.ok(runner.slice(hit, hit + 165).includes("runOnlineUiGuardBreakPunishFfaFocusFlight(sessions, true)"));
  for (const scenario of ["uiguardbreak", "uiguardbreaktell",
    "uiguardbreakpunishffa", "uiguardbreakpunishffahit"]) {
    assert.equal(requiresM338GuardBreakWheelSocket(scenario, "firefox"), true, scenario);
  }
});
