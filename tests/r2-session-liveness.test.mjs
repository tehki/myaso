import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neutralBackgroundInput } from "../src/browser/neutral-background-input.mjs";

test("hidden browser liveness is always fully neutral and retains uint32 tick wrap", () => {
  for (const tick of [0, 101, 0xffffffff, 0x100000000]) {
    const input = neutralBackgroundInput(tick);
    assert.equal(input.tick, tick >>> 0);
    assert.equal(input.moveX, 0);
    assert.equal(input.moveY, 0);
    assert.equal(input.facing, 0);
    for (const field of ["attack","heavyAttack","dodge","block","kick","run","jump","dash"]) {
      assert.equal(input[field], false, field);
    }
  }
});

test("hidden heartbeat is disabled when visible and sends no synthetic DOM actions", () => {
  const src = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(!document\.hidden \|\| !networkClient\) return;/);
  assert.match(src, /window\.setInterval\(sendBackgroundLiveness, BACKGROUND_LIVENESS_INTERVAL_MS\)/);
  assert.match(src, /clearInterval\(backgroundLivenessTimer\)/);
  assert.match(src, /networkClient\.sendInput\(neutralBackgroundInput\(clientTick\)\)/);
});

test("server expiration is input-authoritative and never reset by outbound snapshots", () => {
  const src = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  assert.match(src, /CLIENT_INPUT_IDLE_TIMEOUT: Duration = Duration::from_secs\(30\)/);
  assert.match(src, /input_idle_timeout\.as_mut\(\)\.reset\(next_client_input_deadline/);
  assert.match(src, /reliable_writer\.abort\(\)/);
  const resetAt=src.indexOf("input_idle_timeout.as_mut().reset");
  const validPacket=src.indexOf("let packet = match decode_input_packet");
  const rejected=src.indexOf("invalid input datagram:");
  const snapshot=src.indexOf("snapshot_interval.tick()");
  assert.ok(validPacket < rejected && rejected < resetAt && resetAt < snapshot);
});
