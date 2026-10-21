// Strict M147 loopback-only CI proof: the real server must attribute exactly
// one 34 HP HIT to the Firefox attacker during the *target's* recovery.
// Browser receive timestamps from different clients are not server chronology.
// No gameplay packet, authoritative simulation, or client-hit credit changes.
const ACTION = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/;
const HIT = /^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/;
const TICK_LIMIT = 48; // 800 ms > original 290 ms jump recovery, strictly bounded.

function distance(tick, start) {
  return (tick - start) >>> 0;
}

export function verifyM147AuthoritativeRecoveryPunish(output, {
  victimId, attackerId, recoveryTick, idleTick, cueTick,
  cueTargetAction, cueEpochMs, pointerDownEpochMs,
}) {
  if (typeof output !== "string" || output.length > 2_000_000
    || ![victimId, attackerId].every(id => Number.isSafeInteger(id) && id > 0)
    || victimId === attackerId
    || ![recoveryTick, idleTick, cueTick].every(t => Number.isSafeInteger(t) && t >= 0 && t <= 0xffffffff)
    || cueTargetAction !== 18
    || !Number.isFinite(cueEpochMs) || !Number.isFinite(pointerDownEpochMs)
    || pointerDownEpochMs < cueEpochMs || pointerDownEpochMs - cueEpochMs > 190) {
    throw new Error("M147 missing genuine recovery cue, roles, tick or prompt native pointer");
  }
  const events = [];
  for (const line of output.split(/\r?\n/)) {
    const a = ACTION.exec(line);
    if (a) events.push({ type: "action", tick: Number(a[1]), fighter: Number(a[2]),
      from: Number(a[3]), to: Number(a[4]) });
    const h = HIT.exec(line);
    if (h) events.push({ type: "hit", tick: Number(h[1]),
      attacker: Number(h[2]), victim: Number(h[3]),
      damage: Number(h[4]), hp: Number(h[5]) });
  }
  const starts = events.filter(e => e.type === "action" && e.fighter === victimId && e.to === 18);
  const ends = events.filter(e => e.type === "action" && e.fighter === victimId && e.from === 18 && e.to === 0);
  const hits = events.filter(e => e.type === "hit");
  if (starts.length !== 1 || ends.length !== 1 || hits.length !== 1
    || starts[0].tick !== recoveryTick || ends[0].tick !== idleTick
    || hits[0].attacker !== attackerId || hits[0].victim !== victimId
    || hits[0].damage !== 34 || hits[0].hp !== 66) {
    throw new Error("M147 server event identity, phase, exact HIT or uniqueness unproven");
  }
  const windowTicks = distance(idleTick, recoveryTick);
  const cueAge = distance(cueTick, recoveryTick);
  const hitAge = distance(hits[0].tick, recoveryTick);
  // Tick ordering is the authoritative domain: Chrome's receipt of recovery
  // may occur after Firefox saw the same recovery and issued its real click.
  if (windowTicks === 0 || windowTicks > TICK_LIMIT
    || cueAge >= windowTicks || hitAge >= windowTicks || hitAge < cueAge) {
    throw new Error("M147 actual attacker HIT outside server-owned recovery window");
  }
  return {
    attackerId, victimId, recoveryTick, cueTick,
    hitTick: hits[0].tick, idleTick, damage: 34, victimHp: 66,
  };
}
