/**
 * Graphics 3A — presentation-only monotonic item visibility gate (experimental).
 *
 * This is NOT equipment authority, a validated Core receipt, a network
 * protocol, an authorization claim or production activation. A string
 * provenance label alone can always be spoofed by untrusted browser code.
 *
 * A future Core decoder must own the verified per-character stream. Only
 * snapshots delivered at that trusted boundary may be passed to ingest().
 * It rejects old/out-of-order snapshots, same-revision contradictory data and
 * late messages from older authenticated session generations. Fail CLOSED.
 */
import {planSilverCommittedSword} from "./silver-committed-mainhand-visual.mjs";
const cleanString=v=>typeof v==="string"&&v.length>0&&v.length<=160&&
  v.trim()===v&&!/[\x00-\x1f]/.test(v);
const natural=v=>Number.isSafeInteger(v)&&v>=0;
const generation=v=>natural(v)&&v>0;
function parseSnapshot(snapshot,actorKey){
  if(!snapshot||typeof snapshot!=="object"||
    !cleanString(actorKey)||snapshot.actorKey!==actorKey||
    snapshot.provenance!=="core-items-committed-snapshot"||
    !generation(snapshot.sessionEpoch)||
    !natural(snapshot.snapshotRevision)||!natural(snapshot.serverTick))
    return null;
  const item=snapshot.mainHand;
  if(item!==null){
    if(!item||typeof item!=="object"||item.slot!=="MainHand"||
       item.location!=="equipped"||item.visualKind!=="sword"||
       !cleanString(item.itemId)||item.ownerActorKey!==actorKey||
       !natural(item.revision)||!generation(item.committedSequence))
      return null;
  }
  return {epoch:snapshot.sessionEpoch,revision:snapshot.snapshotRevision,
    tick:snapshot.serverTick,signature:item===null?"EMPTY":
      JSON.stringify([item.itemId,item.revision,item.committedSequence,
        item.slot,item.location,item.visualKind,item.ownerActorKey]),
    armed:item!==null};
}
export function createSilverMainHandRevisionGuard({maxActors=16}={}){
  if(!Number.isInteger(maxActors)||maxActors<1||maxActors>256)
    throw new RangeError("Presentation cache must have a finite actor cap");
  const highWater=new Map();
  function ingest(snapshot,actorKey){
    const candidate=parseSnapshot(snapshot,actorKey);
    if(!candidate)return Object.freeze({accepted:false,reason:"untrusted-or-unknown-shape",armed:false});
    const prev=highWater.get(actorKey);
    if(!prev){
      if(highWater.size>=maxActors)
        return Object.freeze({accepted:false,reason:"bounded-cache-full",armed:false});
      highWater.set(actorKey,{...candidate,conflict:false});
      return Object.freeze({accepted:true,reason:"new-revision",armed:candidate.armed});
    }
    if(candidate.epoch<prev.epoch)
      return Object.freeze({accepted:false,reason:"stale-session",armed:false});
    if(candidate.epoch===prev.epoch &&
      (candidate.revision<prev.revision||
       (candidate.revision===prev.revision&&candidate.tick<prev.tick)))
      return Object.freeze({accepted:false,reason:"stale-revision-or-tick",armed:false});
    // Even across an authenticated reconnect, one revision MUST identify
    // one item state. Different MainHand content at identical revision is
    // not repaired by a different session epoch or a later server tick.
    if(candidate.revision===prev.revision&&candidate.signature!==prev.signature){
      prev.conflict=true;
      prev.epoch=Math.max(prev.epoch,candidate.epoch);
      prev.tick=Math.max(prev.tick,candidate.tick);
      return Object.freeze({accepted:false,reason:"conflicting-same-revision",armed:false});
    }
    if(prev.conflict&&candidate.revision===prev.revision){
      prev.epoch=Math.max(prev.epoch,candidate.epoch);
      prev.tick=Math.max(prev.tick,candidate.tick);
      return Object.freeze({accepted:false,reason:"quarantined-revision",armed:false});
    }
    if(candidate.epoch===prev.epoch&&candidate.revision===prev.revision){
      // A newer tick is not evidence of a changed item at an identical
      // snapshot revision. Contradictions are quarantined until a genuinely
      // higher revision arrives (not simply a later same-revision tick).
      prev.tick=Math.max(prev.tick,candidate.tick);
      return Object.freeze({accepted:true,reason:"consistent-repetition",armed:candidate.armed});
    }
    // A later revision from the same session cannot come from an older
    // server tick. A reconnect can change tick epoch only when Core explicitly
    // proves the newer authenticated generation.
    if(candidate.epoch===prev.epoch&&candidate.tick<prev.tick)
      return Object.freeze({accepted:false,reason:"stale-tick",armed:false});
    // A later authenticated session epoch is permitted, but cannot revive a
    // lower item revision. Old-epoch delivery is rejected even if tick goes up.
    if(candidate.revision<prev.revision)
      return Object.freeze({accepted:false,reason:"revision-rollback-on-reconnect",armed:false});
    highWater.set(actorKey,{...candidate,conflict:false});
    return Object.freeze({accepted:true,reason:"new-revision-or-session",armed:candidate.armed});
  }
  return Object.freeze({
    /**
     * A null plan means no sword, including delayed stale equipped snapshots.
     * Mutates only this private presentation cache. It never mutates the
     * supplied Core equipment snapshot, game state, pickup or inventory.
     */
    plan(props){
      if(!props||props.actorKind!=="player")return null;
      const gate=ingest(props.equipmentSnapshot,props.actorKey);
      if(!gate.accepted||!gate.armed)return null;
      return planSilverCommittedSword(props);
    },
    ingest,
    audit(actorKey){
      const row=highWater.get(actorKey);
      if(!row)return null;
      return Object.freeze({sessionEpoch:row.epoch,
        snapshotRevision:row.revision,serverTick:row.tick,
        armed:row.armed&&!row.conflict,quarantined:row.conflict});
    },
    size(){return highWater.size;}
  });
}
