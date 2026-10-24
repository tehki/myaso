import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M121 genuine W3C side-key terminal is a distinct tick after pointerUP", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const begin = source.indexOf("async function performArenaDirectionalLight(");
  const end = source.indexOf("\nasync function ", begin + 10);
  assert.ok(begin >= 0 && end > begin, "use original native M121 choreography");
  const flight = source.slice(begin, end);
  const keyBlock = flight.slice(flight.indexOf('type: "key"'), flight.indexOf('type: "pointer"'));
  const mouseBlock = flight.slice(flight.indexOf('type: "pointer"'));
  const key = [...keyBlock.matchAll(/\{ type: "(keyDown|keyUp|pause)"(?:, duration: (\d+))?,?[^}]*\}/g)]
    .map(([,kind,ms]) => ({ kind, ms: ms == null ? null : Number(ms) }));
  const mouse = [...mouseBlock.matchAll(/\{ type: "(pointerMove|pointerDown|pointerUp|pause)"(?:, duration: (\d+))?[^}]*\}/g)]
    .map(([,kind,ms]) => ({ kind, ms: ms == null ? null : Number(ms) }));
  assert.equal(key.length, mouse.length, "one W3C action per source per physical tick");
  assert.equal(key.length, 7);
  assert.equal(key[0].kind, "keyDown");
  assert.equal(mouse[2].kind, "pointerDown");
  assert.equal(mouse[4].kind, "pointerUp");
  assert.equal(key[4].kind, "pause", "side direction remains physically held during LMB release");
  assert.equal(key[5].kind, "pause", "no same-tick keyUp can race pointerUP");
  assert.equal(key[6].kind, "keyUp");
  assert.equal(mouse[5].kind, "pause");
  assert.equal(mouse[5].ms, 0);
  assert.equal(mouse[6].kind, "pause");
  assert.equal(mouse[6].ms, 150, "retain original browser observation pause");
  assert.ok(!flight.includes("dispatchEvent("));
  assert.ok(!flight.includes("new PointerEvent("));
  assert.ok(!flight.includes("sendInput("));
});
