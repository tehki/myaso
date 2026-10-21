import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dispatchM41NativeParryAfterRelease } from "../scripts/m41-native-parry-after-release.mjs";
import { COMBAT } from "../src/combat/model.mjs";

test("M41 awaits genuine Chrome release ACK before dispatching exactly one native Firefox wheel", async () => {
  const events = [];
  let finishAttack;
  const attackAck = new Promise(resolve => { finishAttack = resolve; });
  const flight = dispatchM41NativeParryAfterRelease({
    sendAttack: () => { events.push("chrome-real-pointer-up"); return attackAck; },
    sleep: ms => { events.push("bounded-pause:" + ms); },
    sendWheel: () => { events.push("firefox-real-wheel"); },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["chrome-real-pointer-up"]);
  finishAttack();
  const proof = await flight;
  assert.deepEqual(events, ["chrome-real-pointer-up", "bounded-pause:10", "firefox-real-wheel"]);
  assert.equal(proof.wheelAfterReleaseMs, 10);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.damage, 34);
});

test("M41 refuses to wheel or claim success if Chrome real W3C release fails", async () => {
  let wheels=0;
  await assert.rejects(() => dispatchM41NativeParryAfterRelease({
    sendAttack: () => { throw Error("Chrome W3C rejected"); },
    sendWheel: () => { wheels++; },
  }), /Chrome W3C rejected/);
  assert.equal(wheels, 0);
});

test("M41 preserves failure of Firefox genuine W3C wheel and never retries it", async () => {
  let attack=0, wheel=0;
  await assert.rejects(() => dispatchM41NativeParryAfterRelease({
    sendAttack: () => { attack++; },
    sendWheel: () => { wheel++; throw Error("Firefox W3C rejected"); },
    sleep: () => {},
  }), /Firefox W3C rejected/);
  assert.equal(attack,1);
  assert.equal(wheel,1);
});

test("M41 rejects unbounded W3C scheduling or missing callbacks", async () => {
  for(const ms of [-1,31,Infinity,NaN]) {
    await assert.rejects(() => dispatchM41NativeParryAfterRelease({
      sendAttack: () => {}, sendWheel: () => {}, wheelAfterReleaseMs: ms,
    }), TypeError);
  }
  await assert.rejects(() => dispatchM41NativeParryAfterRelease({
    sendAttack: null, sendWheel: () => {},
  }), TypeError);
});

test("M41 retains original authentic native W3C combat/raster strictness", () => {
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const segment=source.slice(source.indexOf("async function runOnlineUiParryFlight("),
    source.indexOf("async function runOnlineUiParryPunishFfaFocusFlight("));
  assert.match(segment,/if \(scenario === "uiparrytell"\) \{/);
  assert.match(segment,/sendAttack: \(\) => performArenaAttackHold\(attacker, attackerElementId, attackOffset, 35\)/);
  assert.match(segment,/sendWheel: \(\) => setArenaBlock\(defender, defenderElementId, true\)/);
  assert.match(segment,/await dispatchM41NativeParryOnLightOnset\(\{/);
  assert.match(segment,/readOutput: m201ServerOutput, afterOffset: m41AuthLogStart/);
  assert.match(segment,/M33 genuine short-click parry resolved unexpectedly/);
  assert.match(segment,/if \(!pristine\)/);
  assert.match(segment,/stagedDefender\?\.playerHp === defenderBefore\?\.playerHp/);
  assert.match(segment,/if \(!blockWheel\)/);
  const raster=source.slice(source.indexOf("async function runOnlineUiParryTellFlight("),
    source.indexOf("async function runOnlineUiBlockFacingTellFlight("));
  assert.match(raster,/if \(observerMax < 24\)/);
  assert.match(raster,/if \(localMax !== 0\)/);
  assert.match(raster,/finally \{/);
  assert.doesNotMatch(segment,/dispatchEvent\(|new WheelEvent\(/);
});
