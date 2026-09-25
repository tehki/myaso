export const COMBAT = Object.freeze({
  fighterRadius: 18,
  moveSpeed: 215,
  attack: Object.freeze({
    windupMs: 135,
    activeMs: 80,
    recoveryMs: 255,
    reach: 76,
    arcRadians: Math.PI * 0.78,
    damage: 34,
    knockback: 18,
    guardDamage: 38,
  }),
  heavyAttack: Object.freeze({
    windupMs: 320,
    activeMs: 100,
    recoveryMs: 420,
    reach: 82,
    arcRadians: Math.PI * 0.68,
    damage: 46,
    knockback: 28,
    guardDamage: 64,
  }),
  dodge: Object.freeze({
    durationMs: 170,
    recoveryMs: 180,
    speed: 690,
    iframeMs: 125,
    staminaCost: 28,
    collisionStunMs: 260,
    collisionKnockback: 34,
  }),
  kick: Object.freeze({
    windupMs: 90,
    activeMs: 70,
    recoveryMs: 220,
    reach: 48,
    arcRadians: Math.PI * 0.62,
    stunMs: 360,
    knockback: 52,
    blockedGuardDamage: 30,
    staminaCost: 18,
  }),
  jump: Object.freeze({
    durationMs: 430,
    staminaCost: 14,
    moveMultiplier: 1.08,
  }),
  jumpAttack: Object.freeze({
    windupMs: 105,
    activeMs: 105,
    recoveryMs: 290,
    reach: 88,
    arcRadians: Math.PI * 0.82,
    damage: 42,
    knockback: 34,
    guardDamage: 52,
    staminaCost: 12,
  }),
  block: Object.freeze({
    parryWindowMs: 125,
    shortBlockMs: 240,
    halfAngleRadians: Math.PI * 0.46,
    guardDamage: 38,
    guardBreakStunMs: 520,
    parryStunMs: 650,
    moveMultiplier: 0.42,
  }),
  stamina: Object.freeze({
    max: 100,
    regenPerSecond: 30,
    regenDelayMs: 360,
    runDrainPerSecond: 24,
    runMoveMultiplier: 1.55,
  }),
  guard: Object.freeze({
    max: 100,
    regenPerSecond: 24,
    regenDelayMs: 520,
  }),
  respawnMs: 1250,
});

const EPSILON = 1e-9;

export function createFighter({ id, x, y, facing = 0, spawnX = x, spawnY = y }) {
  return {
    id,
    x,
    y,
    spawnX,
    spawnY,
    facing,
    hp: 100,
    guard: COMBAT.guard.max,
    stamina: COMBAT.stamina.max,
    action: "idle",
    actionElapsedMs: 0,
    actionDurationMs: 0,
    dodgeDirX: 0,
    dodgeDirY: 0,
    attackHitTargets: new Set(),
    rollHitTargets: new Set(),
    guardRegenBlockedUntilMs: 0,
    staminaRegenBlockedUntilMs: 0,
    respawnAtMs: 0,
  };
}

export function createWorld({ width = 960, height = 540, fighters = [] } = {}) {
  return { width, height, nowMs: 0, fighters };
}

export function stepWorld(world, inputs = {}, dtMs = 1000 / 120) {
  if (!Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 100) {
    throw new RangeError("dtMs must be finite and in (0, 100]");
  }

  world.nowMs += dtMs;
  const events = [];

  for (const fighter of world.fighters) {
    if (fighter.action === "dead") {
      if (world.nowMs >= fighter.respawnAtMs) {
        respawnFighter(fighter);
        events.push({ type: "respawn", fighterId: fighter.id });
      }
      continue;
    }

    const input = normalizeInput(inputs[fighter.id]);
    updateFacing(fighter, input);
    beginRequestedAction(world, fighter, input);
    moveFighter(world, fighter, input, dtMs);
    advanceAction(fighter, input, dtMs);
    updateStamina(world, fighter, input, dtMs);

    if (fighter.action !== "block" && world.nowMs >= fighter.guardRegenBlockedUntilMs) {
      fighter.guard = Math.min(
        COMBAT.guard.max,
        fighter.guard + (COMBAT.guard.regenPerSecond * dtMs) / 1000,
      );
    }
  }

  resolveRollCollisions(world, events);
  separateFighters(world);
  resolveAttacks(world, events);
  return events;
}

function normalizeInput(input = {}) {
  const moveX = Number.isFinite(input.moveX) ? input.moveX : 0;
  const moveY = Number.isFinite(input.moveY) ? input.moveY : 0;
  const moveLength = Math.hypot(moveX, moveY);
  return {
    moveX: moveLength > 1 ? moveX / moveLength : moveX,
    moveY: moveLength > 1 ? moveY / moveLength : moveY,
    aimX: Number.isFinite(input.aimX) ? input.aimX : null,
    aimY: Number.isFinite(input.aimY) ? input.aimY : null,
    attack: Boolean(input.attack),
    heavyAttack: Boolean(input.heavyAttack),
    dodge: Boolean(input.dodge || input.roll),
    block: Boolean(input.block || input.parry),
    kick: Boolean(input.kick),
    run: Boolean(input.run),
    jump: Boolean(input.jump),
  };
}

function updateFacing(fighter, input) {
  if (input.aimX === null || input.aimY === null) return;
  const dx = input.aimX - fighter.x;
  const dy = input.aimY - fighter.y;
  if (Math.hypot(dx, dy) > EPSILON) fighter.facing = Math.atan2(dy, dx);
}

function beginRequestedAction(world, fighter, input) {
  if (fighter.action === "jump" && input.attack && spendStamina(world, fighter, COMBAT.jumpAttack.staminaCost)) {
    fighter.attackHitTargets.clear();
    setAction(fighter, "jump_attack_windup", COMBAT.jumpAttack.windupMs);
    return;
  }

  const canInterrupt = fighter.action === "idle" || fighter.action === "block";
  if (!canInterrupt) return;

  if (input.dodge && spendStamina(world, fighter, COMBAT.dodge.staminaCost)) {
    const moveLength = Math.hypot(input.moveX, input.moveY);
    fighter.dodgeDirX = moveLength > EPSILON ? input.moveX / moveLength : Math.cos(fighter.facing);
    fighter.dodgeDirY = moveLength > EPSILON ? input.moveY / moveLength : Math.sin(fighter.facing);
    fighter.rollHitTargets.clear();
    setAction(fighter, "dodge", COMBAT.dodge.durationMs);
    return;
  }

  if (input.kick && fighter.action === "idle" && spendStamina(world, fighter, COMBAT.kick.staminaCost)) {
    fighter.attackHitTargets.clear();
    setAction(fighter, "kick_windup", COMBAT.kick.windupMs);
    return;
  }

  if (input.jump && fighter.action === "idle" && spendStamina(world, fighter, COMBAT.jump.staminaCost)) {
    setAction(fighter, "jump", COMBAT.jump.durationMs);
    return;
  }

  if (input.heavyAttack && fighter.action === "idle") {
    fighter.attackHitTargets.clear();
    setAction(fighter, "heavy_attack_windup", COMBAT.heavyAttack.windupMs);
    return;
  }

  if (input.attack && fighter.action === "idle") {
    fighter.attackHitTargets.clear();
    setAction(fighter, "attack_windup", COMBAT.attack.windupMs);
    return;
  }

  if (input.block) {
    if (fighter.action !== "block") setAction(fighter, "block", Number.POSITIVE_INFINITY);
  } else if (fighter.action === "block") {
    setAction(fighter, "idle", 0);
  }
}

function moveFighter(world, fighter, input, dtMs) {
  let velocityX = input.moveX * COMBAT.moveSpeed;
  let velocityY = input.moveY * COMBAT.moveSpeed;
  if (input.run && fighter.action === "idle" && fighter.stamina > EPSILON) {
    velocityX *= COMBAT.stamina.runMoveMultiplier;
    velocityY *= COMBAT.stamina.runMoveMultiplier;
  }

  if (fighter.action === "dodge") {
    velocityX = fighter.dodgeDirX * COMBAT.dodge.speed;
    velocityY = fighter.dodgeDirY * COMBAT.dodge.speed;
  } else if (fighter.action === "block") {
    velocityX *= COMBAT.block.moveMultiplier;
    velocityY *= COMBAT.block.moveMultiplier;
  } else if (fighter.action === "jump") {
    velocityX *= COMBAT.jump.moveMultiplier;
    velocityY *= COMBAT.jump.moveMultiplier;
  } else if (fighter.action === "jump_attack_windup") {
    velocityX *= 0.9;
    velocityY *= 0.9;
  } else if (fighter.action === "jump_attack_active") {
    velocityX *= 0.55;
    velocityY *= 0.55;
  } else if (fighter.action === "kick_windup") {
    velocityX *= 0.45;
    velocityY *= 0.45;
  } else if (fighter.action === "kick_active") {
    velocityX *= 0.2;
    velocityY *= 0.2;
  } else if (fighter.action === "attack_windup") {
    velocityX *= 0.35;
    velocityY *= 0.35;
  } else if (fighter.action === "heavy_attack_windup") {
    velocityX *= 0.20;
    velocityY *= 0.20;
  } else if (fighter.action === "attack_active" || fighter.action === "heavy_attack_active") {
    velocityX = 0;
    velocityY = 0;
  } else if (fighter.action === "attack_recovery" || fighter.action === "dodge_recovery") {
    velocityX *= 0.48;
    velocityY *= 0.48;
  } else if (fighter.action === "heavy_attack_recovery") {
    velocityX *= 0.35;
    velocityY *= 0.35;
  } else if (fighter.action === "kick_recovery" || fighter.action === "jump_attack_recovery") {
    velocityX *= 0.42;
    velocityY *= 0.42;
  } else if (fighter.action === "stunned") {
    velocityX = 0;
    velocityY = 0;
  }

  const seconds = dtMs / 1000;
  const radius = COMBAT.fighterRadius;
  fighter.x = clamp(fighter.x + velocityX * seconds, radius, world.width - radius);
  fighter.y = clamp(fighter.y + velocityY * seconds, radius, world.height - radius);
}

function advanceAction(fighter, input, dtMs) {
  if (fighter.action === "idle" || fighter.action === "dead") return;
  fighter.actionElapsedMs += dtMs;

  if (fighter.action === "block") {
    if (!input.block) setAction(fighter, "idle", 0);
    return;
  }

  if (fighter.actionElapsedMs + EPSILON < fighter.actionDurationMs) return;

  switch (fighter.action) {
    case "attack_windup":
      setAction(fighter, "attack_active", COMBAT.attack.activeMs);
      break;
    case "attack_active":
      setAction(fighter, "attack_recovery", COMBAT.attack.recoveryMs);
      break;
    case "attack_recovery":
      setAction(fighter, "idle", 0);
      break;
    case "heavy_attack_windup":
      setAction(fighter, "heavy_attack_active", COMBAT.heavyAttack.activeMs);
      break;
    case "heavy_attack_active":
      setAction(fighter, "heavy_attack_recovery", COMBAT.heavyAttack.recoveryMs);
      break;
    case "heavy_attack_recovery":
      setAction(fighter, "idle", 0);
      break;
    case "dodge":
      setAction(fighter, "dodge_recovery", COMBAT.dodge.recoveryMs);
      break;
    case "dodge_recovery":
    case "jump":
      setAction(fighter, "idle", 0);
      break;
    case "kick_windup":
      setAction(fighter, "kick_active", COMBAT.kick.activeMs);
      break;
    case "kick_active":
      setAction(fighter, "kick_recovery", COMBAT.kick.recoveryMs);
      break;
    case "kick_recovery":
      setAction(fighter, "idle", 0);
      break;
    case "jump_attack_windup":
      setAction(fighter, "jump_attack_active", COMBAT.jumpAttack.activeMs);
      break;
    case "jump_attack_active":
      setAction(fighter, "jump_attack_recovery", COMBAT.jumpAttack.recoveryMs);
      break;
    case "jump_attack_recovery":
    case "stunned":
      setAction(fighter, "idle", 0);
      break;
    default:
      break;
  }
}

function separateFighters(world) {
  const minimumDistance = COMBAT.fighterRadius * 2;
  for (let i = 0; i < world.fighters.length; i += 1) {
    const a = world.fighters[i];
    if (a.action === "dead") continue;
    for (let j = i + 1; j < world.fighters.length; j += 1) {
      const b = world.fighters[j];
      if (b.action === "dead") continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      if (distance >= minimumDistance) continue;
      if (distance <= EPSILON) {
        dx = Math.cos(a.facing);
        dy = Math.sin(a.facing);
        distance = 1;
      }
      const overlap = minimumDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      const shift = overlap / 2;
      const radius = COMBAT.fighterRadius;
      a.x = clamp(a.x - nx * shift, radius, world.width - radius);
      a.y = clamp(a.y - ny * shift, radius, world.height - radius);
      b.x = clamp(b.x + nx * shift, radius, world.width - radius);
      b.y = clamp(b.y + ny * shift, radius, world.height - radius);
    }
  }
}

function attackProfile(action) {
  if (action === "attack_active") return { ...COMBAT.attack, kind: "attack" };
  if (action === "heavy_attack_active") return { ...COMBAT.heavyAttack, kind: "heavy" };
  if (action === "jump_attack_active") return { ...COMBAT.jumpAttack, kind: "jump_attack" };
  if (action === "kick_active") return { ...COMBAT.kick, kind: "kick" };
  return null;
}

function resolveAttacks(world, events) {
  for (const attacker of world.fighters) {
    const profile = attackProfile(attacker.action);
    if (!profile || attacker.action === "dead") continue;

    for (const target of world.fighters) {
      if (target.id === attacker.id || target.action === "dead" || attacker.attackHitTargets.has(target.id)) continue;
      if (!isTargetInAttackArc(attacker, target, profile)) continue;

      attacker.attackHitTargets.add(target.id);

      if (isInvulnerable(target)) {
        events.push({ type: "evade", attackerId: attacker.id, targetId: target.id });
        continue;
      }

      if (isBlockingAttack(target, attacker)) {
        target.guardRegenBlockedUntilMs = world.nowMs + COMBAT.guard.regenDelayMs;

        if (target.actionElapsedMs <= COMBAT.block.parryWindowMs) {
          setAction(attacker, "stunned", COMBAT.block.parryStunMs);
          events.push({ type: "parry", attackerId: attacker.id, targetId: target.id });
          continue;
        }

        const guardDamage = profile.kind === "kick" ? COMBAT.kick.blockedGuardDamage : profile.guardDamage;
        target.guard = Math.max(0, target.guard - guardDamage);
        if (target.guard <= EPSILON) {
          setAction(target, "stunned", COMBAT.block.guardBreakStunMs);
          events.push({ type: "guard_break", attackerId: attacker.id, targetId: target.id });
        } else {
          events.push({ type: "block", attackerId: attacker.id, targetId: target.id });
        }
        continue;
      }

      if (profile.kind === "kick") {
        knockBack(world, attacker, target, profile.knockback);
        setAction(target, "stunned", COMBAT.kick.stunMs);
        events.push({ type: "kick", attackerId: attacker.id, targetId: target.id });
        continue;
      }

      target.hp = Math.max(0, target.hp - profile.damage);
      knockBack(world, attacker, target, profile.knockback);
      events.push({
        type: "hit",
        attackerId: attacker.id,
        targetId: target.id,
        damage: profile.damage,
        hp: target.hp,
        attackKind: profile.kind,
      });

      if (target.hp <= EPSILON) {
        target.action = "dead";
        target.actionElapsedMs = 0;
        target.actionDurationMs = 0;
        target.respawnAtMs = world.nowMs + COMBAT.respawnMs;
        events.push({ type: "death", fighterId: target.id, killerId: attacker.id });
      }
    }
  }
}

function spendStamina(world, fighter, amount) {
  if (fighter.stamina + EPSILON < amount) return false;
  fighter.stamina = Math.max(0, fighter.stamina - amount);
  fighter.staminaRegenBlockedUntilMs = world.nowMs + COMBAT.stamina.regenDelayMs;
  return true;
}

function updateStamina(world, fighter, input, dtMs) {
  if (input.run && fighter.action === "idle" && Math.hypot(input.moveX, input.moveY) > EPSILON && fighter.stamina > EPSILON) {
    fighter.stamina = Math.max(0, fighter.stamina - COMBAT.stamina.runDrainPerSecond * dtMs / 1000);
    fighter.staminaRegenBlockedUntilMs = world.nowMs + COMBAT.stamina.regenDelayMs;
    return;
  }
  if (world.nowMs >= fighter.staminaRegenBlockedUntilMs) {
    fighter.stamina = Math.min(COMBAT.stamina.max, fighter.stamina + COMBAT.stamina.regenPerSecond * dtMs / 1000);
  }
}

function resolveRollCollisions(world, events) {
  for (const roller of world.fighters) {
    if (roller.action !== "dodge") continue;
    for (const target of world.fighters) {
      if (target.id === roller.id || target.action === "dead" || roller.rollHitTargets.has(target.id)) continue;
      const dx = target.x - roller.x;
      const dy = target.y - roller.y;
      if (Math.hypot(dx, dy) > COMBAT.fighterRadius * 2 + 8) continue;
      roller.rollHitTargets.add(target.id);
      knockBack(world, roller, target, COMBAT.dodge.collisionKnockback);
      setAction(target, "stunned", COMBAT.dodge.collisionStunMs);
      events.push({ type: "roll_hit", attackerId: roller.id, targetId: target.id });
    }
  }
}

function isTargetInAttackArc(attacker, target, profile) {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const centerDistance = Math.hypot(dx, dy);
  const maxDistance = profile.reach + COMBAT.fighterRadius;
  if (centerDistance > maxDistance) return false;
  const angleToTarget = Math.atan2(dy, dx);
  return Math.abs(angleDelta(angleToTarget, attacker.facing)) <= profile.arcRadians / 2;
}

function isInvulnerable(target) {
  return target.action === "dodge" && target.actionElapsedMs <= COMBAT.dodge.iframeMs;
}

function isBlockingAttack(target, attacker) {
  if (target.action !== "block") return false;
  const angleToAttacker = Math.atan2(attacker.y - target.y, attacker.x - target.x);
  return Math.abs(angleDelta(angleToAttacker, target.facing)) <= COMBAT.block.halfAngleRadians;
}

function knockBack(world, attacker, target, distance) {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const length = Math.hypot(dx, dy) || 1;
  const radius = COMBAT.fighterRadius;
  target.x = clamp(target.x + (dx / length) * distance, radius, world.width - radius);
  target.y = clamp(target.y + (dy / length) * distance, radius, world.height - radius);
}

function respawnFighter(fighter) {
  fighter.x = fighter.spawnX;
  fighter.y = fighter.spawnY;
  fighter.hp = 100;
  fighter.guard = COMBAT.guard.max;
  fighter.stamina = COMBAT.stamina.max;
  fighter.respawnAtMs = 0;
  fighter.attackHitTargets.clear();
  fighter.rollHitTargets.clear();
  fighter.staminaRegenBlockedUntilMs = 0;
  setAction(fighter, "idle", 0);
}

function setAction(fighter, action, durationMs) {
  fighter.action = action;
  fighter.actionElapsedMs = 0;
  fighter.actionDurationMs = durationMs;
}

export function angleDelta(a, b) {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
