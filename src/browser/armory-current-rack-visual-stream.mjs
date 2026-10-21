/**
 * Graphics 3B P0: READ-ONLY proposed current rack occupancy -> source art.
 *
 * Accepts a normalized UI-side *candidate* view similar to Core C3u (#577):
 * four ordered Option<CurrentRackCandidate>, local journal_sequence,
 * stable socket, separate ground-entity and item identity, mutation sequence.
 * Rust C3u is still dormant; this is NOT its wire schema or an authenticated
 * snapshot, and it never initiates/mints a pickup or changes an inventory.
 */
import {createWorld493RackArtPlan} from "./armory-world493-visual-bridge.mjs";
export const CURRENT_RACK_VISUAL_PROPOSAL=Object.freeze({
  sourceCorePr:577,
  writerAuthorization:false,
  networkEnvelopeDefined:false,
  epochOrZoneScaleApproved:false,
  realServerDataConnected:false,
  productionApproved:false,
});
const U64_MAX=(1n<<64n)-1n;
function u64(s,{zero=true}={}) {
 if(typeof s!=="string"||!/^(0|[1-9][0-9]*)$/.test(s))
  throw new RangeError("Expected lossless unsigned decimal sequence string");
 const n=BigInt(s);
 if(n>U64_MAX||(!zero&&n===0n))
  throw new RangeError("Journal or item sequence out of u64 range");
 return n;
}
function text(s) {return typeof s==="string"&&s.length>0&&s.length<=160;}
function identical(a,b) {return JSON.stringify(a)===JSON.stringify(b);}
const freeze=obj=>Object.freeze(obj);
export function createProposedCurrentRackVisualStream({
 worldArmory,authoredMap,layoutVersion,camera,scopeKey
}={}) {
 if(!text(scopeKey)||!worldArmory||
   !Array.isArray(worldArmory.rackSockets)||
   worldArmory.rackSockets.length!==4)
  throw new TypeError("External World four-rack and presentation scope required");
 // Ask original World 9 bridge to inspect real authored world geometry once.
 // An empty item list is legal: no implicit/default/crafted swords.
 createWorld493RackArtPlan({worldArmory,authoredMap,layoutVersion,
  committedWorldItems:[],camera});
 const worldSockets=worldArmory.rackSockets.map(s=>s.socketId);
 const seenMutation=new Map();
 const previouslyPresent=new Set();
 let current=null,lastSequence=null,lastCanonical=null;
 function apply(snapshot){
  if(!snapshot||snapshot.scopeKey!==scopeKey||
    !Array.isArray(snapshot.slots)||snapshot.slots.length!==4)
   throw new RangeError("Exact four-slot same-scope candidate view required");
  const seq=u64(snapshot.journalSequence);
  const entries=[],seenItems=new Set(),seenGrounds=new Set();
  for(let i=0;i<4;i++){
   const slot=snapshot.slots[i];
   if(slot===null)continue; // Core's None means absence, NOT a respawn.
   if(!slot||slot.socketId!==worldSockets[i]||
     !text(slot.itemId)||!text(slot.groundEntityId)||
     slot.itemId===slot.groundEntityId||
     seenItems.has(slot.itemId)||seenGrounds.has(slot.groundEntityId))
    throw new RangeError("Unapproved, duplicated or swapped rack candidate");
   const mutation=u64(slot.itemMutationSequence,{zero:false});
   if(mutation>seq)
    throw new RangeError("Item mutation cannot be newer than journal");
   if(mutation>BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError("Existing UI numeric revision cannot represent full u64");
   seenItems.add(slot.itemId);
   seenGrounds.add(slot.groundEntityId);
   entries.push(freeze({
    itemId:slot.itemId,socketId:slot.socketId,
    visualKind:"sword",location:"rack",zoneId:worldArmory.mapId,
    revision:Number(mutation)
   }));
  }
  const canonical=JSON.stringify({
   sequence:snapshot.journalSequence,
   slots:snapshot.slots.map(x=>x===null?null:({
    socketId:x.socketId,itemId:x.itemId,
    groundEntityId:x.groundEntityId,
    mutationSequence:x.itemMutationSequence
   }))
  });
  if(lastSequence!==null && seq<lastSequence)
   return freeze({status:"stale",view:current,sourceAuthenticated:false});
  if(lastSequence!==null && seq===lastSequence){
   if(canonical!==lastCanonical)
    throw new RangeError("Same journal head advertised inconsistent slots");
   return freeze({status:"duplicate",view:current,sourceAuthenticated:false});
  }
  // A returned item at the same socket must carry a newer durable mutation.
  // This is only a visual defense in depth, not single-writer attestation.
  for(const item of entries){
   const key=item.socketId+"|"+item.itemId;
   if(seenMutation.has(key) &&
      (item.revision<seenMutation.get(key)||
       (item.revision===seenMutation.get(key)&&
        !previouslyPresent.has(key))))
    throw new RangeError("Item mutation regressed or ghost-returned after absence");
  }
  const plan=createWorld493RackArtPlan({worldArmory,authoredMap,
   layoutVersion,committedWorldItems:entries,camera});
  previouslyPresent.clear();
  for(const item of entries){
   const key=item.socketId+"|"+item.itemId;
   seenMutation.set(key,item.revision);
   previouslyPresent.add(key);
  }
  lastSequence=seq;
  lastCanonical=canonical;
  current=freeze({
   journalSequence:snapshot.journalSequence,scopeKey,
   plan,visibleIds:freeze(entries.map(x=>x.itemId)),
   actualAuthoritativeItemsVerified:false,
   gameRendererIntegrated:false,
   productionApproved:false,
  });
  return freeze({status:"accepted",view:current,sourceAuthenticated:false});
 }
 return freeze({
  apply,
  getView:()=>current,
  worldAuthoredSockets:freeze([...worldSockets]),
  streamLifetimeAuthority:"caller-must-reset-only-after-trusted-reconnect",
  actualNetworkSnapshotIntegrated:false,
  productionApproved:false
 });
}
