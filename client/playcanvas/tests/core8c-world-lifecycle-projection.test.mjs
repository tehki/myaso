import test from 'node:test';
import assert from 'node:assert/strict';
import {quantizeEntity,buildEntityDelta,encodeSnapshot,decodeSnapshot}
  from '../../../src/network/snapshot-codec.mjs';
import {applySnapshotPacketInPlace}
  from '../../../src/browser/snapshot-store.mjs';
import {createAuthoritativeSnapshotView}
  from '../src/scene/authoritative-snapshot-view.mjs';

// Codec/view CONTRACT fixture only. This is NOT an observed live death,
// a live PlayCanvas respawn, or a network map authorization token.
test('original Rust packet projection preserves NetID across dead -> respawn, never locally simulates life',()=>{
  const source=new Map(),events=[];
  const view=createAuthoritativeSnapshotView({
    create(pose){events.push(['create',pose]);return {id:pose.netId};},
    update(handle,pose){events.push(['update',handle.id,pose]);},
    remove(handle){events.push(['remove',handle.id]);}
  });
  const initial=quantizeEntity({netId:7,x:4110,y:4160,action:'idle',
    hp:100,guard:100,stamina:100,facing:0});
  const dead=quantizeEntity({netId:7,x:4300,y:4190,action:'dead',
    hp:0,guard:0,stamina:0,facing:1.5});
  const newLife=quantizeEntity({netId:7,x:4110,y:4160,action:'idle',
    hp:100,guard:100,stamina:100,facing:0});
  const packets=[
    encodeSnapshot({sequence:1,serverTick:100,full:true,
      records:[buildEntityDelta(initial)]}),
    encodeSnapshot({sequence:2,serverTick:300,full:true,
      records:[buildEntityDelta(dead)]}),
    encodeSnapshot({sequence:3,serverTick:700,full:true,
      records:[buildEntityDelta(newLife)]})
  ];
  for(const packet of packets){
    const wire=decodeSnapshot(packet);
    assert.equal(Object.hasOwn(wire,'mapId'),false);
    assert.equal(Object.hasOwn(wire,'worldIncarnation'),false);
    applySnapshotPacketInPlace(source,packet);
    assert.deepEqual(view.reconcile(source,null),{count:1});
  }
  assert.deepEqual(events.map(e=>e[0]),['create','update','update']);
  assert.equal(events[0][1].netId,7);
  assert.equal(events[0][1].isOwn,false,'no processed input ACK, no own NetID guess');
  assert.equal(events[1][2].hp,0);
  assert.equal(events[1][2].action,8,'display server-dead code; never auto-resurrect');
  assert.equal(events[2][2].hp,100,'only the NEXT original snapshot revives the silhouette');
  assert.equal(events[2][2].action,0);
  assert.equal(events[2][2].position.x,-.75);
  assert.equal(events[2][2].position.z,1.375);
  assert.equal(events[2][2].serverTick,700);

  // Actual authoritative removal must delete the old actor handle.
  const removed=encodeSnapshot({sequence:4,serverTick:701,full:true,records:[]});
  applySnapshotPacketInPlace(source,removed);
  view.reconcile(source,null);
  assert.deepEqual(events.at(-1),['remove',7]);
  assert.equal(view.count,0);
  const joined=quantizeEntity({netId:8,x:4206,y:4160,action:'idle',hp:100});
  applySnapshotPacketInPlace(source,encodeSnapshot({sequence:5,
    serverTick:702,full:true,records:[buildEntityDelta(joined)]}));
  view.reconcile(source,null);
  assert.equal(events.at(-1)[0],'create');
  assert.equal(events.at(-1)[1].netId,8,'rejoin is a new NetID, not same-session respawn');
});
