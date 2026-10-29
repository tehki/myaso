// Native acceptance controller. Read original World only; every input callback
// must issue an existing genuine W3C action. This never steps or edits World.
export function currentNativeWorldPhase(output, {afterOffset,fighterId,action,requireEntry=false}) {
  if (typeof output!=="string" || !Number.isSafeInteger(afterOffset) || afterOffset<0
      || afterOffset>output.length || !Number.isSafeInteger(fighterId) || fighterId<1
      || ![6,9].includes(action)) throw new TypeError("current original World phase and actor required");
  let current=null,entered=false;
  for(const line of output.slice(afterOffset).split(/\r?\n/).slice(0,-1)) {
    const edge=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=\d+ to=(\d+)$/.exec(line);
    if(edge&&+edge[2]===fighterId) {
      entered=+edge[3]===action;
      if(!entered)current=null;
    }
    const phase=/^COMBAT4_NATIVE_WORLD_PHASE tick=(\d+) fighter=(\d+) action=(\d+) elapsedMs=(\d+(?:\.\d+)?)$/.exec(line);
    if(phase&&+phase[2]===fighterId) current=+phase[3]===action
      ?{tick:+phase[1],fighterId,action,elapsedMs:+phase[4],line}:null;
  }
  return requireEntry&&!entered?null:current;
}

export async function awaitNativeWorldPhase({readOutput,afterOffset,fighterId,action,minElapsedMs,
  sleep,now=Date.now,timeoutMs=1500,requireEntry=false}) {
  if(typeof readOutput!=="function"||typeof sleep!=="function"||typeof now!=="function"
      || !Number.isFinite(minElapsedMs)||minElapsedMs<0||minElapsedMs>320
      ||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>1500)
    throw new TypeError("bounded read-only native phase observation required");
  const start=now();
  while(now()-start<=timeoutMs) {
    const phase=currentNativeWorldPhase(readOutput(),{afterOffset,fighterId,action,requireEntry});
    if(phase&&phase.elapsedMs>=minElapsedMs)return phase;
    await sleep(2);
  }
  throw new Error("original World did not reach the current native guard/READY phase");
}

export async function dispatchNativeHeldHeavyGuard({readOutput,attackerId,defenderId,
  sendDown,sendWheel,sendUp,sleep,guard,wheelCount=1,now=Date.now}) {
  if(![sendDown,sendWheel,sendUp,readOutput,sleep,now].every(f=>typeof f==="function")
      ||!["block","parry"].includes(guard)||![1,2].includes(wheelCount)
      ||![attackerId,defenderId].every(id=>Number.isSafeInteger(id)&&id>0)
      ||attackerId===defenderId)throw new TypeError("one real held LMB and genuine native guard required");
  const afterOffset=readOutput().length;
  await sendDown();
  const ready=await awaitNativeWorldPhase({readOutput,afterOffset,fighterId:attackerId,
    action:9,minElapsedMs:320,sleep,now,requireEntry:true});
  const guardOffset=readOutput().length;
  for(let wheel=0;wheel<wheelCount;wheel++)await sendWheel();
  const guardPhase=await awaitNativeWorldPhase({readOutput,afterOffset:guardOffset,
    fighterId:defenderId,action:6,minElapsedMs:guard==="block"?133.3:0,sleep,now,requireEntry:true});
  const releaseIssuedEpochMs=now();
  await sendUp();
  return {ready,guardPhase,afterOffset,releaseIssuedEpochMs,releaseAckEpochMs:now(),guard,wheelCount};
}

export async function awaitNativeHeavyRecoveryExit({readOutput,afterOffset,fighterId,sleep,
  now=Date.now,timeoutMs=1500}) {
  if(typeof readOutput!=="function"||typeof sleep!=="function"||typeof now!=="function"
      ||!Number.isSafeInteger(afterOffset)||afterOffset<0||!Number.isSafeInteger(fighterId)||fighterId<1
      ||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>1500)
    throw new TypeError("current original Heavy recovery proof required");
  const started=now();
  while(now()-started<=timeoutMs) {
    let activeTick=null,recoveryTick=null;
    for(const line of readOutput().slice(afterOffset).split(/\r?\n/).slice(0,-1)) {
      const m=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
      if(!m||+m[2]!==fighterId)continue;
      const tick=+m[1],from=+m[3],to=+m[4];
      if(from===9&&to===10){activeTick=tick;recoveryTick=null;}
      else if(activeTick!==null&&from===10&&to===11)recoveryTick=tick;
      else if(recoveryTick!==null&&from===11&&to===0)
        return {activeTick,recoveryTick,idleTick:tick};
      else if(to===8||to===7){activeTick=null;recoveryTick=null;}
    }
    await sleep(2);
  }
  throw new Error("current original Heavy did not complete its full recovery");
}
