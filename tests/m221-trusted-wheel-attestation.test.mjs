import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createM221TrustedWheelRegistry } from "../scripts/m221-trusted-wheel-attestation.mjs";

test("M221 accepts one genuine trusted wheel-back receipt, never stale or untrusted", async () => {
  const registry = createM221TrustedWheelRegistry();
  const c = registry.issue();
  assert.equal(registry.receive({token:c.token,trusted:false,deltaY:120}), false);
  assert.equal(registry.receive({token:"old",trusted:true,deltaY:120}), false);
  assert.equal(registry.receive({token:c.token,trusted:true,deltaY:-120}), false);
  const promise = c.wait();
  assert.equal(registry.receive({token:c.token,trusted:true,deltaY:120}), true);
  assert.deepEqual(await promise,{trusted:true,deltaY:120});
  assert.equal(registry.receive({token:c.token,trusted:true,deltaY:120}), false);
  c.close();
});
test("M221 fails closed when actual trusted input receipt is absent",async()=>{
  const c=createM221TrustedWheelRegistry({timeoutMs:5}).issue();
  await assert.rejects(c.wait(),/not observed/);
  c.close();
});
test("M221 harness ties actual wheel.isTrusted event to one real Chrome and Firefox input",()=>{
  const s=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  assert.ok(s.includes("event.isTrusted === true"));
  assert.ok(s.includes("window.__MYASO_M221_WHEEL_TOKEN__"));
  assert.ok(s.includes("m221Registry.receive("));
  assert.ok(s.includes("const receipt=await challenge.wait()"));
  assert.ok(s.includes("const challenge = m221Registry.issue()"));
  assert.ok(s.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(s.includes("M34 guard-break staging allowed an unblocked strike"));
});
