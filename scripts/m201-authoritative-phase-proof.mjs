// Read-only loopback server proof, independent from client snapshot cadence.
const forms = {
  action: /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/,
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
    const [tick, a, b, c, d] = args;
    const row = kind === "action" ? { kind, tick, fighter: a, from: b, to: c }
      : kind === "break" ? { kind, tick, attacker: a, target: b }
        : { kind, tick, attacker: a, target: b, damage: c, hp: d };
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
