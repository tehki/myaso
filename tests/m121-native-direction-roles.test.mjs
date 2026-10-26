import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectM121NativeRoles } from "../scripts/m121-native-direction-roles.mjs";

test("M121 right and mirrored left select opposite real actor roles", () => {
  const ready = [
    {browser:"chrome", playerNetId:1},
    {browser:"firefox", playerNetId:2},
  ];
  assert.deepEqual(selectM121NativeRoles(ready, "right"), {
    attackerName:"chrome", defenderName:"firefox",
    attackerNetId:1, defenderNetId:2,
    expectedStrafeCode:"KeyW", direction:"right",
  });
  assert.deepEqual(selectM121NativeRoles(ready, "left"), {
    attackerName:"firefox", defenderName:"chrome",
    attackerNetId:2, defenderNetId:1,
    expectedStrafeCode:"KeyS", direction:"left",
  });
});
test("M121 direction follows actual server IDs when browser join order is reversed", () => {
  const ready = [
    {browser:"chrome", playerNetId:2},
    {browser:"firefox", playerNetId:1},
  ];
  assert.equal(selectM121NativeRoles(ready, "right").attackerName, "firefox");
  assert.equal(selectM121NativeRoles(ready, "left").attackerName, "chrome");
});
test("M121 cannot green a missing, duplicated or synthetic third actor", () => {
  const valid = [{browser:"chrome",playerNetId:1},{browser:"firefox",playerNetId:2}];
  for (const direction of ["both","auto","",null]) {
    assert.throws(() => selectM121NativeRoles(valid, direction), TypeError);
  }
  for (const bogus of [
    [],[valid[0]],[valid[0],valid[0]],
    [{...valid[0]}, {...valid[1],playerNetId:1}],
    [...valid,{browser:"chrome2",playerNetId:3}],
    [{...valid[0],playerNetId:0},valid[1]],
  ]) assert.throws(() => selectM121NativeRoles(bogus, "left"), TypeError);
});
test("M121 original runner enforces authentic KeyS and existing World 34HP proof", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start = source.indexOf("async function runOnlineUiDirectionalLightFlight(entries)");
  const end = source.indexOf("async function ",start+1);
  assert.ok(start>=0 && end>start);
  const block=source.slice(start,end);
  assert.ok(block.includes('requestedDirection === "left" ? "KeyS" : "KeyW"'));
  assert.ok(block.includes('selectM121NativeRoles(ready, m121Direction)') === false,
    "M121 role selection is in the genuine preparation function");
  assert.ok(block.includes('const strafeKey = attackRight ? "w" : "s";'));
  assert.ok(block.includes('performArenaDirectionalLight(attacker, attackerElementId, strafeKey, attackOffset)'));
  assert.ok(block.includes('attackerResult?.opponentHp === 66'));
  assert.ok(block.includes('defenderResult?.playerHp === 66'));
  assert.ok(block.includes('M121_ACTUAL_SENDER_WORLD_CHRONOLOGY'));
});
