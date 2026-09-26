import { COMBAT, angleDelta } from "../combat/model.mjs";

export const COMBAT_ACTION = Object.freeze({
  idle: 0,
  attackWindup: 1,
  attackActive: 2,
  attackRecovery: 3,
  dodge: 4,
  dodgeRecovery: 5,
  block: 6,
  stunned: 7,
  dead: 8,
  heavyAttackWindup: 9,
  heavyAttackActive: 10,
  heavyAttackRecovery: 11,
  kickWindup: 12,
  kickActive: 13,
  kickRecovery: 14,
  jump: 15,
  jumpAttackWindup: 16,
  jumpAttackActive: 17,
  jumpAttackRecovery: 18,
  feintRecovery: 19,
});

const PRIORITY = Object.freeze({
  death: 100,
  respawn: 90,
  guardBreak: 80,
  controlImpact: 75,
  parry: 70,
  dodge: 65,
  block: 60,
  hit: 50,
  stun: 40,
});

export function createCombatReadabilityTracker() {
  const previous = new Map();
  let pendingDodge = null;
  return {
    observe(state, ownId) {
      if (!(state instanceof Map) || !ownId) return null;
      const current = new Map();
      for (const entity of state.values()) current.set(entity.netId, snapshot(entity));

      const own = current.get(ownId);
      const beforeOwn = previous.get(ownId);
      const peers = [...current.values()].filter((entity) => entity.netId !== ownId);
      const peer = peers.length === 1 ? peers[0] : null;
      const beforePeer = peer ? previous.get(peer.netId) : null;
      const candidates = [];

      if (own && beforeOwn) collectEntityEvents(candidates, beforeOwn, own, true);
      for (const entity of peers) {
        const before = previous.get(entity.netId);
        if (before) collectEntityEvents(candidates, before, entity, false);
      }
      if (own && beforeOwn && peer && beforePeer) {
        collectControlImpactEvents(candidates, beforeOwn, own, beforePeer, peer);
        collectParryEvents(candidates, beforeOwn, own, beforePeer, peer);
      }
      pendingDodge = own && peer
        ? collectDodgeEvents(candidates, own, peer, ownId, pendingDodge, beforeOwn, beforePeer)
        : null;

      previous.clear();
      for (const [netId, entity] of current) previous.set(netId, entity);
      candidates.sort((a, b) => b.priority - a.priority);
      return candidates[0] ?? null;
    },
    reset() { previous.clear(); pendingDodge = null; },
  };
}

export function createRemoteDamageTracker({ durationMs = 320 } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError("durationMs must be a positive finite number");
  }
  const previousHp = new Map();
  const activeUntil = new Map();

  return {
    observe(state, ownId, nowMs) {
      if (!(state instanceof Map) || !Number.isFinite(nowMs)) return;
      for (const entity of state.values()) {
        if (!entity || !Number.isFinite(entity.netId) || !Number.isFinite(entity.hp)) continue;
        const beforeHp = previousHp.get(entity.netId);
        if (entity.netId !== ownId && Number.isFinite(beforeHp) && entity.hp < beforeHp) {
          activeUntil.set(entity.netId, nowMs + durationMs);
        }
        previousHp.set(entity.netId, entity.hp);
      }
      for (const netId of previousHp.keys()) {
        if (!state.has(netId)) {
          previousHp.delete(netId);
          activeUntil.delete(netId);
        }
      }
      for (const [netId, until] of activeUntil) {
        if (until <= nowMs) activeUntil.delete(netId);
      }
    },
    visible(netId, nowMs) {
      return Number.isFinite(nowMs) && (activeUntil.get(netId) ?? Number.NEGATIVE_INFINITY) > nowMs;
    },
    reset() {
      previousHp.clear();
      activeUntil.clear();
    },
  };
}

export function combatActionHint(entity) {
  if (!entity) return null;
  switch (entity.action) {
    case COMBAT_ACTION.attackWindup:
      return "Attack committed - your windup is readable.";
    case COMBAT_ACTION.attackActive:
      return "Strike active - finish the commitment.";
    case COMBAT_ACTION.attackRecovery:
      return "Recovery - you can be punished now.";
    case COMBAT_ACTION.heavyAttackWindup:
      return "Heavy strike committed - the long windup is readable.";
    case COMBAT_ACTION.heavyAttackActive:
      return "Heavy strike active - finish the commitment.";
    case COMBAT_ACTION.heavyAttackRecovery:
      return "Heavy recovery - you are highly punishable now.";
    case COMBAT_ACTION.feintRecovery:
      return "Feint recovery - bait landed or failed; reset before committing again.";
    case COMBAT_ACTION.dodge:
      return "Dodging - use the movement to reset spacing.";
    case COMBAT_ACTION.block:
      return "Blocking - keep the threat in front of you.";
    case COMBAT_ACTION.stunned:
      return "Stunned - defend when control returns.";
    case COMBAT_ACTION.dead:
      return "Down - read the exchange before you respawn.";
    default:
      return null;
  }
}

export function opponentRecoveryPresentation(entity) {
  if (entity?.action === COMBAT_ACTION.attackRecovery) {
    return { visible: true, state: "attack-recovery", label: "PUNISH", detail: "Attack recovery" };
  }
  if (entity?.action === COMBAT_ACTION.heavyAttackRecovery) {
    return { visible: true, state: "heavy-attack-recovery", label: "PUNISH", detail: "Heavy recovery" };
  }
  if (entity?.action === COMBAT_ACTION.dodgeRecovery) {
    return { visible: true, state: "dodge-recovery", label: "PUNISH", detail: "Dodge recovery" };
  }
  if (entity?.action === COMBAT_ACTION.feintRecovery) {
    return { visible: true, state: "feint-recovery", label: "PUNISH", detail: "Feint recovery" };
  }
  return { visible: false, state: "", label: "", detail: "" };
}

export function parrySpatialPresentation(entity) {
  if (entity?.action === COMBAT_ACTION.stunned && entity.guard > 0) {
    return { visible: true, state: "parried" };
  }
  return { visible: false, state: "" };
}

export function blockSpatialPresentation(entity) {
  if (entity?.action === COMBAT_ACTION.block && Number.isFinite(entity.facing)) {
    return { visible: true, state: "blocking", facing: entity.facing };
  }
  return { visible: false, state: "", facing: 0 };
}

export function guardBreakSpatialPresentation(entity) {
  if (entity?.action === COMBAT_ACTION.stunned && entity.guard === 0) {
    return { visible: true, state: "guard-broken" };
  }
  return { visible: false, state: "" };
}

export function fighterVitalsPresentation(entity) {
  if (!entity || entity.action === COMBAT_ACTION.dead || !Number.isFinite(entity.hp) || !Number.isFinite(entity.guard)) {
    return { visible: false, hp: 0, guard: 0 };
  }
  return {
    visible: true,
    hp: Math.max(0, Math.min(100, entity.hp)),
    guard: Math.max(0, Math.min(100, entity.guard)),
  };
}

export function fighterIdentityPresentation(netId) {
  if (!Number.isInteger(netId) || netId <= 0) return { visible: false, label: "" };
  return { visible: true, label: `#${netId}` };
}

export function fighterThreatPhaseLabel(attacker) {
  if (attacker?.action === COMBAT_ACTION.heavyAttackActive) return "HEAVY STRIKE";
  if (attacker?.action === COMBAT_ACTION.heavyAttackWindup) return "HEAVY WINDUP";
  if (attacker?.action === COMBAT_ACTION.attackActive) return "STRIKE";
  if (attacker?.action === COMBAT_ACTION.attackWindup) return "WINDUP";
  return "";
}

export function fighterThreatGuardArcLabel(own, attacker) {
  if (!own || !attacker || !Number.isFinite(own.x) || !Number.isFinite(own.y)
    || !Number.isFinite(own.facing) || !Number.isFinite(attacker.x) || !Number.isFinite(attacker.y)) return "";
  const dx = attacker.x - own.x;
  const dy = attacker.y - own.y;
  if (dx === 0 && dy === 0) return "";
  const angleToAttacker = Math.atan2(dy, dx);
  return Math.abs(angleDelta(angleToAttacker, own.facing)) <= COMBAT.block.halfAngleRadians ? "FRONT" : "FLANK";
}

export function fighterThreatBearingLabel(own, attacker) {
  if (!own || !attacker || !Number.isFinite(own.x) || !Number.isFinite(own.y)
    || !Number.isFinite(attacker.x) || !Number.isFinite(attacker.y)) return "";
  const dx = attacker.x - own.x;
  const dy = attacker.y - own.y;
  if (dx === 0 && dy === 0) return "";
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "FROM LEFT" : "FROM RIGHT";
  return dy < 0 ? "FROM ABOVE" : "FROM BELOW";
}

export function fighterThreatNetId(state, ownId = 0, summary = null) {
  if (summary && typeof summary === "object") {
    summary.count = 0;
    summary.secondaryNetId = 0;
  }
  if (!(state instanceof Map) || !Number.isInteger(ownId) || ownId <= 0) return 0;
  const own = state.get(ownId);
  if (!own || own.action === COMBAT_ACTION.dead || !Number.isFinite(own.x) || !Number.isFinite(own.y)) return 0;
  let bestNetId = 0;
  let bestPriority = Infinity;
  let bestDistanceSquared = Infinity;
  let secondNetId = 0;
  let secondPriority = Infinity;
  let secondDistanceSquared = Infinity;
  let threatCount = 0;
  for (const entity of state.values()) {
    const active = entity?.action === COMBAT_ACTION.attackActive || entity?.action === COMBAT_ACTION.heavyAttackActive;
    const windup = entity?.action === COMBAT_ACTION.attackWindup || entity?.action === COMBAT_ACTION.heavyAttackWindup;
    const priority = active ? 0 : windup ? 1 : Infinity;
    const profile = entity?.action === COMBAT_ACTION.heavyAttackActive || entity?.action === COMBAT_ACTION.heavyAttackWindup
      ? COMBAT.heavyAttack
      : COMBAT.attack;
    if (!Number.isFinite(priority) || entity.netId === ownId || !Number.isInteger(entity.netId) || entity.netId <= 0
      || !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || !Number.isFinite(entity.facing)) continue;
    const dx = own.x - entity.x;
    const dy = own.y - entity.y;
    const distanceSquared = dx * dx + dy * dy;
    const maxDistance = profile.reach + COMBAT.fighterRadius;
    if (distanceSquared > maxDistance * maxDistance) continue;
    const angleToOwn = Math.atan2(dy, dx);
    let delta = angleToOwn - entity.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > profile.arcRadians / 2) continue;
    threatCount += 1;
    const betterThanBest = priority < bestPriority
      || (priority === bestPriority && (distanceSquared < bestDistanceSquared
        || (distanceSquared === bestDistanceSquared && (bestNetId === 0 || entity.netId < bestNetId))));
    if (betterThanBest) {
      secondNetId = bestNetId;
      secondPriority = bestPriority;
      secondDistanceSquared = bestDistanceSquared;
      bestNetId = entity.netId;
      bestPriority = priority;
      bestDistanceSquared = distanceSquared;
      continue;
    }
    if (priority < secondPriority
      || (priority === secondPriority && (distanceSquared < secondDistanceSquared
        || (distanceSquared === secondDistanceSquared && (secondNetId === 0 || entity.netId < secondNetId))))) {
      secondNetId = entity.netId;
      secondPriority = priority;
      secondDistanceSquared = distanceSquared;
    }
  }
  if (summary && typeof summary === "object") {
    summary.count = threatCount;
    summary.secondaryNetId = secondNetId;
  }
  return bestNetId;
}

export function fighterFocusNetId(state, ownId = 0) {
  if (!(state instanceof Map) || !Number.isInteger(ownId) || ownId <= 0) return 0;
  const own = state.get(ownId);
  if (!own || !Number.isFinite(own.x) || !Number.isFinite(own.y)) return 0;
  let bestNetId = 0;
  let bestDistanceSquared = Infinity;
  for (const entity of state.values()) {
    if (!entity || entity.netId === ownId || !Number.isInteger(entity.netId) || entity.netId <= 0
      || entity.action === COMBAT_ACTION.dead || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) continue;
    const dx = entity.x - own.x;
    const dy = entity.y - own.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < bestDistanceSquared
      || (distanceSquared === bestDistanceSquared && (bestNetId === 0 || entity.netId < bestNetId))) {
      bestNetId = entity.netId;
      bestDistanceSquared = distanceSquared;
    }
  }
  return bestNetId;
}

export function killFeedPresentation(event, ownId = 0) {
  const killer = event?.killer;
  const victim = event?.victim;
  if (!Number.isInteger(killer) || killer <= 0 || !Number.isInteger(victim) || victim <= 0 || killer === victim) {
    return { visible: false, text: "", killerOwn: false, victimOwn: false };
  }
  return {
    visible: true,
    text: `#${killer} defeated #${victim}`,
    killerOwn: killer === ownId,
    victimOwn: victim === ownId,
  };
}

export const FFA_KILL_TARGET = 2;

export function fighterScoreboardPresentation(entities, ownId = 0) {
  if (!entities || typeof entities[Symbol.iterator] !== "function") return [];
  const rows = [];
  for (const entity of entities) {
    if (!entity || !Number.isInteger(entity.netId) || entity.netId <= 0) continue;
    const kills = Number.isInteger(entity.flags) ? Math.max(0, Math.min(255, entity.flags)) : 0;
    rows.push({ netId: entity.netId, kills, own: entity.netId === ownId, label: `#${entity.netId}` });
  }
  rows.sort((a, b) => b.kills - a.kills || a.netId - b.netId);
  return rows;
}

export function fighterMatchPresentation(entities, ownId = 0, killTarget = FFA_KILL_TARGET) {
  if (!Number.isInteger(killTarget) || killTarget <= 0) return { visible: false, winnerId: 0, ownVictory: false, title: "", detail: "" };
  const winner = fighterScoreboardPresentation(entities, ownId).find((row) => row.kills >= killTarget);
  if (!winner) return { visible: false, winnerId: 0, ownVictory: false, title: "", detail: "" };
  const ownVictory = winner.netId === ownId;
  return {
    visible: true,
    winnerId: winner.netId,
    ownVictory,
    title: ownVictory ? "VICTORY" : "MATCH OVER",
    detail: `${winner.label} wins · ${winner.kills} KILLS`,
  };
}

export function combatOverlayPresentation(entity) {
  if (entity?.action === COMBAT_ACTION.dead) {
    return { visible: true, state: "dead", title: "DEFEATED", detail: "Respawning…" };
  }
  if (entity?.action === COMBAT_ACTION.stunned) {
    return { visible: true, state: "stunned", title: "STUNNED", detail: "Punish window open." };
  }
  return { visible: false, state: "", title: "", detail: "" };
}

export function combatLifePresentation(entity) {
  const presentation = combatOverlayPresentation(entity);
  if (presentation.state !== "dead") return { visible: false, title: "", detail: "" };
  return { visible: true, title: presentation.title, detail: presentation.detail };
}

function collectEntityEvents(events, before, current, own) {
  if (before.action !== COMBAT_ACTION.dead && current.action === COMBAT_ACTION.dead) {
    push(events, "death", own ? "Defeated - read the exchange." : "Opponent down.", 1050);
    return;
  }
  if (before.action === COMBAT_ACTION.dead && current.action === COMBAT_ACTION.idle
    && current.hp === 100 && current.guard === 100) {
    push(events, "respawn", own ? "Respawned - back in the fight." : "Opponent respawned.", 720);
  }
  if (current.action === COMBAT_ACTION.stunned && current.guard === 0 && before.guard > 0) {
    push(events, "guardBreak", own ? "Guard broken - you are vulnerable." : "Opponent guard broken - punish.", 900, own ? "guard-broken" : "guard-break-confirm");
  }
  if (current.guard < before.guard && current.hp === before.hp) {
    const spent = before.guard - current.guard;
    push(events, "block", own ? `Block held - guard -${spent}.` : `Opponent blocked - guard -${spent}.`, 700, own ? "guard-pressure" : "block-confirm");
  }
  if (current.hp < before.hp) {
    const damage = before.hp - current.hp;
    push(
      events,
      "hit",
      own ? `Hit taken - ${damage} HP.` : `Opponent hit - ${damage} HP.`,
      700,
      own ? "damage-taken" : "hit-confirm",
    );
  }
  if (before.action !== COMBAT_ACTION.stunned && current.action === COMBAT_ACTION.stunned) {
    push(events, "stun", own ? "Stunned - the opponent earned a punish window." : "Opponent stunned - punish window open.", 760);
  }
}

function collectControlImpactEvents(events, beforeOwn, own, beforePeer, peer) {
  const ownJustStunned = beforeOwn.action !== COMBAT_ACTION.stunned
    && own.action === COMBAT_ACTION.stunned
    && own.hp === beforeOwn.hp
    && own.guard === beforeOwn.guard;
  const peerJustStunned = beforePeer.action !== COMBAT_ACTION.stunned
    && peer.action === COMBAT_ACTION.stunned
    && peer.hp === beforePeer.hp
    && peer.guard === beforePeer.guard;

  const ownKick = isKickAction(own.action) || isKickAction(beforeOwn.action);
  const peerKick = isKickAction(peer.action) || isKickAction(beforePeer.action);
  const ownRoll = isRollAction(own.action) || isRollAction(beforeOwn.action);
  const peerRoll = isRollAction(peer.action) || isRollAction(beforePeer.action);

  if (ownJustStunned && peerKick) {
    push(events, "controlImpact", "Shoved - knocked down.", 760, "shoved");
  } else if (ownJustStunned && peerRoll) {
    push(events, "controlImpact", "Rolled over - knocked down.", 720, "rolled-over");
  }

  if (peerJustStunned && ownKick) {
    push(events, "controlImpact", "Shove landed - punish the knockdown.", 760, "kick-confirm");
  } else if (peerJustStunned && ownRoll) {
    push(events, "controlImpact", "Roll collision - opponent knocked down.", 720, "roll-impact");
  }
}

function isKickAction(action) {
  return action === COMBAT_ACTION.kickWindup
    || action === COMBAT_ACTION.kickActive
    || action === COMBAT_ACTION.kickRecovery;
}

function isRollAction(action) {
  return action === COMBAT_ACTION.dodge || action === COMBAT_ACTION.dodgeRecovery;
}

function collectParryEvents(events, beforeOwn, own, beforePeer, peer) {
  const ownBlocking = own.action === COMBAT_ACTION.block || beforeOwn.action === COMBAT_ACTION.block;
  const peerBlocking = peer.action === COMBAT_ACTION.block || beforePeer.action === COMBAT_ACTION.block;
  const ownPaidNothing = own.hp === beforeOwn.hp && own.guard === beforeOwn.guard;
  const peerPaidNothing = peer.hp === beforePeer.hp && peer.guard === beforePeer.guard;

  if (beforePeer.action !== COMBAT_ACTION.stunned && peer.action === COMBAT_ACTION.stunned
    && ownBlocking && ownPaidNothing && peer.guard > 0) {
    push(events, "parry", "Parry! Opponent stunned - punish now.", 980, "parry-success");
  }
  if (beforeOwn.action !== COMBAT_ACTION.stunned && own.action === COMBAT_ACTION.stunned
    && peerBlocking && peerPaidNothing && own.guard > 0) {
    push(events, "parry", "Parried - your commitment was read.", 980, "parried");
  }
}

function collectDodgeEvents(events, own, peer, ownId, pending, beforeOwn = null, beforePeer = null) {
  if (pending) {
    const attacker = pending.attackerId === own.netId ? own : pending.attackerId === peer.netId ? peer : null;
    const defender = pending.defenderId === own.netId ? own : pending.defenderId === peer.netId ? peer : null;
    const vitalsStable = defender && defender.hp === pending.hp && defender.guard === pending.guard;
    if (!attacker || !vitalsStable) {
      pending = null;
    } else if (isAttackRecovery(attacker.action)) {
      if (pending.activeSeen) {
        const ownDefended = defender.netId === ownId;
        push(
          events,
          "dodge",
          ownDefended ? "Dodge! Strike avoided." : "Attack evaded - opponent dodged.",
          820,
          ownDefended ? "dodge-success" : "dodge-evaded",
        );
      }
      pending = null;
    } else if (isAttackActive(attacker.action)) {
      pending.activeSeen = true;
    } else if (!isAttackWindup(attacker.action)) {
      pending = null;
    }
  }

  const ownThreat = isAttackWindup(peer.action) || isAttackActive(peer.action);
  const ownThreatenedNow = ownThreat && attackThreatens(peer, own);
  const ownThreatenedBefore = beforeOwn && beforePeer
    && (isAttackWindup(beforePeer.action) || isAttackActive(beforePeer.action))
    && attackThreatens(beforePeer, beforeOwn);
  const ownJustRolled = own.action === COMBAT_ACTION.dodge
    && beforeOwn?.action !== COMBAT_ACTION.dodge;
  if (own.action === COMBAT_ACTION.dodge && (ownThreatenedNow || (ownJustRolled && ownThreatenedBefore))) {
    return {
      attackerId: peer.netId,
      defenderId: own.netId,
      hp: own.hp,
      guard: own.guard,
      activeSeen: isAttackActive(peer.action) || isAttackActive(beforePeer?.action),
    };
  }

  const peerThreat = isAttackWindup(own.action) || isAttackActive(own.action);
  const peerThreatenedNow = peerThreat && attackThreatens(own, peer);
  const peerThreatenedBefore = beforeOwn && beforePeer
    && (isAttackWindup(beforeOwn.action) || isAttackActive(beforeOwn.action))
    && attackThreatens(beforeOwn, beforePeer);
  const peerJustRolled = peer.action === COMBAT_ACTION.dodge
    && beforePeer?.action !== COMBAT_ACTION.dodge;
  if (peer.action === COMBAT_ACTION.dodge && (peerThreatenedNow || (peerJustRolled && peerThreatenedBefore))) {
    return {
      attackerId: own.netId,
      defenderId: peer.netId,
      hp: peer.hp,
      guard: peer.guard,
      activeSeen: isAttackActive(own.action) || isAttackActive(beforeOwn?.action),
    };
  }
  return pending;
}

function isAttackWindup(action) {
  return action === COMBAT_ACTION.attackWindup || action === COMBAT_ACTION.heavyAttackWindup;
}

function isAttackActive(action) {
  return action === COMBAT_ACTION.attackActive || action === COMBAT_ACTION.heavyAttackActive;
}

function isAttackRecovery(action) {
  return action === COMBAT_ACTION.attackRecovery || action === COMBAT_ACTION.heavyAttackRecovery;
}

function attackProfileForAction(action) {
  return action === COMBAT_ACTION.heavyAttackWindup
    || action === COMBAT_ACTION.heavyAttackActive
    || action === COMBAT_ACTION.heavyAttackRecovery
    ? COMBAT.heavyAttack
    : COMBAT.attack;
}

function attackThreatens(attacker, defender) {
  if (![attacker.x, attacker.y, attacker.facing, defender.x, defender.y].every(Number.isFinite)) return false;
  const profile = attackProfileForAction(attacker.action);
  const dx = defender.x - attacker.x;
  const dy = defender.y - attacker.y;
  if (Math.hypot(dx, dy) > profile.reach + COMBAT.fighterRadius) return false;
  return Math.abs(normalizeAngle(Math.atan2(dy, dx) - attacker.facing)) <= profile.arcRadians / 2;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function push(events, kind, text, durationMs, feedback = null) {
  events.push({ kind, text, durationMs, feedback, priority: PRIORITY[kind] });
}

function snapshot(entity) {
  return {
    netId: entity.netId,
    hp: entity.hp,
    guard: entity.guard,
    action: entity.action,
    x: entity.x,
    y: entity.y,
    facing: entity.facing,
  };
}
