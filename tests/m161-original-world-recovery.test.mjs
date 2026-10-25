import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M161 verification RMB is gated by fresh original World recovery, never initial Idle", () => {
  const src = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = src.indexOf("async function runOnlineUiBoundedKickKnockdownFlight(");
  const end = src.indexOf("async function runOnlineUiKickKnockdownFfaFocusFlight(", start);
  assert.ok(start > 0 && end > start, "original genuine three-browser M161 fixture exists");
  const flight = src.slice(start, end);
  const active = flight.indexOf("const suppressedTick = suppressedKickActive.serverTick;");
  const idle = flight.indexOf("entry.serverTick > suppressedTick", active);
  const verify = flight.indexOf("await performArenaRecoveryBufferedKick(suppressor, suppressorElementId, suppressorOffset, 45);", idle);
  assert.ok(active > 0 && idle > active && verify > idle,
    "second real RMB follows observed original World post-kick Idle");
  assert.match(flight, /Number\.isSafeInteger\(suppressedTick\)/);
  assert.match(flight, /Number\.isSafeInteger\(entry\.serverTick\)/);
  assert.doesNotMatch(flight, /index > activeIndex/,
    "missing brief KickActive cannot admit a stale initial Idle");
  assert.ok(flight.includes("verificationKnockdown.epochMs <= originalRecovery.epochMs"));
  assert.ok(flight.includes("identical post-recovery kick did not create a fresh clean knockdown"));
  assert.ok(flight.includes('entry.type === "pointerdown" && entry.button === 2'));
  assert.ok(flight.includes('entry.type === "pointerup" && entry.button === 2'));
  assert.ok(flight.includes("finalDefender?.playerHp !== 100"));
  assert.ok(flight.includes("finalSuppressor?.playerGuard !== 100"));
});
