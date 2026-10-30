import {isTickNewer32} from "./reconciliation.mjs";

const tick=value=>Number.isInteger(value)&&value>=0&&value<=0xffffffff;
const reached=(current,prior)=>tick(current)&&tick(prior)
  &&(current===prior||isTickNewer32(current,prior));

// Presentation only. A typed ACK is not proof that World committed an attack.
// One bounded attempt waits for that same lease/actor's original input ACK
// and a real World snapshot showing Jump-only exhaustion. Never sends input.
export function createTypedJumpStaminaFeedback() {
 let originalJump=null,pending=null;
 function reset(){originalJump=null;pending=null;}
 return Object.freeze({
  reset,
  originalJump(input){
   originalJump=input&&input.action===0&&tick(input.clientTick)
    &&Number.isFinite(input.stamina)&&Number.isFinite(input.now)?{...input}:null;
  },
  press({jump,trusted,spaceHeld,pointerId,gestureId,sequence,actorId,lease,now,stamina}){
   const original=originalJump;
   originalJump=null; // one original Space can label at most one physical LMB
   pending=null;
   if(!jump||trusted!==true||!lease||!Number.isSafeInteger(actorId)||actorId<1
      ||!Number.isSafeInteger(gestureId)||gestureId<1||!Number.isSafeInteger(sequence)||sequence<1
      ||!Number.isFinite(now)||!Number.isFinite(stamina))return;
   const chord=spaceHeld===true&&original&&original.lease===lease&&original.actorId===actorId
    &&now>=original.now&&now-original.now<=60;
   const baseline=chord?original.stamina:stamina,cost=chord?26:12;
   if(baseline<0||baseline>=cost)return;
   pending={pointerId,gestureId,sequence,actorId,lease,until:now+900,
    action:chord?"jump-attack-chord":"jump-attack",originalTick:chord?original.clientTick:null,
    receiptTick:null};
  },
  cancel(pointerId){if(pending?.pointerId===pointerId)pending=null;},
  acknowledge(receipt,lease){
   if(!pending||lease!==pending.lease||receipt?.source!==0
      ||receipt.gestureId!==pending.gestureId)return;
   if(receipt.action===4){pending=null;return;}
   if(receipt.action!==5||receipt.sequence!==pending.sequence)return;
   if(!receipt.transportSettled||![1,2].includes(receipt.status)||!tick(receipt.serverTick)){
    pending=null;return;
   }
   pending.receiptTick=receipt.serverTick;
  },
  observe({own,lease,alive,focused,serverTick,processedClientTick,now}){
   if(!pending)return null;
   if(!alive||!focused||lease!==pending.lease||own?.netId!==pending.actorId
      ||!Number.isFinite(now)||now>pending.until||own.hp<=0){reset();return null;}
   if(pending.receiptTick===null||!reached(serverTick,pending.receiptTick))return null;
   if(pending.originalTick!==null&&!reached(processedClientTick,pending.originalTick))return null;
   if(!Number.isFinite(own.stamina))return null;
   // A genuine Jump with less than12 cannot afford conversion. For a new
   // chord below14, original input must already have been processed in Idle.
   const exhausted=own.action===15&&own.stamina<12
    ||pending.action==="jump-attack-chord"&&own.action===0&&own.stamina<14;
   if(!exhausted){if(own.action!==0&&own.action!==15)pending=null;return null;}
   const result=Object.freeze({action:pending.action,stamina:own.stamina});
   pending=null;
   return result;
  },
 });
}
