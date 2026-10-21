// Pure integration-test planner: coordinate math only, NEVER creates item IDs
// or authorizes physical sword pickup. No gameplay movement authority.
export function nextNativeWalkPulse(from,to){
  if(!Number.isFinite(from)||!Number.isFinite(to))throw Error("nonfinite walk coordinates");
  const delta=to-from;
  if(Math.abs(delta)<=12)return Object.freeze({done:true,key:null,holdMs:0,distance:Math.abs(delta)});
  // Bounded genuine W3C keyboard pulse, corrected after fresh Rust position ACK.
  // Open-loop speed is only a conservative hint; authoritative server position
  // is re-read after each pulse. <=550ms prevents large speculative overshoot.
  const holdMs=Math.max(75,Math.min(550,Math.round(Math.abs(delta)*2.4)));
  return Object.freeze({done:false,key:delta<0?"negative":"positive",holdMs,distance:Math.abs(delta)});
}
export function nativeRackArrived(current,target,tolerance=18){
  return !!current&&!!target&&Number.isFinite(current.x)&&Number.isFinite(current.y)
    &&Number.isFinite(target.x)&&Number.isFinite(target.y)
    &&Number.isFinite(tolerance)&&tolerance>=0&&tolerance<=18
    &&Math.hypot(current.x-target.x,current.y-target.y)<=tolerance;
}

/** Provisional World #639 standing target, not a server-authorized item click. */
export function proposedNativeRackReachPoint(slot){
  if(!slot||!Number.isFinite(slot.x)||!Number.isFinite(slot.y)
    ||!slot.approach||slot.approach.x!==slot.x
    ||slot.approach.y-slot.y!==50)
    throw Error("unreviewed authored Blacksmith socket/stand fixture");
  return Object.freeze({x:slot.x,y:slot.y+30});
}
/** Conservative OFFLINE prototype radius only. Not current item or LOS authority. */
export function nativeRackWithinProposedReach(position,slot,limit=56){
  if(!position||!slot||![position.x,position.y,slot.x,slot.y,limit].every(Number.isFinite)
    ||limit!==56)return false;
  return Math.hypot(position.x-slot.x,position.y-slot.y)<=limit;
}
