// Graphics 3A: a real local Rust-server Chrome/Firefox paired roll+jump
// motion receipt. Pure fail-closed assertions; simulated unit fixtures
// do not count as a real browser run.
const counts=Object.freeze({silver_jump:6,silver_roll:8});
const modes=Object.freeze([
 {label:"jump",clip:"silver_jump",initiator:"chrome"},
 {label:"roll",clip:"silver_roll",initiator:"firefox"}
]);
export function qualifyPrealphaSilverConnectedMotions({players,phases}){
 if(!Array.isArray(players)||players.length!==2
   ||players[0].engine!=="chrome"||players[1].engine!=="firefox"
   ||players.some(p=>!Number.isInteger(p.serverPlayerId)||p.serverPlayerId<=0)
   ||players[0].serverPlayerId===players[1].serverPlayerId)
   throw Error("native connected Chrome Firefox with distinct server IDs required");
 if(!Array.isArray(phases)||phases.length!==2)
   throw Error("genuine jump and roll motions required");
 const summary=[];
 for(let i=0;i<2;i++){
  const mode=modes[i],phase=phases[i];
  if(!phase||phase.label!==mode.label||phase.clip!==mode.clip
    ||phase.initiator!==mode.initiator)
    throw Error("ordered server-client jump and roll evidence required");
  if(phase.nativeGestureObserved!==true)
    throw Error(mode.label+" actual native W3C gesture missing");
  if(!Array.isArray(phase.clients)||phase.clients.length!==2)
    throw Error(mode.label+" requires both browser source views");
  const ordered=[];
  for(const expected of ["chrome","firefox"]){
   const c=phase.clients.find(x=>x.engine===expected);
   if(!c||!Array.isArray(c.draws)||c.draws.length<1)
     throw Error(mode.label+" missing source animation in "+expected);
   for(const f of c.draws){
    if(f.clip!==mode.clip||!Number.isInteger(f.sourceFrame)
      ||f.sourceFrame<0||f.sourceFrame>=counts[mode.clip]
      ||!Number.isInteger(f.facing)||f.facing<0||f.facing>7
      ||!Number.isFinite(f.epochMs)||!Number.isFinite(f.x)||!Number.isFinite(f.y))
      throw Error(mode.label+" counterfeit or invalid authentic source cell");
   }
   const frames=[...new Set(c.draws.map(f=>f.sourceFrame))].sort((a,b)=>a-b);
   const epochs=c.draws.map(f=>f.epochMs);
   const paintedSpanMs=Math.max(...epochs)-Math.min(...epochs);
   if(mode.label==="jump"){
     // Original Silver jump atlas has six frames at 430ms presentation.
     // Visibility of frame zero alone is NOT acceptable "full jump" evidence.
     if(frames.length<4||frames[0]>1||frames.at(-1)<5||paintedSpanMs<220)
       throw Error("jump incomplete original Silver playback in "+expected
         +": "+JSON.stringify({frames,paintedSpanMs}));
   }
   if(mode.label==="roll"){
     // Original 8-frame Silver roll authored presentation spans 350ms.
     // Seeing only source frame zero CANNOT certify the cycle.
     if(frames.length<5||frames[0]>1||frames.at(-1)<6||paintedSpanMs<200)
       throw Error("roll incomplete original Silver playback in "+expected
         +": "+JSON.stringify({frames,paintedSpanMs}));
   }
   ordered.push({browser:expected,sourceDraws:c.draws.length,
     frames,paintedSpanMs});
  }
  summary.push({label:mode.label,initiator:mode.initiator,
    sourceBothBrowsers:true,views:ordered});
 }
 return {genuineConnectedOriginalSilverJumpAndRoll:true,
   originalSilverJumpLateFramesBothBrowsers:true,
   originalSilverRollLateFramesBothBrowsers:true,
   server350msActionTimingValidated:false,
   serverPlayers:players.map(x=>x.serverPlayerId),motions:summary,
   actualServerActionStartTickValidated:false,
   actualTwoIndependentHumanOperators:false,
   originalWorldFloorProven:false,realGreyhavenProven:false,
   fourPlayerProven:false,damageHitReceiptProven:false,
   productionReleaseApproved:false};
}
