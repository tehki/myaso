// Acceptance-only: wait for the real loopback World, never advance it.
export async function awaitOriginalHeavyChargeTick({readOutput,afterOffset,fighterId,
 startTick,offsetTicks,sleep,now=()=>Date.now(),timeoutMs=550}) {
 if(typeof readOutput!=="function"||typeof sleep!=="function"||typeof now!=="function"
  ||!Number.isSafeInteger(afterOffset)||afterOffset<0||!Number.isInteger(fighterId)||fighterId<1
  ||!Number.isInteger(startTick)||startTick<0||startTick>0xffffffff
  ||![10,20].includes(offsetTicks)||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>1500)
  throw new TypeError("bounded original Heavy charge tick proof required");
 const started=now();
 while(now()-started<=timeoutMs) {
  const output=readOutput();
  if(typeof output!=="string"||output.length<afterOffset)throw new Error("original World output unavailable");
  let latest=null,ended=false;
  for(const line of output.slice(afterOffset).split(/\r?\n/).slice(0,-1)) {
   const action=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=9 to=(\d+)$/.exec(line);
   if(action&&Number(action[2])===fighterId&&((Number(action[1])-startTick)>>>0)<0x80000000)ended=true;
   const phase=/^COMBAT4_NATIVE_WORLD_PHASE tick=(\d+) fighter=(\d+) action=9 elapsedMs=([\d.]+)$/.exec(line);
   if(phase&&Number(phase[2])===fighterId) {
    const tick=Number(phase[1]),delta=(tick-startTick)>>>0;
    if(delta<0x80000000)latest={serverTick:tick,offsetTicks:delta,elapsedMs:Number(phase[3])};
   }
  }
  if(ended)throw new Error("original Heavy already left charge before native Dodge dispatch");
  if(latest&&latest.offsetTicks>=offsetTicks)return latest;
  await sleep(4);
 }
 throw new Error("original Heavy charge tick was not observed within the bounded native window");
}

export function planOriginalDodgeViewport(arena) {
 if(!arena||!["left","top","width","height","innerWidth","innerHeight"].every(k=>Number.isFinite(arena[k]))
  ||arena.left<0||arena.top<0||arena.width<20||arena.height<20
  ||arena.left+arena.width>arena.innerWidth||arena.top+arena.height>arena.innerHeight)
  throw new RangeError("genuine fully visible arena bounds required before native Dodge");
 return Object.freeze({x:Math.round(arena.left+arena.width/2),
  y:Math.round(arena.top+arena.height/2+Math.min(180,arena.height/3))});
}
