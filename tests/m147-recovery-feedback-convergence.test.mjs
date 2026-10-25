import assert from "node:assert/strict";
import test from "node:test";
import { hasM147PunishFeedback } from "../scripts/m147-recovery-feedback-convergence.mjs";

const roles = { jumpBrowser: "chrome", observerBrowser: "firefox", closerBrowser: "chrome2" };
const captured = () => [
  { browser: "chrome", playerHp: 66, playerGuard: 100, events: ["Hit taken - 34 HP."] },
  { browser: "firefox", playerHp: 100, playerGuard: 100, events: ["Attack committed - your windup is readable."] },
  { browser: "chrome2", playerHp: 100, playerGuard: 100, events: ["Opponent hit - 34 HP."] },
];
test("M147 captured victim-first update cannot qualify before actual punisher feedback", () => {
  const states = captured(), original = structuredClone(states);
  assert.equal(hasM147PunishFeedback(states, roles), false);
  assert.deepEqual(states, original, "qualification cannot author feedback");
  states[1].events.push("Opponent hit - 34 HP.");
  assert.equal(hasM147PunishFeedback(states, roles), true);
});
test("M147 wrong victim, missing actor and extra guard/HP damage remain rejected", () => {
  const states = captured(); states[1].events.push("Opponent hit - 34 HP.");
  for (const mutate of [s => { s[0].playerHp = 32; }, s => { s[2].playerHp = 66; },
    s => { s[1].playerGuard = 62; }, s => { s.pop(); }]) {
    const bad = structuredClone(states); mutate(bad);
    assert.equal(hasM147PunishFeedback(bad, roles), false);
  }
});
