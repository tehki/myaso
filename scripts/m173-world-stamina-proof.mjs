// Exact original 60Hz World proof: a browser snapshot taken before a chord
// cannot establish the spend baseline after intervening stamina regeneration.
// The flight-only server line is read-only and emitted on real Idle -> Jump.
const SPEND = /^M173_AUTH_JUMP_SPEND tick=(\d+) fighter=(\d+) before=(\d+\.\d+) after=(\d+\.\d+) cost=(\d+\.\d+)$/;

export function verifyM173WorldJumpSpend(output, fighterId, expectedCost = 14) {
  if (typeof output !== "string" || !Number.isSafeInteger(fighterId)
      || fighterId <= 0 || !Number.isFinite(expectedCost) || expectedCost <= 0) {
    throw new TypeError("M173 requires original World output, actor and positive jump cost");
  }
  const rows = output.split(/\r?\n/).filter(line => line.startsWith("M173_AUTH_JUMP_SPEND"));
  const events = rows.map(line => {
    const match = line.match(SPEND);
    if (!match) throw new Error("M173 malformed original World jump-spend proof");
    const [tick, fighter, before, after, cost] = match.slice(1).map(Number);
    if (![tick, fighter, before, after, cost].every(Number.isFinite)
        || !Number.isSafeInteger(tick) || !Number.isSafeInteger(fighter)
        || before < 0 || after < 0 || before > 100 || after > 100) {
      throw new Error("M173 invalid original World jump-spend values");
    }
    return { tick, fighter, before, after, cost };
  }).filter(event => event.fighter === fighterId);
  if (events.length !== 1) throw new Error("M173 requires exactly one original World jump spend for the actual actor");
  const event = events[0];
  if (Math.abs(event.cost - expectedCost) > 0.002
      || Math.abs(event.before - event.after - expectedCost) > 0.002) {
    throw new Error("M173 original World did not spend exactly the ordinary jump cost");
  }
  return event;
}
