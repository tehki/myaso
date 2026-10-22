import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
// Accept only original W3C Canvas drawImage receipts layered on real M153.
// Never trigger a reaction from a cosmetic attacker pose or client mouse input.
const need=(ok,reason)=>{
 if(!ok)throw Error("Graphics3A original Silver victim gate: "+reason);
};
export function qualifyOriginalSilverVictimKnockdown({results,sourceReceipt,nativeClients}){
 need(sourceReceipt?.realAuthoritativeThreePlayerKickKnockdown===true
   &&sourceReceipt.realSilverV3SourceAllThreeBrowsers===true
   &&sourceReceipt.nonDamagingKick===true,
   "requires previously qualified THREE-player Rust-server V3 knockdown");
 need(Array.isArray(results)&&results.length===3
   &&Array.isArray(nativeClients)&&nativeClients.length===3,
   "three actual native browser game clients required");
 const names=["chrome","firefox","chrome2"];
 const roster=names.map(name=>results.find(x=>x.browser===name));
 const views=names.map(engine=>nativeClients.find(x=>x.engine===engine));
 need(roster.every(Boolean)&&views.every(Boolean),
   "actual native Chrome Firefox Chrome2 roles required");
 const ids=[roster[0].m153AttackerId,roster[1].m153KnockedDownId,
   roster[2].m153BystanderId];
 need(new Set(ids).size===3&&ids.every(x=>Number.isInteger(x)&&x>0),
   "distinct real positive server IDs");
 need(sourceReceipt.knockedDownServerId===ids[1]
   &&sourceReceipt.attackerServerId===ids[0]
   &&sourceReceipt.bystanderServerId===ids[2],
   "source proof server identities disagree with original knockdown");
 need(roster.every((x,i)=>x.acceptance?.playerNetId===ids[i]
   &&Number.isFinite(x.acceptance.serverTick)&&x.acceptance.serverTick>0),
   "authoritative browser server tick/identity missing");
 const victimActions=roster[1].acceptance.ownActionTransitions??[];
 need(victimActions.some(x=>x.action===COMBAT_ACTION.knockdown
     &&Number.isFinite(x.serverTick)&&x.serverTick>0),
   "victim did not receive server-issued knockdown action");
 need(!roster[0].acceptance.ownActionTransitions?.some(x=>x.action===COMBAT_ACTION.knockdown)
   &&!roster[2].acceptance.ownActionTransitions?.some(x=>x.action===COMBAT_ACTION.knockdown),
   "non-victim own action unexpectedly knockdown");
 const observations=views.map((client,index)=>{
  need(client.probeInstalled===true&&client.serverConnected===true
    &&client.netId===ids[index],"native renderer not independently connected "+names[index]);
  need(Array.isArray(client.draws)&&client.draws.length>=2,
    "original Silver victim WebP not rendered in "+names[index]);
  const distinct=new Set();
  for(const d of client.draws){
    need(d.sourceFile==="silver_knockdown.webp",
      "counterfeit source, static preview, or V2 substitution");
    need(Number.isInteger(d.frame)&&d.frame>=0&&d.frame<=7
      &&Number.isInteger(d.direction)&&d.direction>=0&&d.direction<=7
      &&Number.isFinite(d.epochMs)&&d.epochMs>0,
      "invalid native Canvas frame/direction/timestamp");
    distinct.add(d.frame);
  }
  need(distinct.size>=2,"must actually animate between different original source frames");
  return {browser:names[index],serverId:ids[index],
    sourceDraws:client.draws.length,distinctSourceFrames:distinct.size,
    firstFrame:Math.min(...distinct),lastFrame:Math.max(...distinct)};
 });
 return {verifiedRealThreePlayerOriginalSilverVictimReaction:true,
   realServerVictimId:ids[1],realServerAttackerId:ids[0],realServerObserverId:ids[2],
   originalSilverVictimSourceInAllNativeBrowsers:true,
   originalBlenderSourceOnlyOptIn:true,
   observations,
   full360MsEveryFrameObserved:false,
   realWorldSoleContactValidated:false,
   damageReceiptValidated:false,
   exactKickCollisionPointValidated:false,
   playerOperatedSmokePassed:false,
   preAlphaEnabled:false,productionReleaseApproved:false};
}
