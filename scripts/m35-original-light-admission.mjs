// Native controller only. A current genuine browser windup cue is required
// separately. This read-only original World receipt anchors the one-tick
// reaction after Light admission, never after an estimated charging duration.
export function createM35WorldReceiptClock() {
  let tail = "", offset = 0;
  const receipts = [];
  return {
    append(chunk, observedEpochMs) {
      if (typeof chunk !== "string" || !Number.isFinite(observedEpochMs))
        throw new TypeError("actual original server output chunk and local receipt clock required");
      tail += chunk;
      let end;
      while ((end = tail.indexOf("\n")) >= 0) {
        const line = tail.slice(0,end).replace(/\r$/, "");
        const m = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=\d+ to=1(?:\s|$)/.exec(line);
        if (m) {
          receipts.push({tick:+m[1],fighterId:+m[2],offset,observedEpochMs});
          if (receipts.length > 256) receipts.shift();
        }
        offset += end + 1; tail = tail.slice(end + 1);
      }
    },
    observedAt(fighterId, tick, afterOffset) {
      return receipts.find(r=>r.fighterId===fighterId && r.tick===tick && r.offset>=afterOffset)?.observedEpochMs;
    },
  };
}

export async function awaitM35OriginalLightAdmission({readOutput, afterOffset, fighterId, sleep,
  now = Date.now, timeoutMs = 180} = {}) {
  if (typeof readOutput !== "function" || !Number.isInteger(afterOffset) || afterOffset < 0
    || !Number.isSafeInteger(fighterId) || fighterId < 1 || typeof sleep !== "function"
    || typeof now !== "function" || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 180)
    throw new TypeError("current original World actor and bounded Light observation required");
  const started = now();
  while (now() - started < timeoutMs) {
    // A pipe may split a complete-looking action immediately before newline.
    // Only completed lines have an actual receipt timestamp in the clock.
    const lines = readOutput().slice(afterOffset).split(/\r?\n/).slice(0,-1);
    let light = null;
    for (const line of lines) {
      const action = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=\d+ to=(\d+)(?:\s|$)/.exec(line);
      if (action && +action[2] === fighterId) {
        if (+action[3] === 10) throw new Error("M35 HeavyActive cannot schedule a Light parry");
        if (+action[3] === 1) light = {tick:+action[1],fighterId,line};
      }
      if (/^CORE8C_WORLD_CONTACT /.test(line)
        && new RegExp(` attacker=${fighterId} target=`).test(line))
        throw new Error("M35 current World contact already resolved before the native wheel");
    }
    if (light) {
      const observedEpochMs = readOutput.observedAt?.(fighterId,light.tick,afterOffset);
      if (!Number.isFinite(observedEpochMs) || observedEpochMs > now())
        throw new Error("M35 current Light lacks its actual server-output receipt timestamp");
      return {...light,observedEpochMs,observedAfterMs:now()-started};
    }
    await sleep(2);
  }
  throw new Error("M35 original World did not admit the current short-click Light before reaction");
}
