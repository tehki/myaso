import assert from "node:assert/strict";
import test from "node:test";
import { createSparringAi } from "../src/combat/sparring-ai.mjs";

function fighter({
  x = 100,
  y = 100,
  action = "idle",
  stamina = 100,
} = {}) {
  return { x, y, action, stamina };
}

test("sparring AI runs to close long distance but conserves low stamina", () => {
  const ai = createSparringAi();
  const opponent = fighter({ x: 400, y: 100 });

  const fresh = ai.sample({
    nowMs: 1000,
    self: fighter(),
    opponent,
  });
  assert.ok(fresh.moveX > 0.9);
  assert.equal(fresh.run, true);

  ai.reset();
  const tired = ai.sample({
    nowMs: 1000,
    self: fighter({ stamina: 18 }),
    opponent,
  });
  assert.ok(tired.moveX > 0.9);
  assert.equal(tired.run, false);
});

test("sparring AI can answer readable windup with pointer-directed roll", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 500,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 180, y: 100, action: "heavy_attack_windup" }),
  });
  assert.equal(input.dodge, true);
  assert.equal(input.aimX, 180);
  assert.equal(input.aimY, 100);
  assert.equal(input.block, false);
});

test("sparring AI can choose a short block read and keep it bounded", () => {
  const ai = createSparringAi();
  const threat = fighter({ x: 180, y: 100, action: "attack_windup" });
  const first = ai.sample({ nowMs: 100, self: fighter(), opponent: threat });
  assert.equal(first.block, true);

  const held = ai.sample({ nowMs: 250, self: fighter({ action: "block" }), opponent: threat });
  assert.equal(held.block, true);

  const released = ai.sample({ nowMs: 330, self: fighter({ action: "idle" }), opponent: threat });
  assert.equal(released.block, false);
});

test("sparring AI shoves a nearby blocker instead of feeding guard", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 900,
    self: fighter({ x: 100, y: 100 }),
    opponent: fighter({ x: 160, y: 100, action: "block" }),
  });
  assert.equal(input.kick, true);
  assert.equal(input.attack, false);
  assert.equal(input.heavyAttack, false);
});

test("sparring AI chains jump into a real jumping attack", () => {
  const ai = createSparringAi();
  const opponent = fighter({ x: 160, y: 100 });
  const jump = ai.sample({
    nowMs: 1600,
    self: fighter({ x: 100, y: 100 }),
    opponent,
  });
  assert.equal(jump.jump, true);

  const airborne = ai.sample({
    nowMs: 1610,
    self: fighter({ x: 100, y: 100, action: "jump" }),
    opponent,
  });
  assert.equal(airborne.attack, true);
  assert.equal(airborne.jump, false);
});

test("sparring AI retains committed heavy variation at close range", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 3800,
    self: fighter({ x: 100, y: 100 }),
    opponent: fighter({ x: 160, y: 100 }),
  });
  assert.equal(input.heavyAttack, true);
  assert.equal(input.attack, false);
});


test("sparring AI backs off to recover when stamina is critically low", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 1200,
    self: fighter({ x: 100, y: 100, stamina: 10 }),
    opponent: fighter({ x: 160, y: 100 }),
  });
  assert.ok(input.moveX < 0);
  assert.equal(input.run, false);
  assert.equal(input.attack, false);
  assert.equal(input.heavyAttack, false);
  assert.equal(input.kick, false);
  assert.equal(input.jump, false);
});

test("sparring AI takes a real light punish on recovery or stun", () => {
  for (const action of [
    "attack_left_recovery",
    "attack_right_recovery",
    "attack_thrust_recovery",
    "attack_overhead_recovery",
    "running_attack_recovery",
    "heavy_attack_recovery",
    "kick_recovery",
    "jump_attack_recovery",
    "feint_recovery",
    "stunned",
  ]) {
    const ai = createSparringAi();
    const input = ai.sample({
      nowMs: 1300,
      self: fighter({ x: 100, y: 100, stamina: 100 }),
      opponent: fighter({ x: 160, y: 100, action }),
    });
    assert.equal(input.attack, true, action);
    assert.equal(input.heavyAttack, false, action);
    assert.equal(input.kick, false, action);
  }
});

test("sparring AI does not arm narrow jump attack outside its practical landing range", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 1600,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 170, y: 100 }),
  });
  assert.equal(input.jump, false);
});


test("sparring AI converts medium-range pursuit into a running strike", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 1500,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 205, y: 100 }),
  });
  assert.ok(input.moveX > 0.9);
  assert.equal(input.run, true);
  assert.equal(input.attack, true);
});

test("sparring AI recognizes running strike windup as readable threat", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 500,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 180, y: 100, action: "running_attack_windup" }),
  });
  assert.equal(input.dodge, true);
});


test("sparring AI can read directional light windup as a normal threat", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 500,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 180, y: 100, action: "attack_left_windup" }),
  });
  assert.equal(input.dodge, true);
});

test("sparring AI uses lateral movement when choosing its light sweep", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 4560,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 160, y: 100 }),
  });
  assert.equal(input.attack, true);
  assert.ok(Math.hypot(input.moveX, input.moveY) >= 0.6);
});


test("sparring AI recognizes thrust and overhead windups as readable threats", () => {
  for (const action of ["attack_thrust_windup", "attack_overhead_windup"]) {
    const ai = createSparringAi();
    const input = ai.sample({
      nowMs: 500,
      self: fighter({ x: 100, y: 100, stamina: 100 }),
      opponent: fighter({ x: 180, y: 100, action }),
    });
    assert.equal(input.dodge, true, action);
  }
});

test("sparring AI deliberately selects forward thrust in its directional cycle", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 2300,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 160, y: 100 }),
  });
  assert.equal(input.attack, true);
  assert.ok(input.moveX > 0.6);
  assert.ok(Math.abs(input.moveY) < 0.01);
});

test("sparring AI deliberately selects backward overhead in its directional cycle", () => {
  const ai = createSparringAi();
  const input = ai.sample({
    nowMs: 3040,
    self: fighter({ x: 100, y: 100, stamina: 100 }),
    opponent: fighter({ x: 160, y: 100 }),
  });
  assert.equal(input.attack, true);
  assert.ok(input.moveX < -0.6);
  assert.ok(Math.abs(input.moveY) < 0.01);
});
