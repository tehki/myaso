import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT, createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";

function duel({ distance = 72 } = {}) {
  const a = createFighter({ id: "a", x: 200, y: 200, facing: 0 });
  const b = createFighter({ id: "b", x: 200 + distance, y: 200, facing: Math.PI });
  return createWorld({ width: 600, height: 400, fighters: [a, b] });
}

function advance(world, ms, inputs = {}) {
  const step = 5;
  const events = [];
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    events.push(...stepWorld(world, inputs, Math.min(step, ms - elapsed)));
  }
  return events;
}

test("attack has windup, active, and recovery commitment", () => {
  const world = duel({ distance: 200 });
  const a = world.fighters[0];
  stepWorld(world, { a: { attack: true, aimX: 400, aimY: 200 } }, 5);
  assert.equal(a.action, "attack_windup");

  advance(world, COMBAT.attack.windupMs, { a: { aimX: 400, aimY: 200 } });
  assert.equal(a.action, "attack_active");

  advance(world, COMBAT.attack.activeMs, { a: { aimX: 400, aimY: 200 } });
  assert.equal(a.action, "attack_recovery");

  advance(world, COMBAT.attack.recoveryMs, { a: { aimX: 400, aimY: 200 } });
  assert.equal(a.action, "idle");
});

test("heavy attack has longer windup active and recovery commitment", () => {
  const world = duel({ distance: 200 });
  const a = world.fighters[0];
  stepWorld(world, { a: { heavyAttack: true, aimX: 400, aimY: 200 } }, 5);
  assert.equal(a.action, "heavy_attack_windup");

  advance(world, COMBAT.heavyAttack.windupMs, { a: { aimX: 400, aimY: 200 } });
  assert.equal(a.action, "heavy_attack_active");

  advance(world, COMBAT.heavyAttack.activeMs, { a: { aimX: 400, aimY: 200 } });
  assert.equal(a.action, "heavy_attack_recovery");

  advance(world, COMBAT.heavyAttack.recoveryMs, { a: { aimX: 400, aimY: 200 } });
  assert.equal(a.action, "idle");
});

test("heavy attack deals 46 damage once and applies stronger guard pressure", () => {
  const hitWorld = duel();
  const [attacker, target] = hitWorld.fighters;
  const hitEvents = advance(
    hitWorld,
    COMBAT.heavyAttack.windupMs + COMBAT.heavyAttack.activeMs + 15,
    { a: { heavyAttack: true, aimX: target.x, aimY: target.y } },
  );
  assert.equal(target.hp, 54);
  assert.equal(hitEvents.filter((event) => event.type === "hit").length, 1);
  assert.equal(hitEvents.find((event) => event.type === "hit")?.damage, 46);

  const blockWorld = duel();
  const [blockAttacker, blocker] = blockWorld.fighters;
  advance(blockWorld, COMBAT.block.parryWindowMs + 20, {
    b: { block: true, aimX: blockAttacker.x, aimY: blockAttacker.y },
  });
  const blockEvents = advance(
    blockWorld,
    COMBAT.heavyAttack.windupMs + COMBAT.heavyAttack.activeMs + 15,
    {
      a: { heavyAttack: true, aimX: blocker.x, aimY: blocker.y },
      b: { block: true, aimX: blockAttacker.x, aimY: blockAttacker.y },
    },
  );
  assert.equal(blocker.hp, 100);
  assert.equal(blocker.guard, 100 - COMBAT.heavyAttack.guardDamage);
  assert.ok(blockEvents.some((event) => event.type === "block"));
});

test("fresh block still parries a heavy committed strike", () => {
  const world = duel();
  const [a, b] = world.fighters;

  advance(world, COMBAT.heavyAttack.windupMs - 25, {
    a: { heavyAttack: true, aimX: b.x, aimY: b.y },
  });
  const events = advance(world, 45, {
    a: { aimX: b.x, aimY: b.y },
    b: { block: true, aimX: a.x, aimY: a.y },
  });

  assert.equal(b.hp, 100);
  assert.equal(a.action, "stunned");
  assert.ok(events.some((event) => event.type === "parry"));
});

test("front-facing attack deals damage once", () => {
  const world = duel();
  const [a, b] = world.fighters;
  const events = advance(world, COMBAT.attack.windupMs + COMBAT.attack.activeMs + 15, {
    a: { attack: true, aimX: b.x, aimY: b.y },
  });
  assert.equal(b.hp, 66);
  assert.equal(events.filter((event) => event.type === "hit").length, 1);
});

test("attack outside the facing arc misses", () => {
  const world = duel();
  const [a, b] = world.fighters;
  advance(world, COMBAT.attack.windupMs + COMBAT.attack.activeMs + 15, {
    a: { attack: true, aimX: 100, aimY: 200 },
  });
  assert.equal(b.hp, 100);
});

test("timed dodge i-frames evade an otherwise valid hit", () => {
  const world = duel();
  const [a, b] = world.fighters;

  advance(world, COMBAT.attack.windupMs - 20, {
    a: { attack: true, aimX: b.x, aimY: b.y },
  });
  const events = advance(world, 45, {
    a: { aimX: b.x, aimY: b.y },
    b: { dodge: true, moveY: 1, aimX: a.x, aimY: a.y },
  });

  assert.equal(b.hp, 100);
  assert.ok(events.some((event) => event.type === "evade"));
});

test("directional block absorbs health damage and consumes guard", () => {
  const world = duel();
  const [a, b] = world.fighters;

  advance(world, COMBAT.block.parryWindowMs + 20, {
    b: { block: true, aimX: a.x, aimY: a.y },
  });
  const events = advance(world, COMBAT.attack.windupMs + COMBAT.attack.activeMs + 15, {
    a: { attack: true, aimX: b.x, aimY: b.y },
    b: { block: true, aimX: a.x, aimY: a.y },
  });

  assert.equal(b.hp, 100);
  assert.equal(b.guard, 100 - COMBAT.block.guardDamage);
  assert.ok(events.some((event) => event.type === "block"));
});

test("fresh block parries and stuns the attacker", () => {
  const world = duel();
  const [a, b] = world.fighters;

  advance(world, COMBAT.attack.windupMs - 25, {
    a: { attack: true, aimX: b.x, aimY: b.y },
  });
  const events = advance(world, 45, {
    a: { aimX: b.x, aimY: b.y },
    b: { block: true, aimX: a.x, aimY: a.y },
  });

  assert.equal(b.hp, 100);
  assert.equal(a.action, "stunned");
  assert.ok(events.some((event) => event.type === "parry"));
});

test("death is temporary and respawns at the spawn point", () => {
  const world = duel();
  const [a, b] = world.fighters;
  b.hp = COMBAT.attack.damage;

  const events = advance(world, COMBAT.attack.windupMs + COMBAT.attack.activeMs + 15, {
    a: { attack: true, aimX: b.x, aimY: b.y },
  });
  assert.equal(b.action, "dead");
  assert.ok(events.some((event) => event.type === "death"));

  b.x = 420;
  b.y = 300;
  const respawnEvents = advance(world, COMBAT.respawnMs + 5);
  assert.equal(b.action, "idle");
  assert.equal(b.hp, 100);
  assert.equal(b.x, b.spawnX);
  assert.equal(b.y, b.spawnY);
  assert.ok(respawnEvents.some((event) => event.type === "respawn"));
});


test("fighter bodies remain separated under movement pressure", () => {
  const world = duel({ distance: 40 });
  const [a, b] = world.fighters;
  advance(world, 300, {
    a: { moveX: 1, aimX: b.x, aimY: b.y },
    b: { moveX: -1, aimX: a.x, aimY: a.y },
  });
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= COMBAT.fighterRadius * 2 - 1e-6);
});

test("block only protects the facing side", () => {
  const world = duel();
  const [a, b] = world.fighters;
  b.facing = 0; // facing away from attacker
  advance(world, COMBAT.block.parryWindowMs + 20, {
    b: { block: true, aimX: b.x + 100, aimY: b.y },
  });
  advance(world, COMBAT.attack.windupMs + COMBAT.attack.activeMs + 15, {
    a: { attack: true, aimX: b.x, aimY: b.y },
    b: { block: true, aimX: b.x + 100, aimY: b.y },
  });
  assert.equal(b.hp, 66);
});
