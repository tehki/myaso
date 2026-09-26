const EPSILON = 1e-9;

const THREAT_WINDUPS = new Set([
  "attack_windup",
  "heavy_attack_windup",
  "jump_attack_windup",
]);

const PUNISHABLE_ACTIONS = new Set([
  "attack_recovery",
  "heavy_attack_recovery",
  "kick_recovery",
  "jump_attack_recovery",
  "feint_recovery",
  "stunned",
]);

export function createSparringAi() {
  let blockUntilMs = 0;
  let nextActionAtMs = 0;
  let jumpAttackArmed = false;

  const output = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    attack: false,
    heavyAttack: false,
    block: false,
    dodge: false,
    kick: false,
    run: false,
    jump: false,
  };

  function sample({ nowMs, self, opponent }) {
    clearOutput(output);
    if (!Number.isFinite(nowMs) || !self || !opponent) return output;

    output.aimX = opponent.x;
    output.aimY = opponent.y;
    if (self.action === "dead" || opponent.action === "dead") return output;

    const dx = opponent.x - self.x;
    const dy = opponent.y - self.y;
    const distance = Math.hypot(dx, dy);
    const safeDistance = distance > EPSILON ? distance : 1;
    const nx = dx / safeDistance;
    const ny = dy / safeDistance;
    const side = Math.sin(nowMs / 620) >= 0 ? 1 : -1;
    const stamina = Number.isFinite(self.stamina) ? self.stamina : 100;

    if (self.action === "jump" && jumpAttackArmed) {
      output.attack = true;
      jumpAttackArmed = false;
      return output;
    }

    if (self.action !== "idle" && self.action !== "block") return output;

    if (blockUntilMs > nowMs) {
      output.block = true;
      return output;
    }

    if (THREAT_WINDUPS.has(opponent.action) && distance < 118 && nowMs >= nextActionAtMs) {
      const read = Math.floor(nowMs / 480) % 3;
      if (read === 0) {
        blockUntilMs = nowMs + 220;
        nextActionAtMs = nowMs + 380;
        output.block = true;
        return output;
      }
      if (read === 1 && stamina >= 32) {
        output.dodge = true;
        nextActionAtMs = nowMs + 430;
        return output;
      }
      output.moveX = -nx;
      output.moveY = -ny;
      nextActionAtMs = nowMs + 240;
      return output;
    }

    if (distance > 185) {
      output.moveX = nx;
      output.moveY = ny;
      output.run = stamina >= 26;
      return output;
    }

    if (stamina < 16) {
      output.moveX = -nx * 0.62 - ny * side * 0.34;
      output.moveY = -ny * 0.62 + nx * side * 0.34;
      return output;
    }

    if (PUNISHABLE_ACTIONS.has(opponent.action) && distance <= 72 && nowMs >= nextActionAtMs) {
      output.attack = true;
      nextActionAtMs = nowMs + 520;
      return output;
    }

    if (distance > 76) {
      output.moveX = nx * 0.58 - ny * side * 0.42;
      output.moveY = ny * 0.58 + nx * side * 0.42;
      return output;
    }

    if (distance < 44) {
      output.moveX = -nx * 0.58 - ny * side * 0.32;
      output.moveY = -ny * 0.58 + nx * side * 0.32;
    } else {
      output.moveX = -ny * side * 0.38;
      output.moveY = nx * side * 0.38;
    }

    if (nowMs < nextActionAtMs) return output;

    if (opponent.action === "block" && distance <= 66 && stamina >= 20) {
      output.kick = true;
      nextActionAtMs = nowMs + 620;
      return output;
    }

    const cycle = Math.floor(nowMs / 760) % 4;
    if (cycle === 0) {
      output.attack = true;
      nextActionAtMs = nowMs + 560;
    } else if (cycle === 1 && stamina >= 20) {
      output.kick = true;
      nextActionAtMs = nowMs + 620;
    } else if (cycle === 2 && stamina >= 32 && distance <= 64) {
      output.jump = true;
      jumpAttackArmed = true;
      nextActionAtMs = nowMs + 780;
    } else {
      output.heavyAttack = true;
      nextActionAtMs = nowMs + 920;
    }
    return output;
  }

  return {
    sample,
    reset() {
      blockUntilMs = 0;
      nextActionAtMs = 0;
      jumpAttackArmed = false;
      clearOutput(output);
    },
  };
}

function clearOutput(output) {
  output.moveX = 0;
  output.moveY = 0;
  output.attack = false;
  output.heavyAttack = false;
  output.block = false;
  output.dodge = false;
  output.kick = false;
  output.run = false;
  output.jump = false;
}
