import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT, createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";
import { createDirectionalDash } from "../src/browser/dash-input.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";

test("R2 heavy damage is authoritative up to displayed 130 reach plus fighter radius, light misses same target", () => {
  assert.equal(COMBAT.heavyAttack.reach, 130);
  const fighter = createFighter({id:"a",x:200,y:200,facing:0});
  const target = createFighter({id:"b",x:338,y:200,facing:Math.PI});
  const world = createWorld({width:800,height:500,fighters:[fighter,target]});
  fighter.action = "attack_active";
  fighter.actionDurationMs=1000;
  stepWorld(world,{},1000/120);
  assert.equal(target.hp,100,"light's 94-unit max center distance cannot hit");
  fighter.action="heavy_attack_active";
  fighter.actionElapsedMs=0;
  fighter.actionDurationMs=1000;
  stepWorld(world,{},1000/120);
  assert.equal(target.hp,54,"heavy reaches center distance 138 within 148px visual arc");
});

test("R2 roll collision knocks down for 520ms rather than 260ms",()=>{
  assert.equal(COMBAT.dodge.collisionKnockdownMs,520);
  const roller=createFighter({id:"a",x:200,y:200,facing:0});
  const victim=createFighter({id:"b",x:236,y:200,facing:Math.PI});
  const world=createWorld({width:800,height:500,fighters:[roller,victim]});
  stepWorld(world,{a:{dodge:true,aimX:400,aimY:200}},1000/120);
  assert.equal(victim.action,"knockdown");
  for(let i=0;i<36;i++)stepWorld(world,{},1000/120);
  assert.equal(victim.action,"knockdown","300ms must still be knocked down");
  for(let i=0;i<40;i++)stepWorld(world,{},1000/120);
  assert.equal(victim.action,"idle","recovered after 520ms");
});

test("R2 continuous middle-block input halves movement, not an artificial speed boost",()=>{
  assert.equal(COMBAT.block.moveMultiplier,0.5);
  const blocker=createFighter({id:"a",x:200,y:200,facing:0});
  const world=createWorld({width:800,height:500,fighters:[blocker]});
  stepWorld(world,{a:{moveX:1,block:true}},100);
  assert.equal(blocker.action,"block");
  assert.ok(Math.abs(blocker.x-210.75)<0.001);
  stepWorld(world,{a:{moveX:1,block:true}},100);
  assert.equal(blocker.action,"block");
  stepWorld(world,{a:{block:false}},100);
  assert.equal(blocker.action,"idle");
});

test("R2 dash gesture requires two distinct same-key presses and respects 3s cooldown",()=>{
  const g=createDirectionalDash();
  assert.equal(g.press("KeyW",100),null);
  assert.deepEqual(g.press("KeyW",275),{x:0,y:-1});
  assert.equal(g.press("KeyA",320),null);
  assert.equal(g.press("KeyA",490),null);
  assert.equal(g.cooldownRemaining(1000),2275);
  assert.equal(g.press("KeyD",3274),null);
  assert.equal(g.press("KeyD",3300)?.x,1);
  assert.equal(g.press("KeyS",6000,true),null);
});

test("R2 packet dash uses only free bit7 and retains old 34-byte format",()=>{
  const packet=encodeInputPacket({sequence:10,clientTick:50,samples:[
    {tick:50,moveX:0,moveY:-1,dash:true},
    {tick:49,dodge:true},{tick:48,attack:true},
  ]});
  assert.equal(packet.byteLength,34);
  assert.equal(inputPacketBytes(),34);
  assert.equal(decodeInputPacket(packet).samples[0].dash,true);
  assert.equal(decodeInputPacket(packet).samples[1].dash,false);
  assert.equal(decodeInputPacket(packet).samples[2].attack,true);
});

test("R2 server-style dash travels along input direction independent of mouse facing with server cooldown",()=>{
  const fighter=createFighter({id:"a",x:300,y:300,facing:0});
  const world=createWorld({width:800,height:600,fighters:[fighter]});
  stepWorld(world,{a:{dash:true,moveY:-1,aimX:500,aimY:300}},1000/120);
  assert.equal(fighter.action,"dash");
  assert.ok(fighter.y<300);
  assert.equal(fighter.dashDirX,0);
  assert.equal(fighter.dashDirY,-1);
  assert.equal(fighter.dashReadyAtMs,world.nowMs+3000);
  const initialCooldown=fighter.dashReadyAtMs;
  for(let i=0;i<30;i++)stepWorld(world,{a:{moveX:1}},1000/120);
  assert.equal(fighter.action,"idle");
  stepWorld(world,{a:{dash:true,moveX:1}},1000/120);
  assert.equal(fighter.action,"idle","spam before 3 seconds is rejected");
  assert.equal(fighter.dashReadyAtMs,initialCooldown);
  for(let i=0;i<340;i++)stepWorld(world,{a:{}},1000/120);
  stepWorld(world,{a:{dash:true,moveX:1}},1000/120);
  assert.equal(fighter.action,"dash");
  assert.equal(fighter.dashDirX,1);
});

test("R2 controls are present in both browser clients",()=>{
  for(const name of ["game.mjs","online-game.mjs"]){
    const src=readFileSync(new URL("../web/"+name,import.meta.url),"utf8");
    assert.match(src,/event\.button === 1/);
    assert.match(src,/middleBlockHeld/);
    assert.match(src,/dashGesture\.press/);
    assert.match(src,/leftButtonCharge\.press/);
  }
});

test("R2 authoritative transport retains the true dash flag before redundancy/packet encoding",()=>{
  const src=readFileSync(new URL("../web/authoritative-client.mjs",import.meta.url),"utf8");
  assert.match(src,/dash: Boolean\(sample\.dash\)/);
  assert.match(src,/samples: \[\.\.\.inputSamples\]\.reverse\(\)/);
  const recon=readFileSync(new URL("../src/browser/reconciliation.mjs",import.meta.url),"utf8");
  assert.match(recon,/dash: Boolean\(input\.dash\)/);
});

test("R2 native light flight uses a real short tap instead of accidental heavy hold",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=source.indexOf("async function performArenaAttackHold(");
  const end=source.indexOf("\nasync function ",start+30);
  const helper=source.slice(start,end);
  assert.match(helper,/Math\.max\(20, Math\.min\(35, Math\.trunc\(holdMs\)\)\)/);
  assert.match(helper,/pointerDown", button: 0/);
  assert.match(helper,/pointerUp", button: 0/);
  assert.match(helper,/pause", duration: boundedHoldMs/);
});
