import test from "node:test";
import assert from "node:assert/strict";
import { planM159GenuinePunishTap } from "../scripts/m159-genuine-punish-tap.mjs";

test("M159 uses one authentic W3C pointer packet and short release on click", () => {
  const packet = planM159GenuinePunishTap("mouse-chrome3");
  assert.equal(packet.actions.length, 1, "exactly one WebDriver action source/request");
  const device = packet.actions[0];
  assert.equal(device.type, "pointer");
  assert.equal(device.id, "mouse-chrome3");
  assert.equal(device.parameters.pointerType, "mouse");
  assert.deepEqual(device.actions, [
    { type: "pointerDown", button: 0 },
    { type: "pause", duration: 10 },
    { type: "pointerUp", button: 0 },
  ]);
  assert.ok(device.actions[1].duration < 320, "genuine short light, never charged heavy");
  assert.ok(!JSON.stringify(packet).includes("keyDown"), "no forged key");
  assert.ok(!JSON.stringify(packet).includes("moveTo"), "no change to pre-aim");
});

test("M159 rejects missing or malformed W3C pointer IDs", () => {
  for (const id of ["", " ", null, 0, {}, []]) {
    assert.throws(() => planM159GenuinePunishTap(id), TypeError);
  }
});

test("M159 leaves unchanged strict M209 authoritative proof in real runner", async () => {
  const { readFile } = await import("node:fs/promises");
  const runner = await readFile(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.match(runner, /planM159GenuinePunishTap\(`mouse-\$\{punisher\.name\}\`\)/);
  assert.match(runner, /verifyM209DualKnockdownServerPunish\(m201ServerOutput\(\),/);
  assert.match(runner, /server attack-active\/hit was not inside BOTH authentic knockdowns/);
  assert.match(runner, /firstState\?\.playerHp === 66/);
  assert.match(runner, /secondState\?\.playerHp === 100/);
});
