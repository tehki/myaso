// Retain only ORIGINAL authored v1 packets carrying a rising action's three
// encoded replay opportunities. One transport writer consumes these bytes;
// this helper never authors input, changes ticks/bits, allocates actors or ACKs.
import {decodeInputPacket} from "./input-codec.mjs";

const actionMask=s=>Number(s.attack)|(Number(s.heavyAttack)<<1)|(Number(s.dodge)<<2)
  |(Number(s.kick)<<3)|(Number(s.jump)<<4)|(Number(s.dash)<<5);
const newer=(a,b)=>a!==b&&((a-b)>>>0)<0x8000_0000;
export function createV1InputReplayWindow({capacity=8,stallMs=1500,onStall}={}) {
  if(!Number.isInteger(capacity)||capacity<1||capacity>8||stallMs!==1500||typeof onStall!=="function")
    throw new TypeError("bounded original replay window and stall handler required");
  const pending=[],edges=new Set();
  let previous=null,timer=null,closed=false;
  function arm(){
    if(timer!==null)clearTimeout(timer);
    timer=null;
    if(!closed&&pending.length)timer=setTimeout(()=>{
      timer=null;
      onStall();
    },Math.max(0,pending[0].deadline-Date.now()));
  }
  function offer(bytes){
    if(closed)return false;
    let packet;
    try{
      // Malformed/other traffic retains the historical latest-wins contract.
      if(bytes[3]!==0)return false;
      packet=decodeInputPacket(bytes);
      if(packet.samples.some((s,i)=>((packet.clientTick-s.tick)>>>0)>2
        ||(i===0&&s.tick!==packet.clientTick)
        ||(i>0&&!newer(packet.samples[i-1].tick,s.tick))))return false;
    }catch{return false;}
    if(previous&&!newer(packet.clientTick,previous.tick))return false;
    for(const tick of edges)if(((packet.clientTick-tick)>>>0)>2)edges.delete(tick);
    for(let i=0;i<packet.samples.length;i++){
      const sample=packet.samples[i],older=packet.samples[i+1]
        ??(previous&&newer(sample.tick,previous.tick)?previous:null);
      if((older&&(actionMask(sample)&~actionMask(older)))
        ||(!previous&&packet.samples.length===1&&actionMask(sample)))edges.add(sample.tick);
    }
    previous=packet.samples[0];
    const protectedPacket=packet.samples.some(s=>edges.has(s.tick)&&actionMask(s)!==0);
    if(!protectedPacket)return false;
    if(pending.length===capacity)throw new RangeError("original v1 replay window overflow");
    pending.push({bytes,deadline:Date.now()+stallMs});
    if(pending.length===1)arm();
    return true;
  }
  function complete(bytes){
    if(closed)return;
    if(pending[0]?.bytes!==bytes)throw new Error("original v1 replay write order changed");
    pending.shift();arm();
  }
  function close(){
    closed=true;
    if(timer!==null)clearTimeout(timer);
    timer=null;pending.length=0;edges.clear();previous=null;
  }
  return {offer,complete,close,peek:()=>pending[0]?.bytes,
    get pending(){return pending.length;}};
}
