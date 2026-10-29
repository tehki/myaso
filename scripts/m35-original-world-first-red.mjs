import { COMBAT } from "../src/combat/model.mjs";
// Failure-only original-World attribution; NEVER drives input or changes the gate.
export function inspectM35ParryFirstRed({worldLog, attackerId, defenderId, inputSubmissions=[]}={}) {
  if (typeof worldLog!=="string" || !Number.isSafeInteger(attackerId) || attackerId<1
      || !Number.isSafeInteger(defenderId) || defenderId<1 || attackerId===defenderId)
    throw new TypeError("original World log and distinct actor IDs required");
  const lines=worldLog.split(/\r?\n/);
  const contacts=lines.flatMap(line=>{
    const m=/^CORE8C_WORLD_CONTACT tick=(\d+) world=\d+ outcome=(PARRY|BLOCK|HIT) attacker=(\d+) target=(\d+) .*?defenderActionElapsedMs=([\d.]+) defenderHp=([\d.]+) defenderGuard=([\d.]+)/.exec(line);
    return m && +m[3]===attackerId && +m[4]===defenderId
      ? [{line,tick:+m[1],outcome:m[2],elapsedMs:+m[5],hp:+m[6],guard:+m[7]}] : [];
  });
  const contact=contacts.at(-1)??null;
  const admissions=lines.flatMap(line=>{
    const m=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=\d+ to=6(?:\s|$)/.exec(line);
    return m && +m[2]===defenderId ? [{tick:+m[1],line}] : [];
  });
  const before=admissions.filter(x=>contact && x.tick<=contact.tick).at(-1)??null;
  const after=admissions.find(x=>contact && x.tick>contact.tick)??null;
  const wheel=Array.isArray(inputSubmissions) ? inputSubmissions.filter(x=>
    x?.source==="physical-wheel-original-v1" && x.block===true
    && x.m41PhysicalInput?.wheel?.trusted===true).at(-1) : null;
  const parryWindowMs=COMBAT.block.parryWindowMs, blockMs=COMBAT.block.shortBlockMs;
  let verdict="UNPROVEN";
  if (contact?.outcome==="PARRY" && contact.elapsedMs<=parryWindowMs) verdict="WORLD_PARRY";
  else if (contact?.outcome==="BLOCK" && contact.elapsedMs>parryWindowMs
           && contact.elapsedMs<=blockMs) verdict="WORLD_EARLY_BLOCK_OUTSIDE_PARRY";
  else if (contact?.outcome==="HIT") verdict=after?"WORLD_HIT_BEFORE_BLOCK":"WORLD_HIT_WITHOUT_PARRY";
  else if (contact) verdict="WORLD_NONPARRY_UNCLASSIFIED";
  return {verdict,parryWindowMs,blockMs,contact,defenderBlockBeforeContact:before,
    defenderBlockAfterContact:after,trustedSource0:wheel?{
      clientTick:wheel.clientTick,recordedEpochMs:wheel.epochMs,
      wheelCallbackEpochMs:wheel.m41PhysicalInput.wheel.callbackStartEpochMs,
      recordedSendInvocationEpochMs:wheel.m41PhysicalInput.originalV1SendInvocationEpochMs,
    }:null};
}

// Earlier charging may schedule a native wheel, but cannot qualify M33/M35:
// the same attempt must still become actual original World Light and Parry.
export function verifyM35OriginalLightParry(options) {
  const proof=inspectM35ParryFirstRed(options);
  const actions=options.worldLog.split(/\r?\n/).flatMap(line=>{
    const m=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=\d+ to=(\d+)(?:\s|$)/.exec(line);
    return m && +m[2]===options.attackerId && +m[1]<=proof.contact?.tick
      ? [{tick:+m[1],action:+m[3]}] : [];
  });
  const light=actions.find(e=>e.action===1);
  if(proof.verdict!=="WORLD_PARRY" || !light || actions.some(e=>e.action===10))
    throw new Error("M35 requires original World LightWindup then PARRY125, never a charging cue or Heavy substitute");
  return {...proof,originalLightWindupTick:light.tick};
}
