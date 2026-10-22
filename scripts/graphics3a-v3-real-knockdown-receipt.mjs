import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";

// Separate authentic THREE-player M153 knockdown acceptance: art rendering
// must accompany a real server-issued knockdown, not merely a kick pose.
const requireProof=(ok,why)=>{if(!ok)throw Error("Graphics3A V3 real knockdown: "+why)};
const ordered=(events,actions)=>{
 if(!Array.isArray(events))return false;
 const found=actions.map(action=>events.find(e=>e.action===action
   && Number.isFinite(e.epochMs)&&Number.isFinite(e.serverTick)&&e.serverTick>0));
 return found.every(Boolean)&&found.every((x,i)=>!i||
   (x.serverTick>found[i-1].serverTick&&x.epochMs>found[i-1].epochMs));
};
export function summarizeSpartanV3RealKnockdown({results,clients,
  expectedSourceFile="silver_kick_v3.webp"}) {
 requireProof(["silver_kick_v3.webp","silver_kick_v3_lit.webp","silver_kick_v3_support.webp"].includes(expectedSourceFile),
   "unapproved source evidence target");
 requireProof(Array.isArray(results)&&results.length===3,"three true M153 browser states needed");
 requireProof(Array.isArray(clients)&&clients.length===3,"three native browser source receipts needed");
 const names=["chrome","firefox","chrome2"];
 const states=names.map(name=>results.find(x=>x.browser===name));
 const views=names.map(engine=>clients.find(x=>x.engine===engine));
 requireProof(states.every(Boolean)&&views.every(Boolean),"actual Chrome, Firefox, Chrome2 must all report");
 const attacker=states[0],victim=states[1],spectator=states[2];
 const ids=[attacker.m153AttackerId,victim.m153KnockedDownId,spectator.m153BystanderId];
 requireProof(ids.every(x=>Number.isInteger(x)&&x>0)&&new Set(ids).size===3,
   "three distinct authoritative M153 roster IDs required");
 requireProof(states.every(x=>x.m153AttackerId===ids[0]
   &&x.m153KnockedDownId===ids[1]&&x.m153BystanderId===ids[2]
   &&Number.isInteger(x.m153KickAttempt)&&x.m153KickAttempt>=1
   &&x.m153KickAttempt<=3),"M153 original authoritative successful knockdown proof missing");
 requireProof(states.every((x,i)=>x.acceptance?.playerNetId===ids[i]
   &&Number.isFinite(x.acceptance?.serverTick)
   &&x.acceptance.serverTick>0),"real authoritative per-browser identities/ticks needed");
 requireProof(ordered(attacker.acceptance?.ownActionTransitions,
   [COMBAT_ACTION.kickWindup,COMBAT_ACTION.kickActive,COMBAT_ACTION.kickRecovery]),
   "kicker must receive ordered server kick windup/active/recovery");
 requireProof(victim.acceptance?.ownActionTransitions?.some(x=>
   x.action===COMBAT_ACTION.knockdown && Number.isFinite(x.serverTick)
   &&Number.isFinite(x.epochMs) &&x.serverTick>0),
   "victim must receive server-confirmed knockdown");
 requireProof(attacker.focusTransitions?.some(x=>x.label==="KNOCKDOWN #"+ids[1]),
   "genuine attacker focus cue on actual knocked-down fighter missing");
 requireProof(states.every(x=>x.playerHp===100&&x.playerGuard===100),
   "M153 original hit is knockdown only with no HP/guard damage");
 const report=views.map((v,i)=>{
   requireProof(v.probeInstalled===true&&v.serverConnected===true
     &&v.netId===ids[i],"native source proof missing or not server connected: "+names[i]);
   requireProof(Array.isArray(v.draws)&&v.draws.length>0,
     "must paint original V3 Silver kick in "+names[i]);
   const counts={windup:0,active:0,recovery:0};
   for(const e of v.draws){
     requireProof(e.sourceFile===expectedSourceFile,
       "old V2 or substituted source art in "+names[i]);
     requireProof(Number.isInteger(e.frame)&&e.frame>=0&&e.frame<=7
       &&Number.isInteger(e.direction)&&e.direction>=0&&e.direction<=7
       &&Number.isFinite(e.epochMs),"invalid native original-source crop/clock");
     counts[e.frame<=2?"windup":e.frame<=4?"active":"recovery"]++;
   }
   requireProof(counts.windup>0&&counts.recovery>0,
     "kick source must show authenticated windup and recovery in "+names[i]);
   return {browser:names[i],serverId:ids[i],drawCount:v.draws.length,counts};
 });
 requireProof(report[0].counts.active>0,
   "kicker's real browser must paint active V3 original source atlas");
 return {realAuthoritativeThreePlayerKickKnockdown:true,
   exactObservedSourceFile:expectedSourceFile,
   realSilverV3SourceAllThreeBrowsers:true,knockedDownServerId:ids[1],
   attackerServerId:ids[0],bystanderServerId:ids[2],
   browsers:report,nonDamagingKick:true,
   worldBootSoleContactValidated:false,
   authoritativeDamageReceiptValidated:false,
   exactServerKickCollisionPointValidated:false,
   humanOperatedPlayers:false,preAlphaEnabled:false,
   productionDeploymentApproved:false};
}
