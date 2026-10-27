import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

// Execute the exact native W3C helper used by all four real original players.
const source = readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs", import.meta.url), "utf8");
const begin = source.indexOf("function dispatchPreparedClick({a}){");
const end = source.indexOf("\n async function collectPreparedClick(", begin);
assert.ok(begin > 0 && end > begin, "actual four-player native action helper must exist");

test("four-player genuine short Light sends one same-pointer W3C down/up without a driver pause tick", async () => {
  const calls = [];
  const request = (...args) => { calls.push(args); return Promise.resolve({}); };
  const fn = runInNewContext(source.slice(begin, end) + "\ndispatchPreparedClick;", {request});
  const actor = {s:{base:"http://127.0.0.1:9516",id:"native-firefox"}};
  await fn({a:actor});
  assert.equal(calls.length,1);
  assert.equal(calls[0][1],"POST");
  assert.equal(calls[0][2],"/session/native-firefox/actions");
  const actions=JSON.parse(JSON.stringify(calls[0][3].actions));
  assert.deepEqual(actions,[{
    type:"pointer",id:"four-real-lmb",parameters:{pointerType:"mouse"},
    actions:[{type:"pointerDown",button:0},{type:"pointerUp",button:0}],
  }], "no extra driver pause between original physical edges");
  assert.match(source,/Math\.max\(\.\.\.presses\.map\(p=>p\.tick\)\)-Math\.min/);
  assert.match(source,/heldMs<COMBAT\.attack\.windupMs/);
  assert.match(source,/await Promise\.all\(prepared\.map\(dispatchPreparedClick\)\)/);
});
