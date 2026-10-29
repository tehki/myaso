// Native controller only. A current genuine browser windup cue is required
// separately. This read-only original World receipt anchors the one-tick
// reaction after Light admission, never after an estimated charging duration.
export async function awaitM35OriginalLightAdmission({readOutput, afterOffset, fighterId, sleep,
  now = Date.now, timeoutMs = 180} = {}) {
  if (typeof readOutput !== "function" || !Number.isInteger(afterOffset) || afterOffset < 0
    || !Number.isSafeInteger(fighterId) || fighterId < 1 || typeof sleep !== "function"
    || typeof now !== "function" || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 180)
    throw new TypeError("current original World actor and bounded Light observation required");
  const started = now();
  while (now() - started < timeoutMs) {
    const lines = readOutput().slice(afterOffset).split(/\r?\n/);
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
    if (light) return {...light,observedAfterMs:now()-started};
    await sleep(2);
  }
  throw new Error("M35 original World did not admit the current short-click Light before reaction");
}
