import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// An original Heavy's attacker returning Idle does not prove its target is
// Idle. Source contract only: true four-browser World qualification remains
// mandatory; never fabricate combat, identity, native movement or HIT events.
const runner = readFileSync(
  new URL("../tools/art/main0_v2_knights_combat_four_native.mjs", import.meta.url),
  "utf8",
);
const begin = runner.indexOf("const heavyReturnedIdle=await waitFor(");
const end = runner.indexOf("const pointer=await evaluate(attacker,", begin);
const stage = runner.slice(begin, end);

test("four-browser original Light awaits BOTH actual replicated post-Heavy Idle actors", () => {
  assert.ok(begin>=0 && end>begin, "actual source0 Heavy→Light scenario exists");
  const heavyReceipt = stage.indexOf("assert(heavyReturnedIdle,");
  const bothIdle = stage.indexOf("const idleBeforeLight=await waitFor(async()=>{");
  const originalStrict = stage.indexOf("assert.ok(a&&t&&a.action===0&&t.action===0,");
  const geometry = stage.indexOf("const gap=t.x-a.x;");
  assert.ok(heavyReceipt>=0 && bothIdle>heavyReceipt
    && originalStrict>bothIdle && geometry>originalStrict,
    "strict original World Idle+geometry gate remains AFTER bounded genuine recovery wait");
  assert.match(stage, /const pair=await readOriginalPair\(\);/);
  assert.match(stage, /pair\.a\?\.action===0&&pair\.t\?\.action===0\?pair:false/);
  assert.match(stage, /},5000\)\.catch\(async error=>\{/);
  assert.match(stage, /COMBAT4C_POST_HEAVY_IDLE_WAIT_FAILED/);
  assert.match(stage, /originalWorldTail:readAuthoritativeWorld\(\)\.slice\(-2200\)/);
  assert.match(stage, /COMBAT4C_POST_HEAVY_BOTH_IDLE/);
  assert.match(stage, /await sleeps\(310\); \/\/ avoid an accidental second-tap native Dash/);
  assert.match(stage, /keyDown",value:key/);
  assert.match(stage, /keyUp",value:key/);
  assert.match(stage, /verified\.tick>before\.tick/);
  assert.match(stage, /assert\.ok\(stage,/);
  assert.doesNotMatch(stage, /dispatchEvent\(|new KeyboardEvent|world\.set_input|teleport/,
    "must preserve genuine W3C movement, one Rust World and original reach");
});
