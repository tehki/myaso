import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT, createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";
import { createDirectionalDash } from "../src/browser/dash-input.mjs";
import { encodeInputPacket, decodeInputPacket, inputPacketBytes } from "../src/network/input-codec.mjs";
import { createInputRedundancy } from "../src/network/input-redundancy.mjs";

test("heavy restores near-light attack range, physical forward lunge, and 320ms hold", () => {
  assert.equal(COMBAT.attack.reach, 76);
  assert.equal(COMBAT.heavyAttack.reach, 82);
  assert.equal(COMBAT.heavyAttack.lungeSpeed, 240);
  const a = createFighter({ id: "a", x: 200, y: 200, facing: 0 });
  const b = createFighter({ id: "b", x: 350, y: 200, facing: Math.PI });
  const world = createWorld({ width: 800, height: 500, fighters: [a, b] });
  a.action = "heavy_attack_active";
  a.actionDurationMs = 1000;
  stepWorld(world, {}, 100);
  assert.ok(Math.abs(a.x - 224) < 0.001, "heavy travels 24px towards cursor");
  assert.equal(b.hp, 100, "a distant victim cannot be hit by a 82px heavy arc");
  // Within the shortened arc, a correctly aimed heavy still damages once.
  b.x = a.x + 98;
  stepWorld(world, {}, 1000 / 120);
  assert.equal(b.hp, 54);
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
  assert.match(src, /const redundantSamples = inputRedundancy\.push\(normalized\)/);
  assert.match(src, /samples: redundantSamples/);
  // Assert the actual production redundancy helper keeps the physical dash
  // bit in the current tick's v1 wire bytes, including during edge pinning.
  const sender = createInputRedundancy();
  sender.push({tick:49,attack:false,dash:false});
  const sample = {tick:50,attack:true,heavyAttack:true,dash:true,moveX:1};
  const samples = sender.push(sample);
  const packet = decodeInputPacket(encodeInputPacket({sequence:1,clientTick:50,samples}));
  assert.equal(packet.samples[0].tick,50);
  assert.equal(packet.samples[0].dash,true);
  assert.equal(packet.samples[0].moveX,1);
  assert.equal(packet.samples[0].heavyAttack,true);
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

test("held heavy stays READY forever and only hits after server-authorized release", () => {
  const a = createFighter({ id: "a", x: 220, y: 260, facing: 0 });
  const b = createFighter({ id: "b", x: 295, y: 260, facing: Math.PI });
  const w = createWorld({ width: 800, height: 540, fighters: [a, b] });
  for (let i = 0; i < 7; i += 1) {
    stepWorld(w, { a: { attack: true, heavyAttack: true, aimX: 450, aimY: 260 } }, 100);
    assert.equal(a.action, "heavy_attack_windup", "holding must not auto-land");
    assert.equal(b.hp, 100, "charging cannot damage a target");
  }
  assert.equal(a.actionElapsedMs, 320, "authoritative windup clamps at READY");
  stepWorld(w, { a: { heavyAttack: true, aimX: 450, aimY: 260 } }, 1000 / 120);
  assert.equal(a.action, "heavy_attack_active");
  assert.equal(b.hp, 54, "release lands exactly one completed heavy");
  stepWorld(w, { a: { aimX: 450, aimY: 260 } }, 1000 / 120);
  assert.equal(b.hp, 54, "active frames cannot deal duplicate damage");
});

test("early release turns the held charge into light, or running strike with held RMB", () => {
  const a = createFighter({ id: "a", x: 220, y: 260, facing: 0 });
  const w = createWorld({ width: 800, height: 540, fighters: [a] });
  stepWorld(w, { a: { attack: true, heavyAttack: true, aimX: 450, aimY: 260 } }, 100);
  assert.equal(a.action, "heavy_attack_windup");
  stepWorld(w, { a: { attack: true, aimX: 450, aimY: 260 } }, 1000 / 120);
  assert.equal(a.action, "attack_windup", "undercharged release is not heavy");
  const runner = createFighter({ id: "runner", x: 320, y: 260, facing: 0 });
  const ww = createWorld({ width: 800, height: 540, fighters: [runner] });
  stepWorld(ww, { runner: { attack: true, heavyAttack: true, run: true, moveX: 1, aimX: 450, aimY: 260 } }, 100);
  assert.equal(runner.action, "heavy_attack_windup");
  stepWorld(ww, { runner: { attack: true, run: true, moveX: 1, aimX: 450, aimY: 260 } }, 1000 / 120);
  assert.equal(runner.action, "running_attack_windup", "held RMB and moving + LMB release should attack");
});

test("cancel held charge without attacking, standalone E retains original windup", () => {
  const f = createFighter({ id: "a", x: 220, y: 260 });
  const world = createWorld({ fighters: [f] });
  stepWorld(world, { a: { attack: true, heavyAttack: true } }, 50);
  stepWorld(world, { a: {} }, 1000 / 120);
  assert.equal(f.action, "idle");
  stepWorld(world, { a: { heavyAttack: true } }, 1000 / 120);
  assert.equal(f.action, "heavy_attack_windup");
});
