import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("original four-browser stage focuses the canvas before trusted W3C WASD", () => {
  const source = readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs", import.meta.url), "utf8");
  const begin = source.indexOf("const pulse=async(a,key,ms)=>{");
  const end = source.indexOf("const expectedHp=new Map(", begin);
  assert.ok(begin >= 0 && end > begin, "reuse one original native input sender");
  const sender = source.slice(begin, end);
  const focus = sender.indexOf("c.focus()");
  const actualKeys = sender.indexOf('return request(a.s.base,"POST"');
  assert.ok(focus >= 0 && actualKeys > focus, "focus actual game canvas BEFORE native keyboard");
  assert.match(sender, /document\.activeElement===c/);
  assert.match(sender, /assert\.equal\(arenaFocused,true/);
  assert.match(sender, /type:"keyDown",value:key/);
  assert.match(sender, /type:"keyUp",value:key/);
  assert.doesNotMatch(sender, /dispatchEvent|new KeyboardEvent|world\.set_input|teleport/,
    "input must remain genuine WebDriver keys, never fabricated World movement");

  const stage = source.slice(source.indexOf("async function stagePair("), source.indexOf("async function prepareClick("));
  assert.match(stage, /Math\.abs\(f\.y-t\.y\)<=8/);
  assert.match(stage, /Math\.abs\(next\.x-f\.x\)<=2/);
  assert.match(stage, /stable\.serverTick>p\.serverTick/);
  assert.match(stage, /attempts\.push\(\{key,durationMs,beforeTick:p\.serverTick,afterTick:after\.serverTick/);
  assert.match(stage, /throw Error\("real WASD could not establish stable authoritative pair geometry:/);
  assert.doesNotMatch(stage, /fighter\.x\s*=|world\.set_input|setPosition|teleport/,
    "staging still requires authoritative World displacement");
});
