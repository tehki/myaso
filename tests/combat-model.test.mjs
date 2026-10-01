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

function enterLightRecovery(world) {
  const [attacker, target] = world.fighters;
  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  advance(world, COMBAT.attack.windupMs - 5, { a: { aimX: target.x, aimY: target.y } });
  advance(world, COMBAT.attack.activeMs, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "attack_recovery");
  assert.equal(attacker.actionElapsedMs, 0);
  return { attacker, target };
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


test("unblocked kick shoves and stuns without health damage", () => {
  const world = duel({ distance: 54 });
  const [a, b] = world.fighters;
  const events = advance(world, COMBAT.kick.windupMs + COMBAT.kick.activeMs + 10, {
    a: { kick: true, aimX: b.x, aimY: b.y },
  });
  assert.equal(b.hp, 100);
  assert.equal(b.action, "knockdown");
  assert.ok(events.some((event) => event.type === "kick"));
  assert.equal(a.stamina, COMBAT.stamina.max - COMBAT.kick.staminaCost);
});

test("blocked kick pressures guard but does not stun blocker", () => {
  const world = duel({ distance: 54 });
  const [a, b] = world.fighters;
  advance(world, COMBAT.block.parryWindowMs + 10, {
    b: { block: true, aimX: a.x, aimY: a.y },
  });
  const events = advance(world, COMBAT.kick.windupMs + COMBAT.kick.activeMs + 10, {
    a: { kick: true, aimX: b.x, aimY: b.y },
    b: { block: true, aimX: a.x, aimY: a.y },
  });
  assert.equal(b.hp, 100);
  assert.equal(b.action, "block");
  assert.equal(b.guard, 100 - COMBAT.kick.blockedGuardDamage);
  assert.ok(events.some((event) => event.type === "block"));
});

test("roll collision knocks rival down and consumes stamina", () => {
  const world = duel({ distance: 44 });
  const [a, b] = world.fighters;
  const events = advance(world, 35, {
    a: { dodge: true, moveX: 1, aimX: b.x, aimY: b.y },
  });
  assert.equal(a.action, "dodge");
  assert.equal(b.action, "knockdown");
  assert.ok(events.some((event) => event.type === "roll_hit"));
  assert.equal(a.stamina, COMBAT.stamina.max - COMBAT.dodge.staminaCost);
});

test("running is faster and drains stamina", () => {
  const runner = createFighter({ id: "runner", x: 100, y: 100, facing: 0 });
  const world = createWorld({ width: 800, height: 400, fighters: [runner] });
  advance(world, 200, { runner: { moveX: 1, run: true, aimX: 500, aimY: 100 } });
  assert.ok(runner.x > 100 + COMBAT.moveSpeed * 0.2);
  assert.ok(runner.stamina < COMBAT.stamina.max);
});

test("space-style jump can convert into a jumping attack", () => {
  const world = duel({ distance: 60 });
  const [a, b] = world.fighters;
  stepWorld(world, { a: { jump: true, aimX: b.x, aimY: b.y } }, 5);
  assert.equal(a.action, "jump");
  stepWorld(world, { a: { attack: true, aimX: b.x, aimY: b.y } }, 5);
  assert.equal(a.action, "jump_attack_windup");
  const events = advance(world, COMBAT.jumpAttack.windupMs + COMBAT.jumpAttack.activeMs + 10, {
    a: { aimX: b.x, aimY: b.y },
  });
  assert.equal(b.hp, 100 - COMBAT.jumpAttack.damage);
  assert.ok(events.some((event) => event.type === "hit" && event.attackKind === "jump_attack"));
});



test("roll direction always follows pointer facing, not movement keys", () => {
  const fighter = createFighter({ id: "roller", x: 300, y: 200, facing: 0 });
  const world = createWorld({ width: 800, height: 500, fighters: [fighter] });
  const startX = fighter.x;
  const startY = fighter.y;
  advance(world, 50, {
    roller: {
      moveX: -1,
      moveY: 0,
      dodge: true,
      aimX: 300,
      aimY: 400,
    },
  });
  assert.ok(fighter.y > startY, "roll must travel toward the mouse pointer");
  assert.ok(Math.abs(fighter.x - startX) < 2, "opposite movement key must not steer the roll");
});

test("jump attack uses a deliberately narrow short-range cone", () => {
  assert.equal(COMBAT.jumpAttack.reach, 48);
  assert.equal(COMBAT.jumpAttack.arcRadians, Math.PI * 0.24);

  const farWorld = duel({ distance: 70 });
  const [farAttacker, farTarget] = farWorld.fighters;
  stepWorld(farWorld, { a: { jump: true, aimX: farTarget.x, aimY: farTarget.y } }, 5);
  stepWorld(farWorld, { a: { attack: true, aimX: farTarget.x, aimY: farTarget.y } }, 5);
  advance(farWorld, COMBAT.jumpAttack.windupMs + COMBAT.jumpAttack.activeMs + 10, {
    a: { aimX: farTarget.x, aimY: farTarget.y },
  });
  assert.equal(farTarget.hp, 100, "target just outside the short jump-attack reach must be safe");

  const angledAttacker = createFighter({ id: "a", x: 200, y: 200, facing: 0 });
  const angledTarget = createFighter({
    id: "b",
    x: 200 + Math.cos(Math.PI / 6) * 60,
    y: 200 + Math.sin(Math.PI / 6) * 60,
    facing: Math.PI,
  });
  const angledWorld = createWorld({ width: 600, height: 400, fighters: [angledAttacker, angledTarget] });
  stepWorld(angledWorld, { a: { jump: true, aimX: 400, aimY: 200 } }, 5);
  stepWorld(angledWorld, { a: { attack: true, aimX: 400, aimY: 200 } }, 5);
  advance(angledWorld, COMBAT.jumpAttack.windupMs + COMBAT.jumpAttack.activeMs + 10, {
    a: { aimX: 400, aimY: 200 },
  });
  assert.equal(angledTarget.hp, 100, "30-degree offset must miss the narrow jump-attack cone");
});

test("successful parry leaves a comfortable real light punish window", () => {
  const world = duel();
  const [a, b] = world.fighters;
  advance(world, COMBAT.attack.windupMs - 25, {
    a: { attack: true, aimX: b.x, aimY: b.y },
  });
  const parryEvents = advance(world, 45, {
    a: { aimX: b.x, aimY: b.y },
    b: { block: true, aimX: a.x, aimY: a.y },
  });
  assert.ok(parryEvents.some((event) => event.type === "parry"));
  assert.equal(a.action, "stunned");

  stepWorld(world, { b: { aimX: a.x, aimY: a.y } }, 5);
  stepWorld(world, { b: { attack: true, aimX: a.x, aimY: a.y } }, 5);
  const punishEvents = advance(world, COMBAT.attack.windupMs + COMBAT.attack.activeMs + 10, {
    b: { aimX: a.x, aimY: a.y },
  });
  assert.equal(a.hp, 66);
  assert.ok(punishEvents.some((event) => event.type === "hit"));
  assert.equal(a.action, "stunned");
});



test("early wheel-back feints a light attack into stamina-costing recovery", () => {
  const world = duel({ distance: 60 });
  const [a, b] = world.fighters;
  stepWorld(world, { a: { attack: true, aimX: b.x, aimY: b.y } }, 5);
  advance(world, 40, { a: { aimX: b.x, aimY: b.y } });
  assert.equal(a.action, "attack_windup");

  stepWorld(world, { a: { block: true, aimX: b.x, aimY: b.y } }, 5);
  assert.equal(a.action, "feint_recovery");
  assert.equal(a.stamina, COMBAT.stamina.max - COMBAT.feint.staminaCost);

  advance(world, COMBAT.feint.recoveryMs + 20, { a: { aimX: b.x, aimY: b.y } });
  assert.equal(a.action, "idle");
  assert.equal(b.hp, 100);
});

test("late wheel-back cannot cancel a committed heavy strike", () => {
  const world = duel({ distance: 60 });
  const [a, b] = world.fighters;
  stepWorld(world, { a: { heavyAttack: true, aimX: b.x, aimY: b.y } }, 5);
  advance(world, COMBAT.feint.heavyWindowMs + 25, { a: { aimX: b.x, aimY: b.y } });
  assert.equal(a.action, "heavy_attack_windup");

  stepWorld(world, { a: { block: true, aimX: b.x, aimY: b.y } }, 5);
  assert.equal(a.action, "heavy_attack_windup");
  assert.equal(a.stamina, COMBAT.stamina.max);
});

test("feint is unavailable when stamina cannot pay its cost", () => {
  const world = duel({ distance: 60 });
  const [a, b] = world.fighters;
  a.stamina = COMBAT.feint.staminaCost - 1;
  stepWorld(world, { a: { attack: true, aimX: b.x, aimY: b.y } }, 5);
  stepWorld(world, { a: { block: true, aimX: b.x, aimY: b.y } }, 5);
  assert.equal(a.action, "attack_windup");
});

test("kick knockdown is a bounded fallen state that restores control", () => {
  const world = duel({ distance: 54 });
  const [a, b] = world.fighters;
  advance(world, COMBAT.kick.windupMs + COMBAT.kick.activeMs + 10, {
    a: { kick: true, aimX: b.x, aimY: b.y },
  });
  assert.equal(b.action, "knockdown");
  advance(world, 250);
  assert.equal(b.action, "knockdown");
  advance(world, 70);
  assert.equal(b.action, "idle");
  assert.equal(b.hp, 100);
});

test("knockdown ignores player movement input until recovery", () => {
  const world = duel({ distance: 54 });
  const [a, b] = world.fighters;
  advance(world, COMBAT.kick.windupMs + COMBAT.kick.activeMs + 10, {
    a: { kick: true, aimX: b.x, aimY: b.y },
  });
  assert.equal(b.action, "knockdown");
  const fallenX = b.x;
  const fallenY = b.y;
  const fallenFacing = b.facing;
  advance(world, 100, { b: { moveX: 1, moveY: 1, aimX: b.x + 200, aimY: b.y } });
  assert.equal(b.action, "knockdown");
  assert.equal(b.x, fallenX);
  assert.equal(b.y, fallenY);
  assert.equal(b.facing, fallenFacing);

});


test("sprint plus movement plus light attack becomes a stamina-costing running strike", () => {
  const world = duel({ distance: 200 });
  const [a] = world.fighters;
  stepWorld(world, {
    a: { moveX: 1, run: true, attack: true, aimX: 400, aimY: 200 },
  }, 5);
  assert.equal(a.action, "running_attack_windup");
  assert.equal(a.stamina, COMBAT.stamina.max - COMBAT.runningAttack.staminaCost);

  advance(world, COMBAT.runningAttack.windupMs, {
    a: { moveX: 1, run: true, aimX: 400, aimY: 200 },
  });
  assert.equal(a.action, "running_attack_active");

  advance(world, COMBAT.runningAttack.activeMs, {
    a: { moveX: 1, run: true, aimX: 400, aimY: 200 },
  });
  assert.equal(a.action, "running_attack_recovery");

  advance(world, COMBAT.runningAttack.recoveryMs, {
    a: { moveX: 1, run: true, aimX: 400, aimY: 200 },
  });
  assert.equal(a.action, "idle");
});

test("running strike converts sprint momentum into longer-range pressure", () => {
  const runWorld = duel({ distance: 120 });
  const [runner, runTarget] = runWorld.fighters;
  const runEvents = advance(
    runWorld,
    COMBAT.runningAttack.windupMs + COMBAT.runningAttack.activeMs + 10,
    { a: { moveX: 1, run: true, attack: true, aimX: runTarget.x, aimY: runTarget.y } },
  );
  assert.equal(runTarget.hp, 70);
  assert.equal(runEvents.find((event) => event.type === "hit")?.damage, 30);
  assert.ok(runner.x > runner.spawnX);

  const lightWorld = duel({ distance: 120 });
  const [, lightTarget] = lightWorld.fighters;
  advance(
    lightWorld,
    COMBAT.attack.windupMs + COMBAT.attack.activeMs + 10,
    { a: { attack: true, aimX: lightTarget.x, aimY: lightTarget.y } },
  );
  assert.equal(lightTarget.hp, 100);
});

test("run without meaningful movement keeps light attack semantics", () => {
  const world = duel({ distance: 72 });
  const [a, b] = world.fighters;
  stepWorld(world, {
    a: { run: true, attack: true, aimX: b.x, aimY: b.y },
  }, 5);
  assert.equal(a.action, "attack_windup");
  assert.equal(a.stamina, COMBAT.stamina.max);
});


test("strafe-selected left sweep trades center coverage for a shifted attack lane", () => {
  const attacker = createFighter({ id: "a", x: 200, y: 200, facing: 0 });
  const angle = -80 * Math.PI / 180;
  const target = createFighter({
    id: "b",
    x: 200 + Math.cos(angle) * 70,
    y: 200 + Math.sin(angle) * 70,
    facing: Math.PI,
  });
  const world = createWorld({ width: 600, height: 400, fighters: [attacker, target] });

  stepWorld(world, {
    a: { moveY: -1, attack: true, aimX: 400, aimY: 200 },
  }, 5);
  assert.equal(attacker.action, "attack_left_windup");

  const events = advance(
    world,
    COMBAT.directionalAttack.windupMs + COMBAT.directionalAttack.activeMs + 10,
    { a: { aimX: 400, aimY: 200 } },
  );
  assert.equal(target.hp, 66);
  assert.equal(events.find((event) => event.type === "hit")?.damage, 34);

  const neutralAttacker = createFighter({ id: "a", x: 200, y: 200, facing: 0 });
  const neutralTarget = createFighter({
    id: "b",
    x: 200 + Math.cos(angle) * 70,
    y: 200 + Math.sin(angle) * 70,
    facing: Math.PI,
  });
  const neutralWorld = createWorld({ width: 600, height: 400, fighters: [neutralAttacker, neutralTarget] });
  advance(
    neutralWorld,
    COMBAT.attack.windupMs + COMBAT.attack.activeMs + 15,
    { a: { attack: true, aimX: 400, aimY: 200 } },
  );
  assert.equal(neutralTarget.hp, 100);
});

test("opposite strafe selects the mirrored right sweep", () => {
  const world = duel({ distance: 200 });
  const [attacker] = world.fighters;
  stepWorld(world, {
    a: { moveY: 1, attack: true, aimX: 400, aimY: 200 },
  }, 5);
  assert.equal(attacker.action, "attack_right_windup");
});

test("directional light remains feintable only through the normal early light window", () => {
  const world = duel({ distance: 200 });
  const [attacker] = world.fighters;
  stepWorld(world, {
    a: { moveY: -1, attack: true, aimX: 400, aimY: 200 },
  }, 5);
  assert.equal(attacker.action, "attack_left_windup");

  advance(world, 30, { a: { aimX: 400, aimY: 200 } });
  stepWorld(world, { a: { block: true, aimX: 400, aimY: 200 } }, 5);
  assert.equal(attacker.action, "feint_recovery");
  assert.equal(attacker.stamina, COMBAT.stamina.max - COMBAT.feint.staminaCost);
});


test("late light tap buffers through the full recovery", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "attack_recovery");
  assert.equal(attacker.actionElapsedMs, COMBAT.attack.recoveryMs - 85);

  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.action, "attack_recovery");
  assert.equal(attacker.bufferedLightAttack, true);

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  advance(world, 75, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "attack_windup");
  assert.equal(attacker.actionElapsedMs, 0);
  assert.equal(attacker.bufferedLightAttack, false);
});
test("early recovery tap is not buffered", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, 100, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedLightAttack, false);

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  advance(world, COMBAT.attack.recoveryMs - 110, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "idle");
});

test("buffered light preserves the directional lane chosen on tap", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { attack: true, moveY: -1, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedAttackLateral, 1);
  stepWorld(world, { a: { moveY: 1, aimX: target.x, aimY: target.y } }, 5);
  advance(world, 75, { a: { moveY: 1, aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "attack_left_windup");
});

test("late fresh block buffers through light recovery and starts parry on completion", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { block: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.action, "attack_recovery");
  assert.equal(attacker.bufferedBlock, true);

  advance(world, 80, { a: { block: true, aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "block");
  assert.equal(attacker.actionElapsedMs, 0);
  assert.equal(attacker.bufferedBlock, false);
});

test("block pressed too early is not promoted into a free recovery parry", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, 100, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { block: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedBlock, false);

  advance(world, 150, { a: { block: true, aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "idle");
});

test("later defensive intent overrides a buffered light attack", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedLightAttack, true);
  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  stepWorld(world, { a: { block: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedLightAttack, false);
  assert.equal(attacker.bufferedBlock, true);

  advance(world, 70, { a: { block: true, aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "block");
});

test("late wheel-forward buffers through full light recovery and preserves pointer direction", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, {
    a: { dodge: true, aimX: attacker.x, aimY: attacker.y + 100 },
  }, 5);
  assert.equal(attacker.action, "attack_recovery");
  assert.equal(attacker.bufferedDodge, true);
  assert.equal(attacker.stamina, COMBAT.stamina.max);
  assert.ok(Math.abs(attacker.bufferedDodgeDirX) < 1e-9);
  assert.ok(Math.abs(attacker.bufferedDodgeDirY - 1) < 1e-9);

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  advance(world, 75, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "dodge");
  assert.equal(attacker.stamina, COMBAT.stamina.max - COMBAT.dodge.staminaCost);
  assert.ok(Math.abs(attacker.dodgeDirX) < 1e-9);
  assert.ok(Math.abs(attacker.dodgeDirY - 1) < 1e-9);

  const beforeY = attacker.y;
  advance(world, 20, { a: { aimX: target.x, aimY: target.y } });
  assert.ok(attacker.y > beforeY);
});

test("early held wheel-forward is not promoted into a free recovery roll", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, 100, { a: { aimX: target.x, aimY: target.y } });
  const heldRoll = { a: { dodge: true, aimX: attacker.x, aimY: attacker.y + 100 } };
  stepWorld(world, heldRoll, 5);
  assert.equal(attacker.bufferedDodge, false);

  advance(world, 150, heldRoll);
  assert.equal(attacker.action, "idle");
  assert.equal(attacker.stamina, COMBAT.stamina.max);

  stepWorld(world, heldRoll, 5);
  assert.equal(attacker.action, "idle");
  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  stepWorld(world, heldRoll, 5);
  assert.equal(attacker.action, "dodge");
});

test("later roll intent overrides a buffered light attack", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedLightAttack, true);
  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  stepWorld(world, {
    a: { dodge: true, aimX: attacker.x, aimY: attacker.y + 100 },
  }, 5);
  assert.equal(attacker.bufferedLightAttack, false);
  assert.equal(attacker.bufferedDodge, true);

  advance(world, 70, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "dodge");
  assert.equal(attacker.stamina, COMBAT.stamina.max - COMBAT.dodge.staminaCost);
});

test("late fresh jump buffers through full light recovery and charges stamina on execution", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { jump: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.action, "attack_recovery");
  assert.equal(attacker.bufferedJump, true);
  assert.equal(attacker.stamina, COMBAT.stamina.max);

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  advance(world, 75, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "jump");
  assert.equal(attacker.actionElapsedMs, 0);
  assert.equal(attacker.bufferedJump, false);
  assert.equal(attacker.stamina, COMBAT.stamina.max - COMBAT.jump.staminaCost);
});

test("early held jump is not promoted and held Space does not auto-bunny-hop", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, 100, { a: { aimX: target.x, aimY: target.y } });
  const heldJump = { a: { jump: true, aimX: target.x, aimY: target.y } };
  stepWorld(world, heldJump, 5);
  assert.equal(attacker.bufferedJump, false);

  advance(world, 150, heldJump);
  assert.equal(attacker.action, "idle");
  assert.equal(attacker.stamina, COMBAT.stamina.max);

  stepWorld(world, heldJump, 5);
  assert.equal(attacker.action, "idle");

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  stepWorld(world, heldJump, 5);
  assert.equal(attacker.action, "jump");
  assert.equal(attacker.stamina, COMBAT.stamina.max - COMBAT.jump.staminaCost);
});

test("later jump intent overrides a buffered light attack", () => {
  const world = duel({ distance: 200 });
  const { attacker, target } = enterLightRecovery(world);

  advance(world, COMBAT.attack.recoveryMs - 85, { a: { aimX: target.x, aimY: target.y } });
  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedLightAttack, true);

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  stepWorld(world, { a: { jump: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.bufferedLightAttack, false);
  assert.equal(attacker.bufferedJump, true);

  advance(world, 70, { a: { aimX: target.x, aimY: target.y } });
  assert.equal(attacker.action, "jump");
  assert.equal(attacker.stamina, COMBAT.stamina.max - COMBAT.jump.staminaCost);
});

test("holding light does not auto-chain after recovery", () => {
  const world = duel({ distance: 200 });
  const [attacker, target] = world.fighters;

  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  advance(
    world,
    COMBAT.attack.windupMs - 5 + COMBAT.attack.activeMs + COMBAT.attack.recoveryMs,
    { a: { attack: true, aimX: target.x, aimY: target.y } },
  );
  assert.equal(attacker.action, "idle");

  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.action, "idle");

  stepWorld(world, { a: { aimX: target.x, aimY: target.y } }, 5);
  stepWorld(world, { a: { attack: true, aimX: target.x, aimY: target.y } }, 5);
  assert.equal(attacker.action, "attack_windup");
});
