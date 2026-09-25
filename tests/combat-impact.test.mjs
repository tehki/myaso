import assert from "node:assert/strict";
import test from "node:test";
import {
  combatImpactProfile,
  createCombatImpactController,
} from "../src/browser/combat-impact.mjs";

test("combat impact profiles give parry and guard break more weight than ordinary hit", () => {
  const hit = combatImpactProfile("hit-confirm");
  const parry = combatImpactProfile("parry-success");
  const guardBreak = combatImpactProfile("guard-broken");
  assert.ok(hit);
  assert.ok(parry.freezeMs > hit.freezeMs);
  assert.ok(parry.shakePx > hit.shakePx);
  assert.ok(guardBreak.freezeMs > parry.freezeMs);
  assert.ok(guardBreak.rays >= parry.rays);
});

test("combat impact controller freezes only inside the bounded visual hit-stop window", () => {
  const impact = createCombatImpactController();
  impact.trigger("hit-confirm", 1000);
  assert.equal(impact.sample(1000).freeze, true);
  assert.equal(impact.sample(1033).freeze, true);
  assert.equal(impact.sample(1035).freeze, false);
  assert.equal(impact.sample(1190).active, false);
});

test("combat impact shake and flash decay to zero without randomness", () => {
  const a = createCombatImpactController();
  const b = createCombatImpactController();
  a.trigger("parry-success", 500);
  b.trigger("parry-success", 500);
  const earlyA = a.sample(570);
  const earlyB = b.sample(570);
  const late = a.sample(740);
  assert.deepEqual(earlyA, earlyB);
  assert.ok(Math.abs(late.shakeX) < combatImpactProfile("parry-success").shakePx);
  assert.ok(late.flashAlpha < earlyA.flashAlpha);
});

test("unknown combat feedback never creates hit-stop or camera impulse", () => {
  const impact = createCombatImpactController();
  assert.equal(impact.trigger("unknown-feedback", 0), null);
  assert.deepEqual(impact.sample(20), {
    active: false,
    feedback: "",
    freeze: false,
    progress: 1,
    shakeX: 0,
    shakeY: 0,
    flashAlpha: 0,
    rays: 0,
  });
});
