import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { encodeInputPacket, decodeInputPacket } from "../src/network/input-codec.mjs";

test("F throw is a separate reserved header bit without altering 34-byte legacy input wire",()=>{
 const packet=encodeInputPacket({sequence:12,clientTick:1234,throwWeapon:true,samples:[
  {tick:1234,moveX:0.4,moveY:0.5,facing:1.12,dash:true},
  {tick:1233,moveX:0.3,moveY:0.3},
  {tick:1232},
 ]});
 const bytes=new Uint8Array(packet);
 assert.equal(bytes.length,34);
 assert.equal(bytes[3],1);
 const decoded=decodeInputPacket(packet);
 assert.equal(decoded.throwWeapon,true);
 assert.equal(decoded.samples[0].dash,true);
 assert.ok(Math.abs(decoded.samples[0].facing-1.12)<0.001);
 const normal=encodeInputPacket({sequence:13,clientTick:1235,samples:[{tick:1235}]});
 assert.equal(decodeInputPacket(normal).throwWeapon,false);
 assert.equal(new Uint8Array(normal)[3],0);
 bytes[3]=2;
 assert.throws(()=>decodeInputPacket(packet),/unknown input header flags/);
});
test("F is an original keyboard edge and not an injected synthetic attack",()=>{
 const ui=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const client=readFileSync(new URL("../web/authoritative-client.mjs",import.meta.url),"utf8");
 assert.match(ui,/event\.code === "KeyF" && !event\.repeat/);
 assert.match(ui,/throwWeaponRequested/);
 assert.match(client,/pendingThrowReplicas = 3/);
 assert.match(client,/throwWeapon: true/);
});
