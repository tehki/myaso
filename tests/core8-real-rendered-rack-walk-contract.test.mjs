import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS,validateWorldAlphaArmoryLayout} from "../src/world/alpha-armory.mjs";

const game=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const flight=readFileSync(new URL("../scripts/alpha_p0_four_native_rendered_rack_walk.mjs",import.meta.url),"utf8");

test("read-only actual network state probe requires localhost original rack plus explicit opt-in",()=>{
 assert.match(game,/nativeRackWalkProbeEnabled = armoryRackReviewEnabled/);
 assert.match(game,/params\.get\("nativeRackWalkProbe"\) === "1" && !params\.has\("scenario"\)/);
 assert.match(game,/\["localhost","127\.0\.0\.1","\[::1\]"\]/);
 assert.match(game,/window\.__MYASO_NATIVE_RACK_WALK_READONLY__/);
 assert.match(game,/Object\.freeze\(\[\.\.\.networkClient\.state\.values\(\)\]/);
 assert.match(flight,/acceptance:!!window\\.__MYASO_ACCEPTANCE_STATE__/);
 assert.match(flight,/!s\\.scenario&&!s\\.acceptance/);
});

test("actual original rack flight creates four genuine native drivers and no synthetic sword objects",()=>{
 assert.match(flight,/const browsers=\[\{name:"chrome-1"/);
 assert.match(flight,/\{name:"firefox-2"/);
 assert.match(flight,/\{name:"chrome-3"/);
 assert.match(flight,/\{name:"firefox-4"/);
 assert.match(flight,/searchParams\.set\("world","1"\)/);
 assert.match(flight,/searchParams\.set\("armoryart","1"\)/);
 assert.match(flight,/searchParams\.set\("nativeRackWalkProbe","1"\)/);
 assert.match(flight,/!u\.searchParams\.has\("scenario"\)/);
 assert.match(flight,/s\.armory\.drawnSwords===0/);
 assert.match(flight,/serverTryPickup===false/);
});

test("each movement is actual WebDriver keyboard action checked by later Rust tick",()=>{
 assert.match(flight,/const pulse=nextNativeWalkPulse\(actor\[axis\],target\)/);
 assert.match(flight,/nativeHoldKey\(s,key,pulse\.holdMs\)/);
 assert.match(flight,/type:"keyDown"/);
 assert.match(flight,/type:"keyUp"/);
 assert.match(flight,/value\.rackWalk\.tick>before\.rackWalk\.tick/);
 assert.match(flight,/if\(stalled>=3\)throw Error/);
 assert.doesNotMatch(flight,/fighter\.(?:x|y)\s*=/);
});

test("source World four racks remain exactly distinct; only direct selected coordinates accepted",()=>{
 assert.equal(validateWorldAlphaArmoryLayout(),true);
 assert.equal(WORLD_ALPHA_SWORD_RACK_SOCKETS.length,4);
 assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>s.approach.x),[3740,3780,3820,3860]);
 assert.ok(WORLD_ALPHA_SWORD_RACK_SOCKETS.every(s=>s.approach.y===4088));
 assert.match(flight,/nativeRackArrived\(nativeFighter\(state,index\+1\),slot\.approach\)/);
 assert.match(flight,/ALPHA_P0_FOUR_REAL_RENDERED_BLACKSMITH_WALK_PASS/);
});

test("read-only fixture never becomes an item command or production network listener",()=>{
 assert.match(flight,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(flight,/MYASO_MAX_PLAYERS:"4"/);
 assert.match(flight,/MYASO_ALPHA_STATIC_COLLISION:"reviewed-static-only"/);
 assert.match(flight,/canonicalItemFeed:false/);
 assert.match(flight,/noInventedItemIds:true/);
 assert.doesNotMatch(game,/window\.__MYASO_NATIVE_RACK_WALK_READONLY__\s*=\s*\(.*\)=>\s*\{[^]*?networkClient\.send/i);
});
