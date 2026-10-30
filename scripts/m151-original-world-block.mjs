// Acceptance-only read of original World; never authors or advances defense.
export async function awaitOriginalWorldShortBlock({readOutput,afterOffset,fighterId,
 sleep,now=()=>Date.now(),timeoutMs=190}) {
 if(typeof readOutput!=="function"||typeof sleep!=="function"||typeof now!=="function"
  ||!Number.isSafeInteger(afterOffset)||afterOffset<0||!Number.isSafeInteger(fighterId)||fighterId<1
  ||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>190)
  throw new TypeError("bounded original Block admission proof required");
 const started=now();
 while(now()-started<=timeoutMs) {
  const output=readOutput();
  if(typeof output!=="string"||output.length<afterOffset)throw new Error("original World stream unavailable");
  let block=null,current=null;
  for(const line of output.slice(afterOffset).split(/\r?\n/).slice(0,-1)) {
   const m=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
   if(!m||Number(m[2])!==fighterId)continue;
   current=Number(m[4]);
   if(current===6)block={serverTick:Number(m[1]),fighterId};
  }
  if(block&&current!==6)throw new Error("original short Block already ended before native release");
  if(block)return block;
  await sleep(2);
 }
 throw new Error("original World Block admission missing before native release");
}
