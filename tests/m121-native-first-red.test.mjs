import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {summarizeM121NativeFirstRed} from "../scripts/m121-native-first-red.mjs";

const pointer = (type, epochMs, trusted = true) =>
  ({type,button:0,pointerId:0,epochMs,trusted});
const action = (action,serverTick) => ({action,serverTick});
const send = (clientTick,heavyAttack) => ({clientTick,attack:true,heavyAttack});

test("M121 first RED differentiates the real delayed 239ms physical hold and server Heavy", () => {
  const result=summarizeM121NativeFirstRed({
    actorId:2,physicalPointers:[pointer("pointerdown",1000),pointer("pointerup",1239)],
    worldActions:[action(9,323),action(24,326),action(25,334),action(26,339)],
    senderSamples:[send(98,true),send(105,false)],
  });
  assert.equal(result.actualHoldMs,239);
  assert.equal(result.nativeHoldAtLeast135Ms,true);
  assert.equal(result.nativeHoldOverRequested,true);
  assert.equal(result.heavyWorldObserved,true);
  assert.deepEqual(result.sentHeavyTicks,[98]);
  assert.equal(result.verdict,"ORIGINAL_WORLD_HEAVY_DURING_LIGHT_TRIAL");
  assert.equal(result.pass,false);
});

test("M121 diagnostic is read-only and never promotes a true Light or missing physical proof", () => {
  const light=summarizeM121NativeFirstRed({
    actorId:1,physicalPointers:[pointer("pointerdown",2000),pointer("pointerup",2036)],
    worldActions:[action(1,100),action(2,108),action(3,114)],
    senderSamples:[send(81,false)],
  });
  assert.equal(light.actualHoldMs,36);
  assert.equal(light.nativeHoldAtLeast135Ms,false);
  assert.equal(light.lightWorldObserved,true);
  assert.equal(light.verdict,"LIGHT_DAMAGE_OR_GEOMETRY_UNPROVEN");
  assert.equal(light.pass,false);
  const untrusted=summarizeM121NativeFirstRed({
    actorId:1,physicalPointers:[pointer("pointerdown",2000,false),pointer("pointerup",2036)],
    worldActions:[],senderSamples:[],
  });
  assert.equal(untrusted.verdict,"INCOMPLETE_PHYSICAL_POINTER");
  assert.equal(untrusted.actualHoldMs,null);
  assert.equal(untrusted.pass,false);
});

test("M121 diagnostic rejects foreign/invalid evidence and retains unchanged authoritative HP gate", () => {
  assert.throws(()=>summarizeM121NativeFirstRed({actorId:0,physicalPointers:[],worldActions:[],senderSamples:[]}),TypeError);
  assert.throws(()=>summarizeM121NativeFirstRed({actorId:1,physicalPointers:[],worldActions:[],senderSamples:[],expectedLightHoldMs:-1}),TypeError);
  const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  assert.match(runner,/M121_NATIVE_PHYSICAL_LIGHT_FIRST_RED/);
  assert.match(runner,/throw new Error\(`M121 directional light did not resolve as one 34 HP hit:/);
  assert.match(runner,/attackerResult\.opponentHp !== 66/);
  assert.match(runner,/defenderResult\.playerHp !== 66/);
});
