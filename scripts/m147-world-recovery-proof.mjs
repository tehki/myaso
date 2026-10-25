// Read-only original standard-protocol World stdout qualification. This is
// neither a client HIT receipt nor authority to author input or presentation.
const ACTION = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/;
const HIT = /^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/;
const U32 = 0xffff_ffff;
function parse(output) {
  if (typeof output !== "string") {
    throw new TypeError("M147 requires actual original World stdout");
  }
  const rows = [];
  let firstTick = null;
  let previous = 0;
  for (const line of output.split(/\r?\n/)) {
    if(/^M201_AUTH_(?:BLOCK|PARRY|BREAK) /.test(line))
      throw new Error("M147 unexpected defense contact in clean whiff/punish attempt");
    let match;
    let kind;
    if (line.startsWith("M201_AUTH_ACTION")) {
      match = line.match(ACTION);
      kind = "action";
    } else if (line.startsWith("M201_AUTH_HIT")) {
      match = line.match(HIT);
      kind = "hit";
    } else {
      continue; // Other passive diagnostics are not action proof.
    }
    if (!match) throw new Error("M147 malformed original World action/HIT trace");
    const values = match.slice(1).map(Number);
    if(values.some((n) => !Number.isSafeInteger(n)||n<0||n>U32))throw new Error("M147 invalid World value");
    const [tick, a, b, c, d] = values;
    firstTick ??= tick;
    const elapsed = (tick - firstTick) >>> 0;
    if(elapsed>=0x8000_0000||elapsed<previous)throw new Error("M147 unordered original World ticks");
    previous = elapsed;
    rows.push(kind==="action"?{kind,tick,elapsed,fighter:a,from:b,to:c}
      :{kind,tick,elapsed,attacker:a,target:b,damage:c,hp:d});
  }
  return rows;
}
export function verifyM147WorldRecoveryProof(output, { jumpId, punisherId, closerId }) {
  const ids = [jumpId, punisherId, closerId];
  if(ids.some((id) => !Number.isSafeInteger(id)||id<=0||id>U32)||new Set(ids).size!==3)
    throw new RangeError("M147 needs three distinct original server actor IDs");
  const rows = parse(output);
  const one = (matches, label) => {
    if (matches.length !== 1) throw new Error("M147 expected exactly one " + label);
    return matches[0];
  };
  const actions = (id) => rows.filter((row) => row.kind === "action" && row.fighter === id);
  const jumpActions = actions(jumpId);
  const windup = one(jumpActions.filter((r) => r.to===16),"victim jump windup");
  const active = one(jumpActions.filter((r) => r.from===16&&r.to===17),"victim jump active");
  const recovery = one(jumpActions.filter((r) => r.from===17&&r.to===18),"victim jump recovery");
  const idle = one(jumpActions.filter((r) => r.from===18&&r.to===0),"victim recovery exit");
  if(!(windup.elapsed<active.elapsed&&active.elapsed<recovery.elapsed&&recovery.elapsed<idle.elapsed))
    throw new Error("M147 unordered original victim lifecycle");
  const lightActions = actions(punisherId);
  const lightWindup = one(lightActions.filter((r) => r.to===1&&(r.from===0||r.from===9)),"punisher light windup");
  const lightActive = one(lightActions.filter((r) => r.from===1&&r.to===2),"punisher light active");
  if(lightWindup.elapsed<recovery.elapsed||lightWindup.elapsed>=idle.elapsed
    ||lightActive.elapsed<=lightWindup.elapsed)
    throw new Error("M147 light commitment is not inside original recovery");
  const hit = one(rows.filter((r) => r.kind==="hit"),"original World HIT in this isolated attempt");
  if(hit.attacker!==punisherId||hit.target!==jumpId||hit.damage!==34||hit.hp!==66)
    throw new Error("M147 World HIT has wrong attacker, target or 34HP outcome");
  if(hit.elapsed<lightActive.elapsed||hit.elapsed<recovery.elapsed||hit.elapsed>=idle.elapsed)
    throw new Error("M147 actual World HIT is outside original recovery before its exit");
  return {
    jump: { windup, active, recovery, idle },
    light: { windup: lightWindup, active: lightActive },
    hit,
  };
}
