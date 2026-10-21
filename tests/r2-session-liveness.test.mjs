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

test("server expiration is input-authoritative and replayed ticks NEVER renew fighter lease", () => {
  const src = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  assert.match(src, /CLIENT_INPUT_IDLE_TIMEOUT: Duration = Duration::from_secs\(30\)/);
  assert.match(src, /reliable_writer\.abort\(\)/);
  // Preserve original R2 cleanup guarantee, now rejecting a stronger threat:
  // syntactically valid QUIC datagrams whose input samples were all replayed.
  assert.match(src,
    /fn accepted_gameplay_renews_session\(accepted: &AcceptedInputBatch\) -> bool \{\s*!accepted\.is_empty\(\)\s*\}/);
  assert.match(src,
    /if accepted_gameplay_renews_session\(&accepted\) \{\s*input_idle_timeout\s*\.as_mut\(\)\s*\.reset\(next_client_input_deadline/);
  const reset=/input_idle_timeout\s*\.as_mut\(\)\s*\.reset\(next_client_input_deadline/.exec(src);
  assert.ok(reset,"input lease reset must remain guarded by nonempty server-ingress acceptance");
  const validPacket=src.indexOf("let packet = match decode_input_packet");
  const rejected=src.indexOf("invalid input datagram:");
  const ingress=src.indexOf("let accepted = ingress.ingest(&packet)");
  const snapshot=src.indexOf("snapshot_interval.tick()");
  assert.ok(validPacket>=0 && rejected>validPacket && ingress>rejected
    && reset.index>ingress && snapshot>reset.index,
    "only real accepted input may refresh fighter inactivity before outbound snapshots");
  // The entire incoming packet-decode, loss-impairment and snapshot ACK
  // pre-ingress section must never contain a hidden second timeout reset.
  assert.doesNotMatch(src.slice(validPacket,ingress),
    /input_idle_timeout\s*\.as_mut\(\)\s*\.reset\(/);
});
