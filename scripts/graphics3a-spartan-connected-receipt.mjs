import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
// Genuine connected browser kick-flight receipt: browser pixels plus the
// pre-existing server-authoritative M133 action transitions.
// Accepts only actual WebDriver drawImage observations; never substitutes
// simulated actor state or owner concept art for multiplayer evidence.
const KICK_WINDUP=COMBAT_ACTION.kickWindup;
const KICK_RECOVERY=COMBAT_ACTION.kickRecovery;
const MAX_FRAME=7;
const phaseOf=frame => frame<=2?"windup":frame<=4?"active":"recovery";

function demand(ok,detail){
 if(!ok) throw new Error("Graphics3A Spartan real-server flight: "+detail);
}
function hasOrderedAction(actions,phase){
 return Array.isArray(actions)&&actions.some(a=>a?.action===phase
  &&Number.isFinite(a?.epochMs));
}
export function summarizeSpartanConnectedKickFlight({attackerTransitions,
 defenderTransitions,clients}){
 demand(Array.isArray(clients)&&clients.length===2,"requires two separate browser reports");
 demand(hasOrderedAction(attackerTransitions,KICK_WINDUP)
     &&hasOrderedAction(attackerTransitions,KICK_RECOVERY),
   "attacker must receive authoritative windup and recovery");
 demand(hasOrderedAction(defenderTransitions,KICK_WINDUP)
     &&hasOrderedAction(defenderTransitions,KICK_RECOVERY),
   "defender must receive attacker windup and recovery from network");
 const out=[];
 for(const c of clients){
   demand(c && typeof c.engine==="string" && c.engine.length>0,"browser identity required");
   demand(Number.isInteger(c.netId)&&c.netId>0,"authoritative server netId required");
   demand(c.probeInstalled===true,"strict original source drawImage probe required");
   demand(c.serverConnected===true,"cannot accept mocked/disconnected game client");
   demand(Array.isArray(c.draws)&&c.draws.length>0,"must paint real source kick");
   const counts={windup:0,active:0,recovery:0};
   for(const sample of c.draws){
     demand(Number.isInteger(sample.frame)&&sample.frame>=0&&sample.frame<=MAX_FRAME,
       "out-of-range kick sprite frame");
     demand(Number.isInteger(sample.direction)&&sample.direction>=0&&sample.direction<=7,
       "out-of-range direction");
     demand(Number.isFinite(sample.epochMs),"missing real browser paint timestamp");
     counts[phaseOf(sample.frame)]++;
   }
   demand(counts.windup>0,"browser did not render any real windup frames");
   demand(counts.recovery>0,"browser did not render any real recovery frames");
   // The active server phase lasts 70 ms and is sampled at 20 Hz; if skipped
   // or hidden under render pacing, record the precise gap rather than
   // inventing authoritative hit or an active sprite.
   out.push({engine:c.engine,netId:c.netId,paintedSourceFrames:c.draws.length,
     counts,hasContactFrame:counts.active>0});
 }
 demand(out[0].netId!==out[1].netId,"two server-authorized identities required");
 demand(out.some(x=>x.hasContactFrame),"no native browser observed the real contact atlas frame");
 return {verifiedRealConnectedServer:true,authenticServerNetIds:out.map(x=>x.netId),
   nativeBrowserSourceDraws:out,
   floorContactValidated:false,hitReceiptValidated:false,
   exactServerPhaseStartValidated:false,
   realGreyhavenCityValidated:false};
}
