import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requiresM338GuardBreakWheelSocket } from "../scripts/m338-guard-break-wheel-scenarios.mjs";

test("M338 M194, M151 and M152 all open genuine Firefox M325 wheel socket", () => {
  for (const scenario of [
    "uiguardbreak", "uiguardbreakpunishffa", "uiguardbreakpunishffahit",
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
  assert.ok(flight.includes("postTrustedWheelMs: 45"));
  assert.ok(flight.includes("b.playerGuard < expectedGuards[index]") || flight.includes("defenderResult.playerGuard !== 0"));
  assert.ok(!observer.includes("dispatchEvent("));
});
