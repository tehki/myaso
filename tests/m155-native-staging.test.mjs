import test from "node:test";
import assert from "node:assert/strict";
import { planM155NativeStaging } from "../scripts/m155-native-staging.mjs";
const roles = { kickerId: 1, defenderId: 2, punisherId: 3 };
const fighters = xs => xs.map((x, i) => ({ netId: i + 1, x, y: 42, hp: 100, guard: 100, action: 0 }));
test("M155 stages the excluded punisher before the kicker from real spawn positions", () => {
  assert.deepEqual(planM155NativeStaging(fighters([42,186,330]), roles), { actorId:3,key:"a",holdMs:131 });
  assert.deepEqual(planM155NativeStaging(fighters([42,186,302]), roles), { actorId:1,key:"d",holdMs:419 });
  assert.equal(planM155NativeStaging(fighters([132,186,302]), roles), null);
  assert.equal(planM155NativeStaging(fighters([240,186,70]), roles), null);
});
test("M155 fails closed on compromised roles, phases and geometry", () => {
  for (const mutate of [f=>{f[2].action=19;},f=>{f[0].hp=66;},f=>{f[1].guard=62;},
    f=>{f[2].netId=2;},f=>{f[0].x=NaN;},f=>{f[2].y=70;},f=>{f[2].x=100;}]) {
    const f=fighters([132,186,302]);mutate(f);assert.throws(()=>planM155NativeStaging(f,roles));
  }
});
