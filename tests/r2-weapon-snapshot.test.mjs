import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeProjectileSnapshot, MAX_VISIBLE_PROJECTILES, MAX_VISIBLE_DISARMED } from "../src/network/projectile-snapshot-codec.mjs";
function packet({type=6, count=1, disarmed=1, tick=300, ownMs=29_000}={}){
 const bytes=new Uint8Array(12+16*count+6*disarmed);
 const view=new DataView(bytes.buffer);
 view.setUint8(0,1);view.setUint8(1,type);view.setUint8(2,count);view.setUint8(3,disarmed);
 view.setUint32(4,tick,true);view.setUint16(8,ownMs,true);
 if(count){
  view.setUint32(12,7,true);view.setUint32(16,1,true);
  view.setUint16(20,400,true);view.setUint16(22,800,true);
  view.setUint16(24,0,true);view.setUint16(26,900,true);
 }
 if(disarmed){
  const off=12+16*count;
  view.setUint32(off,1,true);view.setUint16(off+4,30,true);
 }
 return bytes;
}
test("R2 F projectile snapshot encodes server-owned flight and disarm without fighter record mutation",()=>{
 const result=decodeProjectileSnapshot(packet());
 assert.equal(result.serverTick,300);
 assert.equal(result.ownDisarmRemainingMs,29_000);
 assert.equal(result.projectiles.size,1);
 assert.equal(result.projectiles.get(7).owner,1);
 assert.equal(result.projectiles.get(7).x,100);
 assert.equal(result.projectiles.get(7).y,200);
 assert.equal(result.projectiles.get(7).remainingSeconds,900);
 assert.equal(result.disarmed.get(1),30_000);
});
test("R2 F zero-projectile snapshot promptly clears previously visible thrown weapons",()=>{
 const empty=decodeProjectileSnapshot(packet({count:0,disarmed:0,ownMs:0,tick:309}));
 assert.equal(empty.projectiles.size,0);
 assert.equal(empty.disarmed.size,0);
 assert.equal(empty.ownDisarmRemainingMs,0);
});
test("R2 F rejects malformed untrusted datagrams and duplicate projectile identities",()=>{
 const bytes=packet();
 assert.throws(()=>decodeProjectileSnapshot(bytes.subarray(0,bytes.length-1)),/length/);
 const oversized=packet({count:MAX_VISIBLE_PROJECTILES+1,disarmed:0});
 assert.throws(()=>decodeProjectileSnapshot(oversized),/budget/);
 const excessiveDisarmed=packet({count:0,disarmed:MAX_VISIBLE_DISARMED+1});
 assert.throws(()=>decodeProjectileSnapshot(excessiveDisarmed),/budget/);
 assert.throws(()=>decodeProjectileSnapshot(packet({type:2})),/not weapon/);
});
test("R2 F authoritative client decodes real projectile snapshots and renderer shows thrown/disarmed weapons",()=>{
 const client=readFileSync(new URL("../web/authoritative-client.mjs",import.meta.url),"utf8");
 const view=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(client,/packetType === PACKET_TYPE.PROJECTILES/);
 assert.match(client,/isTickNewer32\(update.serverTick, projectileServerTick\)/);
 assert.match(view,/drawThrownWeapon\(projectile\)/);
 assert.match(view,/networkClient\.weaponDisarmRemainingMs/);
 assert.match(view,/!isDisarmed\) drawWeaponTrail/);
});
