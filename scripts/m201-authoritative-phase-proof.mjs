// Read-only loopback server proof, independent from client snapshot cadence.
const forms = {
  action: /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/,
  // Transport admission is a separate row, never proof of a World phase or HIT.
  gesture: /^M201_AUTH_GESTURE_ACTION tick=(\d+) fighter=(\d+) source=([01]) gesture=(\d+) sequence=(\d+) eventAction=([1-5]) status=([1-4]) from=(\d+) to=(\d+)$/,
  // M322: M320 emits genuine server defense events in the same 60 Hz stream.
  // Parse them strictly rather than rejecting an otherwise valid M205 proof.
  block: /^M201_AUTH_BLOCK tick=(\d+) attacker=(\d+) target=(\d+)$/,
  parry: /^M201_AUTH_PARRY tick=(\d+) attacker=(\d+) target=(\d+)$/,
  break: /^M201_AUTH_BREAK tick=(\d+) attacker=(\d+) target=(\d+)$/,
  hit: /^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/,
};
export const M201_STUN_TICKS = 39;
export function parseM201ServerProof(output) {
  if (typeof output !== "string") throw new TypeError("M201 requires server stdout");
  const rows = [];
  const lines = output.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("M201_AUTH_")) continue;
    const kind = Object.keys(forms).find(key => forms[key].test(line));
    if (!kind) {
      if (i === lines.length - 1) continue;
      throw new Error("M201 malformed server trace");
    }
    const args = [...line.match(forms[kind])].slice(1).map(Number);
    if (!args.every(Number.isSafeInteger)) throw new Error("M201 unsafe server tick/value");
    const [tick, a, b, c, d, e, f, g, h] = args;
    if (kind === "gesture" && (args.some(value => value > 0xffffffff)
      || a < 1 || c < 1 || d < 1 || g > 255 || h > 255)) {
      throw new Error("M201 invalid gesture admission");
    }
    const row = kind === "action" ? { kind, tick, fighter: a, from: b, to: c }
      : kind === "gesture" ? { kind, tick, fighter: a, source: b, gestureId: c,
        sequence: d, eventAction: e, status: f, from: g, to: h }
      : kind === "hit" ? { kind, tick, attacker: a, target: b, damage: c, hp: d }
        : { kind, tick, attacker: a, target: b };
    if (rows.length && row.tick < rows.at(-1).tick) {
      throw new Error("M201 unordered authoritative ticks");
    }
    rows.push(row);
  }
  return rows;
}
export function verifyM201ServerPunishProof(output, { attackerId, defenderId, closerId }) {
  const ids = [attackerId, defenderId, closerId];
  if (!ids.every(Number.isSafeInteger) || ids.some(id => id <= 0) || new Set(ids).size !== 3) {
    throw new RangeError("M201 requires three distinct server fighter IDs");
  }
  const rows = parseM201ServerProof(output);
  const breaks = rows.filter(r => r.kind === "break" && r.attacker === attackerId && r.target === defenderId);
  if (breaks.length !== 1) throw new Error("M201 expected one authoritative guard break");
  const guardBreak = breaks[0];
  const stunStart = rows.find(r => r.kind === "action" && r.fighter === defenderId
    && r.to === 7 && r.tick === guardBreak.tick);
  if (!stunStart) throw new Error("M201 missing authoritative stun start");
  const windups = rows.filter(r => r.kind === "action" && r.fighter === attackerId
    && r.to === 1 && r.tick > guardBreak.tick);
  if (windups.length !== 1) throw new Error("M201 expected one post-break windup");
  const windup = windups[0];
  const actives = rows.filter(r => r.kind === "action" && r.fighter === attackerId
    && r.from === 1 && r.to === 2 && r.tick > windup.tick
    && r.tick - windup.tick <= 12 && r.tick < guardBreak.tick + M201_STUN_TICKS);
  if (actives.length !== 1) throw new Error("M201 missing exact authoritative attack-active edge");
  const active = actives[0];
  const hits = rows.filter(r => r.kind === "hit" && r.attacker === attackerId && r.tick > guardBreak.tick);
  if (hits.length !== 1 || hits[0].target !== defenderId || hits[0].damage !== 34
    || hits[0].hp !== 66 || hits[0].tick < active.tick || hits[0].tick > active.tick + 8
    || hits[0].tick >= guardBreak.tick + M201_STUN_TICKS) {
    throw new Error("M201 exact 34 HP victim hit did not follow server active phase inside stun");
  }
  if (rows.some(r => r.kind === "hit" && r.target === closerId && r.tick > guardBreak.tick)) {
    throw new Error("M201 damaged idle third fighter");
  }
  const stunExit = rows.find(r => r.kind === "action" && r.fighter === defenderId
    && r.from === 7 && r.tick > guardBreak.tick);
  if (stunExit && stunExit.tick <= hits[0].tick) throw new Error("M201 hit after guard-break stun exit");
  return { guardBreak, stunStart, windup, active, hit: hits[0], stunExit: stunExit ?? null };
}
