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
});

const PRIORITY = Object.freeze({
  death: 100,
  respawn: 90,
  guardBreak: 80,
  parry: 70,
  block: 60,
  hit: 50,
  stun: 40,
});

export function createCombatReadabilityTracker() {
  const previous = new Map();
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
        collectParryEvents(candidates, beforeOwn, own, beforePeer, peer);
      }

      previous.clear();
      for (const [netId, entity] of current) previous.set(netId, entity);
      candidates.sort((a, b) => b.priority - a.priority);
      return candidates[0] ?? null;
    },
    reset() { previous.clear(); },
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

export function combatLifePresentation(entity) {
  if (!entity || entity.action !== COMBAT_ACTION.dead) {
    return { visible: false, title: "", detail: "" };
  }
  return {
    visible: true,
    title: "DEFEATED",
    detail: "Respawning…",
  };
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
    push(events, "guardBreak", own ? "Guard broken - you are vulnerable." : "Opponent guard broken - punish.", 900);
  }
  if (current.guard < before.guard && current.hp === before.hp) {
    const spent = before.guard - current.guard;
    push(events, "block", own ? `Block held - guard -${spent}.` : `Opponent blocked - guard -${spent}.`, 700);
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

function collectParryEvents(events, beforeOwn, own, beforePeer, peer) {
  const ownBlocking = own.action === COMBAT_ACTION.block || beforeOwn.action === COMBAT_ACTION.block;
  const peerBlocking = peer.action === COMBAT_ACTION.block || beforePeer.action === COMBAT_ACTION.block;
  const ownPaidNothing = own.hp === beforeOwn.hp && own.guard === beforeOwn.guard;
  const peerPaidNothing = peer.hp === beforePeer.hp && peer.guard === beforePeer.guard;

  if (beforePeer.action !== COMBAT_ACTION.stunned && peer.action === COMBAT_ACTION.stunned
    && ownBlocking && ownPaidNothing && peer.guard > 0) {
    push(events, "parry", "Parry! Opponent stunned - punish now.", 980);
  }
  if (beforeOwn.action !== COMBAT_ACTION.stunned && own.action === COMBAT_ACTION.stunned
    && peerBlocking && peerPaidNothing && own.guard > 0) {
    push(events, "parry", "Parried - your commitment was read.", 980);
  }
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
  };
}
