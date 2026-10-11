import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION, FFA_KILL_TARGET, blockSpatialPresentation, combatActionHint, combatLifePresentation, combatOverlayPresentation, createCombatReadabilityTracker, createRemoteDamageTracker, fighterFocusNetId, fighterGuardBreakPunishNetId, guardBreakPunishRangeCue, fighterKnockdownPunishNetId, knockdownPunishRangeCue, fighterParryPunishNetId, parryPunishRangeCue, fighterRecoveryNetId, fighterIdentityPresentation, fighterThreatBearingLabel, fighterThreatGuardArcLabel, fighterThreatNetId, fighterThreatPhaseLabel, fighterThreatPhaseState, fighterMatchPointPresentation, fighterMatchPresentation, fighterScoreboardPresentation, fighterVitalsPresentation, guardBreakSpatialPresentation, killFeedPresentation, opponentRecoveryPresentation, parrySpatialPresentation, staminaDenialPresentation } from "../src/browser/combat-readability.mjs";

function fighter(netId, hp = 100, guard = 100, action = COMBAT_ACTION.idle, x = 0, y = 0, facing = 0) {
  return { netId, hp, guard, action, x, y, facing };
}

function state(own, peer) {
  return new Map([[own.netId, own], [peer.netId, peer]]);
}

test("stamina denial presentation names the unaffordable action without changing its cost", () => {
  assert.deepEqual(staminaDenialPresentation("roll", 27.9), {
    action: "roll",
    cost: 28,
    available: 27,
    text: "Low stamina — roll needs 28.",
    feedback: "stamina-denied",
    durationMs: 700,
  });
  assert.deepEqual(staminaDenialPresentation("kick", 17), {
    action: "kick",
    cost: 18,
    available: 17,
    text: "Low stamina — kick needs 18.",
    feedback: "stamina-denied",
    durationMs: 700,
  });
  assert.deepEqual(staminaDenialPresentation("jump", 13), {
    action: "jump",
    cost: 14,
    available: 13,
    text: "Low stamina — jump needs 14.",
    feedback: "stamina-denied",
    durationMs: 700,
  });
  assert.deepEqual(staminaDenialPresentation("jump-attack", 11), {
    action: "jump-attack",
    cost: 12,
    available: 11,
    text: "Low stamina — jump attack needs 12.",
    feedback: "stamina-denied",
    durationMs: 700,
  });
  assert.deepEqual(staminaDenialPresentation("jump-attack-chord", 25), {
    action: "jump-attack-chord",
    cost: 26,
    available: 25,
    text: "Low stamina — jump attack needs 26.",
    feedback: "stamina-denied",
    durationMs: 700,
  });
  assert.deepEqual(staminaDenialPresentation("running-attack", 9), {
    action: "running-attack",
    cost: 10,
    available: 9,
    text: "Low stamina — running attack needs 10.",
    feedback: "stamina-denied",
    durationMs: 700,
  });
});

test("stamina denial presentation stays silent at or above the authoritative threshold", () => {
  assert.equal(staminaDenialPresentation("roll", 28), null);
  assert.equal(staminaDenialPresentation("kick", 18), null);
  assert.equal(staminaDenialPresentation("jump", 14), null);
  assert.equal(staminaDenialPresentation("jump-attack", 12), null);
  assert.equal(staminaDenialPresentation("jump-attack-chord", 26), null);
  assert.equal(staminaDenialPresentation("running-attack", 10), null);
  assert.equal(staminaDenialPresentation("unknown", 0), null);
  assert.equal(staminaDenialPresentation("roll", Number.NaN), null);
});

test("authoritative HP loss becomes a readable hit message", () => {
  const tracker = createCombatReadabilityTracker();
  assert.equal(tracker.observe(state(fighter(1), fighter(2)), 1), null);
  const event = tracker.observe(state(fighter(1, 66), fighter(2)), 1);
  assert.equal(event.kind, "hit");
  assert.equal(event.feedback, "damage-taken");
  assert.match(event.text, /Hit taken/);
});

test("authoritative opponent HP loss emits hit-confirm feedback", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1), fighter(2, 66)), 1);
  assert.equal(event.kind, "hit");
  assert.equal(event.feedback, "hit-confirm");
  assert.match(event.text, /Opponent hit/);
});

test("remote authoritative HP loss owns a bounded spatial damage tell", () => {
  const tracker = createRemoteDamageTracker({ durationMs: 320 });
  const initial = new Map([
    [1, fighter(1)],
    [2, fighter(2)],
    [3, fighter(3)],
  ]);
  tracker.observe(initial, 1, 100);
  tracker.observe(new Map([
    [1, fighter(1)],
    [2, fighter(2, 66)],
    [3, fighter(3)],
  ]), 1, 140);

  assert.equal(tracker.visible(1, 140), false);
  assert.equal(tracker.visible(2, 140), true);
  assert.equal(tracker.visible(3, 140), false);
  assert.equal(tracker.visible(2, 459), true);
  assert.equal(tracker.visible(2, 460), false);
});

test("spatial damage tracking identifies every damaged remote without marking local damage", () => {
  const tracker = createRemoteDamageTracker({ durationMs: 320 });
  tracker.observe(new Map([
    [1, fighter(1)],
    [2, fighter(2)],
    [3, fighter(3)],
  ]), 1, 0);
  tracker.observe(new Map([
    [1, fighter(1, 66)],
    [2, fighter(2, 66)],
    [3, fighter(3, 66)],
  ]), 1, 20);

  assert.equal(tracker.visible(1, 20), false);
  assert.equal(tracker.visible(2, 20), true);
  assert.equal(tracker.visible(3, 20), true);
});

test("fighter vitals presentation exposes bounded authoritative HP and guard while alive", () => {
  assert.deepEqual(fighterVitalsPresentation(fighter(2, 66, 62)), { visible: true, hp: 66, guard: 62 });
  assert.deepEqual(fighterVitalsPresentation(fighter(2, 120, -5)), { visible: true, hp: 100, guard: 0 });
  assert.deepEqual(fighterVitalsPresentation(fighter(2, 0, 100, COMBAT_ACTION.dead)), { visible: false, hp: 0, guard: 0 });
});

test("fighter identity presentation exposes only valid authoritative network ids", () => {
  assert.deepEqual(fighterIdentityPresentation(2), { visible: true, label: "#2" });
  assert.deepEqual(fighterIdentityPresentation(512), { visible: true, label: "#512" });
  assert.deepEqual(fighterIdentityPresentation(0), { visible: false, label: "" });
  assert.deepEqual(fighterIdentityPresentation(2.5), { visible: false, label: "" });
});

test("FFA focus presentation chooses the nearest living rival with stable tie-breaking", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.idle, 196, 100)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.idle, 4, 100)],
  ]);
  assert.equal(fighterFocusNetId(entities, 1), 2);
  entities.get(2).action = COMBAT_ACTION.dead;
  assert.equal(fighterFocusNetId(entities, 1), 3);
  entities.get(3).action = COMBAT_ACTION.dead;
  assert.equal(fighterFocusNetId(entities, 1), 0);
  assert.equal(fighterFocusNetId(entities, 99), 0);
});

test("FFA recovery focus chooses and hands off between simultaneous recoverable rivals", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.idle, 120, 100)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.jumpAttackRecovery, 150, 100)],
    [4, fighter(4, 100, 100, COMBAT_ACTION.attackRecovery, 130, 100)],
  ]);
  assert.equal(fighterFocusNetId(entities, 1), 2);
  assert.equal(fighterRecoveryNetId(entities, 1), 4);

  entities.get(4).action = COMBAT_ACTION.idle;
  assert.equal(fighterRecoveryNetId(entities, 1), 3);

  entities.get(2).action = COMBAT_ACTION.dodgeRecovery;
  assert.equal(fighterRecoveryNetId(entities, 1), 2);

  entities.get(2).action = COMBAT_ACTION.idle;
  entities.get(3).action = COMBAT_ACTION.idle;
  entities.get(4).action = COMBAT_ACTION.idle;
  assert.equal(fighterRecoveryNetId(entities, 1), 0);
  assert.equal(fighterRecoveryNetId(entities, 99), 0);

  entities.set(3, fighter(3, 100, 100, COMBAT_ACTION.attackRecovery, 140, 100));
  entities.set(4, fighter(4, 100, 100, COMBAT_ACTION.jumpAttackRecovery, 60, 100));
  assert.equal(fighterRecoveryNetId(entities, 1), 3);
});

test("FFA knockdown punish focus overrides a closer idle rival and remains recovery-compatible", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.idle, 110, 100)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.knockdown, 160, 100)],
    [4, fighter(4, 100, 100, COMBAT_ACTION.attackRecovery, 120, 100)],
  ]);
  assert.equal(fighterFocusNetId(entities, 1), 2);
  assert.equal(fighterKnockdownPunishNetId(entities, 1), 3);
  assert.equal(fighterRecoveryNetId(entities, 1), 4);

  entities.get(3).action = COMBAT_ACTION.idle;
  assert.equal(fighterKnockdownPunishNetId(entities, 1), 0);
  assert.equal(fighterKnockdownPunishNetId(entities, 99), 0);

  entities.set(3, fighter(3, 100, 100, COMBAT_ACTION.knockdown, 140, 100));
  entities.set(5, fighter(5, 100, 100, COMBAT_ACTION.knockdown, 60, 100));
  assert.equal(fighterKnockdownPunishNetId(entities, 1), 3);
});

test("FFA knockdown arbitration selects nearest, breaks ties by net ID, and hands off on recovery", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.knockdown, 140, 100)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.knockdown, 70, 100)],
    [4, fighter(4, 100, 100, COMBAT_ACTION.idle, 105, 100)],
  ]);

  assert.equal(fighterKnockdownPunishNetId(entities, 1), 3);

  entities.get(3).x = 60;
  assert.equal(fighterKnockdownPunishNetId(entities, 1), 2);

  entities.get(2).action = COMBAT_ACTION.idle;
  assert.equal(fighterKnockdownPunishNetId(entities, 1), 3);

  entities.get(3).action = COMBAT_ACTION.idle;
  assert.equal(fighterKnockdownPunishNetId(entities, 1), 0);
});

test("FFA parry punish focus overrides a closer idle rival and excludes guard break stun", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.idle, 120, 100)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.stunned, 160, 100)],
    [4, fighter(4, 100, 0, COMBAT_ACTION.stunned, 110, 100)],
  ]);
  assert.equal(fighterFocusNetId(entities, 1), 4);
  assert.equal(fighterParryPunishNetId(entities, 1), 3);

  entities.get(3).action = COMBAT_ACTION.idle;
  assert.equal(fighterParryPunishNetId(entities, 1), 0);
  assert.equal(fighterParryPunishNetId(entities, 99), 0);

  entities.set(3, fighter(3, 100, 100, COMBAT_ACTION.stunned, 140, 100));
  entities.set(5, fighter(5, 100, 100, COMBAT_ACTION.stunned, 60, 100));
  assert.equal(fighterParryPunishNetId(entities, 1), 3);
});

test("FFA guard-break punish focus overrides a closer idle rival and stays distinct from parry stun", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.idle, 110, 100)],
    [3, fighter(3, 100, 0, COMBAT_ACTION.stunned, 160, 100)],
    [4, fighter(4, 100, 100, COMBAT_ACTION.stunned, 120, 100)],
  ]);
  assert.equal(fighterFocusNetId(entities, 1), 2);
  assert.equal(fighterGuardBreakPunishNetId(entities, 1), 3);
  assert.equal(fighterParryPunishNetId(entities, 1), 4);

  entities.get(3).action = COMBAT_ACTION.idle;
  assert.equal(fighterGuardBreakPunishNetId(entities, 1), 0);
  assert.equal(fighterGuardBreakPunishNetId(entities, 99), 0);

  entities.set(3, fighter(3, 100, 0, COMBAT_ACTION.stunned, 140, 100));
  entities.set(5, fighter(5, 100, 0, COMBAT_ACTION.stunned, 60, 100));
  assert.equal(fighterGuardBreakPunishNetId(entities, 1), 3);
});

test("FFA primary threat bearing uses authoritative replicated positions", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100);
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 60, 100)), "FROM LEFT");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 140, 100)), "FROM RIGHT");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 100, 60)), "FROM ABOVE");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 100, 140)), "FROM BELOW");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 60, 80)), "FROM LEFT");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 120, 60)), "FROM ABOVE");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 60, 60)), "FROM LEFT");
  assert.equal(fighterThreatBearingLabel(own, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 100, 100)), "");
  assert.equal(fighterThreatBearingLabel(own, { ...fighter(2), x: Number.NaN }), "");
  assert.equal(fighterThreatBearingLabel(null, fighter(2)), "");
});

test("FFA threat presentation identifies the most immediate attacker inside authoritative reach and arc", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 60, 100, 0)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.attackActive, 20, 100, 0)],
    [4, fighter(4, 100, 100, COMBAT_ACTION.attackActive, 180, 100, 0)],
  ]);
  const summary = { count: -1, secondaryNetId: -1 };
  assert.equal(fighterThreatNetId(entities, 1, summary), 3);
  assert.equal(summary.count, 2);
  assert.equal(summary.secondaryNetId, 2);
  entities.get(3).facing = Math.PI;
  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 1);
  assert.equal(summary.secondaryNetId, 0);
  entities.get(2).x = 0;
  assert.equal(fighterThreatNetId(entities, 1, summary), 0);
  assert.equal(summary.count, 0);
  assert.equal(summary.secondaryNetId, 0);
  entities.set(2, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 60, 100, 0));
  entities.set(5, fighter(5, 100, 100, COMBAT_ACTION.attackWindup, 140, 100, Math.PI));
  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 2);
  assert.equal(summary.secondaryNetId, 5);
  entities.get(1).action = COMBAT_ACTION.dead;
  assert.equal(fighterThreatNetId(entities, 1, summary), 0);
  assert.equal(summary.count, 0);
  assert.equal(summary.secondaryNetId, 0);
});

test("jump-attack threat selection uses its deliberately narrow authoritative cone", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100);
  const entities = new Map([
    [1, own],
    [2, fighter(2, 100, 100, COMBAT_ACTION.jumpAttackWindup, 45, 100, 0)],
  ]);
  const summary = { count: 0, secondaryNetId: 0 };

  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 1);

  entities.get(2).y = 126;
  assert.equal(fighterThreatNetId(entities, 1, summary), 0);
  assert.equal(summary.count, 0);

  entities.get(2).y = 100;
  entities.get(2).x = 20;
  assert.equal(fighterThreatNetId(entities, 1, summary), 0);
  assert.equal(summary.count, 0);
});

test("heavy threat selection uses heavy reach and narrower authoritative arc", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100);
  const entities = new Map([
    [1, own],
    [2, fighter(2, 100, 100, COMBAT_ACTION.heavyAttackWindup, 0, 100, 0)],
  ]);
  const summary = { count: 0, secondaryNetId: 0 };

  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 1);

  entities.get(2).facing = Math.PI / 2;
  assert.equal(fighterThreatNetId(entities, 1, summary), 0);
  assert.equal(summary.count, 0);

  entities.set(2, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 0, 100, 0));
  assert.equal(fighterThreatNetId(entities, 1, summary), 0);
  assert.equal(summary.count, 0);
});


test("FFA threat summary counts simultaneous valid attackers without changing primary selection", () => {
  const entities = new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 60, 100, 0)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.attackActive, 140, 100, Math.PI)],
    [4, fighter(4, 100, 100, COMBAT_ACTION.attackWindup, 100, 60, Math.PI / 2)],
    [5, fighter(5, 100, 100, COMBAT_ACTION.attackActive, 100, 220, -Math.PI / 2)],
  ]);
  const summary = { count: 99, secondaryNetId: 99 };

  assert.equal(fighterThreatNetId(entities, 1, summary), 3);
  assert.equal(summary.count, 3);
  assert.equal(summary.secondaryNetId, 2);

  entities.get(3).action = COMBAT_ACTION.idle;
  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 2);
  assert.equal(summary.secondaryNetId, 4);

  assert.equal(fighterThreatNetId(new Map(), 1, summary), 0);
  assert.equal(summary.count, 0);
  assert.equal(summary.secondaryNetId, 0);
});

test("FFA secondary threat bearing follows the deterministic runner-up identity", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100);
  const entities = new Map([
    [1, own],
    [2, fighter(2, 100, 100, COMBAT_ACTION.attackActive, 60, 100, 0)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.attackWindup, 140, 100, Math.PI)],
  ]);
  const summary = { count: 0, secondaryNetId: 0 };

  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 2);
  assert.equal(summary.secondaryNetId, 3);
  assert.equal(fighterThreatBearingLabel(own, entities.get(summary.secondaryNetId)), "FROM RIGHT");

  entities.get(2).action = COMBAT_ACTION.idle;
  assert.equal(fighterThreatNetId(entities, 1, summary), 3);
  assert.equal(summary.count, 1);
  assert.equal(summary.secondaryNetId, 0);
  assert.equal(fighterThreatBearingLabel(own, entities.get(summary.secondaryNetId)), "");
});

test("FFA secondary threat phase follows the deterministic runner-up identity", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100);
  const secondary = fighter(3, 100, 100, COMBAT_ACTION.attackWindup, 140, 100, Math.PI);
  const entities = new Map([
    [1, own],
    [2, fighter(2, 100, 100, COMBAT_ACTION.attackActive, 60, 100, 0)],
    [3, secondary],
  ]);
  const summary = { count: 0, secondaryNetId: 0 };

  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.secondaryNetId, 3);
  assert.equal(fighterThreatPhaseLabel(entities.get(summary.secondaryNetId)), "WINDUP");

  secondary.action = COMBAT_ACTION.attackActive;
  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.secondaryNetId, 3);
  assert.equal(fighterThreatPhaseLabel(entities.get(summary.secondaryNetId)), "STRIKE");

  secondary.action = COMBAT_ACTION.idle;
  assert.equal(fighterThreatNetId(entities, 1, summary), 2);
  assert.equal(summary.count, 1);
  assert.equal(summary.secondaryNetId, 0);
  assert.equal(fighterThreatPhaseLabel(entities.get(summary.secondaryNetId)), "");
});

test("threat phase label exposes light and heavy authoritative attack phases", () => {
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.attackWindup }), "WINDUP");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.attackActive }), "STRIKE");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.heavyAttackWindup }), "HEAVY WINDUP");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.heavyAttackActive }), "HEAVY STRIKE");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.jumpAttackWindup }), "JUMP WINDUP");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.jumpAttackActive }), "JUMP STRIKE");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.attackRecovery }), "");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.heavyAttackRecovery }), "");
  assert.equal(fighterThreatPhaseLabel({ action: COMBAT_ACTION.idle }), "");
  assert.equal(fighterThreatPhaseLabel(null), "");
});

test("primary FFA threat guard arc follows authoritative defender facing", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100, 0);
  const front = fighter(2, 100, 100, COMBAT_ACTION.attackWindup, 140, 100, Math.PI);
  const flank = fighter(3, 100, 100, COMBAT_ACTION.attackWindup, 60, 100, 0);

  assert.equal(fighterThreatGuardArcLabel(own, front), "FRONT");
  assert.equal(fighterThreatGuardArcLabel(own, flank), "FLANK");

  own.facing = Math.PI;
  assert.equal(fighterThreatGuardArcLabel(own, front), "FLANK");
  assert.equal(fighterThreatGuardArcLabel(own, flank), "FRONT");

  assert.equal(fighterThreatGuardArcLabel({ ...own, facing: Number.NaN }, front), "");
  assert.equal(fighterThreatGuardArcLabel(own, { ...front, x: own.x, y: own.y }), "");
  assert.equal(fighterThreatGuardArcLabel(null, front), "");
});

test("secondary FFA threat guard arc is independent of primary threat relation", () => {
  const own = fighter(2, 100, 100, COMBAT_ACTION.idle, 100, 100, 0);
  const primaryLeft = fighter(1, 100, 100, COMBAT_ACTION.attackActive, 60, 100, 0);
  const secondaryRight = fighter(3, 100, 100, COMBAT_ACTION.attackWindup, 140, 100, Math.PI);

  assert.equal(fighterThreatGuardArcLabel(own, primaryLeft), "FLANK");
  assert.equal(fighterThreatGuardArcLabel(own, secondaryRight), "FRONT");

  own.facing = Math.PI;
  assert.equal(fighterThreatGuardArcLabel(own, primaryLeft), "FRONT");
  assert.equal(fighterThreatGuardArcLabel(own, secondaryRight), "FLANK");
});

test("kill feed presentation preserves authoritative killer and victim identity", () => {
  assert.deepEqual(killFeedPresentation({ killer: 3, victim: 2 }, 3), {
    visible: true, text: "#3 defeated #2", killerOwn: true, victimOwn: false,
  });
  assert.deepEqual(killFeedPresentation({ killer: 3, victim: 2 }, 2), {
    visible: true, text: "#3 defeated #2", killerOwn: false, victimOwn: true,
  });
  assert.deepEqual(killFeedPresentation({ killer: 0, victim: 2 }, 2), {
    visible: false, text: "", killerOwn: false, victimOwn: false,
  });
  assert.deepEqual(killFeedPresentation({ killer: 2, victim: 2 }, 2), {
    visible: false, text: "", killerOwn: false, victimOwn: false,
  });
});

test("FFA scoreboard presentation ranks authoritative kill scores with stable identity", () => {
  assert.deepEqual(fighterScoreboardPresentation([
    { netId: 3, flags: 1 },
    { netId: 1, flags: 2 },
    { netId: 2, flags: 2 },
  ], 2), [
    { netId: 1, kills: 2, own: false, label: "#1" },
    { netId: 2, kills: 2, own: true, label: "#2" },
    { netId: 3, kills: 1, own: false, label: "#3" },
  ]);
  assert.deepEqual(fighterScoreboardPresentation([{ netId: 4, flags: 999 }], 0), [
    { netId: 4, kills: 255, own: false, label: "#4" },
  ]);
});

test("FFA match presentation declares the authoritative first-to-five winner", () => {
  assert.equal(FFA_KILL_TARGET, 5);
  assert.deepEqual(fighterMatchPresentation([{ netId: 1, flags: 4 }, { netId: 2, flags: 0 }], 1), {
    visible: false, winnerId: 0, ownVictory: false, title: "", detail: "",
  });
  assert.deepEqual(fighterMatchPresentation([{ netId: 1, flags: 5 }, { netId: 2, flags: 0 }], 1), {
    visible: true, winnerId: 1, ownVictory: true, title: "VICTORY", detail: "#1 wins · 5 KILLS",
  });
  assert.deepEqual(fighterMatchPresentation([{ netId: 1, flags: 5 }, { netId: 2, flags: 0 }], 2), {
    visible: true, winnerId: 1, ownVictory: false, title: "MATCH OVER", detail: "#1 wins · 5 KILLS",
  });
  assert.deepEqual(fighterMatchPresentation([{ netId: 1, flags: 0 }, { netId: 2, flags: 0 }], 1), {
    visible: false, winnerId: 0, ownVictory: false, title: "", detail: "",
  });
});

test("FFA match-point presentation becomes visible at four of five only", () => {
  assert.deepEqual(fighterMatchPointPresentation([{ netId: 1, flags: 3 }, { netId: 2, flags: 2 }], 1), {
    visible: false, leaderId: 0, ownMatchPoint: false, title: "", detail: "",
  });
  assert.deepEqual(fighterMatchPointPresentation([{ netId: 1, flags: 4 }, { netId: 2, flags: 2 }], 1), {
    visible: true, leaderId: 1, ownMatchPoint: true, title: "MATCH POINT", detail: "#1 · 4/5 KILLS",
  });
  assert.deepEqual(fighterMatchPointPresentation([{ netId: 1, flags: 4 }, { netId: 2, flags: 2 }], 2), {
    visible: true, leaderId: 1, ownMatchPoint: false, title: "MATCH POINT", detail: "#1 · 4/5 KILLS",
  });
  assert.equal(fighterMatchPointPresentation([{ netId: 1, flags: 5 }, { netId: 2, flags: 2 }], 1).visible, false);
});

test("guard-only loss is explained as a block instead of damage", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 62, COMBAT_ACTION.block), fighter(2)), 1);
  assert.equal(event.kind, "block");
  assert.equal(event.feedback, "guard-pressure");
  assert.match(event.text, /guard -38/);
});

test("authoritative opponent block emits block-confirm feedback", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1), fighter(2, 100, 62, COMBAT_ACTION.block)), 1);
  assert.equal(event.kind, "block");
  assert.equal(event.feedback, "block-confirm");
  assert.match(event.text, /Opponent blocked/);
});

test("cost-free block plus attacker stun is described as a parry", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.block), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.block), fighter(2, 100, 100, COMBAT_ACTION.stunned)), 1);
  assert.equal(event.kind, "parry");
  assert.equal(event.feedback, "parry-success");
  assert.match(event.text, /Parry!/);
});

test("being parried emits a distinct authoritative feedback cue", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2, 100, 100, COMBAT_ACTION.block)), 1);
  const event = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.stunned), fighter(2, 100, 100, COMBAT_ACTION.block)), 1);
  assert.equal(event.kind, "parry");
  assert.equal(event.feedback, "parried");
  assert.match(event.text, /Parried/);
});

test("FFA parry feedback attributes the actual blocking and stunned pair", () => {
  const defenderTracker = createCombatReadabilityTracker();
  defenderTracker.observe(new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.block)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.attackActive)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.idle)],
  ]), 1);
  const defenderEvent = defenderTracker.observe(new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.block)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.stunned)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.idle)],
  ]), 1);
  assert.equal(defenderEvent.kind, "parry");
  assert.equal(defenderEvent.feedback, "parry-success");
  assert.match(defenderEvent.text, /Parry!/);

  const attackerTracker = createCombatReadabilityTracker();
  attackerTracker.observe(new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.attackActive)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.block)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.idle)],
  ]), 1);
  const attackerEvent = attackerTracker.observe(new Map([
    [1, fighter(1, 100, 100, COMBAT_ACTION.stunned)],
    [2, fighter(2, 100, 100, COMBAT_ACTION.block)],
    [3, fighter(3, 100, 100, COMBAT_ACTION.idle)],
  ]), 1);
  assert.equal(attackerEvent.kind, "parry");
  assert.equal(attackerEvent.feedback, "parried");
  assert.match(attackerEvent.text, /Parried/);
});

test("authoritative kick stun emits distinct shove impact feedback", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.kickActive),
      fighter(2, 100, 100, COMBAT_ACTION.idle),
    ),
    1,
  );
  const event = tracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.kickRecovery),
      fighter(2, 100, 100, COMBAT_ACTION.knockdown),
    ),
    1,
  );
  assert.equal(event.kind, "controlImpact");
  assert.equal(event.feedback, "kick-confirm");
  assert.match(event.text, /Shove landed/);
});

test("authoritative roll collision emits distinct knockdown impact feedback", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.dodge),
      fighter(2, 100, 100, COMBAT_ACTION.idle),
    ),
    1,
  );
  const event = tracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.dodgeRecovery),
      fighter(2, 100, 100, COMBAT_ACTION.knockdown),
    ),
    1,
  );
  assert.equal(event.kind, "controlImpact");
  assert.equal(event.feedback, "roll-impact");
  assert.match(event.text, /Roll collision/);
});

test("being shoved or rolled over has distinct local impact feedback", () => {
  const kickTracker = createCombatReadabilityTracker();
  kickTracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.idle),
      fighter(2, 100, 100, COMBAT_ACTION.kickActive),
    ),
    1,
  );
  const shoved = kickTracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.knockdown),
      fighter(2, 100, 100, COMBAT_ACTION.kickRecovery),
    ),
    1,
  );
  assert.equal(shoved.feedback, "shoved");

  const rollTracker = createCombatReadabilityTracker();
  rollTracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.idle),
      fighter(2, 100, 100, COMBAT_ACTION.dodge),
    ),
    1,
  );
  const rolled = rollTracker.observe(
    state(
      fighter(1, 100, 100, COMBAT_ACTION.knockdown),
      fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery),
    ),
    1,
  );
  assert.equal(rolled.feedback, "rolled-over");
});

test("authoritative threatening strike avoided by own dodge emits dodge-success", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  const event = tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 88), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
  assert.equal(event.text, "Dodge! Strike avoided.");
});

test("authoritative threatening strike evaded by opponent emits dodge-evaded", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0), fighter(2, 100, 100, COMBAT_ACTION.dodge, 80)), 1);
  const event = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0), fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 88)), 1);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-evaded");
});

test("dodge evidence survives dodge recovery until authoritative attack recovery", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 88), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2), null);
  const event = tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 92), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
});
test("threatening windup dodge remains credited after movement escapes active range", () => {
  const tracker = createCombatReadabilityTracker();
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackWindup, 0, 0, 0)), 2), null);
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 120), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2), null);
  const event = tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 128), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2);
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
});

test("pointer roll is credited when its first observed dodge state already escaped the threat arc", () => {
  const tracker = createCombatReadabilityTracker();
  assert.equal(
    tracker.observe(
      state(
        fighter(2, 100, 100, COMBAT_ACTION.idle, 80),
        fighter(1, 100, 100, COMBAT_ACTION.heavyAttackWindup, 0, 0, 0),
      ),
      2,
    ),
    null,
  );
  assert.equal(
    tracker.observe(
      state(
        fighter(2, 100, 100, COMBAT_ACTION.dodge, 140),
        fighter(1, 100, 100, COMBAT_ACTION.heavyAttackActive, 0, 0, 0),
      ),
      2,
    ),
    null,
  );
  const event = tracker.observe(
    state(
      fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 150),
      fighter(1, 100, 100, COMBAT_ACTION.heavyAttackRecovery, 0, 0, 0),
    ),
    2,
  );
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
});

test("heavy windup dodge is credited after authoritative heavy active and recovery", () => {
  const tracker = createCombatReadabilityTracker();
  assert.equal(
    tracker.observe(
      state(
        fighter(2, 100, 100, COMBAT_ACTION.dodge, 80),
        fighter(1, 100, 100, COMBAT_ACTION.heavyAttackWindup, 0, 0, 0),
      ),
      2,
    ),
    null,
  );
  assert.equal(
    tracker.observe(
      state(
        fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 120),
        fighter(1, 100, 100, COMBAT_ACTION.heavyAttackActive, 0, 0, 0),
      ),
      2,
    ),
    null,
  );
  const event = tracker.observe(
    state(
      fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 128),
      fighter(1, 100, 100, COMBAT_ACTION.heavyAttackRecovery, 0, 0, 0),
    ),
    2,
  );
  assert.equal(event.kind, "dodge");
  assert.equal(event.feedback, "dodge-success");
});

test("windup dodge is not credited unless the committed strike is observed active", () => {
  const tracker = createCombatReadabilityTracker();
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackWindup, 0, 0, 0)), 2), null);
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 120), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2), null);
});

test("buffered dodge evidence is invalidated by authoritative damage", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 80), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  tracker.observe(state(fighter(2, 66, 100, COMBAT_ACTION.dodgeRecovery, 88), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  assert.equal(tracker.observe(state(fighter(2, 66, 100, COMBAT_ACTION.dodgeRecovery, 92), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2), null);
});

test("out-of-range attack recovery is not falsely credited to dodge", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodge, 120), fighter(1, 100, 100, COMBAT_ACTION.attackActive, 0, 0, 0)), 2);
  assert.equal(tracker.observe(state(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery, 128), fighter(1, 100, 100, COMBAT_ACTION.attackRecovery, 0, 0, 0)), 2), null);
});

test("zero-guard stun is prioritized as a guard break", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 100, 38, COMBAT_ACTION.block), fighter(2)), 1);
  const event = tracker.observe(state(fighter(1, 100, 0, COMBAT_ACTION.stunned), fighter(2)), 1);
  assert.equal(event.kind, "guardBreak");
  assert.equal(event.feedback, "guard-broken");
});

test("authoritative opponent guard break emits punish confirmation", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1), fighter(2, 100, 38, COMBAT_ACTION.block)), 1);
  const event = tracker.observe(state(fighter(1), fighter(2, 100, 0, COMBAT_ACTION.stunned)), 1);
  assert.equal(event.kind, "guardBreak");
  assert.equal(event.feedback, "guard-break-confirm");
  assert.match(event.text, /Opponent guard broken/);
});

test("zero-guard stun exposes a spatial guard-break tell", () => {
  assert.deepEqual(guardBreakSpatialPresentation(fighter(2, 100, 0, COMBAT_ACTION.stunned)), { visible: true, state: "guard-broken" });
  assert.deepEqual(guardBreakSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.knockdown)), { visible: false, state: "" });
  assert.deepEqual(guardBreakSpatialPresentation(fighter(2, 100, 0, COMBAT_ACTION.block)), { visible: false, state: "" });
});

test("authoritative block exposes its replicated facing as a spatial tell", () => {
  assert.deepEqual(blockSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.block, 0, 0, 1.25)), { visible: true, state: "blocking", facing: 1.25 });
  assert.deepEqual(blockSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.idle, 0, 0, 1.25)), { visible: false, state: "", facing: 0 });
  assert.deepEqual(blockSpatialPresentation({ ...fighter(2, 100, 100, COMBAT_ACTION.block), facing: Number.NaN }), { visible: false, state: "", facing: 0 });
});

test("positive-guard stun exposes a mutually exclusive spatial parry tell", () => {
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.stunned)), { visible: true, state: "parried" });
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 1, COMBAT_ACTION.stunned)), { visible: true, state: "parried" });
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 0, COMBAT_ACTION.stunned)), { visible: false, state: "" });
  assert.deepEqual(parrySpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.block)), { visible: false, state: "" });
  assert.equal(guardBreakSpatialPresentation(fighter(2, 100, 100, COMBAT_ACTION.knockdown)).visible, false);
});

test("death and full-vitals idle transition are readable", () => {
  const tracker = createCombatReadabilityTracker();
  tracker.observe(state(fighter(1, 32), fighter(2)), 1);
  const death = tracker.observe(state(fighter(1, 0, 100, COMBAT_ACTION.dead), fighter(2)), 1);
  assert.equal(death.kind, "death");
  const respawn = tracker.observe(state(fighter(1, 100, 100, COMBAT_ACTION.idle), fighter(2)), 1);
  assert.equal(respawn.kind, "respawn");
});

test("authoritative action hints explain light and heavy commitment windows", () => {
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.attackWindup)), /windup/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.attackRecovery)), /Recovery/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.attackLeftWindup)), /Left sweep committed/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.attackRightWindup)), /Right sweep committed/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.runningAttackWindup)), /Running strike committed/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.runningAttackRecovery)), /Running strike recovery/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.jumpAttackWindup)), /Jump attack committed/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.jumpAttackRecovery)), /Jump attack recovery/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.heavyAttackWindup)), /Heavy strike committed/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.heavyAttackRecovery)), /Heavy recovery/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.feintRecovery)), /Feint recovery/);
  assert.match(combatActionHint(fighter(1, 100, 100, COMBAT_ACTION.block)), /Blocking/);
  assert.equal(combatActionHint(fighter(1)), null);
});

test("authoritative opponent recovery exposes a bounded punish cue", () => {
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.attackRecovery)), {
    visible: true, state: "attack-recovery", label: "PUNISH", detail: "Attack recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.attackLeftRecovery)), {
    visible: true, state: "directional-attack-recovery", label: "PUNISH", detail: "Sweep recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.attackRightRecovery)), {
    visible: true, state: "directional-attack-recovery", label: "PUNISH", detail: "Sweep recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.heavyAttackRecovery)), {
    visible: true, state: "heavy-attack-recovery", label: "PUNISH", detail: "Heavy recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.runningAttackRecovery)), {
    visible: true, state: "running-attack-recovery", label: "PUNISH", detail: "Running recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.jumpAttackRecovery)), {
    visible: true, state: "jump-attack-recovery", label: "PUNISH", detail: "Jump attack recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.dodgeRecovery)), {
    visible: true, state: "dodge-recovery", label: "PUNISH", detail: "Dodge recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2, 100, 100, COMBAT_ACTION.feintRecovery)), {
    visible: true, state: "feint-recovery", label: "PUNISH", detail: "Feint recovery",
  });
  assert.deepEqual(opponentRecoveryPresentation(fighter(2)), { visible: false, state: "", label: "", detail: "" });
});

test("authoritative stun owns a temporary punish overlay", () => {
  assert.deepEqual(combatOverlayPresentation(fighter(1, 100, 100, COMBAT_ACTION.stunned)), {
    visible: true,
    state: "stunned",
    title: "STUNNED",
    detail: "Punish window open.",
  });
  assert.deepEqual(combatOverlayPresentation(fighter(1)), { visible: false, state: "", title: "", detail: "" });
});

test("authoritative death owns the persistent life presentation", () => {
  assert.deepEqual(combatLifePresentation(fighter(1, 0, 100, COMBAT_ACTION.dead)), {
    visible: true,
    title: "DEFEATED",
    detail: "Respawning…",
  });
  assert.deepEqual(combatLifePresentation(fighter(1)), { visible: false, title: "", detail: "" });
});


test("knockdown owns a distinct overlay and punish recovery cue", () => {
  const knocked = fighter(2, 100, 100, COMBAT_ACTION.knockdown);
  assert.deepEqual(combatOverlayPresentation(knocked), {
    visible: true,
    state: "knockdown",
    title: "KNOCKED DOWN",
    detail: "Short recovery window.",
  });
  assert.deepEqual(opponentRecoveryPresentation(knocked), {
    visible: true,
    state: "knockdown",
    label: "PUNISH",
    detail: "Knockdown recovery",
  });
});


test("running strike threat phases remain distinct from standing light attack", () => {
  assert.equal(
    fighterThreatPhaseLabel(fighter(2, 100, 100, COMBAT_ACTION.runningAttackWindup)),
    "RUNNING WINDUP",
  );
  assert.equal(
    fighterThreatPhaseLabel(fighter(2, 100, 100, COMBAT_ACTION.runningAttackActive)),
    "RUNNING STRIKE",
  );
});


test("directional light threat labels expose the committed side", () => {
  assert.equal(fighterThreatPhaseLabel(fighter(2, 100, 100, COMBAT_ACTION.attackLeftWindup)), "LEFT WINDUP");
  assert.equal(fighterThreatPhaseLabel(fighter(2, 100, 100, COMBAT_ACTION.attackLeftActive)), "LEFT SWEEP");
  assert.equal(fighterThreatPhaseLabel(fighter(2, 100, 100, COMBAT_ACTION.attackRightWindup)), "RIGHT WINDUP");
  assert.equal(fighterThreatPhaseLabel(fighter(2, 100, 100, COMBAT_ACTION.attackRightActive)), "RIGHT SWEEP");
});

test("all committed attack phase labels map to visible threat states", () => {
  for (const phase of ["WINDUP", "HEAVY WINDUP", "RUNNING WINDUP", "JUMP WINDUP", "LEFT WINDUP", "RIGHT WINDUP"]) {
    assert.equal(fighterThreatPhaseState(phase), "windup", phase);
  }
  for (const phase of ["STRIKE", "HEAVY STRIKE", "RUNNING STRIKE", "JUMP STRIKE", "LEFT SWEEP", "RIGHT SWEEP"]) {
    assert.equal(fighterThreatPhaseState(phase), "strike", phase);
  }
  assert.equal(fighterThreatPhaseState(""), "");
  assert.equal(fighterThreatPhaseState("RECOVERY"), "");
});


test("M182 parry punish guidance uses authoritative light reach and facing without changing stun", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100, 0);
  const parried = fighter(2, 100, 90, COMBAT_ACTION.stunned, 194, 100, Math.PI);
  assert.equal(parryPunishRangeCue(own, parried), "IN LIGHT ARC", "94-unit light reach boundary counts");
  parried.x = 194.01;
  assert.equal(parryPunishRangeCue(own, parried), "CLOSE FOR LIGHT");
  parried.x = 40;
  assert.equal(parryPunishRangeCue(own, parried), "FACE TARGET", "facing is required at close range");
  own.facing = Math.PI;
  assert.equal(parryPunishRangeCue(own, parried), "IN LIGHT ARC");
  own.facing = Number.NaN;
  assert.equal(parryPunishRangeCue(own, parried), "AIM FOR LIGHT");
  own.facing = Math.PI;
  assert.equal(parryPunishRangeCue({ ...own, x: Number.NaN }, parried), "");
  parried.guard = 0;
  assert.equal(parryPunishRangeCue(own, parried), "", "guard-break stun is not parry punish");
  parried.guard = 100;
  own.action = COMBAT_ACTION.knockdown;
  assert.equal(parryPunishRangeCue(own, parried), "", "a downed player cannot convert a punish");
  own.action = COMBAT_ACTION.block;
  assert.equal(parryPunishRangeCue(own, parried), "IN LIGHT ARC", "a blocking player can release and punish");
  parried.action = COMBAT_ACTION.idle;
  assert.equal(parryPunishRangeCue(own, parried), "", "a recovered fighter is never a punish cue");
  assert.equal(parryPunishRangeCue(own, null), "");
});

test("M183 guard-break punish guidance shares light geometry and rejects parry-only stun", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100, 0);
  const broken = fighter(2, 100, 0, COMBAT_ACTION.stunned, 194, 100, Math.PI);
  assert.equal(guardBreakPunishRangeCue(own, broken), "IN LIGHT ARC");
  assert.equal(parryPunishRangeCue(own, broken), "", "guard break is never a parry");
  broken.x = 194.01;
  assert.equal(guardBreakPunishRangeCue(own, broken), "CLOSE FOR LIGHT");
  broken.x = 40;
  assert.equal(guardBreakPunishRangeCue(own, broken), "FACE TARGET");
  own.facing = Math.PI;
  assert.equal(guardBreakPunishRangeCue(own, broken), "IN LIGHT ARC");
  own.facing = NaN;
  assert.equal(guardBreakPunishRangeCue(own, broken), "AIM FOR LIGHT");
  own.facing = Math.PI;
  own.action = COMBAT_ACTION.dodge;
  assert.equal(guardBreakPunishRangeCue(own, broken), "", "no false punish while committed");
  own.action = COMBAT_ACTION.block;
  assert.equal(guardBreakPunishRangeCue(own, broken), "IN LIGHT ARC");
  broken.guard = 30;
  assert.equal(guardBreakPunishRangeCue(own, broken), "", "parry stun cannot impersonate guard break");
  broken.guard = 0;
  broken.action = COMBAT_ACTION.idle;
  assert.equal(guardBreakPunishRangeCue(own, broken), "", "recovered target cannot be punished");
  assert.equal(guardBreakPunishRangeCue(own, null), "");
});

test("M184 knockdown punish guidance uses current light geometry and excludes other stuns", () => {
  const own = fighter(1, 100, 100, COMBAT_ACTION.idle, 100, 100, 0);
  const down = fighter(2, 100, 0, COMBAT_ACTION.knockdown, 194, 100, Math.PI);
  assert.equal(knockdownPunishRangeCue(own, down), "IN LIGHT ARC", "94-unit boundary is reachable");
  assert.equal(guardBreakPunishRangeCue(own, down), "", "knockdown is not guard-break");
  assert.equal(parryPunishRangeCue(own, down), "", "knockdown is not parry");
  down.x = 195;
  assert.equal(knockdownPunishRangeCue(own, down), "CLOSE FOR LIGHT");
  down.x = 60;
  assert.equal(knockdownPunishRangeCue(own, down), "FACE TARGET");
  own.facing = Math.PI;
  assert.equal(knockdownPunishRangeCue(own, down), "IN LIGHT ARC");
  own.action = COMBAT_ACTION.attackRecovery;
  assert.equal(knockdownPunishRangeCue(own, down), "", "no false readiness while recovering");
  own.action = COMBAT_ACTION.block;
  assert.equal(knockdownPunishRangeCue(own, down), "IN LIGHT ARC");
  down.action = COMBAT_ACTION.idle;
  assert.equal(knockdownPunishRangeCue(own, down), "");
  assert.equal(knockdownPunishRangeCue(own, null), "");
});
