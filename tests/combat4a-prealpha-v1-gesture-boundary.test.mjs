import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";
import { NETWORK } from "../src/network/constants.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";

// REVIEW-ONLY P0 regression witnesses for #531/#696/#723.
// These tests deliberately prove existing v1 limitations; they do NOT claim
// to exercise authenticated QUIC, server admission, or World hit resolution.
// Do not replace these witnesses with fabricated "passing" hit assertions.

test("Combat 4A: live normal LMB has no light callback at pointerDOWN (known Pre-Alpha blocker)", () => {
  let clock = 100;
  const events = [];
  const lmb = createLeftButtonCharge({
    now: () => clock,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  assert.equal(lmb.press(7), true);
  assert.equal(lmb.isCharging(), true);
  assert.deepEqual(events, [], "v1 controller currently defers normal light until release");
  clock = 112; // Native 12ms witness duration from issue #531.
  assert.equal(lmb.release(7), "light");
  assert.deepEqual(events, ["LIGHT"]);
  assert.equal(lmb.release(7), null, "repeated release cannot queue a second attack");
});

test("Combat 4A: old held LMB produces simultaneous attack + heavy flags before any light callback", () => {
  let clock = 100;
  const events = [];
  const lmb = createLeftButtonCharge({
    now: () => clock,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  lmb.press(5);
  const leftChargeHeld = lmb.isCharging();
  const sample = { attack: leftChargeHeld, heavyAttack: leftChargeHeld };
  assert.deepEqual(sample, { attack: true, heavyAttack: true });
  assert.deepEqual(events, []);
  const packet = decodeInputPacket(encodeInputPacket({
    sequence: 5,
    clientTick: 40,
    samples: [{ tick: 40, ...sample }],
  }));
  assert.equal(packet.samples[0].attack, true);
  assert.equal(packet.samples[0].heavyAttack, true);
  clock = 112;
  assert.equal(lmb.release(5), "light");
  assert.deepEqual(events, ["LIGHT"]);
  // This DOES NOT prove which flag combination an actual server tick admitted.
});

test("Combat 4A: 34-byte legacy v1 packet cannot encode independent KeyE vs orphaned LMB provenance", () => {
  assert.equal(NETWORK.protocolVersion, 1);
  assert.equal(inputPacketBytes(NETWORK.inputRedundancy), 34);
  const sample = { tick: 40, attack: false, heavyAttack: true };
  const keyE = new Uint8Array(encodeInputPacket({
    sequence: 6, clientTick: 40,
    samples: [sample, { tick: 39 }, { tick: 38 }],
  }));
  // Same observed v1 sample when the preceding held-LMB press is lost:
  // one heavy pulse, without typed gesture identity or source.
  const orphanLmb = new Uint8Array(encodeInputPacket({
    sequence: 6, clientTick: 40,
    samples: [sample, { tick: 39 }, { tick: 38 }],
  }));
  assert.deepEqual(keyE, orphanLmb, "distinct physical origins collide on identical v1 wire bytes");
  assert.equal(keyE.length, 34);
  const decoded = decodeInputPacket(keyE);
  assert.deepEqual(
    decoded.samples.map(x => [x.attack, x.heavyAttack]),
    [[false, true], [false, false], [false, false]],
  );
  assert.equal("inputSource" in decoded.samples[0], false);
  assert.equal("gestureId" in decoded.samples[0], false);
});

test("Combat 4A: fast DOWN+UP can fit within one real v1 sampler interval", () => {
  // This arithmetic witnesses the gap; it does not pretend that onLight()
  // cannot enqueue a later sampled attack, nor claim a real packet was lost.
  assert.equal(NETWORK.inputSendHz, 60, "re-evaluate this witness if live send cadence changes");
  const interval = 1000 / NETWORK.inputSendHz;
  const downMs = 2;
  const upMs = 14;
  assert.ok(downMs > 0 && upMs < interval);
  assert.equal(upMs - downMs, 12);
  assert.ok(interval > upMs - downMs);
});

test("Combat 4A: W3C pointercancel with button=-1 retires only the matching LMB pointer", () => {
  let nowMs = 0;
  const events = [];
  const lmb = createLeftButtonCharge({
    now: () => nowMs,
    onLight: () => events.push("LIGHT"),
    onHeavy: () => events.push("HEAVY"),
  });
  assert.equal(lmb.press(41), true);
  const cancellationEvent = { pointerId: 41, button: -1 };
  assert.equal(lmb.cancel(999), false, "an unrelated pointer cannot cancel the LMB");
  assert.equal(lmb.isPressed(), true);
  assert.equal(lmb.cancel(cancellationEvent.pointerId), true);
  nowMs = 500;
  assert.equal(lmb.isPressed(), false);
  assert.equal(lmb.release(cancellationEvent.pointerId), null);
  assert.deepEqual(events, [], "a canceled long charge may not cause delayed heavy/light");
});

test("Combat 4A: live pointercancel handlers do not require a pointer-button transition", () => {
  for (const path of ["../web/online-game.mjs", "../web/game.mjs"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const match = source.match(/canvas\.addEventListener\("pointercancel", \(event\) => \{([\s\S]*?)\n\}\);/);
    assert.ok(match, path + " must own the real pointercancel handler");
    assert.doesNotMatch(match[1], /if \(event\.button === 0\)/,
      path + " must not ignore a genuine W3C pointercancel(button=-1)");
    assert.match(match[1], /leftButtonCharge\.cancel\(event\.pointerId\)/,
      path + " must cancel by active pointer identity, not event.button");
  }
});
